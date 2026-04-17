# Final Verification Plan — msgops-api

## Objective

Provide a structured end-to-end checklist to validate that all four upgrade phases completed successfully before promoting the upgraded msgops-api to production. This plan covers: build verification, database integrity, API smoke tests, Docker validation, performance baseline, and production deployment protocol.

This plan runs **after** all three preceding plans are complete:
- Phase 1: test-coverage-plan.md — all new specs passing
- Phase 2: dependency-upgrade-plan.md — NestJS 11, TypeORM 0.3, TypeScript 5 compiled
- Phase 3: pnpm-migration-plan.md — pnpm 9.x, Docker multi-stage, lockfile committed

---

## Gate Criteria Reminder

Each phase had its own gate criteria. Before executing this plan, confirm all gates are green:

| Gate | Command | Expected |
|---|---|---|
| TypeScript compile | `pnpm build` | Exit 0, no errors |
| Unit tests | `pnpm test` | Exit 0, all pass |
| Coverage | `pnpm test:cov` | >= 80% lines on services/providers |
| Lint | `pnpm lint` | Exit 0, no errors |
| Docker build | `docker build -t msgops-api:verify .` | Exit 0 |

---

## Section 1: Static Analysis

### 1.1 TypeScript Strict Mode Audit

The upgrade deliberately kept `strictNullChecks: false` and `noImplicitAny: false` to avoid scope creep. Document the count of potential issues for future hardening:

```bash
# Count files with implicit any (without enabling it globally)
cd /Users/augusto/Repos/msgops/msgops-api
npx tsc --noEmit --noImplicitAny 2>&1 | grep "error TS7" | wc -l

# Count null-related issues
npx tsc --noEmit --strictNullChecks 2>&1 | grep "error TS2" | wc -l
```

Record these numbers in a tracking comment or ticket. They represent future tech debt, not blocking issues.

### 1.2 Dependency Audit

```bash
# Check for known vulnerabilities
pnpm audit

# List outdated packages (informational only, not blocking)
pnpm outdated
```

Expected: Zero critical or high severity vulnerabilities after the upgrade. If any remain, evaluate whether they are in production code paths or only devDependencies.

### 1.3 Orphaned Type Declarations

With the removal of `mysql` and `@types/sequelize`, verify no remaining imports reference them:

```bash
grep -rn "sequelize\|mysql" /Users/augusto/Repos/msgops/msgops-api/src/
# Expected: 0 results
```

### 1.4 nestjs-redis Removal Verification

```bash
grep -rn "nestjs-redis\|RedisModule\|InjectRedis" /Users/augusto/Repos/msgops/msgops-api/src/
# Expected: 0 results
```

### 1.5 HttpModule Import Source Verification

```bash
grep -rn "HttpModule\|HttpService" /Users/augusto/Repos/msgops/msgops-api/src/ | grep "@nestjs/common"
# Expected: 0 results (all moved to @nestjs/axios)
```

---

## Section 2: Test Suite Verification

### 2.1 Full Unit Test Run

```bash
cd /Users/augusto/Repos/msgops/msgops-api
pnpm test --verbose 2>&1 | tee docs/plans/final-test-output.txt

echo "Exit code: $?"
grep -E "Tests:|Test Suites:|passed|failed" docs/plans/final-test-output.txt
```

**Pass criteria:**
- Exit code: 0
- "Test Suites: X passed, 0 failed" where X >= 35 (3 original + 32 new)
- "Tests: Y passed, 0 failed" where Y >= 200 (estimate based on test-coverage-plan.md)

### 2.2 Coverage Report

```bash
pnpm test:cov 2>&1 | tee docs/plans/final-coverage-output.txt

# Extract summary
grep -A5 "Coverage summary" docs/plans/final-coverage-output.txt
```

**Pass criteria by file category:**

| Category | Target Coverage |
|---|---|
| `src/modules/**/*.service.ts` | >= 80% lines |
| `src/providers/**/*.ts` | >= 80% lines |
| `src/handlers/**/*.ts` | >= 60% lines |
| `src/utils/**/*.ts` | >= 70% lines |
| Overall | >= 75% lines |

### 2.3 Jest Configuration Validation

Verify Jest 30 config loads correctly:

```bash
pnpm exec jest --showConfig 2>&1 | grep -E "testEnvironment|transform|collectCoverage"
```

Expected:
- `testEnvironment: "node"`
- Transform includes `ts-jest` for `.ts` files

---

## Section 3: TypeORM Migration Integrity

