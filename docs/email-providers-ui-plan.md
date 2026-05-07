# Plano — UI per-account para Email Providers

Especificação de planejamento para a **camada de UI faltante** do sistema
multi-provider de email entregue pelo EVO-1029. Pareado com:

- [`docs/email-providers.md`](./email-providers.md) — arquitetura
- [`docs/email-providers-testing.md`](./email-providers-testing.md) — teste manual via API

## TL;DR

O EVO-1029 entregou:

1. **Backend per-account** funcional (`accountConfigs.<provider>_key` +
   `accountConfigs.default_email_provider`).
2. **Backend system-wide** opcional via super_admin (`admin/integrations/<provider>`)
   — útil pra SaaS multi-tenant quando o operador da plataforma fornece
   credenciais centralmente.
3. **Sem UI per-account**. Não tem como um operador de conta normal
   trocar de provider sem rodar curl direto no DB ou na API.

Este plano descreve a UI per-account que estava out-of-scope do EVO-1029.
**Provider de email é per-account** (cada tenant traz suas credenciais);
o caminho super_admin system-wide é fallback opcional pra plataformas
gerenciadas, não o fluxo principal.

---

## 1. Decisões arquiteturais

### 1.1 Reusar o pattern SendGrid per-account já existente

Já existe no backend:

```
apps/msgops-api/src/modules/account-settings/account-settings.controller.ts
  @Controller('accounts/:accountId/settings')
    @Get('sendgrid')
    @Put('sendgrid')
    @Delete('sendgrid')
    @Post('sendgrid/test')
```

E no frontend React:

```
apps/frontend-react/src/features/settings/
  settings-page.tsx              ← /settings com tabs (SendGrid, Pool)
  sendgrid-account-tab.tsx       ← UI da config SendGrid
  sendgrid-account-gateway.ts    ← cliente HTTP
  pool-tab.tsx                   ← config IP pool (já existente)
```

**Replicar o pattern para os 5 providers novos:**
SparkPost, MailerSend, Resend, Amazon SES, Mandrill.

> Nota: SparkPost no BMS legado vinha por `accountConfigs.sparkpost_key`
> direto sem UI. Aqui formalizamos.

### 1.2 Per-account é o fluxo primário; super_admin é fallback

A admin-integrations API entregue no EVO-1029 (`PUT /admin/integrations/<provider>/settings`)
**continua existindo** mas se torna **fallback opcional**:

- Tenant configura sua chave em `/settings → Email Providers`
- Se a chave per-account não existe, `MailUtils.getAccountConfig` cai pro
  env file system-wide (que é populado pelo admin-integrations)
- Cenários onde super_admin faz sentido: SaaS gerenciado onde a plataforma
  paga o SparkPost para todos os tenants. Cenários onde NÃO faz sentido:
  multi-tenant com cada tenant trazendo sua própria conta provider.

### 1.3 Default provider é per-account

Já implementado: `accountConfigs.default_email_provider = 'mailersend'`.
A UI expõe radio/select e atualiza esse config via `PUT /accounts/config/default_email_provider`.

Sem essa setagem, o router cai no fallback legado (`ippool` → env →
`sendgrid`). A UI deve **forçar** uma escolha explícita pra novos onboardings.

### 1.4 Tab única "Email Providers" com sub-seção por provider

Adicionar **uma** tab em `/settings` chamada **"Email Providers"**:

```
/settings
  ├── SendGrid (legado, manter — pode virar sub-seção dentro de Email Providers)
  ├── Pool (já existente, IP pool config)
  └── Email Providers ← NOVO
        ├── Default Provider (radio/select)
        ├── SparkPost card
        ├── SendGrid card (substitui ou linka pra tab antiga)
        ├── MailerSend card
        ├── Resend card
        ├── Amazon SES card (com banner "no free tier")
        └── Mandrill card (com banner "discontinuação anunciada")
```

Cada card tem: status (configured ✓ / not configured ✗), botões (Edit /
Test / Remove), display da chave mascarada.

---

## 2. Backend — endpoints novos a criar

Mirror do pattern SendGrid existente, escopados em `accounts/:accountId/settings`.

### 2.1 SparkPost

