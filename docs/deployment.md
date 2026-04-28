# Deployment

Operational notes for running BMS Open Source in production / self-hosted setups. Companion to `getting-started.md` (which covers first-time local bring-up). This doc focuses on what changes between dev and prod, plus pipelines that need ongoing care.

## Pipeline de eventos analytics

Como webhooks de provedores (SendGrid, Twilio, push, custom, internal) viram linhas em `BMS.events_logs_v2` no ClickHouse — e o que olhar quando algo travar.

### Topologia

```
┌─────────────────────────────┐
│ webhook do provedor         │
│ (SendGrid / Twilio / push / │
│  custom / internal)         │
└──────────────┬──────────────┘
               │ HTTP POST /<platform>
               ▼
┌─────────────────────────────┐
│ event-process (NestJS)      │
│ - normaliza payload         │
│ - BotDetector classify      │
│ - stamp time_date           │
│ - JSON.stringify properties │
└──────────────┬──────────────┘
               │ AmqpPublisher.publish
               │ exchange = bms.analytics (topic, durable)
               │ routing_key = event.enriched
               ▼
┌─────────────────────────────┐
│ RabbitMQ                    │
│ exchange bms.analytics      │
│ → bridge bms.analytics_BMS_ │
│   events_queue_bridge       │
│ → queue BMS_events_queue    │
└──────────────┬──────────────┘
               │ ENGINE = RabbitMQ (CH consome direto, sem app)
               ▼
┌─────────────────────────────┐
│ BMS.events_queue            │
│ (virtual, JSONEachRow)      │
└──────────────┬──────────────┘
               │ MV mv_events_to_logs (TO ...)
               ▼
┌─────────────────────────────┐
│ BMS.events_logs_v2          │
│ MergeTree, TTL 180d         │
└──────────────┬──────────────┘
               │ MV mv_email_hourly (cascata automática)
               ▼
┌─────────────────────────────┐
│ BMS.tb_email_hourly_stats   │
│ SummingMergeTree            │
└─────────────────────────────┘
```

A cascata de MVs (`events_queue → mv_events_to_logs → events_logs_v2 → mv_email_hourly → tb_email_hourly_stats`) é nativa do ClickHouse 24.8 — não precisa setar `cascade_materialized_views=1` explicitamente.

**Não há app consumer.** O ClickHouse é o consumidor AMQP; a única "código de aplicação" do lado de leitura é a DDL em `infra/clickhouse-init/02-events-rabbitmq.sh`. Substitui o consumer Kafka→CH antes mantido fora do open source.

### Configuração

**Mounts obrigatórios no serviço `clickhouse`** (ver `docker-compose.yml`). Omitir qualquer um quebra o boot do CH 24.8 ou da pipeline analytics:

| Mount                                                              | Para quê                                                                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clickhouse-data:/var/lib/clickhouse`                              | Dados persistentes                                                                                                                                      |
| `./infra/clickhouse-init:/docker-entrypoint-initdb.d`              | DDL inicial (`01-init-bms.sql` cria `events_logs_v2` + MVs; `02-events-rabbitmq.sh` declara `events_queue` ENGINE=RabbitMQ + `mv_events_to_logs`)       |
| `./infra/clickhouse-config/users.d:/etc/clickhouse-server/users.d` | Habilita `allow_experimental_json_type` (necessário no 24.8 para a coluna `properties JSON` — sem isso o entrypoint falha com "experimental JSON type") |

Variáveis relevantes:

| Onde            | Variável             | Default                              | Observação                                                                   |
| --------------- | -------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `event-process` | `AMQP_URL`           | `amqp://guest:guest@localhost:5672`  | Producer publish endpoint. Em compose use `amqp://guest:guest@rabbitmq:5672` |
| `clickhouse`    | `RABBITMQ_HOST_PORT` | `rabbitmq:5672`                      | Onde a engine RabbitMQ do CH conecta                                         |
| `clickhouse`    | `RABBITMQ_USER`      | `guest` (`${RABBITMQ_DEFAULT_USER}`) | Substituído pelo `02-events-rabbitmq.sh` no primeiro init                    |
| `clickhouse`    | `RABBITMQ_PASSWORD`  | `guest` (`${RABBITMQ_DEFAULT_PASS}`) | Idem                                                                         |

**Mudou as creds do RabbitMQ depois do primeiro `docker compose up`?** A DDL já foi gravada com os valores antigos. Recriar `events_queue`:

```sh
docker compose exec clickhouse clickhouse-client \
  --query "DROP TABLE BMS.events_queue; DROP VIEW BMS.mv_events_to_logs"
docker compose exec clickhouse sh /docker-entrypoint-initdb.d/02-events-rabbitmq.sh
```

### Inspeção operacional

