---
title: 'feat: React 19.2 Frontend with Auth0 Login, Layout & Account Switching'
type: feat
status: active
date: 2026-03-10
deepened: 2026-03-10
---

# React 19.2 Frontend with Auth0 Login, Layout & Account Switching

## Enhancement Summary

**Deepened on:** 2026-03-10
**Agents used:** 11 (React Best Practices, Composition Patterns, Turborepo Caching, TypeScript Reviewer, Security Sentinel, Frontend Races Reviewer, Architecture Strategist, Performance Oracle, Code Simplicity Reviewer, Framework Docs Researcher, Best Practices Researcher)

### Key Improvements from Research

1. **CRITICAL FIX: Permission names corrected** to match backend `authz.constants.ts` (`analytics:dashboard_view`, `audience:contacts_view`, `account:settings_view` — not fabricated names)
2. **SECURITY: Token storage changed** from `cacheLocation: "localstorage"` to `"memory"` (XSS-safe default)
3. **SECURITY: Removed `Current-User` header** — backend never reads it, unnecessary PII exposure
4. **SECURITY: `POST /users/login` must include JWT** — endpoint is public but sending JWT matches Vue 2 behavior and allows backend to resolve caller
5. **PERFORMANCE: Token caching** — cache `getAccessTokenSilently()` result with expiry check instead of calling per-request
6. **PERFORMANCE: Route code splitting** via `React.lazy()` established from day one
7. **ARCHITECTURE: Auth0Provider must be inside RouterProvider** (needs `useNavigate` for `onRedirectCallback`)
8. **TYPESCRIPT: Strong typing** — `Permission` union type, `RoleCode` literal type, discriminated auth state
9. **ZUSTAND v5: `useShallow` required** for all object/array selectors to prevent infinite re-render loops
10. **RACE CONDITIONS: AbortController in auth init `useEffect`** — React 19 Strict Mode double-mount protection
11. **SIMPLIFIED: 8 phases consolidated to 4** — scaffold, auth+state, layout+routing, unit tests
12. **SIMPLIFIED: i18n deferred** to Phase 2 — hardcode pt-BR for ~40 Phase 1 strings
13. **SIMPLIFIED: Playwright E2E deferred** to Phase 2 — placeholder pages don't warrant E2E

### New Risks Discovered

- **Backend CORS is wide open** (`cors()` with no options) — must configure allowlist before production
- **`POST /users/login` is an unauthenticated user-creation oracle** — backend ticket needed to require JWT
- **Zustand v5 `useShallow` is mandatory** for object selectors — omitting causes infinite re-renders
- **Auth0Provider + createBrowserRouter ordering** — Auth0Provider must be a layout route, not a parent of RouterProvider

---

## Overview

Create a new React 19.2 SPA in `apps/frontend-react` to replace the Vue 2 frontend (`apps/frontend-vue2`). Phase 1 covers project scaffolding, Auth0 authentication, API integration, main layout (header, sidebar, account selector), and route protection. The app is a Vite-based SPA using React Router (not Next.js), targeting the existing msgops-api backend at `localhost:5001`.

## Problem Statement

The current Vue 2 frontend (`apps/frontend-vue2`) uses deprecated technology (Vue 2, Vuetify 2, Vuex, vue-class-component). Modernizing to React 19.2 with current best practices provides better ecosystem support, developer experience, and long-term maintainability.

## Proposed Solution

Build a greenfield React SPA inside the existing Turborepo monorepo, replicating the Vue 2 app's auth flow, layout, and account-switching behavior using modern React patterns.

**Tech Stack:**
| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | React | 19.2 | |
| Build | Vite | 6.x | `@tailwindcss/vite` plugin |
| Routing | React Router | 7.x | `createBrowserRouter` (data router) |
| UI Components | shadcn/ui (Radix + Tailwind) | latest | `new-york` style only, `tw-animate-css` |
| Styling | Tailwind CSS | 4.2 | CSS-first config, no `tailwind.config.js` |
| Data Fetching | TanStack Query | 5.x | |
| State Management | Zustand | 5.x | `useShallow` required for object selectors |
| Auth | @auth0/auth0-react | 2.x | `cacheLocation: "memory"`, `useRefreshTokens: true` |
| Unit Tests | Vitest | latest | |
| Toasts | sonner | latest | |
| Icons | lucide-react | latest | Direct imports, not barrel |

**Deferred to Phase 2:** react-hook-form + zod (no forms in Phase 1), Playwright E2E, react-i18next

## Technical Approach

### Architecture

