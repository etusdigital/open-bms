---
title: "Migrate from React Router to TanStack Router"
type: brainstorm
status: complete
date: 2026-03-11
---

# Migrate from React Router to TanStack Router

## What We're Building

Replace React Router v7.5 with TanStack Router to get **fully type-safe routing** across the frontend-react app. This includes type-safe path params, search params (with Zod validation), links, and navigation — catching broken routes and invalid params at compile time instead of runtime.

## Why This Approach

### Motivation
- **Type-safe routing** is the primary driver — `<Link to="/campaings">` (typo) becomes a compile error
- **Search param validation** with Zod replaces `nuqs` dependency — route-level `validateSearch` gives typed search params with defaults
- **Ideal timing** — 30 of 32 routes are placeholders, so migration surface is minimal

### Why TanStack Router over React Router
- React Router v7 has limited type safety (paths are strings, search params are `unknown`)
- TanStack Router generates a fully typed route tree — every `<Link>`, `useParams()`, `useSearch()` is compile-time checked
- Built-in code splitting via the Vite plugin replaces manual `React.lazy()` + `SuspenseWrapper`
- `beforeLoad` hooks provide route-level auth guards that run before rendering (no flash of content)
- First-class Zod integration for search param validation
- `pendingComponent` replaces manual Suspense fallback management

### Migration Strategy: Big Bang Replace
Since ~95% of routes are placeholders with no logic, a full replacement in one pass is cleaner than maintaining two routers side-by-side. Only ~7 files have real router dependencies.

## Key Decisions

### 1. File-based routing with nested directories
- Use `@tanstack/router-plugin/vite` to auto-generate `routeTree.gen.ts`
- Routes live in `src/routes/` with directory nesting matching URL paths
- `autoCodeSplitting: true` replaces manual `React.lazy()` pattern
- Underscore prefix for layout routes (`_authenticated.tsx`)

### 2. Auth guard via `beforeLoad` (not component-based)
- `_authenticated.tsx` layout route uses `beforeLoad` to check auth state
- Reads from `useAppStore.getState()` (Zustand) — no hooks needed in beforeLoad
- Throws `redirect({ to: '/login', search: { returnTo: location.href } })` if not authenticated
- Auth0Provider wraps the router at the app level (not as a route element)

### 3. Router context for dependency injection
- Pass `auth` state and `queryClient` via router context (TanStack Router pattern)
- `beforeLoad` accesses context instead of importing singletons directly
- Enables testing routes with mock auth context

### 4. Replace nuqs with TanStack Router search params
- Route-level `validateSearch: zodValidator(schema)` with `@tanstack/zod-adapter`
- `Route.useSearch()` returns fully typed search params
- Remove `nuqs` dependency entirely
- Apply to filter-heavy pages (reports, contacts, campaigns) as they're built

### 5. Auth0Provider positioning
- Auth0Provider wraps `RouterProvider` at the app level (in `main.tsx` or `App.tsx`)
- Unlike current setup where Auth0Provider is a route element, TanStack Router needs auth context available in `beforeLoad` which runs outside React component tree
- `AuthBridge` component still sets the token fetcher, rendered inside the root route

### 6. Navigation pattern changes
- `useNavigate()` from `@tanstack/react-router` (type-safe destinations)
- `<Link to="/campaigns">` — compile error if path doesn't exist
- `router.navigate()` for imperative navigation outside components (e.g., in API interceptors)
- `redirect()` in `beforeLoad` for route-level redirects

## File Structure

