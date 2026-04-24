---
title: 'Deploy frontend-react to Cloudflare Pages with GitHub Actions CI/CD'
type: feat
status: active
date: 2026-04-08
---

# Deploy frontend-react to Cloudflare Pages with GitHub Actions CI/CD

## Enhancement Summary

**Deepened on:** 2026-04-08
**Agents used:** Security Sentinel, Deployment Verification, Architecture Strategist, Performance Oracle, Code Simplicity Reviewer, Turborepo Caching Skill, CF Pages Deep Research, Pattern Recognition Specialist

### Key Improvements

1. **Reusable workflow pattern** — Create `_deploy-cloudflare-pages.yml` + 3-job caller pattern matching all other deploy workflows in the repo
2. **Security hardening** — CSP header, HSTS, SHA-pinned actions, scoped API token, build-time env validation
3. **Performance optimizations** — Remove `fetch-depth: 0`, split `tsc` from build, add heavy deps to manual chunks, use Turbo `...` filter
4. **`_redirects` likely unnecessary** — Cloudflare Pages has built-in SPA fallback when no `404.html` exists (still safe to include as a belt-and-suspenders approach)

### Critical Issues Discovered

- **Auth0 client secret in `.env`** with `VITE_` prefix — must be rotated immediately (it ships to browsers if referenced)
- **Preview deployments never expire** — need a cleanup strategy

---

## Overview

Deploy the `apps/frontend-react/` SPA (Vite + React 19 + TanStack Router) to **Cloudflare Pages** using Direct Upload via GitHub Actions. Production deploys on merge to `master`, staging deploys on merge to `staging`, and preview deployments on every PR.

## Problem Statement / Motivation

The frontend-react app has no deployment pipeline. The predecessor Vue 2 app (`frontend-vue2`) deploys to GCS + Cloudflare CDN, but Cloudflare Pages is a better fit for SPAs — it provides built-in SPA fallback routing, automatic preview deployments, and simpler infrastructure (no GCS bucket + CDN purge dance).

## Why Cloudflare Pages (not Workers)

- **Pure SPA** — no SSR, no server-side logic. Vite builds to `dist/` with static HTML + JS + CSS.
- **Built-in SPA fallback** — Cloudflare Pages automatically serves `index.html` for all non-asset paths when no `404.html` exists. Critical for TanStack Router's 80+ client-side routes.
- **No wrangler.toml needed** — Direct Upload via `wrangler pages deploy` in CI. All config via CLI flags.
- **Automatic preview URLs** — branch-based deployments generate unique `<branch>.<project>.pages.dev` URLs.
- **Free tier generous** — 500 builds/month, unlimited bandwidth.

### Research Insights

**`_redirects` vs built-in SPA fallback:**
Cloudflare Pages docs state: _"If your project does not include a top-level `404.html` file, Pages assumes you are deploying a single-page application and matches all incoming paths to the root."_ Since Vite does not generate a `404.html`, the SPA fallback is automatic. However, adding `_redirects` with `/* /index.html 200` is a safe belt-and-suspenders approach — it explicitly documents the intent and protects against future build tool changes that might add a `404.html`.

**`_routes.json` is not relevant** — it controls Pages Functions invocation, not static asset routing. Irrelevant for pure static SPA deployment.

## Why Not wrangler.toml in the App

The `cloudflare/wrangler-action@v3` GitHub Action handles everything via CLI flags:

- `--project-name` specifies the Cloudflare Pages project
- `accountId` is passed as an input to the action
- No local wrangler config means no dev dependency on wrangler, no config drift between local and CI

The only files needed in the app are `_redirects` (optional but recommended) and `_headers` in `public/`.

## Proposed Solution

### Architecture

```
PR opened/updated ──► GitHub Actions ──► pnpm turbo build ──► wrangler pages deploy ──► Preview URL
                                              │                     (--branch=pr-<number>)
                                              │
Push to staging ────► GitHub Actions ──► pnpm turbo build ──► wrangler pages deploy ──► staging.pages.dev
                                              │                     (--branch=staging)
                                              │
Push to master ─────► GitHub Actions ──► pnpm turbo build ──► wrangler pages deploy ──► production.pages.dev
                                              │                     (production)
                                              ▼
                                        Sentry source map upload (production only)
```