```
apps/frontend-react/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── vitest.config.ts
├── turbo.json                    # Package-level: env: ["VITE_*"]
├── components.json               # shadcn/ui config
├── .env.example
├── public/
│   └── bms-logo.svg
├── src/
│   ├── index.css                 # @import "tailwindcss"; @import "tw-animate-css";
│   ├── main.tsx                  # React root + RouterProvider
│   ├── router.tsx                # createBrowserRouter with lazy routes
│   ├── lib/
│   │   ├── api-client.ts         # Axios instance + token cache + interceptors
│   │   ├── query-client.ts       # QueryClient singleton with 401 handler
│   │   ├── query-keys.ts         # Query key factory
│   │   ├── strings.ts            # Hardcoded pt-BR strings (Phase 1, i18n in Phase 2)
│   │   └── utils.ts              # shadcn cn() utility
│   ├── stores/
│   │   └── app-store.ts          # Single Zustand store: auth + UI state
│   ├── hooks/
│   │   ├── use-auth-init.ts      # Post-Auth0 login flow with AbortController
│   │   ├── use-account-switch.ts # Account switching with abort + cache clear
│   │   └── use-permissions.ts    # Permission checking via Set lookup
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components (auto-generated)
│   │   ├── layout/
│   │   │   ├── app-layout.tsx    # Layout route: Auth0Provider + sidebar + header + Outlet
│   │   │   ├── sidebar.tsx       # Left nav, collapsible, permission-gated
│   │   │   ├── sidebar-nav-link.tsx
│   │   │   ├── sidebar-nav-group.tsx
│   │   │   ├── header.tsx        # Logo, account selector, user avatar
│   │   │   └── account-selector.tsx
│   │   ├── protected-route.tsx   # Single guard: auth + optional permission check
│   │   ├── auth-callback.tsx     # Auth0 redirect callback handler
│   │   └── loading-screen.tsx    # Full-page loading overlay
│   ├── pages/
│   │   ├── login.tsx
│   │   ├── home.tsx
│   │   ├── access-denied.tsx
│   │   └── not-found.tsx
│   └── types.ts                  # All types: User, Account, Permission, RoleCode
└── tests/
    └── setup.ts                  # Vitest setup
```

### Research Insights: Architecture Decisions

**Auth0Provider must be INSIDE RouterProvider** (not above it):
Because `onRedirectCallback` needs `useNavigate()`, which requires router context. Use a layout route:

```tsx
const router = createBrowserRouter([
  {
    element: (
      <Auth0ProviderWithNavigate>
        <Outlet />
      </Auth0ProviderWithNavigate>
    ),
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/callback', element: <AuthCallbackPage /> },
      {
        element: <ProtectedRoute />, // Single guard component
        children: [
          {
            element: <AppLayout />,
            children: [
              /* all app routes */
            ],
          },
        ],
      },
    ],
  },
]);
```

**Single Zustand store** (not two):
Phase 1 has ~15 state fields total. Premature store splitting adds cognitive overhead. Split when needed in later phases.

**Single `ProtectedRoute` guard** (not AuthGuard + PermissionGuard):
Merge into one component: if not authenticated → redirect to login; if authenticated but no permission → redirect to /access-denied; if authenticated and has permission (or no permission required) → render `<Outlet />`.

---

### Implementation Phases

#### Phase 1: Project Scaffolding & Build Setup

**Tasks:**

- [ ] **1.1** Scaffold Vite + React 19.2 + TypeScript in `apps/frontend-react/`

  `package.json`:

  ```json
  {
    "name": "@msgops/frontend-react",
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "vite --port 3000",
      "build": "tsc -b && vite build",
      "preview": "vite preview",
      "test": "vitest run",
      "test:watch": "vitest",
      "type-check": "tsc --noEmit",
      "lint": "eslint src/"
    }
  }
  ```

- [ ] **1.2** Configure Vite (`vite.config.ts`) with React plugin, Tailwind v4 plugin, path aliases, dev proxy, and **manual chunks for vendor splitting**:

  ```typescript
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  import tailwindcss from '@tailwindcss/vite';
  import path from 'path';

  export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-auth': ['@auth0/auth0-react'],
          },
        },
      },
    },
  });
  ```

  > **Research insight (Performance Oracle):** Separate vendor chunks ensure that app code updates don't invalidate the ~200KB vendor cache. Users only re-download the app chunk on deployments.

- [ ] **1.3** Configure Tailwind CSS v4.2 (`src/index.css`):

  ```css
  @import 'tailwindcss';
  @import 'tw-animate-css';
  @source '../src/**/*.{ts,tsx}';
  ```

  > **Research insight (Framework Docs):** Tailwind v4 uses `tw-animate-css` (not `tailwindcss-animate`). No `tailwind.config.js` needed — all config via CSS `@theme`.

- [ ] **1.4** Initialize shadcn/ui: `pnpm dlx shadcn@latest init` — uses `new-york` style (only style in latest shadcn), OKLCH colors, no `forwardRef` (React 19 passes ref as prop)

- [ ] **1.5** Install shadcn/ui components: `button`, `input`, `avatar`, `popover`, `command`, `separator`, `tooltip`, `sheet`, `scroll-area`, `skeleton`, `sonner`, `dropdown-menu`, `collapsible`

- [ ] **1.6** Configure Vitest (`vitest.config.ts`) with jsdom, path aliases, setup file

- [ ] **1.7** Configure TypeScript: strict mode, path aliases matching Vite

- [ ] **1.8** Add `.env.example`:

  ```
  VITE_AUTH0_DOMAIN=<your-tenant>.us.auth0.com
  VITE_AUTH0_CLIENT_ID=<auth0-spa-client-id>
  VITE_AUTH0_AUDIENCE=<your-api-audience>
  VITE_API_URL=http://localhost:5001
  VITE_REDIRECT_MANAGER_URL=<manage-account-external-url>
  ```

- [ ] **1.9** Create `apps/frontend-react/turbo.json` for Turborepo:

  ```json
  {
    "$schema": "https://turbo.build/schema.json",
    "extends": ["//"],
    "tasks": { "build": { "env": ["VITE_*"] } }
  }
  ```

  > **Research insight (Turborepo skill):** The `VITE_*` wildcard ensures env var changes correctly invalidate the build cache. Root `turbo.json` needs no changes — `dist/**` output already matches Vite.

**Success criteria:** `pnpm --filter @msgops/frontend-react dev` starts at port 3000. Build produces production bundle with vendor chunk splitting.

