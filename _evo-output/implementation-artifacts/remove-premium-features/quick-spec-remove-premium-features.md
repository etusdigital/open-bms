# Quick Spec — Remoção de Features Premium do Open Source

**Status**: Draft
**Tipo**: Refactor / Cleanup
**Escopo**: Backend, Frontends (Vue 2, Vue 3, React), Workers, Database
**Motivação**: As features abaixo são premium e não devem permanecer no projeto open source.

---

## 1. Features Alvo

| # | Feature | Motivo |
|---|---------|--------|
| 1 | Reputação de Email (IP Reputation) | Premium |
| 2 | Campaign Rules | Premium |
| 3 | Warmup | Premium |
| 4 | Leads | Premium |
| 5 | Trigger Campaigns | Premium |
| 6 | Produtos (Products) | Premium |

---

## 2. Apps/Workers Completos a DELETAR

Diretórios inteiros sob `apps/` que existem exclusivamente para essas features. Devem ser removidos da árvore, do `pnpm-workspace.yaml`, do `turbo.json`, do `docker-compose.yml` e de qualquer pipeline CI.

| App | Vinculado a | Caminho |
|-----|-------------|---------|
| `warmup-tracker` | Warmup | `apps/warmup-tracker/` |
| `lead-conception` | Leads | `apps/lead-conception/` |
| `lead-receive` | Leads | `apps/lead-receive/` |
| `message-trigger` | Trigger Campaigns | `apps/message-trigger/` |

> **Validar antes de deletar**: confirmar que nenhum outro worker (ex: `event-process`, `send-email`, `tag-process`) importa código desses apps via path absoluto ou pacote interno.

---

## 3. Backend — `apps/msgops-api`

### 3.1 Módulos completos a deletar
- `src/modules/ip-reputation/`
- `src/modules/campaigns-rules/`
- `src/modules/warmups/`

### 3.2 Entidades a deletar
- `src/entities/ip-reputation-daily.entity.ts`
- `src/entities/campaigns-rules.entity.ts`
- `src/entities/campaigns-rules-configs.entity.ts`
- `src/entities/warmup.entity.ts`

### 3.3 Colunas a remover de entidades remanescentes
| Entidade | Coluna | Feature |
|----------|--------|---------|
| `campaign.entity.ts` | `is_warmup` | Warmup |
| `campaign.entity.ts` | colunas `steps` / `triggers` adicionadas pela migration `1755787127122` | Trigger Campaigns |
| `pool.entity.ts` | `is_warmup` | Warmup |
| `tag.entity.ts` | `external_query` (migration `1755787127124`) | Trigger Campaigns |
| `emails-labels.entity.ts` | `product` | Products |

### 3.4 Limpeza em `app.module.ts`
Remover imports e entradas no array `imports`:
- `WarmupsModule` (linhas 24, 57)
- `CampaignsRulesModule` (linhas 28, 67)
- `IpReputationModule` (linhas 30, 69)

### 3.5 Limpeza em controllers/services remanescentes
- `campaigns.controller.ts`: remover endpoint `GET /campaigns/products` (~linha 29-34) e rotas `list-trigger-campaign`, `new-trigger-campaign`, `edit-trigger-campaign` (~linha 68)
- `campaigns.service.ts`: remover método `getProducts()` e métodos relacionados a trigger campaigns
- `messages.controller.ts` / `messages.dto.ts`: remover query param `product`
- `accounts.service.ts` (~linha 377): remover referência a `'retargeting-product-name'`
- `pools.service.ts`: revisar `findAll` e similares — remover filtros `is_warmup`
- Buscar e remover qualquer `WHERE is_warmup = true/false` em queries TypeORM

### 3.6 DTOs órfãos
Após remover módulos, fazer `tsc --noEmit` e remover qualquer DTO/interface importado apenas pelos módulos deletados.

---

## 4. Database — Migrations a Reverter

> **Decisão necessária**: criar UMA nova migration `XXXXX-remove-premium-features.ts` que dropa tabelas e colunas, em vez de reverter as antigas. Isso preserva o histórico e evita problemas em ambientes que já rodaram as migrations originais. As migrations originais devem ser **deletadas dos arquivos** após a nova migration de remoção entrar.

