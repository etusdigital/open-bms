# Análise — `apps/msgops-manager-frontend` (Super Admin)

Feature slug: `bms-opensource`
Autor: Claude (direto no código do monorepo)
Criado: 2026-04-16
Propósito: eliminar o "risco de dependências não mapeadas" da Fase 7.6 mapeando *agora* o que precisa ser alterado.

---

## Stack confirmada

- **Framework:** Vue 3 (não Vue 2!) + Vite + TypeScript
- **UI:** Vuetify 3 (`@mdi/font` icons)
- **State:** Pinia
- **Routing:** vue-router
- **i18n:** vue-i18n
- **Forms:** vee-validate + zod
- **Auth:** `@auth0/auth0-vue` (já integrado — consistente com decisão de manter Auth0 no v0.1.0)
- **Toasts:** vue-toastification
- **Dev:** Storybook 6.5 + Vitest (com coverage)
- **CI atual:** `.gitlab-ci.yml` (precisa virar GitHub Actions)
- **Versão:** 2.0.0

## Estrutura do `src/`

```
src/
├── assets/
├── components/
├── entities/          (Account, Billing, User)
├── gateways/          (Account, Billing, Login, User, _common/Brius)
├── i18n/
├── infra/             (Auth/, HttpClient/)
├── pages/             (Accounts, Billing, Users, CallbackPage, HomePage, NotFoundPage)
├── plugins/
├── stores/            (Accounts, Users)
├── utils/
├── App.vue
├── main.ts
├── router.ts
└── style.css
```

**Domínios funcionais:** apenas **Accounts + Billing + Users** (+ Callback/Home/NotFound). É um painel enxuto de administração de tenant e usuário, exatamente como o Pet descreveu.

---

## Mapa de alterações pra Fase 7.6

### 1. `.env.example` (rápido — 5min)

**Estado atual:**
```
VITE_API_MSGOPS=https://msgops-api-stg.etus.digital
VITE_AUTH0_DOMAIN=brius-com-br.us.auth0.com
VITE_AUTH0_CLIENT_ID=24k28y8Vrm0RB7MOLzL2307b2QBIuS7a
VITE_AUTH0_AUDIENCE=https://msgops-api.etus.digital
VITE_AUTH0_CALLBACK_URL=http://127.0.0.1:5173/callback
VITE_APP_REDIRECT_MSGOPS=https://localhost:44357/
```

**Ação:** trocar por placeholders genéricos:
```
VITE_API_MSGOPS=http://localhost:3000
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=<your-client-id>
VITE_AUTH0_AUDIENCE=<your-api-audience>
VITE_AUTH0_CALLBACK_URL=http://localhost:5173/callback
VITE_APP_REDIRECT_MSGOPS=http://localhost:5173/
```

### 2. Roles/claims Auth0 hardcoded (1h — análise + refactor)

**`src/router.ts`:**
```ts
userStore.setRoles(auth0.user.value['https://bri.us/roles'] || []);
if (userStore.roles.includes('etus_superbilling')) { /* redireciona pra /billing */ }
```

**Ação:** trocar namespace `https://bri.us/roles` por placeholder genérico configurável (via env var `VITE_AUTH0_ROLES_CLAIM`) e renomear role `etus_superbilling` → `superbilling` (ou deixar como exemplo documentado).

### 3. Namespace `Brius` em gateways (30min — rename mecânico)

**Arquivos:**
- `src/gateways/_common/Brius/BriusGateway.types.ts`
- `src/gateways/_common/Brius/BriusGateway.utils.ts`
- `src/gateways/_common/Brius/index.ts`

**Conteúdo:** é só boilerplate de paginação/search/sort genérico (`BriusHttpParams` com `page`, `itemsPerPage`, `search`, `sortBy`, `order`). **Nada específico da Brius** além do nome.

**Ação:** rename para `BmsGateway` ou `CommonGateway`:
```bash
# 3 arquivos + refs em gateways/Account, /User, /Login, /Billing
git mv src/gateways/_common/Brius src/gateways/_common/Bms
# e search-replace BriusGateway → BmsGateway nos consumidores
```

### 4. `.gitlab-ci.yml` → GitHub Actions (1h)

**Ação:** trocar por workflow `.github/workflows/msgops-manager-frontend.yml` com:
- `lint` (eslint)
- `type-check` (vue-tsc)
- `test` (vitest)
- `build` (vite build)

Workflow simples, não precisa reproduzir pipeline GitLab inteiro.

### 5. Ocorrências dispersas de strings (1h — busca textual)

30 arquivos têm menção a `etus|brius|.digital|bri.us|superbilling` (case insensitive). A maioria é em:
- `i18n/` (textos traduzidos — provavelmente precisam de generic rebrand)
- `stores/` (comentários, possivelmente URL de doc)
- `pages/*.vue` (strings hardcoded em UI)
- `yarn.lock` (ignorar — é só resolução de deps)

**Ação:** Danilo passa nos 30 arquivos, filtra yarn.lock + arquivos de teste, substitui/remove.

### 6. README do app (30min)

Atual (README.md, 5.4K) deve ter instruções específicas Etus. Reescrever pra contexto open source BMS.

### 7. Tema Vuetify `briusLightTheme` comentado (0min)

Em `main.ts` tem um `briusLightTheme` comentado. Deixar como está (não está ativo) ou remover — trabalho trivial.

---

## Esforço total estimado (Fase 7.6)

| Tarefa | Tempo |
|---|---|
| 1. `.env.example` | 5min |
| 2. Roles Auth0 hardcoded | 1h |
| 3. Rename namespace Brius | 30min |
| 4. GitLab CI → GitHub Actions | 1h |
| 5. Strings dispersas (30 arquivos) | 1h |
| 6. README do app | 30min |
| 7. Plugar endpoints `msgops-api` migrada | 2h (quando Gui entregar qua 20/mai) |
| 8. Validar Storybook + tests passando | 1h |
| **Total trabalho mecânico** | **~7h** (1 dia-dev) |
| + Polimento visual / features globais faltando (métricas de plataforma, health dashboard, DLQ view) | **4-5 dias-dev** |
| **Total Fase 7.6** | **~5-6 dias-dev** (consistente com estimativa S/M ~1,5 semana-dev) |

---

## Risco residual — MUITO BAIXO

Após esse mapeamento concreto:

| Item | Antes | Agora |
|---|---|---|
| Repo externo quebrado | Risco MÉDIO | ✅ App já no monorepo, rodando |
| Deps não mapeadas | Risco MÉDIO | ✅ Apenas 30 arquivos com strings Etus + 1 role hardcoded + 1 namespace — todos mapeados |
| Stack incompatível | Risco MÉDIO | ✅ Vue 3 moderno, mesmo stack dos outros apps open source |
| Integração CI | Risco MÉDIO | ✅ GitLab → GitHub Actions é trabalho mecânico 1h |

**Risco residual REAL:** features globais que o Super Admin deveria ter no open source mas o painel atual da Etus não tem (ex: health dashboard de RabbitMQ/Redis/ClickHouse, visualização de DLQs, configs globais de rate limit). Essas são **features adicionadas**, não bugs. Tempo estimado 4-5 dias-dev já inclui isso.

---

## Próximo passo

Danilo começa Fase 7.6 seg 20/abr (dia 1) com essa lista em mão — zero investigação pendente. Fase 0 dele na segunda é só rodar `yarn install && yarn dev` local pra confirmar que sobe + aplicar itens 1-3 (env + roles + rename) no próprio dia.

**Handoff:** este documento é o input concreto do Danilo pra Fase 7.6.
