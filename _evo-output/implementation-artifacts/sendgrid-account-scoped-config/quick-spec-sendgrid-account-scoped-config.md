# Quick Spec — SendGrid Configuração Por Conta com Fallback Global

**Status:** Draft
**Tipo:** Refactor de configuração + nova UX por conta
**Escopo:** Backend (msgops-api), Worker (send-email), Frontend React, Migrations
**Origem:** Decisão tomada na sessão de remoção de subaccount — chave SendGrid passa a ser por conta com fallback global no admin.

---

## 1. Motivação

Após remoção do flow de subaccount SendGrid (já feito em sessão anterior, ainda não commitado), ficou pendente como **resolver chave SendGrid em ambiente multi-tenant**. A direção correta:

- **Por conta (default):** cada cliente entra na conta dele, vai em Configurações, cola sua API key, e o webhook é registrado automaticamente com URL discriminada por conta.
- **Global no admin (fallback):** super_admin pode setar uma chave global na plataforma. Contas sem chave própria herdam essa chave. O cliente final **não vê** a chave global — apenas usa.

Isso preserva dois cenários reais:
- **Self-hosted single-tenant:** admin do servidor cola uma chave global, todas as contas usam.
- **Multi-tenant com múltiplos clientes:** cada cliente tem sua chave SendGrid própria; admin pode opcionalmente ter um fallback de plataforma.

## 2. Estado atual (após sessão anterior, não commitado)

> Estas mudanças estão no working tree (`git status` mostra arquivos modificados em `apps/msgops-api/src/modules/settings/`, `accounts/`, `handlers/email/sendgrid/`) mas **não foram commitadas**. Esta spec define como evoluí-las antes de commitar.

- `SendgridHandler` agora tem `loadApiKey()` (cache 60s) que lê `system_config.sendgrid_settings.apiKey`
- `SettingsService.saveSendgrid()` é super-admin-only, persiste em `system_config`, chama `createWebhook()` com URL de `process.env.SENDGRID_WEBHOOK_URL`
- DTO `SendgridSettingsDto` aceita só `apiKey` (webhook URL é gerada pelo backend)
- Métodos `createSubuser`, `createApiKey`, `domainAuthentication`, `linkBranding`, `updateTrackingSubscription`, `getSubUsers`, `deleteCampaign`, `getAudienceOptions`, `getSegmentOptions`, `getFieldsDefinitions` removidos do handler
- Bloco de provisionamento removido de `accounts.service.ts:create()`
- DTO `CreateAccountDto` limpo (sem `createSendgridAccount`, `sendgridIps`, `sendgridUser`, `linkBranding`, `unsubscribeRedirectUrl`)
- Endpoint `GET /accounts/sendgrid-subusers` removido

## 3. Modelo de dados final

### 3.1 Per-conta (`accounts_configs`)

Tabela já existe; usar duas keys:

| `name` | `value` | Origem |
|---|---|---|
| `sendgrid_key` | `'SG.xxx...'` | Cliente cola na tela /settings da conta |
| `sendgrid_webhook_url` | `'https://in.bri.us/bms/events/?platform=sendgrid&account=42'` | Backend gera + retorna após registrar webhook |

**Sem migration de schema** — a tabela já tem `(account_id, name, value)`. Apenas usamos novas `name`s.

### 3.2 Global (`system_config`)

Já existe key `sendgrid_settings`. Reutilizar:

```json
{
  "apiKey": "SG.global-fallback-key-here"
}
```

**Sem `webhookBaseUrl`** no global — webhook nunca é registrado para a chave global em si (a chave global é só fonte de fallback para envio; webhook pertence à conta que efetivamente recebe os eventos).

## 4. Resolução da chave em runtime

### 4.1 Worker `send-email/mail.service.ts`

Worker recebe `account.accountConfigs` na mensagem AMQP. Lógica nova:

```typescript
// 1. Per-conta primeiro
let apiKey = this.mailUtils.getAccountConfig(account.accountConfigs, 'sendgrid_key');

// 2. Global fallback (em accountConfigs do worker?? — ver §4.3)
if (!apiKey) apiKey = process.env.SENDGRID_API_KEY;
```

**Trade-off do worker:** ele não tem TypeORM, não pode ler `system_config` direto. Soluções:
- **(a)** `process.env.SENDGRID_API_KEY` continua sendo o fallback no worker. Operador setta env var = a chave global. msgops-api usa `system_config.sendgrid_settings.apiKey`. Operador mantém os dois em sync no deploy. **Mais simples mas exige disciplina.**
- **(b)** Worker chama API HTTP da `msgops-api` (`GET /internal/settings/sendgrid-key`) com cache N min. Single source of truth no DB. **Mais robusto, mais código.**
- **(c)** msgops-api injeta a chave global na mensagem AMQP no momento do dispatch (`account.accountConfigs.push({ name: 'sendgrid_key', value: globalKey })` se não tiver). **Resolve no producer, worker não precisa fallback.**

