---
title: WhatsApp Oficial (Meta Cloud API) com Embedded Signup direto e EvoHub como alternativa
type: quick-spec
status: ready-for-development
owner: Davidson Gomes
created: 2026-05-27
author: Claude (Opus 4.7)
related:
  - apps/send-whatsapp
  - apps/msgops-api
  - apps/frontend-react
  - packages/database
references:
  - evo-crm-community (dois modos: Meta direto via CloudWhatsappForm + EvoHub via HubConnectButton)
  - evolution-hub (servidor Go que faz proxy Meta + Embedded Signup gerenciado + webhooks)
  - evo-academy (referência UX de builder de template: WhatsAppTemplates Edit.vue + NotificationTemplate model)
---

# Quick Spec — WhatsApp Oficial (Meta Cloud API) no BMS

> **Princípio diretor:** substituição limpa. A integração atual com Evolution API é **removida do BMS** nesta entrega. O BMS passa a operar **exclusivamente com WhatsApp Cloud API oficial da Meta**, em dois modos suportados em paralelo:
>
> 1. **Modo Meta Direto (default/principal)** — Embedded Signup nativo no frontend (Facebook JS SDK `FB.login`); BMS troca o `code` por `access_token` e fala direto com `graph.facebook.com`. Mesmo padrão do CRM `CloudWhatsappForm.tsx`.
> 2. **Modo EvoHub (alternativa)** — Quando `EVOLUTION_HUB_ENABLED=true`, o frontend esconde o botão FB.login e mostra "Conectar via EvoHub" → abre `public_link` do Hub; BMS fala com Meta via proxy `api.evohub.ai/meta/*`. Mesmo padrão do CRM `HubConnectButton.tsx`.
>
> A escolha do modo é por instalação (toggle `EVOLUTION_HUB_ENABLED`), exatamente como no CRM. Ambos os modos compartilham o mesmo schema, mesmo provider de envio (com pequenas diferenças de URL/token) e a mesma UI de templates.

## 1. Contexto e Problema

O BMS hoje envia WhatsApp via **Evolution API** (canal não oficial baseado em whatsmeow). Três problemas:

1. **Não-oficial**: viola TOS Meta em produção, bloqueia uso por contas Enterprise.
2. **Sem rastreabilidade Meta**: status de entrega/leitura, métricas de qualidade e janelas de conversa não são nativas.
3. **Templates fora do funil oficial**: aprovação Meta é simulada localmente, sem feedback real `APPROVED`/`PENDING`/`REJECTED`.

A solução é adotar a **Meta Cloud API oficial** com os dois caminhos do CRM:

- **Meta Direto** para clientes que querem dono integral da conexão (próprio Meta App, próprio WABA).
- **EvoHub** para clientes que preferem onboarding turnkey (Hub fornece o Meta App compartilhado, gerencia tokens, oferece Embedded Signup já configurado).

Adicionalmente, o **builder de templates do Evo Academy** será portado para o BMS, substituindo o fluxo atual de criação de templates Evolution.

## 2. Estado Atual (a ser REMOVIDO)

Todo o código abaixo é **excluído** nesta entrega:

| Item                                    | Arquivo                                                                                                  | Ação                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| Provider HTTP Evolution                 | `apps/send-whatsapp/src/providers/evolution.provider.ts`                                                 | DELETE                 |
| Handler de templates Evolution          | `apps/msgops-api/src/handlers/evolution/evolution.handler.ts`                                            | DELETE                 |
| Diretório `handlers/evolution/`         | `apps/msgops-api/src/handlers/evolution/`                                                                | DELETE                 |
| Método `approveEvolution`               | `apps/msgops-api/src/modules/messages/messages.service.ts:283-364`                                       | REMOVER                |
| Seletor `WHATSAPP_PROVIDER`             | `apps/msgops-api/src/modules/messages/messages.service.ts:158, 472`                                      | REMOVER                |
| ENV `EVOLUTION_API_URL`                 | `.env.example`, `apps/send-whatsapp/.env.example`, code refs                                             | REMOVER                |
| ENV `EVOLUTION_API_KEY`                 | idem                                                                                                     | REMOVER                |
| ENV `WHATSAPP_CALLBACK_EVOLUTION`       | idem                                                                                                     | REMOVER                |
| ENV `WHATSAPP_PROVIDER`                 | idem                                                                                                     | REMOVER                |
| Chaves `whatsapp_*` em accounts_configs | `whatsapp_number_id`, `whatsapp_access_token`, `whatsapp_business_id`                                    | DELETE (após migração) |
| Rotas frontend WhatsApp antigas         | `apps/frontend-react/src/routes/_authenticated/_layout/messages/whatsapp/` (forms do template Evolution) | REESCREVER             |

### 2.1. Referência CRM — modo Meta Direto

| Conceito                           | Arquivo no CRM                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Form principal com `FB.login`      | `evo-ai-frontend-community/src/components/channels/forms/whatsapp/CloudWhatsappForm.tsx:136-260`              |
| Banner de autorização / SDK loader | `evo-ai-frontend-community/src/components/channels/settings/AuthorizationBanners.tsx:286-545`                 |
| Service WhatsApp Cloud (Rails)     | `evo-ai-crm-community/app/services/whatsapp/providers/whatsapp_cloud_service.rb`                              |
| Switch URL Meta                    | `evo-ai-crm-community/lib/meta_base_url.rb` (retorna `graph.facebook.com` quando Hub OFF)                     |
| Code → token exchange              | Backend recebe `code` do FB.login, troca por `access_token` via `graph.facebook.com/v18.0/oauth/access_token` |
| Config Meta App no admin           | Campos `wpAppId`, `wpWhatsappConfigId`, `wpGraphVersion`, `wpSystemUserToken`                                 |

### 2.2. Referência CRM — modo EvoHub

| Conceito                  | Arquivo no CRM                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Toggle global             | `lib/meta_base_url.rb:1-85` (lê `ENV[EVOLUTION_HUB_ENABLED]`)                                        |
| Cliente HTTP Hub          | `lib/evolution_hub/client.rb:1-146` (Bearer `EVOLUTION_HUB_API_KEY`)                                 |
| Switch URL Meta           | `MetaBaseUrl.for(:whatsapp)` → `https://api.evohub.ai/meta`                                          |
| Token swap                | `whatsapp_cloud_service.rb:106-113` (envia `channel_token` em vez de `access_token`)                 |
| Webhook receiver          | `webhooks/evolution_hub_controller.rb` + `concerns/evolution_hub_signature_concern.rb` (HMAC-SHA256) |
| Lifecycle handler         | `evolution_hub/channel_connected_handler.rb:59-75`                                                   |
| Job assíncrono            | `webhooks/evolution_hub_events_job.rb:36-108` (dedup Redis 5min)                                     |
| Frontend service          | `src/services/integrations/evolutionHubService.ts:50-79`                                             |
| Botão "Conectar via Hub"  | `src/components/inbox/HubConnectButton.tsx:33-109`                                                   |
| Skip FB.login em Hub mode | `CloudWhatsappForm.tsx:59` ("Skip entirely in Hub mode")                                             |
| Tela admin                | `src/pages/Admin/Settings/EvolutionHubConfig.tsx`                                                    |