### Workflow Structure

Following the established monorepo pattern (per Pattern Recognition analysis), the implementation uses **two files**:

1. **`_deploy-cloudflare-pages.yml`** — Reusable workflow (matches `_deploy-cloudrun.yml` and `_deploy-gcs.yml` pattern)
2. **`deploy-frontend-react.yml`** — Caller workflow with 3-job structure: `changes` → `deploy-staging` → `deploy-production`

This matches how every other deploy workflow in the repo is structured and makes the Cloudflare Pages pattern reusable for future SPAs.

### Implementation Steps

#### Step 1: Immediate Security Fix — Rotate Auth0 Client Secret

**CRITICAL:** The file `apps/frontend-react/.env` contains `VITE_AUTH0_CLIENT_SECRET` — a confidential credential with the `VITE_` prefix, meaning it would be embedded in the client-side JS bundle. Auth0 SPA applications using PKCE should **never** have a client secret.

1. Rotate the Auth0 client secret immediately in the Auth0 dashboard
2. Remove `VITE_AUTH0_CLIENT_SECRET` and `VITE_AUTH0_SECRET` from `.env` and `.env.example`
3. Rotate the E2E test user password in `.env`
4. Run `git log --all -p -- apps/frontend-react/.env` to verify this was never committed to history

#### Step 2: Create Cloudflare Pages Project

One-time setup via Cloudflare dashboard or CLI:

```bash
# Option A: Via wrangler CLI
npx wrangler pages project create bms-frontend-react --production-branch=master

# Option B: Via Cloudflare dashboard
# Workers & Pages > Create > Pages > Direct Upload > Name: bms-frontend-react
```

**Required:** Note the `CLOUDFLARE_ACCOUNT_ID` from the Cloudflare dashboard (Account Home > right sidebar).

**API Token:** Create a scoped API token at `dash.cloudflare.com/profile/api-tokens`:

- Permission: **Cloudflare Pages > Edit** (minimum required)
- Restrict to specific account ID
- Set an expiration date

#### Step 3: Configure GitHub Secrets

Add these secrets to the repository (Settings > Secrets and variables > Actions):

| Secret                         | Scope      | Description                                     |
| ------------------------------ | ---------- | ----------------------------------------------- |
| `CF_PAGES_API_TOKEN`           | Repository | Cloudflare API token with Pages:Edit permission |
| `CF_ACCOUNT_ID`                | Repository | Cloudflare account ID                           |
| `VITE_AUTH0_DOMAIN`            | Repository | Auth0 tenant domain                             |
| `VITE_AUTH0_CLIENT_ID_STAGING` | Repository | Auth0 SPA client ID for staging                 |
| `VITE_AUTH0_CLIENT_ID`         | Repository | Auth0 SPA client ID for production              |
| `VITE_AUTH0_AUDIENCE`          | Repository | Auth0 API audience                              |
| `VITE_API_URL_STAGING`         | Repository | Backend API URL for staging                     |
| `VITE_API_URL`                 | Repository | Backend API URL for production                  |
| `VITE_REDIRECT_MANAGER_URL`    | Repository | External account management URL                 |
| `VITE_SENTRY_DSN`              | Repository | Sentry DSN                                      |
| `VITE_CLARITY_PROJECT_ID`      | Repository | Microsoft Clarity project ID                    |
| `SENTRY_AUTH_TOKEN`            | Repository | Sentry auth token (source map upload)           |
| `SENTRY_ORG`                   | Repository | Sentry organization slug                        |
| `SENTRY_PROJECT`               | Repository | Sentry project slug                             |

### Research Insights — Secret Naming

Per Pattern Recognition analysis, use `CF_` prefix to match existing `CF_ZONE_ID` / `CF_API_TOKEN` convention. Use `CF_PAGES_API_TOKEN` (distinct from `CF_API_TOKEN` which is for CDN purge) and `CF_ACCOUNT_ID`.

