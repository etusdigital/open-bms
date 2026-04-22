# Migration Pattern: Pub/Sub → `@bms/messaging` [C]

**Status:** Canonical (`[C]`) — piloto `event-receiver` + `event-receiver-probe` (EVO-943, 2026-04-22).
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
| `campaign-packer`                | consome `bms.campaigns` + publica `bms.triggers`               | **híbrido** (A + B)                     | Publisher + Consumer na mesma app.                                               |
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
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter <app-name>...      # ... inclui workspace deps

FROM deps AS build
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
    await this.warmup();
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

### Diff 7 — `src/main.ts` (graceful shutdown manual)

```ts
const shutdown = async (signal: string) => {
  console.log(`[bootstrap] received ${signal}, shutting down`);
  try {
    const publisher = app.get(EventPublisherService);
    await publisher.close();
  } catch (err) {
    console.error('[bootstrap] publisher close failed:', err);
  }
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
await app.listen(process.env.PORT || 3011, '0.0.0.0');
```

**Crítico:** NÃO confiar em cascata `OnModuleDestroy` do Nest — providers são destruídos em paralelo, sem ordem garantida. `PublisherClosedError` durante shutdown = ordem errada. Handler manual resolve.

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

### Diff-chave 1 — `src/main.ts` (prod guard + consumer timing)

```ts
async function bootstrap() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.INTERNAL_AUTH_TOKEN === 'dev-probe-token'
  ) {
    throw new Error('[probe] refuse to boot with default INTERNAL_AUTH_TOKEN in production');
  }
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1048576 }),
  );
  await app.listen(process.env.PORT || 3012, '0.0.0.0');

  // Consumer start APÓS Fastify bind — senão attempt 1 bate ECONNREFUSED no HTTP bridge.
  const consumer = app.get(ProbeConsumerService);
  await consumer.start();

  const shutdown = async (signal: string) => {
    try {
      await consumer.stop();
    } catch (err) {
      console.error('[probe] consumer stop failed:', err);
    }
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
```

**Pontos críticos:**

- `onApplicationBootstrap` hook do Nest **dispara antes** de `app.listen()`. Se o consumer arrancar nele, mensagem em fila de antes é entregue pro handler bridge → `fetch('http://localhost:PORT/...')` → `ECONNREFUSED` → queima attempt 1 à toa.
- Prod guard: **refuse-to-boot** com `NODE_ENV=production` + `INTERNAL_AUTH_TOKEN=dev-probe-token`. Impede copy-paste backdoor nos 12 apps.

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

- `shutdownTimeoutMs: 10_000` sobrescreve o default de 30s da lib — encaixa no K8s grace.
- `maxRetries: 3` → delays 2s (attempt 1→2) + 4s (attempt 2→3) = ~6s de retries + handler latency antes de DLQ.
- Convenção queue name: `<serviço>.<routing-key>` — permite múltiplos apps bindados no mesmo routing key sem colisão.

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

---

## 6. Troubleshooting (os 7 erros comuns)

| Sintoma                                           | Causa                                                                                          | Fix                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ECONNREFUSED` no handler da bridge, attempt 1    | consumer arrancou antes de `app.listen()`                                                      | mover `consumer.start()` em `main.ts` para DEPOIS de `await app.listen()`                                                        |
| `PublisherClosedError` durante shutdown           | ordem errada — `app.close()` destruiu o publisher antes do consumer drenar                     | handler SIGTERM manual em `main.ts` com ordem explícita (consumer → publisher → app → exit)                                      |
| Msg silenciada (sem log no consumer, queue vazia) | publish pra routing key sem binding → topic exchange drop silencioso                           | adicionar binding (bind queue antes de publicar) OU verificar routing key exata (sanitização pode ter transformado em `unknown`) |
| DLQ acumulando                                    | handler throw constante — retries esgotados                                                    | logar `x-bms-first-error` / `x-bms-last-error` da DLQ; fix handler e redeclarar bind                                             |
| Docker build `Cannot find package @bms/messaging` | node_modules não hoisted no deploy stage OU falta do `COPY packages/messaging/` em build stage | verificar Dockerfile tem `COPY packages/messaging/ ./packages/messaging/` em build e `--filter <app>...` (três pontos) em deps   |
| Docker build `ERR_PNPM_OUTDATED_LOCKFILE`         | mexeu no package.json do app e não regenerou `pnpm-lock.yaml`                                  | `pnpm install` na raiz + commit do lockfile                                                                                      |
| Docker build `lefthook: command not found`        | root `prepare: lefthook install` rodou no install e o binário não existe na imagem             | `RUN pnpm pkg delete scripts.prepare` em base stage (antes do `pnpm install`)                                                    |

---

## 7. Known limitations & gotchas

- **F1 — `AppController` (event-receiver) descarta `statusCode`:** `apps/event-receiver/src/app.controller.ts` L10-13 retorna `{response: 'ok'}` ignorando o valor de retorno de `handleMessage`. Path `{statusCode: 422, response: 'Empty body'}` é dead code. O piloto **preserva literal**; fix é issue separada post-piloto.
- **F3 — Platform inválido vira `unknown`:** strings fora do allowlist caem em `event.received.unknown`. Adicionar plataforma nova exige PR na lib + binding de queue.
- **F9 — Cold-start warmup descartável:** warmup no `onModuleInit` publica 1 msg em `event.received.warmup.ignore` no startup (sem consumer bind → broker descarta). Aparece em métricas de publish rate sem evento real. Futuro: `warmup()` nativo em `@bms/messaging`.
- **F10 — Headers não-string/number silenciosamente descartados em prod:** `customAttributes` com objetos/booleans não vão pro AMQP. Log em dev pra visibilidade; prod silente.
- **F11 — Topic exchange drop silencioso:** publish sem `mandatory: true` pra routing key sem binding **não retorna erro**. Rotas novas precisam consumer explícito antes do tráfego real, senão vazamento invisível.
- **F12 — Shutdown manual em `main.ts`:** Nest `app.close()` chama providers em paralelo — não confiável pra ordem consumer→publisher. Padrão canônico: handler SIGTERM/SIGINT manual.
- **F13 — Token default prod guard:** Padrão B scaffold refuse-to-boot com `NODE_ENV=production` + `INTERNAL_AUTH_TOKEN=dev-probe-token`. Obrigatório em todos os 12 apps.
- **F16 — Turbo pipeline:** verificar via `pnpm turbo run test --filter=<app> --dry=json` que o novo workspace é picked up pelas tasks (build, test, lint, type-check).
- **F19 — Webhooks path-based:** callers legados em `POST /webhooks/sendgrid` sem `?platform=sendgrid` caem em `event.received.unknown`. Fase 3 decide: normalizar URLs upstream ou aceitar wildcard via bindings múltiplos no consumer.

---

## 8. Referências

- **Spec do piloto:** `_evo-output/implementation-artifacts/evo-943-piloto-event-receiver/tech-spec-evo-943-piloto-event-receiver.md`
- **Nomenclatura AMQP (travada):** `_evo-output/planning-artifacts/amqp-nomenclature-decision.md`
- **Implementation plan da lib:** `_evo-output/planning-artifacts/amqp-implementation-plan.md`
- **Lib README:** `packages/messaging/README.md`
- **Piloto Padrão A:** `apps/event-receiver/`
- **Piloto Padrão B:** `apps/event-receiver-probe/`
- **Screenshots DLQ validation:** anexar no PR EVO-943 antes do merge.
