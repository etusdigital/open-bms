# WhatsApp Cloud (Meta direct + EvoHub)

Guia operacional da integração oficial com a WhatsApp Cloud API. Substitui a
integração antiga via Evolution API.

> **Princípio:** o BMS suporta dois modos em paralelo, escolhidos por instalação:
>
> 1. **Meta Direct** (default) — Embedded Signup nativo (FB.login), BMS fala com
>    `graph.facebook.com` direto, tokens da Meta ficam no `whatsapp_channels`.
> 2. **EvoHub** — alternativa proxy/turnkey. BMS fala com `api.evohub.ai/meta`,
>    o Hub gerencia o Meta App compartilhado e o signup; webhooks chegam
>    re-assinados com HMAC do Hub.
>
> Toggle: `EVOLUTION_HUB_ENABLED` em `system_config` (com fallback à env).

## Quando escolher cada modo

| Critério                                                     | Meta Direct    | EvoHub                              |
| ------------------------------------------------------------ | -------------- | ----------------------------------- |
| Tem Meta App próprio aprovado                                | ✅ recomendado | —                                   |
| Quer onboarding turnkey (sem business verification)          | —              | ✅ recomendado                      |
| Quer ter dono integral dos tokens                            | ✅             | —                                   |
| Aceita usar o Meta App compartilhado da Evolution Foundation | —              | ✅                                  |
| Vai compartilhar canal com outros sistemas (ex: Evo AI CRM)  | —              | ✅ (via "anexar a canal existente") |

## Variáveis de ambiente

Todas opcionais no boot. As credenciais reais ficam na **Super Admin UI**
(persistidas em `system_config`). ENV só serve como fallback se a UI ainda não
foi configurada.

| Var                            | Default                 | Onde configura                                                                        |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| `WHATSAPP_PROVIDER`            | `cloud`                 | env / system_config — `cloud` ou `twilio` (legacy)                                    |
| `WHATSAPP_GRAPH_VERSION`       | `v18.0`                 | env / Super Admin → WhatsApp (Meta App)                                               |
| `WHATSAPP_APP_ID`              | _vazio_                 | Super Admin → WhatsApp (Meta App)                                                     |
| `WHATSAPP_APP_SECRET`          | _vazio_                 | Super Admin → WhatsApp (Meta App)                                                     |
| `WHATSAPP_CONFIG_ID`           | _vazio_                 | Super Admin → WhatsApp (Meta App)                                                     |
| `WHATSAPP_VERIFY_TOKEN`        | _vazio_                 | Super Admin → WhatsApp (Meta App) — mesmo valor configurado na Meta Developer Console |
| `EVOLUTION_HUB_ENABLED`        | `false`                 | Super Admin → WhatsApp (EvoHub)                                                       |
| `EVOLUTION_HUB_URL`            | `https://api.evohub.ai` | env (raro mudar — endpoint fixo)                                                      |
| `EVOLUTION_HUB_API_KEY`        | _vazio_                 | Super Admin → WhatsApp (EvoHub)                                                       |
| `EVOLUTION_HUB_WEBHOOK_SECRET` | _vazio_                 | Super Admin → WhatsApp (EvoHub)                                                       |
| `BMS_PUBLIC_URL`               | `${FRONTEND_URL}`       | env (só se webhook não cair no domínio do app)                                        |

## Setup: modo Meta Direct

1. **Criar Meta App** em https://developers.facebook.com:
   - App type: **Business**.
   - Adicione produto **WhatsApp**.
   - Configure **Embedded Signup**: copie o `Configuration ID`.
   - Em **Settings → Basic**: copie `App ID` e `App Secret`.

2. **Configurar webhook na Meta Developer Console**:
   - URL: `https://${FRONTEND_HOST}/api/webhooks/meta`
   - Verify token: defina qualquer string forte (ex: `openssl rand -hex 32`).
   - Subscribe events: `messages`, `message_template_status_update`, `message_template_quality_update`.

3. **Configurar no BMS**:
   - Logue como super-admin → **Integrações** → **WhatsApp (Meta App)**.
   - Preencha App ID / Secret / Config ID / Verify Token.
   - Salve.

4. **Conectar uma conta**:
   - Em cada conta tenant: **Configurações** → **WhatsApp** → "Entrar com Facebook".
   - O Embedded Signup roda → backend troca `code` por `access_token` → canal aparece como `active`.

## Setup: modo EvoHub

1. **Criar conta no EvoHub** (`app.evohub.evolutionfoundation.com.br`):
   - Pegue a `API Key` (Bearer tenant).
   - Configure ou anote o `Webhook Secret` (HMAC).

2. **Configurar no BMS**:
   - Super Admin → **Integrações** → **WhatsApp (EvoHub)** → habilite **Modo EvoHub**.
   - Preencha `API Key` e `Webhook Secret`.
   - Salve. O resolver vai começar a usar `api.evohub.ai/meta` no lugar de `graph.facebook.com`.

