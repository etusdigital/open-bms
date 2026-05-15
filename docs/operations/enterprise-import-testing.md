# Como testar — Importação Enterprise → OSS (EVO-1123)

Guia prático para validar a feature de import Enterprise → OSS via API Key.
Cobre as camadas de teste automatizado e o roteiro de teste manual ponta-a-ponta.

## Sumário das camadas

| Camada               | Onde                                                                    | Roda em CI?              | O que valida                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit — worker        | `apps/enterprise-import/src/**/*.spec.ts`                               | sim                      | BaseImporter (colunas reais, chave natural, FK remap, idempotência), client (retry/backoff), id-mapper, sequence-advancer, processor (onFailed/cleanup) |
| Unit — msgops-api    | `apps/msgops-api/src/modules/enterprise-import/**`, `setup`, `accounts` | sim                      | service, SSRF util, cifragem AES, DTOs, gate da feature                                                                                                 |
| Integração — worker  | `apps/enterprise-import/test/integration.spec.ts`                       | **não** (precisa Docker) | Pipeline real contra Postgres efêmero + mock Enterprise: persistência de todas as colunas, idempotência, preservação de id (instance), 4xx              |
| e2e — frontend       | `apps/frontend-react/e2e/enterprise-import.spec.ts`                     | **não** (skeleton)       | Fluxos super-admin e wizard via Playwright                                                                                                              |
| Manual ponta-a-ponta | seção abaixo                                                            | n/a                      | Stack completa local com Enterprise real ou mock                                                                                                        |

---

## 1. Testes unitários (rápido, sem infra)

```bash
# Worker (23 testes)
pnpm --filter enterprise-import test

# msgops-api — só a feature
pnpm --filter msgops-api test -- --testPathPatterns "enterprise-import|api-key-encryption|accounts-service|setup.service"

# msgops-api — suíte completa (502 testes)
pnpm --filter msgops-api test

# Type-check (os 3 apps)
pnpm --filter msgops-api type-check
pnpm --filter enterprise-import type-check
pnpm --filter frontend-react type-check
```

> Nota: a suíte do `frontend-react` tem ~30 falhas **pré-existentes** (áreas não
> relacionadas: campaigns/contacts/settings/messages/segments + 1 chave de
> locale) — confirmadas no baseline, fora do escopo do EVO-1123.

---

## 2. Teste de integração (testcontainers — Docker obrigatório)

Sobe um Postgres efêmero, cria o schema das **entities reais** a partir da
metadata TypeORM, sobe um mock HTTP do msgops-api Enterprise e roda o importer
de verdade. É o teste de maior confiança da engine.

**Pré-requisitos:** Docker rodando; imagem `postgres:16-alpine` (baixada
automaticamente na 1ª vez).

```bash
cd apps/enterprise-import
ENABLE_INTEGRATION_TESTS=true npx jest --rootDir . --testPathPatterns 'test/integration'
```

Cenários cobertos (todos verdes):

1. **account-scope** — persiste TODAS as colunas, sobrescreve `account_id`,
   mapeia `src→newId` pela chave natural (não posicional).
2. **idempotência** — rodar o importer 2× não duplica (retomada segura).
3. **instance-scope** — preserva o `id` de origem e não grava mapping.
4. **4xx** — `EnterpriseApi4xxError` sem retry.

Sem `ENABLE_INTEGRATION_TESTS=true` o describe é `skip` (não roda em CI).

---

## 3. e2e Playwright (frontend)

`apps/frontend-react/e2e/enterprise-import.spec.ts` é um **skeleton**
(`test.skip`). Para implementar/rodar:

```bash
cd apps/frontend-react
pnpm exec playwright install --with-deps   # 1ª vez
pnpm exec playwright test e2e/enterprise-import.spec.ts
```

Pré-requisitos: dev server up, super-admin seedado, backend com
`ENTERPRISE_IMPORT_ENABLED=true`, mock do Enterprise (msw/interceptors).

---

## 4. Teste manual ponta-a-ponta (stack local)