```typescript
// apps/msgops-api/src/modules/account-settings/sparkpost.controller.ts (novo)
@Controller('accounts/:accountId/settings')
export class AccountSparkpostController {
  @Get('sparkpost') get(@Param('accountId') id: number)
  @Put('sparkpost') save(@Param('accountId') id: number, @Body() dto: SparkpostAccountDto)
  @Delete('sparkpost') remove(@Param('accountId') id: number)
  @Post('sparkpost/test') test(@Body() dto: { apiKey: string })
}
```

DTO: `apiKey` com pattern de SparkPost token (geralmente alfanumérico
40+ chars, sem prefixo fixo — validar só por length).

Service mirrors `AccountSendgridService`: lê/escreve `accounts_configs`
linha `sparkpost_key`. Test connection: `GET https://api.sparkpost.com/api/v1/account` com `Authorization: <apiKey>` (sem "Bearer ").

### 2.2 MailerSend

```typescript
@Controller('accounts/:accountId/settings')
export class AccountMailerSendController {
  @Get('mailersend')
  @Put('mailersend')
  @Delete('mailersend')
  @Post('mailersend/test')
}
```

DTO: `apiKey` (pattern `mlsn.` + min 30 chars — reusar constante de
`apps/msgops-api/src/modules/admin-integrations/mailersend/dtos/mailersend-system-settings.dto.ts`).

Test: `GET https://api.mailersend.com/v1/me` com `Authorization: Bearer <apiKey>`.

### 2.3 Resend

DTO: `apiKey` (pattern `re_` + min 20 chars). Test: `GET https://api.resend.com/domains`.

### 2.4 Amazon SES

DTO 3 campos: `accessKeyId` (pattern `^(AKIA|ASIA)[A-Z0-9]{16}$`),
`secretAccessKey` (min 40), `region` (allowlist regions GA SES — reusar
constante `SES_REGIONS` do system-wide DTO).

Test: `GetAccountCommand` via SDK SES (igual o admin-ses.service faz hoje).

### 2.5 Mandrill

DTO: `apiKey` (min 16 chars). Test: `POST https://mandrillapp.com/api/1.0/users/ping.json`.

### 2.6 Default provider selector

Reusar endpoint **já existente**:

```
PUT /accounts/config/default_email_provider
{ "value": "mailersend" }
```

Não precisa criar nada novo — `accounts.controller.ts` já tem
`@Put('/config/:name')`.

### 2.7 Validação cross-field (UX safety)

Adicionar guard no service de `default_email_provider`:

```typescript
// apps/msgops-api/src/modules/accounts/accounts.service.ts
async updateAccountConfig(name: string, accountConfig: { value: string }) {
  if (name === 'default_email_provider') {
    // Confirm provider has credentials before allowing it as default
    const accountId = this.cls.get('accountId');
    const hasKey = await this.checkProviderCredentials(accountId, accountConfig.value);
    if (!hasKey) throw new BadRequestException(
      `Configure as credenciais do ${accountConfig.value} antes de defini-lo como default.`,
    );
  }
  // ... existing save logic
}
```

Evita o caso "trocou pra mailersend mas não tem chave → todos os emails
falham silenciosamente".

---

## 3. Frontend — componentes novos a criar

Mirror de `sendgrid-account-tab.tsx` + `sendgrid-account-gateway.ts`.

### 3.1 Estrutura de arquivos

```
apps/frontend-react/src/features/settings/
  email-providers/                                    ← NOVA SUB-PASTA
    email-providers-tab.tsx                           ← container com cards + default selector
    default-provider-section.tsx                      ← radio/select pro default
    cards/
      provider-card.tsx                               ← card genérico (status, edit, test, remove)
      sparkpost-card.tsx
      sendgrid-card.tsx                               ← migra ou linka pra tab antiga
      mailersend-card.tsx
      resend-card.tsx
      amazon-ses-card.tsx                             ← campos AKID/Secret/Region
      mandrill-card.tsx                               ← com banner discontinuação
    gateways/
      sparkpost-gateway.ts
      mailersend-gateway.ts
      resend-gateway.ts
      amazon-ses-gateway.ts
      mandrill-gateway.ts
      default-provider-gateway.ts                     ← wraps PUT /accounts/config
    types.ts                                          ← shared types
    use-email-providers.ts                            ← hook orquestrador
    __tests__/
      email-providers-tab.test.tsx
      default-provider-section.test.tsx
      sparkpost-card.test.tsx
      ...
```

