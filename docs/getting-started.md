# Getting Started — BMS Platform

BMS é a plataforma de mensageria multi-canal da Etus. Este guia cobre os passos necessários para rodar o projeto localmente e configurá-lo pela primeira vez.

## Pré-requisitos

| Dependência | Versão mínima | Observação                                              |
| ----------- | ------------- | ------------------------------------------------------- |
| Node.js     | 20            | `node --version`                                        |
| pnpm        | 9             | `corepack enable && corepack prepare pnpm@9 --activate` |
| PostgreSQL  | 14+           | banco operacional (`msgops`)                            |
| Redis       | 6+            | cache e filas                                           |
| ClickHouse  | 23+           | analytics (opcional para dev local)                     |
| RabbitMQ    | 3.12+         | mensageria assíncrona                                   |
| S3 / MinIO  | —             | armazenamento de assets (MinIO para dev)                |

### Subir infraestrutura local com Docker

```bash
# PostgreSQL + Redis + RabbitMQ + MinIO
docker compose -f docker-compose.dev.yml up -d
```

> Se não existir um `docker-compose.dev.yml`, suba cada serviço individualmente ou ajuste conforme seu ambiente.

---

## Instalação

```bash
# 1. Clonar o repositório
git clone <url-do-repositório>
cd bms-monorepo-open-source

# 2. Instalar dependências
pnpm install

# 3. Copiar arquivos de variáveis de ambiente
cp apps/msgops-api/.env.example apps/msgops-api/.env
```

---

## Variáveis de ambiente essenciais

Edite `apps/msgops-api/.env` e preencha pelo menos:

```env
# Banco de dados
TYPEORM_HOST=127.0.0.1
TYPEORM_PORT=5432
TYPEORM_USERNAME=postgres
TYPEORM_PASSWORD=sua-senha
TYPEORM_DATABASE=msgops

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
AMQP_URL=amqp://guest:guest@localhost:5672

# S3 / MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=bms-assets
S3_REGION=us-east-1

# ClickHouse (pode deixar vazio em dev se não usar analytics)
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=BMS

# Auth local (padrão)
AUTH_PROVIDER=local
JWT_SECRET=<gere com: openssl rand -hex 32>
JWT_ACCESS_TTL=3600
JWT_REFRESH_TTL=2592000
JWT_AUDIENCE=bms-msgops-api

# URL do frontend (para CORS)
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
```

---

## Subir em modo desenvolvimento

```bash
# Todos os apps
pnpm dev

# Apenas o backend
pnpm --filter msgops-api dev

# Apenas o frontend React (operator + super-admin)
pnpm --filter frontend-react dev

# Apenas o frontend Vue 2 (operador legado)
pnpm --filter msg-ops serve
```

---

## Primeiro boot — Setup Wizard

Na **primeira execução**, a tabela `users` estará vazia. O sistema redireciona automaticamente para o assistente de configuração em `/setup`.

### Passo 1 — Conta de administrador

- **O quê**: cria o super-admin da plataforma.
- **Dados**: nome, e-mail e senha (mínimo 8 caracteres).
- **Backend**: persiste o usuário na tabela `users` com `role = super_admin`.  
  Usa advisory lock para serializar submissões concorrentes.

> **Alternativa via env vars** (sem UI): defina `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` antes do primeiro boot — o sistema criará o admin automaticamente.

### Passo 2 — Servidor SMTP

- **O quê**: configura o servidor SMTP usado para envios transacionais.
- **Dados**: host, porta, usuário, senha, endereço `From`.
- **Teste**: o botão "Testar SMTP" envia um e-mail de teste para o endereço do admin criado no passo 1. Limitado a 5 tentativas por minuto por IP.
- **Backend**: persiste em `system_config` com chave `smtp_settings`.

### Passo 3 — URL base da plataforma

- **O quê**: define a URL pública do sistema.
- **Dados**: `baseUrl` (ex.: `https://app.empresa.com`).
- **Uso**: links em e-mails, redirecionamentos e integrações externas.
- **Backend**: persiste em `system_config` com chave `domain_settings`.

### Passo 4 — IP Pool e primeira conta

- **O quê**: cria a conta-mãe e o pool de IPs de envio.
- **Dados**: nome da conta, nome do pool, e-mail/nome do remetente, reply-to, limite de envio, lista de IPs.
- **Skip**: é possível pular esta etapa e configurar depois pelas telas de administração.
- **Backend**: cria registros nas tabelas `accounts`, `pools` e `user_accounts` (vincula o admin como master user).

### Passo 5 — Verificação de serviços

- **O quê**: verifica se todos os serviços de infraestrutura estão acessíveis.
- **Serviços checados** (em paralelo, timeout de 5 s cada):

  | Serviço    | Probe               | Variável de controle   |
  | ---------- | ------------------- | ---------------------- |
  | PostgreSQL | `SELECT 1`          | `TYPEORM_*`            |
  | Redis      | `PING`              | `REDIS_*`              |
  | ClickHouse | `SELECT 1`          | `CLICKHOUSE_*`         |
  | RabbitMQ   | TCP connect + close | `AMQP_URL`             |
  | S3 / MinIO | `HeadBucket`        | `S3_*`                 |
  | SMTP       | `STARTTLS verify`   | configurado no passo 2 |

- **Concluir**: habilitado apenas quando todos retornam `ok: true`.  
  É possível pular com aviso caso algum serviço esteja propositalmente desabilitado.
- **Backend**: na conclusão, grava atomicamente:
  - `system_config[setup_wizard_step]` → `{ currentStep: 5, completed: true }`
  - `system_config[setup_complete]` → `{ complete: true, completedAt: <ISO> }`

---

## Verificar o health-check manualmente

```bash
# Enquanto o wizard não estiver concluído
curl -s http://localhost:5001/setup/health-check | jq .

# Resposta esperada (todos ok)
{
  "postgres":   { "ok": true, "latencyMs": 4 },
  "redis":      { "ok": true, "latencyMs": 1 },
  "clickhouse": { "ok": true, "latencyMs": 12 },
  "rabbitmq":   { "ok": true, "latencyMs": 8 },
  "s3":         { "ok": true, "latencyMs": 35 },
  "smtp":       { "ok": true, "latencyMs": 220 },
  "allOk": true
}
```

Ver `docs/health-check-endpoint.md` para mais exemplos e interpretação de erros.

---

## Outros comandos úteis

```bash
pnpm build          # Build completo do monorepo
pnpm type-check     # Verificação de tipos TypeScript
pnpm lint           # Lint (ESLint + Prettier) em todos os apps
pnpm clean          # Limpa artefatos de build
```

---

## Auth0 (opcional)

Por padrão `AUTH_PROVIDER=local`. Para usar Auth0:

```env
AUTH_PROVIDER=auth0
AUTH0_DOMAIN=<tenant>.us.auth0.com
AUTH0_CLIENT_ID=<client-id>
AUTH0_CLIENT_SECRET=<client-secret>
JWKS_URI=https://<tenant>.us.auth0.com/.well-known/jwks.json
IDP_ISSUER=https://<tenant>.us.auth0.com/
IDP_AUDIENCE=<api-audience>
```

Com Auth0 ativo, a criação de usuário no passo 1 do wizard delega para a Management API do Auth0.

---

## Documentação adicional

- [`docs/health-check-endpoint.md`](./health-check-endpoint.md) — detalhes do endpoint de health-check
- [`apps/msgops-api/.env.example`](../apps/msgops-api/.env.example) — todas as variáveis de ambiente disponíveis
- [`CLAUDE.md`](../CLAUDE.md) — convenções de código e arquitetura do monorepo
