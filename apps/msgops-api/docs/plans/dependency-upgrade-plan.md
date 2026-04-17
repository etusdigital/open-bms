# Dependency Upgrade Plan — msgops-api

## Objective

Upgrade msgops-api from NestJS 7 / TypeORM 0.2 / TypeScript 4 / Node 18 to NestJS 11 / TypeORM 0.3 / TypeScript 5 / Node 24. Remove abandoned packages (nestjs-redis, mysql, crypto npm shim). Replace HttpModule source. Update ESLint to flat config. Update Dockerfile to multi-stage node:24-alpine.

This plan must be executed **after** Phase 1 (test coverage), so that the test suite provides a regression safety net throughout.

---

## Pre-Upgrade Baseline

Before making any changes, record and commit:
```bash
yarn test --coverage 2>&1 | tee docs/plans/baseline-coverage.txt
yarn build 2>&1 | tee docs/plans/baseline-build.txt
```

Also note the current TypeScript error count (should be 0 on a green build).

---

## Step 1: Node.js Version Alignment

The current Dockerfile uses `node:18-slim`. NestJS 11 requires Node >= 18.0.0, but the target is Node 24. The local development environment does not enforce a specific Node version (no `.nvmrc` or `volta` config). Before upgrading NestJS, ensure the build environment uses Node 24.

**Action:** Add `.nvmrc` and/or update `volta` pinning:
```
# .nvmrc
24.1.0
```

**Action:** Update the `@types/node` devDependency from `^14.14.14` to `^22.0.0` or `^24.0.0` (use the highest available that matches Node 24):
```bash
yarn add -D @types/node@^22.0.0
```

Note: `@types/node@^22` covers Node 22 and 24 runtime behavior. Use the highest stable `@types/node` available at upgrade time.

---

## Step 2: TypeScript 5 Upgrade

TypeScript 5 is a non-breaking upgrade for the vast majority of this codebase because `strictNullChecks: false` and `noImplicitAny: false` are both off. The main gotchas are removed/changed compiler options.

**Action:** Upgrade TypeScript:
```bash
yarn add -D typescript@^5.9.3
```

**tsconfig.json changes required:**
- Remove `"incremental": true` from the base config (move to `tsconfig.build.json` only, or keep but verify it works with ts-jest)
- The trailing comma in the current `tsconfig.json` `compilerOptions` is actually invalid JSON — fix it (it exists on line 22: `"resolveJsonModule": true,`)
- Target can be raised from `"es2019"` to `"es2022"` for Node 24 compatibility

**Updated `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "es2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules"]
}
```

**Verify:** `yarn tsc --noEmit` returns 0 errors after this step alone (before NestJS upgrade).

---

## Step 3: reflect-metadata Upgrade

NestJS 10+ requires `reflect-metadata@^0.2.x`. The current version is `^0.1.13`.

```bash
yarn add reflect-metadata@^0.2.2
```

Verify `src/main.ts` still imports `reflect-metadata` at the top (it must be the first import). No code changes needed; this is a dependency version bump only.

---

## Step 4: Remove Unnecessary Dependencies

### 4.1 Remove `crypto` npm shim

The `crypto` package on npm (version ^1.0.1) is a no-op shim that existed for browser bundlers. It was deprecated in 2017. Node.js has `crypto` as a built-in. The only usage in the codebase is in `src/providers/pubsub.providers.ts`:

```typescript
import * as crypto from 'crypto';
```

This import already works without the npm shim — Node's built-in `crypto` module is resolved first. Remove from `package.json`:

```bash
yarn remove crypto
```

No code changes needed; the import continues to work.

### 4.2 Remove `mysql` driver

The project uses PostgreSQL (`pg`) exclusively. The `mysql` package is listed as a runtime dependency but is never imported anywhere in the source code. TypeORM 0.2 lists mysql as an optional peer dependency which may have caused it to be included, but it is not needed.

```bash
yarn remove mysql
```