---

#### Phase 2: Auth0 + API Client + Stores + TanStack Query

This phase merges the original Phases 2, 3, and 4 — they are one concern: "user logs in and app has state."

**Tasks:**

- [ ] **2.1** Create `src/types.ts` — all TypeScript types in a single file:

  ```typescript
  // Derived from backend authz.constants.ts ALL_PERMISSION_KEYS
  export const ALL_PERMISSIONS = [
    'analytics:dashboard_view',
    'analytics:comparison_view',
    'analytics:insights_view',
    'campaigns:view',
    'campaigns:create',
    'campaigns:update',
    'campaigns:delete',
    'automations:view',
    'automations:create',
    'automations:update',
    'automations:delete',
    'messages:view',
    'messages:create',
    'messages:update',
    'messages:delete',
    'audience:contacts_view',
    'audience:contacts_create',
    'audience:contacts_update',
    'audience:segments_view',
    'audience:segments_create',
    'audience:tags_view',
    'audience:tags_create',
    'audience:custom_fields_view',
    'audience:custom_fields_create',
    'infra:view',
    'infra:create',
    'infra:update',
    'account:settings_view',
    'account:settings_update',
    'account:users_view',
    'account:users_invite',
    'account:users_update_roles',
    'account:roles_view',
    'account:api_keys_view',
    'account:api_keys_create',
  ] as const;
  export type Permission = (typeof ALL_PERMISSIONS)[number];

  export const ROLE_CODES = ['super_admin', 'admin', 'editor', 'analyst', 'support', 'billing'] as const;
  export type RoleCode = (typeof ROLE_CODES)[number];

  export interface User {
    id: number;
    name: string;
    email: string;
    profile: string;
    providerId: string;
    settings: { language: string };
    globalRole: { id: number; code: RoleCode; name: string } | null;
    status: string;
  }

  export interface Account {
    id: number;
    name: string;
    description: string;
    isActive: boolean;
    isInternal: boolean;
    groupId: number;
    accountConfigs: AccountConfig[];
  }

  export interface UserAccount {
    userId: number;
    accountId: number;
    isMasterUser: boolean;
    account: Account;
    roleOverride: { id: number; code: RoleCode; name: string } | null;
  }

  export interface AccountConfig {
    id: number;
    configName: string;
    configValue: string;
  }

  export interface AccountChannels {
    email: boolean;
    sms: boolean;
    webPush: boolean;
    mobilePush: boolean;
    whatsapp: boolean;
  }
  ```

  > **Research insight (TypeScript Reviewer):** Permission names are typed as a union from the const array — typos like `can('statistics:view')` become compile errors. `AccountChannels` has 5 fields (not 4) matching Vue 2's `hasWebPush`/`hasMobilePush` split.

- [ ] **2.2** Create `src/stores/app-store.ts` — single Zustand v5 store with `persist` middleware for account and sidebar state:

  ```typescript
  import { create } from 'zustand';
  import { persist, createJSONStorage } from 'zustand/middleware';

  // Auth lifecycle as discriminated union (prevents impossible states)
  type AuthStatus =
    | { status: 'idle' }
    | { status: 'authenticating' }
    | {
        status: 'authenticated';
        user: User;
        account: Account;
        userAccounts: UserAccount[];
        permissions: Set<Permission>;
        effectiveRole: RoleCode;
        globalRole: RoleCode | null;
        isMasterUser: boolean;
        accountConfigs: AccountConfig[];
        timezone: string;
      }
    | { status: 'switching'; user: User; previousAccountId: number }
    | { status: 'error'; error: string };

  interface AppState {
    auth: AuthStatus;
    sidebarCollapsed: boolean;
    // Actions...
  }
  ```

  > **Research insight (TypeScript Reviewer):** Discriminated union eliminates nullable fields — when `status === 'authenticated'`, all fields are guaranteed non-null. No defensive null-checks needed in consumers.

  > **Research insight (React Best Practices):** Store permissions as `Set<Permission>` for O(1) lookups instead of `Array.includes()` O(n). With 30+ sidebar items each checking permissions, this eliminates ~900 array scans per render.

  > **Research insight (Zustand v5 Docs):** Use `partialize` in persist middleware to only persist `sidebarCollapsed` and `auth.account.id` (not the entire auth state). Use `version` + `migrate` for future schema changes.

  **Derived values as selectors (not stored state):**

  ```typescript
  // These are selectors, NOT stored state
  export const selectIsSuperAdmin = (s: AppState) =>
    s.auth.status === 'authenticated' && s.auth.effectiveRole === 'super_admin';
  export const selectIsSupportUser = (s: AppState) =>
    s.auth.status === 'authenticated' && s.auth.effectiveRole === 'support';
  export const selectAccountChannels = (s: AppState): AccountChannels => {
    if (s.auth.status !== 'authenticated')
      return { email: false, sms: false, webPush: false, mobilePush: false, whatsapp: false };
    const configs = s.auth.accountConfigs;
    // Derive from accountConfigs...
  };
  ```

- [ ] **2.3** Create `src/hooks/use-permissions.ts`:

  ```typescript
  export function usePermissions() {
    // Read fresh from store at call time to avoid stale closures
    const can = useCallback((permission: Permission) => {
      const { auth } = useAppStore.getState();
      if (auth.status !== 'authenticated') return false;
      return auth.effectiveRole === 'super_admin' || auth.permissions.has(permission);
    }, []);
    return { can };
  }
  ```

  > **Research insight (Frontend Races Reviewer):** Reading from `getState()` inside the callback (not destructuring at hook time) prevents stale closure bugs during account switching. The permission set always reflects the current account's permissions.

