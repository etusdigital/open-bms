# EVO-952 — Wave 2 Decisões Técnicas

**Card:** [EVO-952](https://linear.app/evoai/issue/EVO-952)
**Data:** 2026-04-28
**Escopo:** Migrar `send-push`, `send-whatsapp`, `twilio-messaging` de Pub/Sub → AMQP (`@bms/messaging`).
**Pré-requisitos consolidados:**

- Playbook canônico: `docs/plans/2026-04-22-migration-pattern.md`
- Nomenclatura travada: `_evo-output/planning-artifacts/amqp-nomenclature-decision.md`
- Lib: `packages/messaging/` (EVO-940, Done)
- Onda 1 (referência viva): `apps/send-email`, `apps/event-process`, `apps/tracker`
- Publishers upstream já migrados: `message-trigger` (EVO-949) já publica em `bms.{push,whatsapp,sms}/{push,whatsapp,sms}.send`

**Princípio de migração:** Substituições preservam comportamento. Não re-arquitetar; re-rotular para AMQP. Wildcards proibidos em v0.1.0 → uma queue por routing-key alvo.

---

## 1. Decisão de escopo: somente o caminho `automation/single` por enquanto

Os 3 apps têm 2–3 endpoints HTTP cada (campaign batch, automation, single). Hoje cada endpoint é alvo de uma push subscription Pub/Sub diferente:

| App              | Endpoint               | Topic Pub/Sub atual                                                                     | Publisher upstream                                         |
| ---------------- | ---------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| send-push        | `@Post()` (root)       | `TOPIC_MSGOPS_CAMPAIGN_SEND_MESSAGE` (filtrado por `message-type=web-push/mobile-push`) | `campaign-packer`                                          |
| send-push        | `@Post('/single')`     | `TOPIC_NAME_SEND_PUSH`                                                                  | `message-trigger` (✅ migrado), `msgops-api` (não migrado) |
| send-whatsapp    | `@Post('/campaign')`   | `TOPIC_MSGOPS_CAMPAIGN_SEND_MESSAGE` (filtrado `whatsapp`)                              | `campaign-packer`                                          |
| send-whatsapp    | `@Post('/automation')` | `TOPIC_NAME_SEND_WHATSAPP`                                                              | `message-trigger` (✅ migrado)                             |
| twilio-messaging | `@Post('/campaign')`   | `TOPIC_MSGOPS_CAMPAIGN_SEND_MESSAGE` (filtrado `sms/whatsapp`)                          | `campaign-packer`                                          |
| twilio-messaging | `@Post('/automation')` | `TOPIC_NAME_SEND_TWILIO`                                                                | `message-trigger` (✅ migrado)                             |
| twilio-messaging | `@Post('/single')`     | `TOPIC_NAME_SEND_SINGLE_SMS`                                                            | `msgops-api` (não migrado)                                 |

**Decisão (escopo explícito):** **Esta onda só migra os endpoints com publisher AMQP já vivo** — os do `message-trigger`. Campaign e single (msgops-api) ficam como código vivo mas sem fonte AMQP até Onda 3/4 / migração de `msgops-api`.

**Justificativa:**

1. `amqp-nomenclature-decision.md` (lock travado) **só define** `bms.campaigns/campaign.send` para o caminho de campanha. **Não há** `push.campaign`/`whatsapp.campaign`/`sms.campaign` nem `sms.single` no documento. Inventar routing keys aqui criaria divergência com a Onda 4 quando `campaign-packer` for migrado.
2. Substituições preservam comportamento — onde não há substituto AMQP equivalente hoje (campaign-packer ainda Pub/Sub), preservar significa **não tocar** o caminho até que ambos os lados migrem na mesma onda.
3. v0.1.0 OSS roda sem GCP — push subscriptions Pub/Sub já não funcionam localmente. O caminho de campanha já está quebrado em local antes desta onda; esta onda **não regride** algo que estava verde.

**AC do card refinada:** "envio de push/whatsapp/sms funcional em dev local" → entender como **caminho de automation via `message-trigger`**. Validação E2E:

```
curl publish em bms.{push,whatsapp,sms}/{push,whatsapp,sms}.send → consumer log + provider call
```

Publishers de saída (next-step + tracker) ficam 100% migrados (Padrão A) em todos os 3 apps — não há hipótese de uso parcial.

---

## 2. send-push — **Híbrido A+B**

### 2.1 Consumer (Padrão B — HTTP-bridge)

| Routing key          | Queue                 | Bridge endpoint              |
| -------------------- | --------------------- | ---------------------------- |
| `bms.push/push.send` | `send-push.push.send` | `POST /internal/push/single` |

1 instância de `AmqpConsumer` em `send-push-consumer.service.ts`. Endpoint atual `/single` renomeado para `/internal/push/single` + protegido por `INTERNAL_AUTH_TOKEN`.

**Endpoints preservados como código (sem queue AMQP nesta onda):**

- `@Post()` (campaign batch) — mantido literal, virá Onda 4 com `campaign-packer`. Adicionar TODO comment apontando wave-2-decisions §1.

### 2.2 Publishers (Padrão A)

| Call-site                                                                          | Pub/Sub atual                          | AMQP destino                                                                                                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `app.service.ts:65` (`processSingle` user-without-devices fallback → next.pubName) | dynamic (`next.pubName`)               | `bms.triggers/trigger.process` (substituição literal — `activesteps.handler.ts:30` confirma `pubName=TOPIC_NAME_MESSAGE_TRIGGER` sempre) |
| `app.service.ts:129` (`processSingle` success → next.pubName)                      | dynamic (`next.pubName`)               | `bms.triggers/trigger.process`                                                                                                           |
| `app.service.ts:327` (`processSent` → events tracking)                             | `TOPIC_MSGOPS_EVENT_PROCESS`           | `bms.events/event.received.push` (hardcoded `'push'` — colapsa `web-push`/`mobile-push` per Onda-1 §2.1)                                 |
| `app.service.ts:388` (`sendTracker` → campaign tracker)                            | `TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER` | `bms.campaigns/campaign.tracked`                                                                                                         |

**1 service genérico `EventPublisherService`** (mesmo formato de `apps/send-email/src/event-publisher.service.ts`).

### 2.3 Ordem de shutdown (híbrido — playbook §3.5)

`consumer.stop()` → `publisher.close()` → `app.close()` → `exit(0)` com watchdog 12s. Prod-guard `INTERNAL_AUTH_TOKEN` ≥24 chars + `BRIDGE_ENDPOINT` obrigatório.

### 2.4 Env vars

```
- SERVICE_ACCOUNT
- TOPIC_MSGOPS_EVENT_PROCESS
- TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER
+ AMQP_URL=amqp://guest:guest@localhost:5672
+ INTERNAL_AUTH_TOKEN=dev-send-push-token-change-me-please-x
+ BRIDGE_ENDPOINT=http://localhost:3000
```

`firebase-admin` mantém (FCM destino, não infra — confirmado na nota do card).

---

## 3. send-whatsapp — **Híbrido A+B**

### 3.1 Consumer (Padrão B — HTTP-bridge)

| Routing key                  | Queue                         | Bridge endpoint                      |
| ---------------------------- | ----------------------------- | ------------------------------------ |
| `bms.whatsapp/whatsapp.send` | `send-whatsapp.whatsapp.send` | `POST /internal/whatsapp/automation` |

1 instância de `AmqpConsumer`. Endpoint `/automation` renomeado para `/internal/whatsapp/automation` + token-guarded.

**Endpoints preservados como código:**

- `@Post('/campaign')` — Onda 4.

### 3.2 Publishers (Padrão A)

| Call-site                                                 | Pub/Sub atual                          | AMQP destino                     |
| --------------------------------------------------------- | -------------------------------------- | -------------------------------- |
| `app.service.ts:104` (`processAutomation` → next.pubName) | dynamic                                | `bms.triggers/trigger.process`   |
| `app.service.ts:116` (`invalidContact` → next.pubName)    | dynamic                                | `bms.triggers/trigger.process`   |
| `app.service.ts:152` (`sendTracker`)                      | `TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER` | `bms.campaigns/campaign.tracked` |

### 3.3 Env vars

```
- SERVICE_ACCOUNT
- TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER
+ AMQP_URL=amqp://guest:guest@localhost:5672
+ INTERNAL_AUTH_TOKEN=dev-send-whatsapp-token-change-me-please-x
+ BRIDGE_ENDPOINT=http://localhost:3000
```

TypeORM/Postgres mantidos (entity `short-link` para callback Evolution API).

---

## 4. twilio-messaging — **Híbrido A+B**

### 4.1 Consumer (Padrão B — HTTP-bridge)

| Routing key        | Queue                       | Bridge endpoint                 |
| ------------------ | --------------------------- | ------------------------------- |
| `bms.sms/sms.send` | `twilio-messaging.sms.send` | `POST /internal/sms/automation` |

1 instância de `AmqpConsumer`.

**Endpoints preservados como código (sem queue AMQP):**

- `@Post('/campaign')` — Onda 4.
- `@Post('/single')` — depende de `msgops-api` migrar (Semana 5+).

### 4.2 Publishers (Padrão A)

| Call-site                                                            | Pub/Sub atual                          | AMQP destino                     |
| -------------------------------------------------------------------- | -------------------------------------- | -------------------------------- |
| `app.service.ts:176` (`processSingleSms` → next.pubName w/ compress) | dynamic                                | `bms.triggers/trigger.process`   |
| `app.service.ts:211` (`processAutomation` → next.pubName)            | dynamic                                | `bms.triggers/trigger.process`   |
| `app.service.ts:247` (`sendTracker`)                                 | `TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER` | `bms.campaigns/campaign.tracked` |

### 4.3 Env vars

```
- SERVICE_ACCOUNT
+ AMQP_URL=amqp://guest:guest@localhost:5672
+ INTERNAL_AUTH_TOKEN=dev-twilio-messaging-token-change-me-x
+ BRIDGE_ENDPOINT=http://localhost:3000
+ TOPIC_MSGOPS_CAMPAIGN_EVENTS_TRACKER  # já no código mas faltava no .env.example — adicionar como referência (não precisa mais como topic Pub/Sub)
```

`twilio` SDK mantém (destino Twilio, não infra). `ormconfig.ts` permanece.

---

## 5. Lacunas transitórias conhecidas (assumidas explicitamente)

Estas paths existem como código mas não recebem tráfego AMQP até as próximas ondas — **não são bugs desta onda**:

| App              | Endpoint                 | Bloqueador                      | Onda alvo |
| ---------------- | ------------------------ | ------------------------------- | --------- |
| send-push        | `@Post()` campaign batch | `campaign-packer` ainda Pub/Sub | Onda 4    |
| send-whatsapp    | `@Post('/campaign')`     | `campaign-packer`               | Onda 4    |
| twilio-messaging | `@Post('/campaign')`     | `campaign-packer`               | Onda 4    |
| twilio-messaging | `@Post('/single')`       | `msgops-api` ainda Pub/Sub      | Semana 5  |

Cada endpoint preservado recebe um `// TODO(EVO-95X): bind queue when upstream migrates — see wave-2-decisions.md §5` no controller. A nomenclatura final (`bms.campaigns/campaign.send` vs per-channel) fica para a onda do publisher correspondente. **Não invento routing keys de campanha aqui.**

---

## 6. Specs (atualizar / criar)

Para cada app:

- `app.service.spec.ts`: substituir `PubSubProvider` mock → `EventPublisherService` mock; `jest.mock('@bms/messaging', () => ({ AmqpPublisher: jest.fn(...), AmqpConsumer: jest.fn(...), createHttpBridgeHandler: jest.fn(...), EXCHANGES: { events:'bms.events', triggers:'bms.triggers', campaigns:'bms.campaigns', push:'bms.push', whatsapp:'bms.whatsapp', sms:'bms.sms' } }))` no topo.
- `app.controller.spec.ts`: ajustar para endpoints `/internal/<channel>/<action>` + header `x-internal-token`.
- `event-publisher.service.spec.ts` (novo, copiado de `apps/send-email/`): cobrir publish, header coercion, close.
- Remover specs de `pubsub.provider.spec.ts` (provider deletado).

---

## 7. Aceitação executável (por app)

Espelha checklist §5 do playbook:

- [ ] `grep -rn "@google-cloud/pubsub" apps/<app>/src` → 0 matches
- [ ] `pnpm --filter <app> {lint,type-check,test,build}` verde
- [ ] Specs com `jest.mock('@bms/messaging', …)`
- [ ] `docker compose up rabbitmq -d` + `docker build apps/<app>` verdes
- [ ] Roundtrip dev (caminho automation):
  ```bash
  docker compose exec rabbitmq rabbitmqadmin publish \
    exchange=bms.{push|whatsapp|sms} routing_key={push|whatsapp|sms}.send \
    payload='<fixture>' properties='{"content_type":"application/json"}'
  ```
  → consumer log de recepção em <1s
- [ ] DLQ: forçar erro → msg em `<queue>.dlq` com `x-bms-attempt`/`x-bms-first-error`/`x-bms-last-error`
- [ ] SIGTERM → exit 0 em <15s sem `PublisherClosedError`

---

## 8. Sequência de implementação

| Dia           | App                | Razão                                                                                                    |
| ------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| 28/abr (hoje) | `send-push`        | Card original começa com push; mais publishers (3) — exercita o EventPublisherService genérico primeiro. |
| 29/abr        | `send-whatsapp`    | Mesma estrutura, menos publishers.                                                                       |
| 30/abr        | `twilio-messaging` | Idêntico estruturalmente a whatsapp; encerra rápido.                                                     |

Card original previa send-push em sex 01/mai — antecipei 3 dias para folga (deadline 02/mai).

**1 PR por app** (review barato, rollback granular).

---

## 9. Branch

`guilhermegomes/evo-952-fase-3-onda-2-migrar-send-push-send-whatsapp-twilio` (branch oficial do Linear).

---

## 10. Próximo passo

Confirmar este doc com o usuário, depois implementação app-a-app espelhando `apps/send-email/` (onda 1).
