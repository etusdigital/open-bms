---
title: 'Split Sender identity from IP Pool + SendGrid verified-sender sync'
slug: 'sender-pool-split'
created: '2026-05-15'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
revisionNote: 'Adversarial review (R) — 8 findings processed. F1/F2/F6 (High/Med) addressed in T10/T13/T14; F4/F5/F8 in ACs/T5; F7 traced as not-affected (noise). D13 (F3 operational policy) ratified by Guilherme 2026-05-15 → status promoted to ready-for-dev.'
linearIssue: 'EVO-1281'
featureBranch: 'guilhermegomes/evo-1281-sender-pool-split'
tech_stack: ['NestJS', 'TypeORM', 'PostgreSQL', 'React + TanStack Query', 'Vitest', 'Jest', 'SendGrid v3 API']
files_to_modify:
  - apps/msgops-api/src/entities/sender.entity.ts (new)
  - apps/msgops-api/src/migrations/<epoch>-split-sender-from-pool.ts (new)
  - apps/msgops-api/src/modules/senders/* (new module)
  - apps/msgops-api/src/entities/pool.entity.ts
  - apps/msgops-api/src/modules/pools/pools.service.ts
  - apps/msgops-api/src/modules/services/services.service.ts
  - apps/msgops-api/src/modules/postmaster/postmaster.service.ts
  - apps/frontend-react/src/features/senders/* (new, split from pools)
  - apps/frontend-react/src/features/pools/*
  - apps/frontend-react/src/features/messages/use-messages.ts
  - apps/frontend-react/src/features/messages/components/email-content-form.tsx
  - apps/frontend-react/src/features/messages/messages-page.tsx
  - apps/frontend-react/src/features/email-statistics/use-filter-options.ts
  - apps/frontend-react/src/features/settings/pool-tab.tsx
  - apps/frontend-react/src/features/settings/pool-gateway.ts
  - apps/frontend-react/src/features/settings/pool-sendgrid-gateway.ts
  - apps/msgops-api/src/modules/messages (stats query for D11 — verify)
code_patterns: ['Entity glob auto-discovery', 'cls.get(accountId) scoping', 'nestjs-joi DTO', 'raw-SQL migrations', 'TanStack Query hooks']
test_patterns: ['Jest @nestjs/testing jest.Mocked', 'Vitest jsdom + vi.mock api-client']
---

# Tech-Spec: Split Sender identity from IP Pool + SendGrid verified-sender sync

**Created:** 2026-05-15
**Linear:** [EVO-1281](https://linear.app/evoai/issue/EVO-1281/separar-identidade-de-sender-do-ip-pool-sincronizar-verified-senders)

## Overview

### Problem Statement

A entidade `pool` (`apps/msgops-api/src/entities/pool.entity.ts`, `@Entity('pools')`)
funde dois conceitos ortogonais da SendGrid: **identidade de remetente** (Single Sender
Verification — `sender_email`, `sender_name`, `sender_replyto_email`) e **IP Pool**
(`pool_name`, `ip`). Essa fusão foi a raiz do EVO-1280 (vazamento do nome do sender
como IP Pool). Além disso, o operador cadastra o sender manualmente na SendGrid **e**
no sistema, mantendo os dois sincronizados à mão.

### Solution

Split físico: nova entidade/tabela `senders` (identidade pura), `pool` reduzida a IP
pool. Endpoint one-way `POST /senders/sync` materializa os verified senders da SendGrid
(via `SendgridHandler.getVerifiedSenders()`, já existente) como registros `sender`
editáveis (limite + reply-to locais). Send path passa a resolver reply-to via `sender`.

### Scope

**In Scope:**
- Entidade + tabela `senders`.
- Migration de schema **sem backfill**: cria `senders`; remove colunas de identidade de
  `pools` (`sender_email`, `sender_name`, `sender_replyto_email`).
- `SendersModule` (controller + service + DTOs) espelhando o padrão de `pools`.
- `POST /senders/sync` (escopo de conta, `account_configs.sendgrid_key`).
- Refactor `services.service.ts` (L63/L66) e `postmaster.service.ts` (L14-15/L23/L26).
- Frontend: nova feature `senders` (split de `pools`); repontar picker de From em
  `messages` (`usePoolsForSelect` → `useSendersForSelect`).

**Out of Scope:**
- Domain Authentication (≠ Single Sender Verification).
- Redesign da tela de IP Pool (só a identidade sai dela).
- Tabela de mapeamento default sender → IP pool (adiada).
- Sync bidirecional (somente pull SendGrid → sistema).
- Retrocompatibilidade / backfill (staging re-sincroniza da SendGrid).

## Context for Development

### Codebase Patterns

- **Entities**: TypeORM, `@Entity('<table>')` com `name:` snake_case explícito em todo
  `@Column`. PK `@PrimaryGeneratedColumn({ type:'int', name:'id' })`.
  `@CreateDateColumn`/`@UpdateDateColumn`/`@DeleteDateColumn` `timestamptz`. Hook
  `@BeforeUpdate()` setando `updatedAt`. Auto-discovery por glob em
  `apps/msgops-api/src/database/data-source.ts:16` — **não há array central**; só
  registrar repo via `TypeOrmModule.forFeature([SenderEntity])` no módulo.
- **Migrations**: `apps/msgops-api/src/migrations/<epoch-ms>-<kebab>.ts`, classe
  PascalCase + sufixo timestamp, `implements MigrationInterface`, `up/down` com
  `queryRunner.query(\`CREATE TABLE IF NOT EXISTS ...\`)` / `DROP TABLE IF EXISTS`
  (ref: `1778784000000-create-table-segment-process.ts`).
- **Scoping**: feito no service via `this.cls.get('accountId')` (não no controller).
- **DTO**: `nestjs-joi` `@JoiSchema(Joi...)` + `@ApiProperty`,
  `@JoiSchemaOptions({ stripUnknown:true })` (ref `new-pool.dto.ts`).
- **SendGrid key**: `SendgridHandler.loadApiKey(accountId)` (L49-61) →
  `accountConfigsProvider.getByAccountId(accountId, 'sendgrid_key')`, cache 60s.
  Estritamente por conta, sem fallback de plataforma.
- **Verified sender shape** (`getVerifiedSenders()` L479-495, retorna
  `data.results[]`): campos usados hoje = `id`, `from_email`, `from_name`. SendGrid
  também expõe `reply_to`/`verified` (não referenciados no código atual).
- **Frontend**: TanStack Query (`use-pools.ts`), `apiClient`, `queryKeys`,
  `useAppStore` auth-gate. Picker de From: `usePoolsForSelect()` em
  `features/messages/use-messages.ts:175-190` → `GET /pools?page=1&itemsPerPage=1000`;
  `email-content-form.tsx` prefilla `fromName/fromMail/replyTo` de
  `pool.senderName/senderEmail/senderReplyTo`, match por `poolName`+`senderEmail`
  (L96/99/102, L117-119).

### Files to Reference

| File | Purpose |
| ---- | ------- |
| apps/msgops-api/src/entities/pool.entity.ts | Modelo a espelhar; remover campos de identidade |
| apps/msgops-api/src/database/data-source.ts:16-17 | Glob de entities/migrations (sem array) |
| apps/msgops-api/src/migrations/1778784000000-create-table-segment-process.ts | Convenção de migration raw-SQL |
| apps/msgops-api/src/handlers/email/sendgrid/sendgrid.handler.ts:479-500 | `getVerifiedSenders()` / `getSenderByNameEmail()` |
| apps/msgops-api/src/modules/pools/{pools.controller,pools.service,pools.module,new-pool.dto}.ts | Padrão CRUD/permissão/DTO a espelhar |
| apps/msgops-api/src/modules/services/services.service.ts:51-66 | Repoint reply-to via sender |
| apps/msgops-api/src/modules/postmaster/postmaster.service.ts:14-26 | 2º consumidor (raw SQL sender_email) |
| apps/frontend-react/src/features/pools/* | Split de UI (identidade sai) |
| apps/frontend-react/src/features/messages/use-messages.ts:175-190 | `usePoolsForSelect` → senders |
| apps/frontend-react/src/features/messages/components/email-content-form.tsx | Prefill From; match logic |

### Technical Decisions

1. Split físico real (não separação só lógica). — Guilherme, 2026-05-15
2. Sender e IP Pool 100% desacoplados; **sem** FK `sender.poolId`. Roteamento de IP
   pool segue resolvido no send path (`services.service.ts:54` `findOneByPool` intacto).
3. Sem retrocompat / sem backfill — staging re-sincroniza da SendGrid.
4. Sync one-way; idempotência por `sg_verified_sender_id` (preferencial) com fallback
   de match por `sender_email` quando o id ainda não existir localmente.
5. `sending_limit` permanece **em ambas** as entidades (`sender` e `pool`).
6. Re-sync: cria novos; **preserva** `sending_limit`/`sender_replyto_email` locais dos
   existentes; ausentes na SendGrid recebem `removed_at_source = now()` (sem apagar).
7. `POST /senders/sync` escopo de conta, usa `sendgrid_key` da conta logada.
8. **[RATIFICADA — Guilherme, 2026-05-15]** `is_default` vai para `sender`
   (default sender de identidade) e **permanece também** em `pools` (default IP pool),
   coerente com a filosofia da decisão #5. Removível de um lado depois sem custo.
9. **[RATIFICADA — Guilherme, 2026-05-15]** Reusar as permissões existentes
   `infra:pools_read` (GET) e `infra:manage` (POST/PUT/DELETE/sync) para o controller
   de `senders`, evitando seeding/migração de RBAC no caminho crítico do launch.
10. **[RATIFICADA — Guilherme, 2026-05-15]** No **create** do sync, semear
    `sender_replyto_email` a partir do `reply_to` do verified sender da SendGrid quando
    presente; **nunca** sobrescrever em re-sync (preserva edição local — decisão #6).
11. **[RATIFICADA — Guilherme, 2026-05-15]** Filtro de estatística em
    `messages-page.tsx` hoje filtra por `poolName` (param `ipPool`) rotulado com
    `senderEmail`. Pós-split proponho **filtrar por sender** (value=`senderEmail`,
    label=`senderEmail`, via `/senders`), já que o usuário pensa em "remetente", não em
    IP pool. Alternativa: manter filtro por `ipPool` (value=`poolName`) com label
    genérico do pool. Decisão afeta a query de stats no backend — confirmar.
12. **[NOTA]** A interface `Pool` do frontend tem `dailyLimit` que **não** existe na
    `pool.entity.ts`. Tratado como atributo de **IP pool** (throughput do pool) →
    **permanece em `pools`**, não migra para `sender`. Sinalizar se a intenção for outra.
13. **[RATIFICADA — Guilherme, 2026-05-15 | F3 da adversarial review]** Janela
    operacional do split sem backfill: entre rodar a migration (derruba identidade de
    `pools`) e o operador clicar **Sincronizar**, todo envio **sem `ippool`** resolve
    `replyTo` via `sender` que ainda **não existe** → cai no fallback
    `from.email` (não há perda de envio, mas o reply-to configurado some até o sync).
    `down()` é destrutivo (não restaura dados). **Proposta:** tornar `POST /senders/sync`
    um **passo obrigatório do runbook de deploy** desta feature (deploy → migration →
    sync por conta → validar), documentado em `docs/`/handoff, e **não** tratar `down()`
    como rollback real (forward-fix only). Confirmar esta política operacional.

## Implementation Plan

### Tasks

> Ordenadas por dependência (camada mais baixa primeiro). Backend antes de frontend.

**T1 — Entidade `SenderEntity`**
`apps/msgops-api/src/entities/sender.entity.ts` (novo). Espelhar exatamente o estilo de
`pool.entity.ts`: `@Entity('senders')`; colunas `id` (PK int), `sender_email`
varchar(255), `sender_name` varchar(60), `sender_replyto_email` varchar(255) nullable,
`sending_limit` int nullable, `account_id` int, `is_default` boolean default false,
`sg_verified_sender_id` varchar(255) nullable, `removed_at_source` timestamptz nullable;
`created_at`/`updated_at`/`deleted_at` timestamptz; hook `@BeforeUpdate()`. Sem relações.
Auto-discovery via glob — nenhum array a editar.

**T2 — Migration split**
`apps/msgops-api/src/migrations/<epoch-ms>-split-sender-from-pool.ts` (novo). `up`:
`CREATE TABLE IF NOT EXISTS senders (...)` espelhando T1 + índices em
(`account_id`,`sender_email`) e (`account_id`,`sg_verified_sender_id`); depois
`ALTER TABLE pools DROP COLUMN IF EXISTS sender_email, DROP COLUMN IF EXISTS
sender_name, DROP COLUMN IF EXISTS sender_replyto_email`. `down`: recria as 3 colunas em
`pools` e `DROP TABLE IF EXISTS senders`. Sem backfill (decisão #3).

**T3 — `SendersModule`**
`apps/msgops-api/src/modules/senders/` (novo): `senders.module.ts`
(`TypeOrmModule.forFeature([AccountConfigEntity, SenderEntity])`, providers
`[AccountConfigsProvider, SendersService, SendgridHandler]`, `exports:[SendersService]`),
`senders.service.ts`, `senders.controller.ts`, `senders.dto.ts`, `new-sender.dto.ts`.
Registrar `SendersModule` no módulo raiz onde `PoolsModule` é importado (espelhar).

**T4 — `SendersService` CRUD + `findOneBySenderEmail`**
Espelhar `pools.service.ts`: scoping por `cls.get('accountId')`, soft-delete manual.
Implementar `findOneBySenderEmail(senderEmail, accountId)` (mover semântica de
`pools.service.ts:141-143` para `SenderEntity`). Update permite editar apenas
`sending_limit` e `sender_replyto_email`.

**T5 — `SendersService.syncFromSendgrid()` + `POST /senders/sync`**
Controller: `@Post('/sync')` `@RequirePermission('infra:manage')` (decisão #9).
⚠️ **CLS (F5):** a rota **não** pode ser `@PublicRoute()` e deve ficar sob os guards
globais (`PrincipalContextGuard` seta `accountId` em CLS —
`principal-context.guard.ts:44`; `ClsMiddleware` em `app.module.ts:81` `forRoutes('*')`).
`SendgridHandler.loadApiKey` resolve a key via `cls.get('accountId')`; fora desse
contexto a key vem vazia. Não expor o sync como cron/job sem `accountId` explícito.
Service: `accountId = cls.get('accountId')`; `remote = await
sendgridHandler.getVerifiedSenders()` (key resolvida por conta internamente);
`local = repo.find({ where:{ accountId } })`. Para cada `remote` (match por
`sg_verified_sender_id` senão `sender_email`): se não existe → cria
(`sg_verified_sender_id=id`, `sender_email=from_email`, `sender_name=from_name`,
`sender_replyto_email=reply_to ?? null`, `account_id=accountId`); se existe →
**não** sobrescreve `sending_limit`/`sender_replyto_email`, limpa `removed_at_source`
se estava setado. Locais sem correspondente remoto → `removed_at_source=now()` (não
apagar). Retorna `{ created, updated, removed }` counts.

**T6 — Refactor `services.service.ts`**
L63: trocar `this.poolService.findOneBySenderEmail(...)` por
`this.sendersService.findOneBySenderEmail(from.email, account.id)`. L66:
`pool?.senderReplyTo` → `sender?.senderReplyTo`. L54 (`findOneByPool` para `ippool`)
**permanece intacto** (é IP pool, decisão #2). Injetar `SendersService`; remover
dependência de identidade do `poolService`.

**T7 — Refactor `postmaster.service.ts`**
L14-15: injetar `@InjectRepository(SenderEntity)` no lugar de `PoolEntity` (ou ambos se
o serviço ainda usa pool para IP). L23/L26: raw SQL `substring(sender_email from
'@(.*)$')` repontar de `pools` para `senders`. Validar que nenhuma outra query do
arquivo depende de campos de identidade em `pools`.

**T8 — Frontend: nova feature `senders`**
`apps/frontend-react/src/features/senders/` espelhando `pools/`: `use-senders.ts`
(TanStack, `GET/POST/PUT/DELETE /senders`, `POST /senders/sync`), `senders-page.tsx`
com botão **Sincronizar** (chama sync, invalida query, toast `sonner`),
`sender-form.tsx`/`sender-schema.ts` editando só `sendingLimit`/`senderReplyTo`,
`senders-columns.tsx`, `types.ts`.

**T9 — Frontend: podar `pools` (identidade sai)**
Remover `senderEmail/senderName/senderReplyTo/isDefault` de `features/pools/types.ts`,
`pool-schema.ts`, `pool-form.tsx`, `pool-form-page.tsx`, `pools-columns.tsx`. `pools`
fica só IP pool.

**T10 — Frontend: repontar picker de From (F1 — desacoplar de `ippool`)**
`features/messages/use-messages.ts:175-190`: adicionar `useSendersForSelect()` →
`GET /senders?page=1&itemsPerPage=1000`. `email-content-form.tsx` (verificado):
- `applyPoolDefaults` (L88-105) hoje faz **`form.setValue('ippool', pool.poolName)`**
  na **L93** além de prefill `fromName/fromMail/replyTo`. Sender **não tem `poolName`**.
  Decisão: o picker de From passa a **NÃO** mais setar `ippool` (identidade ≠ IP pool —
  decisão #2). Remover a L93 do path do picker; `ippool` continua selecionável
  separadamente onde já existe (campo/feature de IP pool), não derivado do sender.
- `handlePoolChange` (L107-110) → `handleSenderChange`, casando por `sender.id`.
- Bloco "Programmatic sync" (a partir de ~L125, `currentPoolId` via match
  `p.poolName === ippoolValue && p.senderEmail === fromMailValue`, L116-122):
  reescrever para resolver o sender atual por `senderEmail === fromMailValue`
  **apenas** (sem `poolName`); `ippool` deixa de participar do match do picker.
- Validar fluxos edit/duplicate/deep-link: hoje quando `ippool` vem preenchido o form
  auto-resolvia o pool; pós-split esse auto-fill passa a ser por `fromMail`. **Testar
  regressão de edição de mensagem existente.**

**T11 — Frontend: filtro de stats + demais consumidores**
- `features/email-statistics/use-filter-options.ts:114-126` `useSenderOptions()` →
  hoje `GET /pools` por `senderEmail`. Repontar para `GET /senders` (label
  `senderEmail`). **Task obrigatória.**
- `features/messages/messages-page.tsx:98-113` — filtro de stats via
  `usePoolsForSelect`: `value=poolName` (param `ipPool` da query de stats),
  `label=senderEmail`. Por **decisão #11 (ratificada)**: passa a filtrar por **sender**
  (`value=senderEmail`, `label=senderEmail`, via `useSendersForSelect`). A mudança de
  semântica do filtro exige ajuste **no backend da query de stats** → ver **T14**.
- `features/messages/components/inbox-preview.tsx` — `senderName` é prop de componente
  apresentacional (não busca dado). **Nenhuma mudança** (pai = `email-content-form`,
  coberto em T10).

**T13 — Frontend: settings/pool-tab (F2 — consumidor faltante)**
`features/settings/pool-tab.tsx` (L41-43, 96-100, 152-153, 171-174, 276-301) +
`pool-gateway.ts` (interface `Pool`/`PoolPayload` com `senderEmail/Name/ReplyTo/
isDefault`) + `pool-sendgrid-gateway.ts`: UI de settings que **lê e grava** identidade
no pool. Pós-migration o backend rejeita/ignora esses campos. Decisão: extrair a parte
de identidade dessa aba para consumir o endpoint `/senders` (ou mover a config de
identidade para a nova feature `senders` de T8 e deixar `pool-tab` só com IP pool).
Remover `senderEmail/senderName/senderReplyTo` de `pool-gateway.ts`
`Pool`/`PoolPayload`. **Task obrigatória — não estava no escopo inicial; descoberta na
adversarial review (F2).**

**T14 — Backend: query de stats por sender (F6 / decisão #11)**
Anchors verificados: o param do filtro de stats é `ipPool` em
`apps/msgops-api/src/modules/messages/dto/messages-page.dto.ts` e é consumido em
`apps/msgops-api/src/modules/messages/messages.service.ts` (não existe módulo
`statistics` dedicado). Adaptar **apenas** o caminho de **consumo do filtro de
estatística** para aceitar/filtrar por `senderEmail` (label/idem).
⚠️ **Escopo crítico:** `ippool`/`ipPool` aparece em ~9 arquivos
(`sendgrid.handler.ts`, `handlers/email/sendgrid/message.ts`, `services.service.ts`,
`tests.service.ts`, etc.). T14 **NÃO** pode tocar o `ippool` do **send path** (decisão
#2 — IP pool real continua resolvido por `findOneByPool`). Mudar só o filtro de stats.
Dev deve confirmar com `grep -rn "ipPool" apps/msgops-api/src/modules/messages` que a
alteração fica contida em messages-page.dto + a query de stats correspondente.
**Task obrigatória — depende de D11.** *(Nota: se a investigação revelar que o filtro
de stats está acoplado a mais de um consumidor, D11 é maior que o ratificado —
sinalizar a Guilherme antes de implementar.)*

**T15 — Testes** (executar por último; depende de T1–T14)
Backend (Jest `@nestjs/testing`, `jest.Mocked`, repo `jest.fn()`): specs para
`senders.service` (CRUD, `findOneBySenderEmail`, `syncFromSendgrid` —
create/preserve/removed **+ caso de `from_email` duplicado**, F4) e atualizar
`services.service.spec.ts` (mockar `sendersService`; manter guarda EVO-1280). Frontend
(Vitest jsdom, `vi.mock('@/lib/api-client')`, `createQueryWrapper`+`authenticateStore`):
`use-senders.test.ts`, regressão de `email-content-form` (edição de mensagem existente,
F1) e atualizar testes de `pools`/`messages`/`settings` afetados.

> Ordem de dependência: T1→T2→T3→T4→T5→T6→T7 (backend) → T8→T9→T10→T11→T13 (frontend)
> → T14 (backend stats, depende de D11) → T15 (testes).

### Acceptance Criteria

**AC1 — Entidade/tabela**
Given a migration executada, When inspeciono o schema, Then existe tabela `senders` com
as colunas de identidade + `sg_verified_sender_id`/`removed_at_source` e a tabela
`pools` **não** contém mais `sender_email`/`sender_name`/`sender_replyto_email`.

**AC2 — Sync cria**
Given conta com `sendgrid_key` válida e 3 verified senders na SendGrid e nenhum sender
local, When `POST /senders/sync`, Then 3 registros `sender` são criados com
`sg_verified_sender_id`/`sender_email`/`sender_name` da SendGrid e retorno
`{created:3,updated:0,removed:0}`.

**AC3 — Re-sync preserva config local**
Given um sender local com `sending_limit=500` e `sender_replyto_email` editado, When
re-sincronizo e ele ainda existe na SendGrid, Then `sending_limit` e
`sender_replyto_email` permanecem inalterados.

**AC4 — Sender removido na origem**
Given um sender local cujo verified sender foi removido da SendGrid, When re-sincronizo,
Then o registro recebe `removed_at_source` setado e **não** é deletado.

**AC5 — Send path resolve reply-to via sender**
Given uma mensagem sem `ippool` cujo `from.email` casa com um `sender` que tem
`sender_replyto_email`, When o envio é processado em `services.service.ts`, Then o
`replyTo` publicado é o do `sender` (não há leitura de identidade em `pools`).

**AC6 — Escopo de conta**
Given dois accounts, When account A faz `POST /senders/sync`, Then só senders de A são
criados/afetados (scoping por `cls.get('accountId')`).

**AC7 — Picker de From**
Given a tela de criação de mensagem, When seleciono um sender no picker, Then
`fromName/fromMail/replyTo` são preenchidos a partir do `sender` (endpoint `/senders`),
e nenhuma chamada a `/pools` alimenta o picker.

**AC8 — IP pool intacto**
Given uma mensagem **com** `ippool`, When processada, Then a resolução de IP pool via
`findOneByPool` continua funcionando (sem regressão EVO-1280).

**AC9 — Picker não dirige mais ippool (F1)**
Given a tela de mensagem, When seleciono um sender no picker, Then `ippool` **não** é
alterado pela seleção do sender; And editar/duplicar uma mensagem existente com
`ippool` setado preenche From por `fromMail` sem quebrar a seleção.

**AC10 — `from_email` duplicado (F4)**
Given a SendGrid retorna 2 verified senders com mesmo `from_email` e nomes distintos,
When `POST /senders/sync` (1ª vez, sem ids locais) e depois re-sync, Then são criados
**2** registros distintos (chave efetiva = `sg_verified_sender_id`), sem colisão nem
duplicação na 2ª execução.

**AC11 — Settings tab sem identidade em pool (F2)**
Given a aba de settings de pool pós-migration, When salvo um pool, Then nenhum campo de
identidade (`senderEmail/senderName/senderReplyTo`) é enviado para o backend de `pools`;
And a config de identidade é feita via `/senders`.

**AC12 — Sistema funcional pós-migration antes do 1º sync (F3)**
Given a migration aplicada e **nenhum** sync executado ainda, When uma mensagem sem
`ippool` é enviada, Then o envio **não falha** — `replyTo` cai no fallback
`from.email`; And o runbook documenta o sync como passo obrigatório pós-deploy (D13).

## Additional Context

### Dependencies

- `SendgridHandler.getVerifiedSenders()` (L479-495) — reusar, não criar chamada nova.
- `AccountConfigsProvider` / `account_configs.sendgrid_key` por conta.
- `ClsService` para `accountId`.

### Testing Strategy

- Backend: Jest + `Test.createTestingModule`, deps como `jest.Mocked<T>`, repos
  mockados com `jest.fn()`, fixtures como literais de entidade (padrão de
  `services.service.spec.ts:45`). Cobrir os 3 ramos do sync (create/preserve/removed)
  e o repoint de reply-to.
- Frontend: Vitest `// @vitest-environment jsdom`, `@testing-library/react`
  `renderHook`/`waitFor`, `vi.mock('@/lib/api-client')`, `createQueryWrapper` +
  `authenticateStore` de `@/test-utils` (padrão de `use-pools.test.ts`).
- Regressão obrigatória: rodar a suíte de `services.service.spec.ts` (guarda EVO-1280).

### Notes

- Risco de janela de launch (2026-05-26) **assumido explicitamente** por Guilherme:
  migration + refactor de send path no caminho crítico.
- **Decisões #8–#11 ratificadas — Guilherme, 2026-05-15.** Aprovadas sem alteração.
- **Adversarial review (Step 4 [R]) — 2026-05-15, contexto isolado.** 8 findings:
  - **F1 (High, real)** → endereçado em T10/AC9 (picker desacoplado de `ippool`).
  - **F2 (High, real)** → endereçado em T13/AC11 (`settings/pool-tab` + gateways).
  - **F3 (High, real)** → **D13 aberta** (política operacional do sync) + AC12. **Bloqueia
    `ready-for-dev` até ratificação.**
  - **F4 (Med, real)** → AC10 + caso de teste em T15 (`from_email` duplicado).
  - **F5 (Low, real)** → constraint documentada abaixo (sync só em request/CLS scope).
  - **F6 (Med, real)** → T14 (query de stats no backend) + T11 tornada acionável.
  - **F7 (Low)** → **verificado: NÃO afetado.** `messages.service.ts:815` é alias de
    `me.from_name/from_mail`; L856-857 são chaves de objeto vindas de
    `fromName/fromMail` da entidade de mensagem — nenhuma relação com `pools`. Ruído.
  - **F8 (Low, real)** → AC9–AC12 cobrem os riscos antes não cobertos.
- **Constraint (F5):** `SendersService.syncFromSendgrid` depende de `cls.get('accountId')`
  (via `SendgridHandler.loadApiKey`) — **só pode ser invocado dentro de request/CLS
  scope**. Não expor como job/cron sem passar `accountId` explícito.
- **D13 ratificada — Guilherme, 2026-05-15.** Sync = passo obrigatório do runbook de
  deploy (deploy → migration → sync por conta → validar), forward-fix only.
- **Status:** `ready-for-dev`, `stepsCompleted:[1,2,3,4]`. Implementação prevista por
  Guilherme para **segunda-feira 2026-05-18**, em contexto fresco, nesta branch
  (`guilhermegomes/evo-1281-sender-pool-split`).
- **Raw-SQL sweep (snake_case) executado** — o sweep inicial só pegava identificadores
  JS-style. Resultado: único consumidor de coluna de identidade de `pools` em SQL é
  `postmaster.service.ts:23`. `messages.service.ts:815/856/857` usam
  `sender_name`/`sender_email` como **alias derivado de `me.from_name`/`me.from_mail`**
  (entidade de mensagem, não tabela `pools`) → **não afetado**. `default_sender_*` é da
  tabela `accounts` → não afetado. **Workers (`send-email`/`event-process`/
  `campaign-packer`) sem raw SQL contra identidade de `pools` — confirmados intactos.**
- `postmaster.service.ts` foi descoberto na investigação como 2º consumidor de
  identidade (raw SQL) — não estava no escopo verbal inicial; incluído por
  necessidade técnica (sem ele o split quebra extração de domínio).
