# Dependency Upgrade Plan: warmup-tracker

## Objective

Audit all production and development dependencies in `warmup-tracker`, upgrade them to the latest versions compatible with the existing technology constraints (Node.js 20.9.x, NestJS 10.x, Jest 29.x, ESLint 8.x), and ensure zero high or critical security vulnerabilities.

## Prerequisites

- [ ] Test coverage plan has been implemented and all tests pass (regressions are detectable)
- [ ] A clean git branch is created for this work
- [ ] Current `package-lock.json` (or future `pnpm-lock.yaml`) is committed before starting

## Dependency Inventory

### Known Core Stack

| Package | Current Known Version | Category |
|---|---|---|
| `@nestjs/core` | 10.3.8 | Production |
| `@nestjs/common` | 10.3.8 | Production |
| `@nestjs/platform-express` | 10.3.8 | Production |
| `@nestjs/typeorm` | 10.x | Production |
| `typeorm` | 0.3.x | Production |
| `@slack/web-api` | Latest at install time | Production |
| `pg` | 8.x | Production |
| `reflect-metadata` | 0.1.x or 0.2.x | Production |
| `rxjs` | 7.x | Production |
| `@nestjs/testing` | 10.3.8 | Dev |
| `jest` | 29.7.0 | Dev |
| `ts-jest` | 29.x | Dev |
| `typescript` | 5.x | Dev |
| `eslint` | 8.x | Dev |
| `@typescript-eslint/eslint-plugin` | 6.x or 7.x | Dev |
| `@typescript-eslint/parser` | 6.x or 7.x | Dev |

> Note: Exact current versions must be confirmed by reading `package.json` before executing upgrades.

## Upgrade Constraints

### Hard Constraints (Do Not Break)

| Constraint | Reason |
|---|---|
| Node.js 20.9.0 (Volta) | Pinned by `.volta` in `package.json`; do not change |
| NestJS 10.x | Stay within NestJS 10 LTS; do not upgrade to NestJS 11 without a dedicated migration plan |
| Jest 29.x | Jest 30 is a major version with breaking changes; stay on 29.x |
| ESLint 8.x | ESLint 9 uses a new flat config format incompatible with `.eslintrc.js`; stay on 8.x until flat config migration is planned |
| TypeScript < 5.5 | Verify NestJS 10 decorator compatibility; do not jump more than one minor |

### Soft Constraints (Prefer Stable)

- Prefer LTS or latest stable releases
- Avoid alpha, beta, and RC releases in production dependencies
- Prefer patch and minor upgrades over major upgrades where possible

## Upgrade Process

### Step 1: Audit Current State

```bash
# From warmup-tracker directory
npm audit
# or after pnpm migration:
pnpm audit
```

Document all vulnerabilities found. Classify by severity: critical, high, moderate, low.

```bash
# Check for outdated packages
npm outdated
# or:
pnpm outdated
```

### Step 2: Apply Security Patches First

Fix all critical and high severity vulnerabilities before feature upgrades:

```bash
npm audit fix
# For vulnerabilities that require major version bumps (use with caution):
npm audit fix --force
```

Review each `--force` fix manually to ensure it does not break the API contract of the patched package.

### Step 3: Upgrade by Category

#### 3a. NestJS Ecosystem (Minor/Patch Updates)

Upgrade all `@nestjs/*` packages together since they must be version-aligned:

```bash
npm install \
  @nestjs/common@^10 \
  @nestjs/core@^10 \
  @nestjs/platform-express@^10 \
  @nestjs/typeorm@^10 \
  @nestjs/testing@^10
```

**Verify**: Run `npm test` after this step.

#### 3b. TypeORM

TypeORM 0.3.x is the stable branch for NestJS 10. Check for patch updates:

```bash
npm install typeorm@^0.3
```

**Breaking change risk**: TypeORM 0.4+ (if released) may have breaking changes. Check changelog.

**Verify**: Run `npm test`. Check that `WarmupUser` entity still resolves and `Repository<WarmupUser>` APIs remain compatible.

#### 3c. Slack SDK

```bash
npm install @slack/web-api@latest
```