### 3.2 `email-providers-tab.tsx` — layout

```tsx
export function EmailProvidersTab() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const { providers, defaultProvider, refresh } = useEmailProviders(accountId);

  return (
    <div className="space-y-6">
      {/* Default provider selector */}
      <DefaultProviderSection
        currentDefault={defaultProvider}
        availableProviders={providers.filter((p) => p.configured)}
        onChange={refresh}
      />

      <Separator />

      {/* Provider cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SparkPostCard accountId={accountId} onChange={refresh} />
        <SendGridCard accountId={accountId} onChange={refresh} />
        <MailerSendCard accountId={accountId} onChange={refresh} />
        <ResendCard accountId={accountId} onChange={refresh} />
        <AmazonSesCard accountId={accountId} onChange={refresh} />
        <MandrillCard accountId={accountId} onChange={refresh} />
      </div>
    </div>
  );
}
```

### 3.3 `default-provider-section.tsx`

```
┌────────────────────────────────────────────────────────┐
│ Default Email Provider                                 │
│                                                        │
│ Qual provider o BMS usa pra enviar emails desta conta? │
│                                                        │
│ ○ SparkPost            (configured)                    │
│ ● MailerSend           (configured) ← current          │
│ ○ Resend               (not configured)  ← disabled    │
│ ○ Amazon SES           (configured)                    │
│ ○ Mandrill             (not configured)  ← disabled    │
│                                                        │
│ ⚠ SES requer rodar em EC2 pra ter free tier (62k/mês). │
│   Fora disso $0.10/1000 emails.                        │
│                                                        │
│ [ Save ]                                               │
└────────────────────────────────────────────────────────┘
```

Comportamento:

- Radio mostra **só os providers com credenciais configuradas** como
  selecionáveis (não-configurados aparecem desabilitados com tooltip
  "Configure credenciais primeiro")
- Banner contextual quando seleciona SES/Mandrill (warning de custo)
- Save chama `PUT /accounts/config/default_email_provider`

### 3.4 `provider-card.tsx` — pattern compartilhado

Cada card segue o mesmo layout (similar ao `sendgrid-account-tab.tsx`):

```
┌─────────────────────────────────────────────────────────┐
│ MailerSend                            ✓ Configured       │
│ 3000 emails/mês perpétuo                                 │
│                                                          │
│ API Key                                                  │
│ [mlsn.****************************************]  [👁]    │
│                                                          │
│ [ Test ]  [ Save ]  [ Remove ]                           │
└─────────────────────────────────────────────────────────┘
```

Estados:

- **Not configured:** botão "Configure" abre o form
- **Configured + idle:** mostra masked key, botões Edit/Test/Remove
- **Editing:** input text + Save/Cancel
- **Testing:** spinner em "Testing..."
- **Saving:** spinner em "Saving..."

Validação client-side (matching backend Joi):

- SparkPost: ≥ 30 chars
- SendGrid: começa com `SG.`, ≥ 10 chars
- MailerSend: começa com `mlsn.`, ≥ 30 chars
- Resend: começa com `re_`, ≥ 20 chars
- Amazon SES: 3 inputs (AKID, secret, region select com allowlist)
- Mandrill: ≥ 16 chars + warning banner

### 3.5 Cards com particularidades

**Amazon SES** — 3 inputs em vez de 1, layout mais largo:

```
┌─────────────────────────────────────────────────────────┐
│ Amazon SES                            ⚠ No free tier     │
│ 62000/mês exige rodar em EC2                             │
│                                                          │
│ [⚠] Sandbox: contas novas no SES começam em sandbox      │
│     (só envia pra emails verificados). Solicite          │
│     production access via AWS Support antes de produção. │
│                                                          │
│ Access Key ID                                            │
│ [AKIA****************]                                   │
│                                                          │
│ Secret Access Key                                        │
│ [*********************************************]  [👁]    │
│                                                          │
│ Region                                                   │
│ [ us-east-1 ▾ ]                                          │
│                                                          │
│ [ Test ]  [ Save ]  [ Remove ]                           │
└─────────────────────────────────────────────────────────┘
```

Test mostra na resposta o status `SendingEnabled` (já implementado no backend).

**Mandrill** — banner de descontinuação prominente:

