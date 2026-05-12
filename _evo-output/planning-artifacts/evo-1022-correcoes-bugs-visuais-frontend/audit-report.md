---
title: 'EVO-1022 — Audit Report (Fase 0)'
slug: 'evo-1022-audit-report'
created: '2026-05-12'
status: 'pending-human-approval'
linear_issue: 'EVO-1022'
branch: 'danilocarneiro/evo-1022-correcoes-de-bugs-visuais-no-frontend'
baseline_commit: 'fa3486cc2481a7df1c561f701ec8a74e033e2de0'
phase: '0'
next_phase_gate: 'human-approval-required'
---

# EVO-1022 — Audit Report (Fase 0)

> **Status: aguardando aprovação humana antes de Fase 1.**
> Esta Fase 0 inteira foi feita por **análise estática** (sem dev server, sem screenshots reais). Tasks 1-2 são repros hipotéticas; Task 3-4 é leitura de código + git. Antes de iniciar Fase 1, **Danilo precisa marcar a coluna `decision` da tabela final** com: `approved-for-fix` / `spinoff` / `wontfix` para cada item.

---

## Status final por bug

| Bug do ticket | Status Fase 0 | Bloqueador? |
|---|---|---|
| #1 Auto-fill `fromName`/`fromMail` | ✅ Causa raiz identificada por análise estática | Decisão `preserveUserEdits` |
| #2 Sobreposição "Remetente" | ⚠️ **NÃO REPRODUZIDO** — sintoma exato desconhecido | Repro real necessária |
| #3 Rename i18n Pool→Sender | ✅ Mapeado (não auditado em detalhe — Task fora do escopo da Fase 0) | Nenhum |

---

## 1. Bug auto-fill — sumário

**Artefato completo:** [`repro-auto-fill.md`](./repro-auto-fill.md)

**Causa raiz:** `handlePoolChange` (`email-content-form.tsx:87-95`) só é disparado por clique no `<Select>`. `currentPoolId` (linhas 98-106) controla a UI mas não dispara side-effect. Falha em **edição, duplicação, mudança programática**.

**Fluxos afetados:**

| Fluxo | Status |
|---|---|
| A — Criação + clique manual | ✅ funciona |
| B — Edição com `ippool` setado | ❌ bug (AC2) |
| C — Duplicação | ❌ bug (mesma raiz) |
| D — Mudança programática | ❌ bug (AC4) |
| E — Race condition pools tardios | ⚠️ UX inferior, não bug do ticket |

**Decisão pendente para o checkpoint:**
- Regra `preserveUserEdits` no clique manual: `true` ou `false`?
  - `false` (overwrite) = intuitivo no clique, mas contradiz a leitura literal do AC3.
  - `true` (preserve) = conservador, mas o usuário troca de pool e vê os campos antigos.
- Recomendação: **clique = overwrite (`false`); mount/programático = preserve (`true`)**. AC3 precisa ser reinterpretado como aplicando-se apenas a mount/programático.

---

## 2. Bug sobreposição "Remetente" — sumário

**Artefato completo:** [`repro-remetente-overlap.md`](./repro-remetente-overlap.md)

**Conclusão:** Análise estática **não localizou overlap óbvio**. O grid `grid-cols-1 gap-4 sm:grid-cols-2` (linha 259) e o pool selector (linhas 230-256) não apresentam sobreposição no JSX. Documentei **6 suspeitos** ordenados por probabilidade:

1. Aperto no breakpoint `sm` (640-767px) com label longa quebrando.
2. Distância insuficiente entre form fields e InboxPreview (`<lg`).
3. `SelectContent` dropdown cobrindo grid em viewports verticais pequenas.
4. Header/sidebar global cobrindo o topo do bloco.
5. Padding do Card pai.
6. Botões absolutos do Subject/PreviewText (não é o Remetente, mas pode ser confundido).

