# pnpm Migration Plan: warmup-tracker

## Objective

Resolve the package manager inconsistency in `warmup-tracker` where the `Dockerfile` uses `pnpm` but `package.json` scripts and the development workflow use `npm`. The goal is to standardize on `pnpm` throughout: in `package.json` scripts, the `Dockerfile`, the lock file, and the Volta configuration.

Additionally, upgrade the `Dockerfile` from a single-stage to a multi-stage build to reduce the final Docker image size and improve build security posture.

## Problem Statement

The current state creates the following risks:

| Risk | Impact |
|---|---|
| Dockerfile uses `pnpm` but `package.json` uses `npm` | If `npm` produces a different `node_modules` tree than `pnpm`, the Docker build may behave differently from local development |
| Both `package-lock.json` (npm) and potentially a stale `pnpm-lock.yaml` may coexist | Creates dependency resolution ambiguity |
| No single source of truth for which package manager is canonical | Onboarding confusion; CI/CD may use the wrong one |
| Single-stage Docker build includes build tools in the final image | Larger image size; increased attack surface |

## Prerequisites

- [ ] Test coverage plan is implemented and all tests pass
- [ ] Dependency upgrade plan is completed
- [ ] `npm test` exits with code 0 on the current codebase
- [ ] Docker is available locally for testing image builds
- [ ] You have verified the current Dockerfile behavior (note which pnpm version it uses)

## Step 1: Read Current Files

Before making any changes, document the exact current state:

### 1a. Current `package.json` scripts section

Read `package.json` and note all script values that contain `npm run`, `npm install`, or reference `npm` directly. These must all be updated.

### 1b. Current `Dockerfile`

Read the Dockerfile and identify:
- The base image (`node:20-slim` expected)
- Where `pnpm` is installed (likely via `npm install -g pnpm` or `corepack enable`)
- The `pnpm install` call
- The `CMD` or `ENTRYPOINT`

### 1c. Volta configuration in `package.json`

Check for a `"volta"` key. If present:

```json
{
  "volta": {
    "node": "20.9.0"
  }
}
```

pnpm can be pinned here as well.

## Step 2: Install pnpm and Verify

If pnpm is not already available locally:

```bash
# Via Corepack (recommended for Node.js 20+)
corepack enable
corepack prepare pnpm@latest --activate

# Or via npm globally
npm install -g pnpm
```

Check the pnpm version installed in the current Dockerfile and match it locally:

```bash
pnpm --version
```

## Step 3: Generate `pnpm-lock.yaml`

From the `warmup-tracker` directory:

```bash
# Remove npm lock file
rm package-lock.json

# Remove node_modules to ensure a clean install
rm -rf node_modules

# Generate pnpm lockfile from existing package.json
pnpm install
```

Verify that:
- `pnpm-lock.yaml` was created
- `node_modules` is populated correctly
- `pnpm test` passes

```bash
pnpm test
```

## Step 4: Update `package.json` Scripts

Replace all `npm run` and `npm` references in `package.json` scripts with `pnpm` equivalents.

### Common Script Mapping

| Old (npm) | New (pnpm) |
|---|---|
| `npm install` | `pnpm install` |
| `npm run build` | `pnpm build` |
| `npm run start` | `pnpm start` |
| `npm run start:dev` | `pnpm start:dev` |
| `npm run start:prod` | `pnpm start:prod` |
| `npm run test` | `pnpm test` |
| `npm run test:cov` | `pnpm test:cov` |
| `npm run test:e2e` | `pnpm test:e2e` |
| `npm run lint` | `pnpm lint` |

### Volta Pin (Optional but Recommended)

Add pnpm to the Volta section of `package.json`:

```json
{
  "volta": {
    "node": "20.9.0",
    "pnpm": "9.x.x"
  }
}
```

Replace `9.x.x` with the actual pnpm version being used.

### `packageManager` Field (Recommended)

Add the `packageManager` field to `package.json` to signal intent to tooling:

```json
{
  "packageManager": "pnpm@9.x.x"
}
```

This is used by Corepack to enforce the correct package manager version automatically.

## Step 5: Add `.npmrc` for pnpm Configuration

Create a `.npmrc` file in the `warmup-tracker` root if it does not already exist:

```ini
# Ensure hoisting behavior is compatible with NestJS
# NestJS requires certain packages to be hoisted
shamefully-hoist=false
strict-peer-dependencies=false
```

> Note: NestJS projects sometimes require `shamefully-hoist=true` if they rely on hoisted package resolution. Test with the default first and only enable hoisting if tests or the build fail.

## Step 6: Upgrade Dockerfile to Multi-Stage Build

Replace the current single-stage Dockerfile with a multi-stage build.

### Current Single-Stage Structure (Expected)

```dockerfile
FROM node:20-slim
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json ./
RUN pnpm install
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["node", "dist/main"]
```

### New Multi-Stage Structure