**Recomendação:** **(c)**. Zero código novo no worker, zero env var pra sincronizar, fonte da verdade fica em `system_config`. O componente que monta a mensagem AMQP (provavelmente `dispatcher`/`scheduler`) consulta `accounts_configs.sendgrid_key` por conta; se vazio, consulta `system_config.sendgrid_settings.apiKey` e injeta.

### 4.2 msgops-api `SendgridHandler.loadApiKey(accountId)`

Assinatura passa a aceitar `accountId`:

```typescript
async loadApiKey(accountId?: number): Promise<string | undefined> {
  if (accountId) {
    const accountKey = await this.accountConfigsProvider.getAccountConfig(accountId, 'sendgrid_key');
    if (accountKey) return accountKey;
  }
  // fallback: chave global
  const config = await this.systemConfigRepo.findOne({ where: { key: 'sendgrid_settings' } });
  return (config?.value?.apiKey as string) ?? process.env.SENDGRID_API_KEY;
}
```

**Cache:** `Map<number | 'global', { value, loadedAt }>`. Slot único atual quebra tudo (retorna chave de outra conta silenciosamente).

### 4.3 Métodos do handler que precisam de `accountId`

Hoje vivos: `getSiloOptions`, `getIPsByAccount`, `getIPs`, `sendCampaign`, `createSingleSend`, `sendSingle`, `getCampaignById`, `unscheduleSingleSend`, `updateSingleSend`, `getVerifiedSenders`, `getSenderByNameEmail`, `getStatsByCategories`, `sendSingleCustomEmail`. Todos chamados de contexto que tem `accountId` disponível (via `ClsService.get('accountId')`). Refactor: callers passam `accountId`, handler usa pra resolver chave.

## 5. Endpoints

### 5.1 Per-conta (cliente)

```
GET    /accounts/:id/settings/sendgrid     → { apiKey?: 'SG.xx...' (mascarada), webhookUrl?, source: 'account' | 'global' | 'none' }
PUT    /accounts/:id/settings/sendgrid     → body { apiKey } → registra webhook + salva → retorna { apiKey, webhookUrl }
DELETE /accounts/:id/settings/sendgrid     → remove chave da conta (volta a usar global)
POST   /accounts/:id/settings/sendgrid/test → body { apiKey } → valida sem persistir
```

**Auth:** `@RequirePermission('account:settings_update')` para PUT/DELETE; `account:settings_view` para GET. Permissions já existem em `authz.constants.ts:59-60`.

**`accountId` resolution:** path param + verificação que o user logado pertence à conta (já tem padrão em `accounts.controller`).

### 5.2 Global (admin)

```
GET    /settings/sendgrid       → super_admin only. Retorna { apiKey?: 'SG.xx...' (mascarada) }
PUT    /settings/sendgrid       → super_admin only. body { apiKey } → salva em system_config (sem registrar webhook — não há conta-alvo)
DELETE /settings/sendgrid       → super_admin only. Remove a chave global
POST   /settings/sendgrid/test  → super_admin only. body { apiKey } → valida sem persistir
```

**Mudança vs hoje:** PUT global **não registra webhook**. Webhook é registrado apenas no PUT per-conta. Justificativa: webhook precisa de URL com `&account=<id>` — global não tem conta.

### 5.3 Mascaramento da chave no GET

Nunca retornar a chave inteira. Formato: `SG.****...****<últimos 4 chars>`. Reduz risco de leak via DevTools/logs.

## 6. Webhook URL: discriminação por conta

URL gerada pelo backend ao salvar:

```
${SENDGRID_WEBHOOK_URL_BASE}?platform=sendgrid&account=${accountId}
```

Onde `SENDGRID_WEBHOOK_URL_BASE` é env var (ex: `https://in.bri.us/bms/events/`). O `event-process` lê `req.query.account` para rotear o evento à conta correta.

**TODO operacional (não bloqueia esta spec):** confirmar que o `event-process` (`/internal/event/sendgrid` controller) já trata `req.query.account`. Se não, adicionar leitura + persistir o `account_id` nos rows da `events_logs_v2`.

**Renomear env var:** `SENDGRID_WEBHOOK_URL` → `SENDGRID_WEBHOOK_URL_BASE` para deixar claro que é a base (sem accountId). Atualizar `.env.example`. Backwards-compat: se `SENDGRID_WEBHOOK_URL_BASE` ausente, ler `SENDGRID_WEBHOOK_URL` como fallback durante 1 release.