```
┌─────────────────────────────────────────────────────────┐
│ Mandrill                              ⚠ Experimental     │
│ $20 por bloco de 25k                                     │
│                                                          │
│ [⚠] Mandrill (MailChimp Transactional) teve              │
│     discontinuação anunciada várias vezes. Use só se     │
│     já tiver dependência legada. Para produção, prefira  │
│     SparkPost ou MailerSend.                             │
│                                                          │
│ ...                                                      │
└─────────────────────────────────────────────────────────┘
```

### 3.6 Hook `use-email-providers.ts`

```typescript
export function useEmailProviders(accountId: number) {
  const [state, setState] = useState({
    providers: [], // { name, configured, hasFreeTier, hasWebhook, notes }
    defaultProvider: null,
    loading: true,
  });

  // Fetch in parallel: each provider's GET /accounts/:id/settings/<provider>
  // + PUT /accounts/config/default_email_provider current value
  // Determines `configured: boolean` from each response presence.

  return {
    ...state,
    refresh: () => {
      /* refetch all */
    },
  };
}
```

---

## 4. UX flows

### 4.1 First-time setup (conta nova sem provider)

```
1. User chega em /settings → tab "Email Providers"
2. Banner topo: "⚠ Configure pelo menos 1 provider antes de enviar emails"
3. Default Provider section: todos disabled
4. User clica "Configure" no card SparkPost (ou outro)
5. Inputa API key
6. Clica "Test" → backend valida → toast verde "Conexão OK"
7. Clica "Save" → key persiste em accounts_configs.sparkpost_key
8. Card vira "Configured ✓"
9. Default Provider section habilita SparkPost no radio
10. User seleciona SparkPost + Save → default_email_provider = 'sparkpost'
11. Banner topo desaparece. Pronto pra enviar.
```

### 4.2 Trocar de provider

```
1. Conta usa MailerSend hoje
2. User configura Resend (test → save) num novo card
3. Default Provider agora mostra MailerSend selected, Resend selectable
4. User troca radio para Resend + Save
5. Toast: "Default provider atualizado para Resend.
          Próximos envios usarão Resend."
6. (Não cancela emails em fila — só novos)
```

### 4.3 Remover credenciais

```
1. User clica "Remove" num card configurado
2. Confirm dialog: "Remover credenciais de MailerSend?
   Se for o default provider, escolha outro antes."
3. Bloqueia se for o default provider atual; mensagem:
   "Não é possível remover MailerSend porque é o default desta conta.
    Troque o default antes."
4. Após troca, remoção funciona → DELETE /accounts/:id/settings/mailersend
5. Card volta pro estado "Not configured"
```

### 4.4 Test connection com falha

```
- 401 do provider → toast vermelho "Credenciais inválidas. Verifique a API key."
- 429 (rate limit local 5/min) → toast "Muitas tentativas. Aguarde 1 minuto."
- Network error → toast "Não foi possível conectar ao provider. Tente novamente."
- SES SendingEnabled=false → toast "Conta SES está em sandbox ou pausada."
```

---

## 5. Permissões

Reaproveitar `account:settings_update` (já existe). Operadores normais
da conta podem configurar providers da própria conta.

Super_admin **não precisa intervir** no fluxo per-account. A
admin-integrations API permanece pra cenários SaaS gerenciados.

---

## 6. Testes

### 6.1 Unit tests (frontend)

Mirror dos testes existentes em `__tests__/sendgrid-account-tab.test.tsx`

- `use-settings.test.ts`. Cobertura por card:

* Renders "not configured" inicialmente
* Validação client-side rejeita key inválida
* Test button chama gateway.test e mostra toast verde no sucesso
* Save persiste e atualiza estado
* Remove confirma → chama DELETE → atualiza estado

Default provider section:

- Renderiza radio com providers configurados habilitados, não-configurados disabled
- Mudar selection + save chama gateway
- Bloquia salvar provider sem credenciais

### 6.2 Unit tests (backend)

Para cada novo controller (5):

- GET vazio retorna null
- PUT valida DTO Joi (rejeita invalid → 400)
- PUT persiste em accounts_configs
- DELETE remove
- POST /test chama API real (mockada) e retorna ok/error

Reaproveitar test patterns de `account-settings/sendgrid` se existirem.

### 6.3 E2E (manual, documentado em `docs/email-providers-testing.md`)

Substituir os curls do guide existente por screenshots da UI quando estiver pronto.

---

## 7. Migração e backwards compatibility

