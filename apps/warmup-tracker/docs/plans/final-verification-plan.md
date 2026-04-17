# Final Verification Plan: warmup-tracker

## Objective

Validate that all improvements defined in the master plan have been correctly applied and that the `warmup-tracker` service is in a production-ready state. This plan is executed last, after the test coverage plan, dependency upgrade plan, and pnpm migration plan are all complete.

## Prerequisites

All of the following must be true before beginning final verification:

- [ ] Test coverage plan: fully implemented (all spec files created, coverage thresholds configured)
- [ ] Dependency upgrade plan: completed (`npm audit --audit-level=high` passes, no outdated packages with critical updates)
- [ ] pnpm migration plan: completed (`pnpm-lock.yaml` committed, `package-lock.json` deleted, Dockerfile is multi-stage)
- [ ] All changes are on a feature branch; the branch is up to date with the base branch
- [ ] Docker is available locally
- [ ] pnpm is available locally (via Corepack or direct install)

## Verification Checklist

The verification is divided into 6 areas. Each area must pass in full before the initiative is considered complete.

---

### Area 1: Package Manager Consistency

**Goal**: Confirm that `pnpm` is the single package manager in use throughout the service.

#### Checks

**1.1 — No `npm` references in `package.json` scripts**

```bash
grep -n '"npm' warmup-tracker/package.json
```

Expected output: no matches. Any remaining `npm` in script values is a failure.

**1.2 — `packageManager` field is set**

```bash
node -e "const p = require('./package.json'); console.log(p.packageManager)"
```

Expected: a string like `pnpm@9.x.x`.

**1.3 — `pnpm-lock.yaml` exists and is tracked by git**

```bash
ls -la warmup-tracker/pnpm-lock.yaml
git -C warmup-tracker ls-files pnpm-lock.yaml
```

Expected: file exists and is listed in git.

**1.4 — `package-lock.json` is absent**

```bash
ls warmup-tracker/package-lock.json 2>&1 || echo "ABSENT (correct)"
```

Expected: file does not exist.

**1.5 — Corepack recognizes the package manager**

```bash
cd warmup-tracker && corepack install
```

Expected: exits with code 0 and prints the pnpm version being activated.

---

### Area 2: Test Suite

**Goal**: Confirm all tests pass and coverage thresholds are met.

#### Checks

**2.1 — All tests pass**

```bash
cd warmup-tracker && pnpm test
```

Expected: all test suites pass, exit code 0. Fail if any test is skipped with `.skip` or `.only` (these must not be present in committed code).

Check for stray `.skip` and `.only`:

```bash
grep -rn '\.skip\|\.only' warmup-tracker/src --include='*.spec.ts'
```

Expected: no matches.

**2.2 — Coverage thresholds pass**

```bash
cd warmup-tracker && pnpm test:cov
```

Expected: Jest reports >= 80% lines, >= 80% statements, >= 80% functions, >= 75% branches for all covered files. Exit code must be 0. If thresholds are configured in `jest.config` / `package.json`, a failing threshold will cause a non-zero exit.

**2.3 — All target spec files exist**

```bash
ls warmup-tracker/src/app.controller.spec.ts
ls warmup-tracker/src/app.service.spec.ts
ls warmup-tracker/src/slack/slack.service.spec.ts
ls warmup-tracker/src/entities/warmup-user.entity.spec.ts
```

Expected: all 4 files exist.

**2.4 — Minimum test counts**

```bash
cd warmup-tracker && pnpm test --verbose 2>&1 | grep -E 'Tests:|✓|✗|PASS|FAIL'
```

Expected: total test count >= 30. No failing tests.

**2.5 — No real network calls in tests**

Confirm that test runs do not require internet access. Run tests in offline mode if possible:

```bash
# Disconnect from internet temporarily or check for jest.mock usage
grep -rn "new WebClient\|@slack/web-api" warmup-tracker/src --include='*.spec.ts'
```

Expected: any import of `@slack/web-api` in spec files is inside a `jest.mock(...)` call.