### 4.3 Review `@types/sequelize`

`@types/sequelize@^4.28.9` is in devDependencies. The project does not use Sequelize. This appears to be a legacy artifact. Remove:

```bash
yarn remove -D @types/sequelize
```

---

## Step 5: ESLint 10 with Flat Config

Current state: ESLint 7.x with `.eslintrc.js` using `prettier/@typescript-eslint` extend (removed in `eslint-config-prettier` v8) and `plugin:prettier/recommended`.

**Action:** Upgrade ESLint and related packages:

```bash
yarn add -D \
  eslint@^10.0.0 \
  @typescript-eslint/eslint-plugin@^8.0.0 \
  @typescript-eslint/parser@^8.0.0 \
  eslint-config-prettier@^9.0.0 \
  eslint-plugin-prettier@^5.0.0 \
  prettier@^3.0.0
```

**Action:** Delete `.eslintrc.js` and create `eslint.config.js` (flat config):

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
      prettierConfig,
    ],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'prettier/prettier': ['error', {
        singleQuote: true,
        printWidth: 180,
        trailingComma: 'all',
      }],
    },
  },
);
```

**Action:** Update `package.json` lint script to work with ESLint 10:
```json
"lint": "eslint \"{src,test}/**/*.ts\" --fix"
```

Note: ESLint 10 flat config works with this glob pattern but the `--fix` flag is still valid.

**Verify:** `yarn lint` runs without errors after this step.

---

## Step 6: NestJS 11 Core Upgrade

This is the largest step. NestJS 11 drops several APIs present in v7.

### 6.1 Core NestJS packages

```bash
yarn add \
  @nestjs/common@^11.1.14 \
  @nestjs/core@^11.1.14 \
  @nestjs/platform-express@^11.1.14 \
  @nestjs/passport@^11.0.0 \
  @nestjs/swagger@^11.0.0 \
  @nestjs/typeorm@^11.0.0

yarn add -D \
  @nestjs/cli@^11.0.0 \
  @nestjs/schematics@^11.0.0 \
  @nestjs/testing@^11.1.14
```

### 6.2 HttpModule Migration — CRITICAL

**Problem:** `HttpModule` and `HttpService` were removed from `@nestjs/common` in NestJS 8. They now live in `@nestjs/axios`.

**Install:**
```bash
yarn add @nestjs/axios@^3.0.0 axios@^1.0.0
```

**Files to update — all imports of HttpModule:**

Search:
```bash
grep -r "from '@nestjs/common'" src/ | grep HttpModule
grep -r "from '@nestjs/common'" src/ | grep HttpService
```

Expected hits based on module inventory:
- `src/modules/accounts/accounts.module.ts` — line 1: `import { HttpModule, Module } from '@nestjs/common'`
- `src/modules/automations/automations.module.ts` — line 2: `import { HttpModule, Module } from '@nestjs/common'`
- `src/modules/statistics/statistics.module.ts` — line 1: `import { HttpModule, Module } from '@nestjs/common'`
- Any other module importing `HttpModule`

**Fix pattern:**
```typescript
// Before
import { HttpModule, Module } from '@nestjs/common';
// After
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
```

Any service that injects `HttpService` must also update its import:
```typescript
// Before
import { HttpService } from '@nestjs/common';
// After
import { HttpService } from '@nestjs/axios';
```

### 6.3 rxjs Upgrade

NestJS 11 requires rxjs ^7.x. Current version is `^6.6.3`.

```bash
yarn add rxjs@^7.8.0
```

RxJS 7 has some breaking changes from v6:
- `throwError()` now requires a factory function: `throwError(() => new Error(...))`
- Some operators were renamed or moved

Search for `throwError` usage:
```bash
grep -r "throwError(" src/
```

Fix any `throwError(error)` calls to `throwError(() => error)`.

### 6.4 nestjs-cls Compatibility

`nestjs-cls@^3.5.0` supports NestJS 11. Verify peer dependencies after upgrade:
```bash
yarn why nestjs-cls
```

If peer dependency warnings appear, upgrade to latest: `yarn add nestjs-cls@^4.0.0` (check release notes for breaking changes to `ClsModule.forRoot()` API).

### 6.5 JoiPipeModule Compatibility

`nestjs-joi@^1.3.3` — check if a NestJS 11-compatible version exists. At time of writing, `nestjs-joi` may require an upgrade to v2.x. If no compatible version exists:

Option A: Upgrade `nestjs-joi`:
```bash
yarn add nestjs-joi@^2.0.0
```

Option B: If abandoned, replace `JoiPipeModule` with NestJS's built-in `ValidationPipe` using `class-validator` and `class-transformer`. This requires converting Joi schemas in DTOs to class-validator decorators — significant effort, defer to post-upgrade if Option A works.

### 6.6 @ntegral/nestjs-sentry Upgrade

`@ntegral/nestjs-sentry@^2.0.7` is not compatible with NestJS 11. Options:

Option A: Upgrade to `@ntegral/nestjs-sentry@^4.0.0` (supports NestJS 10+):
```bash
yarn add @ntegral/nestjs-sentry@^4.0.0 @sentry/node@^8.0.0
```

Note: `@sentry/node` v8 has significant breaking changes from v6. The `SentryModule.forRoot()` API may have changed. Review release notes.

Option B: Replace with direct Sentry initialization in `main.ts` (simpler but loses NestJS integration):
```typescript
import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