### 4.1 Variáveis de ambiente

**msgops-api**:

```bash
ENTERPRISE_IMPORT_ENABLED=true
# 32 bytes base64 — AES-256-GCM da API key persistida
ENTERPRISE_IMPORT_ENCRYPTION_KEY=$(openssl rand -base64 32)
# Opcional: allowlist de hosts do Enterprise (anti-SSRF forte)
ENTERPRISE_IMPORT_ALLOWED_HOSTS=enterprise.suaempresa.com
```

**worker `apps/enterprise-import`** (`.env` — ver `.env.example`):

```bash
TYPEORM_HOST=localhost TYPEORM_PORT=5432
TYPEORM_USERNAME=... TYPEORM_PASSWORD=... TYPEORM_DATABASE=...
REDIS_HOST=localhost REDIS_PORT=6379
ENTERPRISE_IMPORT_ENCRYPTION_KEY=<MESMA chave do msgops-api>
PORT=3001   # /health
```

> A chave de cifragem **tem que ser idêntica** nos dois processos — o
> msgops-api cifra a API key, o worker decifra.

### 4.2 Subir a stack

```bash
# Postgres + Redis (use seu docker-compose de dev)
docker compose up -d postgres redis

# Migrations (cria enterprise_import_jobs / enterprise_id_mappings + índices)
pnpm --filter msgops-api migration:run

# API + worker
pnpm --filter msgops-api dev
pnpm --filter enterprise-import dev
# health do worker:
curl -s localhost:3001/health   # {"status":"ok","service":"enterprise-import"}
```

### 4.3 Fluxo A — super-admin (account-scope)

1. Logue como super-admin → menu **Importar do Enterprise**
   (`/super-admin/accounts/import-enterprise`).
2. Preencha dados da conta + `enterpriseBaseUrl` + `enterpriseApiKey`
   (+ `enterpriseSourceAccountId` se quiser trazer statistics).
3. Submeta → resposta `{ accountId, jobId }`, redireciona pra tela de status.
4. O polling (`GET /imports/:jobId`) mostra progresso por entidade até
   `completed`. Verifique no banco:
   - `accounts` tem a conta (sem os custom fields default; **com**
     `api_key_tracker` e uma managed API key).
   - contagem por entidade bate com o Enterprise.
   - `enterprise_import_jobs.encrypted_api_key` = `NULL` ao concluir.
   - `enterprise_id_mappings` tem os mapeamentos `account` scope.
5. **Resume**: derrube o worker no meio, suba de novo, chame
   `POST /imports/:jobId/resume` → retoma do checkpoint sem duplicar.
6. **4xx**: use uma API key inválida → `status=failed`, sem retry, e a conta
   recém-criada é soft-deleted (sem progresso) — não fica órfã.

### 4.4 Fluxo B — Setup Wizard (ACCOUNT-scope)

> **Decisão de design (importante):** o wizard NÃO faz instance-scope. O Step 1
> do wizard cria o admin **e uma account**; instance-scope (que preserva IDs e
> exige `accounts` vazia) é assíncrono (job) e seria barrado/competiria com essa
> account — incompatível por construção, não por ordem. Então o passo do wizard
> faz **account-scope**: cria uma conta nova e importa os dados da conta
> Enterprise nela (async-safe, funciona em OSS não-virgem). Migração de
> instância inteira → seção 4.6.

1. Acesse `/setup`. Step 1 (Admin) cria o super-admin.
2. **Step 2 (Enterprise import)** aparece só com `ENTERPRISE_IMPORT_ENABLED=true`.
3. "Pular" → grava `system_config.enterprise_import_done={imported:false}` e vai
   pro Domínio. Refresh **não** re-mostra o passo (flag é a fonte da verdade).
