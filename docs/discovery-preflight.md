# Discovery Preflight — BMS Open Source

**Data:** 2026-04-22
**Escopo:** Feature 0 — limpeza de segurança e inventário pré-publicação

---

## 1. Credenciais no histórico git

**Situação:** O "Initial commit" (`34c91a4`) contém material de chave privada proveniente de arquivos `key.json` e `development-staging.json` que existiam no repositório.

**Arquivos removidos do working tree:**

- `apps/twilio-messaging/key.json`
- `apps/send-whatsapp/key.json`
- `apps/campaign-packer/key.json`
- `apps/campaign-packer/new-key.json`
- `apps/campaign-events-tracker/key.json`
- `apps/message-trigger/development-staging.json`

**Estado atual:** Working tree limpo. O histórico ainda contém os segredos no commit inicial — será endereçado com `git filter-repo` ou squash antes da publicação pública.

**Decisão:** squash do histórico completo em momento oportuno (combinado com equipe).

---

## 2. Arquivos `.env` versionados

`apps/msgops-api/.env` e `apps/frontend-vue2/.env` **não estavam rastreados** pelo git ao momento da auditoria (`git ls-files` retornou vazio). Nenhuma ação necessária.

`.gitignore` reforçado para cobrir:

```
.env
.env.*
!.env.example
key.json / *-key.json / service-account*.json
*.pem / *.p12
```

---

## 3. Decisão: git filter-repo vs squash

**Decisão tomada:** squash inicial antes da publicação pública.
Razão: menor impacto operacional, repositório tem apenas 2 commits.

---

## 4. Código morto — Datastore

**Resultado da verificação:** `@google-cloud/datastore` **não era dead code** — estava ativo em dois pontos.

**Removido nesta fase:**

| O que foi removido                                                                                     | Motivo                                                                                   |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `apps/msgops-api/src/modules/lead-state/` (módulo inteiro)                                             | `// TODO: REMOVE IT!` presente no service; endpoint legado de contagem de leads por step |
| `GoogleDatastoreProvider` em `campaigns.module.ts`                                                     | Registrado mas nunca injetado em nenhum service                                          |
| `apps/msgops-api/src/providers/google-datastore.provider.ts`                                           | Provider sem uso após remoção acima                                                      |
| `@google-cloud/datastore` de `msgops-api`, `campaign-events-tracker`, `tag-process`, `message-trigger` | Dependência sem referência no código-fonte                                               |
| `getLeadsByAutomationSteps()` em `frontend-vue2/automations.service.ts`                                | Chamava o endpoint removido, nunca usado em nenhuma view                                 |

**Verificação final:**

```bash
grep -r "@google-cloud/datastore" apps --include="*.ts" --include="*.json"
# → zero hits
```

---

## 5. Inventário BigQuery em msgops-api

**Resultado:** `GoogleBigqueryProvider` registrado em `automations.module.ts` e `statistics.module.ts`, mas **nunca injetado** em nenhum service. Único rastro em código era um comentário `// TODO: ... bigquery` em `statistics.aggregation.ts`.

**Ação tomada:** removido completamente nesta fase.

| O que foi removido                                                |
| ----------------------------------------------------------------- |
| `apps/msgops-api/src/providers/google-bigquery.provider.ts`       |
| Import + entrada em `providers[]` de `automations.module.ts`      |
| Import + entrada em `providers[]` de `statistics.module.ts`       |
| `"@google-cloud/bigquery": "^8.1.1"` de `msgops-api/package.json` |

**Decisão Fase 8:** BigQuery removido. Não há implementação pendente de migração — o provider nunca foi chamado.

---

## 6. Outros itens sanitizados nesta fase

### GH Actions

- 19 arquivos `deploy-*.yml` e `_deploy-cloudrun.yml` sem IDs de projeto Etus hardcoded.
- Usam `${{ vars.GCP_PROJECT_STAGING }}`, `${{ vars.GCP_PROJECT_PRODUCTION }}`, `${{ vars.ARTIFACT_REPO }}`.

### Código específico de cliente → configurável via env

