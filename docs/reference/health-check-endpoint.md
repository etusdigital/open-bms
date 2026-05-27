# Health Check Endpoint — Guia de Testes

Endpoint para verificar conectividade com os 6 serviços de infraestrutura do BMS antes de concluir o wizard de configuração.

## Endpoint

```
GET /setup/health-check
```

**Auth:** Público durante o setup (antes de `configured: true`).

---

## Resposta esperada

```json
{
  "postgres": { "ok": true, "latencyMs": 3 },
  "redis": { "ok": true, "latencyMs": 1 },
  "clickhouse": { "ok": true, "latencyMs": 12 },
  "rabbitmq": { "ok": true, "latencyMs": 8 },
  "s3": { "ok": true, "latencyMs": 45 },
  "smtp": { "ok": true, "latencyMs": 210 },
  "allOk": true
}
```

Quando um serviço falha:

```json
{
  "postgres": { "ok": true, "latencyMs": 3 },
  "redis": { "ok": false, "latencyMs": 5001, "error": "timeout" },
  "clickhouse": { "ok": true, "latencyMs": 12 },
  "rabbitmq": { "ok": false, "latencyMs": 5001, "error": "timeout" },
  "s3": { "ok": true, "latencyMs": 45 },
  "smtp": { "ok": false, "latencyMs": 0, "error": "SMTP not configured" },
  "allOk": false
}
```

---

## Testando com curl

Substitua `BASE_URL` pelo endereço da API (ex: `http://localhost:3000`).

### Verificação básica

```bash
curl -s http://localhost:3000/setup/health-check | jq .
```

### Checar se todos os serviços estão OK

```bash
curl -s http://localhost:3000/setup/health-check \
  | jq '.allOk'
```

Retorna `true` ou `false`.

### Ver apenas os serviços com falha

```bash
curl -s http://localhost:3000/setup/health-check \
  | jq '[to_entries[] | select(.value.ok == false and .key != "allOk") | {service: .key, error: .value.error, latencyMs: .value.latencyMs}]'
```

### Checar latência de cada serviço

```bash
curl -s http://localhost:3000/setup/health-check \
  | jq '{postgres: .postgres.latencyMs, redis: .redis.latencyMs, clickhouse: .clickhouse.latencyMs, rabbitmq: .rabbitmq.latencyMs, s3: .s3.latencyMs, smtp: .smtp.latencyMs}'
```

---

## Testando com HTTPie

```bash
http GET http://localhost:3000/setup/health-check
```

### Apenas serviços com falha

```bash
http GET http://localhost:3000/setup/health-check \
  | jq '[to_entries[] | select(.value.ok == false and .key != "allOk")]'
```

---

## Interpretando o resultado

| Campo        | `ok: true`                          | `ok: false`                                        |
| ------------ | ----------------------------------- | -------------------------------------------------- |
| `postgres`   | SELECT 1 respondeu                  | Banco inacessível ou credenciais incorretas        |
| `redis`      | PING respondeu                      | Redis inacessível ou senha incorreta               |
| `clickhouse` | SELECT 1 respondeu                  | ClickHouse inacessível                             |
| `rabbitmq`   | Conexão AMQP estabelecida e fechada | Broker inacessível ou URL incorreta                |
| `s3`         | HeadBucket respondeu com 200        | MinIO/S3 inacessível ou credenciais incorretas     |
| `smtp`       | `verify()` passou                   | Relay inacessível ou `smtp_settings` ausente no DB |

### `latencyMs` próximo de 5000

Indica timeout — o serviço não respondeu dentro de 5 segundos. Verifique se o serviço está rodando e se o endereço/porta está correto nas variáveis de ambiente.

### `error: "SMTP not configured"`

O step 2 do wizard (configuração SMTP) ainda não foi concluído. Volte ao step 2 e salve as credenciais SMTP.

---

## Variáveis de ambiente relevantes

| Variável               | Serviço    | Exemplo                          |
| ---------------------- | ---------- | -------------------------------- |
| `DATABASE_URL`         | PostgreSQL | `postgresql://user:pass@host/db` |
| `REDIS_HOST`           | Redis      | `localhost`                      |
| `REDIS_PORT`           | Redis      | `6379`                           |
| `REDIS_PASSWORD`       | Redis      | _(vazio para dev local)_         |
| `CLICKHOUSE_URL`       | ClickHouse | `http://localhost:8123`          |
| `AMQP_URL`             | RabbitMQ   | `amqp://guest:guest@localhost`   |
| `S3_ENDPOINT`          | S3 / MinIO | `http://localhost:9000`          |
| `S3_ACCESS_KEY_ID`     | S3 / MinIO | `minioadmin`                     |
| `S3_SECRET_ACCESS_KEY` | S3 / MinIO | `minioadmin`                     |
| `S3_BUCKET`            | S3 / MinIO | `bms-assets`                     |

> **SMTP** — as credenciais SMTP não vêm de variáveis de ambiente. Elas são salvas no banco (`system_config.smtp_settings`) durante o step 2 do wizard.

---

## Script de smoke test completo

Útil para CI ou validação pós-deploy:

```bash
#!/bin/bash
BASE_URL="${1:-http://localhost:3000}"

echo "Verificando health check em $BASE_URL ..."

RESPONSE=$(curl -sf "$BASE_URL/setup/health-check")
if [ $? -ne 0 ]; then
  echo "ERRO: endpoint inacessível"
  exit 1
fi

ALL_OK=$(echo "$RESPONSE" | jq '.allOk')

if [ "$ALL_OK" = "true" ]; then
  echo "OK — todos os serviços responderam"
  exit 0
else
  echo "FALHA — serviços com problema:"
  echo "$RESPONSE" | jq '[to_entries[] | select(.value.ok == false and .key != "allOk") | {service: .key, error: .value.error}]'
  exit 1
fi
```

Uso:

```bash
chmod +x scripts/smoke-health-check.sh
./scripts/smoke-health-check.sh http://localhost:3000
```
