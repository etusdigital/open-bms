# EVO-1013 — Análise total do fluxo de entrega de eventos para ClickHouse

**Autor:** Winston (Architect)
**Data:** 2026-04-28
**Status:** ✅ **Decisão tomada** (2026-04-28) — ver Seção 11.
**Card Linear:** [EVO-1013](https://linear.app/evoai/issue/EVO-1013/substituir-kafka-por-amqp-clickhouse-rabbitmq-engine-no-v010) — *Substituir Kafka por AMQP + ClickHouse RabbitMQ Engine no v0.1.0*
**Escopo do doc:** mapear o fluxo completo, listar dependentes, expor lacunas do planejamento, **registrar a decisão tomada com justificativa**.

> ## 🎯 TL;DR
>
> **Substituir Kafka por RabbitMQ em todo o sistema.** O `event-process` deixa de publicar no Kafka e passa a publicar no RabbitMQ (exchange `bms.analytics`, routing key `event.enriched`). O **ClickHouse consome diretamente do RabbitMQ via `ENGINE = RabbitMQ` + Materialized View** — não há novo app consumer.
>
> **Razão estratégica:** o teto de performance mais baixo do RabbitMQ + CH RabbitMQ Engine vs. Kafka é **desejável** no open source — é parte do diferencial entre v0.1.0 (OSS) e a versão Enterprise (que mantém Kafka para escala alta).

---

## 🚧 Índice de bloqueadores (para o PM)

Bloqueadores **pré-existentes ao trabalho da EVO-1013** descobertos enquanto a implementação avança. Cada um precisa de decisão do PM (escopo: inline neste PR vs. card separado) e ratificação da opção técnica.

| # | Bloqueador | Detalhe | Status | Decisão pendente |
|---|---|---|---|---|
| **B1** | `properties JSON` exige `allow_experimental_json_type` no CH 24.8 | §13 | ✅ **Resolvido** — Opção A ratificada, commit `25cf77d` | — |
| **B2** | TTL `time + toIntervalDay(180)` rejeitado em DateTime64 no CH 24.8 | §13.8 | ✅ **Resolvido** — Opção α ratificada, mesmo commit `25cf77d` | — |
| **B3** | `pnpm install` no root falha por `@retention/test-config` ausente em `apps/frontend-react` | §15 | ❎ **Mal-classificado** (2026-04-28) — não é bloqueador da EVO-1013. Mitigação: `pnpm --filter events-process... install`. Fix do frontend-react vira followup próprio. | — |

**Como ler:** seções com numeração `13.x` e acima detalham cada bloqueador — sintoma, causa, opções de fix, recomendação, decisão tomada (se houver). PM pode bater olho neste índice e ir direto para a seção do bloqueador aberto. Implementação fica parada no item 🔴 mais alto.

---

## 1. Topologia atual (em produção)

```
┌────────────────┐       ┌──────────────┐       ┌──────────────────────┐
│ tracker /      │  AMQP │ event-       │ Kafka │ <consumer externo,   │
│ event-receiver │─────▶│ process      │──────▶│ FORA do repo open-   │
│ / outros       │       │ (enriquece)  │       │ source>              │
└────────────────┘       └──────────────┘       └──────────┬───────────┘
                                                            │ INSERT
                                                            ▼
                              ┌─────────────────────────────────────────┐
                              │ ClickHouse — BMS.events_logs_v2         │
                              │ 180d TTL, partition by account+month    │
                              └────────────┬────────────────────────────┘
                                           │ trigger automático
                                           ▼
                              ┌─────────────────────────────────────────┐
                              │ MV mv_email_hourly →                    │
                              │ tb_email_hourly_stats (SummingMergeTree)│
                              └─────────────────────────────────────────┘
```

Kafka entra **exclusivamente** entre o fim do enriquecimento em `event-process` e a inserção no ClickHouse. **Não é usado em nenhum outro fluxo do monorepo.**

---

## 2. O que `event-process` produz para o Kafka

### 2.1 Call-sites (5)

| Arquivo | Linha | Origem do evento |
|---|---|---|
| `apps/event-process/src/events/services/sendgrid.service.ts` | 352 | Webhooks SendGrid |
| `apps/event-process/src/events/services/twilio.service.ts` | 140 | Webhooks Twilio |
| `apps/event-process/src/events/services/push.service.ts` | 168 | Webhooks Web/Mobile push |
| `apps/event-process/src/events/services/internal-events.service.ts` | 172 | Eventos internos (page_view, click reprocessado) |
| `apps/event-process/src/events/services/custom-events.service.ts` | 159 | Custom events (API pública) |

Todas chamam `this.sendKafkaMessage(events)` em `events.service.ts:492-499`.

### 2.2 Padrão de envio

```ts
// events.service.ts:492-499
protected async sendKafkaMessage(events) {
  await Promise.all(
    events.map(async (message) => {
      const kafkaMessage = this.processMessageToKafka(message);
      await EventsService.kafkaProvider.sendAsyncMessage(kafkaMessage, process.env.KAFKA_EVENTS_TOPIC);
    }),
  );
}
```

- **Uma mensagem Kafka por evento** (sem batching no producer).
- Topic único: `msgops-events` (definido em `KAFKA_EVENTS_TOPIC`).
- `Promise.all` paralelo — sem ordering garantida entre eventos do mesmo lote.

### 2.3 O que `processMessageToKafka` faz (não é só renomeação)

Em `events.service.ts:501-549`:

1. Roda `BotDetector.classify(traits, userAgent)` — gera 6 sinais derivados.
2. Renomeia camelCase → snake_case (~15 campos): `accountId` → `account_id`, `messageId` → `message_id`, etc.
3. Gera `event_log_id` UUID novo (chave de linha do ClickHouse).
4. **Strip do campo `traits`** — comentário explícito no código: *"downstream (Kafka → ClickHouse events_logs_v2) has no traits column"*.
5. Stampa 6 campos derivados em `properties` JSON: `is_bot`, `is_datacenter`, `bot_classification`, `asn`, `asn_org`, `user_type`.

**Implicação arquitetural:** o "schema da mensagem Kafka" é literalmente o **schema da linha no ClickHouse**. Não é payload de domínio — é INSERT em trânsito. O bot classification é producer-side (decisão de design feita no `event-process`, não no consumer).

### 2.4 Comportamento em dev/staging

`apps/event-process/src/providers/kafka.provider.ts:30-33`:

```ts
async sendAsyncMessage(message: any, topic) {
  if (process.env.NODE_ENV !== 'production') {
    return new Promise((resolve) => resolve(crypto.randomBytes(20).toString('hex')));
  }
  ...
}
```

Em qualquer ambiente que não seja `production`, **a mensagem nunca sai**. Devolve hash fake.

**Consequência:** dev/staging hoje **não populam `events_logs_v2`**. Qualquer self-hoster rodando `docker compose up` vai ter as 5 features que leem dessa tabela (Seção 4) retornando vazio. Esse é um problema **independente** da decisão da EVO-1013 — mas precisa ser resolvido junto.

### 2.5 Configuração do Kafka

| Variável | Valor / origem |
|---|---|
| `KAFKA_BROKERS` | `localhost:9093` no `.env.example` (real é managed Kafka) |
| `KAFKA_USERNAME` / `KAFKA_PASSWORD` | SASL credentials |
| `KAFKA_EVENTS_TOPIC` | `msgops-events` |
| Auth | SASL SCRAM-SHA-512, **sem SSL** |
| Lib | `kafkajs ^2.2.4` (única dep Kafka do monorepo) |

**Dedução:** SCRAM-512 + user/pass = **Kafka gerenciado** (Aiven / Confluent Cloud / equivalente). Por isso nunca foi adicionado ao `docker-compose.yml` — não foi pensado para rodar local.

---

## 3. O componente que falta no open source

**O consumer que lê o tópico `msgops-events` e faz INSERT em `events_logs_v2` NÃO está neste repositório.**

Verificações feitas:

- `grep -rln "kafkajs\|KafkaProvider"` no monorepo → único app que usa `kafkajs` é `event-process` (producer).
- `grep -rln "@clickhouse/client"` nas pastas `apps/` → 4 providers, **todos usam apenas `runQuery`** (SELECT). Nenhum INSERT em `events_logs_v2` ou tabela equivalente.
- `client.insert` não aparece em nenhum arquivo `.ts` fora de `node_modules/dist`.

O writer Kafka→CH vive na infra cloud da Brius. **Qualquer caminho escolhido na EVO-1013 — inclusive "manter Kafka" — exige reproduzir esse componente no open source.**

> **Corrigenda (2026-04-28):** a redação original dizia "escrever esse componente do zero". Está errado. **ClickHouse 24.8 oferece `ENGINE = Kafka` e `ENGINE = RabbitMQ` nativos**, que consomem do broker e gravam em tabela MergeTree via Materialized View — **sem código de aplicação**. O componente vira uma migration SQL no `infra/clickhouse-init/`, não um app. Isso afeta a economia das opções E/G na Seção 9 e foi o que destravou a decisão da Seção 11.

---

## 4. Quem **lê** `events_logs_v2` (mapeamento exaustivo)

Esta seção é a que o card EVO-1013 não captura. Sem dados em `events_logs_v2`, **estes pontos quebram silenciosamente:**

| App / Módulo | Arquivo | Linhas | Para quê usa |
|---|---|---|---|
| `msgops-api` IP reputation | `modules/ip-reputation/ip-reputation.service.ts` | 117, 137, 153 | Cálculo de reputação por IP via histórico de eventos |
| `msgops-api` segmentação por evento | `modules/tags/tags.service.ts` | 389, 428, 445, 526 | Tags por comportamento (page_view, click, etc) |
| `msgops-api` query builder | `modules/tags/builder/query-builder.provider.ts` | 68, 197 | Builder de segmentos baseado em eventos |
| `msgops-api` statistics | `modules/statistics/statistics.service.ts` | 755 | Stats diárias open/click |
| `tag-process` automation | `handlers/automation.handler.ts` | 500 | Trigger de automação por evento |
| `message-trigger` | `app.service.ts` | 545 | Critério de elegibilidade em triggers de mensagem |
| `mv_email_hourly` (CH) | `infra/clickhouse-init/01-init-bms.sql` | 69-87 | **Auto-agrega** events_logs_v2 → tb_email_hourly_stats em tempo real |
| `backfill-hourly-stats` | `scripts/backfill-hourly-stats.ts` | (script) | Reprocessa histórico se MV falhar |

**Conclusão da Seção 4:** `events_logs_v2` é **fonte de verdade para 5 apps + 1 materialized view automática**. Não é "tabela de log para um dashboard". Cortar fonte mata IP reputation, segmentação por comportamento, automation triggers, message triggers, hourly stats — não apenas o dashboard "eventos por hora".

---

## 5. O que ClickHouse **já tem** no open source

Confirmado lendo o repo na branch atual:

- ✅ Serviço no `docker-compose.yml`: `clickhouse/clickhouse-server:24.8-alpine`
- ✅ Schema inicial em `infra/clickhouse-init/01-init-bms.sql`:
  - `BMS.events_logs_v2` (32 colunas; `MergeTree`; partition `(account_id, toYYYYMM(time_date))`; ORDER BY `(account_id, message_type, time_date, event)`; TTL 180 dias)
  - `BMS.tb_email_hourly_stats` (`SummingMergeTree`)
  - `BMS.mv_email_hourly` (Materialized View que alimenta `tb_email_hourly_stats` automaticamente)
- ✅ Migrations versionadas em `migrations/clickhouse/`: `001_create_hourly_stats_table.sql`, `004_create_hourly_stats_mv.sql`
- ✅ Cliente oficial `@clickhouse/client` em uso por **4 apps**: `msgops-api`, `tag-process`, `message-trigger`, scripts
- ✅ Env vars padronizadas: `CLICKHOUSE_HOST/USERNAME/PASSWORD/DATABASE` em todos os apps
- ✅ Compose já configura: `CLICKHOUSE_HOST=http://clickhouse:8123`, `DATABASE=BMS`, user `default`, password vazia

**O que NÃO existe:**

- ❌ Nenhum **writer** para `events_logs_v2` no open source
- ❌ Nenhum consumer/sink AMQP/Kafka → CH
- ❌ Nenhum doc no `_evo-output/` planejando esse caminho (até este documento)

---

## 6. Propriedades técnicas do Kafka **efetivamente** usadas neste fluxo

| Propriedade | Usada hoje? | Evidência no código |
|---|---|---|
| Persistência durante outage do CH | **Sim** | Única razão arquitetural concreta para existir um broker entre os dois |
| Replay / re-leitura de offsets | Não evidente | Topic único, nenhum consumer group documentado, `traits` é dropado (perda de informação faz replay parcial) |
| Fan-out multi-consumer | Não | Único consumidor (writer externo) |
| Ordenação por partition key | Não exigido | INSERT em CH é commutativo na granularidade da MV |
| Batching no producer | **Não** | `Promise.all` row-by-row em `sendKafkaMessage` |
| Batching no consumer | Provavelmente sim (não verificável neste repo) | Padrão Kafka→CH; CH penaliza INSERTs pequenos |
| Schema evolution | Manual | `processMessageToKafka` é o "schema" implícito |
| Idempotência | **Não** (Kafka não cuida) | Idempotência é feita upstream em `processWithIdempotency(messageId, ...)` no controller |

**Resumo da Seção 6:** A única propriedade que Kafka entrega **comprovadamente** neste fluxo é **buffer entre producer e CH em caso de outage do CH**. Todas as outras são teóricas ou explicitamente não aproveitadas.

---

## 7. Lacunas que o planejamento inicial não capturou

1. **Consumer está fora do repo.** Decidir "manter Kafka" não economiza trabalho — exige escrever consumer mesmo assim.
2. **5 readers + 1 MV dependem de `events_logs_v2`.** Cortar analytics não é só "cortar dashboard" — quebra IP reputation, segmentação, automation triggers, message triggers, hourly stats.
3. **Dev/staging hoje não populam CH.** O stub do `KafkaProvider` significa que nenhum self-hoster vai ver dados sem produção. Tem que resolver junto.
4. **Schema = código privado, não contrato.** `processMessageToKafka` é método `private` de service. Qualquer divisão (event-process publica → outro app consome) precisa primeiro **extrair o DTO** para um lugar compartilhado (`@bms/messaging` ou `packages/`), ou vai gerar drift silencioso.
5. **`async_insert` do ClickHouse 24.8** suporta server-side batching nativo. Muda a economia da decisão "INSERT direto via HTTP" — não precisa reproduzir batching no app.
6. **`tb_email_hourly_stats` só é populada se houver insert em `events_logs_v2`.** A MV é triggered por insert. Sem insert → tabela vazia → qualquer dashboard que consulte ela mostra zero.
7. **Idempotência atual é por `messageId` no controller.** Se o caminho mudar, a idempotência precisa ser reavaliada **no novo writer** — Kafka não está cuidando disso hoje, mas o consumer externo provavelmente está, e não temos como verificar.
8. **Bot classification é producer-side.** Hoje roda em `processMessageToKafka`. Se o caminho mudar, decidir explicitamente: continua em event-process, ou move pro novo writer? Afeta acoplamento e testabilidade.

---

## 8. Perguntas abertas (a responder antes da ADR)

| # | Pergunta | Para que decisão pesa |
|---|---|---|
| Q1 | Volume real (eventos/dia médio e pico) na produção atual | Define se INSERT direto + `async_insert` é viável vs. queue obrigatória |
| Q2 | SLA de consistência (event-process → CH visível): real-time, segundos, minutos? | Define agressividade de batching aceitável |
| Q3 | `tb_email_hourly_stats` é consumida por quê hoje (qual dashboard / endpoint)? | Se ninguém lê, MV vira opcional |
| Q4 | Dashboard "eventos por hora" do Super Admin (Semana 4) lê de qual tabela? `events_logs_v2` direto ou `tb_email_hourly_stats`? | Define se MV é obrigatória ou nice-to-have |
| Q5 | IP reputation, segmentação, automation triggers, message triggers — são features anunciadas no v0.1.0? | Define se o caminho C (cortar analytics) é viável |
| Q6 | Existe doc da infra cloud descrevendo o consumer Kafka→CH atual (batching, retry, error handling)? | Acelera reproduzir no open source |
| Q7 | Bot classification deve continuar producer-side ou pode mover pro consumer? | Afeta acoplamento e onde fica `BotDetector` |

**Sem responder Q1, Q2, Q4, Q5 minimamente, qualquer decisão da EVO-1013 é chute.**

---

## 9. Espaço de soluções (mapeado)

| ID | Caminho | Preserva `events_logs_v2`? | Buffer durante outage do CH? | Complexidade nova | Componentes novos |
|---|---|---|---|---|---|
| **A** | Consumer AMQP dedicado (`events-to-clickhouse`) | ✅ | ✅ (queue absorve) | Média | 1 app novo + 1 queue + DTO compartilhado |
| **B** | INSERT direto via HTTP + `async_insert=1` | ✅ | ❌ (CH down → event-process degrada) | Baixa | só código novo no event-process |
| **B'** | INSERT direto + retry queue local (Redis/AMQP) | ✅ | Parcial (depende do retry) | Média-Baixa | infra de retry no event-process |
| **C** | Cortar analytics do v0.1.0 | ❌ | n/a | Zero — mas **quebra 5 readers** (Seção 4) | nenhum (mas requer feature flags / fallbacks) |
| **D** | Manter Kafka self-hosted | ✅ | ✅ | **Alta** (ops Kafka self-hosted) | Kafka + KRaft no compose + DDL CH |
| **E** | ClickHouse Kafka Engine + Kafka self-hosted | ✅ | ✅ | Média-Alta (Kafka ops) | Kafka no compose + DDL CH (sem app) |
| **F** | Polling Postgres → CH (event-process grava em PG, batch job copia) | ✅ | ✅ (via PG) | Média | tabela staging + scheduler |
| **G** ✅ | **AMQP + ClickHouse `ENGINE = RabbitMQ` + MV** | ✅ | ✅ (queue absorve) | **Baixa** | DDL CH + troca producer no event-process. Zero app novo, zero broker novo. |

**Decisão tomada: Caminho G.** Detalhes na Seção 11.

---

## 10. Histórico das perguntas abertas

Algumas das perguntas da Seção 8 deixaram de ser bloqueantes com a decisão da Seção 11. Estado:

| # | Pergunta | Estado pós-decisão |
|---|---|---|
| Q1 | Volume real (eventos/dia) | **Não-bloqueante.** A decisão aceita explicitamente teto de performance menor. Volume continua relevante para sizing do RabbitMQ no `deployment.md`. |
| Q2 | SLA de consistência | **Não-bloqueante.** Engine RabbitMQ + MV opera em near-real-time (segundos). Aceitável para v0.1.0. |
| Q3 | Quem lê `tb_email_hourly_stats`? | **Aberta** — ainda vale grepar. Não bloqueia G. |
| Q4 | Dashboard "eventos por hora" lê de qual tabela? | **Aberta** — afeta apenas o card do dashboard, não o transporte. |
| Q5 | IP reputation, segmentação etc. são features anunciadas? | **Resolvida implicitamente** — caminho G preserva todas. |
| Q6 | Doc da infra cloud do consumer atual | **Não-bloqueante** — não vamos reproduzir o consumer; CH consome direto. |
| Q7 | Bot classification: producer ou consumer-side? | **Resolvida**: continua producer-side (no `event-process`, antes do publish AMQP). Sem refactor. |

---

## 11. Decisão tomada (2026-04-28)

### 11.1 Decisão

**Substituir Kafka por RabbitMQ em todo o sistema** no v0.1.0 open source. O `event-process` deixa de publicar no Kafka e passa a publicar no RabbitMQ. O **ClickHouse consome diretamente do RabbitMQ via `ENGINE = RabbitMQ` + Materialized View** — sem nenhum app consumer novo.

### 11.2 Topologia alvo

```
┌────────────────┐  AMQP   ┌──────────────┐  AMQP publish     ┌──────────────┐
│ tracker /      │────────▶│ event-       │──────────────────▶│ RabbitMQ     │
│ event-receiver │         │ process      │  bms.analytics    │ exchange     │
│ / outros       │         │ (enriquece + │  event.enriched   │              │
└────────────────┘         │  bot detect) │                   └──────┬───────┘
                           └──────────────┘                          │
                                                                     │ ENGINE=RabbitMQ
                                                                     ▼
                                              ┌─────────────────────────────────────┐
                                              │ ClickHouse: events_queue            │
                                              │ ENGINE = RabbitMQ                   │
                                              │ format = JSONEachRow                │
                                              └────────────┬────────────────────────┘
                                                           │ MATERIALIZED VIEW
                                                           ▼
                                              ┌─────────────────────────────────────┐
                                              │ events_logs_v2 (MergeTree)          │
                                              └────────────┬────────────────────────┘
                                                           │ MV mv_email_hourly
                                                           ▼
                                              ┌─────────────────────────────────────┐
                                              │ tb_email_hourly_stats               │
                                              └─────────────────────────────────────┘
```

### 11.3 Justificativa estratégica

> **Performance menor é desejável no open source.** O teto de throughput do RabbitMQ + ClickHouse RabbitMQ Engine — comprovadamente menor que Kafka em alta escala — **é parte do diferencial entre a versão OSS (v0.1.0) e a versão Enterprise**. A versão Enterprise pode (e deve) manter Kafka para escalas onde o RabbitMQ não atende. O OSS atende o ICP de self-hoster com volumes baixos/médios e ganha em **operabilidade**: um broker a menos, infra mais simples, deploy mais leve.

Esta é uma decisão **de produto**, não apenas técnica. O custo de oferecer alta performance no OSS desalinha o produto com a estratégia comercial.

### 11.4 Justificativa técnica

| Critério | Avaliação |
|---|---|
| **Reusa stack existente** | RabbitMQ já está no `docker-compose.yml`. ClickHouse já está. Zero infra nova. |
| **Reusa código existente** | `@bms/messaging` (pronto pós-EVO-946) já cobre o publish AMQP. Producer só troca `kafkaProvider.send` por `eventPublisher.publish`. |
| **Zero app novo** | `ENGINE = RabbitMQ` no CH dispensa o consumer. É DDL, não código. |
| **Bot classification preservado** | Continua producer-side em `processMessageToKafka` (renomear para `processMessageToAnalytics`). Sem refactor de lógica. |
| **Buffer durante outage do CH** | Queue RabbitMQ absorve. Mesma propriedade que o Kafka entregava. |
| **Schema versionado** | DDL fica no `infra/clickhouse-init/02-events-rabbitmq.sql` — versionado em git, não em método privado. |
| **Dev/staging populam CH** | Resolve automaticamente o problema da Seção 2.4 (stub do Kafka em dev) — RabbitMQ + CH local funcionam por default. |

### 11.5 Trade-offs assumidos explicitamente

1. **Throughput máximo menor.** RabbitMQ Engine do CH é menos maduro e tem teto inferior ao Kafka Engine. **Aceito como diferencial OSS vs. Enterprise.**
2. **Replay limitado.** Sem replay de offsets como em Kafka. Se um INSERT em CH falha persistente, a mensagem vai para DLQ AMQP padrão e exige reprocessamento manual. Documentar no `deployment.md`.
3. **`bot_classification` permanece em `properties` JSON.** Sem refactor de schema agora. Pode virar coluna dedicada em release futura se justificado.
4. **Migração da versão Enterprise virá depois.** Enterprise continua em Kafka até que migração explícita seja planejada — não é escopo deste card.

### 11.6 Componentes que saem do v0.1.0

- ❌ `apps/event-process/src/providers/kafka.provider.ts` — deletar
- ❌ Dependência `kafkajs` em `apps/event-process/package.json` — remover
- ❌ Vars `KAFKA_BROKERS`, `KAFKA_USERNAME`, `KAFKA_PASSWORD`, `KAFKA_EVENTS_TOPIC` — remover do `.env.example` do event-process
- ❌ Stub `NODE_ENV !== 'production'` (Seção 2.4) — desnecessário, AMQP funciona local

### 11.7 Componentes que entram

- ✅ Novo serviço/wrapper de publish AMQP no `event-process` (consumindo `@bms/messaging` `EventPublisherService`).
- ✅ Nova exchange RabbitMQ: `bms.analytics` (topic) com routing key `event.enriched`.
- ✅ Nova migration ClickHouse: `infra/clickhouse-init/02-events-rabbitmq.sql` declarando `events_queue` (ENGINE=RabbitMQ) + MV → `events_logs_v2`.
- ✅ Vars novas no `.env.example` do event-process: nada (já tem `AMQP_URL`).
- ✅ Documentação operacional no `docs/deployment.md`: como redeclarar a queue se schema mudar, como ler a DLQ, como reprocessar manualmente.

---

## 12. AC consolidado para implementação

A EVO-1013 deixa de ser card de decisão e **vira o card de implementação** — sem split em cards filhos. Os componentes (producer, DDL, docs) são acoplados (não testáveis isoladamente) e cabem num único PR.

Branch já existente: `guilhermegomes/evo-1013-substituir-kafka-por-amqp-clickhouse-rabbitmq-engine-no-v010`.

### AC #1 — POC de validação da cadeia de MVs (30 min, primeiro passo)

**Por quê primeiro:** a topologia decidida cria duas MVs em série (`events_queue → MV → events_logs_v2 → mv_email_hourly → tb_email_hourly_stats`). ClickHouse cascateia MVs por padrão no 24.8 (`cascade_materialized_views=1`), mas a `mv_email_hourly` foi escrita assumindo INSERT direto. Validar antes de codar producer-side evita descobrir falha de cascata só no smoke test final.

**Passos:**

1. `docker compose up -d rabbitmq clickhouse`
2. Criar `events_queue` mínima (espelho de `events_logs_v2`) + MV `mv_events_to_logs` com DDL ad-hoc no CH
3. Publicar 1 mensagem AMQP manual:
   ```bash
   docker compose exec rabbitmq rabbitmqadmin publish \
     exchange=bms.analytics routing_key=event.enriched \
     payload='<JSON com 32 colunas, message_type=email, event=open, account_id=1>'
   ```
4. Verificar:
   ```bash
   docker compose exec clickhouse clickhouse-client \
     --query "SELECT count() FROM BMS.events_logs_v2 WHERE event_log_id LIKE 'poc-%'"
   # Esperado: 1
   docker compose exec clickhouse clickhouse-client \
     --query "SELECT opened FROM BMS.tb_email_hourly_stats WHERE account_id = 1"
   # Esperado: >= 1
   ```
5. Se ambos verdes → seguir para AC #2. Se cascata não disparar → ajustar abordagem (forçar `cascade_materialized_views=1` na MV nova ou refactor da MV antiga) **antes** de tocar producer-side.

### AC #2 — Producer trocado no `event-process`

- `KafkaProvider` deletado (`apps/event-process/src/providers/kafka.provider.ts`)
- Dep `kafkajs` removida de `apps/event-process/package.json` e `pnpm-lock.yaml`
- Vars `KAFKA_BROKERS`, `KAFKA_USERNAME`, `KAFKA_PASSWORD`, `KAFKA_EVENTS_TOPIC` removidas de `apps/event-process/.env.example` e `.env`
- `processMessageToKafka` renomeado para `processMessageToAnalytics` (semântica preservada — bot classification, snake_case rename, UUID gen, strip de `traits`)
- `sendKafkaMessage` substituído por `sendAnalyticsEvent` que publica via `EventPublisherService` do `@bms/messaging` em `bms.analytics/event.enriched`

**Comportamento que DEVE ser preservado** (regra "Substitutions preserve behavior"):
- `Promise.all` paralelo nos 5 call-sites (`sendgrid:352`, `twilio:140`, `push:168`, `internal-events:172`, `custom-events:159`) — sem mudar para sequencial
- Payload final no shape de linha do `events_logs_v2` (32 campos, `event_log_id` UUID gerado, `properties` com 6 campos do BotDetector)
- Idempotência upstream intacta — `processWithIdempotency(messageId, ...)` em `app.controller.ts` continua envolvendo todo o handler

### AC #3 — DDL ClickHouse aplicada

> **Desvio do AC original (registrado 2026-04-28):** o arquivo final é `02-events-rabbitmq.sh`, não `.sql`. Razão: as settings `rabbitmq_username`/`rabbitmq_password` precisam ser **interpoladas a partir de env vars** (`RABBITMQ_USER`/`RABBITMQ_PASSWORD` no compose) para que self-hosters que mudam `RABBITMQ_DEFAULT_USER`/`PASS` em `.env` peguem o override no primeiro init. O `docker-entrypoint-initdb.d` do CH executa `.sql` literalmente (sem expansão de shell) e `.sh` via bash. O script chama `clickhouse-client --multiquery` com a DDL embedded — fica funcionalmente equivalente a `.sql`, só ganha a substituição de variáveis.

Criar `infra/clickhouse-init/02-events-rabbitmq.sh` com:

- Tabela `events_queue` — `ENGINE = RabbitMQ`, espelho de schema de `events_logs_v2` (32 colunas), `format = JSONEachRow`, settings `rabbitmq_host_port`, `rabbitmq_exchange_name = 'bms.analytics'`, `rabbitmq_routing_key_list = 'event.enriched'`, `rabbitmq_format = 'JSONEachRow'`
- MV `mv_events_to_logs` — `TO BMS.events_logs_v2 AS SELECT * FROM events_queue`

Convenção de nome de queue interna do CH: segue padrão `@bms/messaging` da EVO-946 (não há decisão de nomenclatura nova).

### AC #4 — Smoke test E2E (com event-process rodando)

Após AC #2 + AC #3 mergeados:

1. `docker compose up -d rabbitmq clickhouse`
2. Subir `event-process` localmente (`pnpm --filter events-process dev` ou conforme runbook EVO-946)
3. Disparar webhook simulando provider — exemplo SendGrid:
   ```bash
   curl -X POST http://localhost:3000/sendgrid \
     -H "Content-Type: application/json" \
     -H "platform: sendgrid" \
     -d '[{"event":"open","sg_message_id":"test","email":"x@x.com","timestamp":1714300000}]'
   ```
4. Verificar em < 5s:
   ```bash
   docker compose exec clickhouse clickhouse-client \
     --query "SELECT count() FROM BMS.events_logs_v2 WHERE event = 'open' AND time >= now() - INTERVAL 1 MINUTE"
   # Esperado: >= 1
   ```

### AC #5 — Documentação operacional (`docs/deployment.md`)

Adicionar seção **"Pipeline de eventos analytics"** cobrindo:

- Topologia: producer (event-process) → exchange `bms.analytics` → CH `events_queue` (ENGINE=RabbitMQ) → MV → `events_logs_v2`
- DLQ: nome da queue de DLQ (segue convenção `@bms/messaging`), como inspecionar mensagens parked, como reprocessar manualmente (re-publish no exchange)
- Sizing recomendado de RabbitMQ por faixa de volume (alinhar com sizing de outros serviços já documentado no `deployment.md`)
- Limitação consciente: teto de throughput menor que Kafka — **feature do OSS**, não bug

### AC #6 — `plan-opensource.md` atualizado

Adicionar (ou criar) seção **"Decisões arquiteturais registradas"** com entrada:

```markdown
- **Transporte de eventos para ClickHouse (EVO-1013):** AMQP + ClickHouse `ENGINE = RabbitMQ` + Materialized View. Substitui Kafka. Razão: teto de performance menor é desejável no OSS como diferencial vs. Enterprise. Análise completa: `_evo-output/planning-artifacts/evo-1013-event-delivery-flow-analysis.md`.
```

---

**Posicionamento OSS vs. Enterprise** (perf como diferencial) — confirmar com Davidson para alinhar marketing/docs do release. Não bloqueia implementação.

---

## 13. Blocker descoberto durante AC #1 — ClickHouse não inicializa (JSON experimental)

**Descoberto:** 2026-04-28, na primeira tentativa de subir CH para o POC.
**Status:** ⛔ Bloqueia AC #1, #4 e qualquer validação local da EVO-1013.
**Decisão necessária:** PM (Davidson) — fix dentro da EVO-1013 ou card separado bloqueante.

### 13.1 Sintoma

`docker compose up -d clickhouse` → container sai com `Exit (44)` durante o entrypoint:

```
Code: 44. DB::Exception: Cannot create column with type 'JSON' because
experimental JSON type is not allowed. Set setting allow_experimental_json_type = 1
in order to allow it. (ILLEGAL_COLUMN)
```

A criação de `BMS.events_logs_v2` é abortada. Como o entrypoint falha, **nenhuma** das tabelas/MVs de `infra/clickhouse-init/01-init-bms.sql` chega a existir — `tb_email_hourly_stats`, `mv_email_hourly` também não.

### 13.2 Causa

`infra/clickhouse-init/01-init-bms.sql:35` declara `properties JSON`. No ClickHouse 24.8 (versão fixada no compose) o tipo `JSON` é experimental e exige `allow_experimental_json_type = 1`. O `docker-compose.yml` não fornece a flag em lugar nenhum.

### 13.3 Implicações

1. **Stack analytics nunca subiu em ambiente self-hosted.** Quem clonou o repo OSS e rodou `docker compose up` está em loop de falha do CH desde o pin da imagem 24.8. Passou despercebido porque produção usa infra cloud separada.
2. **Amplifica a Seção 2.4** ("dev/staging hoje não populam events_logs_v2"). A análise assumia que a tabela existia vazia. Não existe.
3. **Bloqueia EVO-1013 inteira:** AC #1 não consegue criar `events_queue` (alvo `events_logs_v2` inexiste); AC #2/3 podem ser codificados mas não validados; AC #4 impossível.
4. **Risco silencioso para v0.1.0 (2026-05-26):** sem fix, todo self-hoster que ligar o stack no dia do lançamento vai ter analytics quebrado por default.

### 13.4 Opções de fix

| Opção | O que faz | Custo | Risco |
|---|---|---|---|
| **A — server-side config** | Criar `infra/clickhouse-config/users.d/00-experimental.xml` com `<allow_experimental_json_type>1</allow_experimental_json_type>` no profile `default` + mount em `/etc/clickhouse-server/users.d/` no compose | 1 arquivo + 1 linha no compose | Baixo. Flag permanente para todas as conexões |
| **B — SET inline no SQL** | Prepender `SET allow_experimental_json_type = 1;` em `01-init-bms.sql` | 1 linha | **Não resolve runtime.** A flag só vale na sessão de init. Apps que conectarem depois falham em qualquer DDL/ALTER que envolva JSON |
| **C — trocar tipo da coluna** | `properties JSON` → `String` (JSON serializado) ou `Map(String, String)` | Schema change + refactor de readers | **Fora de escopo.** IP reputation, segmentação, statistics leem `properties.*` — risco de regressão real |
| **D — downgrade de imagem** | CH 23.x onde JSON era estável | Investigação + possíveis incompatibilidades 24.x | Médio-Alto |

**Recomendação:** Opção A. Custo trivial, escopo cirúrgico (config de infra, não toca schema nem lógica), zero risco de regressão, fix permanente.

### 13.5 Decisão tomada (2026-04-28)

- **Opção técnica:** A (config server-side via XML mount em `users.d`).
- **Processo:** **commit separado no mesmo PR da EVO-1013** — sem card Linear novo. A regra "Commit scope is literal" é sobre commits, não sobre cards; o histórico fica limpo via dois commits distintos no mesmo PR.

### 13.6 AC #0 — Pré-requisito antes de AC #1

Primeiro commit da branch `guilhermegomes/evo-1013-substituir-kafka-por-amqp-clickhouse-rabbitmq-engine-no-v010`, isolado do trabalho de Kafka→AMQP:

- [ ] Criar `infra/clickhouse-config/users.d/00-experimental.xml`:

  ```xml
  <clickhouse>
      <profiles>
          <default>
              <allow_experimental_json_type>1</allow_experimental_json_type>
          </default>
      </profiles>
  </clickhouse>
  ```

- [ ] Adicionar volume mount no `docker-compose.yml` serviço `clickhouse`:

  ```yaml
  volumes:
    - clickhouse-data:/var/lib/clickhouse
    - ./infra/clickhouse-init:/docker-entrypoint-initdb.d
    - ./infra/clickhouse-config/users.d:/etc/clickhouse-server/users.d   # nova linha
  ```

- [ ] Validar: `docker compose down -v && docker compose up -d clickhouse` sobe healthy
- [ ] Smoke: `docker compose exec clickhouse clickhouse-client --query "SHOW TABLES FROM BMS"` retorna `events_logs_v2`, `tb_email_hourly_stats`, `mv_email_hourly`
- [ ] Commitar isolado: mensagem `fix(clickhouse): allow experimental JSON type for properties column`
- [ ] Só então prosseguir para AC #1 (POC da cadeia de MVs)

### 13.7 Pointers de código

- DDL afetada: `infra/clickhouse-init/01-init-bms.sql:35`
- Compose: `docker-compose.yml:34-52` (serviço `clickhouse`)
- Versão: `clickhouse/clickhouse-server:24.8-alpine`
- Setting: `allow_experimental_json_type` (gate do tipo JSON novo do CH 24.x, distinto do legado `Object('json')`)

### 13.8 Segundo bloqueador descoberto após aplicar AC #0 — TTL incompatível com DateTime64

**Descoberto:** 2026-04-28, logo após habilitar a flag JSON. CH passa do erro de JSON e bate em **outro** erro de DDL, ainda no mesmo `01-init-bms.sql`. Container continua saindo com falha; entrypoint não conclui.

**Sintoma:**
```
Code: 450. DB::Exception: TTL expression result column should have DateTime or
Date type, but has DateTime64(3, 'UTC'). (BAD_TTL_EXPRESSION)
```

**Causa:** `infra/clickhouse-init/01-init-bms.sql:47` declara `TTL time + toIntervalDay(180)`, mas a coluna `time` é `DateTime64(3, 'UTC')` (linha 5). No ClickHouse 24.8 a expressão de TTL precisa resultar em `Date` ou `DateTime` (sem precisão de subsegundo). Isso passou em versões antigas porque a validação era mais frouxa; em 24.8 é erro duro.

**Implicação:** sozinha, a Opção A da Seção 13.4 não destrava o stack. Seguem **dois fixes** necessários no mesmo commit de pré-requisito.

**Opções de fix:**

| Opção | O que faz | Custo | Risco |
|---|---|---|---|
| **α — usar a coluna `time_date` (Date) que já existe** | `TTL time_date + toIntervalDay(180)` (linha 7 já tem `time_date Date DEFAULT toDate(time)`) | 1 caractere mudado | Mínimo. Granularidade de TTL passa a ser por dia, o que já é o comportamento real (`toIntervalDay`) |
| **β — cast inline** | `TTL toDateTime(time) + toIntervalDay(180)` | 1 wrapper | Baixo. Equivalente funcional. Mas perde subsegundo no cálculo, o que é irrelevante para TTL diário |
| **γ — `Date` direto** | `TTL toDate(time) + toIntervalDay(180)` | 1 wrapper | Baixo |

**Recomendação:** Opção α. Reusa coluna existente, mais legível, zero overhead de cast por linha.

**Decisão tomada (proposta dev, ratificada por PM John em 2026-04-28):** Opção α. Vai no **mesmo commit** do AC #0. A flag JSON sozinha não destrava nada — fixes só fazem sentido aplicados juntos. Separar em dois commits violaria coesão: o primeiro só moveria o bug do erro 44 (JSON) para o erro 450 (TTL), sem destravar `docker compose up`.

Mensagem do commit revisada: `fix(clickhouse): unblock 24.8 init (JSON flag + TTL on Date column)`.

**Verificações primárias feitas pelo PM antes da ratificação:**
- `time` é `DateTime64(3, 'UTC')` na linha 5 do `01-init-bms.sql` ✅
- `time_date Date DEFAULT toDate(time)` existe na linha 7 ✅
- TTL na linha 47 referencia `time` ✅
- Erro 450 (`BAD_TTL_EXPRESSION`) bate com a regra de CH 24.8 que TTL exige `Date`/`DateTime` ✅

**Risco residual registrado (não bloqueia):** `tb_email_hourly_stats` (linha 64) usa `ENGINE = SummingMergeTree()` sem TTL. Se algum dia for adicionado TTL nela, a coluna `hour` é `DateTime` (sem 64) — então OK. Apenas atenção futura para não replicar `DateTime64` em colunas que vão pra TTL.

**AC #0 atualizado** (substitui passos anteriores):
- [x] Criar `infra/clickhouse-config/users.d/00-experimental.xml` com flag `allow_experimental_json_type`
- [x] Mount `./infra/clickhouse-config/users.d:/etc/clickhouse-server/users.d` no `docker-compose.yml`
- [x] Editar `infra/clickhouse-init/01-init-bms.sql:47`: `TTL time + toIntervalDay(180)` → `TTL time_date + toIntervalDay(180)`
- [x] `docker compose down -v && docker compose up -d clickhouse` sobe healthy
- [x] `SHOW TABLES FROM BMS` lista `events_logs_v2`, `tb_email_hourly_stats`, `mv_email_hourly`
- [x] Commit isolado: `25cf77d fix(clickhouse): unblock 24.8 init (JSON flag + TTL on Date column)`
- [ ] Card EVO-1013 no Linear ainda reflete o AC #0 antigo (1 fix). **Pendência de sincronia** — atualizar quando o PR for aberto, junto com a descrição final do PR.

---

## 14. Resultado do AC #1 (POC) — 2026-04-28

**Status:** ✅ **Cascata validada.** Caminho G da Seção 11 está empiricamente viável.

### 14.1 Setup do POC

- Exchange declarada: `bms.analytics` (topic, durable) via `rabbitmqadmin declare exchange`.
- Tabela ad-hoc `BMS.events_queue` criada com `ENGINE = RabbitMQ`, mirror de 38 colunas de `events_logs_v2`, settings:
  - `rabbitmq_host_port = 'rabbitmq:5672'`
  - `rabbitmq_exchange_name = 'bms.analytics'`
  - `rabbitmq_exchange_type = 'topic'`
  - `rabbitmq_routing_key_list = 'event.enriched'`
  - `rabbitmq_format = 'JSONEachRow'`
  - `rabbitmq_username/password = 'guest'/'guest'` (compose default)
- MV `BMS.mv_events_to_logs TO BMS.events_logs_v2 AS SELECT <38 cols> FROM events_queue`.
- 1 mensagem JSONEachRow publicada via `rabbitmqadmin publish` com `event_log_id='poc-test-1', message_type='email', event='open', account_id=1`.

### 14.2 Resultado

```
SELECT count() FROM BMS.events_logs_v2 WHERE event_log_id = 'poc-test-1';
1

SELECT account_id, hour, opened, total_events FROM BMS.tb_email_hourly_stats WHERE account_id = 1;
1   2026-04-28 18:00:00   1   1
```

**Cascata `events_queue → mv_events_to_logs → events_logs_v2 → mv_email_hourly → tb_email_hourly_stats` funciona out-of-the-box no CH 24.8** — sem precisar setar `cascade_materialized_views=1` explicitamente (já é default).

### 14.3 Achados que impactam AC #2 (producer)

1. **Warning do RabbitMQ engine:** `RabbitMQ table engine doesn't support ALIAS, DEFAULT or MATERIALIZED columns. They will be ignored and filled with default values`. Implicação: a coluna `time_date Date DEFAULT toDate(time)` na queue table **não é populada pelo DEFAULT** — o producer precisa enviar `time_date` explicitamente no payload JSON. **`processMessageToAnalytics` precisa derivar e stampar `time_date` antes do publish** (não estava no `processMessageToKafka` original porque o consumer Kafka cuidava disso).
2. **Tipo `properties` na queue:** usei `String` na queue table (não `JSON`) e a MV faz cast implícito ao inserir em `events_logs_v2.properties JSON`. Funcionou. **Decisão para AC #3:** manter `properties String` na queue table — evita que o RabbitMQ engine tenha que parsear JSON aninhado, que tende a ser mais frágil. A conversão para JSON ocorre na MV.
3. **Auth RabbitMQ:** `guest/guest` funcionou direto da rede docker (rabbitmq:3.13-management permite guest cross-host por default na imagem). **Decisão para AC #3:** o DDL final precisa parametrizar `rabbitmq_username/password` — não pode ser hardcoded. Usar `getMacro` do CH ou variáveis de ambiente (`CLICKHOUSE_*`) — investigar no AC #3.
4. **Routing key e payload:** `JSONEachRow` no exchange topic + routing key fixa `event.enriched` funciona. AC #2 publica com essa exata routing key.

### 14.4 Decisões registradas no POC (sem ratificação adicional necessária)

- **`properties` na queue = `String`** (cast para `JSON` na MV).
- **Producer stampa `time_date`** explicitamente (não confia em DEFAULT da queue).
- **Producer stampa `properties` como String** (`JSON.stringify`) — evita dependência das settings de input format do CH.
- **Sem batching no producer** (Promise.all paralelo preservado, conforme AC #2).
- **Cleanup do POC:** objetos `events_queue` e `mv_events_to_logs` ad-hoc permanecem no CH local. Serão **substituídos** pela DDL definitiva do AC #3 (com `IF NOT EXISTS` / drop-and-recreate).

---

## 15. Tentativa de bloqueador descartada — `pnpm install` global vs. escopo da EVO-1013

**Descoberto:** 2026-04-28, ao tentar rodar `pnpm install` no root para validar a troca de `kafkajs` por `@bms/messaging`.
**Status:** ❎ **Mal-classificado como bloqueador (PM John, 2026-04-28).** O erro é real, mas não pertence à EVO-1013 — é quebra preexistente em `apps/frontend-react`, app que não tem dependência alguma com `event-process`. Misturar o fix do frontend-react no PR da EVO-1013 violaria a regra "Commit scope is literal". A seção fica registrada para histórico do investigador, mas as decisões pendentes que constavam aqui foram retiradas.

### Mitigação para destravar AC #2 (sem mexer em frontend-react)

```bash
pnpm --filter events-process... install
pnpm --filter events-process type-check
pnpm --filter events-process test
```

`pnpm` resolve apenas `events-process` e seus deps transitivos (`@bms/messaging`, `@retention/typescript-config`, etc). `frontend-react` fica fora da árvore. Mesma estratégia para CI: filtrar via turbo (`turbo run type-check --filter=events-process...`).

### 15.1 Sintoma

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In apps/frontend-react:
"@retention/test-config@workspace:*" is in the dependencies but no
package named "@retention/test-config" is present in the workspace
```

Falha atômica do `pnpm install` impede qualquer dep nova de ser materializada em `node_modules/`. Resultado: `node_modules/@google-cloud/pubsub` (que sempre existiu como dep do `events-process`) também desaparece — `tsc --noEmit` falha com erro genérico "Cannot find module".

### 15.2 Causa (com correção factual do PM em 2026-04-28)

`apps/frontend-react/package.json:75-76` referencia dois packages workspace. **Apenas um está faltando:**

- `@retention/eslint-config` — **existe** em `packages/eslint-config/package.json` (verificado: o `name` ali é literalmente `@retention/eslint-config`). A ref resolve corretamente. Diagnóstico inicial dizendo "deveria ser `@bms/eslint-config`" estava errado e foi removido.
- `@retention/test-config` — não existe. Sem package equivalente em `packages/`. Usado por `apps/frontend-react/vitest.config.ts:10` (`setupFiles: ['@retention/test-config/vitest-setup', ...]`).

Introduzido no commit `6d466fb "front react"`. O scaffold da app referencia um package que nunca foi adicionado ao monorepo.

**Anotação fora de escopo (não decidir aqui):** o repo tem três namespaces convivendo em `packages/` (`@retention/*`, `@bms/*`, `@msgops/*`). Padronizar isso é refactor próprio, não escopo da EVO-1013.

### 15.3 Implicações reais (escopo correto)

1. **`pnpm install` no root falha em qualquer máquina limpa** desde 6d466fb. Self-hoster que clonar e rodar install global não consegue. **Followup separado da EVO-1013.**
2. **CI:** vale verificar se o pipeline atual roda `frontend-react`. Se sim, está quebrado desde 6d466fb. Se não, o problema só aparece em dev local. **Followup separado.**
3. **Validação local da EVO-1013:** **não impactada**. Use `pnpm --filter events-process... install` para escopar a árvore (ver Mitigação acima).

### 15.4 Followup sugerido (fora do escopo da EVO-1013)

Quando alguém abrir card pra arrumar:

- **Fix mínimo:** criar `packages/test-config` com stub (`vitest-setup.ts` mínimo — e.g. `import '@testing-library/jest-dom/vitest'`) para que a ref de `@retention/test-config` em `frontend-react/vitest.config.ts:10` resolva. Custo: 1 pacote pequeno, ~15 min.
- **Alternativa:** mover o conteúdo do setup para `apps/frontend-react/tests/setup.ts` e remover a dep externa. Custo: depende do que o setup file faria — exige descobrir o conteúdo esperado.
- **Decisão sobre namespace `@retention/* → @bms/*`:** refactor próprio, NÃO entra no fix do install. Pode ficar para outro card ou outro release.

Dono natural: alguém de frontend (não Guilherme, não Davidson). Não é prioridade da v0.1.0 a menos que `frontend-react` esteja no escopo do release — confirmar com Davidson.

### 15.5 Estado do AC #2 (uncommitted, válido — install global era a única coisa "bloqueada")

Mudanças já feitas localmente (não commitadas ainda):
- ✅ `packages/messaging/src/exchanges.ts`: adicionado `analytics: 'bms.analytics'`
- ✅ `packages/messaging` rebuildado (`dist/` atualizado)
- ✅ `apps/event-process/src/providers/analytics-publisher.provider.ts` criado (NestJS provider wrapping `AmqpPublisher` com `OnModuleInit/Destroy`)
- ✅ `apps/event-process/src/providers/kafka.provider.ts` deletado
- ✅ `apps/event-process/src/events/events.module.ts`: `KafkaProvider` → `AnalyticsPublisherProvider`
- ✅ `apps/event-process/src/events/services/events.service.ts`:
  - `processMessageToKafka` → `processMessageToAnalytics`
  - `sendKafkaMessage` → `sendAnalyticsEvent`
  - `time_date` derivado producer-side (ISO date)
  - `properties` `JSON.stringify`-ado
  - Static `EventsService.kafkaProvider` → `EventsService.analyticsPublisher`
- ✅ 5 call-sites atualizados: `sendgrid/twilio/push/internal-events/custom-events.service.ts`
- ✅ `msgops.service.ts` comment atualizado
- ✅ 6 spec files com mocks renomeados, assertions ajustadas (publish unary)
- ✅ `apps/event-process/package.json`: `kafkajs` removido, `@bms/messaging` adicionado, exclusion de cobertura corrigida
- ✅ `apps/event-process/.env.example`: `KAFKA_*` removidos, `AMQP_URL` adicionado
- 🟢 **Próximo passo:** rodar `pnpm --filter events-process... install` (não global), depois `pnpm --filter events-process type-check` + `pnpm --filter events-process test`. Se passar → seguir para AC #3 (DDL CH) e AC #4 (smoke E2E).

---

## 16. Resultado do AC #4 (smoke E2E) — 2026-04-28

**Status:** ✅ **Pipeline AMQP → CH RabbitMQ engine → MV → events_logs_v2 → mv_email_hourly → tb_email_hourly_stats validada com a DDL definitiva do `02-events-rabbitmq.sh`.**

### 16.1 Desvio do plano original

O passo 3 do AC #4 (`curl -X POST /sendgrid …`) exige stack maior do que o que a EVO-1013 entrega: `SendgridService.processSendgrid` chama `msgOpsService.checkPostgresConnection()` (linha 23) e `prefetchTimeZones` (linha 92) — Postgres é hard dep, e o payload precisa de `category: ["account:N", "message:M", …]` válida porque `parseEventType` extrai `accountId` daí. Validar o transporte (que é o escopo da EVO-1013) não exige reproduzir essa cadeia.

**Alternativa adotada:** publicar AMQP direto no exchange `bms.analytics` com payload de 38 campos formatado para JSONEachRow. Isso valida especificamente a substituição que a EVO-1013 faz (Kafka → AMQP + CH RabbitMQ Engine + MV) sem depender de Postgres/Redis/dados de account. AC #2 (producer) já tem cobertura por testes unitários (`events.service.spec.ts` 408/408 verde).

### 16.2 Comandos executados

```bash
docker compose up -d rabbitmq clickhouse

docker exec rabbitmq rabbitmqadmin publish \
  exchange=bms.analytics routing_key=event.enriched \
  payload='{"event_log_id":"smoke-1","account_id":1,"message_type":"email","event":"open",…,"time":"2026-04-28 12:00:00.000","time_date":"2026-04-28","date":"2026-04-28"}'
# → Message published

docker exec clickhouse clickhouse-client \
  --query "SELECT event_log_id, account_id, event, time, date, time_date FROM BMS.events_logs_v2 WHERE event_log_id='smoke-1' FORMAT Vertical"
```

### 16.3 Resultado

```
event_log_id: smoke-1
account_id:   1
event:        open
time:         2026-04-28 12:00:00.000
date:         2026-04-28
time_date:    2026-04-28
```

Cascata para `tb_email_hourly_stats`:

```
account_id: 1
hour:       2026-04-28 12:00:00
opened:     1
total_events: 1
```

CH `system.text_log` mostra `Pushing (sequentially) from BMS.events_queue to BMS.mv_events_to_logs took 0 ms` — engine consumindo e MV roteando sem erro de parse.

### 16.4 Confirmações operacionais

- **Coluna `date` populada corretamente** (`2026-04-28`, não `1970-01-01`) — valida o fix H3 do code review (producer estampar `date` explicitamente, RabbitMQ engine ignora DEFAULT/MATERIALIZED).
- **Coluna `time_date` populada e equivalente a `date`** — formato JSONEachRow `'YYYY-MM-DD'` aceito.
- **Coluna `time` parseada como DateTime64(3, 'UTC')** sem erro — formato `'YYYY-MM-DD HH:MM:SS.sss'` (espaço, sem `T`/`Z`) é o que CH 24.8 espera.
- **Cascata de MVs (`events_queue → mv_events_to_logs → events_logs_v2 → mv_email_hourly → tb_email_hourly_stats`)** dispara sem precisar setar `cascade_materialized_views=1` — é default no 24.8.

### 16.5 Smoke do producer real — também ✅

Ampliação do smoke para cobrir `processMessageToAnalytics` em runtime (não só os 12 unit tests do `sendAnalyticsEvent`). Path mais limpo: `internal-events`, porque `getAccountTimeZone` retorna `'UTC'` como default quando o config não existe (`msgops.service.ts:142-145`) e o `saveEventsLogs` está comentado (`internal-events.service.ts:173`) — não precisa account real no PG, basta `checkPostgresConnection` responder.

**Bloqueador encontrado e contornado:** `PubSubProvider` (legado GCP, `pubsub.provider.ts:15-16`) exige `TOPIC_NAME_TAG_PROCESS` e `TOPIC_NAME_EVENT_PROCESS` setados no construtor, mesmo no path não-prod onde o publish vira fake hash. Set inline ao subir resolve. **Followup v0.1.0:** o roadmap já tem `Pub/Sub → BullMQ` como decisão travada — quando essa migração rodar, o construtor ganha early-return em dev e o cruft some.

**Stack usado:**
- `bms-pg` (postgres:16-alpine, host:55432) — DB `msgops` com schema TypeORM já aplicado
- `bms-redis` (redis:7-alpine, host:56379)
- `rabbitmq` + `clickhouse` do compose root

**Comandos:**

```bash
# subir
TOPIC_NAME_TAG_PROCESS=dev-tag TOPIC_NAME_EVENT_PROCESS=dev-events SERVICE_ACCOUNT='{}' \
  pnpm --filter events-process start
# → Nest application successfully started (porta 3015 do .env)

# webhook
curl -X POST http://localhost:3015/internal-events \
  -H "Content-Type: application/json" \
  -H "platform: internal" \
  -H "x-goog-pubsub-message-id: prod-smoke-$(date +%s)" \
  -d '{"platform":"internal","payload":[{
    "accountId":1,"uuid":"prod-smoke-uuid-1","event":"page_view",
    "timestamp":'"$(date +%s)"',"ip":"8.8.8.8","userAgent":"Mozilla/5.0"
  }]}'
# → {} (200 OK)

# verificar
docker exec clickhouse clickhouse-client --query "
  SELECT event_log_id, account_id, event, time, date, time_date, properties
  FROM BMS.events_logs_v2 WHERE uuid='prod-smoke-uuid-1' FORMAT Vertical"
```

**Resultado:**

```
event_log_id: 8f129b09-8fab-4994-aa0d-e4cc64a8fd81   ← UUID gerado pelo producer
account_id:   1
event:        page_view
time:         2026-04-28 18:06:06.000                ← formato CH-compat (sem T/Z)
date:         2026-04-28                             ← H3 fix verificado em runtime
time_date:    2026-04-28
properties:   {"asn":"0","asn_org":"","is_bot":false,"is_datacenter":false,"user_type":""}
              ← 6 campos do BotDetector estampados via processMessageToAnalytics
```

Confirma o pacote inteiro do AC #2: rename camelCase → snake_case, geração de `event_log_id` UUID novo (`crypto.randomUUID`), stamp dos campos do BotDetector em `properties`, normalização de `time` via `toClickhouseDateTime`, deriva producer-side de `date` e `time_date`.

---

## Apêndice — Arquivos lidos para esta análise

- `apps/event-process/src/providers/kafka.provider.ts` (íntegra)
- `apps/event-process/src/events/services/events.service.ts:450-550` (sendKafka + processMessageToKafka)
- `apps/event-process/src/app.controller.ts` (íntegra)
- `apps/event-process/src/app.module.ts` (íntegra)
- `apps/event-process/.env.example` (íntegra)
- `apps/tag-process/src/providers/clickhouse.provider.ts` (íntegra)
- `apps/message-trigger/src/providers/clickhouse.provider.ts` (íntegra)
- `apps/msgops-api/src/providers/clickhouse.provider.ts` (íntegra)
- `infra/clickhouse-init/01-init-bms.sql` (íntegra)
- `docker-compose.yml` (relevante)
- `_evo-output/planning-artifacts/plan-opensource.md` (grep kafka/clickhouse)
- `_evo-output/planning-artifacts/roadmap-opensource.md` (grep kafka/clickhouse/event)
- `_evo-output/implementation-artifacts/evo-946-fase-3-onda-1/*.md` (grep kafka/event-process)
- `docs/plans/2026-04-21-feat-bot-detection-tracker-redirect-pageview-plan.md` (grep)
- Greps amplos por: `kafkajs`, `KafkaProvider`, `KAFKA_`, `clickhouse`, `ClickhouseProvider`, `events_logs_v2`, `tb_email_hourly_stats`, `mv_email_hourly`, `client.insert`, `async_insert`, `sendKafkaMessage`
