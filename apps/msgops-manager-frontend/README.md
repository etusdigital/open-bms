# msgops-manager-frontend

Super Admin UI for the BMS (Broadcast Messaging System) platform. Manages tenant accounts, users, and billing plans.

## Stack

- **Framework:** Vue 3 + Vite + TypeScript
- **UI:** Vuetify 3 + Tailwind CSS
- **State:** Pinia
- **Routing:** vue-router
- **Auth:** Auth0 (`@auth0/auth0-vue`)
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

| Variable                       | Description                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `VITE_API_MSGOPS`              | Base URL of the msgops-api backend                                                  |
| `VITE_AUTH0_DOMAIN`            | Auth0 tenant domain                                                                 |
| `VITE_AUTH0_CLIENT_ID`         | Auth0 SPA client ID                                                                 |
| `VITE_AUTH0_AUDIENCE`          | Auth0 API audience (msgops-api identifier)                                          |
| `VITE_AUTH0_CALLBACK_URL`      | Redirect URI after Auth0 login                                                      |
| `VITE_APP_REDIRECT_MSGOPS`     | URL of the main MsgOps frontend (shown in the header menu)                          |
| `VITE_AUTH0_ROLES_CLAIM`       | JWT custom claim namespace for roles (e.g. `https://your-domain.example.com/roles`) |
| `VITE_AUTH0_BILLING_ONLY_ROLE` | Role name that restricts access to billing-only view                                |

## Build

```bash
yarn build      # outputs to dist/
```

## Deployment

Deployed to Google Cloud Storage (static hosting) via GitHub Actions on push to `master` or `staging`.

Required repository variables: `MSGOPS_API_URL_*`, `AUTH0_*`, `GCS_BUCKET_*`
Required secrets: `GCP_SA_KEY`, `GCP_SA_KEY_STAGING`
