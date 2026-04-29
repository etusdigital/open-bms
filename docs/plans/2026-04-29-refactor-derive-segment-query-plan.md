# Refactor: derive segment query/externalQuerySteps in-memory

**Date:** 2026-04-29
**Status:** In progress (PR shape revisado 2026-04-29 — single PR, ver Decisions)
**Linear card:** [EVO-1016](https://linear.app/evoai/issue/EVO-1016/refactor-derive-segment-queryexternalquerysteps-in-memory-drop) (Urgent, In Progress, assigned: Guilherme)
**Branch:** `guilhermegomes/evo-1016-refactor-derive-segment-queryexternalquerysteps-in-memory`

## Objective

Eliminate `tags.query` and `tags.external_query_steps` as persisted columns. Both are caches of values fully derived from `tags.steps`. `steps` becomes the single source of truth; `query` and `externalQuerySteps` are computed in memory at execution time.

## Current state

### Producer (msgops-api)

- `apps/msgops-api/src/modules/tags/tags.service.ts:340 generateSegmentQuery` — V1 generator. Builds the Postgres SQL and pushes ClickHouse subqueries onto `externalQuerySteps`.
- `apps/msgops-api/src/modules/tags/builder/query-builder.provider.ts:18 generateSegmentQueryV2` — V2 generator. Same shape, gated by `migrationAccounts = [65, 22, 60, 61]` (`tags.service.ts:27`).
- Call sites: `tags.service.ts:createSegment` (lines 219–221) and `updateSegment` (lines 276–280). Both persist the result back into `tags.query` and `tags.external_query_steps`.

### Reader (downstream)

- `apps/tag-process/src/app.service.ts:217-218` — sole consumer of the persisted values. Applies `formattedTimeQuery` (placeholder substitution) and forwards into `processSegment`.
- `apps/tag-process/src/msgops/msgops.service.ts:473 getTagById` — loads the full `tags` row, including `steps`, `query`, `external_query_steps`.

### Schema (`tags` table)

- `steps` (jsonb) — input from segment builder. Source of truth. Present.
- `query` (text, `select: false`) — derived. Present.
- `external_query_steps` (json, `select: false`) — derived. **Absent in current OSS DB** (entity↔migration drift; this is the immediate blocker that triggered the refactor).

### Frontend

- No UI input touches any of the three derived fields.
- No GET endpoint returns `query` or `externalQuerySteps` to the frontend.

## Target state

- `steps` is the only persisted segment-filter column.
- A single function generates `{ query, externalQuerySteps }` from `(tag, segmentDto, accountConfig)`. Pure, no service deps.
- Function lives in a shared package, imported by `msgops-api` (for any case that needs the SQL eagerly — none today, but kept available) and by `tag-process` (the actual consumer).
- Entities in both apps drop `query` and `externalQuerySteps`.
- Postgres columns dropped via migration.

## Steps

> **Forma de entrega: 1 PR único, atomic.** OSS é instalação atomic (docker-compose / `git pull && up`); não existe rolling deploy entre msgops-api e tag-process pra justificar PRs sequenciais. Tentar fatiar bloqueia validação end-to-end (AC1 e AC3 só fazem sentido com producer + consumer + drop columns juntos).

> **Estado atual da branch (2026-04-29 — pós code-review):** Steps 0–5 concluídos. Specs do pacote adicionados (`generator-v1.spec.ts`, `generator-v2.spec.ts`, `index.spec.ts`, 16 specs passando). Benchmark AC2 rodado: p95 = 0.003ms (target <50ms — PASS). Veja `docs/benchmarks/segment-query-builder-ac2.md`.

0. **Pre-flight (concluído 2026-04-29).** Greps de hidden consumers + git log -S + frontend non-usage confirmados. Resultado completo no comment da [EVO-1016](https://linear.app/evoai/issue/EVO-1016). Achado novo: field `externalQuerySteps?: any` no `segments.dto.ts:52` entrou no escopo (Step 2).

1. **Extract generator to shared package.** ✅ DONE
   - `packages/segment-query-builder/` criado com `generator-v1.ts`, `generator-v2.ts`, `parse-event-type.ts`, `types.ts`, `index.ts`.
   - Single entry point recebe `migrationAccounts: number[]` como argumento (V1/V2 gating preservado).
   - msgops-api `tags.service.ts` e `query-builder.provider.ts` reduzidos a delegação.

2. **Update `msgops-api` write path.** ✅ DONE
   - `createSegment` e `updateSegment` param de chamar o generator. Persistem só `steps` e demais não-derivados.
   - Remover `query` e `externalQuerySteps` dos payloads de `update(...)` em `tags.service.ts`.
   - Drop dos `@Column` para `query` (`tag.entity.ts:35-36`) e `externalQuerySteps` (`tag.entity.ts:41-42`).
   - Remover field `externalQuerySteps?: any` do `apps/msgops-api/src/modules/tags/dto/segments.dto.ts:52` (achado no Step 0; não-breaking).

3. **Update `tag-process` worker.** ✅ DONE
   - Em `app.service.ts:217-218`, trocar leituras diretas de `segment.query` / `segment.externalQuerySteps` por chamada ao `generate()` do package, passando o `segment` (já carrega `steps`) e o `account` resolvido.
   - Drop dos `@Column` `query` (`tag-process/msgops/entities/tag.entity.ts:28-29`) e `externalQuerySteps` (`tag-process/msgops/entities/tag.entity.ts:64-65`).

4. **Migration.** ✅ DONE
   - Nova migration: `ALTER TABLE tags DROP COLUMN IF EXISTS "query"`, `ALTER TABLE tags DROP COLUMN IF EXISTS "external_query_steps"`.
   - Sem `down` — derived data, irreversível por design. Reversão = `git revert` do PR.

5. **Tests & Acceptance Criteria.** ✅ DONE
   - Atualizar `tags.service.spec` (msgops-api) e `app.service.spec` (tag-process) para a nova API.
   - **AC1 — Equivalência de comportamento.** Para 3 segmentos amostrais, `contactCount` pré- e pós-refactor são idênticos:
     - (a) segmento simples (só steps internos Postgres).
     - (b) segmento com pelo menos 1 step ClickHouse (external query).
     - (c) segmento de account em `migrationAccounts` (caminho V2).
     - Snapshot do SQL gerado também batendo byte-a-byte com a versão persistida hoje.
   - **AC2 — Performance.** Benchmark obrigatório: `generate()` no maior segmento de produção em <50ms p95 sobre 1000 execuções. Resultado anexado ao PR.
   - **AC3 — Unblock OSS install.** Em instalação OSS limpa (sem coluna `external_query_steps`), criar e processar um segmento end-to-end sem erro. Fecha o blocker que originou o refactor.

## Risks

1. **`external_query_steps` is missing from the local DB now** — this is the bug that surfaced the refactor. If this plan ships next, the drop migration handles it. If the plan is delayed, an interim ad-hoc patch is needed.
2. **Performance.** Worker today reads pre-computed values; deriving on each execution adds the cost of `generateSegmentQuery`. The work is pure JSON/string assembly (no IO), expected to be sub-millisecond. Confirm with a benchmark on the largest production segment if doubt remains.
3. **Hidden consumers.** _Mitigação movida para Step 0 (Pre-flight) como ação obrigatória, não risco passivo._
4. **`select: false` and TypeORM INSERT behavior.** The columns are marked `select: false` but TypeORM still lists them in INSERT statements — this is why a missing column blocks inserts entirely. Once the columns are dropped from the entity, generated INSERTs no longer reference them. Verify with a probe insert after step 2.
5. **`migrationAccounts` hardcoding.** `[65, 22, 60, 61]` is a half-finished V1→V2 migration. This refactor preserves the gating as an argument; unifying V1/V2 is out of scope and tracked separately.

## Decisions (resolvidas 2026-04-29)

1. **Package location** → `packages/segment-query-builder/` (novo). `packages/messaging/` é domínio de envio; segmentação é boundary distinto.
2. **V1/V2 unification** → fora de escopo. Gating preservado via parâmetro `migrationAccounts: number[]`. Unificação tracked separadamente.
3. **PR shape** → **1 PR único, atomic** (revisado 2026-04-29 — substitui a proposta inicial de 3 PRs sequenciais).
   - **Por quê mudou:** o plano de 3-PR + janela de 24h entre b/c é padrão de rolling deploy SaaS. BMS OSS é instalação atomic (docker-compose), não há produção rolando versões mistas dos serviços. Fatiar bloqueia validação end-to-end (AC1 e AC3 só são verificáveis com producer + consumer + drop columns no mesmo release). Reversibilidade preservada via `git revert` do PR único.
   - **Implicação:** entrega vai num único PR contendo Steps 1–5. Step 1 já está commitado nesta branch.

## Out of scope

- ClickHouse availability for OSS deployments. The tag-process worker still needs ClickHouse to execute external query steps; this refactor does not change that. It only changes when/where the query is built, not whether it runs.
- Erradication of `migrationAccounts` gating.
- The broader entity↔migration drift in the codebase (other fields with the same problem class).