## 7. UX — Frontend React

### 7.1 Tela do cliente: `/account-settings/sendgrid` (ou onde for)

Componente: `apps/frontend-react/src/features/account-settings/sendgrid-tab.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│ Integração SendGrid                                              │
│                                                                  │
│ ⓘ Sua conta usa: [chave própria | chave global da plataforma]   │
│                                                                  │
│ API Key                                                          │
│ ┌────────────────────────────────────────────────┐ [Testar]      │
│ │ SG.****...xxxx                                 │              │
│ └────────────────────────────────────────────────┘              │
│                                                                  │
│ Webhook (registrado automaticamente)                            │
│ https://in.bri.us/bms/events/?platform=sendgrid&account=42      │
│   [📋 copiar]                                                    │
│                                                                  │
│ [Salvar e registrar webhook]   [Remover chave (usar global)]    │
└──────────────────────────────────────────────────────────────────┘
```

- Banner no topo indica qual fonte está em uso (`source` do GET)
- Webhook URL **read-only**, com botão copiar
- Botão `Remover` aparece só quando `source === 'account'`

### 7.2 Tela do admin: super_admin global key

Pode ficar em `/admin/settings/sendgrid` (super-admin only) — mesma UX simples, sem campo de webhook (não há).

```
┌──────────────────────────────────────────────────────────────────┐
│ SendGrid — Chave global de plataforma                            │
│                                                                  │
│ ⚠️ Contas sem chave própria herdam esta. Clientes não veem.      │
│                                                                  │
│ API Key                                                          │
│ ┌────────────────────────────────────────────────┐ [Testar]      │
│ │ SG.****...xxxx                                 │              │
│ └────────────────────────────────────────────────┘              │
│                                                                  │
│ [Salvar]   [Remover]                                             │
└──────────────────────────────────────────────────────────────────┘
```

A tela atual `apps/frontend-react/src/features/settings/sendgrid-tab.tsx` (super-admin) basicamente vira essa, com pequenos ajustes (remove campo webhook do form porque não há).

## 8. Migration de dados

**Não fazer migration de schema.** O `accounts_configs` já tem `name='sendgrid_key'` populado pelo flow antigo de subaccount. Esses rows ficam — o novo PUT per-conta sobrescreve quando o cliente colar uma chave nova. Continuidade gratuita para clientes existentes.

`accounts_configs` com `name='sendgrid_webhook_url'` — só novo, nunca existiu antes. Populado no primeiro PUT.

## 9. Tests

### 9.1 Backend (msgops-api)

- `SendgridHandler.loadApiKey(accountId)`:
  - retorna chave da conta quando existe
  - cai pro global quando conta não tem
  - cai pro env var quando global e conta vazias
  - cache por accountId (slot separado de outra conta)
  - cache invalidation após save
- `AccountSettingsService.saveSendgrid(accountId, apiKey)`:
  - happy path (registra webhook, persiste, retorna URL)
  - PRECONDITION_FAILED se `SENDGRID_WEBHOOK_URL_BASE` ausente
  - BAD_GATEWAY se registrar webhook falha (não persiste)
- `AccountSettingsController`:
  - GET retorna source corretamente (`account`/`global`/`none`)
  - GET mascara chave
  - PUT/DELETE protegidos por `account:settings_update`
- `SettingsService.saveSendgrid` (admin global):
  - **NÃO** chama `createWebhook` (mudança vs estado atual no working tree)
  - Persiste em `system_config`

### 9.2 Worker (send-email)

- `mail.service.ts:sendMail`:
  - usa `account.accountConfigs.sendgrid_key` quando presente
  - usa env var quando vazio

### 9.3 Frontend (React)

- `account-settings/sendgrid-tab.tsx`:
  - mostra source banner correto
  - PUT envia só `apiKey`
  - DELETE chama endpoint correto
  - webhook URL read-only

## 10. Plano de execução (commits)

1. **Commit 1 — Per-account endpoints + handler refactor**
   - `loadApiKey(accountId?)` no handler com cache `Map`
   - Novo `AccountSettingsService` + `AccountSettingsController` (`/accounts/:id/settings/sendgrid`)
   - Reutiliza `AccountConfigsProvider` para CRUD em `accounts_configs`
   - Mantém `SettingsService` global mas remove `createWebhook` chamada (admin global não registra webhook)
   - Renomeia env var (`SENDGRID_WEBHOOK_URL` → `SENDGRID_WEBHOOK_URL_BASE`) com fallback
   - Refactor callers de `loadApiKey` em todos os métodos vivos do handler para passar `accountId` via `cls.get('accountId')`
   - Tests atualizados/adicionados
   - Type-check + tests

