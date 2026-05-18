# Enterprise Import — Performance Runbook

Importação assíncrona Enterprise → OSS via BullMQ + worker dedicado
`apps/enterprise-import`.

## Quando usar este runbook

- Antes de habilitar a feature em ambiente de cliente Enterprise.
- Após mudanças no worker ou cliente HTTP que possam alterar throughput.
- Validação semestral de capacidade.

## Critérios de aceitação (AC13)

| Métrica                                                | Meta    |
| ------------------------------------------------------ | ------- |
| Tempo total para 1M+ contatos                          | < 6h    |
| Pico de RAM no container do worker                     | < 1GB   |
| Latência p95 do `GET /imports/:jobId` durante o import | < 500ms |

## Setup do ambiente de validação

1. Provisionar staging com Postgres, Redis e o worker `enterprise-import` (1
   réplica).
2. Subir mock do Enterprise:
   - Pode ser um spawn do próprio msgops-api alimentado com seed de >= 1M
     contatos, 50k mensagens, 100 campaigns.
   - Alternativa: msw em modo standalone com fixtures grandes geradas via
     `pnpm --filter enterprise-import seed:big-mock` (criar script).
3. Garantir `ENTERPRISE_IMPORT_ENABLED=true` no msgops-api e
   `ENTERPRISE_IMPORT_ENCRYPTION_KEY` igual nos dois apps.

## Procedimento

```bash
# 1) capturar snapshot do PG antes
pg_dump --schema-only > /tmp/before.sql
# capturar tamanho de tabelas relevantes
psql -c "SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN
  ('contacts','campaigns','messages','tags','events_statistics') ORDER BY 1;"

# 2) iniciar import via super-admin
curl -X POST https://staging/accounts/import \
  -H "Authorization: Bearer <super-admin-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountData": { "name": "Perf Test" },
    "enterpriseBaseUrl": "https://mock-enterprise.staging.local",
    "enterpriseApiKey": "..."
  }'
# anotar jobId

# 3) acompanhar
watch -n 5 "curl -s https://staging/imports/<jobId> | jq '{status, progress}'"

# 4) métricas em paralelo
docker stats msgops-enterprise-import   # RAM peak
ab -n 200 -c 5 -H "Authorization: Bearer <key>" https://staging/imports/<jobId>  # latency p95
```

## Tuning

| Parâmetro                               | Default | Observação                                                       |
| --------------------------------------- | ------- | ---------------------------------------------------------------- |
| `ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS` | 1000    | Subir pra 2000 reduz round-trips, mas aumenta RAM por transação. |
| `ENTERPRISE_IMPORT_BATCH_SIZE_MESSAGES` | 500     | Mensagens são objetos largos; cuidado ao subir.                  |
| `attempts` em JOB_OPTS                  | 5       | Backoff exponencial 5s base; suficiente pra blips de Enterprise. |
| Concorrência do worker (BullMQ)         | 1       | 1 conta por vez; subir requer pensar em locks de seq.            |

## Troubleshooting

- **Tempo total estoura 6h:** investigar se o Enterprise está retornando
  paginação consistente (`page` + `totalItems`); paginação solta força batch
  menor automaticamente.
- **RAM > 1GB:** reduzir `ENTERPRISE_IMPORT_BATCH_SIZE_CONTACTS` para 500.
- **`GET /imports/:jobId` latency > 500ms:** verificar índice em
  `enterprise_import_jobs(id)` (já é PK; deve ser instantâneo). Se a job estiver
  com `progress` jsonb gigante, considerar reduzir granularidade.
- **`ENTERPRISE_IMPORT_ENCRYPTION_KEY` perdida:** documentar como cred crítica
  em `docs/operations/secrets.md`. Em caso de perda, jobs pendentes ficam
  invalidados — `resume` exige nova `apiKey`.

## Notas pós-execução

Documentar no PR os números observados (tempo, RAM peak, latency p95) e tickar
AC13. Se algum critério falhar, abrir EVO ticket-filho de otimização.