### 2.3. Referência Evo Academy — UX de templates

| Conceito                            | Arquivo no Academy                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| Schema `notification_templates`     | `database/migrations/2026_05_04_100003_create_notification_templates_table.php` |
| Editor 2-colunas com mockup ao vivo | `resources/js/Pages/Admin/WhatsAppTemplates/Edit.vue:268-641`                   |
| Mockup WhatsApp                     | `resources/js/components/WhatsAppPhoneMockup.vue`                               |
| Sync com Meta                       | `app/Services/WhatsAppTemplateSyncService.php:24-125`                           |
| Validações inline                   | `Edit.vue:141` — watch() auto-detecta `{var}` e popula exemplos                 |
| Multi-locale com clone              | Endpoint `POST /admin/whatsapp-templates/{slug}/clone-locale`                   |

## 3. Escopo

### 3.1. In-Scope

1. **Remoção** completa de toda integração Evolution API do BMS.
2. Cliente HTTP TypeScript dual:
   - `packages/whatsapp-cloud` — cliente Meta direto (`graph.facebook.com`).
   - `packages/evolution-hub` — cliente EvoHub (gestão de canais + webhooks + proxy `/meta/*`).
3. **Provider unificado** `apps/send-whatsapp/src/providers/whatsapp-cloud.provider.ts` que recebe `{ baseUrl, bearerToken, phoneNumberId }` e funciona para os dois modos (a diferença é só URL + token).
4. Resolver de modo em `apps/msgops-api/src/services/whatsapp-mode-resolver.ts`:
   - Lê `EVOLUTION_HUB_ENABLED` da config global.
   - Se true → modo `evohub`, resolve `baseUrl = EVOLUTION_HUB_URL + '/meta'`, `bearerToken = channel.channel_token`.
   - Se false → modo `meta`, resolve `baseUrl = 'https://graph.facebook.com/' + env.WHATSAPP_GRAPH_VERSION`, `bearerToken = channel.access_token`.
5. Nova entity `whatsapp_channels` unificada com colunas que suportam ambos modos.
6. Migration que extrai dados úteis de `whatsapp_*` em `accounts_configs` para `whatsapp_channels` (como `disconnected`) e deleta as chaves antigas.
7. Endpoints REST em `apps/msgops-api`:
   - `POST /accounts/:id/whatsapp-channels` — body diferencia modo:
     - Modo Meta: aceita `{ name, mode: 'meta', code, phone_number_id, waba_id, business_id }` (vindos do FB.login no frontend) → backend troca `code` por `access_token` e salva.
     - Modo Hub: aceita `{ name, mode: 'evohub' }` → backend chama `POST /api/v1/channels` do Hub e retorna `public_link`.
   - `GET /accounts/:id/whatsapp-channels`
   - `DELETE /accounts/:id/whatsapp-channels/:channelId` (cleanup Hub via `DELETE /api/v1/channels/:hubId` se modo evohub)
   - `POST /webhooks/meta` (verify token + processa `messages.statuses` direto da Meta — modo Meta)
   - `POST /webhooks/evolution-hub` (HMAC-SHA256 + enfileira — modo EvoHub)
8. Job assíncrono `WhatsappEventsProcessor` (BullMQ) com dedup Redis 5min. Demultiplexa pela source da queue.
9. Super Admin UI: dois conjuntos de tabs em `apps/frontend-react/src/features/super-admin/integrations/`:
   - `whatsapp-meta-tab.tsx` (sempre visível) — `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_CONFIG_ID`, `WHATSAPP_VERIFY_TOKEN`.
   - `whatsapp-hub-tab.tsx` (sempre visível) — `EVOLUTION_HUB_ENABLED`, `EVOLUTION_HUB_URL`, `EVOLUTION_HUB_API_KEY`, `EVOLUTION_HUB_WEBHOOK_SECRET`.
10. UI por conta: tela "Conectar WhatsApp" que renderiza, baseado em `EVOLUTION_HUB_ENABLED`:
    - **Modo Meta**: botão "Entrar com Facebook" (Facebook SDK loader + `FB.login` com `config_id`); ao retornar com `code`, faz POST para criar canal.
    - **Modo Hub**: botão "Conectar via EvoHub" → abre `public_link` em nova aba; polling até status=active.
11. Novo módulo de templates (`apps/msgops-api/src/modules/whatsapp-templates`) com schema `whatsapp_templates`.
12. Editor de templates no frontend (`apps/frontend-react/src/features/whatsapp-templates/`): layout 2-colunas, mockup WhatsApp ao vivo (porting do componente Vue do Academy para React), auto-detect de variáveis, contadores, botões dinâmicos, abas multi-locale com clone.
13. Service `WhatsappTemplateSyncService` que constrói payload Meta e chama `POST /{waba_id}/message_templates` no `baseUrl` resolvido (Meta direto ou via Hub).

### 3.2. Out-of-Scope (fase 2)

- BYO Meta App dentro do EvoHub (Hub permite, mas BMS fase 1 usa só shared mode).
- Builder de templates com upload direto de mídia; fase 1 suporta TEXT no editor e MEDIA por URL.
- Migração das mensagens já enviadas pelo provider Evolution (histórico em `messages` fica como está).

## 4. Decisões Arquiteturais