**2.6 — No real database calls in tests**

```bash
grep -rn "TypeOrmModule\|createConnection\|DataSource" warmup-tracker/src --include='*.spec.ts'
```

Expected: no real `TypeOrmModule.forRoot()` or `createConnection()` calls in spec files. All repository usage should be via mock providers.

---

### Area 3: Build

**Goal**: Confirm the TypeScript build succeeds cleanly.

#### Checks

**3.1 — `pnpm build` succeeds**

```bash
cd warmup-tracker && pnpm build
```

Expected: exits with code 0. The `dist/` directory is populated with compiled JavaScript.

**3.2 — `dist/main.js` exists**

```bash
ls warmup-tracker/dist/main.js
```

Expected: file exists.

**3.3 — No TypeScript errors**

```bash
cd warmup-tracker && pnpm exec tsc --noEmit
```

Expected: exits with code 0, no error output.

---

### Area 4: Code Quality

**Goal**: Confirm linting passes with no errors or warnings.

#### Checks

**4.1 — ESLint passes**

```bash
cd warmup-tracker && pnpm lint
```

Expected: exits with code 0. No errors. Warnings are acceptable if they are pre-existing and documented; new warnings introduced by the changes are a failure.

**4.2 — ESLint configuration is valid**

```bash
cd warmup-tracker && pnpm exec eslint --print-config src/app.service.ts > /dev/null
```

Expected: exits with code 0 (config resolves without errors).

**4.3 — Format check (if Prettier is configured)**

```bash
cd warmup-tracker && pnpm format:check 2>/dev/null || echo "No format check configured"
```

Expected: either exits with code 0 or the script is not configured (acceptable).

---

### Area 5: Security Audit

**Goal**: Confirm zero high or critical vulnerabilities.

#### Checks

**5.1 — pnpm audit passes at high severity level**

```bash
cd warmup-tracker && pnpm audit --audit-level=high
```

Expected: exits with code 0. If any high or critical vulnerabilities exist, they must be resolved before this check passes.

**5.2 — Audit summary review**

```bash
cd warmup-tracker && pnpm audit 2>&1 | tail -5
```

Document the exact audit summary (number of vulnerabilities per severity). This serves as a baseline for future audits.

**5.3 — No deprecated packages in production dependencies**

```bash
cd warmup-tracker && pnpm outdated --prod 2>&1 | head -30
```

Review the output. Packages with available major version upgrades should be noted. Packages that are fully deprecated (removed from npm) are a failure condition.

---

### Area 6: Docker Build and Image

**Goal**: Confirm the multi-stage Dockerfile builds successfully and produces a correct, smaller image.

#### Checks

**6.1 — Docker build succeeds**

```bash
cd warmup-tracker && docker build -t warmup-tracker:verification .
```

Expected: exits with code 0. All build stages complete without error.

**6.2 — Docker image has exactly 2 build stages**

```bash
grep -c '^FROM' warmup-tracker/Dockerfile
```

Expected: `2` (builder stage + production stage).

**6.3 — Production stage uses non-root user**

```bash
grep 'USER node' warmup-tracker/Dockerfile
```

Expected: at least one match in the production stage.

**6.4 — `--frozen-lockfile` is used in Dockerfile**

```bash
grep 'frozen-lockfile' warmup-tracker/Dockerfile
```

Expected: at least one match. This ensures the Docker build uses the locked versions.

**6.5 — `--prod` flag used in production stage**

```bash
grep -- '--prod' warmup-tracker/Dockerfile
```