Recommended: Option A, but test in staging before production.

---

## Step 7: TypeORM 0.3 Migration — CRITICAL

This is the most technically risky step. TypeORM 0.3 introduced breaking API changes from 0.2.

### 7.1 Install TypeORM 0.3

```bash
yarn add typeorm@^0.3.20 @nestjs/typeorm@^11.0.0
```

### 7.2 ormconfig → DataSource

TypeORM 0.3 deprecated `ormconfig.ts/json`. The `TypeOrmModule.forRoot()` call with zero arguments in `app.module.ts` relies on an `ormconfig` file or environment variable auto-detection.

**Find the current ormconfig:**
```bash
ls /Users/augusto/Repos/msgops/msgops-api/ormconfig* 2>/dev/null || echo "No ormconfig file found"
# If not found, TypeORM 0.2 reads TYPEORM_* env vars automatically
```

**New pattern with DataSource:**

Create `src/database/data-source.ts`:
```typescript
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.TYPEORM_HOST || 'localhost',
  port: parseInt(process.env.TYPEORM_PORT || '5432'),
  username: process.env.TYPEORM_USERNAME,
  password: process.env.TYPEORM_PASSWORD,
  database: process.env.TYPEORM_DATABASE,
  synchronize: process.env.TYPEORM_SYNCHRONIZE === 'true',
  logging: process.env.TYPEORM_LOGGING === 'true',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: process.env.TYPEORM_MIGRATIONS_RUN === 'true',
  ssl: process.env.TYPEORM_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
```

Update `app.module.ts` to use the DataSource:
```typescript
import { AppDataSource } from './database/data-source';

TypeOrmModule.forRoot(AppDataSource.options),
```

Update `package.json` migration scripts to reference the DataSource:
```json
"typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d src/database/data-source.ts",
"typeorm:migration:generate": "pnpm typeorm -- migration:generate src/migrations/",
"typeorm:migration:run": "pnpm typeorm -- migration:run",
"typeorm:migration:revert": "pnpm typeorm -- migration:revert"
```

### 7.3 FindOne API Change

TypeORM 0.3 changed `findOne` signature. In 0.2:
```typescript
repository.findOne(id)                          // by primary key
repository.findOne({ where: { id } })           // by condition
```

In 0.3, the positional id overload is removed:
```typescript
repository.findOne({ where: { id } })           // only this form
repository.findOneBy({ id })                    // new convenience method
```