4. Ou informe **Nome da conta** + `baseUrl` + `apiKey` → cria conta nova
   (dona = admin do Step 1) e enfileira job **account-scope**. Confira:
   - `accounts` ganha a nova conta (sem os custom fields default; **com**
     `api_key_tracker` + managed API key).
   - `enterprise_import_jobs.scope = 'account'`, `account_id` = id da conta nova.
   - `enterprise_id_mappings` populado (remap de FKs por chave natural).
   - `system_config.enterprise_import_done = { imported:true, scope:'account', accountId, jobId }`.

### 4.6 Migração de instância inteira (instance-scope) — procedimento separado

instance-scope (preserva todos os IDs do Enterprise 1:1) **só roda em OSS
virgem** (`accounts` vazia) e **não** é feito pelo wizard. É um provisionamento
controlado: rode o job `scope=instance` contra um DB **virgem**, ANTES de
qualquer bootstrap/admin. Como os usuários importados não têm credencial (F2 —
hash bcrypt não é exportável), o bootstrap do admin é feito **depois** do job
concluir (ex.: criar super-admin via API/seed). Verifique:

- ids preservados (Enterprise `id=42` → OSS `id=42`);
- `accounts_id_seq` avançado pra `max(id)+1` (SequenceAdvancer);
- sem entradas de `accounts` em `enterprise_id_mappings` (identidade).

### 4.5 Mock rápido do Enterprise (sem instância real)

A API Enterprise é o **mesmo codebase** — qualquer msgops-api serve. Para um
mock leve, espelhe o do teste de integração (`test/integration.spec.ts`):
um `node:http` que responde `/tags`, `/contacts`, ... no shape das entities
(camelCase) com `{ results, page, totalItems }` e exige
`Authorization: Bearer <key>`.

---

## 5. Checklist de aceite (mapa AC → como validar)

| AC                                | Validação                                                     |
| --------------------------------- | ------------------------------------------------------------- |
| AC1 `POST /accounts/import`       | Fluxo A passo 3                                               |
| AC2/AC6 status polling sem apiKey | `GET /imports/:jobId` — sem `encryptedApiKey` no JSON         |
| AC4 resume do checkpoint          | Fluxo A passo 5 + integração cenário 2                        |
| AC5 4xx cancela sem retry         | Fluxo A passo 6 + integração cenário 4                        |
| AC7 remap account-scope           | `enterprise_id_mappings` + integração cenário 1               |
| AC8 instance preserva id          | Seção 4.6 (procedimento separado) + integração cenário 3      |
| AC9 `enterprise_import_done`      | Fluxo B passos 3/4 (account-scope)                            |
| AC10 conta sem defaults           | Fluxo A passo 4 (sem custom fields default)                   |
| AC11/F14 concorrência             | 2 `POST` paralelos mesma conta → 2º = 409                     |
| AC12/F10 feature-flag             | `ENTERPRISE_IMPORT_ENABLED` off → rotas 404 + Step2 escondido |
| F9 anti-SSRF                      | `baseUrl` apontando p/ `127.0.0.1`/`169.254.169.254` → 400    |
| AC13 alto volume                  | `docs/operations/enterprise-import-perf.md`                   |

---

## 6. Troubleshooting

- **Worker não decifra a API key**: `ENTERPRISE_IMPORT_ENCRYPTION_KEY`
  divergente entre api e worker, ou não tem 32 bytes base64.
- **Job preso em `running`**: cheque logs do worker; `onFailed` só marca
  `failed` ao esgotar `attempts` (5). Sem retry em 4xx.
- **`enterpriseBaseUrl inválida` / `bloqueado (SSRF)`**: host privado/loopback;
  use host público ou ajuste `ENTERPRISE_IMPORT_ALLOWED_HOSTS`.
- **Integração falha ao subir container**: Docker daemon down, ou imagem
  `postgres:16-alpine` não baixou (sem rede).
- **Statistics pulado (`source_account_unknown`)**: account-scope sem
  `enterpriseSourceAccountId` — informe no `POST /accounts/import`.
- **Limitação conhecida**: ids embutidos em jsonb (`automations.steps`,
  `campaigns.tags`) **não** são remapeados em account-scope — pode exigir
  re-sync manual de segmentação pós-import.

```

```
