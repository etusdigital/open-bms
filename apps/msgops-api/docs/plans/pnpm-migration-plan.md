# pnpm Migration Plan — msgops-api

## Objective

Migrate msgops-api from yarn 1.x (classic) to pnpm 9.x. The migration covers: package manager installation, lockfile conversion, package.json script updates, Dockerfile update, and CI/CD pipeline alignment. This plan executes **after** the dependency upgrade (Phase 2) so that the pnpm lockfile is generated from the already-upgraded dependency set.

---

## Why pnpm

| Concern | yarn 1.x | pnpm 9.x |
|---|---|---|
| Disk usage | Full copies per project | Content-addressable store with hard links |
| Install speed | Moderate | Faster (parallel, deduplication) |
| Phantom dependencies | Allowed (flat node_modules) | Blocked by default (strict mode) |
| Lockfile conflicts | yarn.lock large, conflict-prone | pnpm-lock.yaml smaller, structured |
| Node 24 support | Yes | Yes (first-class) |
| Workspace support | Basic | Full (not needed here but available) |
| Docker layer caching | Works | Works (better with `--frozen-lockfile`) |

---

## Pre-Migration Checklist

Before starting:
- [ ] Phase 2 (dependency upgrade) is complete
- [ ] `yarn build` exits 0
- [ ] `yarn test` exits 0
- [ ] `yarn.lock` is committed and up to date
- [ ] Current Node version is 24.x (`node --version`)

---

## Step 1: Install pnpm

Install pnpm globally via the official standalone installer (avoids npm/yarn version entanglement):

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
# Or via npm for consistency:
npm install -g pnpm@^9.0.0
```

Verify installation:
```bash
pnpm --version
# Expected: 9.x.x
```

Pin pnpm version for team consistency. Add to `package.json`:
```json
{
  "packageManager": "pnpm@9.15.0"
}
```

The `packageManager` field is respected by Corepack (built into Node 16.9+). With Node 24, enable Corepack:
```bash
corepack enable
```

This ensures all team members and CI use the declared pnpm version automatically.

---

## Step 2: Import yarn.lock to pnpm-lock.yaml

pnpm can import an existing yarn.lock and produce an equivalent pnpm lockfile:

```bash
cd /Users/augusto/Repos/msgops/msgops-api
pnpm import
```

The `pnpm import` command reads `yarn.lock` and generates `pnpm-lock.yaml` with equivalent resolved versions. This preserves exact package versions that were previously locked.

**Verify the import:**
```bash
# Check that pnpm-lock.yaml was created
ls -lh pnpm-lock.yaml

# Check package count is reasonable
grep "^  /" pnpm-lock.yaml | wc -l
```

---

## Step 3: Delete yarn.lock and node_modules

After the import, the yarn lockfile is no longer needed:

```bash
rm yarn.lock
rm -rf node_modules
```

---

## Step 4: Configure .npmrc for pnpm

Create `/Users/augusto/Repos/msgops/msgops-api/.npmrc`:

```ini
# Use shamefully-hoist initially to maximize compatibility with packages
# that rely on peer dependencies being in the root node_modules.
# This mimics yarn/npm behavior and avoids "Cannot find module" errors
# from packages with implicit peer dependencies.
# Tighten this to false after verifying all modules work correctly.
shamefully-hoist=true

# Ensure native modules (sharp, pg) are rebuilt for the current platform
auto-install-peers=true

# Frozen lockfile in CI (set via environment, not here)
# CI should use: pnpm install --frozen-lockfile