**Search for breaking usages:**
```bash
grep -rn "\.findOne(" src/ | grep -v "where:" | grep -v "spec.ts"
```

All results of `repository.findOne(someId)` or `repository.findOne(someString)` must be changed to `repository.findOne({ where: { id: someId } })` or `repository.findOneBy({ id: someId })`.

### 7.4 @EntityRepository Decorator Removed

TypeORM 0.3 removed the `@EntityRepository()` class decorator. Custom repositories must be rewritten as regular classes without the decorator.

**Search:**
```bash
grep -rn "@EntityRepository" src/
```

If any results found, refactor those classes to use the `Repository<T>` injection pattern already established in most of the codebase.

### 7.5 getConnection / getManager Removed

TypeORM 0.3 removed the global `getConnection()` and `getManager()` functions. Replace with `DataSource` injection.

**Search:**
```bash
grep -rn "getConnection\|getManager" src/
```

Replace with injected `DataSource`:
```typescript
constructor(
  @InjectDataSource() private readonly dataSource: DataSource,
) {}
// Then use:
this.dataSource.createQueryBuilder()
this.dataSource.manager.find(Entity, { where: { ... } })
```

### 7.6 Query Builder Changes

TypeORM 0.3 query builder is mostly backward-compatible with 0.2, but verify:
- `createQueryBuilder` must be called on a repository or DataSource, not `getRepository()`
- `leftJoinAndSelect` with alias string still works
- `getManyAndCount()` still returns `[T[], number]`

### 7.7 Migrations CLI

TypeORM 0.3 CLI changed:
- `migration:generate -n MigrationName` → `migration:generate src/migrations/MigrationName`
- The `-d` flag is required to point to the DataSource file

Update `package.json` scripts accordingly (see 7.2 above).

---

## Step 8: nestjs-redis Replacement — CRITICAL

`nestjs-redis@1.3.3` is incompatible with NestJS 8+. The `RedisModule.register()` call is currently in `AutomationsModule`. The `StatisticsAggregationService` likely also injects Redis.

### 8.1 Find all Redis injection points

```bash
grep -rn "InjectRedis\|RedisModule\|RedisService\|nestjs-redis" src/
```

Expected results:
- `src/modules/automations/automations.module.ts` — `RedisModule.register()`
- `src/modules/statistics/statistics.aggregation.ts` — likely `InjectRedis()`
- Possibly other services

### 8.2 Replacement with direct ioredis provider

Remove `nestjs-redis`:
```bash
yarn remove nestjs-redis
```

Install `ioredis`:
```bash
yarn add ioredis@^5.0.0
yarn add -D @types/ioredis@^4.28.10
```

Note: `@types/ioredis` is already in devDependencies. Upgrade to the version that matches ioredis 5:
```bash
yarn add -D @types/ioredis@^5.0.0
```

Actually, `ioredis` 5.x ships its own types. Remove `@types/ioredis` entirely:
```bash
yarn remove -D @types/ioredis
```

**Create a custom Redis provider** at `src/providers/redis.provider.ts`:
```typescript
import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  },
};
```

**Update AutomationsModule** to use the custom provider:
```typescript
// Remove RedisModule import and registration
// Add:
import { RedisProvider, REDIS_CLIENT } from '../../providers/redis.provider';

@Module({
  imports: [/* ... without RedisModule ... */],
  providers: [
    /* ... */
    RedisProvider,
  ],
})
export class AutomationsModule {}
```

**Update any service using `@InjectRedis()`:**
```typescript
// Before (nestjs-redis)
import { InjectRedis } from 'nestjs-redis';
import Redis from 'ioredis';

constructor(@InjectRedis() private readonly redis: Redis) {}

// After (direct injection)
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../providers/redis.provider';
import Redis from 'ioredis';

constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
```

### 8.3 Update test mocks

In spec files that mock Redis, update the provider token:
```typescript
{ provide: REDIS_CLIENT, useValue: mockRedis }
```