| ID  | Decisão                                                                                               | Alternativa rejeitada                                     | Motivo                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| D1  | Dois modos coexistem: Meta direto (default) + EvoHub (toggle ON)                                      | Só um dos dois                                            | Pedido explícito; espelha exatamente CRM; permite escolher por instalação.                 |
| D2  | Modo é por instalação (`EVOLUTION_HUB_ENABLED`), não por conta                                        | Mix de contas no mesmo BMS (umas Meta, outras Hub)        | Simplicidade; CRM faz assim; troca de modo é evento raro de migração.                      |
| D3  | Multi-canal por conta (`whatsapp_channels` 1:N account) — vale para ambos modos                       | 1 canal por conta em `accounts_configs`                   | Meta permite múltiplos `phone_number_id` por WABA.                                         |
| D4  | Provider único `WhatsappCloudProvider` parametrizado por `{baseUrl, bearerToken, phoneNumberId}`      | Dois providers separados (`MetaProvider` + `HubProvider`) | Payload Meta é idêntico nos dois modos; só URL+token mudam.                                |
| D5  | Entity `whatsapp_channels` SUBSTITUI chaves `whatsapp_*` em `accounts_configs`                        | Manter as duas estruturas                                 | Sem retrocompatibilidade. Schema dedicado.                                                 |
| D6  | Templates em tabela própria `whatsapp_templates`                                                      | Reutilizar `messages` entity                              | Templates têm ciclo de vida Meta (`PENDING/APPROVED/REJECTED`) e versionamento por locale. |
| D7  | Editor de template em React (porting de Vue/Inertia)                                                  | Embedar Vue dentro do React                               | Stack BMS é React.                                                                         |
| D8  | Substituição limpa: remover EvolutionProvider, ENVs `EVOLUTION_API_*`, `WHATSAPP_PROVIDER`            | Manter EvolutionProvider como fallback                    | Pedido explícito; reduz dívida técnica.                                                    |
| D9  | Dois webhook endpoints: `/webhooks/meta` (verify token GET + POST) e `/webhooks/evolution-hub` (HMAC) | Endpoint único genérico                                   | Cada provedor tem seu protocolo de autenticação; mistura aumenta superfície de bugs.       |
| D10 | Dedup Redis 5min via `X-Hub-Delivery-Id` (Hub) ou hash do payload (Meta)                              | UNIQUE constraint no DB                                   | Webhook chega antes da transação fechar.                                                   |
| D11 | UI escolhe botão a renderizar via `useFeatureFlag('evolution_hub_enabled')` fetchado do backend       | Hardcoded por env no frontend                             | Frontend não tem ENV runtime; precisa de endpoint de feature flags.                        |

## 5. Arquitetura

```
                    ┌─ Modo Meta Direto (EVOLUTION_HUB_ENABLED=false) ─┐
                    │                                                    │
┌──────────────────┐│   ┌──────────────────┐    ┌──────────────────┐    │
│  frontend-react  ││──▶│ FB.login (SDK)   │───▶│  graph.facebook  │    │
│  CloudConnect    ││   │ Embedded Signup  │    │  .com /messages  │    │
└──────────────────┘│   └────────┬─────────┘    └──────────────────┘    │
                    │            │ code, phone_number_id, waba_id        │
                    │            ▼                                       │
                    │   ┌──────────────────────┐                         │
                    │   │ POST /accounts/:id/  │                         │
                    │   │ whatsapp-channels    │                         │
                    │   │ (code→token exchange)│                         │
                    │   └──────────────────────┘                         │
                    └────────────────────────────────────────────────────┘
                    ┌─ Modo EvoHub (EVOLUTION_HUB_ENABLED=true) ────────┐
                    │                                                    │
┌──────────────────┐│   ┌──────────────────┐    ┌──────────────────┐    │
│  frontend-react  ││──▶│ HubConnectButton │───▶│ public_link Hub  │    │
│  HubConnect      ││   │ (POST channel)   │    │ (Embedded Signup │    │
└──────────────────┘│   └────────┬─────────┘    │  via Hub)        │    │
                    │            │ public_link  └────────┬─────────┘    │
                    │            ▼                       │ webhook       │
                    │   ┌──────────────────────┐         │ channel_      │
                    │   │ POST /webhooks/      │◀────────┘ connected     │
                    │   │ evolution-hub (HMAC) │                         │
                    │   └──────────────────────┘                         │
                    │   ┌──────────────────────┐    ┌──────────────────┐│
                    │   │ Send: hub_url/meta/* │───▶│ Hub proxy → Meta ││
                    │   └──────────────────────┘    └──────────────────┘│
                    └────────────────────────────────────────────────────┘

                       │
                       ▼
              ┌────────────────────┐
              │  whatsapp_channels │  (schema unificado, mode discrimina)
              │  whatsapp_templates│
              └────────────────────┘
                       │
                       ▼
              ┌────────────────────────┐
              │   send-whatsapp        │
              │   WhatsappCloudProvider│  (recebe baseUrl+bearerToken+phoneId)
              └────────────────────────┘
```

**Fluxo de conexão — Modo Meta:**

1. Frontend carrega FB SDK; admin clica "Entrar com Facebook".
2. `FB.login({ config_id: WHATSAPP_CONFIG_ID, response_type: 'code', override_default_response_type: true })`.
3. Postmessage do Embedded Signup retorna `{ phone_number_id, waba_id, business_id }`; callback do FB.login retorna `code`.
4. Frontend POST `/accounts/:id/whatsapp-channels` com `mode='meta'` + tudo acima.
5. Backend chama `GET graph.facebook.com/v18.0/oauth/access_token?client_id=...&client_secret=...&code=...` → recebe `access_token`.
6. Backend salva canal com `mode='meta'`, `access_token`, `phone_number_id`, `waba_id`, `status='active'`.

**Fluxo de conexão — Modo EvoHub:**

1. Frontend (Hub mode detectado) mostra botão "Conectar via EvoHub".
2. Admin clica → POST `/accounts/:id/whatsapp-channels` com `mode='evohub'`.
3. Backend chama `POST /api/v1/channels` do Hub → recebe `{ id, public_link, channel_token }`.
4. Backend salva canal `mode='evohub'`, `status='pending'`, `hub_channel_id`, `channel_token`.
5. Backend retorna `public_link` → frontend abre em nova aba.
6. Admin completa Embedded Signup no Hub.
7. Hub envia webhook `channel_connected` → `POST /webhooks/evolution-hub` (HMAC).
8. `WhatsappEventsProcessor` popula `phone_number_id`/`waba_id`/`display_phone_number` e flipa `status=active`.

**Fluxo de envio (idêntico nos dois modos):**

1. Job AMQP `bms.whatsapp` → `send-whatsapp` resolve canal por `account_id`.
2. `whatsappModeResolver(channel)` retorna `{ baseUrl, bearerToken, phoneNumberId }`.
3. `WhatsappCloudProvider.sendTemplate(...)` faz POST `{baseUrl}/{phoneNumberId}/messages` com `Authorization: Bearer {bearerToken}`.
4. Resposta → salva `providerMessageId` em `messages`.

**Fluxo de webhook de status:**

- **Modo Meta**: Meta envia direto para `/webhooks/meta` → verifica `WHATSAPP_VERIFY_TOKEN` (GET) e assinatura `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET` (POST) → enfileira.
- **Modo EvoHub**: Meta envia para Hub → Hub reassina com `EVOLUTION_HUB_WEBHOOK_SECRET` e forwarda para `/webhooks/evolution-hub` → enfileira.

## 6. Schema de Banco

### 6.1. Nova tabela `whatsapp_channels` (unificada)

