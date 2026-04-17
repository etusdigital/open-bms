# Master Upgrade Plan — msgops-api

## Executive Summary

msgops-api is the largest service in the MsgOps monorepo: a production NestJS 7.x REST API serving email campaigns, automation workflows, contact management, and multi-channel messaging (email, SMS, push, WhatsApp) for ETUS. The service has accumulated significant technical debt across three axes: a severely outdated runtime and framework stack (NestJS 7, TypeORM 0.2, TypeScript 4, Node 18), near-zero test coverage (~0% across 25+ modules and 38 entities), and a dependency ecosystem with abandoned packages and unnecessary entries. This master plan coordinates four parallel workstreams into a zero-downtime, production-safe upgrade path.

---

## Current State Snapshot

| Dimension | Current | Target |
|---|---|---|
| Node.js | 18-slim (Dockerfile) | 24-alpine (multi-stage) |
| Package manager | yarn 1.x | pnpm 9.x |
| NestJS | 7.6.18 | 11.1.14 |
| TypeORM | 0.2.29 | 0.3.x |
| TypeScript | 4.1.3 | 5.9.3 |
| Jest | 29.7.0 (ts-jest 29) | 30.x |
| ESLint | 7.x (.eslintrc.js legacy) | 10.x (flat config) |
| Test coverage | ~0% (3 spec files) | >=80% on services and providers |
| Docker image | Single-stage, node:18-slim | Multi-stage, node:24-alpine |
| HttpModule source | @nestjs/common | @nestjs/axios |
| Redis module | nestjs-redis 1.3.3 (abandoned) | @nestjs-modules/ioredis or ioredis direct |
| Unnecessary deps | mysql, crypto | removed |

### Key Technical Debt Items

1. **HttpModule imported from @nestjs/common** — moved to `@nestjs/axios` in NestJS 8+. Every module using `HttpModule` or `HttpService` must be migrated. Currently observed in: `AccountsModule`, `AutomationsModule`, `StatisticsModule`, plus any module that injects `HttpService`.

2. **nestjs-redis 1.3.3** — last published 2020, does not support NestJS 8+. The `RedisModule.register()` call in `AutomationsModule` and any other consumer must be replaced. Canonical replacement: `@nestjs-modules/ioredis` or direct `ioredis` with a custom provider.

3. **TypeORM 0.2 → 0.3 API surface changes** — `connection.getRepository()` replaced by `DataSource`, `ormconfig.ts/json` replaced by explicit `DataSource` instance, `@EntityRepository` decorator removed, `FindOneOptions` changed (no positional id), `getManager()` removed. All 38 entities and their repository injection patterns must be verified.

4. **@nestjs/swagger 4.x → 11.x** — Swagger v4 has a completely different API from v11. Most decorators are backward-compatible but `DocumentBuilder`, `SwaggerModule.setup()`, and some DTO decorators changed.

5. **TypeScript 4 → 5** — `strictNullChecks: false` and `noImplicitAny: false` in tsconfig. These can be left permissive initially for compatibility, but the target config should enable them progressively. The upgrade itself is non-breaking.

6. **crypto and mysql as explicit npm dependencies** — `crypto` is a Node.js built-in (the npm shim was deprecated); `mysql` is unused (the project uses `pg`). Both must be removed.

7. **ESLint 7 / legacy .eslintrc.js** — ESLint 10 requires flat config (`eslint.config.js`). The `prettier/@typescript-eslint` extend pattern was removed in `eslint-config-prettier` v8. Both issues must be resolved.

8. **nestjs-joi 1.3.3 / JoiPipeModule** — Must verify compatibility with NestJS 11. The `JoiPipeModule` is imported globally in `AppModule`. If incompatible, the module needs an upgrade or replacement.

9. **@ntegral/nestjs-sentry 2.x** — Sentry SDK changed significantly. The `SentryModule.forRoot()` usage must be verified against the target version.

10. **reflect-metadata 0.1.13** — NestJS 11 requires `reflect-metadata` ^0.2.x.

---

## Workstream Overview

The upgrade is organized into four focused sub-plans:

| Plan | File | Scope |
|---|---|---|
| Test Coverage | test-coverage-plan.md | Write spec files for all 27 services and 12 providers |
| Dependency Upgrade | dependency-upgrade-plan.md | NestJS 7→11, TypeORM 0.2→0.3, TypeScript 4→5, all dependency replacements |
| pnpm Migration | pnpm-migration-plan.md | yarn → pnpm 9.x, lockfile, CI/CD, Docker |
| Final Verification | final-verification-plan.md | Integration smoke tests, migration run, Swagger check, deployment |

