# Email Providers

Guia operacional dos providers de email plugáveis do BMS. Cobre o critério
de elegibilidade, providers suportados, variáveis de ambiente, configuração
via admin API e setup de webhooks externos.

## Provider Eligibility Gate

**Regra:** o BMS open-source aceita providers que cumpram **dois requisitos
simultâneos**:

1. **Webhook de eventos** — provider envia eventos de delivery/bounce/open/
   click via webhook HTTP. Sem webhook não há como popular o pipeline de
   estatísticas e atualização de contatos.
2. **Tier gratuito** ou **opção comercial declarada** — providers sem free
   perpétuo entram **somente como opcionais**, marcados explicitamente.

A elegibilidade é forçada **em código** pelo `EmailProvidersModule`
(`apps/send-email/src/handlers/email-providers.module.ts`): no boot,
`EmailProviderRegistry.assertWebhookCapable()` lança erro se algum provider
registrado retornar `hasWebhook: false`. Boot falha — não há como deployar
configuração inválida.

## Matriz de providers

| Provider       | `hasFreeTier` | `hasWebhook` | Notas                                                                                                      |
| -------------- | ------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| **SparkPost**  | ✅            | ✅           | 500 emails/mês free dev tier                                                                               |
| **SendGrid**   | ✅            | ✅           | 100 emails/dia perpétuo                                                                                    |
| **MailerSend** | ✅            | ✅           | 3000 emails/mês perpétuo                                                                                   |
| **Resend**     | ✅            | ✅           | 3000/mês ou 100/dia free tier                                                                              |
| **Amazon SES** | ❌            | ✅           | 62000/mês exige rodar em EC2; fora EC2 $0.10/1000                                                          |
| **Mandrill**   | ❌            | ✅           | $20 por bloco de 25k. Tratado como **experimental** (descontinuação anunciada várias vezes pela MailChimp) |

> Quotas verificadas em **2026-05**. Providers com `hasFreeTier: false`
> aparecem com etiqueta correspondente na admin UI e no retorno de
> `GET /admin/integrations/<provider>/settings` (campo `metadata.notes`).

## Variáveis de ambiente

Cada provider tem dois caminhos de configuração:

1. **Per-account** via `account.accountConfigs[<provider>_key]` —
   prevalece sobre env quando setado.
2. **System-level** via `.env` (e/ou bootstrap a partir de
   `system_config` table no boot do admin).

| Provider   | Send-side (apps/send-email)                                              | Webhook-side (apps/event-process)                                                             |
| ---------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| SparkPost  | `SPARKPOST_API_KEY`                                                      | `SPARKPOST_WEBHOOK_USER` + `SPARKPOST_WEBHOOK_PASS`                                           |
| SendGrid   | `SENDGRID_API_KEY`                                                       | (validação interna por `INTERNAL_AUTH_TOKEN`)                                                 |
| MailerSend | `MAILERSEND_API_KEY`                                                     | `MAILERSEND_WEBHOOK_SIGNING_SECRET`                                                           |
| Resend     | `RESEND_API_KEY`                                                         | `RESEND_WEBHOOK_SIGNING_SECRET` (Svix endpoint secret)                                        |
| Amazon SES | `AWS_SES_ACCESS_KEY_ID` + `AWS_SES_SECRET_ACCESS_KEY` + `AWS_SES_REGION` | `AWS_SES_WEBHOOK_SNS_TOPIC_ARN` (allowlist), `AWS_SES_WEBHOOK_VALIDATE=false` para bypass dev |
| Mandrill   | `MANDRILL_API_KEY`                                                       | `MANDRILL_WEBHOOK_KEY` + `MANDRILL_WEBHOOK_URL` (URL canônica usada no HMAC)                  |

**Bypass de validação de webhook em dev:** quando as envs de `_WEBHOOK_*` não
estão setadas, o controller pula a verificação de assinatura. Em produção
**todas devem estar setadas**.

### Seleção do provider por conta

A escolha de qual provider envia os emails de uma conta é feita via:

```sql
-- Em produção, persistido em accounts.account_configs (TypeORM).
INSERT INTO account_configs (account_id, name, value)
VALUES (<accountId>, 'default_email_provider', '<sparkpost|sendgrid|mailersend|resend|ses|mandrill>');
```

`EmailProviderRouter.resolveForMessage(account, message)` faz:

