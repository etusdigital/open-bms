# Migration Pattern: Pub/Sub → `@bms/messaging` [C]

**Status:** Canonical (`[C]`) — piloto `event-receiver` + `event-receiver-probe` (EVO-943, 2026-04-22).
**Revisado:** 2026-04-24 — ver git log. Amendas pós-code-review: `'internal'` no allowlist (H2), AC#2 "métrica" clarificada como headers DLQ + logs estruturados em v0.1.0 (H1 / F23).
**Audience:** engenheiros migrando os 12 apps da Fase 3.
**Reading mode:** diff-oriented. Cada padrão tem os deltas exatos já exercitados em produção-shaped imagem do piloto.

---

## 1. Escopo & pré-requisitos

### Decisão de padrão por app

| App                              | Papel                                                          | Padrão                                  | Observações                                                                      |
| -------------------------------- | -------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `event-receiver` ✅ piloto       | publica webhooks → `bms.events`                                | **A** Publisher-only                    | Referência canônica Padrão A.                                                    |
| `event-receiver-probe` ✅ piloto | consome `bms.events/event.received.*` → HTTP interno           | **B** Consumer-HTTP-bridge              | Referência canônica Padrão B.                                                    |
| `event-process`                  | consome `bms.events/event.received.*` → persiste no ClickHouse | **B**                                   | Substitui subscription Pub/Sub atual. Routing key: todas sob `event.received.*`. |
| `send-email`                     | consome trigger → envia via ESP                                | **B** (ou A se também publica de volta) | Exchange `bms.email`.                                                            |
| `send-push`                      | consome trigger → envia push                                   | **B**                                   | Exchange `bms.push`.                                                             |
| `send-whatsapp`                  | consome trigger → envia WhatsApp                               | **B**                                   | Exchange `bms.whatsapp`.                                                         |
| `twilio-messaging`               | consome trigger → Twilio                                       | **B**                                   | Exchange `bms.sms`.                                                              |
| `lead-receive`                   | recebe webhooks → publica em `bms.leads`                       | **A**                                   | Mesmo shape do event-receiver.                                                   |
| `lead-conception`                | consome `bms.leads` → processa                                 | **B**                                   |                                                                                  |
| `tag-process`                    | consome `bms.tags`                                             | **B**                                   |                                                                                  |
| `campaign-packer`                | consome `bms.campaigns` + publica `bms.triggers`               | **híbrido** (A + B)                     | Publisher + Consumer na mesma app; ver §3.5 para ordem de shutdown.              |
| `campaign-events-tracker`        | consome `bms.campaigns/campaign.tracked`                       | **B**                                   | Queue `campaign-events-tracker.campaign.tracked` (nomenclature-decision.md:229). |
| `message-trigger`                | publica em `bms.triggers`                                      | **A**                                   |                                                                                  |
| `tracker`                        | publica em `bms.events/event.tracker.*`                        | **A**                                   |                                                                                  |
| `msgops-api`                     | nenhum fluxo direto hoje                                       | **n/a**                                 | Aguarda decisão se publica eventos próprios.                                     |

### Pré-requisitos

- `@bms/messaging` no workspace (Fase 1 / EVO-940 — `[C]amqp-implementation-plan.md`).
- RabbitMQ no `docker-compose.yml` (já adicionado no piloto — reutilizável).
- Nomenclatura AMQP congelada em `_evo-output/planning-artifacts/amqp-nomenclature-decision.md` (decisões travadas).
- Node 24 alpine / pnpm 10.22 / turbo 2.9.5.

---

## 2. Padrão A — Publisher-only

Exemplo vivo: `apps/event-receiver/`. A migração é **7 diffs coordenados** + regenerar lockfile.

### Diff 1 — `package.json`

```diff
   "dependencies": {
-    "@google-cloud/pubsub": "^4.10.0",
+    "@bms/messaging": "workspace:*",
     "@nestjs/common": "^11.0.11",
```

Depois: `pnpm install` na raiz para regenerar `pnpm-lock.yaml` (sem o passo, `--frozen-lockfile` do Dockerfile falha).