# Store location (default: ~/.pnpm-store)
# store-dir=~/.pnpm-store
```

### Why `shamefully-hoist=true` initially

pnpm's default strict node_modules layout uses symlinks and does not hoist all packages to the root `node_modules`. Some packages in this codebase's dependency tree may have been relying on yarn's flat hoisting:

- `@google-cloud/*` packages use protobuf internals that sometimes require global visibility
- `typeorm` accesses its own CLI dependencies at runtime
- `ts-node` / `tsconfig-paths` need to find each other
- `nestjs-joi` and similar packages access NestJS internals

Start with `shamefully-hoist=true`. After the first successful `pnpm install` + `pnpm build` + `pnpm test` run, try setting `shamefully-hoist=false` and re-run the full suite. If everything still works, remove the setting permanently.

---

## Step 5: Install with pnpm

```bash
cd /Users/augusto/Repos/msgops/msgops-api
pnpm install
```

This will:
1. Read `pnpm-lock.yaml`
2. Download packages to the pnpm content store
3. Link into `node_modules` according to `.npmrc` settings

**Expected output:** No errors. A `node_modules/.pnpm` directory will appear alongside the usual `node_modules` structure.

---

## Step 6: Update package.json Scripts

Replace all `npm run` and `yarn` references in `package.json` scripts with `pnpm`:

**Current `scripts` section:**
```json
"scripts": {
  "prebuild": "rimraf dist",
  "build": "nest build",
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod": "node dist/main",
  "sonar": "ts-node-dev sonar-project.ts",
  "lint": "eslint \"{src,test}/**/*.ts\" --fix",
  "pre-commit": "lint-staged",
  "prepare": "husky install",
  "test": "jest --config jest.config.ts",
  "test:watch": "jest --watch --config jest.config.ts",
  "test:e2e": "NODE_ENV=test jest --config ./tests/e2e/jest-e2e.json",
  "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
  "typeorm:migration:generate": "npm run typeorm -- migration:generate -n",
  "typeorm:migration:run": "npm run typeorm -- migration:run",
  "typeorm:migration:revert": "npm run typeorm -- migration:revert",
  "test:cov": "jest --coverage --config jest.config.ts"
}
```

**Updated `scripts` section (pnpm + TypeORM 0.3 CLI format):**
```json
"scripts": {
  "prebuild": "rimraf dist",
  "build": "nest build",
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod": "node dist/main",
  "sonar": "ts-node-dev sonar-project.ts",
  "lint": "eslint \"{src,test}/**/*.ts\" --fix",
  "pre-commit": "lint-staged",
  "prepare": "husky install",
  "test": "jest --config jest.config.ts",
  "test:watch": "jest --watch --config jest.config.ts",
  "test:e2e": "NODE_ENV=test jest --config ./tests/e2e/jest-e2e.json",
  "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d src/database/data-source.ts",
  "typeorm:migration:generate": "pnpm typeorm -- migration:generate",
  "typeorm:migration:run": "pnpm typeorm -- migration:run",
  "typeorm:migration:revert": "pnpm typeorm -- migration:revert",
  "test:cov": "jest --coverage --config jest.config.ts"
}
```

Key changes:
- `npm run typeorm` → `pnpm typeorm`
- TypeORM CLI migration:generate no longer uses `-n` flag (TypeORM 0.3 change — see dependency-upgrade-plan.md)
- `-d src/database/data-source.ts` added to TypeORM CLI invocation

---

## Step 7: Update Husky and lint-staged

Husky hooks currently use `yarn` implicitly. With pnpm, they still work because `pre-commit` runs `lint-staged` which calls ESLint directly. However, verify the `.husky/pre-commit` file:

```bash
cat /Users/augusto/Repos/msgops/msgops-api/.husky/pre-commit
```

If it contains `yarn pre-commit` or `npm run pre-commit`, update to:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm pre-commit
```

Or directly:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm exec lint-staged
```

Husky 6 (current) and Husky 8 (recommended with pnpm) have slightly different installation mechanics. With pnpm, husky works correctly when invoked via `pnpm prepare` (which runs `husky install`). Verify:
```bash
pnpm prepare
ls .husky/
```

---

## Step 8: Update commitlint Configuration

`commitlint` currently uses `@commitlint/cli` and `@commitlint/config-conventional`. These work with pnpm without changes. The commitlint hook in `.husky/commit-msg` (if it exists) should call:
```bash
pnpm commitlint --edit "$1"
```

---

## Step 9: Update Dockerfile

Replace yarn with pnpm in the Dockerfile. This follows from the multi-stage Dockerfile introduced in dependency-upgrade-plan.md Step 14.

**Final Dockerfile (`/Users/augusto/Repos/msgops/msgops-api/Dockerfile`):**

```dockerfile
# Stage 1: Builder
FROM node:24-alpine AS builder

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /usr/src/app

# Copy lockfile and manifest for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Stage 2: Production
FROM node:24-alpine AS production

# Enable Corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /usr/src/app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=5000
ENV TZ=America/Sao_Paulo

# Copy lockfile and manifest
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 5000

# Run directly with node — no pnpm overhead at runtime
CMD ["node", "dist/main"]
```

### Notes on the Dockerfile

**pnpm version pinning:** `corepack prepare pnpm@9.15.0 --activate` ensures the exact pnpm version is used in Docker, matching the `"packageManager"` field in `package.json`.

**`--frozen-lockfile`:** Prevents pnpm from updating the lockfile during CI/Docker builds. This is the equivalent of `yarn install --frozen-lockfile`. If the lockfile is out of sync, the build fails visibly rather than silently updating.

**`--prod` flag:** `pnpm install --prod` (or `--production`) installs only `dependencies`, not `devDependencies`. This keeps the production image small.

**`COPY --from=builder`:** Only the compiled `dist/` directory is copied to the production stage, not the source TypeScript files.

**Size comparison:**
- Current: `node:18-slim` + full node_modules + source = ~800MB+ image
- New: `node:24-alpine` + prod node_modules + dist only = ~350-450MB image

### .dockerignore

Create or update `/Users/augusto/Repos/msgops/msgops-api/.dockerignore`:
```
node_modules
dist
coverage
.git
.gitignore
*.md
docs/
tests/
.husky
.eslintrc.js
eslint.config.js
jest.config.ts
tsconfig.json
tsconfig.build.json
sonar-project.ts
```

---

## Step 10: Update .gitignore

Add pnpm-specific entries:
```gitignore
# pnpm
.pnpm-store/
.pnpm-debug.log
```

The `pnpm-lock.yaml` file must be committed (do NOT add it to `.gitignore`).

---

## Step 11: Update CI/CD Pipeline

The CI/CD pipeline (GitLab CI) must be updated to use pnpm. Locate the CI config:

```bash
ls /Users/augusto/Repos/msgops/msgops-api/.gitlab-ci.yml 2>/dev/null || \
ls /Users/augusto/Repos/msgops/.gitlab-ci.yml 2>/dev/null || \
echo "CI config not found in expected locations"
```

Generic update pattern for GitLab CI (adapt to actual file structure):

```yaml
# Before
install:
  script:
    - yarn install --frozen-lockfile