### 3.1 Count Migrations

```bash
ls /Users/augusto/Repos/msgops/msgops-api/src/migrations/ | wc -l
# Should match pre-upgrade count: 126+
```

New migrations may have been added during the upgrade (e.g., for DataSource config changes). Verify no existing migrations were accidentally deleted.

### 3.2 Migration Dry Run (Staging DB)

**Prerequisites:** Access to a staging PostgreSQL database with the same schema state as production.

```bash
# Set up env vars for staging DB
export TYPEORM_HOST=staging-db-host
export TYPEORM_PORT=5432
export TYPEORM_USERNAME=msgops_user
export TYPEORM_PASSWORD=...
export TYPEORM_DATABASE=msgops_staging
export TYPEORM_MIGRATIONS_RUN=false  # We'll run manually

# Show pending migrations without applying
pnpm typeorm -- migration:show

# Apply all pending migrations
pnpm typeorm:migration:run

echo "Migration run exit code: $?"
```

**Pass criteria:**
- All 126+ existing migrations show as "applied" (already ran against staging)
- Any new migrations added during upgrade apply cleanly
- No SQL errors in output

### 3.3 DataSource Configuration Verification

```bash
# Verify the DataSource file compiles correctly
pnpm exec ts-node -r tsconfig-paths/register src/database/data-source.ts

# This should load without errors (DB connection attempt will fail without real creds,
# but import and configuration parsing should succeed)
```

### 3.4 Entity Schema Sync Check

After migrations run on staging:

```bash
# Connect to staging DB and verify table count
psql $DATABASE_URL -c "\dt" | wc -l
# Should show 38+ tables corresponding to all entities
```

Cross-reference with entity files:
```bash
ls /Users/augusto/Repos/msgops/msgops-api/src/entities/*.entity.ts | wc -l
# 38 entity files
```

---

## Section 4: API Smoke Tests

### 4.1 Start the Server

```bash
cd /Users/augusto/Repos/msgops/msgops-api

# Copy and populate .env from .env.example
cp .env.example .env.test
# Edit .env.test with staging credentials

# Start with test environment
NODE_ENV=staging source .env.test && pnpm start:prod &
SERVER_PID=$!

# Wait for startup
sleep 5

# Check process is running
kill -0 $SERVER_PID && echo "Server is running" || echo "Server failed to start"
```

### 4.2 Health Check

```bash
# Basic connectivity
curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api-docs/
# Expected: 200

# Swagger JSON is valid
curl -s http://localhost:5001/api-docs-json | python3 -m json.tool > /dev/null
echo "Swagger JSON valid: $?"
```

### 4.3 Authentication Flow

```bash
# API key auth — use a test account's API key
curl -s -o /dev/null -w "%{http_code}" \
  -H "api-key: $TEST_API_KEY" \
  -H "account-id: $TEST_ACCOUNT_ID" \
  http://localhost:5001/accounts

# Expected: 200 or 403 (if key is invalid), NOT 500
```

### 4.4 Core Endpoint Smoke Tests

Run against the staging server using a test account:

```bash
BASE_URL="http://localhost:5001"
API_KEY="$TEST_API_KEY"
ACCOUNT_ID="$TEST_ACCOUNT_ID"

# Helper function
check_endpoint() {
  local method=$1
  local path=$2
  local expected=$3
  local code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X $method \
    -H "api-key: $API_KEY" \
    -H "account-id: $ACCOUNT_ID" \
    "$BASE_URL$path")

  if [ "$code" = "$expected" ]; then
    echo "PASS: $method $path -> $code"
  else
    echo "FAIL: $method $path -> $code (expected $expected)"
  fi
}

# Contacts module
check_endpoint GET "/contacts?page=1&limit=10" 200

# Automations module
check_endpoint GET "/automations?page=1&limit=10" 200

# Messages module
check_endpoint GET "/messages?page=1&limit=10" 200

# Campaigns module
check_endpoint GET "/campaigns?page=1&limit=10" 200

# Tags module
check_endpoint GET "/tags?page=1&limit=10" 200

# Pools module
check_endpoint GET "/pools" 200

# Accounts module — public endpoint
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/accounts" | xargs echo "GET /accounts (no auth):"
# Expected: 200 (this endpoint is in the exclude list of AccountMiddleware)

# Swagger UI
curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api-docs/" | xargs echo "GET /api-docs/:"
# Expected: 200
```

### 4.5 Internal Endpoints (excluded from middleware)