```sql
CREATE TABLE whatsapp_channels (
  id                    SERIAL PRIMARY KEY,
  account_id            INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                  VARCHAR(255) NOT NULL,
  mode                  VARCHAR(16) NOT NULL,                          -- 'meta' | 'evohub'
  status                VARCHAR(32) NOT NULL DEFAULT 'pending',         -- 'pending' | 'active' | 'disconnected' | 'error'

  -- Comum aos dois modos
  waba_id               VARCHAR(64),
  phone_number_id       VARCHAR(64),
  display_phone_number  VARCHAR(32),

  -- Modo Meta
  access_token          TEXT,                                          -- token Meta criptografado (pgcrypto ou app-level)
  business_id           VARCHAR(64),

  -- Modo EvoHub
  hub_channel_id        VARCHAR(64),
  channel_token         TEXT,                                          -- token Hub que substitui access_token Meta nas chamadas
  evolution_hub_meta    JSONB,                                          -- payload completo channel_connected para auditoria

  last_event_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, phone_number_id),
  CHECK (mode IN ('meta', 'evohub')),
  CHECK (
    (mode = 'meta'   AND access_token IS NOT NULL OR status != 'active') OR
    (mode = 'evohub' AND hub_channel_id IS NOT NULL)
  )
);

CREATE INDEX idx_whatsapp_channels_account ON whatsapp_channels(account_id);
CREATE INDEX idx_whatsapp_channels_status  ON whatsapp_channels(status);
CREATE INDEX idx_whatsapp_channels_mode    ON whatsapp_channels(mode);
```

### 6.2. Migração de dados + remoção da estrutura antiga

```sql
-- (a) Migrar registros úteis para inspeção/auditoria
INSERT INTO whatsapp_channels (account_id, name, mode, status, phone_number_id, evolution_hub_meta)
SELECT
  ac1.account_id,
  COALESCE(a.name, 'Canal Migrado (Evolution Legado)'),
  'meta',                                                              -- placeholder; será sobrescrito se reconectar via Hub
  'disconnected',                                                       -- nunca foi um canal Cloud real; força reconexão
  ac1.value                                                             AS phone_number_id,
  jsonb_build_object(
    'migrated_from',  'accounts_configs',
    'legacy_business_id', (SELECT value FROM accounts_configs WHERE account_id = ac1.account_id AND name = 'whatsapp_business_id'),
    'migrated_at',    NOW()
  )
FROM accounts_configs ac1
JOIN accounts a ON a.id = ac1.account_id
WHERE ac1.name = 'whatsapp_number_id';

-- (b) Remover chaves antigas
DELETE FROM accounts_configs
WHERE name IN ('whatsapp_number_id', 'whatsapp_access_token', 'whatsapp_business_id');
```

Pós-migração: contas devem reconectar via UI (Meta direto OU EvoHub, conforme `EVOLUTION_HUB_ENABLED`).

### 6.3. Nova tabela `whatsapp_templates`

```sql
CREATE TABLE whatsapp_templates (
  id                    SERIAL PRIMARY KEY,
  account_id            INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  channel_id            INT NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
  slug                  VARCHAR(128) NOT NULL,                          -- regex ^[a-z][a-z0-9_]{0,127}$
  locale                VARCHAR(16)  NOT NULL DEFAULT 'pt_BR',
  category              VARCHAR(32)  NOT NULL,                          -- MARKETING | UTILITY | AUTHENTICATION
  body_text             TEXT NOT NULL,
  meta                  JSONB NOT NULL,                                 -- { header, body, footer, buttons, examples, var_map }
  placeholders          JSONB NOT NULL DEFAULT '[]',
  meta_template_id      VARCHAR(64),
  meta_status           VARCHAR(32),                                    -- PENDING | APPROVED | REJECTED | PAUSED
  meta_rejected_reason  TEXT,
  meta_synced_at        TIMESTAMPTZ,
  updated_by            INT REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, slug, locale)
);

CREATE INDEX idx_whatsapp_templates_account ON whatsapp_templates(account_id);
CREATE INDEX idx_whatsapp_templates_status  ON whatsapp_templates(meta_status);
```

## 7. ENV Vars

### 7.1. ENVs removidas

```
EVOLUTION_API_URL              ← DELETE
EVOLUTION_API_KEY              ← DELETE
WHATSAPP_CALLBACK_EVOLUTION    ← DELETE
WHATSAPP_PROVIDER              ← DELETE
```

### 7.2. ENVs novas

#### Modo Meta Direto (sempre presentes — caminho default)

| Var                      | Onde                      | Obrigatória | Default | Descrição                                                         |
| ------------------------ | ------------------------- | ----------- | ------- | ----------------------------------------------------------------- |
| `WHATSAPP_GRAPH_VERSION` | msgops-api, send-whatsapp | sim         | `v18.0` | Versão da Graph API.                                              |
| `WHATSAPP_APP_ID`        | msgops-api, frontend      | sim         | —       | Meta App ID (usado no `FB.init` e no code→token exchange).        |
| `WHATSAPP_APP_SECRET`    | msgops-api                | sim         | —       | Meta App Secret (usado no code→token exchange e HMAC do webhook). |
| `WHATSAPP_CONFIG_ID`     | frontend                  | sim         | —       | Embedded Signup Config ID (passado em `FB.login`).                |
| `WHATSAPP_VERIFY_TOKEN`  | msgops-api                | sim         | —       | Token para verificar GET webhook Meta.                            |

#### Modo EvoHub (necessárias quando `EVOLUTION_HUB_ENABLED=true`)

| Var                            | Onde                      | Obrigatória | Default                 | Descrição                                                   |
| ------------------------------ | ------------------------- | ----------- | ----------------------- | ----------------------------------------------------------- |
| `EVOLUTION_HUB_ENABLED`        | global                    | sim         | `false`                 | Toggle mestre. `true` ativa modo EvoHub e esconde botão FB. |
| `EVOLUTION_HUB_URL`            | msgops-api, send-whatsapp | se ENABLED  | `https://api.evohub.ai` | Base URL do Hub.                                            |
| `EVOLUTION_HUB_API_KEY`        | msgops-api                | se ENABLED  | —                       | Bearer tenant no Hub.                                       |
| `EVOLUTION_HUB_WEBHOOK_SECRET` | msgops-api                | se ENABLED  | —                       | HMAC-SHA256 Hub ↔ BMS.                                      |

## 8. Tarefas (ordenadas por dependência)

### Progresso de Execução