3. **Conectar uma conta** (duas rotas):

   **Rota A — Embedded Signup novo:**
   - Em cada conta tenant: **Configurações** → **WhatsApp** → "Conectar via EvoHub".
   - Hub abre o signup numa nova aba → ao terminar, webhook `channel_connected` chega no BMS e canal vira `active`.

   **Rota B — Anexar a canal existente** (ex: o número já está conectado no CRM, EvoAI etc.):
   - **Configurações** → **WhatsApp** → "Usar canal existente" → selecione o canal no dropdown.
   - O BMS cria só um webhook standalone bound ao canal (não refaz signup) e popula o `phone_number_id`/`waba_id` imediatamente.

## Webhooks

| Endpoint                       | Auth                                                        | Quando recebe                           |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------- |
| `POST /webhooks/meta`          | HMAC-SHA256 `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET` | Modo Meta — Meta envia direto           |
| `GET /webhooks/meta`           | Query `?hub.verify_token=...`                               | Verificação da Meta no setup do webhook |
| `POST /webhooks/evolution-hub` | HMAC-SHA256 com `EVOLUTION_HUB_WEBHOOK_SECRET`              | Modo EvoHub — Hub re-assina e encaminha |

Eventos processados:

- `messages` / `messages.statuses` → atualiza `messages.status` (delivered/read/failed) por `providerMessageId`.
- `message_template_status_update` → atualiza `messages.status` (approved/rejected/sent_approval).
- `channel_connected` (Hub) → flipa `whatsapp_channels.status` para `active` + popula `phone_number_id`/`waba_id`.
- `channel_disconnected` (Hub) → flipa para `disconnected`.

## Templates

| Botão                   | Endpoint                                  | Quando usar                                                                                      |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Criar template**      | `POST /messages` com `type=whatsapp`      | Cria template no BMS + submete pra aprovação Meta                                                |
| **Sincronizar status**  | `POST /messages/:id/sync-template-status` | Force-poll do status atual quando o webhook não chegou                                           |
| **Sincronizar da Meta** | `POST /messages/whatsapp/sync-from-meta`  | Importa todos os templates já existentes na WABA (criados via Business Manager ou outro sistema) |

Categoria configurável no form: **MARKETING** (promos) ou **UTILITY** (transacionais). `AUTHENTICATION` é tratado pelo fluxo `2FA-whatsapp` separado.

## Troubleshooting

### Boot do canal falha com "BMS_PUBLIC_URL env is not set"

Setar `BMS_PUBLIC_URL` (ou garantir que `FRONTEND_URL` está setada — `BMS_PUBLIC_URL` herda dela).

### Send retorna "Unknown path components"

Erro Meta — Hub não aceita `/vNN.0` no caminho. O resolver no BMS já corrige isso: modo EvoHub usa `{hub}/meta` (sem versão). Se você customizou o `WhatsappModeResolverService`, confirme essa regra.

### Webhook EvoHub aparece como `event=unknown` no log

Cosmético. O log foi melhorado: agora é `evohub_webhook_event kind=meta_forward` quando a Meta encaminha pelo Hub. Se ver `kind=unknown`, olhe o log seguinte `evohub_webhook_event_unrecognised body=...` para o shape e abra uma issue.

### Campanha WhatsApp pega `Contacts: 0` no log do campaign-packer

`contacts.has_whatsapp = false` para todos os contatos. Migration `1781200000000-backfill-has-whatsapp-from-has-phone.ts` faz UPDATE one-shot. Confira:

```bash
docker exec -it $(docker ps -q -f name=bms_postgres) psql -U postgres -d msgops -c \
  "SELECT name FROM migrations WHERE name LIKE '%has_whatsapp%';"
```

Contatos novos via API/CSV já saem com `has_whatsapp=true` via hook `BeforeInsert/BeforeUpdate` na entity (`apps/msgops-api/src/entities/contact.entity.ts`).

### Template `teste-x` ficou em "Sent for approval" pra sempre

Webhook da Meta não chegou. Use o botão **Sincronizar status** no form da mensagem — força um `GET /{waba_id}/message_templates?name=...` direto.

### EvoHub: erro 409 "This account already has an EvoHub channel"

Por design: uma conta = um canal EvoHub. Para reconectar ou anexar a outro, delete o atual primeiro.

### `evohub_create_webhook_failed`

Verifique se a `EVOLUTION_HUB_API_KEY` tem permissão de criar webhooks. Em alguns tenants do Hub, certas operações exigem upgrade de plano.

## Migração de Evolution → Cloud

A migration `1781000000000-create-whatsapp-channels-and-drop-evolution-configs.ts`:

- Cria `whatsapp_channels`.
- Move chaves antigas (`whatsapp_number_id`, `whatsapp_access_token`, `whatsapp_business_id` em `accounts_configs`) para um registro `whatsapp_channels` com `status='disconnected'`.
- Deleta as chaves antigas.

**Contas afetadas precisam reconectar** via UI depois do deploy (modo Meta OU EvoHub conforme escolha do instalador). Sem reconexão, envios WhatsApp param.

## Métricas

(Onda 8 pendente.) Quando integrada, exporta:

- `whatsapp_send_total{mode, status, account_id}` — counter
- `whatsapp_send_latency_seconds{mode}` — histogram

## Ver também

- `infra/swarm/DEPLOY.md` §7.4 — setup pós-deploy via Portainer
- `_evo-output/implementation-artifacts/whatsapp-oficial-via-evohub-quick-spec.md` — spec completa (arquitetura, decisões)
- `docs/operations/email-providers.md` — mesmo padrão para email providers