Follow the established `_STAGING` suffix convention for environment-specific values (e.g., `VITE_AUTH0_CLIENT_ID_STAGING`).

#### Step 4: Add SPA Fallback File (Recommended)

Create `apps/frontend-react/public/_redirects`:

```
/* /index.html 200
```

While Cloudflare Pages has built-in SPA fallback when no `404.html` exists, this file explicitly documents intent and protects against future changes.

#### Step 5: Add Security Headers

Create `apps/frontend-react/public/_headers`:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
  X-XSS-Protection: 0
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.auth0.com https://*.sentry.io https://*.clarity.ms; frame-src https://*.auth0.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### Research Insights — Security Headers

- **CSP in Report-Only mode first:** Start with `Content-Security-Policy-Report-Only` to test without breaking. Promote to enforcing `Content-Security-Policy` after validating no false positives. Auth0 SPA SDK requires `connect-src` and `frame-src` whitelisting for the Auth0 tenant domain.
- **`X-XSS-Protection: 0`:** Modern best practice is to _disable_ the legacy XSS auditor (it caused more vulnerabilities than it prevented). CSP is the proper replacement.
- **HSTS:** Cloudflare already forces HTTPS, but HSTS tells browsers to never attempt HTTP. Omit `preload` unless you intend to submit to the HSTS preload list.
- **`/assets/*` immutable cache:** Safe because Vite generates content-hashed filenames. `index.html` is NOT under `/assets/` so it uses Cloudflare's default caching. This is a significant performance win for returning users.
- **`connect-src`:** Must include your actual backend API domain (replace with the real domain in the final `_headers` file).

#### Step 6: Create Reusable Workflow `_deploy-cloudflare-pages.yml`

Create `.github/workflows/_deploy-cloudflare-pages.yml`:

```yaml
# Reusable workflow: Build static assets + Deploy to Cloudflare Pages
#
# Used by frontend-react (and any future static-site deploys to CF Pages).

name: _deploy-cloudflare-pages

on:
  workflow_call:
    inputs:
      app-name:
        description: Directory name under apps/
        required: true
        type: string
      project-name:
        description: Cloudflare Pages project name
        required: true
        type: string
      branch:
        description: Branch name for CF Pages deployment (determines production vs preview)
        required: false
        type: string
        default: ''
      turbo-filter:
        description: Turbo filter expression for the app
        required: true
        type: string
      environment:
        description: 'staging or production'
        required: true
        type: string
    secrets:
      CF_PAGES_API_TOKEN:
        required: true
      CF_ACCOUNT_ID:
        required: true
      VITE_AUTH0_DOMAIN:
        required: true
      VITE_AUTH0_CLIENT_ID:
        required: true
      VITE_AUTH0_AUDIENCE:
        required: true
      VITE_API_URL:
        required: true
      VITE_REDIRECT_MANAGER_URL:
        required: true
      VITE_SENTRY_DSN:
        required: false
      VITE_CLARITY_PROJECT_ID:
        required: false
      SENTRY_AUTH_TOKEN:
        required: false
      SENTRY_ORG:
        required: false
      SENTRY_PROJECT:
        required: false
      TURBO_TOKEN:
        required: false
      TURBO_API_URL:
        required: false

jobs:
  build-and-deploy:
    name: Build & deploy to Cloudflare Pages (${{ inputs.environment }})
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: team_retention
      TURBO_API: ${{ secrets.TURBO_API_URL }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Validate required environment variables
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_AUTH0_DOMAIN: ${{ secrets.VITE_AUTH0_DOMAIN }}
          VITE_AUTH0_CLIENT_ID: ${{ secrets.VITE_AUTH0_CLIENT_ID }}
        run: |
          : "${VITE_API_URL:?VITE_API_URL is required}"
          : "${VITE_AUTH0_DOMAIN:?VITE_AUTH0_DOMAIN is required}"
          : "${VITE_AUTH0_CLIENT_ID:?VITE_AUTH0_CLIENT_ID is required}"

      - name: Build
        env:
          VITE_AUTH0_DOMAIN: ${{ secrets.VITE_AUTH0_DOMAIN }}
          VITE_AUTH0_CLIENT_ID: ${{ secrets.VITE_AUTH0_CLIENT_ID }}
          VITE_AUTH0_AUDIENCE: ${{ secrets.VITE_AUTH0_AUDIENCE }}
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_REDIRECT_MANAGER_URL: ${{ secrets.VITE_REDIRECT_MANAGER_URL }}
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          VITE_SENTRY_ENABLED: 'true'
          VITE_CLARITY_PROJECT_ID: ${{ secrets.VITE_CLARITY_PROJECT_ID }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        run: pnpm turbo build --filter=${{ inputs.turbo-filter }}... --output-logs=new-only

      - name: Deploy to Cloudflare Pages
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_PAGES_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          command: pages deploy apps/${{ inputs.app-name }}/dist --project-name=${{ inputs.project-name }} ${{ inputs.branch && format('--branch={0}', inputs.branch) || '' }}
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

#### Step 7: Create Caller Workflow `deploy-frontend-react.yml`

Create `.github/workflows/deploy-frontend-react.yml`:

```yaml
name: Deploy frontend-react