These endpoints do not require API key headers and must remain accessible:

```bash
check_no_auth_endpoint() {
  local path=$1
  local expected=$2
  local code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")

  if [ "$code" = "$expected" ]; then
    echo "PASS: GET $path -> $code"
  else
    echo "FAIL: GET $path -> $code (expected $expected)"
  fi
}

# These are in the AccountMiddleware exclude list in app.module.ts
check_no_auth_endpoint "/accounts" 200
check_no_auth_endpoint "/accounts/all" 200
check_no_auth_endpoint "/statistics/aggregated-statistics" 200

# These should still require auth (not in exclude list)
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/contacts")
[ "$code" = "401" ] && echo "PASS: /contacts requires auth" || echo "FAIL: /contacts returned $code"
```

### 4.6 Verify AccountMiddleware Exclude List Integrity

The `AccountMiddleware` exclude list in `app.module.ts` contains 20 routes. Verify each excluded route does not require `account-id` header:

```
accounts
accounts/all
accounts/sendgrid-subusers
automations/finish-testab
automations/key-name/:id
automations/messages-all
automations/messages-name
automations/started-testab
contacts/clean-push-devices
contacts/deactivate-inactive-contacts
contacts/events-update
contacts/remove-push-devices
messages/key-name/:id
messages/messages-all
messages/messages-name
messages/monitor-whatsapp-message/:id
messages/template/webhook
pools/sendgrid/ips
statistics/aggregated-statistics
statistics/bfp-account-usage
statistics/remove-old-data-from-redis
statistics/usage/:id
users/*
warmups/process-target
campaigns/late-campaigns
campaigns/accounts-without-campaigns
ip-reputation/sync
```

None of these should return 401 when called without `account-id` header. Any 401 response indicates the exclude list was incorrectly migrated.

---

## Section 5: Docker Validation

### 5.1 Build and Run

```bash
cd /Users/augusto/Repos/msgops/msgops-api

# Build production image
docker build -t msgops-api:final-verify . 2>&1 | tee docs/plans/docker-build-output.txt
echo "Docker build exit code: $?"

# Check image size (target: < 500MB)
docker images msgops-api:final-verify --format "{{.Size}}"

# Inspect layers
docker history msgops-api:final-verify
```

### 5.2 Container Startup Test

```bash
# Run with minimal env vars (will fail DB connection but should boot far enough to log)
docker run --rm \
  --name msgops-api-verify \
  -e NODE_ENV=test \
  -e SERVER_PORT=5001 \
  -p 5001:5000 \
  msgops-api:final-verify &

CONTAINER_PID=$!
sleep 8

# Check NestJS bootstrap logs
docker logs msgops-api-verify 2>&1 | head -30

# Should see: "NestFactory.create" and NestJS ASCII art banner
# Should NOT see: "Cannot find module" or "SyntaxError"

docker stop msgops-api-verify
```

### 5.3 pnpm in Docker Verification

```bash
# Verify pnpm was used in the build (not yarn)
docker run --rm msgops-api:final-verify \
  sh -c "ls node_modules/.pnpm 2>/dev/null && echo 'pnpm layout detected' || echo 'pnpm layout NOT found'"
```

### 5.4 Node Version in Container

```bash
docker run --rm msgops-api:final-verify node --version
# Expected: v24.x.x
```

---

## Section 6: Integration Verification (with real staging DB)

This section requires real service credentials and a staging database.

### 6.1 TypeORM Connection Verification

```bash
# Start the API with staging credentials
export $(cat .env.staging | xargs)
pnpm start:prod &
SERVER_PID=$!
sleep 10

# TypeORM logs connection on startup if TYPEORM_LOGGING=true
# Verify the log output includes:
# "query: SELECT * FROM "migrations""
# "All migrations have been run"
```

### 6.2 Sentry Integration Verification

After upgrading Sentry to `@sentry/node@^8`:

```bash
# Verify Sentry initializes without errors
grep "Sentry" docs/plans/server-startup.log 2>/dev/null || \
  echo "Check server startup logs manually for Sentry initialization"
```

Known Sentry v8 changes to verify:
- `Sentry.init()` is called before the first request
- `tracesSampleRate` is set (was `0.1` in original config)
- DSN format is still valid (v8 uses the same DSN format)

### 6.3 Redis Connectivity

```bash
# Trigger an endpoint that uses Redis (statistics aggregation)
curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/statistics/aggregated-statistics"
# Expected: 200 (or 204 if no data)
```