### 4.1 Tabelas a DROPAR
- `ip_reputation_daily`
- `campaigns_rules`
- `campaigns_rules_configs`
- `warmups`
- `warmup_users`
- `leads`

### 4.2 Colunas a DROPAR
- `campaigns.is_warmup`
- `campaigns.steps` (e demais colunas da migration `1755787127122`)
- `pools.is_warmup`
- `tags.external_query` (ou equivalente da migration `1755787127124`)
- `emails_labels.product`

### 4.3 Migrations originais a DELETAR após a nova subir
- `1696883801489-create_warmups_table.ts`
- `1696883801490-alter_campaigns_pools_add_is_warmup.ts`
- `1711462210972-create_table_leads.ts`
- `1716434550096-createWarmupUsers.ts`
- `1716434550098-alter_warmup_add_currentSend.ts`
- `1716434550099-alter_warmup_add_replyTo.ts`
- `1725893194159-alter-warmups-add-description.ts`
- `1749065583307-alter_warmups_add_target_segment_id.ts`
- `1752238434434-create-table-campaigns-configs.ts`
- `1753456032935-alter-table-campaigns-rules-add-week-days.ts`
- `1755787127122-alter-campaigns-add-steps-triggers.ts`
- `1755787127124-alter-tags-add-external-query.ts`
- `1771027200000-create-table-ip_reputation_daily.ts`
- `1771113600000-alter-table-ip_reputation_daily-add-columns.ts`

---

## 5. Frontend Vue 2 — `apps/frontend-vue2`

### 5.1 Módulos completos a deletar
- `src/modules/campaigns-rules/`
- `src/modules/warmup/`
- `src/modules/trigger-campaign/`
- `src/modules/products/`

### 5.2 Limpeza em `src/router.ts`
- Remover imports: `campaignRulesRoutes` (linha 6), `warmupRoutes` (linha 15), `triggerCampaignRoutes` (linha 21), `productRoutes` (linha 22)
- Remover entradas dos arrays de rotas (~linhas 36-56)
- Remover entradas de permissions: `'campaigns-rules'`, `'warmup-list'`, `'list-trigger-campaign'`, `'product-list'`, `'insights-route'` (~linhas 64-71, 115-120)
- Remover de `internalOnlyRoutes` set (~linhas 140-158)

### 5.3 Vuex store
- `src/store.ts` linha 94: remover `campaignRulesSchedule: {}` do state
- Buscar e remover mutations/actions relacionadas

### 5.4 Componentes/serviços compartilhados
Após remover, rodar `pnpm --filter msg-ops type-check` e remover imports órfãos.

---

## 6. Frontend Vue 3 — `apps/msgops-manager-frontend`

**Não há features premium nesse frontend** (é console super-admin de users/accounts/billing). Apenas validar com `grep -r "warmup\|campaign-rule\|trigger-campaign\|leads\|products\|ip-reputation"` que não há refs órfãs.

---

## 7. Frontend React — `apps/frontend-react`

### 7.1 Features a deletar
- `src/features/campaign-rules/`
- `src/features/warmups/`
- `src/features/trigger-campaigns/`
- `src/features/products/`
- `src/features/leads/`
- `src/features/insights/` (depende de Leads)

### 7.2 Rotas a deletar
- `src/routes/_authenticated/_layout/campaign-rules/` (diretório inteiro)
- `src/routes/_authenticated/_layout/warmups/` (diretório inteiro)
- `src/routes/_authenticated/_layout/trigger-campaign/` (diretório inteiro)
- `src/routes/_authenticated/_layout/product.tsx`
- `src/routes/_authenticated/_layout/analytics.leads.tsx`
- `src/routes/_authenticated/_layout/analytics.reputation.tsx`
- `src/routes/_authenticated/_layout/analytics.insights.tsx`

### 7.3 Limpeza adicional
- Sidebar/menu: remover entradas
- `routeTree.gen.ts`: rodar codegen do TanStack Router após remoção
- Permissions/feature flags no client: limpar

---

## 8. Permissions / RBAC

Verificar `permissions` seed/migrations e remover chaves:
- `campaigns_rules:*`
- `warmup:*`
- `leads:*`
- `products:*`
- `ip_reputation:*`
- `trigger_campaigns:*`
- `analytics:insights_view`