### Diff 2 — `Dockerfile` (pattern workspace-dep)

```dockerfile
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json ./
RUN pnpm pkg delete scripts.prepare           # root prepare=lefthook install falha no build image

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/<app>/package.json ./apps/<app>/
COPY packages/messaging/package.json ./packages/messaging/
COPY packages/typescript-config/package.json ./packages/typescript-config/   # tsconfig transitive dep
# Para cada workspace package adicional que seu app use, repita o par de COPYs
# (package.json aqui, diretório inteiro no stage build). Sem isso: Cannot find package.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter <app-name>...      # ... inclui workspace deps

FROM deps AS build
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/messaging/ ./packages/messaging/
COPY apps/<app>/ ./apps/<app>/
RUN pnpm --filter @bms/messaging build
RUN pnpm --filter <app-name> build

FROM build AS deploy
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm --filter <app-name> deploy --legacy --prod /deploy
RUN cp -r /app/apps/<app>/dist /deploy/dist
# production stage idêntica ao piloto (dumb-init, uid 1001)
```

**Pontos críticos:**

- `pnpm pkg delete scripts.prepare` no root — o repo usa `"prepare": "lefthook install"` e o binário do lefthook não existe na imagem. Sem isso: `pnpm: command not found: lefthook` na fase deps.
- `--filter <app-name>...` (3 pontos) puxa os workspace deps (`@bms/messaging`). Sem eles, `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` na fase build.
- `pnpm --filter @bms/messaging build` explícito antes do build do app — o Turbo só resolve `^build` em execução via turbo, não em `pnpm --filter`.
- `packages/typescript-config/` é copiado nos dois estágios porque `packages/messaging/tsconfig.json` `extends: @retention/typescript-config/node.json`. Apps que extendam direto também precisam. **Regra geral:** cada workspace package utilizado no grafo de deps exige `COPY packages/<pkg>/package.json ./packages/<pkg>/` em `deps` + `COPY packages/<pkg>/ ./packages/<pkg>/` em `build`.

### Diff 3 — `src/app.module.ts`

```diff
-import { PubSubService } from './pubsub.service';
+import { EventPublisherService } from './event-publisher.service';

 @Module({
   imports: [ConfigModule.forRoot()],
   controllers: [AppController],
-  providers: [AppService, PubSubService],
+  providers: [AppService, EventPublisherService],
 })
```

### Diff 4 — substituir `pubsub.service.ts` por `event-publisher.service.ts`

Novo service com **sanitização + allowlist** para routing key (elimina cardinality explosion vindo de query user-controlled):

```ts
const PLATFORM_ALLOWLIST = new Set([
  'sendgrid',
  'sparkpost',
  'twilio',
  'push',
  'custom',
  'webhook',
  'internal', // tracker app — nomenclature-decision.md:57
  'unknown',
]);
const PLATFORM_NORMALIZATIONS: Record<string, string> = { custom_events: 'custom' };

export function sanitizePlatform(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  const lower = raw.toLowerCase();
  const normalized = PLATFORM_NORMALIZATIONS[lower] ?? lower;
  if (PLATFORM_ALLOWLIST.has(normalized)) return normalized;
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[EventPublisher] unknown platform "${raw}", falling back to 'unknown'`);
  }
  return 'unknown';
}