If Redis is not available in staging, this endpoint may return 500. Verify the error is from Redis connection failure and not from code.

### 6.4 PubSub Connectivity

```bash
# Trigger an email send (test endpoint if available)
curl -s -X POST \
  -H "api-key: $TEST_API_KEY" \
  -H "account-id: $TEST_ACCOUNT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "contact": {"email": "verify@example.com", "firstName": "Verify"},
    "message": {
      "subject": "Verify Test",
      "content": "Test content",
      "from": {"email": "from@example.com", "firstName": "From"}
    }
  }' \
  "$BASE_URL/services/send-email"

# Expected: 200 or 201 with a message ID
# The PubSub message won't be sent in non-production NODE_ENV
```

---

## Section 7: Performance Baseline

Before promoting to production, capture a performance baseline to detect regressions introduced by the upgrade.

### 7.1 Response Time Baseline

```bash
# Install wrk or use hey if available
# Example with curl timing
for i in {1..10}; do
  curl -s -o /dev/null -w "%{time_total}\n" \
    -H "api-key: $TEST_API_KEY" \
    -H "account-id: $TEST_ACCOUNT_ID" \
    "$BASE_URL/contacts?page=1&limit=10"
done | awk '{sum+=$1} END {print "Avg response time: " sum/NR "s"}'
```

**Target:** P99 response time for simple list endpoints < 200ms (equivalent to pre-upgrade baseline).

### 7.2 Startup Time

```bash
# Measure NestJS bootstrap time
time node dist/main &
SERVER_PID=$!
# Wait for the "Application is running on" log line
# Kill after measuring
```

**Target:** Bootstrap time < 15s (NestJS 11 with 25 modules should be comparable to NestJS 7).

### 7.3 Memory Baseline

```bash
# After server starts, check RSS memory
ps aux | grep "node dist/main" | awk '{print "RSS: " $6/1024 " MB"}'
```

**Target:** RSS < 512MB at idle (comparable to pre-upgrade).

---

## Section 8: Pre-Production Deployment Checklist

Complete this checklist before each production deployment attempt:

### Code Quality
- [ ] `pnpm build` exits 0 with zero TypeScript errors
- [ ] `pnpm lint` exits 0 with zero ESLint errors
- [ ] `pnpm test` exits 0 with all tests passing
- [ ] Coverage >= 80% for service/provider files
- [ ] No console.log statements added during upgrade (use NestJS Logger)
- [ ] No hardcoded credentials or DSN strings in source code (Sentry DSN in app.module.ts must be moved to env var)

### Security
- [ ] `pnpm audit` shows zero critical vulnerabilities
- [ ] `crypto` npm shim removed (Node built-in crypto used instead)
- [ ] `mysql` removed (no MySQL driver accessible from code)
- [ ] `reflect-metadata` upgraded to `^0.2.x`

### Database
- [ ] Staging migration run completed successfully
- [ ] All 38 entities have corresponding tables in staging
- [ ] Migration 126+ (all existing) are in the applied state
- [ ] No data was lost in staging during migration run

### Infrastructure
- [ ] Docker image builds from `node:24-alpine`
- [ ] Docker image uses multi-stage build
- [ ] pnpm-lock.yaml is committed and matches package.json
- [ ] No yarn.lock file in repository
- [ ] `.npmrc` committed with `shamefully-hoist=true` (initial)
- [ ] Dockerfile uses `--frozen-lockfile`

### API Compatibility
- [ ] All smoke test endpoints return expected HTTP status codes
- [ ] AccountMiddleware exclude list preserved exactly
- [ ] Swagger UI loads at `/api-docs/`
- [ ] Swagger JSON is valid OpenAPI 3.0
- [ ] JWT authentication still works (Auth0 jwks-rsa)
- [ ] API key authentication still works (passport-headerapikey)

### External Services
- [ ] PubSub provider initializes (no credential errors at startup)
- [ ] Redis connection succeeds (check logs)
- [ ] Sentry captures a test event (trigger a deliberate error in staging)
- [ ] BigQuery provider available (query returns in staging)
- [ ] GCS bucket access verified (upload/download test)

---

## Section 9: Production Deployment Protocol

### 9.1 Pre-Deployment

1. Announce maintenance window in team channel (min 30 min notice)
2. Verify staging is green on all checklist items above
3. Create a git tag for the release:
   ```bash
   git tag -a v0.2.0-nestjs11 -m "NestJS 11 upgrade, pnpm migration, test coverage"
   git push origin v0.2.0-nestjs11
   ```