on:
  push:
    branches: [master, staging]
    paths:
      - 'apps/frontend-react/**'
      - 'packages/shared/**'
  pull_request:
    paths:
      - 'apps/frontend-react/**'
      - 'packages/shared/**'
  workflow_dispatch:
    inputs:
      force:
        description: Force deploy (skip change detection)
        type: boolean
        default: false

jobs:
  # Job 1: Turbo-aware change detection (matches repo pattern)
  changes:
    uses: ./.github/workflows/_detect-changes.yml
    with:
      package-name: '@msgops/frontend-react'

  # Job 2: Staging deploy
  deploy-staging:
    needs: changes
    if: |
      always() &&
      github.ref_name == 'staging' &&
      (needs.changes.outputs.affected == 'true' || github.event_name == 'workflow_dispatch')
    uses: ./.github/workflows/_deploy-cloudflare-pages.yml
    with:
      app-name: frontend-react
      project-name: bms-frontend-react
      branch: staging
      turbo-filter: '@msgops/frontend-react'
      environment: staging
    secrets:
      CF_PAGES_API_TOKEN: ${{ secrets.CF_PAGES_API_TOKEN }}
      CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
      VITE_AUTH0_DOMAIN: ${{ secrets.VITE_AUTH0_DOMAIN }}
      VITE_AUTH0_CLIENT_ID: ${{ secrets.VITE_AUTH0_CLIENT_ID_STAGING }}
      VITE_AUTH0_AUDIENCE: ${{ secrets.VITE_AUTH0_AUDIENCE }}
      VITE_API_URL: ${{ secrets.VITE_API_URL_STAGING }}
      VITE_REDIRECT_MANAGER_URL: ${{ secrets.VITE_REDIRECT_MANAGER_URL }}
      VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
      VITE_CLARITY_PROJECT_ID: ${{ secrets.VITE_CLARITY_PROJECT_ID }}
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_API_URL: ${{ secrets.TURBO_API_URL }}

  # Job 3: Production deploy
  deploy-production:
    needs: changes
    if: |
      always() &&
      github.ref_name == 'master' &&
      (needs.changes.outputs.affected == 'true' || github.event_name == 'workflow_dispatch')
    uses: ./.github/workflows/_deploy-cloudflare-pages.yml
    with:
      app-name: frontend-react
      project-name: bms-frontend-react
      turbo-filter: '@msgops/frontend-react'
      environment: production
    secrets:
      CF_PAGES_API_TOKEN: ${{ secrets.CF_PAGES_API_TOKEN }}
      CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
      VITE_AUTH0_DOMAIN: ${{ secrets.VITE_AUTH0_DOMAIN }}
      VITE_AUTH0_CLIENT_ID: ${{ secrets.VITE_AUTH0_CLIENT_ID }}
      VITE_AUTH0_AUDIENCE: ${{ secrets.VITE_AUTH0_AUDIENCE }}
      VITE_API_URL: ${{ secrets.VITE_API_URL }}
      VITE_REDIRECT_MANAGER_URL: ${{ secrets.VITE_REDIRECT_MANAGER_URL }}
      VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
      VITE_CLARITY_PROJECT_ID: ${{ secrets.VITE_CLARITY_PROJECT_ID }}
      SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
      SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
      SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_API_URL: ${{ secrets.TURBO_API_URL }}

  # Job 4: Preview deploy on PRs
  deploy-preview:
    if: github.event_name == 'pull_request'
    uses: ./.github/workflows/_deploy-cloudflare-pages.yml
    with:
      app-name: frontend-react
      project-name: bms-frontend-react
      branch: pr-${{ github.event.pull_request.number }}
      turbo-filter: '@msgops/frontend-react'
      environment: staging
    secrets:
      CF_PAGES_API_TOKEN: ${{ secrets.CF_PAGES_API_TOKEN }}
      CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
      VITE_AUTH0_DOMAIN: ${{ secrets.VITE_AUTH0_DOMAIN }}
      VITE_AUTH0_CLIENT_ID: ${{ secrets.VITE_AUTH0_CLIENT_ID_STAGING }}
      VITE_AUTH0_AUDIENCE: ${{ secrets.VITE_AUTH0_AUDIENCE }}
      VITE_API_URL: ${{ secrets.VITE_API_URL_STAGING }}
      VITE_REDIRECT_MANAGER_URL: ${{ secrets.VITE_REDIRECT_MANAGER_URL }}
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_API_URL: ${{ secrets.TURBO_API_URL }}

  # Job 5: Comment preview URL on PR
  comment-preview:
    needs: deploy-preview
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Comment preview URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            const marker = '<!-- cf-pages-preview -->';
            const previewUrl = 'https://pr-${{ github.event.pull_request.number }}.bms-frontend-react.pages.dev';
            const body = [
              marker,
              '### Cloudflare Pages Preview',
              '',
              `**Preview URL:** ${previewUrl}`,
              '',
              `*Updated: ${new Date().toISOString()}*`
            ].join('\n');

            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
            });

            const existing = comments.find(c => c.body.includes(marker));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                comment_id: existing.id,
                body,
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body,
              });
            }