@Injectable()
export class EventPublisherService implements OnModuleInit {
  private readonly publisher: AmqpPublisher;
  constructor() {
    if (!process.env.AMQP_URL) throw new Error('AMQP_URL environment variable is required');
    this.publisher = new AmqpPublisher({ url: process.env.AMQP_URL });
  }
  async onModuleInit() {
    try {
      await this.warmup();
    } catch (err) {
      // Broker indisponível no boot — fecha o publisher antes do Nest abortar,
      // caso contrário o socket AMQP vaza entre reinícios do crash-loop.
      try {
        await this.publisher.close();
      } catch {}
      throw err;
    }
  }
  async warmup() {
    await this.publisher.publish({
      exchange: EXCHANGES.events,
      routingKey: 'event.received.warmup.ignore',
      payload: { warmup: true },
    });
  }
  async publish(message: Record<string, any>, customAttributes: Record<string, any> = {}) {
    const platform = sanitizePlatform(customAttributes.platform);
    const routingKey = `event.received.${platform}`;
    const headers: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(customAttributes)) {
      if (typeof v === 'string' || typeof v === 'number') headers[k] = v;
      else if (process.env.NODE_ENV !== 'production') {
        console.warn('[EventPublisher] dropping non-string/number header:', k, typeof v);
      }
    }
    await this.publisher.publish({
      exchange: EXCHANGES.events,
      routingKey,
      payload: message,
      headers,
    });
  }
  async close() {
    await this.publisher.close();
  }
}
```

**Decisões chave:**

- Routing key derivação: `event.received.${sanitize(platform)}`. Fora do allowlist → `unknown`. Ajuste para novos platforms: PR na lib + bind de queue (não é self-service).
- Headers `Record<string, string | number>` só — `PublishOptions.headers` rejeita outros tipos. Objetos/booleans: drop + warn em dev (prod silente por custo de log).
- Warmup no `onModuleInit`: força connect/channel/exchange-assert no boot. A primeira inbound real não paga cold-start. Custo: +1 publish descartável por boot (sem binding, broker drop). Aceitável.

### Diff 5 — `src/app.service.ts` (call-site)

```diff
-import { PubSubService } from './pubsub.service';
+import { EventPublisherService } from './event-publisher.service';
...
-  constructor(private readonly pubSubService: PubSubService) {}
+  constructor(private readonly eventPublisherService: EventPublisherService) {}
...
-    await this.pubSubService.sendAsyncMessage(message, args);
+    await this.eventPublisherService.publish(message, args);
```

### Diff 6 — `.env.example`

```diff
-PORT=3011
-SERVICE_ACCOUNT=
-TOPIC_NAME_EVENT_PROCESS=
+PORT=3011
+AMQP_URL=amqp://guest:guest@localhost:5672
```

### Diff 7 — `src/main.ts` (graceful shutdown manual com watchdog)

```ts
const SHUTDOWN_HARD_TIMEOUT_MS = 12_000; // < K8s SIGTERM grace (30s default)

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return; // re-entrancy: SIGTERM+SIGINT ou duplo SIGTERM
  shuttingDown = true;
  console.log(`[bootstrap] received ${signal}, shutting down`);
  const watchdog = setTimeout(() => {
    console.error('[bootstrap] shutdown watchdog fired — forcing exit');
    process.exit(1);
  }, SHUTDOWN_HARD_TIMEOUT_MS);
  try {
    try {
      const publisher = app.get(EventPublisherService);
      await publisher.close();
    } catch (err) {
      console.error('[bootstrap] publisher close failed:', err);
    }
    await app.close();
    clearTimeout(watchdog);
    process.exit(0);
  } catch (err) {
    clearTimeout(watchdog);
    console.error('[bootstrap] shutdown error:', err);
    process.exit(1);
  }
};
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
await app.listen(process.env.PORT || 3011, '0.0.0.0');

