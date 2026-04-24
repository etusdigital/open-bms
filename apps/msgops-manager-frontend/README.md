# msgops-manager-frontend

Super Admin UI for the BMS (Broadcast Messaging System) platform. Manages tenant accounts, users, and billing plans.

## Stack

- **Framework:** Vue 3 + Vite + TypeScript
- **UI:** Vuetify 3 + Tailwind CSS
- **State:** Pinia
- **Routing:** vue-router
- **Auth:** Local — composable `useAuth` (`src/composables/useAuth.ts`) + `/auth/login` / `/auth/refresh` / `/auth/logout` na `msgops-api`. Access token em memória, refresh via cookie httpOnly.
- **Forms:** vee-validate + zod
- **i18n:** vue-i18n (pt-BR / en-US)

## Local development

```bash
cp .env.example .env
# Fill in your values in .env

yarn install
yarn dev        # http://localhost:5173
```

## Environment variables

| Variable                   | Description                                                |
| -------------------------- | ---------------------------------------------------------- |
| `VITE_API_MSGOPS`          | Base URL of the msgops-api backend                         |
| `VITE_APP_REDIRECT_MSGOPS` | URL of the main MsgOps frontend (shown in the header menu) |

## Auth flow

1. Rota `/login` pede email/senha e chama `POST /auth/login` na `msgops-api`.
2. Backend devolve `{ accessToken, expiresIn, user }` e grava cookie httpOnly `bms_refresh`.
3. Frontend guarda o access token em memória (sem `sessionStorage`/`localStorage`).
4. Quando o token expira, interceptor tenta `POST /auth/refresh` usando o cookie — se falhar, redireciona para `/login`.
5. Roles/permissions vêm de `GET /users/me` e populam `useUserStore` (`effectiveRole`, `permissions`, `isSuperAdmin`, `canSeeAllAccounts`).

## Audience: super-admin only

Esta UI é o console de super-admin (gerencia tenants e usuários globais). O `router.ts` verifica `userStore.isSuperAdmin` no guard de navegação e redireciona qualquer user não-super-admin para `VITE_APP_REDIRECT_MSGOPS` (o app de operações — `apps/frontend-vue2`). Admins de conta, editores, etc. não têm UI aqui, vão direto pro app de ops.

## Build

```bash
yarn build      # outputs to dist/
```