### 7.1 Contas existentes que já usam SparkPost via env

Ainda funcionam. Router fallback chain:

```
default_email_provider unset → ippool.includes('sparkpost') → SparkPost
                                ↓
                              accountConfigs.sparkpost_key (per-account, novo)
                                ↓ se ausente
                              process.env.SPARKPOST_API_KEY (legado)
```

Sem regressão.

### 7.2 Migração suave

Estratégia opcional: ao primeiro acesso ao tab "Email Providers" de
uma conta, oferecer um wizard:

```
"Detectamos que esta conta usa SparkPost via configuração legada.
 Deseja migrar pra configuração per-account agora?
 [ Migrate ]  [ Later ]"
```

Ao migrar: copia `process.env.SPARKPOST_API_KEY` (mascarado) pra
`accounts_configs.sparkpost_key` e seta `default_email_provider = 'sparkpost'`.

Out of scope da V1 — pode entrar em ticket dedicado.

### 7.3 Deprecar admin-integrations?

**Não.** Mantém por:

- Compatibility com Sendgrid platform legado (30+ accounts hard-coded)
- Cenários SaaS gerenciados onde super_admin paga o provider
- Configuração de webhook signing secrets (geralmente system-wide)

Apenas re-enquadrar na docs: _"per-account é o caminho recomendado;
super_admin é fallback opcional"_.

---

## 8. Estimativa

Quebra em 3 entregas iterativas pra reduzir risco:

### V1 — Read-only + 1 provider novo (pra validar pattern)

- Backend: AccountMailerSendController + service + DTO + spec (~200 LoC)
- Frontend: EmailProvidersTab container + DefaultProviderSection + MailerSendCard + ProviderCard genérico (~600 LoC)
- Tests: ~150 LoC

**~1 dia de dev**, 1 PR.

### V2 — Restantes 4 providers

- Backend: 4 controllers + services + DTOs (cada ~150 LoC)
- Frontend: 4 cards (cada ~120 LoC, reusando ProviderCard)
- Tests: ~400 LoC

**~2 dias de dev**, 1 PR.

### V3 — Default provider validation + UX polish

- Backend: cross-field validation no `updateAccountConfig`
- Frontend: wizard de first-time setup, banner topo, confirm dialogs
- Tests: ~200 LoC
- Migração de SendGrid existing tab → integrar dentro do EmailProvidersTab

**~1 dia de dev**, 1 PR.

**Total: ~4 dias de dev, 3 PRs.**

---

## 9. Riscos

| Risco                                                               | Mitigação                                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Conta tem default_email_provider sem credenciais → todo envio falha | Cross-field validation (§2.7) no backend                                        |
| User configura provider mas esquece de setar como default           | Banner topo "Configure pelo menos 1 provider" persiste enquanto default = unset |
| User remove credenciais do default provider                         | Bloqueio com mensagem clara (§4.3)                                              |
| Rate limit do test-connection (5/min) confunde durante setup        | Toast específico + cooldown visual no botão Test                                |
| SES sandbox surpresa em produção                                    | Banner explícito + test-connection já reporta SendingEnabled=false              |
| Mandrill descontinuado durante a vida útil da feature               | Banner já avisa "experimental"; degradação graceful (404 → Save falha + toast)  |
| Migração de contas legadas                                          | V3 com wizard opt-in; sem migração forçada                                      |

---

## 10. Decisões deferidas (out of scope V1-V3)

- Dashboard cross-provider de métricas (uso, custo)
- Failover automático (se sparkpost falhar, retry em sendgrid)
- Suporte a Postmark, Brevo, SMTP genérico
- Migração automática SENDGRID_KEYS_MAP legacy → per-account
- Multi-region SES (hoje suporta 1 region por conta)
- IPPool selector dentro do card SparkPost (já existe na tab "Pool")

Estas viram tickets separados quando demandadas.

---

## 11. Próximos passos imediatos

1. Validar este plano com Davidson (issue creator) e Danilo (assignee)
2. Criar ticket Linear "EVO-XXXX: UI per-account para Email Providers"
   linkado ao EVO-1029
3. Quebrar em 3 sub-tickets (V1, V2, V3) com estimativa
4. Começar V1: backend MailerSend account-settings + frontend MailerSendCard.
   PR review valida o pattern antes de replicar pros outros 4.