// No final do bootstrap():
bootstrap().catch((err) => {
  console.error('[bootstrap] failed:', err);
  process.exit(1);
});
```

### Shutdown pattern — notas compartilhadas (Padrão A, B e híbrido)

O skeleton acima (`shuttingDown` flag + watchdog + `process.once` + `bootstrap().catch`) é **o mesmo nos três padrões**. Os quatro pontos abaixo se aplicam sempre — §3 e §3.5 referenciam esta seção:

- **Handler manual, não `OnModuleDestroy`:** Nest `app.close()` destrói providers em paralelo, sem ordem. Cascata resulta em `PublisherClosedError` intermitente durante drain. Handler SIGTERM/SIGINT manual com ordem explícita resolve.
- **Watchdog 12s → `process.exit(1)`:** garante saída dentro do K8s SIGTERM grace mesmo com broker wedged. Sem ele, `publisher.close()` ou `consumer.shutdown()` podem travar, K8s SIGKILLa e o exit não é 0 — AC 8 regride.
- **Re-entrancy guard + `process.once`:** dois signals em sequência (op apressado, systemd, K8s duplo) disparariam `shutdown()` concorrente. Flag `shuttingDown` + `process.once` evita double-close de recursos que não são idempotent.
- **`bootstrap().catch(err => process.exit(1))`:** sem ele, falha em `NestFactory.create` ou `app.listen` vira unhandled rejection — K8s vê crashloop opaco sem log.

### Specs (atualizar)

- `app.service.spec.ts`, `app.controller.spec.ts`: swap provider token `PubSubService` → `EventPublisherService`, método `sendAsyncMessage` → `publish`. **Adicionar `jest.mock('@bms/messaging', () => ({ AmqpPublisher: jest.fn(...), EXCHANGES: { events: 'bms.events' } }))`** no topo — senão jest tenta carregar o ESM dist e explode com `SyntaxError: Unexpected token 'export'` (lib emite `module: ESNext`, apps usam `module: commonjs`).
- `event-publisher.service.spec.ts` novo: cobrir sanitização (sendgrid, TWILIO→twilio, custom_events→custom, string inválida, undefined, number, long string), header coercion (boolean/object drop + warn), warmup no `onModuleInit`, close delega, throw sem AMQP_URL.

---

## 3. Padrão B — Consumer-HTTP-bridge

Exemplo vivo: `apps/event-receiver-probe/`. Shape canônico para o restante dos 12 apps.

### Estrutura

```
apps/<app>/
  package.json        # deps: @bms/messaging, @nestjs/*, platform-fastify (sem @google-cloud/pubsub)
  tsconfig.json       # module: commonjs, target: ES2023
  tsconfig.build.json # exclude spec.ts
  nest-cli.json
  Dockerfile          # mesmo pattern do Padrão A
  .env.example        # AMQP_URL, INTERNAL_AUTH_TOKEN, BRIDGE_ENDPOINT, PROBE_ALWAYS_ERROR?
  src/
    main.ts           # bootstrap com prod-guard + consumer start após listen
    app.module.ts     # providers: ConsumerService + Controller (endpoint interno)
    <domain>-consumer.service.ts
    <domain>.controller.ts  # /internal/<domain>/<action>
    *.spec.ts
```

### Diff-chave 1 — `src/main.ts` (prod guard + consumer timing + watchdog)

```ts
const SHUTDOWN_HARD_TIMEOUT_MS = 12_000;

async function bootstrap() {
  // Prod guard forte: recusa boot com token ausente, literal default ou curto demais.
  if (process.env.NODE_ENV === 'production') {
    const token = process.env.INTERNAL_AUTH_TOKEN ?? '';
    if (token === 'dev-probe-token' || token.length < 24) {
      throw new Error(
        '[probe] refuse to boot in production with weak/default INTERNAL_AUTH_TOKEN (require >=24 chars, non-default)',
      );
    }
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1048576 }),
  );
  const consumer = app.get(ProbeConsumerService);

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[probe] received ${signal}`);
    const watchdog = setTimeout(() => {
      console.error('[probe] shutdown watchdog fired — forcing exit');
      process.exit(1);
    }, SHUTDOWN_HARD_TIMEOUT_MS);
    try {
      if (consumerStarted) {
        try {
          await consumer.stop();
        } catch (err) {
          console.error('[probe] consumer stop failed:', err);
        }
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      console.error('[probe] shutdown error:', err);
      process.exit(1);
    }
  };

  // REGISTRA ANTES de listen()/start() — SIGTERM durante topology-assert tem handler.
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(process.env.PORT || 3012, '0.0.0.0');

  // Consumer start APÓS Fastify bind — senão attempt 1 bate ECONNREFUSED no HTTP bridge.
  await consumer.start();
  consumerStarted = true;
}

bootstrap().catch((err) => {
  console.error('[probe] bootstrap failed:', err);
  process.exit(1);
});
```