build:
  script:
    - yarn build

test:
  script:
    - yarn test:cov

# After
install:
  script:
    - corepack enable
    - pnpm install --frozen-lockfile

build:
  script:
    - pnpm build

test:
  script:
    - pnpm test:cov
```

Also update the Cloud Build config if it references yarn:
```bash
grep -r "yarn" /Users/augusto/Repos/msgops/msgops-api/cloudbuild.yaml 2>/dev/null || echo "No cloudbuild.yaml found"
```

---

## Step 12: Verify the Migration

Run the full verification sequence:

```bash
# 1. Clean install
rm -rf node_modules
pnpm install --frozen-lockfile

# 2. Build
pnpm build
echo "Build exit code: $?"

# 3. Tests
pnpm test
echo "Test exit code: $?"

# 4. Coverage
pnpm test:cov

# 5. Lint
pnpm lint

# 6. TypeORM migration run (requires DB connection)
pnpm typeorm:migration:run

# 7. Start development server
pnpm start:dev
# Verify: GET http://localhost:5001/api-docs/
```

---

## Step 13: Docker Build Verification

```bash
cd /Users/augusto/Repos/msgops/msgops-api

# Build the image
docker build -t msgops-api:pnpm-test .

# Check image size
docker images msgops-api:pnpm-test

# Run the container (will fail without real env vars, but verify startup sequence)
docker run --rm \
  -e NODE_ENV=production \
  -e SERVER_PORT=5001 \
  -p 5001:5000 \
  msgops-api:pnpm-test

# The container should start and print NestJS bootstrap logs
# It will fail on DB connection without env vars — that's expected
```

---

## Rollback Plan

If pnpm migration causes blocking issues:

1. Restore `yarn.lock` from git history: `git checkout HEAD~1 -- yarn.lock`
2. Delete `pnpm-lock.yaml`
3. Remove `"packageManager"` from `package.json`
4. Run `yarn install`
5. Revert `.npmrc` and Dockerfile changes

The dependency upgrade (Phase 2) is independent of the package manager change. Phase 2 can be completed with yarn if pnpm migration needs to be deferred.

---

## Common pnpm Issues in NestJS Projects

### Issue: `Cannot find module 'X'` at runtime

Cause: pnpm strict mode does not hoist phantom dependencies.
Fix: `shamefully-hoist=true` in `.npmrc` (already set in Step 4).

### Issue: Native module build failures (sharp, pg)

Cause: Alpine Linux requires `python3`, `make`, `g++` for native module compilation.
Fix: Add to Dockerfile builder stage:
```dockerfile
RUN apk add --no-cache python3 make g++
```

The `sharp` package has prebuilt binaries for `linux-arm64` and `linux-x64` on musl (Alpine). Verify the platform:
```dockerfile
RUN node -e "require('sharp')" || apk add --no-cache vips-dev
```

### Issue: pnpm version mismatch in CI

Cause: CI runner has different pnpm version than `"packageManager"` field.
Fix: Always use `corepack enable && corepack prepare pnpm@X.Y.Z --activate` before any pnpm commands in CI.

### Issue: Husky hooks not running

Cause: pnpm does not run `prepare` script automatically on `pnpm install` in some configurations.
Fix: Explicitly run `pnpm prepare` or add to CI pipeline as a post-install step.

### Issue: TypeORM CLI cannot find entities

Cause: pnpm symlinks vs absolute paths in entity glob pattern.
Fix: Use `__dirname` in DataSource config rather than relative paths:
```typescript
entities: [path.join(__dirname, '/../entities/*.entity{.ts,.js}')],
```

---

## Summary of File Changes

| File | Change |
|---|---|
| `package.json` | Add `"packageManager": "pnpm@9.15.0"`, update `npm run` → `pnpm` in scripts |
| `pnpm-lock.yaml` | New file (generated by `pnpm import`) |
| `yarn.lock` | Delete |
| `.npmrc` | New file with `shamefully-hoist=true` |
| `Dockerfile` | Replace yarn with pnpm, add corepack, keep multi-stage |
| `.dockerignore` | Add `node_modules`, `dist`, docs, test config files |
| `.gitignore` | Add `.pnpm-store/` |
| `.husky/pre-commit` | Update to use `pnpm` |
| `.husky/commit-msg` | Update if it uses yarn/npm |
| `.gitlab-ci.yml` | Update install/build/test scripts |
| `cloudbuild.yaml` | Update if it uses yarn |