**Bloqueador para Fase 1:** Sem repro real (screenshot ou descrição precisa do Danilo), Task 7 não tem alvo concreto. Opções:
- (a) Danilo fornece screenshot/viewport/passos antes da Fase 1 começar.
- (b) Aplicar **fix preventivo de baixo risco**: trocar `sm:grid-cols-2` → `md:grid-cols-2` + adicionar `min-w-0` nos FormItem filhos. Cobre o suspeito mais provável (#1) sem regressão desktop. Aceitável?

---

## 3. Auditoria das 19 `*-columns.tsx`

### Matriz consolidada

| # | Arquivo | Date format | Actions | Badges | Numeric | Selection | Widths fixos | Cond. cols | Sev. | Esforço | Augusto-touched | **Decisão** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | labels/labels-columns.tsx | `toLocaleDateString` | tooltip+button | sem | N/A | no | — | no | P2 | S | no | _[ ]_ |
| 2 | messages/messages-columns.tsx | `toLocaleDateString` | tooltip+button | `MessageStatusBadge` (variant secondary) | N/A | no | — | sim (ternário) | P1 | S | no | _[ ]_ |
| 3 | tags/tags-columns.tsx | N/A | tooltip+button | `Badge variant="secondary"` | N/A | no | — | no | P2 | S | no | _[ ]_ |
| 4 | automations/automations-columns.tsx | `toLocaleDateString` | tooltip+button | `Badge variant={ternário}` | N/A | no | — | no | P2 | S | no | _[ ]_ |
| 5 | twofa-messages/twofa-messages-columns.tsx | `toLocaleDateString` | tooltip+button | sem | N/A | no | — | no | P2 | S | no | _[ ]_ |
| 6 | twofa-messages/twofa-groups-columns.tsx | N/A | tooltip+button | sem | `text-right` (sem tabular-nums) | no | — | no | P2 | S | no | _[ ]_ |
| 7 | custom-fields/custom-fields-columns.tsx | N/A | tooltip+button | `Badge variant="secondary"` | N/A | no | — | no | P2 | S | no | _[ ]_ |
| 8 | contacts/contacts-columns.tsx | **`formatDateTimeTz`** (custom) | tooltip+button | `Badge` outline+secondary | N/A | **sim** | `max-w-[200px]` (firstName) | sim (tags, lastInteraction) | **P1** | M | no | _[ ]_ |
| 9 | contacts/suppressions-columns.tsx | **`toLocaleString`** (com hora) | tooltip+button | sem | N/A | **sim** | — | no | **P1** | S | no | _[ ]_ |
| 10 | pools/pools-columns.tsx | N/A | tooltip+button | `Badge variant="secondary"` "Default" | N/A | no | `max-w-[300px]` (name) | no | P2 | S | no | _[ ]_ |
| 11 | **campaigns/campaigns-columns.tsx** | `toLocaleDateString` | **DropdownMenu** ⚠️ | **hardcoded `bg-[#xxx] text-[#xxx]`** (6 variantes) | `text-right tabular-nums` | no | `min-w-[116px]` (status) | sim (tags, messagesType) | **P0** | L | no | _[ ]_ |
| 12 | custom-events/custom-events-columns.tsx | `toLocaleDateString` | tooltip+button | sem | N/A | no | `max-w-[300px]` (name) | no | P2 | S | no | _[ ]_ |
| 13 | segments/segments-columns.tsx | `toLocaleDateString` | tooltip+button | `Badge variant={getStatusVariant}` + custom `ChannelCountCell` | `text-right` (sem tabular-nums) | no | `max-w-[300px]` (name) | **sim (5 channel cols via spread)** | **P1** | M | no | _[ ]_ |
| 14 | templates/templates-columns.tsx | `toLocaleDateString` | tooltip+button | sem | N/A | no | — | no | P2 | S | no | _[ ]_ |
| 15 | super-admin/accounts/accounts-columns.tsx | `toLocaleDateString` | tooltip+button | **`Badge variant="secondary"` + className override `bg-green-100`** | N/A | **sim** | — | no | **P1** | S | no | _[ ]_ |
| 16 | super-admin/users/users-columns.tsx | `toLocaleDateString` | tooltip+button | `Badge` outline+secondary mixed | N/A | **sim** | — | no | **P1** | S | no | _[ ]_ |
| 17 | email-statistics/use-per-user-columns.tsx | **`formatDateFull`** (custom) | N/A | sem | `text-right tabular-nums` | no | — | no | P1 | S | no | _[ ]_ |
| 18 | email-statistics/use-email-columns.tsx | **`formatDateFull`** (custom) | N/A (stats) | sem (StatsCell colore) | StatsCell custom | no | — | no | P1 | S | no | _[ ]_ |
| 19 | email-statistics/use-push-columns.tsx | **`formatDateFull`** (custom) | N/A | sem | `text-right tabular-nums` (parcial) | no | — | no | P1 | S | no | _[ ]_ |

> **Coluna `Decisão` (para preencher pelo Danilo):**
> `approved-for-fix` · `spinoff` (vira ticket separado) · `wontfix` (intencional)

### Inconsistências agrupadas

**Actions style (17 inline vs 1 dropdown):**
- ✅ 17 arquivos = `Tooltip + Button` inline (padrão dominante).
- ❌ **campaigns-columns.tsx** = único com `DropdownMenu` (linhas das ações). Quebra expectativa de usuário.

**Date format (5 padrões coexistindo):**
- `toLocaleDateString` (sem hora) → 11 arquivos. **Baseline implícita.**
- `toLocaleString` (com hora) → 1 arquivo (suppressions). Inconsistência clara.
- `formatDateTimeTz` (custom, tz+locale) → 1 arquivo (contacts).
- `formatDateFull` (custom, locale) → 3 arquivos (email-statistics).
- N/A (sem datas) → 3 arquivos.
- **Recomendação:** padronizar em `toLocaleDateString` para tabelas de gerenciamento, manter `formatDateTimeTz` apenas em contexts onde fuso é relevante (contacts.lastInteraction?). Email-statistics fica isolado (semântica diferente).

**Badges (cores hardcoded são o pior offender):**
- ❌ **campaigns-columns.tsx** = `STATUS_STYLES` record com 6 variantes `bg-[#hex] text-[#hex]`. P0 do relatório.
- ⚠️ **accounts-columns.tsx** = `<Badge variant="secondary" className="bg-green-100 text-green-800">` — sobreescreve token.
- ✅ Demais usam `<Badge variant="…">` puro.

**Numeric alignment (parcialmente padronizado):**
- `text-right tabular-nums` → campaigns, use-per-user, use-push (parcial).
- `text-right` (sem tabular-nums) → segments (ChannelCountCell).
- Sem alinhamento → twofa-groups (números à esquerda, default).
- **Recomendação:** adicionar `tabular-nums` em segments + twofa-groups; criar util `<NumericCell>` para reuso.

**Selection column (4 arquivos):**
- ✅ Implementado: contacts, suppressions, super-admin/accounts, super-admin/users.
- ❌ Ausente em todos os outros 15 — provavelmente intencional (sem bulk actions).
- **Sem ação necessária**, salvo se Danilo quiser bulk delete em algum.

**Fixed widths (3 padrões coexistindo):**
- `max-w-[300px]` (name) → pools, custom-events, segments.
- `max-w-[200px]` (firstName) → contacts.
- `min-w-[116px]` (status badge) → campaigns.
- **Recomendação:** se for fixar, criar `COLUMN_WIDTH_LIMITS` em `data-table/constants.ts`. Não bloqueante.

---

## 4. Código herdado do Augusto (Task 4)

### ⚠️ Achado crítico

**Autor "Augusto" NÃO existe no histórico git desta branch / repo.**

```bash
$ git log --all --format='%aN' -- apps/frontend-react | sort -u
Danilo Leone
daniloleonecarneiro
Davidson Gomes
Guilherme Gomes
```

**Blame por arquivo (top P0/P1):**

| Arquivo | Linhas | Autor único |
|---|---|---|
| campaigns/campaigns-columns.tsx | 317 | **Davidson Gomes (100%)** |
| segments/segments-columns.tsx | 290 | **Davidson Gomes (100%)** |
| contacts/contacts-columns.tsx | 248 | **Davidson Gomes (100%)** |
| messages/components/email-content-form.tsx | 566 | Davidson Gomes (94%) + Guilherme Gomes (6%) |
| components/data-table/data-table.tsx | 130 | **Davidson Gomes (100%)** |

### Interpretações possíveis

1. **"Augusto" é um codinome/apelido** de uma pessoa real. Se sim, o mapeamento prático é com **Davidson Gomes** (autor majoritário).
2. **Código pre-git import:** o repo bms-monorepo-open-source pode ter sido criado a partir de outro projeto privado, e o autor original ("Augusto") não veio no transplante.
3. **Confusão narrativa:** a tech-spec usa "Augusto" como referência informal; o trabalho real será sobre código do Davidson.

### Implicação para a Fase 1

A coluna `Augusto-touched` ficou **"no"** em todos os arquivos da matriz (porque não há Augusto no git). Se a intenção era "marcar código suspeito de herança problemática", **o critério deve ser substituído por severidade técnica (P0/P1/P2)**, que é o que a Task 3 já produziu.

**Recomendação:** considerar a coluna Augusto-touched **deprecated** e usar a severidade P0/P1/P2 como guia da Task 5. Atualizar memória do projeto se "Augusto" era expectativa de aparecer no git.

---

## 5. Checkpoint — itens para Danilo aprovar

### Bloco A: Decisões de design (precisam de resposta)

- [ ] **A1.** Regra `preserveUserEdits` (Bug #1):
  - [ ] (i) Clique = overwrite (`false`); mount/programático = preserve (`true`) **[recomendado]**
  - [ ] (ii) Sempre preserve (`true` em todos os caminhos)
  - [ ] (iii) Sempre overwrite (`false` em todos os caminhos)

- [ ] **A2.** Bug #2 sem repro real:
  - [ ] (i) Eu (Danilo) forneço screenshot/passos antes da Fase 1 começar.
  - [ ] (ii) Aplicar fix preventivo de baixo risco (`md:grid-cols-2` + `min-w-0`) e validar manualmente.
  - [ ] (iii) Mover Bug #2 para spinoff e seguir Fase 1 só com Bug #1 + #3 + tabelas aprovadas.

### Bloco B: Itens da auditoria (marcar cada um)

Para cada linha da matriz da seção 3, marcar `approved-for-fix` / `spinoff` / `wontfix`.

**Recomendação enxuta** (considerando deadline 26/mai/2026 — 14 dias úteis até launch):

| Item | Recomendação | Justificativa |
|---|---|---|
| campaigns/campaigns-columns.tsx (P0) | **approved-for-fix** (split em 2 PRs) | Hardcoded badges = inconsistência visual percebível imediatamente. |
| suppressions/suppressions-columns.tsx (P1) | **approved-for-fix** | Fix de 1 linha (`toLocaleString` → `toLocaleDateString`), zero risco. |
| accounts/accounts-columns.tsx (P1) | **approved-for-fix** | Remover `className="bg-green-100…"` em favor de variant. 30min. |
| contacts/contacts-columns.tsx (P1 — date format) | **spinoff** | Decisão "tabelas usam datetime-tz ou só date" merece ticket separado com input UX. |
| segments/segments-columns.tsx (P1) | **spinoff** | Refactor do spread pattern é >1h e não é visualmente urgente. |
| users/users-columns.tsx (P1) | **approved-for-fix** | Acoplado a accounts — ambos no mesmo PR para consistência super-admin. |
| email-statistics/* (P1) | **wontfix** (no Fase 1) | StatsCell é semanticamente diferente; uniformizar agora vira coupling indevido. |
| Demais P2 (12 arquivos) | **wontfix** | Cosméticos sem impacto. Spinoff "tabelas — padronização" pós-launch se houver payback. |

### Bloco C: Confirmar premissas operacionais

- [ ] **C1.** Branch `danilocarneiro/evo-1022-correcoes-de-bugs-visuais-no-frontend` criada a partir de `main@fa3486c`. OK?
- [ ] **C2.** Active feature `evo-1022-correcoes-bugs-visuais-frontend` no config.yaml — OK (já alterado em sessão anterior).
- [ ] **C3.** Tasks 1-2 foram análise estática, não repro com dev server. OK ou refazer ao vivo antes da Fase 1?

---

## 6. Próximos passos (depende da aprovação)

Após Danilo preencher as decisões acima, executar Fase 1:

- Task 6: Auto-fill (depende A1).
- Task 7: Responsividade Remetente (depende A2).
- Task 8: Rename i18n Pool→Sender.
- Task 9: Fixes aprovados de tabelas (depende B).
- Task 10: Testes.
- Task 11: Smoke manual + regression.

**HALT até aprovação humana neste documento.**
