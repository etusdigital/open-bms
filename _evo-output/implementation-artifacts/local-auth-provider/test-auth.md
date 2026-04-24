# Testar auth local

Objetivo: provar que o fluxo de login + gerenciar usuários funciona pelos frontends (Vue 2 + Vue 3) sem Auth0.

## 1. Subir Postgres + Redis

```bash
docker rm -f bms-pg bms-redis 2>/dev/null
docker run -d --name bms-pg -p 55432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=msgops postgres:16-alpine
docker run -d --name bms-redis -p 56379:6379 redis:7-alpine
until docker exec bms-pg pg_isready -U postgres -d msgops; do sleep 1; done
```

## 2. `.env` do backend

```bash
cat > apps/msgops-api/.env <<'EOF'
SERVER_PORT=5001
API_DOCS=/api-docs
AUTH_PROVIDER=local
JWT_SECRET=dev-secret-change-me-openssl-rand-hex-32
JWT_AUDIENCE=bms-msgops-api
BOOTSTRAP_ADMIN_EMAIL=admin@local.dev
BOOTSTRAP_ADMIN_PASSWORD=ChangeMe123!
TYPEORM_HOST=127.0.0.1
TYPEORM_PORT=55432
TYPEORM_USERNAME=postgres
TYPEORM_PASSWORD=postgres
TYPEORM_DATABASE=msgops
TYPEORM_MIGRATIONS_RUN=true
REDIS_HOST=127.0.0.1
REDIS_PORT=56379
CORS_ORIGINS=http://localhost:5173,http://localhost:44357
SPARKPOST_API_KEY=x
SENDGRID_API_KEY=x
OPENAI_API_KEY=x
SENDGRID_WEBHOOK_URL=x
SENDGRID_SUBUSER_EMAIL=x@x.com
SENDGRID_IP_POOL=x
TOPIC_NAME_MESSAGE_TRIGGER=x
TOPIC_NAME_SEND_EMAIL=x
CAMPAIGN_TRIGGER_ENDPOINT=x
GOOGLE_TASK_QUEUE=x
GOOGLE_TASK_QUEUE_TEST_AB=x
GOOGLE_TASKS_PROJECT_ID=x
GOOGLE_TASKS_LOCATION=x
BRIUS_HOSTURL=x
CAMPAIGN_TEST_AB_ENDPOINT=x
CAMPAIGN_RESULT_TEST_AB_ENDPOINT=x
TAG_PROCESS_ENDPOINT=x
GOOGLE_TASK_SEGMENT=x
GOOGLE_TASK_BMS_USAGE=x
GOOGLE_TASK_WHATSAPP_MESSAGE=x
GLOCK_API_KEY=x
BUCKET_NAME=x
EMAIL_VALIDATION_URL=x
WHATSAPP_PROVIDER=evolution
TEMPLATE_WEBHOOK_URL=x
EOF
```

## 3. Subir backend

```bash
cd apps/msgops-api && pnpm build && pnpm start
```

No log: `Bootstrap admin created: admin@local.dev`. Deixa rodando.

## 4. Subir frontend Vue 3 (admin — cria/edita usuários)

Em outro terminal:

```bash
echo 'VITE_API_MSGOPS=http://localhost:5001' > apps/msgops-manager-frontend/.env
echo 'VITE_APP_REDIRECT_MSGOPS=http://localhost:44357/' >> apps/msgops-manager-frontend/.env
pnpm --filter msgops-manager-frontend dev
```

Abra `http://localhost:5173`:

1. Deve redirecionar para `/login`.
2. Entrar com `admin@local.dev` / `ChangeMe123!`.
3. Navegar para **Users** → criar novo usuário:
   - email, nome, senha, role (ex.: `admin`).
4. Logout pelo menu do header.
5. Logar com as credenciais do novo usuário → deve entrar.
6. Criar **Account** (tenant) pela UI se for relevante ao seu teste.

## 5. Subir frontend Vue 2 (app de operação)

Em outro terminal:

```bash
cat > apps/frontend-vue2/.env <<'EOF'
VUE_APP_API_URL='http://localhost:5001/'
VUE_APP_ENVIRONMENT='development'
EOF
pnpm --filter msg-ops serve
```

Abra `http://localhost:44357`:

1. Redireciona para `/login`.
2. Logar com qualquer usuário criado no passo 4.
3. Navegar pelas telas de operação — as requests devem ir com `Authorization: Bearer ...` (confere em DevTools → Network).
4. Hard reload (Ctrl+Shift+R) logado: não deve deslogar (o interceptor de 401 chama `/auth/refresh` silenciosamente usando o cookie httpOnly).
5. Logout pelo header → volta pra `/login`.

## Se algo falhar

- **Login retorna 401 no browser, mas credencial está correta:** olhe o CORS. A origem do frontend precisa estar em `CORS_ORIGINS` no `.env` do backend. Preflight deve retornar `Access-Control-Allow-Credentials: true`.
- **Cookie `bms_refresh` não aparece no browser:** backend CORS sem `credentials: true`, ou frontend sem `withCredentials: true` nos requests. Já está configurado nos dois — se falhar, me avisa.
- **Backend não sobe, log diz `JWT_SECRET`:** faltou env no `.env`.
- **Backend não sobe, `password authentication failed`:** container do passo 1 não subiu.

## Limpeza

```bash
docker rm -f bms-pg bms-redis
```