| Onda | Status       | Branch / Commit                                                  |
| ---- | ------------ | ---------------------------------------------------------------- |
| 1    | ✅ Concluída | `feature/whatsapp-cloud-meta-evohub` · `cdcc223`                 |
| 2    | ✅ Concluída | `feature/whatsapp-cloud-meta-evohub` · `5594835`                 |
| 3    | ✅ Concluída | `feature/whatsapp-cloud-meta-evohub` · `78f0fb4`                 |
| 7.3  | ✅ Concluída | `feature/whatsapp-cloud-meta-evohub` · `d1ea236+9402abd`         |
| 7.8  | ✅ Concluída | `feature/whatsapp-cloud-meta-evohub` · `7adcc68+5f8bdf0+f2973fb` |
| 4    | ✅ Concluída | `feature/whatsapp-cloud-meta-evohub` · `429bff1`                 |
| 7.4  | ✅ Concluída | `feature/whatsapp-cloud-meta-evohub` · `429bff1` + `3e90a82`     |
| 5    | ✅ Concluída | `feature/whatsapp-cloud-meta-evohub` · (próximo commit)          |
| 6    | ⏳ Pendente  |                                                                  |
| 7.6  | ⏳ Pendente  |                                                                  |
| 8    | ⏳ Pendente  |                                                                  |

**Branch:** `feature/whatsapp-cloud-meta-evohub` (a partir de `main` = `588b63c`).

**Estratégia de execução adotada:** a Onda 7 (frontend) foi fatiada e cada fatia entrega imediatamente após a onda backend correspondente, para validação visual contínua:

- **7.3** ↔ Onda 3 — Settings → tab WhatsApp mostrando o modo de instalação (preview de botões)
- **7.4** ↔ Onda 4 — botões Meta/Hub funcionais + lista de canais por conta
- **7.8** ↔ Onda 4 (antecipado) — Super Admin → tabs Meta + Hub (segue o mesmo padrão de Email Providers em vez de só ENV)
- **7.6** ↔ Onda 6 — editor de templates WhatsApp

**Desvios do spec original:**

- Migrations vivem em `apps/msgops-api/src/migrations/` (não em `packages/database/src/migrations/`) — esse é o padrão real do monorepo. Timestamp ajustado para `1781000000000` (> última migration existente `1780000000000`).
- Ondas 2/3 deixam stubs (`501 Not Implemented` em template approval / `503 Service Unavailable` no envio) até as Ondas 5 (`WhatsappCloudProvider`) e 6 (`WhatsappTemplateSyncService`) entrarem. O caminho Twilio (`WHATSAPP_PROVIDER=twilio`) permanece intocado durante a transição.
- A tela "Conectar WhatsApp" virou tab em `/settings` (per-account), alinhada ao padrão de Email Providers — não fica em menu próprio em Mensagens.
- Configuração das credenciais Meta App / Hub vai migrar de ENV para o painel Super Admin (Onda 7.8), seguindo o padrão SendGrid/SES/Mandrill (persistência em `system_config` + cache + bootstrap de arquivo `.env`). ENVs continuam funcionando como fallback durante a migração.

### Onda 1 — Fundação ✅

1. **`packages/whatsapp-cloud`** (novo) — Cliente Meta direto: ✅
   - `MetaCloudClient.exchangeCodeForToken(code): Promise<{ access_token }>` (POST `oauth/access_token`) ✅
   - `MetaCloudClient.getPhoneNumberInfo(phoneNumberId, accessToken)` ✅
   - `verifyMetaSignature(rawBody, signature, appSecret): boolean` (HMAC-SHA256 com `X-Hub-Signature-256`) ✅
   - Tests unitários. ✅ 12/12 passando

2. **`packages/evolution-hub`** (novo) — Cliente EvoHub: ✅
   - `EvolutionHubClient.createChannel(input): Promise<{ id, public_link, channel_token }>` ✅
   - `EvolutionHubClient.deleteChannel(id)`, `listChannels()`, `getChannel(id)`, `getPlan()`, `getMetaAppOptions()` ✅
   - `verifyHubSignature(rawBody, signature, secret): boolean` ✅
   - Tests unitários. ✅ 12/12 passando

3. **Migration `1781000000000-create-whatsapp-channels-and-drop-evolution-configs.ts`** em `apps/msgops-api/src/migrations/`: ✅
   - Cria `whatsapp_channels` (§6.1) + `whatsapp_templates` (§6.3) com FKs, CHECK `mode IN ('meta','evohub')`, UNIQUE `(account_id, phone_number_id)` e UNIQUE `(channel_id, slug, locale)`. ✅
   - Migra `accounts_configs.whatsapp_number_id` → `whatsapp_channels` (status `disconnected`, evolution_hub_meta JSONB com auditoria) ✅
   - DELETE de `whatsapp_number_id`, `whatsapp_access_token`, `whatsapp_business_id` em `accounts_configs` ✅
   - Guarded por `hasTable('accounts_configs')` para suportar instalações fresh ✅
   - `down()` dropa tabelas mas NÃO restaura chaves legadas (decisão consciente, migração one-way) ✅

4. **Entities TypeORM**: `whatsapp-channel.entity.ts` + `whatsapp-template.entity.ts` em `packages/database/src/entities/` ✅
   - Registradas no barrel (`entities/index.ts`) e no array `entities` exportado pelo package (`index.ts`).
   - Types auxiliares exportados: `WhatsappChannelMode`, `WhatsappChannelStatus`, `WhatsappTemplateCategory`, `WhatsappTemplateMetaStatus`, `WhatsappTemplateMeta`.

### Onda 2 — Remoção da integração Evolution ✅

5. **Excluir arquivos**: ✅
   - `apps/send-whatsapp/src/providers/evolution.provider.ts` (+ `.spec.ts`) — DELETADO
   - `apps/msgops-api/src/handlers/evolution/` (handler + diretório) — DELETADO

6. **`apps/msgops-api/src/modules/messages/messages.service.ts`**: ✅
   - Método `approveEvolution` removido. ✅
   - Import e DI de `EvolutionHandler` removidos. ✅
   - Ambos blocos `WHATSAPP_PROVIDER === 'twilio'` mantidos com o caminho `else` substituído por `throw HttpException(501 Not Implemented)` — caminho Cloud entra na Onda 6 (`WhatsappTemplateSyncService`). ✅

7. **`apps/send-whatsapp/src/app.service.ts`**: ✅
   - `EvolutionProvider` removido. ✅
   - Leitura de `whatsapp_number_id`/`whatsapp_access_token` de `accountConfigs` removida. ✅
   - `processCampaign` e `processAutomation` ficam como stubs `503 Service Unavailable` até a Onda 5 (`WhatsappCloudProvider`). ✅