1. Lê `account.accountConfigs.default_email_provider`. Se setado e válido,
   resolve via registry.
2. Se ausente, fallback **legado**: `message.ippool` contendo "sparkpost"
   roteia para SparkPost; senão, env `DEFAULT_EMAIL_PROVIDER`; senão,
   `sendgrid`.
3. Se valor inválido, lança erro listando providers disponíveis.

Chave da API por conta segue o mesmo padrão: `account.accountConfigs[<name>_key]`
(`sparkpost_key`, `sendgrid_key`, `mailersend_key`, `resend_key`,
`ses_access_key_id` + `ses_secret_access_key` + `ses_region`, `mandrill_key`).

## Configuração via admin API

Todas as rotas exigem `@RequireSuperAdmin()`. URLs base:
`<msgops-api>/admin/integrations/<provider>`.

| Method | Path               | Descrição                                                                                |
| ------ | ------------------ | ---------------------------------------------------------------------------------------- |
| `GET`  | `/settings`        | Retorna settings com credenciais mascaradas + `metadata` (hasFreeTier/hasWebhook/notes). |
| `PUT`  | `/settings`        | Persiste credenciais (validação Joi por provider), invalida cache, reescreve env file.   |
| `POST` | `/test-connection` | Smoke test contra a API real do provider. Rate-limited por IP (5 hits/min).              |

### Schemas

```http
PUT /admin/integrations/sparkpost/settings
{ "apiKey": "...", "apiBaseUrl": "...", "webhookUrlBase": "..." }

PUT /admin/integrations/sendgrid/settings
{ "apiKey": "SG....", "apiBaseUrl": "...", "webhookUrlBase": "...", "ipPool": "..." }

PUT /admin/integrations/mailersend/settings
{ "apiKey": "mlsn....", "webhookSigningSecret": "...", "webhookUrlBase": "..." }

PUT /admin/integrations/resend/settings
{ "apiKey": "re_...", "webhookSigningSecret": "whsec_...", "webhookUrlBase": "..." }

PUT /admin/integrations/ses/settings
{ "accessKeyId": "AKIA...", "secretAccessKey": "...", "region": "us-east-1", "webhookSnsTopicArn": "arn:aws:sns:us-east-1:..." }

PUT /admin/integrations/mandrill/settings
{ "apiKey": "...", "webhookKey": "...", "webhookUrlBase": "..." }
```

Validações:

- SendGrid: apiKey inicia com `SG.` e tem ≥10 chars
- MailerSend: apiKey inicia com `mlsn.` e tem ≥30 chars
- Resend: apiKey inicia com `re_` e tem ≥20 chars
- SES: `accessKeyId` matches `^(AKIA|ASIA)[A-Z0-9]{16}$`; `region` na allowlist
  de regions GA do SES (us-east-1, eu-west-1, etc.)
- Mandrill: apiKey ≥16 chars

## Setup de webhooks externos

Em todos os providers o webhook aponta para
`POST https://<event-process-host>/internal/event/<provider>` com header
`x-internal-token: <INTERNAL_AUTH_TOKEN>`. Adicionalmente, cada provider
exige sua **assinatura externa**:

### SparkPost

- Console SparkPost → **Account → Webhooks → New Webhook**
- Target URL: `https://.../internal/event/sparkpost`
- Authentication: **Basic Auth** (`SPARKPOST_WEBHOOK_USER` / `_PASS`)
- Events: marcar todos os relevantes (delivery, bounce, injection,
  out_of_band, policy_rejection, delay, open, click, list_unsubscribe,
  link_unsubscribe, spam_complaint)

### SendGrid

- Console SendGrid → **Settings → Mail Settings → Event Webhook**
- Authorization Method: leave default (we rely on `INTERNAL_AUTH_TOKEN`)
- Events: marcar todos
- HTTP POST URL: `https://.../internal/event/sendgrid`

### MailerSend

- Dashboard MailerSend → **Activity → Webhooks → Add webhook**
- URL: `https://.../internal/event/mailersend`
- Signing Secret: copiar para `MAILERSEND_WEBHOOK_SIGNING_SECRET` em prod
- Header sent: `signature` (HMAC SHA-256 hex digest do raw body)

### Resend