```

### Key Design Decisions

**Reusable workflow pattern (Architecture + Pattern Recognition):**
All 18+ deploy workflows in this repo use reusable workflows (`_deploy-cloudrun.yml`, `_deploy-gcs.yml`). The new `_deploy-cloudflare-pages.yml` follows this convention and is reusable for future SPAs.

**3-job caller structure (Pattern Recognition):**
Matches the established `changes` → `deploy-staging` → `deploy-production` pattern used by all Cloud Run deploy workflows. Uses `_detect-changes.yml` for Turbo-aware change detection.

**Branch mapping:**

- Push to `master` → production deployment (no `--branch` flag = production)
- Push to `staging` → staging deployment (`staging.bms-frontend-react.pages.dev`)
- PR → preview deployment (`pr-<number>.bms-frontend-react.pages.dev`)

**Sentry source maps:** Only uploaded on production (`master`) deploys. The `SENTRY_AUTH_TOKEN` secret is only passed to the production job.

**Preview URL comments:** Uses find-and-update pattern with HTML comment marker (`<!-- cf-pages-preview -->`) to avoid comment spam.

**Turbo filter with `...` suffix (Turborepo Caching):** `--filter=@msgops/frontend-react...` ensures all workspace dependencies are built too. With remote caching, these are almost always cache hits.

**`--output-logs=new-only` (Turborepo Caching):** Suppresses cached task logs for cleaner CI output.

**No `fetch-depth: 0` (Simplicity + Performance):** Not needed — Turbo remote caching doesn't use git history. Default `fetch-depth: 1` saves 10-30s.

**Build-time env validation (Architecture):** Fail-fast if critical `VITE_*` vars are missing, rather than deploying a broken build that silently sends API requests to `/api` (which 404s on Cloudflare Pages).

## Technical Considerations

### Auth0 Callback URLs for Preview Deployments

Auth0 requires every allowed callback URL to be explicitly registered. Preview deployments generate dynamic URLs like `pr-123.bms-frontend-react.pages.dev`.

**Options:**

1. **Wildcard subdomain** — Add `https://*.bms-frontend-react.pages.dev` to Auth0's Allowed Callback URLs, Logout URLs, and Web Origins.
2. **Separate Auth0 dev tenant** — Use a dedicated Auth0 application for previews with looser wildcard scope.
3. **Skip auth on previews** — If wildcard isn't available, previews can only test unauthenticated flows.