Expected: at least one match (in the production stage's install command).

**6.6 — Image starts correctly**

```bash
docker run --rm warmup-tracker:verification node -e "console.log('warmup-tracker ok')"
```

Expected: prints `warmup-tracker ok` and exits with code 0.

**6.7 — Image size is acceptable**

```bash
docker image inspect warmup-tracker:verification --format='{{.Size}}' | numfmt --to=iec
```

Record the image size. Compare against the baseline (if available). The production image should be smaller than the original single-stage build.

Target: <= 400 MB. Alert if > 500 MB (investigate large dependencies).

**6.8 — `pnpm` is NOT included in the final production image (optional hardening)**

If the Dockerfile is designed to exclude pnpm from the production stage after install:

```bash
docker run --rm warmup-tracker:verification sh -c "which pnpm || echo 'pnpm not in PATH (correct for runtime)'"
```

This check is optional and depends on the Dockerfile design.

---

## End-to-End Smoke Test

If a test PostgreSQL database and Slack token are available in a staging environment, perform a manual smoke test:

### Setup

```bash
# Set required environment variables
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=warmup_tracker_test
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=...
export SLACK_TOKEN=xoxb-test-token
export SLACK_CHANNEL=C0123456789
export PORT=3000
```

### Start the service

```bash
cd warmup-tracker && pnpm start:dev
```

### Send a test request

```bash
curl -s -X POST http://localhost:3000/notify \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "warmup@example.com",
    "event": "replied",
    "subject": "Re: Hello from warmup",
    "messageId": "test-msg-123"
  }' | jq .
```

Expected: HTTP 200 or 201 response. Check Slack channel for the notification message.

---

## Final Sign-Off Checklist

Complete this checklist before merging to the main branch:

### Package Manager
- [ ] 1.1 No `npm` references in `package.json` scripts
- [ ] 1.2 `packageManager` field is set in `package.json`
- [ ] 1.3 `pnpm-lock.yaml` exists and is committed to git
- [ ] 1.4 `package-lock.json` is absent from the repository
- [ ] 1.5 Corepack recognizes the package manager version

### Tests
- [ ] 2.1 All tests pass (`pnpm test` exits 0)
- [ ] 2.2 Coverage thresholds pass (`pnpm test:cov` exits 0)
- [ ] 2.3 All 4 target spec files exist
- [ ] 2.4 Total test count >= 30
- [ ] 2.5 No real network calls in tests (`@slack/web-api` is mocked)
- [ ] 2.6 No real database calls in tests (TypeORM repository is mocked)

### Build
- [ ] 3.1 `pnpm build` exits with code 0
- [ ] 3.2 `dist/main.js` exists after build
- [ ] 3.3 `tsc --noEmit` exits with code 0

### Code Quality
- [ ] 4.1 `pnpm lint` exits with code 0
- [ ] 4.2 ESLint configuration resolves without errors

### Security
- [ ] 5.1 `pnpm audit --audit-level=high` exits with code 0
- [ ] 5.2 Audit summary is documented in this file (fill in below)
- [ ] 5.3 No fully deprecated production packages

### Docker
- [ ] 6.1 `docker build` exits with code 0
- [ ] 6.2 Dockerfile has exactly 2 `FROM` stages
- [ ] 6.3 Production stage includes `USER node`
- [ ] 6.4 `--frozen-lockfile` used in Dockerfile
- [ ] 6.5 `--prod` flag used in production stage
- [ ] 6.6 Container starts and runs node successfully
- [ ] 6.7 Image size is <= 400 MB

---

## Audit Summary (Fill in After Verification)

Date of verification: _______________

| Metric | Result |
|---|---|
| Total tests | |
| Line coverage % | |
| Branch coverage % | |
| Function coverage % | |
| Audit vulnerabilities (critical) | |
| Audit vulnerabilities (high) | |
| Audit vulnerabilities (moderate) | |
| Docker image size | |
| Build time (pnpm build) | |
| pnpm version | |
| Node.js version | |

---

## Escalation

If any check fails and cannot be resolved within 1 hour, escalate as follows:

1. Document the failure in a comment on the merge request / pull request
2. Tag the relevant sub-plan (test coverage, dependency upgrade, or pnpm migration) for the area that failed
3. Do NOT merge until all checks in the Final Sign-Off Checklist are green
4. If a check must be waived, document the reason explicitly and get approval from a second reviewer
