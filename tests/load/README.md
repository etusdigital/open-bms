# tests/load — bateria de carga EVO-1442

Scaffolding compartilhado para os 4 testes de carga (EVO-1027 / 1071 / 1072 / 1073).
Tudo que é reaproveitável vive em `_shared/`; cada card filho consome daqui.

## Estrutura

```
_shared/
  k6/            harness k6 (auth, métricas custom, config de stages, smoke.js)
  seed/          inserts diretos no PG (contatos, eventos, segmentos)
  metrics/       sidecar Node — docker stats + bull LLEN + pg_stat_activity → CSVs
  mock-webhook/  k6 que dispara eventos SendGrid sintéticos no event-receiver
  report/        gera linha markdown a partir do summary k6 + docker-stats.csv
evo-1071-contact-ingest/
evo-1072-automation/
evo-1073-segments/
```

## Pré-requisitos

- `k6` ≥ 0.50 — <https://k6.io/docs/get-started/installation/>
- `node` ≥ 20 (já no monorepo)
- `pnpm` (mesma versão do root)
- `docker` + `docker compose` (pra rodar a stack local)
- `redis-cli` e `psql` no PATH (sidecar de métricas chama via spawn)

## Rodar local (golden path)

```bash
# 1. Sobe a stack
docker compose up -d

# 2. Smoke test do harness (valida login + saída CSV)
mkdir -p tests/load/_shared/k6/out
k6 run \
  --summary-export=tests/load/_shared/k6/out/summary.json \
  --out csv=tests/load/_shared/k6/out/k6.csv \
  tests/load/_shared/k6/smoke.js

# 3. Sidecar de métricas em paralelo
node tests/load/_shared/metrics/collect.mjs \
  --out tests/load/_shared/k6/out \
  --interval 10000 &
METRICS_PID=$!

# 4. Mock de webhook (1k eventos SendGrid sintéticos)
k6 run -e EVENTS=1000 -e BATCH=50 \
  tests/load/_shared/mock-webhook/sendgrid-events.js

# 5. Para o sidecar e gera a linha de relatório
kill $METRICS_PID
node tests/load/_shared/report/report.mjs \
  --with-header \
  --k6 tests/load/_shared/k6/out/summary.json \
  --docker tests/load/_shared/k6/out/docker-stats.csv \
  --label "smoke" --env "local"
```

## Seed em escala

```bash
# 10k contatos para account_id=1 (admin bootstrap) — esperado < 30s
pnpm tsx tests/load/_shared/seed/seed-contacts.ts --count 10000 --account 1

# Rola 5 eventos por contato e materializa last_open/last_click/last_sent na contacts.
# (Row-level event log mora em ClickHouse — ver nota abaixo.)
pnpm tsx tests/load/_shared/seed/seed-events.ts --contacts 10000 --events-per-contact 5 --account 1

# Segmento (simples ou complexo) — retorna o tag.id criado no stderr
pnpm tsx tests/load/_shared/seed/seed-segment.ts --account 1 --complexity complex --name "load complex"
```

## Rodar contra staging (Hetzner)

```bash
export BASE_URL=https://api.staging.bms.example.com
export EVENT_RECEIVER_URL=https://events.staging.bms.example.com
export INTERNAL_AUTH_TOKEN=<valor do .env do stack staging>
export LOGIN_EMAIL=<conta de teste>
export LOGIN_PASSWORD=<senha>

k6 run -e PROFILE=10k tests/load/_shared/k6/smoke.js
```

O sidecar `collect.mjs` precisa de acesso aos containers — só faz sentido rodar
**no host** da stack (não dá pra coletar docker stats via SSH-only sem ajustar
`--host`). Em staging, rode-o via SSH no nó:

```bash
ssh staging "cd /opt/bms && node tests/load/_shared/metrics/collect.mjs --out /tmp/metrics" &
```

## Critério de "limite"

`report.mjs` classifica:

- ✅ `ok` — p95 ≤ 5s e error rate ≤ 1%
- 🛑 `limit-reached` — p95 > 5s **ou** error rate > 1%
- ⚠️ `no-data` — summary.json ausente / sem amostras

Esses thresholds vêm direto do AC do EVO-1443 e estão duplicados em
`_shared/k6/config.js` (`thresholds`) para falhar o run k6 também.

## Notas de implementação

- **Webhook auth**: a stack usa `x-internal-token` (não HMAC) — todas as rotas
  em `apps/event-process/src/app.controller.ts` exigem esse header. O AC do
  EVO-1443 menciona HMAC porque providers reais (Mailersend / Resend / Mandrill)
  sim usam, mas o gate de entrada local é shared-secret. `INTERNAL_AUTH_TOKEN`
  é o mesmo valor do `docker-compose.yml`.
- **Event-process não exposto**: webhooks vão pra `event-receiver:4011`, que é
  o entrypoint real de produção; ele encaminha via AMQP pro event-process.
- **Reuso EVO-1023/1037**: o `sendgrid-mock` que já roda na stack
  (`docker-compose.yml`, porta 4010) gera webhooks reais quando msgops-api manda
  um send — em testes que envolvem o caminho campanha → envio, **prefira deixar
  o sendgrid-mock disparar os eventos** em vez de usar este mock-webhook. Use
  o mock-webhook só pra teste isolado do path de ingestão de evento.
- **Seed bypassa API por design**: insert direto no PG é ~5x mais rápido que
  `POST /contacts`; o AC pede 10k em <30s e a API trip side-effects (tags,
  validações de email, custom fields) que não importam pra preparar volume.
- **ClickHouse**: o stack OSS não cria a tabela `events_logs` no PG (a entity
  existe mas a migration mora num módulo enterprise). Eventos row-level vão pro
  ClickHouse via event-process. `seed-events.ts` por isso só materializa as
  colunas-resumo (`last_open/click/sent`) na `contacts`, que é o que os
  segmentos do `tags` filtram. Se algum filho precisar do log row-level (ex.
  EVO-1073 medindo agregação ClickHouse), adicionar `--target=clickhouse` lá.