- [ ] **2.4** Create `src/lib/api-client.ts` — Axios instance with **token caching** and **mutable ref** for `getAccessTokenSilently`:

  ```typescript
  // Module-scoped token cache
  let cachedToken: string | null = null;
  let tokenExpiresAt = 0;

  // Mutable ref for the Auth0 token getter (set by Auth0Provider wrapper)
  let tokenFetcherRef: (() => Promise<string>) | null = null;
  export function setTokenFetcher(fn: () => Promise<string>) {
    tokenFetcherRef = fn;
  }

  async function getToken(): Promise<string> {
    if (!tokenFetcherRef) throw new Error('Token fetcher not initialized');
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken;
    cachedToken = await tokenFetcherRef();
    const payload = JSON.parse(atob(cachedToken.split('.')[1]));
    tokenExpiresAt = payload.exp * 1000;
    return cachedToken;
  }

  // Request interceptor: inject Authorization + Account-Id headers
  // NO Current-User header (backend doesn't use it)
  // Response interceptor:
  // - Skip logout on 401 when auth.status === 'switching'
  // - Ignore CancelledError (from account switch cancelQueries)
  // - 403 → toast "Permission denied"
  // - 5xx → toast "Cannot process request"
  ```

  > **Research insight (Security Sentinel):** `Current-User` header removed — backend resolves user from JWT `sub` claim via `AuthzService.resolveUserContext()`. The header was dead code sending PII on every request.

  > **Research insight (Performance Oracle):** Token caching reduces per-request overhead from ~5-15ms (Auth0 cache check) to <0.1ms. Prevents thundering herd of N concurrent token refreshes when TanStack Query fires N parallel requests.

  > **Research insight (Frontend Races):** Use mutable ref pattern for the token getter. Update it on every Auth0Provider render to prevent stale closures from Strict Mode re-mounts.

  > **Research insight (Frontend Races):** During account switch (`auth.status === 'switching'`), the 401 interceptor must NOT trigger logout. The user isn't logged out — they're switching contexts.

- [ ] **2.5** Create `src/lib/query-client.ts` — module-level singleton with global 401 handling:

  ```typescript
  import { QueryClient, QueryCache } from '@tanstack/react-query';

  export const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: (count, error) => {
          if (error instanceof AxiosError && error.response?.status === 401) return false;
          return count < 2;
        },
        refetchOnWindowFocus: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof AxiosError && error.response?.status === 401) {
          // Trigger logout via store action
        }
      },
    }),
  });
  ```

  > **Research insight (Best Practices):** Global 401 handling in QueryCache ensures auth errors are caught regardless of which query triggers them. `useRef` is not needed since this is a module-level singleton in a SPA.

- [ ] **2.6** Create `src/lib/query-keys.ts` — query key factory:

  ```typescript
  export const queryKeys = {
    users: {
      all: ['users'] as const,
      me: (accountId: number) => ['users', 'me', { accountId }] as const,
    },
    accounts: {
      configs: (accountId: number) => ['accounts', 'configs', { accountId }] as const,
    },
  } as const;
  ```

  > **Research insight (TypeScript Reviewer):** Centralizing keys makes refactoring safe and enables `queryClient.invalidateQueries({ queryKey: queryKeys.users.all })`.

- [ ] **2.7** Create Auth0Provider wrapper as a layout route element (`src/components/layout/app-layout.tsx` will contain this):

  ```typescript
  import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'
  import { useNavigate } from 'react-router'

  function Auth0ProviderWithNavigate({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate()
    return (
      <Auth0Provider
        domain={import.meta.env.VITE_AUTH0_DOMAIN}
        clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
        authorizationParams={{
          redirect_uri: window.location.origin + '/callback',
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        }}
        cacheLocation="memory"
        useRefreshTokens={true}
        useRefreshTokensFallback={true}
        onRedirectCallback={(appState) => {
          const returnTo = appState?.returnTo
          const safePath = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
            ? returnTo : '/'
          navigate(safePath)
        }}
      >
        <AuthBridge />
        {children}
      </Auth0Provider>
    )
  }

  // Bridge: updates the module-scoped token fetcher on every render
  function AuthBridge() {
    const { getAccessTokenSilently } = useAuth0()
    useEffect(() => { setTokenFetcher(getAccessTokenSilently) }, [getAccessTokenSilently])
    return null
  }
  ```

  > **Research insight (Security Sentinel):** `cacheLocation: "memory"` is the secure default. Tokens in localStorage are accessible to any XSS attack. Memory storage clears on page refresh but `useRefreshTokens: true` re-obtains tokens silently. `useRefreshTokensFallback: true` adds iframe fallback if refresh fails.

  > **Research insight (Framework Docs):** `onRedirectCallback` validates `returnTo` — rejects absolute URLs and protocol-relative URLs to prevent open redirect attacks.