8. **Limpar ENVs**: ✅
   - Removidos `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `WHATSAPP_CALLBACK_EVOLUTION` em `apps/msgops-api/.env.example` e `apps/send-whatsapp/.env.example`. ✅
   - `WHATSAPP_PROVIDER` default mudou de `evolution` → `twilio` (caminho legado funcional até a Onda 6). ✅
   - Limpeza confirmada: `grep -rn "EVOLUTION_API_URL|EVOLUTION_API_KEY|WHATSAPP_CALLBACK_EVOLUTION|EvolutionProvider|EvolutionHandler|approveEvolution"` em `apps/` e `packages/` retorna 0 hits — **AC13 ✅**. ✅

9. **`apps/msgops-api/src/modules/accounts/accounts.service.ts`**: ✅ (descoberto durante execução, não estava no spec)
   - Removido import/DI de `EvolutionHandler` + bloco `if (hasWhatsapp) { ... createInstance(...) }` (criação de instance Evolution no save de config). Substituído por comentário apontando pra Onda 4 (`POST /accounts/:id/whatsapp-channels`).

10. **Limpeza de imports/providers em `*.module.ts` e `*.spec.ts`**: ✅
    - `messages.module.ts`, `accounts.module.ts`, `automations.module.ts`, `tests.module.ts` — `EvolutionHandler` removido. ✅
    - `messages.service.spec.ts`, `accounts/__tests__/accounts-service.spec.ts` — providers mock + imports removidos. ✅
    - `send-whatsapp/src/app.service.spec.ts` — reescrito para validar o novo stub (4 testes verdes: `processCampaign 503`, `processAutomation 503 + forward to next`, `invalidContact`, `sendTracker`, `createRedirectLink`). ✅

11. **Frontend**: rotas em `apps/frontend-react/src/routes/_authenticated/_layout/messages/whatsapp/` (`index.tsx`, `create.tsx`, `$messageId.tsx`) **NÃO foram mexidas** — apenas roteiam para `MessageFormPage`, que continua funcional pelo caminho Twilio. Reescrita real do form de templates vem na Onda 7.

**Validação executada:**

- `pnpm type-check` em `msgops-api` e `msgops-send-whatsapp` → 0 erros. ✅
- `pnpm test` em `msgops-send-whatsapp` → 43/43 verdes (6 suites). ✅
- `pnpm test` em `msgops-api` (filtrado para impactados): `messages.service.spec` 10/10, `accounts-service.spec` 25/25. ✅
- `pnpm dev` na `msgops-api` local → boot completo: `[NestApplication] Nest application successfully started`. ✅

### Onda 3 — Resolver + endpoint de feature flag ✅

10. **`apps/msgops-api/src/modules/whatsapp-mode-resolver/whatsapp-mode-resolver.service.ts`**: ✅
    - `resolveMode(): 'meta' | 'evohub'` lendo `EVOLUTION_HUB_ENABLED` (aceita `true/1/yes`, case-insensitive). ✅
    - `isHubEnabled(): boolean` utilitário separado pra evitar branchs duplicadas. ✅
    - `resolveChannel(channel): { mode, baseUrl, bearerToken, phoneNumberId }` — meta retorna `graph.facebook.com/{version}` + `access_token`; evohub retorna `{EVOLUTION_HUB_URL}/meta/{version}` + `channel_token`. ✅
    - Drift detection: erro explícito se `channel.mode !== install mode` (env flipou após canal ter sido criado). ✅
    - **19/19 tests verdes** cobrindo parsing de env, ambas URLs, drift e guards de token/phone faltando. ✅

11. **`apps/msgops-api/src/modules/feature-flags/feature-flags.controller.ts`** ✅
    - `GET /feature-flags` (`@PublicRoute`, sem Bearer) → `{ evolution_hub_enabled: boolean }`. ✅
    - Validado live: `curl http://localhost:5001/feature-flags` → `{"evolution_hub_enabled":false}`. ✅

12. **ENVs adicionadas em `apps/msgops-api/.env.example`**: ✅
    - `EVOLUTION_HUB_ENABLED=false` (default), `EVOLUTION_HUB_URL=https://api.evohub.ai`, `WHATSAPP_GRAPH_VERSION=v18.0`. ✅
    - Placeholders comentados pros segredos das ondas seguintes (`WHATSAPP_APP_ID/SECRET/CONFIG_ID/VERIFY_TOKEN`, `EVOLUTION_HUB_API_KEY`, `EVOLUTION_HUB_WEBHOOK_SECRET`). ✅

### Onda 7.3 — Frontend (tab WhatsApp em Configurações) ✅

13. **`apps/frontend-react/src/features/feature-flags/api.ts`**: ✅
    - `useFeatureFlags()` query (TanStack, `staleTime: Infinity`, `refetchOnWindowFocus: false`). ✅
    - `useEvolutionHubEnabled()` convenience hook. ✅
    - Endpoint público — funciona antes do login. ✅

14. **Tab "WhatsApp" em `/settings`** (`apps/frontend-react/src/features/settings/whatsapp-providers/whatsapp-tab.tsx`): ✅
    - Adicionada ao lado de **Email Providers**, seguindo o mesmo padrão visual (card + descrição + ações). ✅
    - Card "Modo de instalação" com Badge dinâmico (`Meta direto` vs `EvoHub`) baseado na flag. ✅
    - Branch entre `MetaModePreview` (botão azul Facebook estilo `#1877f2`) e `HubModePreview` (botão padrão) — ambos desabilitados (aguardando Onda 7.4). ✅
    - Card "Canais conectados" vazio (CRUD entra na Onda 4 + 7.4). ✅
    - Tratamento de erro caso o endpoint `/feature-flags` falhe (Alert vermelho). ✅
    - i18n completa em `pt-BR`, `en-US`, `es-ES` (chaves `settings.whatsapp.*`). ✅

### Onda 4 — API de canais + webhooks

12. **Módulo `apps/msgops-api/src/modules/whatsapp-channels/`**:
    - Controller com rotas §3.1 (POST aceita ambos modos via discriminator `mode`).
    - Service que ramifica por modo: meta → `MetaCloudClient.exchangeCodeForToken`; evohub → `EvolutionHubClient.createChannel`.
    - DTOs com discriminated union (class-validator `@ValidateNested` por `mode`).

13. **Controller `apps/msgops-api/src/modules/webhooks/meta.controller.ts`** (modo Meta):
    - `GET /webhooks/meta` — challenge-response com `WHATSAPP_VERIFY_TOKEN`.
    - `POST /webhooks/meta` — valida `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET`, enfileira evento.

14. **Controller `apps/msgops-api/src/modules/webhooks/evolution-hub.controller.ts`** (modo EvoHub):
    - `POST /webhooks/evolution-hub` — valida HMAC com `EVOLUTION_HUB_WEBHOOK_SECRET`, enfileira.

15. **Job `apps/msgops-api/src/jobs/whatsapp-events.processor.ts`** (BullMQ, queue compartilhada):
    - Dedup Redis: `SETNX wa:delivery:{deliveryId} 1 EX 300` (deliveryId = `X-Hub-Delivery-Id` para Hub ou hash sha1 do body para Meta).
    - Por origem (`source: 'meta' | 'evohub'`):
      - `channel_connected` (Hub) → popula canal + `status=active`.
      - `channel_disconnected` (Hub) → `status=disconnected`.
      - `object: whatsapp_business_account` (ambos) → atualiza `messages` por `providerMessageId`.