Manter a migration `1771800000000-create-rbac-core.ts` (estrutura base do RBAC) — apenas remover seeds dessas permissions específicas.

---

## 9. Configs / Env Vars

Procurar e remover:
- Variáveis de ambiente de SendGrid IP Pools que sejam exclusivas de IP Reputation
- Configs em `accounts_configs` com keys: `retargeting-product-name`, qualquer `warmup_*`, `lead_*`, `trigger_*`, `ip_reputation_*`
- Documentar no `.env.example` quais foram removidas

---

## 10. Docker / CI / Build

- `docker-compose.yml`: remover serviços `warmup-tracker`, `lead-conception`, `lead-receive`, `message-trigger`
- `turbo.json`: remover entradas de pipeline desses workers
- `pnpm-workspace.yaml`: já contempla `apps/*`, então deleção do diretório basta — validar
- GitHub Actions / CI: remover jobs de build/deploy desses workers
- Dockerfiles dentro dos apps deletados saem juntos

---

## 11. Ordem de Execução Recomendada

1. **Branch dedicada**: `chore/remove-premium-features`
2. **Frontend primeiro** (menor risco de quebrar runtime):
   - Deletar features/rotas React
   - Deletar módulos Vue 2
   - Rodar type-check de cada frontend
3. **Backend**:
   - Deletar módulos no `msgops-api`
   - Limpar `app.module.ts`
   - Limpar controllers/services compartilhados (campaigns, messages, accounts, pools)
   - Deletar entidades
   - Rodar `tsc --noEmit` no msgops-api
4. **Workers**: deletar 4 apps (`warmup-tracker`, `lead-conception`, `lead-receive`, `message-trigger`)
5. **Database**:
   - Criar nova migration `XXXXX-remove-premium-features.ts`
   - Testar `migration:run` em DB de dev
   - Deletar migrations originais
6. **Infra/CI**: docker-compose, turbo, workflows
7. **Smoke test**:
   - `pnpm install` na raiz
   - `pnpm build` em todos os apps
   - Subir api + frontend principal e validar login + tela inicial
8. **PR**: descrever exatamente o que foi removido

---

## 12. Riscos e Pontos de Atenção

- **`Campaign.entity.ts`** tem coluna `is_warmup` provavelmente filtrada em listagens públicas. Após drop, filtros `is_warmup = false` em queries hardcoded podem gerar erro de coluna inexistente — `grep` por isso antes de aplicar a migration.
- **`message-trigger`** processa eventos via AMQP/queue. Se houver outros workers consumindo da mesma fila, validar antes de deletar.
- **Triggers em `campaigns.steps` (jsonb)**: apenas remover a coluna pode afetar campanhas legadas que usam `steps` para outros fins (ex: campanhas multistep não-trigger). **Confirmar com o time se `steps` é exclusivo de trigger campaigns** antes de dropar.
- **Tabela `leads`**: pode estar sendo populada por integrações externas (webhooks de fora). Antes de dropar, verificar se algum endpoint público recebe dados de lead que serão perdidos.
- **Setup wizard**: o setup atual provavelmente referencia warmup/pools premium — validar `apps/msgops-api/src/modules/setup/` e `apps/frontend-react/src/features/setup/` para refs órfãs.

---

## 13. Critérios de Aceite

- [ ] Nenhum diretório listado na seção 2 existe
- [ ] Nenhum módulo listado na seção 3.1 existe
- [ ] `tsc --noEmit` passa em msgops-api, frontend-vue2, frontend-react
- [ ] `pnpm build` passa em todos os apps remanescentes
- [ ] `grep -ri "warmup\|campaign.rule\|trigger.campaign\|ip.reputation"` no monorepo retorna apenas matches em strings legítimas (ex: comentários de changelog), não em código vivo
- [ ] Migration nova roda limpa em DB recém-criado e em DB com dados antigos
- [ ] API sobe sem erros relacionados a módulos faltantes
- [ ] Frontend principal renderiza tela inicial sem 404 de rotas removidas
- [ ] CI verde

---

## 14. Fora de Escopo

- Migração de dados premium para outro repo/produto (responsabilidade do time premium, se aplicável)
- Refactor de código remanescente que ficar com complexidade menor após remoção (fica para PR posterior)
- Atualização de documentação README/docs do projeto (PR separado)