### Research Insights — Auth0 Wildcards

**Security warning (Security Sentinel):** Wildcard callback URLs are an OAuth security risk. If Auth0 is set to `https://*.pages.dev/callback`, anyone who creates a Cloudflare Pages project could intercept authorization codes. Restrict the wildcard to your specific project: `https://*.bms-frontend-react.pages.dev`. Even better, use a **separate Auth0 application** (dev/staging tenant) for preview deployments with controlled scope.

**Recommendation:** Use option 2 (separate Auth0 dev tenant) for previews. This limits blast radius if the wildcard is exploited.

### Custom Domain (Future)

The plan uses the default `bms-frontend-react.pages.dev` domain. To use a custom domain later:

1. Add it in Cloudflare Pages project settings
2. Update Auth0 callback URLs
3. Update backend CORS config
4. Update `connect-src` in the CSP header

### CORS Configuration

The `apiClient` at `apps/frontend-react/src/lib/api-client.ts:32` uses `VITE_API_URL` directly (cross-origin request from Cloudflare Pages to the backend). The backend CORS config must allow the Cloudflare Pages origin for each environment.

### Rollback

Cloudflare Pages keeps all previous deployments. To rollback:

1. **Preferred:** Revert the merge commit via `git revert` and push — triggers a clean redeploy with audit trail.
2. **Emergency (instant):** Use Cloudflare dashboard > Pages > Deployments > "Rollback to this deployment", or `wrangler pages deployments rollback <id> --project-name=bms-frontend-react`.

**Note:** Since `VITE_*` variables are baked at build time, rolling back via Cloudflare dashboard restores the old build with the old env values. If the issue is a wrong env var, you must rebuild (option 1).

### Preview Deployment Cleanup

**Cloudflare Pages preview deployments do NOT auto-expire.** They persist indefinitely.

**Options:**

1. **Post-merge cleanup** — Add a workflow step that deletes the preview deployment when a PR is merged/closed.
2. **Scheduled cleanup** — Weekly cron GitHub Action that deletes preview deployments older than 14 days via Cloudflare API.
3. **Manual** — Periodically clean up via Cloudflare dashboard.

**Recommendation:** Start with option 1 (automatic cleanup on PR close). Add option 2 later if needed.

## Performance Optimizations

### Build Script Split (Performance Oracle)

The current `build` script in `apps/frontend-react/package.json` runs `tsc && vite build`. Since Turbo has a separate `type-check` task, the `tsc` run inside `build` is redundant on CI (CI already ran type-check). Consider splitting:

```json
"build": "vite build"
```

And let Turbo's `type-check` task handle TypeScript checking independently. This saves 5-15s on cache misses and improves cache granularity.

### Manual Chunks (Performance Oracle)