### Onda 5 — Provider unificado de envio

16. **`apps/send-whatsapp/src/providers/whatsapp-cloud.provider.ts`**:
    - Construtor: `{ baseUrl, bearerToken, phoneNumberId }`.
    - `sendTemplate(to, templateName, languageCode, components)`: POST `{baseUrl}/{phoneNumberId}/messages` com `Bearer {bearerToken}`.
    - `sendText(to, text)`.
    - Retry exponencial 3x para 5xx.
    - Mask de logs para `bearerToken`.

17. **Refator `apps/send-whatsapp/src/app.service.ts`**:
    - Resolver canal por `account_id` → `whatsappModeResolver.resolveChannel(channel)` → instanciar `WhatsappCloudProvider`.

### Onda 6 — Templates (UX espelhada do Academy)

18. **Módulo `apps/msgops-api/src/modules/whatsapp-templates/`**:
    - CRUD: `GET/POST/PUT/DELETE /accounts/:id/whatsapp-templates`.
    - `POST /:slug/sync?locale=pt-BR` → `WhatsappTemplateSyncService.syncToMeta(template)`:
      - Resolve `baseUrl` + `bearerToken` do canal vinculado.
      - POST `{baseUrl}/{waba_id}/message_templates`.
      - Salva `meta_template_id`, `meta_status`, `meta_synced_at`.
    - `POST /:slug/clone-locale`.

19. **`messages.service.ts`**: onde havia `approveEvolution`, chama `WhatsappTemplateSyncService`.

### Onda 7 — Frontend

20. **Super Admin tabs** em `apps/frontend-react/src/features/super-admin/integrations/`:
    - `whatsapp-meta-tab.tsx` (Meta App config: GRAPH_VERSION, APP_ID, APP_SECRET, CONFIG_ID, VERIFY_TOKEN).
    - `whatsapp-hub-tab.tsx` (Hub config: ENABLED, URL, API_KEY, WEBHOOK_SECRET).
    - Registrar ambas em `integrations-page.tsx`.

21. **Services frontend**:
    - `apps/frontend-react/src/services/whatsapp/whatsappChannelsService.ts` — CRUD canais (DTO de criação aceita ambos modos).
    - `apps/frontend-react/src/services/feature-flags/featureFlagsService.ts` — `getFlags(): Promise<{ evolution_hub_enabled: boolean }>`.

22. **Componente `FbSdkLoader.tsx`** em `apps/frontend-react/src/components/whatsapp/`:
    - Carrega `https://connect.facebook.net/en_US/sdk.js` uma vez por sessão.
    - Inicializa via `FB.init({ appId: WHATSAPP_APP_ID, version: WHATSAPP_GRAPH_VERSION })`.
    - Hook `useFbSdk()` que retorna `{ FB, ready }`.

23. **Componente `MetaConnectButton.tsx`**:
    - Carrega FB SDK via `useFbSdk`.
    - Botão "Entrar com Facebook" → `FB.login(callback, { config_id: WHATSAPP_CONFIG_ID, response_type: 'code', override_default_response_type: true })`.
    - Captura `phone_number_id`/`waba_id`/`business_id` via `window.addEventListener('message', ...)` (Embedded Signup postMessage).
    - POST `/accounts/:id/whatsapp-channels` com `mode='meta'` + payload.
    - Espelha `evo-ai-frontend-community/src/components/channels/forms/whatsapp/CloudWhatsappForm.tsx`.

24. **Componente `HubConnectButton.tsx`**:
    - Botão "Conectar via EvoHub" → POST `/accounts/:id/whatsapp-channels` com `mode='evohub'` → abre `public_link` em nova aba.
    - Polling do status a cada 5s enquanto `pending` (timeout 5min).
    - Espelha `evo-ai-frontend-community/src/components/inbox/HubConnectButton.tsx:33-109`.

25. **Tela "Conectar WhatsApp"** em `apps/frontend-react/src/routes/_authenticated/_layout/settings/whatsapp.tsx`:
    - Fetcha `featureFlagsService.getFlags()`.
    - Se `evolution_hub_enabled` → renderiza `<HubConnectButton />`.
    - Senão → renderiza `<MetaConnectButton />`.
    - Lista canais em ambos casos (status badge, display_phone_number).

26. **Componente `WhatsAppPhoneMockup.tsx`** em `apps/frontend-react/src/components/whatsapp/`:
    - Porting React do componente Vue do Academy.
    - Props: `{ header, body, footer, buttons, exampleValues, variableMap }`.

27. **Editor de templates** `apps/frontend-react/src/features/whatsapp-templates/template-editor.tsx`:
    - Layout 2-colunas (form esquerdo, mockup direito sticky).
    - Abas por locale com "+ Clonar de pt_BR".
    - Auto-detect `{var}` via regex em useEffect.
    - Contadores de caracteres (body 1024, footer 60).
    - Botões dinâmicos add/remove (max 10).
    - Badge status Meta + motivo de rejeição.
    - Rodapé sticky: "Salvar" + "Sincronizar com Meta".

28. **Lista de templates** `apps/frontend-react/src/features/whatsapp-templates/templates-list.tsx`.

### Onda 8 — Observabilidade e docs

29. Métricas Prometheus: `whatsapp_send_total{mode, status, account_id}`, `whatsapp_send_latency_seconds{mode}`.
30. Doc operacional em `docs/operations/whatsapp-cloud.md`: como configurar Meta App, como configurar Hub, como alternar entre modos (drop tabela ou apenas migration de re-conexão), troubleshoot signature mismatch.
31. Atualizar `docs/getting-started.md`: explicar os dois modos e quando escolher cada.

## 9. Acceptance Criteria (Given/When/Then)

### AC1 — Conexão modo Meta (happy path)

```
Given EVOLUTION_HUB_ENABLED=false e WHATSAPP_APP_ID/SECRET/CONFIG_ID configurados
When o admin clica "Entrar com Facebook"
Then o SDK FB.login é invocado com config_id = WHATSAPP_CONFIG_ID
And a Embedded Signup retorna phone_number_id, waba_id, business_id via postMessage
And o callback retorna { code }
And POST /accounts/:id/whatsapp-channels com mode='meta' é chamado
And o backend troca code por access_token via graph.facebook.com/oauth/access_token
And um registro em whatsapp_channels é criado com mode='meta', status='active', access_token populado
```

### AC2 — Conexão modo EvoHub (happy path)

```
Given EVOLUTION_HUB_ENABLED=true e EVOLUTION_HUB_API_KEY configurado
When o admin clica "Conectar via EvoHub"
Then POST /accounts/:id/whatsapp-channels com mode='evohub' é chamado
And o backend chama POST /api/v1/channels do Hub
And um registro em whatsapp_channels é criado com mode='evohub', status='pending', hub_channel_id, channel_token
And o frontend abre o public_link retornado em nova aba
And ao concluir Embedded Signup no Hub, webhook channel_connected chega em /webhooks/evolution-hub
And dentro de 10s o canal vira status='active' com phone_number_id, waba_id, display_phone_number
```