The `@slack/web-api` package follows semantic versioning. Check the changelog for any breaking changes in `WebClient.chat.postMessage` method signatures.

Reference: https://github.com/slackapi/node-slack-sdk/blob/main/packages/web-api/CHANGELOG.md

**Verify**: Run `npm test`. Confirm `SlackService` tests still pass.

#### 3d. PostgreSQL Driver

```bash
npm install pg@^8
```

Pg 8.x is stable. No major changes expected.

**Verify**: `npm test` (integration tests if available).

#### 3e. RxJS

NestJS 10 requires RxJS 7.x. Stay on 7.x:

```bash
npm install rxjs@^7
```

#### 3f. TypeScript

```bash
npm install --save-dev typescript@^5.4
```

Check that decorators behave correctly. NestJS 10 supports TypeScript 5.x but requires `"experimentalDecorators": true` in `tsconfig.json`.

**Verify**: `npm run build` succeeds.

#### 3g. ts-jest

```bash
npm install --save-dev ts-jest@^29
```

Keep aligned with Jest 29.x.

**Verify**: `npm test` succeeds.

#### 3h. ESLint Plugins

Stay on ESLint 8.x. Upgrade plugins within the 8.x ecosystem:

```bash
npm install --save-dev \
  eslint@^8 \
  @typescript-eslint/eslint-plugin@^6 \
  @typescript-eslint/parser@^6
```

**Verify**: `npm run lint` exits with code 0.

### Step 4: Run Full Test Suite

```bash
npm test
npm run test:cov
npm run build
npm run lint
```

All must pass. If any test fails, identify whether it is a real regression introduced by the upgrade or a test that needs to be updated to match the new API.

### Step 5: Update Lock File

Commit the updated lock file (`package-lock.json` or `pnpm-lock.yaml`) along with `package.json`.

```bash
git add package.json package-lock.json
git commit -m "chore(deps): upgrade dependencies to latest compatible versions"
```

## Package-by-Package Upgrade Notes

### `@slack/web-api`

- The `WebClient` constructor signature is stable across versions
- `chat.postMessage` method signature: `client.chat.postMessage({ channel, text, blocks })` — verify return type is still `WebAPICallResult`
- New versions may add required fields to certain Block Kit types — check that existing Block Kit structures still compile

### TypeORM

- `Repository.findOne()` in TypeORM 0.3+ requires `FindOneOptions` object, not a bare ID. Confirm usage in `AppService` is already using the object form: `findOne({ where: { email } })`
- If using `QueryBuilder`, verify builder methods have not changed

### `reflect-metadata`

- NestJS 10 supports both `reflect-metadata@0.1.x` and `0.2.x`
- If upgrading to `0.2.x`, ensure `tsconfig.json` still has `"emitDecoratorMetadata": true`

## Rollback Procedure

If an upgrade causes unresolvable failures:

1. Restore `package.json` from git: `git checkout package.json`
2. Restore lock file: `git checkout package-lock.json`
3. Reinstall: `npm ci`
4. Verify tests pass again
5. Document which package version caused the issue in this file
6. Open a separate task for that specific package upgrade

## Security Audit Targets

Post-upgrade, the following audit check must pass:

```bash
npm audit --audit-level=high
```

This command exits with a non-zero code if any high or critical vulnerabilities remain. This check should be added to the CI/CD pipeline.

## CI/CD Integration

Add an audit step to the CI pipeline (`.gitlab-ci.yml` or equivalent):

```yaml
audit:
  stage: test
  script:
    - npm ci
    - npm audit --audit-level=high
  allow_failure: false
```

## Definition of Done

- [ ] `npm audit --audit-level=high` exits with code 0 (no high or critical vulnerabilities)
- [ ] `npm outdated` shows no packages with a newer compatible version available (or all exceptions are documented)
- [ ] `npm test` exits with code 0
- [ ] `npm run test:cov` meets coverage thresholds
- [ ] `npm run build` exits with code 0
- [ ] `npm run lint` exits with code 0
- [ ] `package.json` and lock file are committed to git
- [ ] All NestJS packages are on the same minor version
- [ ] No alpha/beta/RC versions in production dependencies