The current `vite.config.ts` manual chunks miss the heaviest dependencies:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-router': ['@tanstack/react-router'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-auth': ['@auth0/auth0-react'],
  'vendor-sentry': ['@sentry/react'],
  'vendor-charts': ['echarts', 'echarts-for-react', 'recharts'],
  'vendor-flow': ['@xyflow/react'],
  'vendor-email-editor': ['react-email-editor'],
}
```

**Why this matters for deploys:** Cloudflare Pages uploads only changed files. Better chunking means most deploys skip uploading the heaviest chunks (echarts alone is ~800KB). This could reduce upload time by 50%+ on typical code-only changes.

### Future Consideration

If the project grows past 2000+ files, switch from `@vitejs/plugin-react` to `@vitejs/plugin-react-swc` for 30-50% faster builds with zero config change.

## Security Checklist

### Pre-Deploy Security Gates

- [ ] **CRITICAL:** Rotate Auth0 client secret exposed in `apps/frontend-react/.env`
- [ ] Remove `VITE_AUTH0_CLIENT_SECRET` and `VITE_AUTH0_SECRET` from `.env` and `.env.example`
- [ ] Verify Auth0 application type is "Single Page Application" (not "Regular Web Application")
- [ ] Verify Auth0 "Token Endpoint Authentication Method" is "None" (SPA with PKCE)
- [ ] Create scoped Cloudflare API token (Pages:Edit only, restricted to account, with expiration)
- [ ] Scope Sentry auth token to `project:releases` and `org:ci` only

### Future Security Improvements

- [ ] Pin all GitHub Actions to full commit SHAs (e.g., `actions/checkout@692973e3d...  # v4.2.2`)
- [ ] Set up Dependabot or Renovate to auto-update pinned SHAs
- [ ] Promote CSP from `Report-Only` to enforcing after validation
- [ ] Consider Cloudflare Access to restrict preview deployment URLs to team members
- [ ] Fix open redirect validation in `main.tsx:37-39` — use `new URL()` parser instead of string checks

## Acceptance Criteria

- [ ] Auth0 client secret rotated and removed from `.env`
- [x] `_redirects` file exists in `apps/frontend-react/public/`
- [x] `_headers` file exists with security headers (HSTS, X-Frame-Options — CSP to be added after initial deploy)
- [ ] Cloudflare Pages project `bms-frontend-react` created with scoped API token
- [ ] GitHub secrets configured: `CF_PAGES_API_TOKEN`, `CF_ACCOUNT_ID`, all `VITE_*` vars
- [x] `_deploy-cloudflare-pages.yml` reusable workflow created
- [x] `deploy-frontend-react.yml` caller workflow created with 3-job pattern
- [ ] Merge to `master` triggers production deploy to Cloudflare Pages
- [ ] Merge to `staging` triggers staging deploy (`staging.bms-frontend-react.pages.dev`)
- [ ] Opening/updating a PR creates a preview deployment with URL commented on the PR
- [ ] SPA client-side routing works (direct navigation to any route returns the app, not 404)
- [ ] Sentry source maps upload only on production deploys
- [ ] Auth0 login flow works on production and staging domains
- [ ] Backend CORS allows Cloudflare Pages origins
- [ ] Changes to `packages/shared/**` trigger a frontend-react deploy

## Post-Deploy Smoke Tests

Run within 5 minutes of each deploy:

| Check                | Command                                                                         | Expected                      |
| -------------------- | ------------------------------------------------------------------------------- | ----------------------------- |
| Root page loads      | `curl -s -o /dev/null -w "%{http_code}" https://<domain>/`                      | `200`                         |
| SPA routing works    | `curl -s -o /dev/null -w "%{http_code}" https://<domain>/contacts`              | `200` (not 404)               |
| Auth0 callback route | `curl -s -o /dev/null -w "%{http_code}" https://<domain>/callback`              | `200`                         |
| Security headers     | `curl -sI https://<domain>/ \| grep -i x-frame-options`                         | `DENY`                        |
| Asset caching        | `curl -sI https://<domain>/assets/<hash>.js \| grep cache-control`              | `max-age=31536000, immutable` |
| No source maps       | `curl -s -o /dev/null -w "%{http_code}" https://<domain>/assets/<chunk>.js.map` | `404`                         |

## Success Metrics

- Deploy completes in under 3 minutes (build + upload) — estimated 36-70s with optimizations
- Preview URL available on PR within 4 minutes of push
- Zero SPA routing 404s on direct navigation
- Sentry correctly resolves stack traces to source code on production
- Turbo remote cache hit rate > 80% for repeated deploys