```sh
# 1. Há mensagens enfileiradas (não consumidas pelo CH)?
docker compose exec rabbitmq rabbitmqctl list_queues | grep BMS_events_queue

# 2. Engine do CH está consumindo?
docker compose exec clickhouse clickhouse-client --query \
  "SELECT count() FROM system.text_log WHERE logger_name = 'StorageRabbitMQ (events_queue)' AND event_time > now() - INTERVAL 1 MINUTE"

# 3. Última linha de fato escrita em events_logs_v2
docker compose exec clickhouse clickhouse-client --query \
  "SELECT max(time), count() FROM BMS.events_logs_v2 WHERE time > now() - INTERVAL 5 MINUTE"

# 4. Erros de parsing (mensagem rejeitada pelo CH)
docker compose exec clickhouse clickhouse-client --query \
  "SELECT event_time, message FROM system.text_log WHERE level = 'Error' AND message LIKE '%events_queue%' ORDER BY event_time DESC LIMIT 10"
```

### Erros comuns

**Sintoma: `events_queue` engine consome mas nada aparece em `events_logs_v2`**

Causa #1 — TTL: `events_logs_v2 TTL time_date + toIntervalDay(180)`. Se o `timestamp` do payload for > 180 dias atrás, a linha é inserida e dropada antes de aparecer. Verifique com `system.part_log` (mostra `NewPart` mesmo quando a linha já foi TTL-dropada).

Causa #2 — formato de DateTime64: o producer **deve** enviar `time` e `value_time` no shape `'YYYY-MM-DD HH:MM:SS.sss'` (espaço, sem `T`/`Z`). `JSON.stringify(new Date())` produz ISO com `Z` que o JSONEachRow rejeita silenciosamente após a primeira tentativa, ficando em estado "consumindo e descartando" até restart do CH (`docker compose restart clickhouse`). O code path em `event-process` já normaliza via `toClickhouseDateTime`.

**Sintoma: `Failed to push to views ... Cannot parse input: expected '"' before: 'Z'`** no `system.text_log`

Engine entrou no modo "consume + drop". Reinicie o serviço: `docker compose restart clickhouse`. Depois corrija o producer (o erro indica que algo está enviando `Date` cru sem reformatar).

### DLQ e reprocessamento

A queue `BMS_events_queue` é gerenciada pelo CH e **não tem DLQ explícita**: mensagens que falharem o parse JSON são descartadas. O `@bms/messaging` (do producer) declara a exchange durable, mas a queue do consumer (CH) é declarada pela engine RabbitMQ do CH e segue suas próprias políticas — não usa o `bms.dlx` que outros fluxos usam.

Para inspecionar uma mensagem in-flight (sem ack):

```sh
docker compose exec clickhouse clickhouse-client --query "DETACH TABLE BMS.events_queue"
# publique de novo a partir do upstream
docker compose exec rabbitmq rabbitmqadmin get \
  queue=BMS_events_queue ackmode=ack_requeue_true count=1
docker compose exec clickhouse clickhouse-client --query "ATTACH TABLE BMS.events_queue"
```

Para reprocessar manualmente uma mensagem perdida (DLQ artesanal):

```sh
docker compose exec rabbitmq rabbitmqadmin publish \
  exchange=bms.analytics routing_key=event.enriched \
  payload="<JSON do evento original>"
```

### Sizing recomendado de RabbitMQ

| Volume típico (eventos/dia) | RabbitMQ                                               | ClickHouse                  | Observação                     |
| --------------------------- | ------------------------------------------------------ | --------------------------- | ------------------------------ |
| < 1M                        | container default (1 vCPU, 1 GB RAM)                   | 2 vCPU, 4 GB RAM            | Volumes de demo / piloto       |
| 1M–10M                      | 2 vCPU, 2 GB RAM                                       | 4 vCPU, 8 GB RAM, SSD       | Self-hoster típico             |
| 10M–50M                     | 4 vCPU, 4 GB RAM, disco persistente em volume separado | 8 vCPU, 16 GB RAM, SSD NVMe | Limite confortável do OSS      |
| > 50M                       | **considere migrar para Kafka (Enterprise)**           | —                           | Ver "OSS vs Enterprise" abaixo |

`rabbitmq_num_consumers = 1` no DDL atual. Para volumes > 10M/dia, subir para 2–4 ajuda — editar `infra/clickhouse-init/02-events-rabbitmq.sh` e recriar `events_queue`.

### OSS vs. Enterprise — performance é diferencial intencional

O teto de throughput do RabbitMQ + ClickHouse RabbitMQ Engine é **mais baixo que Kafka**. Isso é proposital: a versão Enterprise da BMS mantém Kafka exatamente para escalas onde o RabbitMQ não atende. O OSS atende self-hoster com volumes baixos/médios e ganha em **operabilidade** (um broker a menos, deploy mais leve).

Sintomas de quem cresceu além do teto OSS:

- Lag persistente em `BMS_events_queue` (>10k mensagens enfileiradas em janelas de pico)
- CH com `<Warning> RabbitMQ flush_interval_ms` no log
- `tb_email_hourly_stats` ficando 5+ minutos atrasada vs. dashboards baseados em `events_logs_v2` direto

Quem chegar nesse ponto: avaliar Enterprise ou migrar para Kafka self-hosted (não suportado aqui).

Decisão arquitetural completa: `_evo-output/planning-artifacts/evo-1013-event-delivery-flow-analysis.md`.