- [ ] **2.8** Create `src/hooks/use-auth-init.ts` — post-Auth0 login orchestration **with AbortController for Strict Mode**:

  ```
  useEffect(() => {
    const ac = new AbortController()
    async function init() {
      1. POST /users/login { name, email, picture } WITH JWT (not public-only)
      2. if (ac.signal.aborted) return  // Check after EVERY await
      3. Read savedAccountId from localStorage
      4. Promise.all([
           GET /users/me?accountId={savedId},
           GET /accounts/configs
         ])  // PARALLEL, not sequential
      5. if (ac.signal.aborted) return
      6. If savedId not in accounts → fallback to first account, re-fetch
      7. Update store: auth status → 'authenticated'
      8. Navigate to default route
    }
    init()
    return () => ac.abort()  // Cleanup on unmount (Strict Mode)
  }, [isAuthenticated])
  ```

  > **Research insight (Frontend Races):** React 19 Strict Mode double-mounts components. Without AbortController cleanup, two parallel auth init flows race against each other, both writing to the store. The abort check after every `await` prevents the stale flow from corrupting state.

  > **Research insight (Performance Oracle):** `/users/me` and `/accounts/configs` run in parallel via `Promise.all()`. Saves one full network round trip (~100-300ms).

  > **Research insight (Architecture Strategist):** Send JWT on `POST /users/login` even though it's `@PublicRoute()`. The Vue 2 app sends it (via `getApi()` which always attaches the token). This allows the backend's `PrincipalContextGuard` to optionally resolve the caller.

- [ ] **2.9** Create `src/hooks/use-account-switch.ts`:

  ```typescript
  const abortRef = useRef<AbortController | null>(null)

  const switchAccount = useCallback(async (newAccount: UserAccount) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    store.setAuthStatus('switching')

    // Remove previous account's queries (not clear ALL)
    queryClient.removeQueries({
      predicate: (query) => !['auth'].includes(query.queryKey[0] as string)
    })

    const [me, configs] = await Promise.all([
      apiClient.get(`/users/me?accountId=${newAccount.accountId}`, { signal: ac.signal }),
      apiClient.get('/accounts/configs', { signal: ac.signal, headers: { 'Account-Id': newAccount.accountId } }),
    ])

    if (ac.signal.aborted) return

    // Update store with new permissions, role, configs
    store.setAuthStatus('authenticated', { ... })

    navigate(getDefaultRoute())
  }, [])
  ```

  > **Research insight (Performance Oracle):** Use `removeQueries` with predicate instead of `clear()`. This preserves account-independent data and enables instant UI transitions when switching back to a previously-viewed account.

  > **Research insight (Frontend Races):** AbortController per switch operation. If user rapidly clicks Account A then Account B, the first switch's promises are aborted and their `.then()` handlers exit early.

- [ ] **2.10** Create `src/components/auth-callback.tsx`:
  - Use `useAuth0()` hooks for `error` and `isLoading` state (NOT raw URL params — SDK may have already cleared them)
  - If error → show error message with "Try Again" + "Logout"
  - If loading → show `<LoadingScreen />`
  - If success → `use-auth-init` hook triggers automatically

- [ ] **2.11** Create `src/pages/login.tsx` — branded loading screen, triggers `loginWithRedirect()` if not authenticated

- [ ] **2.12** Create `src/components/loading-screen.tsx` — full-page overlay with Etus logo + spinner

- [ ] **2.13** Create `src/lib/strings.ts` — hardcoded pt-BR strings for Phase 1:

  ```typescript
  export const S = {
    sidebar: {
      statistics: 'Estatistica',
      campaigns: 'Campanhas',
      automations: 'Automações',
      messages: 'Mensagens',
      templates: 'Templates',
      contacts: 'Contatos',
      segments: 'Segmentos',
      // ... all sidebar labels
    },
    auth: {
      connecting: 'Conectando...',
      error: 'Erro de autenticação',
      tryAgain: 'Tentar novamente',
      logout: 'Sair',
      noAccounts: 'Nenhuma conta atribuída',
    },
    // ...
  };
  ```

  > **Research insight (Simplicity Reviewer):** Phase 1 has ~40 strings. Full react-i18next setup with namespaces, lazy loading, and locale files is overkill. Hardcode pt-BR in a constants file; add i18n in Phase 2 when porting feature pages with substantial text.

**Success criteria:** Full auth flow works end-to-end. Token caching eliminates per-request latency. Account switching aborts cleanly on rapid clicks. All types compile with strict TypeScript.

---

#### Phase 3: Layout + Routing + Route Protection

This phase merges the original Phases 5 and 6.

**Tasks:**

- [ ] **3.1** Create `src/router.tsx` with `createBrowserRouter` and **lazy-loaded routes**:

  ```typescript
  import { createBrowserRouter, Navigate } from 'react-router'
  import { lazy, Suspense } from 'react'

  // Lazy-load all page components
  const Home = lazy(() => import('@/pages/home'))
  const AccessDenied = lazy(() => import('@/pages/access-denied'))
  // ... all route pages

  export const router = createBrowserRouter([
    {
      element: <Auth0ProviderWithNavigate><Outlet /></Auth0ProviderWithNavigate>,
      children: [
        { path: '/login', element: <LoginPage /> },
        { path: '/callback', element: <AuthCallbackPage /> },
        { path: '/access-denied', lazy: () => import('@/pages/access-denied') },
        {
          element: <ProtectedRoute />,
          children: [{
            element: <AppLayout />,
            children: [
              { index: true, element: <DefaultRouteRedirect /> },
              // All protected routes with lazy loading...
            ]
          }]
        },
        { path: '*', lazy: () => import('@/pages/not-found') },
      ]
    }
  ])
  ```

  > **Research insight (Performance Oracle):** Route-based code splitting from day one via `React.lazy()`. Establishes the pattern for all future feature modules. Without this, Phase 4 analytics pages with Recharts (~45KB) would bloat the initial bundle.

  > **Research insight (Framework Docs):** React Router v7's `lazy` property on route objects is the cleanest approach — it code-splits the entire route module.

