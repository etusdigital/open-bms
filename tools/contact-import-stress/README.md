# Contact-Import Stress Tool — EVO-1024

Standalone TypeScript script que dispara cargas crescentes contra
`POST /contacts/import` para descobrir o **N-limite** de contatos suportado
pela implementação atual (`apps/msgops-api/src/modules/contacts/contacts.service.ts:827`).

> **Contexto:** após a remoção das filas assíncronas Lead Conception / Lead Receive,
> o endpoint ficou 100% síncrono em memória. Sem chunking, sem bulk-insert, sem
> transação envolvendo o lote. Este teste mede até onde aguenta antes de quebrar
> e gera dados para o front bloquear o operador preventivamente
> ([EVO-1024](https://linear.app/evoai/issue/EVO-1024/teste-de-importacao-de-contatos-descobrir-limite)).

---

## Pré-requisitos

1. **Docker + docker compose** instalados localmente.
2. **Stack compose UP**, na raiz do monorepo:

   ```bash
   docker compose up -d
   ```

   Confirmar que `msgops-api`, `postgres` e `redis` estão `healthy`:

   ```bash
   docker compose ps
   ```

3. **Bootstrap admin** configurado em `apps/msgops-api/.env`:

   ```env
   BOOTSTRAP_ADMIN_EMAIL=admin@example.test
   BOOTSTRAP_ADMIN_PASSWORD=ChangeMe!1234
   ```

   Quando a tabela `users` está vazia no boot, o `LocalAuthProvider` cria esse
   super_admin automaticamente.

4. **Account + usuário de teste** com a permission `audience:contacts_import`.
   - Logar como super_admin (passo 3), criar uma account, criar um usuário
     e atribuir a permission via console/API admin do msgops-api.
   - Anotar o **`id` numérico** da account (será o `Account-Id` header) — consulta
     direta no Postgres do compose:

     ```bash
     docker exec -it postgres psql -U $POSTGRES_USER -d $POSTGRES_DB \
       -c "select id, name from accounts;"
     ```

5. **API URL:** o `docker-compose.yml` expõe `msgops-api` em
   `localhost:5001` (`SERVER_PORT=5001`). Use `STRESS_API_URL=http://localhost:5001`.

6. **`.env.stress`** populado a partir do exemplo:

   ```bash
   cp tools/contact-import-stress/.env.example tools/contact-import-stress/.env.stress
   # edite e preencha STRESS_EMAIL / STRESS_PASSWORD / STRESS_ACCOUNT_ID
   ```

   > `.env.stress` está no `.gitignore`. Nunca comite credenciais.

---

## Smoke (validação da pipeline — AC1)

Antes da matriz cheia, valide ponta-a-ponta:

```bash
pnpm tsx tools/contact-import-stress/run.ts --smoke
```

Esperado:

- 1 request `POST /contacts/import` com N=10 → `success`
- 1 linha em `tools/contact-import-stress/results/run-<ts>.csv`
- Relatório gerado em `tools/contact-import-stress/reports/report-<ts>.md`
- Exit code `0`

Se falhar:

- `Auth failed: HTTP 401` → conferir `STRESS_EMAIL` / `STRESS_PASSWORD`.
- `Configuration error — verifique permission audience:contacts_import` →
  conferir permission do usuário ou `STRESS_ACCOUNT_ID`.

---

## Matriz cheia

```bash
pnpm tsx tools/contact-import-stress/run.ts
```

Default: `--sizes 100,500,1000,2000,5000,10000,25000,50000,100000`,
`--seed <time-based>`, `--timeout 300000` (5 min), `--safety-margin 0.7`,
`--bisect-step 500`, `--container msgops-api`.

> **Sobre a seed:** sem `--seed`, o runner gera uma seed nova por execução
> (Date.now ⊕ nonce 16-bit) — cada run insere emails diferentes e não bate em
> "duplicate email" no Postgres. A seed efetiva aparece no log de start
> (`seed=<n> (pass --seed <n> to reproduce)`) e em todas as linhas do CSV.
> Quando precisar repetir um payload exato (debug, regressão), passe
> `--seed <n>` com o mesmo valor.

**Comportamento:**

1. Loop sequencial pelos Ns; uma linha CSV por N.
2. Para no primeiro N que falhe com `timeout` / `http-5xx` / `container-oom`.
3. Se houve falha e o gap > `--bisect-step`, **bissecta** entre o último N de
   sucesso e o primeiro N de falha, até no máximo 8 iterações.
4. Gera o relatório markdown final com **tabela**, **curva ASCII** (latência e
   memória) e o **N-Limite Recomendado** = `floor(firstFailN * safety-margin)`.

**Flags úteis:**

| Flag                     | Default          | Para quê                                                                                       |
| ------------------------ | ---------------- | ---------------------------------------------------------------------------------------------- |
| `--sizes "100,500,..."`  | matriz padrão    | Customizar Ns testados                                                                         |
| `--seed <int>`           | time-based       | Default: seed nova por run (emails únicos). `--seed N` reproduz o payload byte-idêntico (AC5). |
| `--timeout <ms>`         | `300000`         | Distinguir "lento" de "travou"                                                                 |
| `--safety-margin <0..1>` | `0.7`            | Margem aplicada sobre `firstFailN`                                                             |
| `--bisect-step <int>`    | `500`            | Granularidade da bisseção                                                                      |
| `--no-bisect`            | —                | Pular bisseção                                                                                 |
| `--container <name>`     | `msgops-api`     | Alvo do `docker stats`                                                                         |
| `--smoke`                | —                | Atalho para N=10 sem bisseção                                                                  |
| `--api-url <url>`        | env              | Override de `STRESS_API_URL`                                                                   |
| `--email <addr>`         | env              | Override de `STRESS_EMAIL`                                                                     |
| `--password <pw>`        | env / **prompt** | Override de `STRESS_PASSWORD` (prefira o prompt interativo)                                    |
| `--account-id <int>`     | env              | Override de `STRESS_ACCOUNT_ID`                                                                |

### Senha sem arquivo nem histórico

Se você **não** quiser persistir a senha no `.env.stress` nem deixar no histórico do shell, basta omitir `STRESS_PASSWORD`: o script vai pedir interativamente com input oculto.

```bash
# .env.stress só tem URL/email/account-id; sem STRESS_PASSWORD
pnpm tsx tools/contact-import-stress/run.ts --smoke
# → STRESS_PASSWORD (input hidden): ***
```

Ou passe tudo por flag, sem env:

```bash
pnpm tsx tools/contact-import-stress/run.ts --smoke \
  --api-url http://localhost:5001 \
  --email seu@email.com \
  --account-id 1
# → STRESS_PASSWORD (input hidden): ***
```

---

## Onde está o output

```
tools/contact-import-stress/
  results/run-<ISO timestamp>.csv     # CSV bruto
  reports/report-<ISO timestamp>.md   # relatório markdown
```

Ambas as pastas são **gitignored**. Cada execução gera um par CSV + relatório
com o mesmo timestamp ISO (data + hora + ms), então rodar várias vezes no
mesmo dia não sobrescreve nada — basta listar `reports/` para encontrar a
execução desejada.

---

## Como reportar o resultado (Task 12)

1. Rodar a matriz completa.
2. Anexar o CSV (`results/`) e o relatório (`reports/`) como comentário em
   [EVO-1024](https://linear.app/evoai/issue/EVO-1024/teste-de-importacao-de-contatos-descobrir-limite).
3. Comunicar o **N-Limite Recomendado** a Davidson para a EVO follow-up de
   bloqueio em `apps/frontend-react/src/features/contacts/contact-import-page.tsx`.

---

## O que conta como "limite"

O classificador trata como limit-failure (e bissecta a partir dele):

- `timeout` — `AbortController` disparou antes da resposta
- `http-5xx` — erro do servidor (incluindo falha de rede sem status)
- `http-413` — **Payload Too Large**, vem do `bodyParser.json({ limit: '16mb' })`
  em `apps/msgops-api/src/main.ts:72`. Esse é frequentemente o teto
  encontrado **antes** de bater em OOM/timeout. O recommendedN reflete isso.
- `container-oom` — `State.OOMKilled=true` OU `ExitCode=137` observado
  durante o request (collector amostra continuamente, não só pós-request,
  para sobreviver ao `restart: unless-stopped`)

`http-4xx` (≠ 413) **aborta o run** (exit 2) por ser config (permission,
account-id, payload malformado).

## Limitações conhecidas (também ficam no relatório como "Ressalvas")

- **Granularidade `docker stats` (~100–200ms):** picos curtos em N pequeno
  podem ser **subestimados**. Para perfilamento fino use heapdump / clinic.js
  em uma EVO de otimização posterior.
- **Local ≠ prod:** RAM/CPU/IO do desktop divergem do staging/prod. O N-limite
  é piso de referência; produção pode tolerar mais ou menos dependendo do
  hardware e da concorrência multi-account.
- **Sequencial single-account:** o teste **não** mede carga concorrente nem
  multi-account. Em prod, múltiplos clientes podem importar ao mesmo tempo
  e empurrar o limite real **para baixo**.
- **Postgres co-locado:** com saves seriais, o gargalo provável é o RTT por
  insert. IO local tende a ser mais rápido que Postgres gerenciado.
- **Gateway/proxy:** o script bate **direto** no port exposto do compose.
  Se prod tiver nginx/cloudflare na frente, timeouts e respostas mudam — não
  extrapole.
- **`http-4xx` aborta o run** (exit 2) por ser configuração, não limite.

---

## Estrutura interna (para manutenção)

```
tools/contact-import-stress/
  run.ts                  # CLI + orquestração
  payload-generator.ts    # mulberry32 + ContactBatch determinístico
  http-client.ts          # login() + importContacts() com fetch nativo
  metrics-collector.ts    # docker stats + isOOMKilled
  failure-classifier.ts   # oom > timeout > 5xx > 4xx > success
  bisect.ts               # busca binária do limite
  csv-writer.ts           # append-only CSV
  report-writer.ts        # markdown + tabela + ASCII chart
  tsconfig.json           # CommonJS / es2022
  .env.example            # template; usuário cria .env.stress
  README.md
```

Sem `package.json` próprio — reusa o `tsx` do workspace root.
Nenhuma dependência runtime nova (tudo nativo do Node 20: `fetch`,
`AbortController`, `performance`, `child_process`).