---

## Step 9: @nestjs/swagger Upgrade

Upgrade from v4 to v11:
```bash
yarn add @nestjs/swagger@^11.0.0
```

The `swagger-ui-express` peer dependency version must match:
```bash
yarn add swagger-ui-express@^5.0.0
```

**Breaking changes in `main.ts`:**

The DocumentBuilder and SwaggerModule API is largely the same in v11, but verify:
- `new DocumentBuilder()` — same
- `.setTitle()`, `.setDescription()`, `.setVersion()` — same
- `.addBearerAuth()` — same but options object changed slightly
- `SwaggerModule.createDocument()` — same
- `SwaggerModule.setup()` — same

Run after upgrade and navigate to `http://localhost:5001/api-docs/` to verify Swagger UI loads.

---

## Step 10: Jest 30 / ts-jest Upgrade

```bash
yarn add -D jest@^30.0.0 jest-cli@^30.0.0 ts-jest@^29.2.5
```

Note: Check ts-jest 30.x release — ts-jest typically trails Jest by a minor version. Use the latest ts-jest compatible with Jest 30 at upgrade time.

**`jest.config.ts` changes for Jest 30:**
- `testEnvironment` now defaults to `'node'` (was `'jsdom'` in older Jest) — explicitly set `testEnvironment: 'node'`
- `transform` configuration for ts-jest remains the same
- `moduleNameMapper` for path aliases must be verified

If `jest-sonar` is incompatible with Jest 30:
```bash
yarn add -D jest-sonar@latest
```

Or remove it if SonarQube is no longer used.

---

## Step 11: class-transformer / class-validator Alignment

Current versions:
- `class-transformer@^0.3.1`
- `class-validator@^0.13.0`

NestJS 11 works best with:
- `class-transformer@^0.5.1`
- `class-validator@^0.14.0`

```bash
yarn add class-transformer@^0.5.1 class-validator@^0.14.0
```

These are minor/patch upgrades. No code changes expected.

---

## Step 12: passport / jwks-rsa Alignment

Current versions:
- `passport@^0.4.1` — very old; passport 0.6+ changed session handling
- `@nestjs/passport@^7.1.5` → upgrading to `^11.0.0`
- `passport-jwt@^4.0.0` — stable
- `jwks-rsa@^1.12.0` — upgrade to latest for Node 24 compatibility

```bash
yarn add passport@^0.7.0 jwks-rsa@^3.0.0
```

`passport-headerapikey@^1.2.2` — verify compatibility with passport 0.7. If incompatible, the `HeaderApiKeyStrategy` can be implemented directly without the package.

---

## Step 13: Google Cloud SDK Version Audit

Current GCP package versions must be verified for Node 24 compatibility:

| Package | Current | Required Action |
|---|---|---|
| `@google-cloud/pubsub` | `^2.16.1` | Upgrade to `^4.x` for Node 24 |
| `@google-cloud/bigquery` | `^6.0.3` | Upgrade to `^7.x` |
| `@google-cloud/datastore` | `^6.4.7` | Upgrade to `^8.x` |
| `@google-cloud/storage` | `^7.0.0` | Already current |
| `@google-cloud/tasks` | `^2.4.2` | Upgrade to `^5.x` |

```bash
yarn add \
  "@google-cloud/pubsub@^4.0.0" \
  "@google-cloud/bigquery@^7.0.0" \
  "@google-cloud/datastore@^8.0.0" \
  "@google-cloud/tasks@^5.0.0"
```

After upgrading, audit each provider class for API surface changes in the new major versions. PubSub v4, BigQuery v7, and Tasks v5 all have some breaking changes documented in their respective changelogs.

---

## Step 14: Dockerfile Multi-Stage Update

**Current Dockerfile problems:**
1. Single-stage build — dev dependencies remain in the image
2. `node:18-slim` — outdated
3. `yarn install --production --ignore-scripts` runs before `COPY . .` but then `yarn build` runs after — this means build tools are NOT installed when `build` runs, which means the current Dockerfile likely fails in practice or relies on a different workflow