**Pontos críticos do Padrão B** (além das [notas compartilhadas de shutdown](#shutdown-pattern--notas-compartilhadas-padrão-a-b-e-híbrido) do §2):

- **Consumer start APÓS `app.listen()`:** `onApplicationBootstrap` do Nest dispara ANTES do bind de porta. Se o consumer arrancar nele, msg em fila de antes entrega no handler bridge → `fetch('http://localhost:PORT/...')` → `ECONNREFUSED` → queima attempt 1.
- **Handlers registrados ANTES de `listen()` e `start()`:** SIGTERM durante `consume()` (topology assertion, bindQueue) precisa achar handler. Sem isso: default Node exit mid-assert, canal derrubado, orphan.
- **Prod guard forte:** refuse-to-boot em prod se o token é literal `dev-probe-token`, ausente, ou `length < 24`. Versão fraca (só literal default) deixa `INTERNAL_AUTH_TOKEN="weak"` passar — backdoor silencioso.

### Diff-chave 2 — `<domain>-consumer.service.ts`

```ts
const SHUTDOWN_TIMEOUT_MS = 10_000; // K8s SIGTERM grace

@Injectable()
export class ProbeConsumerService {
  private readonly consumer: AmqpConsumer;
  constructor() {
    if (!process.env.AMQP_URL) throw new Error('AMQP_URL environment variable is required');
    if (!process.env.INTERNAL_AUTH_TOKEN)
      throw new Error('INTERNAL_AUTH_TOKEN environment variable is required');
    if (!process.env.BRIDGE_ENDPOINT)
      throw new Error('BRIDGE_ENDPOINT environment variable is required');
    this.consumer = new AmqpConsumer({ url: process.env.AMQP_URL }, SHUTDOWN_TIMEOUT_MS);
  }
  async start() {
    const handler = createHttpBridgeHandler({
      endpoint: process.env.BRIDGE_ENDPOINT!,
      token: process.env.INTERNAL_AUTH_TOKEN!,
    });
    await this.consumer.consume(
      {
        exchange: EXCHANGES.events,
        routingKey: 'event.received.sendgrid',
        queue: 'event-process-probe.event.received.sendgrid', // padrão {serviço}.{routing-key}
        maxRetries: 3,
      },
      handler,
    );
  }
  async stop() {
    await this.consumer.shutdown();
  }
}
```

- `shutdownTimeoutMs: 10_000` sobrescreve o default de 30s da lib — encaixa no K8s grace. Se o drain exceder esse timeout, a lib força close da connection (msgs in-flight voltam pra queue como `unacked → ready`) e o process sai com **exit 1** — handler deve ser idempotente, msgs serão redelivered após restart.
- `maxRetries: 3` → delays 2s (attempt 1→2) + 4s (attempt 2→3) = ~6s de retries + handler latency antes de DLQ.
- **Boundary `maxRetries`:** `maxRetries: 0` → DLQ já na primeira falha (attempt 1 >= 0 dispara). Use `maxRetries: 1` para "tenta uma vez, se falhar DLQ". Mínimo útil de retry real é 2.
- Convenção queue name: `<serviço>.<routing-key>` — permite múltiplos apps bindados no mesmo routing key sem colisão.
- **Wildcards são proibidos em v0.1.0** (ver `nomenclature-decision.md:69`). Cada routing key alvo exige uma queue separada com bind explícito. Consumer dentro do app = múltiplas instâncias de `AmqpConsumer` (uma por queue) OU múltiplas apps.

### Diff-chave 3 — endpoint `/internal/<domain>/<action>`

```ts
@Post('/internal/event/received')
async handle(@Req() req: FastifyRequest, @Res({ passthrough: false }) res: FastifyReply) {
  if (req.headers['x-internal-token'] !== process.env.INTERNAL_AUTH_TOKEN) {
    return res.status(401).send({ error: 'unauthorized' });
  }
  // DLQ validation knob (env) + ad-hoc override (header)
  const forced = req.headers['x-probe-force-error'] ?? process.env.PROBE_ALWAYS_ERROR;
  if (forced) {
    const status = Number(forced);
    if (Number.isFinite(status) && status >= 400 && status < 600) {
      return res.status(status).send({ forced: true });
    }
  }
  return res.status(200).send({ received: true });
}
```

### Config específica

- `AMQP_URL`, `INTERNAL_AUTH_TOKEN`, `BRIDGE_ENDPOINT` obrigatórios — service throw no constructor se ausentes.
- `PROBE_ALWAYS_ERROR` (ou equivalente por app): env var drive para DLQ testing sem redeploy.

---

## 3.5. Padrão híbrido A + B (ex.: `campaign-packer`)

Apps que tanto consomem quanto publicam (`campaign-packer`, possivelmente outros da Fase 3) combinam os dois padrões no mesmo processo. Não há refactor: registrar ambos os providers e orquestrar a ordem de shutdown **explicitamente**.

### Estrutura

```ts
// app.module.ts
@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [InternalController], // endpoint /internal/<domain>/<action> do Padrão B
  providers: [CampaignConsumerService, TriggerPublisherService],
})
export class AppModule {}
```

### `src/main.ts` — shutdown híbrido

```ts
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1048576 }),
  );
  const consumer = app.get(CampaignConsumerService);
  const publisher = app.get(TriggerPublisherService);

  let shuttingDown = false;
  let consumerStarted = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const watchdog = setTimeout(() => process.exit(1), 12_000);
    try {
      // ORDEM CRÍTICA: consumer primeiro (drena in-flight que podem publicar),
      // depois publisher (fecha canal de publish), depois app.
      if (consumerStarted) {
        try {
          await consumer.stop();
        } catch (e) {
          console.error('[hybrid] consumer stop:', e);
        }
      }
      try {
        await publisher.close();
      } catch (e) {
        console.error('[hybrid] publisher close:', e);
      }
      await app.close();
      clearTimeout(watchdog);
      process.exit(0);
    } catch (err) {
      clearTimeout(watchdog);
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(process.env.PORT || 3013, '0.0.0.0');
  await consumer.start();
  consumerStarted = true;
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

**Pontos críticos do híbrido** (além das [notas compartilhadas de shutdown](#shutdown-pattern--notas-compartilhadas-padrão-a-b-e-híbrido) do §2 e dos pontos de timing do §3):

- **Ordem consumer → publisher → app.** Consumer pode emitir publish durante drain (handler que republica). Se publisher fechar primeiro, drain falha com `PublisherClosedError`.
- Consumer e publisher podem compartilhar `AMQP_URL` mas **nunca o mesmo canal** — cada instância abre seu próprio canal (`new AmqpConsumer` e `new AmqpPublisher` não compartilham estado).
- Warmup do publisher continua em `onModuleInit` (Padrão A). Consumer start continua em `main.ts` pós-listen (Padrão B).

---

## 4. Mapping Pub/Sub → AMQP (condensed)

| Pub/Sub (legado)                | AMQP equivalente                                             | Padrão |
| ------------------------------- | ------------------------------------------------------------ | ------ |
| `TOPIC_EVENT_PROCESS` → publish | `bms.events` exchange, routing `event.received.<platform>`   | A      |
| subscription `event-process-*`  | queue `event-process.event.received.<platform>` (bind)       | B      |
| `TOPIC_LEAD_RECEIVE`            | `bms.leads` exchange, routing `lead.received.<source>`       | A      |
| `TOPIC_CAMPAIGN_*`              | `bms.campaigns` exchange, routing `campaign.<action>`        | A/B    |
| `TOPIC_TRIGGER_*`               | `bms.triggers` exchange, routing `trigger.<channel>.<event>` | A/B    |

Referência completa: `_evo-output/planning-artifacts/amqp-nomenclature-decision.md`.

---

## 5. Checklist de validação local (por app)

- [ ] `pnpm install` na raiz: lockfile atualizado, sem `ERR_PNPM_OUTDATED_LOCKFILE`.
- [ ] `pnpm --filter <app> lint` passa.
- [ ] `pnpm --filter <app> type-check` passa.
- [ ] `pnpm --filter <app> test` passa (todos os specs atualizados).
- [ ] `pnpm --filter <app> build` passa; `dist/main.js` presente.
- [ ] `docker compose up rabbitmq -d` → healthcheck green em <20s.
- [ ] Roundtrip dev: `pnpm dev` + `curl` publish → consumer logga recepção.
- [ ] DLQ válido: flag de erro forçado → msg aparece em `<queue>.dlq` com `x-bms-attempt={maxRetries}`, `x-bms-first-error`, `x-bms-last-error`.
- [ ] Graceful shutdown: SIGTERM → exit 0 em <15s, sem `PublisherClosedError`.
- [ ] Dockerfile end-to-end: `docker build` exit 0 + `docker run` inicia + roundtrip.
- [ ] Uma queue por routing key alvo (**wildcards proibidos em v0.1.0** — `nomenclature-decision.md:69`). Se o app precisa de N routing keys, declarar N queues com `AmqpConsumer` próprios.

---

## 6. Troubleshooting

| Sintoma                                                                 | Causa                                                                                                  | Fix                                                                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ECONNREFUSED` no handler da bridge, attempt 1                          | consumer arrancou antes de `app.listen()`                                                              | mover `consumer.start()` em `main.ts` para DEPOIS de `await app.listen()`                                                                                                      |
| `PublisherClosedError` durante shutdown                                 | ordem errada — `app.close()` destruiu o publisher antes do consumer drenar                             | handler SIGTERM manual em `main.ts` com ordem explícita (consumer → publisher → app → exit)                                                                                    |
| Msg silenciada (sem log no consumer, queue vazia)                       | publish pra routing key sem binding → topic exchange drop silencioso                                   | adicionar binding (bind queue antes de publicar) OU verificar routing key exata (sanitização pode ter transformado em `unknown`)                                               |
| DLQ acumulando                                                          | handler throw constante — retries esgotados                                                            | logar `x-bms-first-error` / `x-bms-last-error` da DLQ; fix handler e redeclarar bind                                                                                           |
| Docker build `Cannot find package @bms/messaging`                       | node_modules não hoisted no deploy stage OU falta do `COPY packages/messaging/` em build stage         | verificar Dockerfile tem `COPY packages/messaging/ ./packages/messaging/` em build e `--filter <app>...` (três pontos) em deps                                                 |
| Docker build `ERR_PNPM_OUTDATED_LOCKFILE`                               | mexeu no package.json do app e não regenerou `pnpm-lock.yaml`                                          | `pnpm install` na raiz + commit do lockfile                                                                                                                                    |
| Docker build `lefthook: command not found`                              | root `prepare: lefthook install` rodou no install e o binário não existe na imagem                     | `RUN pnpm pkg delete scripts.prepare` em base stage (antes do `pnpm install`)                                                                                                  |
| Msg em DLQ com header `x-bms-parse-error` preenchido                    | payload publicado não é JSON válido (binário ou contentType errado)                                    | verificar que o publisher serializa com `JSON.stringify` (a lib faz automaticamente); inspecionar `x-bms-parse-error` na management UI                                         |
| Handler retorna 4xx (≠429) mas nenhum log de warn aparece               | lib faz **ack silencioso** em 4xx≠429 (diverge de `nomenclature-decision.md:199` que promete log warn) | emitir `console.warn` dentro do handler HTTP antes de retornar 4xx se quiser trace; ajustar a lib é escopo futuro                                                              |
| Docker build `Cannot find extended config @retention/typescript-config` | `packages/typescript-config/` não foi copiado nos stages deps/build                                    | adicionar `COPY packages/typescript-config/package.json ./packages/typescript-config/` em `deps` + `COPY packages/typescript-config/` em `build` — ver §2 Diff 2 (regra geral) |

---

## 7. Known limitations & gotchas

> **Nota de numeração:** os `F-numbers` rastreiam findings do adversarial review da tech-spec (`_evo-output/.../tech-spec-evo-943-piloto-event-receiver.md`). Gaps (F2, F4-F8, F14-F15, F17-F18) são findings endereçados na fase de planejamento — não são limitações runtime. Mantidos para rastreabilidade.

- **F1 — `AppController` (event-receiver) descarta `statusCode`:** `apps/event-receiver/src/app.controller.ts` L10-13 retorna `{response: 'ok'}` ignorando o valor de retorno de `handleMessage`. Path `{statusCode: 422, response: 'Empty body'}` é dead code. O piloto **preserva literal**; fix é issue separada post-piloto.
- **F9 — Cold-start warmup descartável:** warmup no `onModuleInit` publica 1 msg em `event.received.warmup.ignore` no startup (sem consumer bind → broker descarta). Aparece em métricas de publish rate sem evento real. Futuro: `warmup()` nativo em `@bms/messaging`.
- **F10 — Headers não-string/number silenciosamente descartados em prod:** `customAttributes` com objetos/booleans não vão pro AMQP. Log em dev pra visibilidade; prod silente.
- **F11 — Topic exchange drop silencioso:** publish sem `mandatory: true` pra routing key sem binding **não retorna erro**. Rotas novas precisam consumer explícito antes do tráfego real, senão vazamento invisível.
- **F13 — Token default prod guard:** Padrão B scaffold refuse-to-boot com `NODE_ENV=production` + `INTERNAL_AUTH_TOKEN=dev-probe-token`. Obrigatório em todos os 12 apps.
- **F16 — Turbo pipeline:** verificar via `pnpm turbo run test --filter=<app> --dry=json` que o novo workspace é picked up pelas tasks (build, test, lint, type-check).
- **F19 — Webhooks path-based:** callers legados em `POST /webhooks/sendgrid` sem `?platform=sendgrid` caem em `event.received.unknown`. Fase 3 decide: normalizar URLs upstream ou aceitar wildcard via bindings múltiplos no consumer.
- **F20 — Boundary `maxRetries`:** `maxRetries: 0` dispara DLQ já na primeira falha (condição é `attempt >= maxRetries`, attempt começa em 1). Use `maxRetries: 1` para "tenta uma vez, depois DLQ"; mínimo útil de retry real é 2. Documentar explícito se alguém configurar `maxRetries < 2`.
- **F21 — Force-close exit 1:** quando `Consumer.shutdown()` excede `shutdownTimeoutMs`, a lib força close da connection (msgs in-flight voltam pra queue como `unacked → ready`) e o processo sai com exit 1. Handler **tem que ser idempotente** — msgs são redelivered após restart. Documentado em `nomenclature-decision.md:172`.
- **F22 — Retry republish silencioso:** durante retry, `AmqpConsumer` já deu ack na msg original antes de agendar o republish; se o canal cair no meio, a msg é **perdida** (swallowed por design; tradeoff consumer-local vs retry-queue dedicada). Handler crítico deve ser reentrante/idempotente.
- **F23 — AC#2 "métrica emitida" (EVO-943):** a AC da issue exige "msg na DLQ + métrica emitida". Em v0.1.0 **métrica = headers DLQ (`x-bms-attempt`, `x-bms-first-error`, `x-bms-last-error`) + logs estruturados do consumer**. Não há counter prom-client nativo ainda. Rastreio pra v0.2.x: emissor de métricas (Prometheus/OTel) em `@bms/messaging` no path DLQ. Enquanto isso, dashboards/alerts consomem headers via logs ou management API do RabbitMQ. Decisão travada 2026-04-24 no code review da PR #3.

---

## 8. Referências

- **Spec do piloto:** `_evo-output/implementation-artifacts/evo-943-piloto-event-receiver/tech-spec-evo-943-piloto-event-receiver.md`
- **Nomenclatura AMQP (travada):** `_evo-output/planning-artifacts/amqp-nomenclature-decision.md`
- **Implementation plan da lib:** `_evo-output/planning-artifacts/amqp-implementation-plan.md`
- **Lib README:** `packages/messaging/README.md`
- **Piloto Padrão A:** `apps/event-receiver/`
- **Piloto Padrão B:** `apps/event-receiver-probe/`
- **Screenshots DLQ validation:** anexar no PR EVO-943 antes do merge.