- Dashboard Resend → **Webhooks → Add Endpoint** (powered by Svix)
- Endpoint URL: `https://.../internal/event/resend`
- Signing Secret: copiar `whsec_...` para `RESEND_WEBHOOK_SIGNING_SECRET`
- Headers enviados: `svix-id`, `svix-timestamp`, `svix-signature`

### Amazon SES (via SNS)

SES não envia HTTP webhooks diretamente — eventos vão para um SNS topic.

1. **Configuration Set + Event Destination** no SES (console ou CLI):
   ```
   aws sesv2 create-configuration-set --configuration-set-name bms-events
   aws sesv2 create-configuration-set-event-destination \
     --configuration-set-name bms-events \
     --event-destination-name sns \
     --event-destination MatchingEventTypes=Send,Reject,Bounce,Complaint,Delivery,Open,Click,RenderingFailure,DeliveryDelay,SnsDestination={TopicArn=arn:aws:sns:us-east-1:...}
   ```
2. **SNS Subscription HTTPS** apontando para
   `https://.../internal/event/ses` com `x-internal-token` no header.
3. **Confirmação manual**: na primeira request o BMS recebe um envelope
   `Type: SubscriptionConfirmation`. O endpoint **não auto-confirma** por
   segurança (evita ataque de subscrição forjada por terceiros). Logs
   exibirão `SubscribeURL=https://...` — ops faz `curl <SubscribeURL>` após
   vetar a URL (deve ser `*.amazonaws.com`).
4. **Allowlist de TopicArn**: setar `AWS_SES_WEBHOOK_SNS_TOPIC_ARN` em prod
   para rejeitar mensagens de tópicos não autorizados.

### Mandrill

- Dashboard MailChimp Transactional → **Settings → Webhooks → Add Webhook**
- URL: `https://.../internal/event/mandrill`
- Events: marcar todos (Send, Hard Bounce, Soft Bounce, Open, Click, Spam,
  Unsub, Reject, Deferral)
- Webhook key: copiar para `MANDRILL_WEBHOOK_KEY`
- **Importante:** setar `MANDRILL_WEBHOOK_URL` igual à URL configurada
  acima — o HMAC SHA-1 da Mandrill cobre `<URL>+'mandrill_events'+<JSON>`,
  então qualquer divergência (ex: `http` vs `https`, trailing slash) faz
  validação falhar.

## Pre-flight de teste

Antes de promover um provider a `default_email_provider`:

```bash
curl -X POST https://<msgops-api>/admin/integrations/<provider>/test-connection \
  -H "Cookie: <session>" \
  -H "Content-Type: application/json" \
  -d '{ "apiKey": "..." }'
```

- `200 { ok: true }` → credenciais válidas
- `200 { ok: false, errorMessage: "..." }` → credenciais inválidas ou outro
  problema (ex: SES retornará `errorMessage` específico se conta estiver
  em sandbox/paused)
- `429 Too Many Requests` → rate-limited (5 hits/min por IP)

## Boot diagnostics

No startup do `apps/send-email`, `EmailProvidersModule.onModuleInit()` loga:

```
EmailProviderRegistry: 6 providers registered — sparkpost(free=true,webhook=true), sendgrid(free=true,webhook=true), mailersend(free=true,webhook=true), resend(free=true,webhook=true), ses(free=false,webhook=true), mandrill(free=false,webhook=true)
```

Se faltar essa linha ou aparecer com providers a menos, alguma factory não
foi resolvida — verificar imports do `EmailProvidersModule`.

## Adicionar um novo provider

1. Criar `apps/send-email/src/handlers/<provider>/<provider>.handler.ts`
   implementando `IEmailProvider`. `getMetadata()` **deve** retornar
   `hasWebhook: true` ou o boot falhará.
2. Registrar o handler em `EmailProvidersModule` (factory + inject).
3. Criar admin module em
   `apps/msgops-api/src/modules/admin-integrations/<provider>/`
   espelhando os existentes (controller, service, DTOs Joi, spec).
4. Registrar admin module em
   `apps/msgops-api/src/modules/admin-integrations/admin-integrations.module.ts`.
5. Criar service em `apps/event-process/src/events/services/<provider>.service.ts`
   espelhando `SendgridService`/`SparkpostService`. Adicionar tipos em
   `events.interfaces.ts`. Adicionar endpoint em `app.controller.ts` com
   verificação de assinatura externa do provider antes do
   `processWithIdempotency`.
6. Atualizar matriz acima e adicionar setup específico nesta doc.