- `cors.config.ts`: `CORS_ORIGINS` e `CORS_CF_PAGES_PROJECT` via env
- `accounts.service.ts`: `SENDGRID_SUBUSER_PREFIX` e `SENDGRID_SUBUSER_EMAIL` via env
- `app-store.ts` (frontend-react): `VITE_AUTH0_ROLES_CLAIM` e roles configuráveis via env
- `tracker/script.js`: configurável via `window.BMS_CONFIG`
- `tracker.service.ts` (tag-process e message-trigger): `PIXEL_EVENT_STORE_URL`
- `Settings.vue` e `EmailPostMaster.vue`: assets e postmaster via env
- `schema.sql`: IP interno e USER MAPPING removidos/anonimizados
- `automation-schema.json`: `$id` trocado por `https://bms.example.com/schema`

### Arquivos removidos

- 19 `README.md` de apps + 9 pastas `docs/` de apps
- `apps/msgops-api/src/utils/querys.json` (arquivo órfão, nunca importado)
- `apps/msgops-api/CONTRIBUTING.md`, `apps/frontend-vue2/migrations.md`
- `apps/frontend-vue2/reports/test-reporter.xml`

---

## 7. Alinhamento dos `.env.example`

Todos os 19 apps verificados. Ações por categoria:

**Removido dos exemplos:**

- `TYPEORM_CONNECTION`, `TYPEORM_ENTITIES`, `TYPEORM_ENTITIES_DIR` (não usados em código — herança de copy-paste)
- `DATASTORE_*`, `GOOGLE_BIGQUERY_*`, `PONTALTECH_*` (funcionalidades removidas ou inexistentes no código)
- `STORE_NAMESPACE`, `ATTR_NAME_*`, `SEGMENTS_DATASTORE_KIND`, `STOP_CAMPAIGNS`, `DEFAULT_WARMUP_LIST` (vars sem referência no código)
- `API_KEY`, `DATA_API_KEY` do `msgops-api` (sem uso em código — removidos)
- `SHOULD_ADD_BHE_PARAMETER_TO_LINKS`, `ACCOUNTS_WITH_REDIRECT_FEATURE` do `send-email`
- Script `script:fill` do `tag-process/package.json` (referenciava `key.json` deletado)

**Adicionado nos exemplos:**

- `SERVICE_ACCOUNT` no `lead-conception` (estava faltando — crítico)
- `tracker/.env.example` criado do zero (app não tinha o arquivo)
- Vars de tópicos Pub/Sub faltantes em `campaign-packer`, `message-trigger`, `send-push`
- `CLICKHOUSE_*` no `msgops-api`
- `OPEN_AI_KEY`, `SENTRY_DSN`, `DISCORD_API_WEBHOOK`, `GOOGLE_TASK_BMS_USAGE`, `GOOGLE_TASK_WHATSAPP_MESSAGE`, `GOOGLE_MANAGER_TOPIC`, `BRIUS_HOSTURL`, `FRONTEND_URL`, `TRANSACTIONAL_FROM_*`, `CORS_CF_PAGES_PROJECT`, `UNLAYER_MIGRATION_ENABLED`, `TYPEORM_SSL/SYNCHRONIZE` no `msgops-api`
- `DATABASE_MAX_CONECTIONS`, `SLACK_WEBHOOK_URL` no `event-process`
- `MESSAGES_TO_ADD_FWD`, `LIMIT_CONTACT_BATCH`, `FEATURE_SPLIT_TERM` no `send-email`

---

## 8. Critério de aceitação — status

| Critério                                                         | Status                                  |
| ---------------------------------------------------------------- | --------------------------------------- |
| `git log --all -p \| grep "BEGIN PRIVATE KEY"` retorna zero hits | ⏳ Pendente squash (working tree limpo) |
| `grep -r "@google-cloud/datastore" .` retorna zero hits          | ✅                                      |
| `grep -r "@google-cloud/bigquery" .` retorna zero hits           | ✅                                      |
| Todos os apps com `.env.example` alinhado ao código              | ✅                                      |
| Nenhum arquivo `key.json` / SA JSON no working tree              | ✅                                      |
| GH Actions sem IDs de projeto hardcoded                          | ✅                                      |