### AC3 — Validação de assinatura webhook (ambos modos)

```
Given um POST em /webhooks/meta com X-Hub-Signature-256 calculado com secret errado
When o controller processa
Then responde 401 e não enfileira
And o mesmo vale para /webhooks/evolution-hub com EVOLUTION_HUB_WEBHOOK_SECRET errado
```

### AC4 — Dedup de webhook

```
Given duas requisições idênticas no mesmo endpoint webhook em 5min
When ambas são processadas pelo WhatsappEventsProcessor
Then apenas a primeira atualiza estado; a segunda loga "skipped: duplicate delivery"
```

### AC5 — Envio modo Meta

```
Given um canal mode='meta', status='active', com access_token válido
When uma mensagem é publicada em bms.whatsapp
Then o resolver retorna { baseUrl: 'https://graph.facebook.com/v18.0', bearerToken: access_token, phoneNumberId }
And WhatsappCloudProvider faz POST direto para graph.facebook.com
And providerMessageId é salvo
```

### AC6 — Envio modo EvoHub

```
Given um canal mode='evohub', status='active', com channel_token válido
When uma mensagem é publicada em bms.whatsapp
Then o resolver retorna { baseUrl: 'https://api.evohub.ai/meta/v18.0', bearerToken: channel_token, phoneNumberId }
And WhatsappCloudProvider faz POST para o Hub (que faz proxy para Meta)
And providerMessageId (id da Meta) é salvo
```

### AC7 — UI renderiza botão correto baseado em flag

```
Given GET /feature-flags retorna { evolution_hub_enabled: true }
When o admin abre /settings/whatsapp
Then o componente HubConnectButton é renderizado
And MetaConnectButton NÃO é renderizado
And quando evolution_hub_enabled=false, ocorre o inverso
```

### AC8 — Status de entrega chega em ambos modos

```
Given uma mensagem com providerMessageId conhecido
When Meta envia status update (modo Meta vai direto para /webhooks/meta; modo Hub vai via Hub para /webhooks/evolution-hub)
Then o processor identifica object=whatsapp_business_account e atualiza messages com delivered/read/failed
```

### AC9 — Criação de template com preview ao vivo

```
Given um admin na tela /whatsapp-templates/new
When digita "{cliente_nome}" no body
Then input "Valor de exemplo para {cliente_nome}" aparece automaticamente
And o mockup WhatsApp à direita renderiza com o valor de exemplo
And o contador de caracteres do body é incrementado em tempo real
```

### AC10 — Sync template com Meta (ambos modos)

```
Given um template salvo com meta_status=null vinculado a um canal active
When o admin clica "Sincronizar com Meta"
Then o backend resolve baseUrl/bearerToken do canal (Meta direto OU Hub)
And faz POST {baseUrl}/{waba_id}/message_templates
And meta_template_id e meta_status='PENDING' são salvos
```

### AC11 — Multi-locale com clone

```
Given um template locale='pt_BR' APPROVED
When o admin clica "+ en" e "Clonar de pt_BR"
Then um novo registro é criado com mesmo slug, locale='en', meta_status=null, copiando meta JSON e body_text
```

### AC12 — Migração apaga estrutura antiga

```
Given um BMS com chaves whatsapp_number_id em accounts_configs antes da migration
When a migration roda
Then linhas whatsapp_number_id, whatsapp_access_token, whatsapp_business_id são DELETADAS de accounts_configs
And whatsapp_channels recebe um registro 'disconnected' por conta migrada
And nenhuma operação WhatsApp funciona até a conta reconectar (via modo ativo)
```

### AC13 — Repositório limpo de Evolution

```
Given a entrega completa mergeada
When alguém roda `grep -rn "EVOLUTION_API_URL\|EVOLUTION_API_KEY\|WHATSAPP_CALLBACK_EVOLUTION\|WHATSAPP_PROVIDER\|EvolutionProvider\|approveEvolution" apps/ packages/`
Then o único hit aceitável é em CHANGELOG.md
And nenhum código de produção referencia Evolution API
```

## 10. Riscos e Mitigações

| Risco                                                                          | Mitigação                                                                                                      |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Modo Meta exige Meta App aprovado pelo cliente (review, business verification) | Doc detalhada com passo-a-passo; modo EvoHub é o atalho para quem não tem app próprio.                         |
| Hub indisponível derruba envio em modo EvoHub                                  | Circuit breaker no client; doc instrui como cair temporariamente para modo Meta se preciso.                    |
| Contas Evolution param de enviar até reconectar                                | Comunicar ANTES do deploy; doc passo-a-passo de reconexão em ambos modos.                                      |
| Webhook duplicado em retries                                                   | Dedup Redis 5min (D10).                                                                                        |
| Editor de template em React diverge da UX do Academy                           | Reusar literalmente estrutura visual; screenshot comparison no PR.                                             |
| Token Meta (access_token) vazado em logs ou banco                              | Mask helper em logger; criptografia at-rest via pgcrypto ou app-level (Fernet/AES-256-GCM).                    |
| Twilio path (linha 472) usado para outros canais não-WhatsApp                  | Inspecionar antes de remover; se for SMS/email, manter isolado.                                                |
| FB SDK falha em carregar (adblock, network)                                    | Mostrar fallback informativo "Não foi possível carregar Facebook SDK; tente outro navegador ou peça Hub mode". |
| Verify token Meta GET incorreto bloqueia configuração do webhook               | Endpoint `/webhooks/meta` GET retorna o challenge corretamente; testes incluem caso GET.                       |

## 11. Pronto para Implementação

Atende os critérios "Ready for Development":

- **Actionable**: cada tarefa em §8 cita arquivo e ação específica.
- **Logical**: 8 ondas com dependências claras.
- **Testable**: 13 ACs Given/When/Then cobrindo ambos modos, edge cases (signature inválida, dedup, FB SDK fail) e garantia de limpeza (AC13).
- **Complete**: investigação dos 3 projetos inlinada nas §2.1, §2.2, §2.3 com caminhos verificados.
- **Self-Contained**: dev agente fresco implementa lendo apenas este arquivo + os arquivos referenciados.

**Próximos passos sugeridos:**

1. Rodar `/evo-quick-dev` apontando para esta spec após aprovação.
2. Abrir issue Linear "EVO-XXX — WhatsApp Oficial (Meta + EvoHub) no BMS".
3. Comunicar contas que usam Evolution sobre necessidade de reconexão pós-deploy.
4. Decidir modo default por instalação (qual `EVOLUTION_HUB_ENABLED` ship no `.env.example`).