---

## Sequencing Strategy

The workstreams have dependencies. The recommended execution order is:

```
Phase 0: Baseline (before any changes)
  - Record current test output (3 passing specs)
  - Snapshot package.json and yarn.lock
  - Tag the current commit

Phase 1: Test Coverage (test-coverage-plan.md)
  - Add spec files using CURRENT dependencies (NestJS 7, TypeORM 0.2)
  - All new specs must pass on the current stack
  - Establish a coverage baseline > 0%
  - Rationale: tests written against current API surface will fail loudly when
    breaking changes are introduced during the dependency upgrade, making
    regressions immediately visible

Phase 2: Dependency Upgrade (dependency-upgrade-plan.md)
  - Upgrade NestJS, TypeORM, TypeScript, ESLint
  - Replace nestjs-redis, add @nestjs/axios, remove mysql/crypto
  - Fix all compilation errors and breaking API changes
  - All Phase 1 tests must continue to pass
  - Rationale: the test suite from Phase 1 acts as a safety net

Phase 3: pnpm Migration (pnpm-migration-plan.md)
  - Convert yarn.lock → pnpm-lock.yaml
  - Update Dockerfile, CI/CD scripts, and npm scripts
  - Run full test suite under pnpm
  - Rationale: dependency changes in Phase 2 make this the right time to also
    align the lockfile format; doing it earlier would create a two-step lockfile
    migration

Phase 4: Final Verification (final-verification-plan.md)
  - Docker build smoke test
  - DB migration dry-run
  - Swagger UI health check
  - Production deployment checklist
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| TypeORM 0.2 → 0.3 repository API breaks services | High | High | Write TypeORM tests first; use DataSource migration guide precisely |
| nestjs-redis removal breaks Redis-backed statistics/automations | High | High | Replace with direct ioredis provider before removing; test Redis-dependent services |
| HttpModule → @nestjs/axios breaks StatisticsModule, AccountsModule | Medium | Medium | Global search for HttpService injection; update all consumers at once |
| @nestjs/swagger v4 → v11 decorator incompatibility | Medium | Low | Swagger is documentation only; runtime not affected; fix after compile |
| reflect-metadata version conflict | Medium | High | Upgrade to ^0.2.x as first step in dependency upgrade |
| NestJS 11 removes @Module HttpModule export | High | Medium | Explicitly import HttpModule from @nestjs/axios in every module that uses it |
| nestjs-joi incompatibility with NestJS 11 | Low | Medium | Check peer deps; fallback to class-validator ValidationPipe if abandoned |
| pnpm hoisting differences cause hidden dependency breakage | Low | Medium | Use `shamefully-hoist=true` in .npmrc initially; tighten after verification |
| Google Cloud SDK version mismatches on Node 24 | Low | Medium | pubsub ^2.x, datastore ^6.x, storage ^7.x, bigquery ^6.x — verify on Node 24 before upgrading |

---

## Module Inventory

### NestJS Modules (25 total in AppModule)

| Module | Uses HttpModule | Uses nestjs-redis | Redis Dependency |
|---|---|---|---|
| AuthModule | No | No | No |
| AutomationsModule | Yes | Yes (RedisModule.register) | Yes |
| MessagesModule | TBD | No | TBD |
| BucketsModule | No | No | No |
| TestsModule | TBD | No | No |
| ServicesModule | No | No | No |
| LeadStateModule | No | No | No |
| CampaignModule | TBD | No | TBD |
| EmailsTemplatesModule | No | No | No |
| AuditsModule | No | No | No |
| ContactsModule | No | No | No |
| PoolsModule | No | No | No |
| AccountsModule | Yes | No | No |
| TagsModule | No | No | No |
| CustomEventModule | No | No | No |
| CustomFieldsModule | No | No | No |
| UsersModule | No | No | No |
| StatisticsModule | Yes | No | Yes (via StatisticsAggregationService) |
| VerifyModule | No | No | No |
| WarmupsModule | No | No | No |
| PostmasterModule | No | No | No |
| BatchModule | No | No | No |
| CampaignsRulesModule | No | No | No |
| LabelsModule | No | No | No |
| IpReputationModule | No | No | No |

### Providers (12 total)

| Provider | External SDK | Breaking Change Risk |
|---|---|---|
| PubSubProvider | @google-cloud/pubsub | Low (no NestJS dep) |
| GoogleBigqueryProvider | @google-cloud/bigquery | Low |
| GoogleCloudStorageProvider | @google-cloud/storage | Low |
| GoogleDatastoreProvider | @google-cloud/datastore | Low |
| GoogleTasksProvider | @google-cloud/tasks | Low |
| ClickhouseProvider | @clickhouse/client | Low |
| AccountConfigsProvider | none | Low |
| Auth0Provider | auth0 | Medium (auth0 SDK v4 changes) |
| OpenAIProvider | openai | Low |
| SlackProvider | none (fetch) | Low |
| ActiveCampaignProvider | none (HttpService) | Medium (HttpService source change) |
| PubSubProvider | @google-cloud/pubsub | Low |

---

## Entities Inventory (38 total)

All entities are in `/src/entities/`. TypeORM 0.3 requires that any `@EntityRepository` decorator usage be replaced with the standard `Repository<T>` injection via `getRepositoryToken()`. The current codebase already uses `getRepositoryToken()` pattern (visible in spec files), which is the correct 0.3 pattern — however, the TypeORM connection initialization via `TypeOrmModule.forRoot()` with zero arguments (relying on `ormconfig.ts` or environment variables) must be migrated to explicit `DataSource` configuration.

Key entities with high dependency counts:
- `ContactEntity` — used in 8+ modules
- `AccountEntity` — used in 7+ modules
- `MessageEntity` — used in 5+ modules
- `AutomationEntity` — used in 4+ modules
- `CampaignEntity` — used in 4+ modules
- `TagEntity` — used in 3+ modules

---

## Migration Checkpoints

Each phase must pass the following gate criteria before the next phase begins:

**Phase 1 Gate:**
- `yarn test` exits 0
- Coverage report shows > 0% for lines/branches/functions
- All 3 pre-existing specs still pass

**Phase 2 Gate:**
- `pnpm build` (or `yarn build` before Phase 3) exits 0 with no TypeScript errors
- `yarn test` (or `pnpm test`) exits 0 — all Phase 1 tests pass
- No `any`-typed compilation suppressions were added to fix upgrade errors (acceptable temporarily, must be tracked in TODO comments)
- `GET /api-docs/` returns 200 with valid Swagger JSON

**Phase 3 Gate:**
- `pnpm install` and `pnpm build` both exit 0
- `pnpm test` exits 0
- Docker image builds successfully: `docker build -t msgops-api:test .`
- Docker container starts and `GET /health` (or first available endpoint) returns 200

**Phase 4 Gate:**
- All items in final-verification-plan.md checklist are checked
- Staging deployment successful
- No Sentry errors from startup sequence
- TypeORM migration run completes cleanly (no SQL errors)

---

## File Paths Reference

```
/Users/augusto/Repos/msgops/msgops-api/
  src/
    app.module.ts                        # Root module — 25 imports
    main.ts                              # Bootstrap
    auth/                                # JWT + API key strategies
    entities/                            # 38 TypeORM entities
    handlers/                            # Email (SendGrid, SparkPost), Evolution, Twilio
    middlewares/account.middleware.ts    # AccountMiddleware
    migrations/                          # 126 TypeORM migrations
    modules/                             # 25 feature modules
    providers/                           # 12 providers (GCP, Redis, etc.)
    utils/                               # Shared utilities, PubSub formatters, audit
  tests/e2e/                             # E2E test config
  Dockerfile                             # Currently single-stage node:18-slim
  package.json                           # yarn dependencies
  tsconfig.json                          # TypeScript config
  .eslintrc.js                           # Legacy ESLint config
  nest-cli.json                          # NestJS CLI config
```

---

## Definition of Done

The upgrade is complete when:

1. All 4 sub-plans are fully executed and all gate criteria pass.
2. `pnpm test` reports >= 80% line coverage for all files in `src/modules/**/*.service.ts` and `src/providers/**/*.ts`.
3. `pnpm build` produces a clean `dist/` with zero TypeScript errors.
4. The Docker image is built from `node:24-alpine` using a multi-stage build.
5. The production deployment on Cloud Run starts successfully, completes TypeORM migrations, and serves the Swagger UI.
6. No P0/P1 errors appear in Sentry for 24 hours post-deployment.