4. Verify the production DB migration state matches staging:
   ```bash
   pnpm typeorm -- migration:show
   ```

### 9.2 Deployment Steps

```bash
# 1. Build production Docker image
gcloud builds submit --tag gcr.io/PROJECT_ID/msgops-api:nestjs11

# 2. Deploy to Cloud Run (with traffic split — 10% initially)
gcloud run deploy msgops-api \
  --image gcr.io/PROJECT_ID/msgops-api:nestjs11 \
  --region us-east1 \
  --port 5000 \
  --no-traffic  # Deploy but don't send traffic yet

# 3. Verify new revision starts correctly
gcloud run revisions describe msgops-api-XXXXX --region us-east1

# 4. Send 10% of traffic to new revision
gcloud run services update-traffic msgops-api \
  --to-revisions msgops-api-XXXXX=10 \
  --region us-east1

# 5. Monitor for 15 minutes
# Watch Sentry: https://sentry.io/organizations/etus/issues/
# Watch Cloud Run logs: gcloud run logs tail msgops-api --region us-east1

# 6. If healthy, send 100% traffic
gcloud run services update-traffic msgops-api \
  --to-latest \
  --region us-east1
```

### 9.3 Post-Deployment Monitoring

Monitor for 24 hours post-deployment:

| Signal | Tool | Alert Threshold |
|---|---|---|
| Error rate | Sentry | > 1% of requests |
| P99 latency | Cloud Run metrics | > 2x pre-upgrade baseline |
| Memory usage | Cloud Run metrics | > 80% of limit |
| TypeORM connection pool | Cloud Run logs | "connection refused" errors |
| Redis timeouts | Sentry | Any `ETIMEDOUT` from Redis |

### 9.4 Rollback Procedure

If any monitoring threshold is breached within 24 hours:

```bash
# Immediately roll back to previous revision
gcloud run services update-traffic msgops-api \
  --to-revisions PREVIOUS_REVISION=100 \
  --region us-east1

# Verify rollback is complete (all traffic on old revision)
gcloud run services describe msgops-api --region us-east1 | grep -A5 "Traffic"
```

Post-rollback: Capture logs, Sentry errors, and stack traces to diagnose the failure before re-attempting the upgrade.

---

## Section 10: Post-Upgrade Housekeeping

After the production deployment is stable for 1 week:

### 10.1 Remove `shamefully-hoist` from .npmrc

```ini
# .npmrc — remove the shamefully-hoist line
# (leave empty or with other settings)
auto-install-peers=true
```

Run full test suite and Docker build to verify strict pnpm mode works.

### 10.2 Enable TypeScript Strict Mode Incrementally

Start with `strictBindCallApply: true` (least impactful), then progress:

```json
"strictBindCallApply": true,          // Week 1: likely zero errors
"noFallthroughCasesInSwitch": true,   // Week 1: low impact
"forceConsistentCasingInFileNames": true,  // Week 1: zero errors expected
// Later:
"noImplicitAny": true,                // Week 4+: many errors, large effort
"strictNullChecks": true,             // Week 8+: largest effort
```

### 10.3 Clean Up Technical Debt Markers

Search for any `// TODO: upgrade` or `// FIXME: post-upgrade` comments added during the migration:

```bash
grep -rn "TODO.*upgrade\|FIXME.*upgrade\|TODO.*nestjs11" /Users/augusto/Repos/msgops/msgops-api/src/
```

Create tickets for each item found.

### 10.4 Update CLAUDE.md

Update `/Users/augusto/Repos/msgops/CLAUDE.md` to reflect the new stack:
- Node.js 24.x
- pnpm 9.x
- NestJS 11.x
- TypeORM 0.3.x
- TypeScript 5.x
- Development command: `pnpm start:dev` (not `yarn start:dev`)

---

## Final Sign-Off Criteria

The upgrade is considered complete and sign-off can be given when:

1. Production deployment has been stable for 24 hours with no P0/P1 Sentry events from the upgrade
2. All 10 sections of this verification plan have been executed
3. Coverage report archived in `docs/plans/final-coverage-output.txt`
4. Docker image size is <= 500MB (documented in `docs/plans/docker-build-output.txt`)
5. A summary post has been shared with the team documenting: what changed, any issues encountered, how they were resolved, and the current stability status
6. The git tag `v0.2.0-nestjs11` is pushed to the remote and the CI/CD pipeline has successfully built from it