- [ ] **3.2** Create `src/components/protected-route.tsx` — single guard component:

  ```typescript
  function ProtectedRoute({ permission }: { permission?: Permission }) {
    const { isAuthenticated, isLoading } = useAuth0()
    const auth = useAppStore(s => s.auth)
    const { can } = usePermissions()

    if (isLoading || auth.status === 'authenticating' || auth.status === 'switching') {
      return <LoadingScreen />
    }
    if (!isAuthenticated) return <Navigate to="/login" replace />
    if (auth.status !== 'authenticated') return <LoadingScreen />
    if (permission && !can(permission)) return <Navigate to="/access-denied" replace />

    return <Outlet />
  }
  ```

  > **Research insight (Simplicity Reviewer):** Single component handles both auth and permission checks. No need for separate AuthGuard + PermissionGuard — every protected route wraps one layer, not two.

  > **Research insight (React Best Practices):** Use ternary (not `&&`) for conditional rendering to avoid accidentally rendering `0` or `""`.

- [ ] **3.3** Create `src/components/layout/app-layout.tsx`:
  - Shows `<LoadingScreen />` when `auth.status !== 'authenticated'`
  - Flexbox layout: sidebar + header + main content
  - `<Outlet />` for route content

- [ ] **3.4** Create `src/components/layout/header.tsx`:
  - **Left:** Etus logo SVG
  - **Center-left:** `<AccountSelector />`
  - **Right:** User avatar dropdown (profile, manage account for master users, logout)
  - Hamburger menu trigger for mobile sidebar (Sheet)

- [ ] **3.5** Create `src/components/layout/account-selector.tsx`:
  - shadcn `Popover` + `Command` (cmdk)
  - Memoize filtered list with `useMemo` + `useDeferredValue` for search
  - Immutable sort: `accounts.toSorted((a, b) => a.name.localeCompare(b.name))`
  - On select → `useAccountSwitch().switchAccount(userAccount)`

- [ ] **3.6** Create sidebar with **explicit variant components** (not conditional inline JSX):
  - `src/components/layout/sidebar.tsx` — container, collapse toggle, mobile Sheet
  - `src/components/layout/sidebar-nav-link.tsx` — simple link item
  - `src/components/layout/sidebar-nav-group.tsx` — collapsible group with children

  > **Research insight (Composition Patterns):** Extract explicit variant components instead of conditional rendering. Each variant (`NavLink`, `NavGroup`) encapsulates its own active state, permission check, and collapsed behavior.

  **Sidebar menu structure with CORRECT permissions** (from `authz.constants.ts`):

  | Menu Item                   | Icon      | Route                        | Permission                    | Internal Only |
  | --------------------------- | --------- | ---------------------------- | ----------------------------- | ------------- |
  | Estatistica (group)         | BarChart3 | —                            | `analytics:dashboard_view`    | No            |
  | ├ Email Statistics          | —         | `/messages/email/statistics` | `analytics:dashboard_view`    | No            |
  | ├ Comparacao                | —         | `/messages/email/comparison` | `analytics:comparison_view`   | No            |
  | ├ Insights                  | —         | `/insights`                  | `analytics:insights_view`     | Yes           |
  | └ Leads                     | —         | `/leads`                     | `analytics:dashboard_view`    | Yes           |
  | Campanhas (group, internal) | Megaphone | —                            | `campaigns:view`              | Yes           |
  | ├ Campanhas                 | —         | `/campaigns`                 | `campaigns:view`              | Yes           |
  | ├ Trigger Campaigns         | —         | `/trigger-campaign`          | `campaigns:view`              | Yes           |
  | └ Produtos                  | —         | `/product`                   | `campaigns:view`              | Yes           |
  | Automacoes                  | Workflow  | `/automations/emails`        | `automations:view`            | No            |
  | Mensagens (group)           | Mail      | —                            | `messages:view`               | No            |
  | ├ Email                     | —         | `/messages`                  | `messages:view`               | No            |
  | ├ Web Push                  | —         | `/messages/web-push`         | `messages:view`               | No            |
  | ├ Mobile Push               | —         | `/messages/mobile-push`      | `messages:view`               | No            |
  | ├ SMS                       | —         | `/messages/sms`              | `messages:view`               | No            |
  | ├ WhatsApp                  | —         | `/messages/whatsapp`         | `messages:view`               | No            |
  | ├ 2FA                       | —         | `/messages/2fa`              | `messages:view`               | Yes           |
  | └ Postmaster                | —         | `/messages/postmaster`       | `messages:view`               | No            |
  | Templates                   | FileText  | `/templates`                 | `messages:view`               | No            |
  | Contatos (group)            | Users     | —                            | `audience:contacts_view`      | No            |
  | ├ Contatos                  | —         | `/contacts`                  | `audience:contacts_view`      | No            |
  | ├ Segmentos                 | —         | `/segments`                  | `audience:segments_view`      | No            |
  | ├ Tags                      | —         | `/tags`                      | `audience:tags_view`          | No            |
  | ├ Campos Personalizados     | —         | `/customfields`              | `audience:custom_fields_view` | No            |
  | └ Custom Events             | —         | `/custom-events`             | `audience:custom_fields_view` | Yes           |
  | Pools                       | Server    | `/pools`                     | `infra:view`                  | No            |
  | Warmups                     | Flame     | `/warmups`                   | `infra:view`                  | No            |
  | Campaign Rules              | Shield    | `/campaign-rules`            | `infra:view`                  | Yes           |
  | Labels                      | Tag       | `/labels`                    | `infra:view`                  | Yes           |
  | ─── separator ───           |           |                              |                               |               |
  | Configuracoes               | Settings  | `/settings`                  | `account:settings_view`       | No            |

  Memoize visible menu items:

  ```typescript
  const visibleItems = useMemo(
    () =>
      MENU_ITEMS.filter(
        (item) => (!item.permission || can(item.permission)) && (!item.internalOnly || currentAccount.isInternal),
      ),
    [can, currentAccount.isInternal],
  );
  ```

  Sidebar collapse: animate wrapper div (not individual icons). Hide labels with `opacity: 0` at start of collapse, not at end.

  **Preload route chunks on sidebar hover:**

  ```typescript
  <NavLink to={route} onMouseEnter={() => void import(`@/pages/${chunk}`)} />
  ```

  > **Research insight (React Best Practices):** Preloading on hover gives the browser a head start on fetching the route chunk before the user clicks.