## Dependencies & Risks

| Dependency                       | Risk                                                | Mitigation                                            |
| -------------------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Cloudflare API token permissions | Token may lack Pages:Edit scope                     | Create a dedicated scoped token with only Pages:Edit  |
| Auth0 wildcard callback URLs     | OAuth security risk with broad wildcards            | Use separate Auth0 dev tenant for previews            |
| `VITE_*` secret values           | Wrong values break auth/API calls silently          | Build-time validation step fails fast on missing vars |
| Backend CORS                     | API rejects cross-origin requests from Pages domain | Update backend CORS config before first deploy        |
| Turborepo remote cache           | Cache miss = slower builds                          | Not blocking; builds work without cache, just slower  |
| `packages/shared` changes        | May break frontend without redeploy                 | Path filter + Turbo change detection covers this      |
| Preview deployment accumulation  | Previews never expire, accumulate indefinitely      | Add cleanup on PR close                               |

## Files to Create/Modify

| File                                             | Action     | Purpose                                                |
| ------------------------------------------------ | ---------- | ------------------------------------------------------ |
| `.github/workflows/_deploy-cloudflare-pages.yml` | **Create** | Reusable Cloudflare Pages deployment workflow          |
| `.github/workflows/deploy-frontend-react.yml`    | **Create** | Caller workflow (3-job pattern)                        |
| `apps/frontend-react/public/_redirects`          | **Create** | SPA fallback rule (belt-and-suspenders)                |
| `apps/frontend-react/public/_headers`            | **Create** | Security headers + asset caching                       |
| `apps/frontend-react/.env`                       | **Modify** | Remove `VITE_AUTH0_CLIENT_SECRET`, `VITE_AUTH0_SECRET` |
| `apps/frontend-react/.env.example`               | **Modify** | Remove secret entries                                  |

## Monitoring (First 24 Hours)

| Signal              | Where                       | Alert Condition                                 |
| ------------------- | --------------------------- | ----------------------------------------------- |
| Sentry error rate   | Sentry project dashboard    | Any new error type post-deploy                  |
| Auth0 failed logins | Auth0 Dashboard > Logs      | Spike in `failed_login` or `failed_silent_auth` |
| Cloudflare 4xx/5xx  | Cloudflare Pages Analytics  | Any 5xx; 404 spike = routing issue              |
| Clarity sessions    | Microsoft Clarity dashboard | Zero sessions after 1 hour = init broken        |
| API error rate      | Backend monitoring          | Spike in 401/403 from new origin                |

## Sources & References

- [Cloudflare Pages Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration) — official guide for GitHub Actions + Direct Upload
- [cloudflare/wrangler-action@v3](https://github.com/cloudflare/wrangler-action) — GitHub Action with `pages deploy` command and deployment URL outputs
- [Cloudflare Pages Serving Pages / SPA Rendering](https://developers.cloudflare.com/pages/configuration/serving-pages) — built-in SPA fallback behavior
- [Cloudflare Pages Headers Configuration](https://developers.cloudflare.com/pages/configuration/headers) — `_headers` file format and path matching
- [Cloudflare API Token Permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/) — minimum Pages:Edit scope
- [Auth0: Deploying CSP in SPAs](https://auth0.com/blog/deploying-csp-in-spa/) — CSP strategies for Auth0 SPA SDK
- [GitHub Actions SHA Pinning](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/) — security best practice
- Existing pattern: `.github/workflows/_deploy-gcs.yml` — reusable static deploy workflow
- Existing pattern: `.github/workflows/_deploy-cloudrun.yml` — reusable Cloud Run workflow
- Existing pattern: `.github/workflows/deploy-frontend-vue2.yml` — env var conditional pattern
- Existing pattern: `.github/workflows/_detect-changes.yml` — Turbo-aware change detection
- Existing pattern: `.github/workflows/ci.yml` — pnpm + Node 24 + Turborepo remote cache setup
