# Testando o fluxo de Email Providers (EVO-1029)

Guia passo-a-passo pra testar o sistema multi-provider end-to-end:
configurar credenciais, escolher provider por conta, disparar envio,
receber webhook e verificar persistência. Pareado com
[`docs/email-providers.md`](./email-providers.md), que tem a referência
de arquitetura.

> **Importante:** o EVO-1029 entregou só a camada de API. **Não tem UI**
> pra trocar provider — isso é out of scope, ticket separado. Tudo aqui
> é via curl/SQL/dashboards de provider.

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Modelo mental — como a escolha funciona](#2-modelo-mental--como-a-escolha-funciona)
3. [Smoke test do boot](#3-smoke-test-do-boot)
4. [Configurar credenciais do provider (super_admin)](#4-configurar-credenciais-do-provider-super_admin)
5. [Escolher o provider para uma conta](#5-escolher-o-provider-para-uma-conta)
6. [Disparar envio de teste](#6-disparar-envio-de-teste)
7. [Receber webhook de eventos](#7-receber-webhook-de-eventos)
8. [Verificar persistência (Postgres + ClickHouse)](#8-verificar-persistência-postgres--clickhouse)
9. [Walkthrough completo provider-a-provider](#9-walkthrough-completo-provider-a-provider)
10. [Troubleshooting](#10-troubleshooting)
11. [O que NÃO está coberto](#11-o-que-não-está-coberto)

---

## 1. Pré-requisitos

Pra rodar o fluxo completo localmente você precisa:

| Componente                                | Pra que serve                                            | Como subir                                                   |
| ----------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| **PostgreSQL**                            | Persistência de contatos, accounts, system_config        | `docker compose up postgres` (ou subset do compose.yml)      |
| **Redis**                                 | Dedup de eventos, cache, rate-limit                      | `docker compose up redis`                                    |
| **RabbitMQ**                              | Mensageria entre msgops-api → send-email → event-process | `docker compose up rabbitmq`                                 |
| **ClickHouse**                            | Logs analíticos de eventos (events_logs_v2)              | `docker compose up clickhouse` (opcional pra smoke test)     |
| **msgops-api**                            | API admin + REST                                         | `pnpm --filter ./apps/msgops-api dev`                        |
| **send-email**                            | Consumer AMQP que dispara emails                         | `pnpm --filter ./apps/send-email dev`                        |
| **event-process**                         | Receiver dos webhooks dos providers                      | `pnpm --filter ./apps/event-process dev`                     |
| **Conta válida em pelo menos 1 provider** | Pra testar envio real                                    | Cadastro free em sparkpost.com / mailersend.com / resend.com |
| **Email de teste**                        | Inbox real pra receber + abrir/clicar                    | Gmail/Outlook que você acessa                                |

Variáveis de ambiente mínimas no `.env` raiz:

```bash
# Auth
INTERNAL_AUTH_TOKEN=dev-token-change-me
JWT_SECRET=dev-jwt-secret
BOOTSTRAP_ADMIN_EMAIL=admin@local.test
BOOTSTRAP_ADMIN_PASSWORD=ChangeMe123!

# Postgres / Redis / RabbitMQ — conforme seu compose
DATABASE_URL=...
REDIS_URL=...
AMQP_URL=...

# Email providers (deixe vazias por enquanto — vamos setar via admin API)
# As envs WEBHOOK_* devem estar UNSET pra dev (bypassa validação de assinatura)
```

> **Atenção:** se você setar `MAILERSEND_WEBHOOK_SIGNING_SECRET`,
> `RESEND_WEBHOOK_SIGNING_SECRET`, `SPARKPOST_WEBHOOK_USER`,
> `MANDRILL_WEBHOOK_KEY`, ou `AWS_SES_WEBHOOK_SNS_TOPIC_ARN`, a
> validação de assinatura **vai exigir** os headers corretos no webhook.
> Em dev local sem ngrok com certificado, deixe **unset** pra simplificar.

---

## 2. Modelo mental — como a escolha funciona

Existem **3 camadas independentes**:

### Camada A — Credenciais do provider (system-wide, super_admin)

Onde o BMS guarda a chave da API que ele usa pra falar com o provider:

```
super_admin → PUT /admin/integrations/<provider>/settings
                ↓
              system_config table (chave: <provider>_system_settings)
                ↓
              Reescreve env file (apps/msgops-api OnModuleInit)
                ↓
              send-email lê do env quando resolve a chave
```

### Camada B — Provider escolhido pela conta (per-account)

Cada conta operadora aponta qual provider o BMS usa quando envia em nome dela:

```
operador da conta → PUT /accounts/config/default_email_provider
                       ↓
                     accounts_configs (account_id, name='default_email_provider', value='mailersend')
                       ↓
                     EmailProviderRouter.resolveForMessage() lê isso a cada mensagem
```

### Camada C — Resolução em runtime (a cada email)

Quando o `send-email` recebe uma mensagem AMQP pra enviar, o
`EmailProviderRouter` decide assim:

```typescript
// apps/send-email/src/handlers/email-provider.router.ts
1. account.accountConfigs.default_email_provider ?
   → SIM: usa esse provider (lança erro se inválido)
   → NÃO: vai pro fallback abaixo
2. message.ippool contém 'sparkpost'?
   → SIM: usa sparkpost (compatibilidade com config legada)
   → NÃO: vai pro próximo
3. process.env.DEFAULT_EMAIL_PROVIDER setado?
   → SIM: usa esse
   → NÃO: 'sendgrid' (último fallback hardcoded)
```

E pra resolver a **chave** que o provider usa:

```
1. account.accountConfigs.<provider>_key ?
   → SIM: usa essa chave (tenant tem credencial própria)
   → NÃO: process.env.<PROVIDER>_API_KEY
```

> Pra SES, são 3 chaves: `ses_access_key_id`, `ses_secret_access_key`, `ses_region`.
> Fallback: `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_SES_REGION`.

---

## 3. Smoke test do boot

Antes de qualquer coisa, garanta que o `send-email` registra os 6 providers
no boot. Sem isso, o resto não funciona.

```bash
pnpm --filter ./apps/send-email dev
```

Procure essa linha no log (pode demorar uns segundos depois do boot):

```
[Nest] LOG [EmailProvidersModule] EmailProviderRegistry: 6 providers registered — sparkpost(free=true,webhook=true), sendgrid(free=true,webhook=true), mailersend(free=true,webhook=true), resend(free=true,webhook=true), ses(free=false,webhook=true), mandrill(free=false,webhook=true)
```

**Se aparecer com menos de 6 providers** → erro de DI. Verifique
`apps/send-email/src/handlers/email-providers.module.ts`.

**Se o boot falhar com `EmailProviderEligibilityError`** → algum provider
está retornando `hasWebhook: false` no `getMetadata()`. Esse é o gate
funcionando — corrija o handler.

---

## 4. Configurar credenciais do provider (super_admin)

Login como super_admin (criado pelo `BOOTSTRAP_ADMIN_EMAIL`/`_PASSWORD`):

```bash
# Login (POST /auth/login retorna cookie httpOnly)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local.test","password":"ChangeMe123!"}' \
  -c cookies.txt
```

Agora configure cada provider que você quer usar (não precisa todos —
só os que vai testar). **Use a chave free tier real** do dashboard.

### MailerSend (recomendado pra começar — 3000/mês free)

```bash
curl -X PUT http://localhost:3000/admin/integrations/mailersend/settings \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "mlsn.SUA-CHAVE-DO-DASHBOARD-MAILERSEND",
    "webhookSigningSecret": "deixe-vazio-em-dev-ou-cole-do-dashboard"
  }'
```

Resposta esperada (chave mascarada):

```json
{
  "apiKeyMasked": "mlsn.******************************************",
  "metadata": {
    "hasFreeTier": true,
    "hasWebhook": true,
    "notes": "3000 emails/mês perpétuo (verificado 2026-05)"
  }
}
```

Validar que a chave funciona (faz GET `/v1/me` na MailerSend):

```bash
curl -X POST http://localhost:3000/admin/integrations/mailersend/test-connection \
  -b cookies.txt -H "Content-Type: application/json" \
  -d '{ "apiKey": "mlsn.SUA-CHAVE" }'
# Esperado: { "ok": true }
```

### Outros providers (mesmo formato, payloads diferentes)

| Provider       | Endpoint                                      | Body mínimo                                                                     |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| **SparkPost**  | `PUT /admin/integrations/sparkpost/settings`  | `{ "apiKey": "..." }`                                                           |
| **SendGrid**   | `PUT /admin/integrations/sendgrid/settings`   | `{ "apiKey": "SG...." }`                                                        |
| **MailerSend** | `PUT /admin/integrations/mailersend/settings` | `{ "apiKey": "mlsn...." }`                                                      |
| **Resend**     | `PUT /admin/integrations/resend/settings`     | `{ "apiKey": "re_...." }`                                                       |
| **Amazon SES** | `PUT /admin/integrations/ses/settings`        | `{ "accessKeyId": "AKIA...", "secretAccessKey": "...", "region": "us-east-1" }` |
| **Mandrill**   | `PUT /admin/integrations/mandrill/settings`   | `{ "apiKey": "..." }`                                                           |

> **Rate limit:** `test-connection` é limitado a 5 hits/min por IP.
> Se ver `429 Too Many Requests`, espere 1 minuto.

---

## 5. Escolher o provider para uma conta

Logue como **operador da conta** que você quer testar (não super_admin
— a config é per-account). Depois:

```bash
curl -X PUT http://localhost:3000/accounts/config/default_email_provider \
  -b cookies-da-conta.txt \
  -H "Content-Type: application/json" \
  -d '{ "value": "mailersend" }'
```

> Valores aceitos: `sparkpost`, `sendgrid`, `mailersend`, `resend`, `ses`, `mandrill`.
> Qualquer outra string vai resultar em erro do router quando o
> primeiro envio acontecer.

### Verificar que pegou

```bash
curl http://localhost:3000/accounts/config/default_email_provider \
  -b cookies-da-conta.txt
# Esperado: { "value": "mailersend", ... }
```

Ou via SQL direto no Postgres:

```sql
SELECT name, value FROM accounts_configs
WHERE account_id = <ID-DA-SUA-CONTA>
  AND name = 'default_email_provider';
```

### Opcional: chave de provider por conta

Se a conta tem chave própria (em vez da system-wide configurada na seção 4):

```bash
curl -X PUT http://localhost:3000/accounts/config/mailersend_key \
  -b cookies-da-conta.txt \
  -H "Content-Type: application/json" \
  -d '{ "value": "mlsn.CHAVE-ESPECIFICA-DESSA-CONTA" }'
```

A chave per-account **prevalece** sobre a system-wide.

---

## 6. Disparar envio de teste

Aqui depende de como sua conta normalmente envia emails. As opções:

### Opção A — Via fluxo existente de campaign/automation

Use o frontend Vue 2 ou React pra criar campanha/automação e dispará-la
pra um destinatário de teste (você mesmo). O `send-email` consumer vai
pegar a mensagem AMQP e o `EmailProviderRouter` vai escolher o provider
configurado.

### Opção B — Publicar mensagem AMQP manualmente (sem UI)

Pra teste isolado do roteamento, publique direto na exchange `email`
do RabbitMQ:

```js
// scripts/publish-test-email.js (criar você mesmo)
const amqp = require('amqplib');

(async () => {
  const conn = await amqp.connect(process.env.AMQP_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange('email', 'topic', { durable: true });

  const message = {
    messageId: `test-${Date.now()}`,
    startedAt: Date.now(),
    automationType: 'transactional',
    contact: {
      id: 1,
      email: 'seu-email-real@gmail.com',
      firstName: 'Test',
      isValid: true,
      uuid: 'test-uuid',
    },
    message: {
      id: 1,
      title: 'Test Email',
      name: 'test-email',
      ippool: 'default',
      subject: 'Teste EVO-1029 Provider Switching',
      content: '<p>Hello from BMS! Provider: <strong>{{provider}}</strong></p>',
      from: { firstName: 'BMS Test', email: 'noreply@seudominio.com' },
    },
    account: {
      id: 1, // ID da conta com default_email_provider configurado
      name: 'Test Account',
      accountConfigs: [], // será populado pelo consumer ao buscar a conta
    },
  };

  ch.publish('email', 'email.send', Buffer.from(JSON.stringify(message)));
  console.log('Mensagem publicada');
  setTimeout(() => process.exit(0), 1000);
})();
```

```bash
node scripts/publish-test-email.js
```

### O que deve acontecer

No log do `send-email`:

```
[send-email] Resolving provider for account 1: mailersend
[send-email] Sent via mailersend, response: { statusCode: 202, headers: { x-message-id: '...' } }
```

E o email cai na sua inbox em segundos.

---

## 7. Receber webhook de eventos

Pra que o BMS atualize o `last_open` / `has_bounced` / etc. dos contatos,
o provider precisa enviar webhooks de volta. Setup é manual em cada
dashboard.

### Expor o event-process publicamente (dev)

Em produção `event-process` já está atrás de um LB. Em dev, use
[ngrok](https://ngrok.com):

```bash
ngrok http 3001  # ou a porta do event-process
# anota a URL: https://abc123.ngrok-free.app
```

### Configurar webhook no dashboard do provider

Para cada provider, criar webhook apontando pra:

```
https://<seu-ngrok-ou-host-publico>/internal/event/<provider>
```

Adicionar header (onde o dashboard permitir):

```
x-internal-token: <valor-do-INTERNAL_AUTH_TOKEN-do-seu-env>
```

Detalhes provider-a-provider (incluindo signing secret) em
[`docs/email-providers.md`](./email-providers.md#setup-de-webhooks-externos).

### Atalho — webhooks em dev sem dashboard

Pra testar só o pipeline interno (`event-process` → Postgres + ClickHouse),
sem precisar configurar webhook no provider real, faça `curl` direto:

```bash
# Exemplo MailerSend
curl -X POST http://localhost:3001/internal/event/mailersend \
  -H "x-internal-token: dev-token-change-me" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "activity.opened",
    "created_at": '"$(date +%s)"',
    "webhook_id": "test-evt-1",
    "data": {
      "id": "test-msg-1",
      "email": {
        "id": "test-msg-1",
        "recipient": { "email": "seu-email-real@gmail.com" },
        "tags": ["account_1", "message_1", "type_campaign", "campaign_99", "contactId_1"]
      },
      "morph": { "ip": "8.8.8.8", "user_agent": "Mozilla/5.0 Test" }
    }
  }'
```

Se `MAILERSEND_WEBHOOK_SIGNING_SECRET` estiver setada no env, este curl
vai retornar **401 Unauthorized** (precisa do header `signature` com HMAC
correto). Pra dev rápido, **não setar a env** — bypassa a validação.

### Curl equivalente para cada provider (dev mode, sem signature)

```bash
# SparkPost (envelope SNS-style)
curl -X POST http://localhost:3001/internal/event/sparkpost \
  -H "x-internal-token: dev-token-change-me" -H "Content-Type: application/json" \
  -d '[{"msys":{"track_event":{"type":"open","event_id":"sp-1","timestamp":1735000000,"rcpt_to":"seu@gmail.com","rcpt_meta":{"account":"1","message":"1","contactId":"1"},"message_id":"sp-msg-1","ip_address":"8.8.8.8","user_agent":"Mozilla/5.0"}}}]'

# SendGrid (já existia antes do EVO-1029)
curl -X POST http://localhost:3001/internal/event/sendgrid \
  -H "x-internal-token: dev-token-change-me" -H "Content-Type: application/json" \
  -d '{"payload":[{"email":"seu@gmail.com","timestamp":1735000000,"event":"open","category":["account:1","message:1","contactId:1"],"sg_event_id":"sg-1","sg_message_id":"sg-msg-1"}],"platform":"sendgrid","account":"acct1"}'

# Resend (Svix-like, mas sem assinatura em dev)
curl -X POST http://localhost:3001/internal/event/resend \
  -H "x-internal-token: dev-token-change-me" -H "Content-Type: application/json" \
  -d '{"type":"email.opened","created_at":"2026-05-07T12:00:00Z","data":{"email_id":"re-msg-1","to":["seu@gmail.com"],"open":{"ipAddress":"8.8.8.8","userAgent":"Mozilla/5.0"},"tags":[{"name":"account","value":"1"},{"name":"message","value":"1"},{"name":"contactId","value":"1"}]}}'

# Mandrill (form-urlencoded com mandrill_events=<JSON>)
curl -X POST http://localhost:3001/internal/event/mandrill \
  -H "x-internal-token: dev-token-change-me" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode 'mandrill_events=[{"event":"open","ts":1735000000,"msg":{"_id":"md-msg-1","email":"seu@gmail.com","metadata":{"account":"1","message":"1","contactId":"1"}},"ip":"8.8.8.8","user_agent":"Mozilla/5.0"}]'

# Amazon SES (envelope SNS Notification)
curl -X POST http://localhost:3001/internal/event/ses \
  -H "x-internal-token: dev-token-change-me" -H "Content-Type: application/json" \
  -d '{"Type":"Notification","MessageId":"ses-evt-1","Timestamp":"2026-05-07T12:00:00Z","Message":"{\"eventType\":\"Open\",\"mail\":{\"timestamp\":\"2026-05-07T12:00:00Z\",\"messageId\":\"ses-msg-1\",\"destination\":[\"seu@gmail.com\"],\"tags\":{\"account\":[\"1\"],\"message\":[\"1\"],\"contactId\":[\"1\"]}},\"open\":{\"ipAddress\":\"8.8.8.8\",\"userAgent\":\"Mozilla/5.0\",\"timestamp\":\"2026-05-07T12:00:00Z\"}}","SignatureVersion":"1","Signature":"fake","SigningCertURL":"https://sns.us-east-1.amazonaws.com/cert.pem"}'
```

> Esses curls **só funcionam em dev** com `AWS_SES_WEBHOOK_VALIDATE=false`
> ou env unset pra cada provider. Em produção a verificação de assinatura
> rejeita payloads forjados (qual é o ponto).

---

## 8. Verificar persistência (Postgres + ClickHouse)

Depois de simular um evento `open`, confira:

### Postgres (contato atualizado)

```sql
SELECT id, email, last_sent, last_open, last_click, has_bounced, is_unsubscribed
FROM contacts
WHERE account_id = 1
  AND email = 'seu-email-real@gmail.com';
```

Esperado: `last_open` e `last_click` ≠ `NULL`, com timestamp recente.

### ClickHouse (log analítico)

```sql
SELECT time, account_id, contact_id, message_id, event, provider, ip
FROM events_logs_v2
WHERE account_id = 1
  AND email = 'seu-email-real@gmail.com'
ORDER BY time DESC LIMIT 10;
```

Esperado: linhas com `provider = 'mailersend'` (ou o provider que você
testou), `event = 'open'`, IP/UA preenchidos.

### Redis (statistics + dedup)

```bash
redis-cli
> KEYS "statistics:1:*"
> HGETALL "statistics:1:2026-05-07:email:campaign:99:1"
# Deve mostrar contadores: open=1, etc.

> KEYS "event:mailersend:*"
# Mostra os event_ids que foram dedupados (TTL 10min)
```

### Idempotency

Se você rodar o mesmo curl 2x consecutivos, o segundo deve retornar:

```json
{ "status": "skipped", "message": "Message already processed" }
```

Isso prova que o `processWithIdempotency` está funcionando (chave SHA-256
do payload em `event-process:processed_message:<hash>` no Redis).

---

## 9. Walkthrough completo provider-a-provider

Receita única, seguir 1x por provider que quiser ativar:

### MailerSend (mais simples — recomendado começar por aqui)

1. Cadastro free em https://www.mailersend.com
2. Verificar domínio (ou usar `*.mailersend.net` pra teste)
3. Criar API token em **Domains → Manage → API tokens**
4. `PUT /admin/integrations/mailersend/settings` com a chave
5. `POST /admin/integrations/mailersend/test-connection` → esperar `ok: true`
6. `PUT /accounts/config/default_email_provider` → `{ value: 'mailersend' }`
7. Disparar email pela campaign UI
8. Verificar inbox
9. **Webhook:** Activity → Webhooks → URL `https://<ngrok>/internal/event/mailersend`
10. Abrir o email → ver `last_open` no Postgres

### Resend

Igual MailerSend, dashboard em https://resend.com. Webhook é via Svix.

### SparkPost

1. Cadastro em https://www.sparkpost.com (500 emails/mês free)
2. **Account → API Keys** → criar nova
3. `PUT /admin/integrations/sparkpost/settings`
4. **Webhooks:** _Account → Webhooks → New Webhook_, autenticação Basic Auth
   (setar `SPARKPOST_WEBHOOK_USER` + `SPARKPOST_WEBHOOK_PASS` no env do
   event-process e usar os mesmos no dashboard)

### Amazon SES (mais complicado — opcional)

1. Conta AWS + IAM user com policy `AmazonSESFullAccess` (mínimo)
2. Verificar identidade (domain ou email)
3. **Saindo do sandbox**: solicitar acesso de produção pelo Support
4. Configurar **Configuration Set** com **Event Destination** apontando
   pra um SNS topic
5. Criar SNS subscription **HTTPS** → URL `https://<ngrok>/internal/event/ses`
6. Confirmar assinatura: na primeira request, log do event-process mostra
   `SubscribeURL=...` → `curl <SubscribeURL>` manualmente
7. `PUT /admin/integrations/ses/settings` com `accessKeyId`/`secretAccessKey`/`region`
8. Setar `AWS_SES_WEBHOOK_SNS_TOPIC_ARN` no env (allowlist)

### Mandrill (não recomendado salvo se cliente exige)

1. Conta MailChimp Transactional (paga, $20/25k blocks)
2. **Settings → API Keys**
3. `PUT /admin/integrations/mandrill/settings`
4. **Settings → Webhooks** → URL + copiar webhook key
5. **Crítico:** setar `MANDRILL_WEBHOOK_URL` no env IGUAL à URL do dashboard
   (qualquer divergência — http vs https, trailing slash — quebra HMAC)

---

## 10. Troubleshooting

| Sintoma                                                        | Causa provável                                                            | Fix                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Boot do `send-email` falha com `EmailProviderEligibilityError` | Algum provider tem `hasWebhook: false` no `getMetadata()`                 | Corrigir o handler — ou remover do registry se não tiver webhook mesmo          |
| `400 Bad Request` no `PUT /admin/integrations/.../settings`    | Joi rejeitou o payload (pattern da apiKey, region inválida, etc)          | Olhar response body — mostra qual campo falhou                                  |
| `429 Too Many Requests` no `test-connection`                   | Rate limit (5 hits/min por IP)                                            | Esperar 60s ou trocar IP                                                        |
| Email enviado, mas `provider not found` log                    | `default_email_provider` aponta pra string inválida                       | `PUT /accounts/config/default_email_provider` com valor válido                  |
| Email enviado mas erro 401 do provider                         | Chave inválida ou não setada                                              | `test-connection` primeiro pra validar                                          |
| Webhook chega 401 no `event-process`                           | Header `x-internal-token` faltando ou errado                              | Setar o header com valor de `INTERNAL_AUTH_TOKEN`                               |
| Webhook chega 401 com `Invalid <provider> signature`           | Validação de assinatura ativa mas dados não batem                         | Em dev: unset a env do signing secret. Em prod: verificar dashboard do provider |
| SES webhook fica em loop de `confirmation_pending`             | `SubscriptionConfirmation` não foi confirmada                             | Pegar `SubscribeURL` do log e fazer GET nele manualmente                        |
| Mandrill 401 com signature inválida mas dashboard parece certo | `MANDRILL_WEBHOOK_URL` diverge da URL real (http/https/slash)             | Igualar exatamente                                                              |
| Idempotency retornando `skipped` em todos os requests          | Você mandou o mesmo payload 2x — Redis tem TTL de 1h pro processed marker | Mudar o payload ou esperar 1h ou flush Redis                                    |
| `last_open` no Postgres não atualiza após webhook              | Tags/categorias não mapearam pra `account` + `message` + `contactId`      | Verificar `metadata`/`tags` do email enviado: precisa ter os 3 campos           |

---

## 11. O que NÃO está coberto

Honestidade sobre limites desta entrega (EVO-1029):

| Lacuna                                                                                  | Status                                       | Tracker                                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **UI de super_admin** pra escolher provider default por conta                           | Out of scope explícito                       | Ticket separado (não criado ainda)                                                        |
| **Dashboard cross-provider** de métricas (deliverability, custo)                        | Out of scope                                 | —                                                                                         |
| **Failover automático** (se sparkpost falhar, retry em sendgrid)                        | Out of scope                                 | —                                                                                         |
| **Suporte a Postmark, Brevo, SMTP genérico**                                            | Out of scope                                 | Adicionar via receita em `docs/email-providers.md` §10                                    |
| **Auto-provisioning de webhook no dashboard do provider**                               | Out of scope (cada provider manualmente)     | —                                                                                         |
| **E2E tests automatizados**                                                             | Out of scope (só unit tests)                 | Esse guia substitui — manual                                                              |
| **Métrica de uso por provider** (quantos emails enviados via X)                         | Não implementado                             | ClickHouse já tem coluna `provider`, query manual funciona                                |
| **Migração de contas existentes** (de SparkPost legado pra novo provider)               | Out of scope                                 | `default_email_provider` é opt-in; sem ele, fallback `ippool` mantém comportamento antigo |
| **Notificações operacionais** (Slack alert quando provider rate-limited, quota próxima) | Parcial — só SparkPost subaccount suspension | Phase 2 review fix F4                                                                     |

Pra qualquer uma dessas, abrir issue separada referenciando este doc.