```
src/routes/
├── __root.tsx                          # Root layout: QueryClientProvider, Toaster, AuthBridge
├── login.tsx                           # /login (public)
├── callback.tsx                        # /callback (public)
├── access-denied.tsx                   # /access-denied (public)
├── _authenticated.tsx                  # Layout: beforeLoad auth guard
├── _authenticated/
│   ├── _layout.tsx                     # AppLayout (sidebar + header + Outlet)
│   ├── _layout/
│   │   ├── index.tsx                   # / → permission-based redirect
│   │   ├── profile.tsx                 # /profile
│   │   ├── campaigns.tsx              # /campaigns (placeholder)
│   │   ├── trigger-campaign.tsx       # /trigger-campaign
│   │   ├── product.tsx                # /product
│   │   ├── automations/
│   │   │   └── emails.tsx             # /automations/emails
│   │   ├── messages/
│   │   │   ├── index.tsx              # /messages
│   │   │   ├── email/
│   │   │   │   ├── statistics.tsx     # /messages/email/statistics
│   │   │   │   └── comparison.tsx     # /messages/email/comparison
│   │   │   ├── web-push.tsx           # /messages/web-push
│   │   │   ├── mobile-push.tsx        # /messages/mobile-push
│   │   │   ├── sms.tsx               # /messages/sms
│   │   │   ├── whatsapp.tsx          # /messages/whatsapp
│   │   │   ├── 2fa.tsx               # /messages/2fa
│   │   │   └── postmaster.tsx        # /messages/postmaster
│   │   ├── templates.tsx              # /templates
│   │   ├── contacts.tsx               # /contacts
│   │   ├── segments.tsx               # /segments
│   │   ├── tags.tsx                   # /tags
│   │   ├── customfields.tsx           # /customfields
│   │   ├── custom-events.tsx          # /custom-events
│   │   ├── pools.tsx                  # /pools
│   │   ├── warmups.tsx                # /warmups
│   │   ├── campaign-rules.tsx         # /campaign-rules
│   │   ├── labels.tsx                 # /labels
│   │   ├── insights.tsx               # /insights
│   │   ├── leads.tsx                  # /leads
│   │   └── settings.tsx               # /settings
```

## Files Affected by Migration

| File | Change |
|---|---|
| `src/router.tsx` | **Delete** — replaced by auto-generated `routeTree.gen.ts` |
| `src/main.tsx` | Rewrite: Auth0Provider → RouterProvider with context |
| `src/components/protected-route.tsx` | **Delete** — replaced by `_authenticated.tsx` beforeLoad |
| `src/components/auth0-provider-with-navigate.tsx` | Refactor: no longer a route element, becomes wrapper in main.tsx |
| `src/components/auth-callback.tsx` | Move to `src/routes/callback.tsx` as file route |
| `src/components/loading-screen.tsx` | Keep as-is, used as `pendingComponent` |
| `src/pages/home.tsx` | Move to `src/routes/_authenticated/_layout/index.tsx` |
| `src/pages/login.tsx` | Move to `src/routes/login.tsx` |
| `src/pages/access-denied.tsx` | Move to `src/routes/access-denied.tsx` |
| `src/pages/not-found.tsx` | Move to 404 handler in `__root.tsx` |
| `src/pages/placeholder.tsx` | Keep as shared component, imported by route files |
| `src/hooks/use-auth-init.ts` | Replace `useNavigate`/`useLocation` with TanStack equivalents |
| `src/hooks/use-account-switch.ts` | Replace `useNavigate` with `router.navigate()` |
| `src/features/profile/profile-page.tsx` | Move to route file or keep as component imported by route |
| `src/components/layout/sidebar-nav-link.tsx` | Replace `<NavLink>` with TanStack `<Link>` |
| `vite.config.ts` | Add `TanStackRouterVite` plugin |
| `package.json` | Add `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/zod-adapter`; remove `react-router`, `react-router-dom`, `nuqs` |

## Dependencies

| Add | Remove |
|---|---|
| `@tanstack/react-router` | `react-router` |
| `@tanstack/router-plugin` | `react-router-dom` |
| `@tanstack/router-devtools` | `nuqs` |
| `@tanstack/zod-adapter` | |

## Resolved Questions

- **File-based vs code-based?** → File-based nested (auto-generated types, built-in code splitting, TanStack's recommended path)
- **Auth guard pattern?** → `beforeLoad` on `_authenticated` layout route (runs before render, no flash)
- **Search params?** → Replace nuqs with TanStack Router's `validateSearch` + `@tanstack/zod-adapter`
- **Migration strategy?** → Big bang replace (95% placeholder routes, minimal real logic to port)

## Open Questions

_None — all key decisions resolved during brainstorm._