2. **Commit 2 — Producer injeta chave global no AMQP message (resolve worker)**
   - Localizar onde mensagens AMQP são montadas para `send-email`
   - Antes de enviar: se `account.accountConfigs.sendgrid_key` vazio, consultar `system_config.sendgrid_settings.apiKey` e injetar no array de configs
   - Worker `mail.service.ts` continua igual (já lê `account.accountConfigs.sendgrid_key`)
   - Tests: producer test que valida injection

3. **Commit 3 — Frontend React per-account tab**
   - Novo componente `account-settings/sendgrid-tab.tsx`
   - Gateway `account-sendgrid-gateway.ts`
   - Banner de source, mascaramento, copiar URL, botão remover
   - Ajusta tela super-admin existente (remove input webhook, fica só apiKey)
   - i18n strings

4. **Commit 4 — Cleanup pós-validação**
   - Remove fallback da env var antiga `SENDGRID_WEBHOOK_URL` (após 1 release)
   - Documentação operacional em `docs/`

## 11. Não-objetivos

- **Não migrar dados** existentes em `accounts_configs.sendgrid_key` (deixar como está)
- **Não dropar `system_config.sendgrid_settings`** — agora vira chave global de fallback, propósito legítimo
- **Não tocar IP Pools** — escopo separado (próxima spec: buscar pools da SendGrid em vez de input livre)
- **Não tocar Vue 2 nem Vue 3 manager** — projeto está abandonando esses frontends
- **Não criar UX de gestão de múltiplas chaves por conta** (se cliente tem múltiplas SendGrid accounts, problema dele) — uma chave por conta BMS

## 12. Critérios de aceite

- [ ] Cliente entra em /account-settings/sendgrid, cola chave, salva → webhook aparece registrado no painel da SendGrid dele com URL contendo `&account=<id>`
- [ ] Cliente sem chave própria recebe envios usando a chave global do admin (transparente)
- [ ] Cliente vê banner indicando qual fonte está em uso (própria vs global)
- [ ] Admin (super_admin) consegue setar/remover chave global em /admin/settings/sendgrid sem afetar contas que têm chave própria
- [ ] Worker `send-email` envia com chave correta em ambos os cenários (per-conta e fallback global)
- [ ] `event-process` recebe webhook events e roteia pra conta certa via `?account=<id>`
- [ ] Cliente não consegue ler nem ver a chave global (chama GET → recebe `source: 'global'` mas sem o valor)
- [ ] Cliente não consegue editar/remover a chave global (chama DELETE → 403 ou no-op)
- [ ] Tests atualizados passam em msgops-api, send-email, frontend-react
- [ ] Type-check verde em todos os pacotes afetados

## 13. Pontos de atenção

- **Cache de `loadApiKey` por accountId** — slot único atual quebra silenciosamente. Mude para `Map` antes de qualquer outra coisa.
- **`pools.service.ts` chama `getSiloOptions`/`getIPs`** sem `accountId` hoje. Após esta spec, esses chamados precisam passar `accountId` (via ClsService). Caso contrário cai no global, que pode ter pools diferentes.
- **`api-key-regen.service.ts` usa `sendInternalEmail`** — esse método continua usando `process.env.SENDGRID_API_KEY` direto (email transacional do BMS pra reset de senha etc., não passa por conta). **Não tocar.**
- **`glockapps.handler.ts` chama `sendCampaign`** — passar `accountId` do contexto.
- **Estado atual no working tree NÃO commitado** — esta spec serve como evolução das mudanças locais. Se preferir, dá pra `git stash` e começar limpo da main; mas as mudanças do working tree (remoção de subaccount, métodos órfãos do handler, DTO limpo) são pré-requisito real, não retrabalho.

## 14. Decisões abertas (precisam de OK antes da implementação)

1. **Worker fallback** — opção (a), (b) ou (c) da §4.1? Recomendação: **(c)**.
2. **Renomear env var** `SENDGRID_WEBHOOK_URL` → `SENDGRID_WEBHOOK_URL_BASE`? Limpa mas exige ajuste no deploy. Alternativa: manter o nome.
3. **DELETE per-conta** — apaga só `sendgrid_key` ou também desregistra o webhook na SendGrid (chamando DELETE `/user/webhooks/event/settings`)? Recomendação: só apaga local; webhook deixar registrado é inofensivo.
4. **Mascaramento da chave** — confirma `SG.****...<4>` ou prefere outro formato (ex: nunca retornar nada além de boolean `hasKey`)?