```dockerfile
# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-slim AS builder

# Enable corepack for pnpm management
RUN corepack enable

WORKDIR /app

# Copy only package manifests first (layer caching)
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the NestJS application
RUN pnpm build

# ============================================================
# Stage 2: Production
# ============================================================
FROM node:20-slim AS production

# Enable corepack for pnpm management
RUN corepack enable

WORKDIR /app

# Copy package manifests
COPY package.json pnpm-lock.yaml ./

# Install ONLY production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Run as non-root user for security
USER node

EXPOSE 3000

CMD ["node", "dist/main"]
```

### Key Improvements in Multi-Stage Build

| Improvement | Benefit |
|---|---|
| Build tools (TypeScript, ts-node, etc.) excluded from final image | Smaller image size |
| `--frozen-lockfile` in both stages | Reproducible, deterministic builds |
| `--prod` flag in production stage | Only runtime dependencies installed |
| `USER node` in production stage | Reduced privilege attack surface |
| Layer caching on `package.json` + `pnpm-lock.yaml` | Faster Docker builds when only source changes |

### Estimated Image Size Reduction

| Stage | Approximate Size |
|---|---|
| Single-stage (current) | ~500-700 MB |
| Multi-stage production stage | ~200-350 MB |

Actual sizes depend on the number of dependencies. Measure with:

```bash
docker images warmup-tracker
```

## Step 7: Update `.gitignore`

Ensure the following entries are present in `.gitignore`:

```
# Remove npm lock file (replaced by pnpm-lock.yaml)
package-lock.json

# Keep pnpm-lock.yaml (do NOT gitignore it)
# pnpm-lock.yaml should be committed

node_modules/
```

## Step 8: Update CI/CD Pipeline

If a CI/CD configuration file exists (`.gitlab-ci.yml`, `cloudbuild.yaml`, etc.), update it to use pnpm:

### GitLab CI Example

```yaml
variables:
  PNPM_VERSION: "9"

before_script:
  - corepack enable
  - corepack prepare pnpm@${PNPM_VERSION} --activate
  - pnpm install --frozen-lockfile

test:
  stage: test
  script:
    - pnpm test
    - pnpm test:cov

build:
  stage: build
  script:
    - pnpm build
```

### Cloud Build Example (`cloudbuild.yaml`)

```yaml
steps:
  - name: 'node:20-slim'
    entrypoint: 'sh'
    args:
      - '-c'
      - |
        corepack enable
        pnpm install --frozen-lockfile
        pnpm build
        pnpm test
```

## Step 9: Local Verification

Run the full verification sequence locally before pushing:

```bash
# Verify all tests pass with pnpm
pnpm test
pnpm test:cov

# Verify build
pnpm build

# Verify lint
pnpm lint

# Verify Docker build
docker build -t warmup-tracker:pnpm-migration .

# Verify Docker image runs
docker run --rm -e NODE_ENV=test warmup-tracker:pnpm-migration node -e "console.log('OK')"
```

## Step 10: Commit Changes

```bash
git add \
  package.json \
  pnpm-lock.yaml \
  Dockerfile \
  .npmrc \
  .gitignore

git commit -m "chore(build): migrate from npm to pnpm and add multi-stage Dockerfile"
```

Do NOT commit `package-lock.json` (it should be removed).

## Rollback Procedure

If migration causes issues:

1. Restore `package.json` from git
2. Restore the original `Dockerfile` from git
3. Delete `pnpm-lock.yaml`
4. Run `npm install` to restore `package-lock.json`
5. Run `npm test` to confirm restoration
6. Document the failure in this plan

## Common Issues and Solutions

| Issue | Cause | Solution |
|---|---|---|
| `Module not found` after pnpm install | pnpm's strict module resolution doesn't hoist packages that npm hoisted | Add `shamefully-hoist=true` to `.npmrc` (temporary) or add the missing package explicitly to dependencies |
| Docker build fails on `pnpm install --frozen-lockfile` | `pnpm-lock.yaml` doesn't match `package.json` | Run `pnpm install` locally, commit the updated lockfile, rebuild |
| `corepack` not available in Docker base image | `node:20-slim` includes Corepack but it may need to be enabled | Add `RUN corepack enable` before any pnpm commands |
| Tests fail after pnpm migration | Difference in `node_modules` tree (rare) | Run `pnpm install --shamefully-hoist` and investigate |
| Volta does not recognize pnpm | Volta's pnpm support is separate from npm | Run `volta install pnpm` on developer machines |

## Definition of Done

- [ ] `package-lock.json` is deleted from the repository
- [ ] `pnpm-lock.yaml` exists and is committed
- [ ] All `package.json` scripts use `pnpm` (no `npm run` references)
- [ ] `packageManager` field is set in `package.json`
- [ ] `Dockerfile` uses multi-stage build with `pnpm` exclusively
- [ ] `Dockerfile` uses `--frozen-lockfile` in both stages
- [ ] `Dockerfile` production stage uses `--prod` flag
- [ ] `Dockerfile` production stage runs as `USER node`
- [ ] `pnpm test` exits with code 0
- [ ] `pnpm test:cov` meets coverage thresholds
- [ ] `pnpm build` exits with code 0
- [ ] `docker build -t warmup-tracker .` succeeds
- [ ] Docker image size is smaller than the single-stage build
- [ ] CI/CD pipeline updated to use pnpm