**New Dockerfile** (`/Users/augusto/Repos/msgops/msgops-api/Dockerfile`):

```dockerfile
# Stage 1: Builder
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

# Install pnpm (after pnpm migration in Phase 3)
# For now, keep yarn; replace with pnpm in pnpm-migration-plan.md

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

# Stage 2: Production
FROM node:24-alpine AS production

WORKDIR /usr/src/app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=5000
ENV TZ=America/Sao_Paulo

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/main"]
```

Key improvements:
- Two stages: builder (full devDeps) and production (only runtime deps + compiled dist)
- `node:24-alpine` is ~50MB vs `node:18-slim` at ~75MB
- `--frozen-lockfile` ensures reproducible installs
- `node dist/main` directly instead of `yarn start:prod` (avoids yarn overhead in container)

Note: After the pnpm migration (Phase 3), replace `yarn` with `pnpm` in the Dockerfile.

---

## Compilation Fix Checklist

After all dependency upgrades, run `yarn build` and fix each compilation error. Expected categories:

### Category A: HttpModule/HttpService import path
```
error TS2305: Module '"@nestjs/common"' has no exported member 'HttpModule'
```
Fix: Change import source to `@nestjs/axios`.

### Category B: TypeORM findOne signature
```
error TS2554: Expected 1 arguments, but got 1 [wrong overload]
```
Fix: Change `findOne(id)` to `findOne({ where: { id } })`.

### Category C: RedisModule not found
```
error TS2304: Cannot find module 'nestjs-redis'
```
Fix: Update to custom Redis provider (Step 8).

### Category D: rxjs throwError
```
error TS2345: Argument of type 'Error' is not assignable to parameter type '() => ObservableInput<any>'
```
Fix: Wrap argument in factory function.

### Category E: @nestjs/swagger decorator changes
Review all `@ApiProperty`, `@ApiResponse`, `@ApiBearerAuth` usages for deprecation warnings.

### Category F: TypeScript 5 strict mode (if enabling incrementally)
No immediate errors since `strict` options remain off. Leave for future hardening.

---

## Post-Upgrade Verification

```bash
# TypeScript compilation
yarn build

# Run full test suite
yarn test

# Check coverage (must be >= baseline)
yarn test:cov

# Start in development mode and verify Swagger
yarn start:dev
curl http://localhost:5001/api-docs-json  # Should return valid OpenAPI JSON

# Verify TypeORM migrations
yarn typeorm:migration:run
```

---

## Dependency Version Table (Final State)

| Package | Version |
|---|---|
| `@nestjs/common` | `^11.1.14` |
| `@nestjs/core` | `^11.1.14` |
| `@nestjs/platform-express` | `^11.1.14` |
| `@nestjs/axios` | `^3.0.0` |
| `@nestjs/passport` | `^11.0.0` |
| `@nestjs/swagger` | `^11.0.0` |
| `@nestjs/typeorm` | `^11.0.0` |
| `typeorm` | `^0.3.20` |
| `typescript` | `^5.9.3` |
| `rxjs` | `^7.8.0` |
| `reflect-metadata` | `^0.2.2` |
| `class-transformer` | `^0.5.1` |
| `class-validator` | `^0.14.0` |
| `ioredis` | `^5.0.0` |
| `passport` | `^0.7.0` |
| `jwks-rsa` | `^3.0.0` |
| `@google-cloud/pubsub` | `^4.0.0` |
| `@google-cloud/bigquery` | `^7.0.0` |
| `@google-cloud/datastore` | `^8.0.0` |
| `@google-cloud/tasks` | `^5.0.0` |
| `@sentry/node` | `^8.0.0` |
| `swagger-ui-express` | `^5.0.0` |
| **REMOVED** | `nestjs-redis`, `mysql`, `crypto` |