- [ ] **3.7** Default route logic with **correct permission names**:

  ```typescript
  const DEFAULT_ROUTE_MAP: { permission: Permission; route: string }[] = [
    { permission: 'analytics:dashboard_view', route: '/messages/email/statistics' },
    { permission: 'campaigns:view', route: '/campaigns' },
    { permission: 'automations:view', route: '/automations/emails' },
    { permission: 'messages:view', route: '/messages' },
    { permission: 'audience:contacts_view', route: '/contacts' },
    { permission: 'infra:view', route: '/pools' },
    { permission: 'account:settings_view', route: '/settings' },
  ];
  ```

- [ ] **3.8** Create pages: `home.tsx`, `access-denied.tsx`, `not-found.tsx`

**Success criteria:** Layout matches screenshot. Sidebar permission checks use correct backend permission names (compile-time verified via `Permission` type). Route code splitting produces separate chunks per page. Mobile responsive sidebar via Sheet.

---

#### Phase 4: Unit Tests

**Tasks:**

- [ ] **4.1** Set up Vitest: `tests/setup.ts` with jsdom cleanup

- [ ] **4.2** Write unit tests for:
  - `app-store.ts` — auth state transitions (idle → authenticating → authenticated), persist/rehydrate, reset
  - `use-permissions.ts` — `can()` with Set, super_admin bypass, unauthenticated returns false
  - `api-client.ts` — token caching (skips `getAccessTokenSilently` when cached), header injection, 401 handling skipped during switching
  - `use-account-switch.ts` — abort on rapid switch, fallback when saved account not found
  - `query-keys.ts` — factory produces expected key shapes

**Success criteria:** `pnpm --filter @msgops/frontend-react test` passes. Critical auth and permission logic has test coverage.

---

## System-Wide Impact

### Interaction Graph

1. **Auth flow:** User visits app → `@auth0/auth0-react` checks session (in-memory cache) → `loginWithRedirect()` to Auth0 → callback with code/state → `POST /users/login` WITH JWT → `GET /users/me?accountId=X` + `GET /accounts/configs` IN PARALLEL → store transitions to `authenticated` → App renders
2. **Every API request:** Axios interceptor → check cached token expiry → if valid, use cached; if expiring, call `getAccessTokenSilently()` → sets `Authorization` + `Account-Id` headers → backend validates via JWKS → response
3. **Account switch:** UI action → abort previous switch → `removeQueries(predicate)` → update store to `switching` → `Promise.all([/users/me, /accounts/configs])` → check abort signal → store to `authenticated` → navigate

### Error & Failure Propagation

| Error Source                        | Handling                                                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Auth0 SDK init failure              | Show error page with "Try Again"                                                                |
| Auth0 callback error                | Use `useAuth0().error` (not URL params), show message + "Try Again"                             |
| `POST /users/login` failure         | Retry once, then show error page with "Logout"                                                  |
| `GET /users/me` returns no accounts | Show "No accounts" page with "Logout"                                                           |
| JWT expired during API call         | Token cache check → `getAccessTokenSilently()` → retry; if `login_required` → redirect to Auth0 |
| 401 during account switch           | Do NOT trigger logout (check `auth.status === 'switching'`)                                     |
| Axios `CancelledError`              | Silent — from `cancelQueries()` during account switch                                           |
| 403 from API                        | Toast: "Permissão negada"                                                                       |
| 5xx from API                        | Toast: "Não foi possível processar a requisição"                                                |
| Network error                       | Toast: "Erro de conexão"                                                                        |

### Security Considerations

- **Client-side permission checks are UX conveniences only** — backend enforces all authorization via `PrincipalContextGuard` + `PermissionGuard`
- **Tokens stored in memory** (not localStorage) — XSS cannot exfiltrate them
- **`returnTo` deep link validated** — rejects absolute URLs and `//` protocol-relative to prevent open redirect
- **No `Current-User` header** — eliminated unnecessary PII exposure
- **CSRF not needed** — authentication uses `Authorization` header, not cookies
- **Backend TODO:** Configure CORS allowlist (currently wide open `cors()`) and move `POST /users/login` behind JWT guard

### State Lifecycle Risks

- **Strict Mode double-mount:** AbortController in `useEffect` cleanup prevents duplicate auth init
- **Account switch abort:** AbortController per switch + abort signal check after every `await`
- **Stale localStorage accountId:** Fallback to first account (not error)
- **TanStack cache:** `removeQueries` with predicate (not `clear()`) preserves account-independent data

---

## Acceptance Criteria

### Functional Requirements

