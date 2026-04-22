# Decisão — Nomenclatura AMQP e contratos da lib `@bms/messaging`

| Campo                  | Valor                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| **Status**             | ✅ DECIDIDO                                                                                  |
| **Data da decisão**    | 2026-04-20                                                                                   |
| **Decidido por**       | Guilherme Gomes (Dev A)                                                                      |
| **Janela de veto**     | Davidson até **sex 24/abr EOD**. Após essa data, mudanças exigem task de refactor explícita. |
| **Issue**              | [EVO-940](https://linear.app/evoai/issue/EVO-940) — Fase 1 — Lib @bms/messaging              |
| **Checkpoint afetado** | Checkpoint 1 (sex 1/mai) — lib feature-complete                                              |

---

## TL;DR

Nomenclatura AMQP do BMS adota o modelo **Simples** (abaixo). Versionamento no nome de exchange, retry queue dedicada e headers obrigatórios estão **fora do escopo da v0.1.0** — adiciona-se se/quando necessário.

Razão curta: `plan-opensource.md` classifica o risco desta decisão como "baixo — refactor se mudar". Gastar 4 dias esperando aprovação em uma decisão de risco baixo custa mais que o refactor que a decisão pode causar. Decide-se agora, prossegue-se o desenvolvimento, Davidson tem janela de veto.

---

## Decisão — Convenção de nomes

### Exchanges

- **Padrão:** `bms.<domínio>`
- **Tipo:** `topic` (todos)
- **Durability:** `durable: true`

Domínios canônicos (v0.1.0):

| Exchange        | Escopo                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| `bms.email`     | Envio de email transacional e batch                                       |
| `bms.events`    | Eventos de tracking (Sendgrid, Sparkpost, Twilio, push, custom, internal) |
| `bms.leads`     | Pipeline de leads (receive, conception)                                   |
| `bms.campaigns` | Campanhas (packer, events-tracker)                                        |
| `bms.triggers`  | Message triggers, automations, steps                                      |
| `bms.push`      | Push notifications (FCM)                                                  |
| `bms.whatsapp`  | WhatsApp                                                                  |
| `bms.sms`       | Twilio SMS                                                                |
| `bms.tags`      | Tag processing                                                            |

A lista acima é **fechada pra v0.1.0**. Adicionar novo domínio exige PR no arquivo `packages/messaging/src/exchanges.ts` (const enum) e review.

### Routing keys

- **Padrão:** `<recurso>.<ação>[.<qualificador?>]`
- **Caracteres:** minúsculas, `.` como separador, `a-z 0-9 -` no conteúdo
- **Proibido:** repetir o nome do domínio (é `email.send`, não `email.email.send`); usar `_` ou camelCase

Exemplos por domínio:

| Exchange        | Routing keys esperadas (v0.1.0)                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bms.email`     | `email.send`, `email.send.batch`, `email.error`                                                                                                           |
| `bms.events`    | `event.received.sendgrid`, `event.received.sparkpost`, `event.received.twilio`, `event.received.push`, `event.received.custom`, `event.received.internal` |
| `bms.leads`     | `lead.received`, `lead.conceived`                                                                                                                         |
| `bms.campaigns` | `campaign.send`, `campaign.schedule`, `campaign.tracked`                                                                                                  |
| `bms.triggers`  | `trigger.process`, `step.process`, `http.request`                                                                                                         |
| `bms.push`      | `push.send`                                                                                                                                               |
| `bms.whatsapp`  | `whatsapp.send`                                                                                                                                           |
| `bms.sms`       | `sms.send`                                                                                                                                                |
| `bms.tags`      | `tag.process`                                                                                                                                             |

### Queues

- **Padrão:** `<serviço-consumidor>.<routing-key-completa>`
- **Binding:** a queue faz bind no exchange do domínio com a routing key exata (não wildcards na v0.1.0)
- **Durability:** `durable: true`, `exclusive: false`, `autoDelete: false`
- **Um consumidor = uma queue.** Queues nunca são compartilhadas entre serviços diferentes.

Exemplos:

| Queue                                   | Exchange     | Routing key               |
| --------------------------------------- | ------------ | ------------------------- |
| `send-email.email.send`                 | `bms.email`  | `email.send`              |
| `send-email.email.send.batch`           | `bms.email`  | `email.send.batch`        |
| `event-process.event.received.sendgrid` | `bms.events` | `event.received.sendgrid` |
| `tracker.event.received.internal`       | `bms.events` | `event.received.internal` |
| `lead-conception.lead.received`         | `bms.leads`  | `lead.received`           |
| `tag-process.tag.process`               | `bms.tags`   | `tag.process`             |

### DLQ (Dead Letter Queue)

- **Padrão:** `<queue>.dlq`
- **Tipo:** queue `durable: true`, sem consumer automático
- **Binding:** criada automaticamente pelo `Consumer` da lib quando a queue principal é declarada
- **DLX:** exchange único `bms.dlx` (topic), compartilhado entre todos os domínios. Preserva routing key original.

Exemplos:

| DLQ                                 | Trigger                                           |
| ----------------------------------- | ------------------------------------------------- |
| `send-email.email.send.dlq`         | Msg excede max-retries em `send-email.email.send` |
| `lead-conception.lead.received.dlq` | Handler de `lead-conception` falha N vezes        |

### Regras de escrita (resumo)

1. `-` (hífen) **só** em nome de serviço (`send-email`, `lead-conception`). Nunca em domínio ou routing key.
2. `.` (ponto) em tudo que é namespace AMQP (exchange, routing key, queue).
3. Tudo minúsculo. Sempre.
4. Nunca repetir palavra de domínio na routing key.
5. Um consumidor = uma queue. Zero excepção.

---

## Contratos da lib `@bms/messaging`

### `Publisher`

```typescript
interface PublishOptions {
  exchange: string; // ex: 'bms.email'
  routingKey: string; // ex: 'email.send'
  payload: unknown; // serializado como JSON no envio
  headers?: Record<string, string | number>;
  persistent?: boolean; // default true (deliveryMode=2)
}

interface Publisher {
  publish(options: PublishOptions): Promise<void>;
  close(): Promise<void>;
}
```

### `Consumer`

```typescript
type HandlerResult = 'ack' | 'nack' | 'requeue';

interface ConsumerOptions {
  exchange: string;
  routingKey: string;
  queue: string; // já no padrão {serviço}.{routing-key}
  prefetch?: number; // default 10
  maxRetries?: number; // default 5
  backoffBaseMs?: number; // default 1000 (backoff exponencial: base * 2^attempt)
  backoffMaxMs?: number; // default 60_000 (cap)
}

interface Consumer {
  consume<T>(
    options: ConsumerOptions,
    handler: (msg: T, ctx: MessageContext) => Promise<HandlerResult | void>,
  ): Promise<void>;
  shutdown(): Promise<void>; // graceful: stop consume → drain in-flight → close
}

interface MessageContext {
  attempt: number; // começa em 1
  headers: Record<string, unknown>;
  routingKey: string;
  queue: string;
}
```

### Retry / DLQ behavior

1. Handler retorna `'ack'` (ou `undefined` / não lança) → ack imediato.
2. Handler retorna `'nack'` ou lança exceção → retry com backoff exponencial (`base * 2^attempt`, capped em `backoffMaxMs`). Implementado via `setTimeout` no próprio consumer (v0.1.0) — sem retry queue dedicada.
3. `attempt >= maxRetries` → publish no `bms.dlx` com routing key original + headers `x-bms-attempt`, `x-bms-first-error`, `x-bms-last-error`. `bms.dlx` roteia pra `<queue>.dlq`.
4. Handler retorna `'requeue'` → nack com requeue imediato (sem incrementar attempt). Usado pra rate-limit temporário.

### Graceful shutdown (SIGTERM)

1. `Consumer.shutdown()` cancela o consume tag (para de receber novas msgs).
2. Aguarda in-flight completar (ack/nack) com timeout configurável (default 30s).
3. Fecha channel → fecha connection.
4. Processo sai com exit 0.

Timeout excedido → fecha connection à força (msgs in-flight voltam pra queue como "unacked → ready"), exit 1.

---

## Bridge HTTP — contrato

### Topologia (decidida 2026-04-20)

**Loopback na mesma image.** Consumer AMQP e o NestJS service rodam no mesmo container. Consumer faz HTTP call em `http://localhost:<NEST_PORT>/<internal-endpoint>`.

**Razão:** menos infra, um container por serviço, docker-compose mais simples. Sidecar adiciona complexidade de orquestração que não se paga em v0.1.0.

**Revisita:** se alguém pedir hot-reload do consumer sem reiniciar o service, ou vice-versa — aí vale separar. Não é o caso hoje.

### Auth (token)

**Header `X-Internal-Token`, shared secret (uma por deploy).** Env var `INTERNAL_AUTH_TOKEN` gerada no wizard de setup (passo a ser incluído por Danilo na Fase 7.5) ou randomica na primeira boot e persistida em `system_config`.

**Revisita v0.1.x:** per-service tokens se o modelo de threat mudar (ex: multi-tenancy no mesmo compose).

### Endpoint convention

- Path: `/internal/<domain>/<action>` — ex: `POST /internal/email/send`, `POST /internal/event/received`
- Body: payload do Consumer (JSON).
- Headers passados adiante: `X-Bms-Attempt`, `X-Bms-Correlation-Id`, `X-Internal-Token`.
- Response:
  - `2xx` → Consumer ack
  - `4xx` (exceto 429) → Consumer **ack** (descarta, é erro de contrato) + log warn
  - `429` → Consumer `nack` (entra no retry com backoff exponencial — `requeue` imediato causava hot-loop em rate-limit persistente; revisado 2026-04-22)
  - `5xx` → Consumer `nack` (entra no retry com backoff)

---

## Outras decisões técnicas (tomadas em conjunto)

| Tópico                 | Decisão                                                                                        | Revisita                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **RabbitMQ version**   | `rabbitmq:3.13-management` (3.13 LTS, suporte até 2028)                                        | Upgrade pra 4.x em v0.2.x se precisar streams/super-streams  |
| **Management UI**      | Expor em `15672` no docker-compose dev com guest/guest                                         | Produção: env vars `RABBITMQ_DEFAULT_USER/PASS` obrigatórias |
| **Consumer prefetch**  | Default `10` — override por consumer                                                           | —                                                            |
| **Message format**     | JSON (não Protobuf/Avro)                                                                       | Avaliar Protobuf em v0.2 se throughput exigir                |
| **Library: `amqplib`** | Sim (não `amqp-connection-manager`, não `@nestjs/microservices`). Mais controle, menos mágica. | —                                                            |

---

## Migration mapping — Pub/Sub → AMQP

Mapeamento proposto dos topics atuais para a nova nomenclatura. Aplicado pelo piloto (EVO-943 event-receiver) e depois pelas Ondas.

| Topic antigo                                           | Exchange novo   | Routing key              | Queue consumer                             |
| ------------------------------------------------------ | --------------- | ------------------------ | ------------------------------------------ |
| `msgops.send.email`                                    | `bms.email`     | `email.send`             | `send-email.email.send`                    |
| `msgops.event.process`                                 | `bms.events`    | `event.received.*`       | `event-process.event.received.<src>`       |
| `msgops.tag.process` (e variante `msgops.tag-process`) | `bms.tags`      | `tag.process`            | `tag-process.tag.process`                  |
| `msgops.message.trigger`                               | `bms.triggers`  | `trigger.process`        | `message-trigger.trigger.process`          |
| `msgops.send.push`                                     | `bms.push`      | `push.send`              | `send-push.push.send`                      |
| `msgops.send.twilio`                                   | `bms.sms`       | `sms.send`               | `twilio-messaging.sms.send`                |
| `msgops.campaign.events-tracker` (e variantes)         | `bms.campaigns` | `campaign.tracked`       | `campaign-events-tracker.campaign.tracked` |
| `msgops.campaign-packer.send-messages`                 | `bms.campaigns` | `campaign.send`          | `campaign-packer.campaign.send`            |
| `msgops.campaign-packer.schedule-pages`                | `bms.campaigns` | `campaign.schedule`      | `campaign-packer.campaign.schedule`        |
| `msgops-api-step-process`                              | `bms.triggers`  | `step.process`           | `msgops-api.step.process`                  |
| `msgops-http-request`                                  | `bms.triggers`  | `http.request`           | `msgops-api.http.request`                  |
| `leads.email.webhooks`                                 | `bms.events`    | `event.received.webhook` | `event-process.event.received.webhook`     |
| `msgops-email-errors`                                  | `bms.email`     | `email.error`            | `msgops-api.email.error`                   |

Mapeamento completo e definitivo será fechado no piloto (EVO-943) junto com o playbook `[C]migration-pattern.md`.

---

## Alternativa considerada — e descartada

### Proposta Verbosa (versionamento + retry queue + headers obrigatórios)

Exchanges seriam `bms.<contexto>.v1`, com retry queue dedicada (`<queue>.retry` com TTL + DLX de volta pro main), e headers obrigatórios (`x-bms-attempt`, `x-bms-origin-service`, `x-bms-correlation-id`, `x-bms-message-version`).

**Por que descartada:**

1. **Versionamento no exchange** paga preço agora pra resolver problema hipotético ("e se precisarmos de v2 do contrato de payload?"). Pode ser resolvido depois com 1 dia de refactor: renomear `bms.email` → `bms.email.v1` + adicionar bindings duplos durante migração. Baixo custo diferido.
2. **Retry queue dedicada** (`.retry` com TTL) é mais idiomático RabbitMQ e libera throughput do consumer durante backoff, mas triplica o número de queues (main + retry + dlq). Observabilidade mais complexa sem ganho mensurável no volume esperado de v0.1.0 (~milhões msgs/mês por app).
3. **Headers obrigatórios** adicionam 100-200B por msg e exigem validação em tempo de publish — melhoria, não requisito.

**Gatilho pra revisita:** quebra de contrato de payload planejada nos próximos 12 meses **OU** throughput exigindo retry queue externa pra não segurar prefetch. Se qualquer um disparar, upgrade é 1-2 dias de trabalho.

---

## Comunicação

Mensagem pro Davidson (a enviar via Slack/Telegram após commit deste doc):

> Fechei hoje a nomenclatura AMQP + contratos da lib `@bms/messaging` pra desbloquear o dev. Doc em `_evo-output/planning-artifacts/amqp-nomenclature-decision.md`.
>
> TL;DR: exchanges `bms.<domínio>` (topic), routing keys `<recurso>.<ação>`, queues `<serviço>.<routing-key>`, DLQ `<queue>.dlq`, DLX único `bms.dlx`. Bridge HTTP é loopback na mesma image, auth via `X-Internal-Token` shared secret.
>
> Se quiser contestar qualquer ponto, **sex 24/abr EOD é o deadline** — depois disso já tem código do piloto (EVO-943) usando e mudar vira refactor task formal. No standup de sexta só confirmamos.