- [ ] User authenticates via Auth0 Universal Login and returns to the app
- [ ] Post-callback: app calls `POST /users/login` (with JWT) and `GET /users/me` + `/accounts/configs` (parallel)
- [ ] Layout matches screenshot: Etus logo top-left, searchable account selector, user avatar top-right, collapsible sidebar, settings at bottom
- [ ] Sidebar uses correct backend permission names (typed as `Permission` union)
- [ ] Account switching: aborts previous switch, clears account-scoped cache, refetches, navigates
- [ ] Selected account persists to localStorage and restores on refresh
- [ ] Single `ProtectedRoute` guard handles both auth and permission checks
- [ ] Default route is permission-aware using correct permission names
- [ ] Logout clears store and redirects to Auth0 logout
- [ ] Toast notifications for API errors (localized pt-BR strings)

### Non-Functional Requirements

- [ ] Vite build with separate vendor chunks (react, query, auth)
- [ ] Route-level code splitting via `React.lazy()` / route `lazy`
- [ ] No flash of unauthenticated content (LoadingScreen covers auth init)
- [ ] Mobile responsive: sidebar converts to Sheet drawer
- [ ] Token cached in memory with expiry check (not fetched per-request)

### Quality Gates

- [ ] TypeScript strict mode — `Permission` and `RoleCode` typed as unions (no raw strings)
- [ ] Zustand v5 `useShallow` used for all object/array selectors
- [ ] Vitest unit tests for store, permissions, API client, account switching
- [ ] ESLint passes with no errors

---

## Dependencies & Prerequisites

| Dependency                           | Status      | Notes                                                                 |
| ------------------------------------ | ----------- | --------------------------------------------------------------------- |
| msgops-api running at localhost:5001 | Required    | Backend must be running for API calls                                 |
| Auth0 SPA application configured     | Required    | Need client ID; enable Refresh Token Rotation in Auth0 dashboard      |
| Etus logo SVG                        | Required    | Extract from Vue 2 app or design assets                               |
| Backend CORS configuration           | Recommended | Currently wide open — should allowlist frontend origin for production |

---

## Risk Analysis & Mitigation

| Risk                                              | Impact                                | Mitigation                                                                             |
| ------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| Auth0 SPA client not configured                   | Blocks auth                           | Verify Auth0 dashboard has SPA app with callback URLs; enable Refresh Token Rotation   |
| CORS (React :3000, API :5001)                     | Blocks dev API calls                  | Vite proxy `/api` → `:5001`; set `VITE_API_URL` to `/api` in dev                       |
| `cacheLocation: "memory"` loses tokens on refresh | User re-authenticates on page refresh | `useRefreshTokens: true` + `useRefreshTokensFallback: true` silently re-obtains tokens |
| Zustand v5 `useShallow` omitted                   | Infinite re-render loops              | Lint rule or code review to enforce `useShallow` for object selectors                  |
| Permission name typos                             | Silent auth failures                  | `Permission` union type catches at compile time                                        |
| React 19 Strict Mode double-mount                 | Duplicate API calls in dev            | AbortController in all `useEffect` async flows                                         |
| shadcn/ui + Tailwind v4                           | Styling issues                        | Use `tw-animate-css` (not `tailwindcss-animate`); `new-york` style only                |

---

## Future Considerations

- **Phase 2:** i18n (react-i18next with namespace-based lazy loading), react-hook-form + zod, Playwright E2E, port first feature modules
- **Phase 3:** Port forms (campaign editor, message editor, contact import)
- **Phase 4:** Port analytics pages (with Recharts in separate vendor chunk)
- **Phase 5:** Sentry, GTM, Clarity integration
- **Backend improvements:** Restrict CORS, require JWT on `/users/login`, consider shared `@msgops/shared` package for Permission types

---

## Sources & References

### Internal References

- Vue 2 auth flow: `apps/frontend-vue2/src/auth/VueAuth.ts`, `apps/frontend-vue2/src/App.vue`
- Vue 2 API client: `apps/frontend-vue2/src/services/api.service.ts`
- Vue 2 sidebar: `apps/frontend-vue2/src/components/layout/Sidebar.vue`
- Vue 2 header: `apps/frontend-vue2/src/components/layout/Header.vue`
- Vue 2 store: `apps/frontend-vue2/src/store.ts`
- Vue 2 router: `apps/frontend-vue2/src/router.ts`
- Backend permissions: `apps/msgops-api/src/modules/authz/authz.constants.ts`
- Backend login: `apps/msgops-api/src/modules/users/users.controller.ts:19`
- Backend users/me: `apps/msgops-api/src/modules/users/users.service.ts:311`
- Backend principal context: `apps/msgops-api/src/modules/authz/authz.service.ts`

### External References

- Auth0 React SDK: https://auth0.github.io/auth0-react/interfaces/Auth0ProviderOptions.html
- Auth0 Refresh Token Rotation: https://auth0.com/docs/secure/tokens/refresh-tokens/use-refresh-token-rotation
- React Router v7 createBrowserRouter: https://reactrouter.com/api/data-routers/createBrowserRouter
- Zustand v5 persist: https://zustand.docs.pmnd.rs/reference/middlewares/persist
- TanStack Query v5: https://tanstack.com/query/v5/docs/reference/QueryClient
- shadcn/ui Tailwind v4: https://ui.shadcn.com/docs/tailwind-v4
- Vite manual chunks: https://www.mykolaaleksandrov.dev/posts/2025/11/taming-large-chunks-vite-react/
