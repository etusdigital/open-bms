# BMS Open Source — Deploy via Portainer (Docker Swarm)

Guia self-contained pra subir o BMS Open Source em qualquer cluster Docker Swarm via Portainer Web UI. Aplica-se a staging, produção e qualquer outro ambiente — você só varia as envs. Reúne todas as armadilhas descobertas no primeiro deploy real (2026-05-26).

**Filosofia**: copy-paste friendly. Não precisa abrir o repo nem rodar shell scripts — Portainer faz tudo via Web UI. Os arquivos YAML deste repo (`infra/swarm/stack.bms.yml`, `infra/swarm/stack.traefik.yml`) são pra colar diretamente no editor do Portainer.

---

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar os 3 Swarm configs do ClickHouse](#2-criar-os-3-swarm-configs-do-clickhouse)
3. [Deploy do Traefik](#3-deploy-do-traefik)
4. [Setar variáveis de ambiente do stack](#4-setar-variáveis-de-ambiente-do-stack)
5. [Deploy do stack BMS](#5-deploy-do-stack-bms)
6. [Verificação pós-deploy](#6-verificação-pós-deploy)
7. [Setup inicial pela UI](#7-setup-inicial-pela-ui)
8. [Troubleshooting](#8-troubleshooting)
9. [Operação corrente](#9-operação-corrente)

---

## 1. Pré-requisitos

### 1.1. Infraestrutura

- **Docker Swarm cluster** com pelo menos 1 manager.
- **Portainer Business/CE** instalado e conectado ao Swarm (Environment → Endpoints).
- **DNS público** apontando 2 hostnames pro IP do manager:
  - `bms-app.<seu-dominio>` — app, API, webhooks
  - `ch-ui-bms.<seu-dominio>` — console do ClickHouse
- **Portas 80 e 443 livres** no manager (Traefik vai escutar nelas).

### 1.2. Rede overlay externa

O Traefik e os apps conversam via uma rede overlay **externa** (não criada pelo stack). Crie uma vez:

```bash
docker network create --driver overlay --attachable bmsNet
```

Nome pode ser outro — só lembre de setar `TRAEFIK_NETWORK_NAME` consistentemente em todos os stacks.

### 1.3. Volume pra certificados Let's Encrypt

```bash
docker volume create volume_swarm_certificates
```

### 1.4. Imagens publicadas no Docker Hub

O stack referencia `${IMAGE_REGISTRY}/bms-*:${IMAGE_TAG}` (padrão `etusdigital/bms-*:latest`). Confira que todas existem:

```bash
for img in msgops-api frontend-react event-receiver event-process \
           send-email send-push send-whatsapp twilio-messaging \
           campaign-events-tracker campaign-packer tracker \
           tag-process message-trigger geolocation enterprise-import; do
  docker pull etusdigital/bms-$img:latest >/dev/null 2>&1 \
    && echo "✅ $img" || echo "❌ $img"
done
```

⚠️ A imagem `bms-enterprise-import` é a mais recente — se não existir no Hub, ver [§8.5](#85-imagem-bms-enterprise-importlatest-não-existe-no-docker-hub).

---

## 2. Criar os 3 Swarm configs do ClickHouse

Os 3 configs precisam **existir antes** do deploy do stack. Senão o ClickHouse falha com "config X not found".

⚠️ **Atenção**: Swarm configs são **imutáveis**. Pra atualizar conteúdo no futuro, crie versão nova (ex.: `clickhouse-init-01-v2`) e atualize a referência no stack file.

### Via Portainer Web UI

**Portainer → Configs → Add config**, três vezes:

#### Config 1 — Nome: `clickhouse-init-01`

Cole o conteúdo do arquivo [`infra/clickhouse-init/01-init-bms.sql`](../clickhouse-init/01-init-bms.sql). Cria as tabelas e MVs principais (`events_logs_v2`, `tb_email_hourly_stats`, `mv_email_hourly`).

#### Config 2 — Nome: `clickhouse-init-02-auth`

Cole o conteúdo do arquivo [`infra/clickhouse-init/02-events-rabbitmq.sh`](../clickhouse-init/02-events-rabbitmq.sh). Script bash que cria a tabela `events_queue` (RabbitMQ engine) e a MV `mv_events_to_logs`.

#### Config 3 — Nome: `clickhouse-users-experimental`

Cole o conteúdo do arquivo [`infra/clickhouse-config/users.d/00-experimental.xml`](../clickhouse-config/users.d/00-experimental.xml). Habilita `allow_experimental_json_type` (necessário pra coluna `properties` da `events_logs_v2`).

### Via CLI (alternativa)

```bash
# do diretório raiz do repo:
docker config create clickhouse-init-01 infra/clickhouse-init/01-init-bms.sql
docker config create clickhouse-init-02-auth infra/clickhouse-init/02-events-rabbitmq.sh
docker config create clickhouse-users-experimental infra/clickhouse-config/users.d/00-experimental.xml
```

### Verificar

```bash
docker config ls | grep clickhouse
```

Devem aparecer os 3.

---

## 3. Deploy do Traefik

Se você **já tem Traefik v3** rodando, pule pra §3.3 e confira só que os timeouts estão configurados.

Se **não tem ou precisa subir do zero**, deploy o `stack.traefik.yml` deste repo.

### 3.1. Criar stack no Portainer

**Portainer → Stacks → Add stack**:

- **Name**: `traefik`
- **Build method**: Web editor
- **Web editor**: cola o conteúdo de [`infra/swarm/stack.traefik.yml`](./stack.traefik.yml)

### 3.2. Setar Environment variables

Na seção **Environment variables** abaixo do editor, adicione:

| Name                   | Value                                        |
| ---------------------- | -------------------------------------------- |
| `LETSENCRYPT_EMAIL`    | `admin@seudominio.com`                       |
| `TRAEFIK_NETWORK_NAME` | `bmsNet` (mesmo nome da rede criada em §1.2) |

Clica **Deploy the stack**.

### 3.3. Confirmar timeouts (se Traefik já existe)

Pra operações longas do msgops-api funcionarem (import enterprise, exports), o Traefik **precisa ter** estes flags. Se faltar algum, edite o stack do Traefik:

```
--entrypoints.websecure.transport.respondingTimeouts.readTimeout=600s
--entrypoints.websecure.transport.respondingTimeouts.writeTimeout=600s
--entrypoints.websecure.transport.respondingTimeouts.idleTimeout=600s
--serversTransport.forwardingTimeouts.responseHeaderTimeout=600s
```

Sem isso, request > 60s dá **504 Gateway Timeout**. Ver [§8.3](#83-post-apiaccountsimport-ou-qualquer-endpoint-longo-dá-504).

⚠️ Também: usar **apenas** `--providers.swarm.*` (não combinar com `--providers.docker.*`). Ver [§8.2](#82-traefik-logs-cheios-de-port-is-missing).

---

## 4. Setar variáveis de ambiente do stack

Antes de subir o stack BMS, prepare **todas** as envs. Você cola em **Portainer → Stacks → bms → Environment variables**.

### 4.1. Gerar segredos no terminal

Cole esse bloco num terminal local (ou no manager via SSH) — ele imprime um `.env` pronto:

```bash
{
  # === Hosts (ajuste pros seus domínios) ===
  echo "FRONTEND_HOST=bms-app.exemplo.ai"
  echo "CH_UI_HOST=ch-ui-bms.exemplo.ai"
  echo "FRONTEND_URL=https://bms-app.exemplo.ai"
  echo "CORS_ORIGINS=https://bms-app.exemplo.ai"

  # === Imagens / rede ===
  echo "IMAGE_REGISTRY=etusdigital"
  echo "IMAGE_TAG=latest"
  echo "TRAEFIK_NETWORK_NAME=bmsNet"

  # === Bootstrap admin (primeiro login) ===
  echo "BOOTSTRAP_ADMIN_EMAIL=admin@exemplo.com"
  echo "BOOTSTRAP_ADMIN_PASSWORD=$(openssl rand -base64 18)"

  # === Segredos gerados ===
  echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
  echo "RABBITMQ_USER=bms"
  echo "RABBITMQ_PASSWORD=$(openssl rand -base64 24)"
  echo "CLICKHOUSE_PASSWORD=$(openssl rand -base64 24)"
  echo "MINIO_ROOT_USER=bmsadmin"
  echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 24)"
  echo "JWT_SECRET=$(openssl rand -base64 48)"
  echo "CRON_SECRET=$(openssl rand -base64 32)"
  echo "INTERNAL_AUTH_TOKEN=$(openssl rand -base64 32)"
  echo "CH_UI_SECRET_KEY=$(openssl rand -base64 32)"
  echo "ENTERPRISE_IMPORT_ENCRYPTION_KEY=$(openssl rand -base64 32)"
}
```

### 4.2. ⚠️ Guardar os segredos antes de continuar

**Antes** de prosseguir, copie a saída do bloco acima e **guarde num cofre** (1Password, Bitwarden, Vault, etc).

**Crítico**: `ENTERPRISE_IMPORT_ENCRYPTION_KEY` cifra a API key do Enterprise no banco. **Se perder essa chave, dados cifrados ficam ilegíveis** — não dá pra recuperar nem importar de novo sem regerar tudo. Trate como senha do banco.

### 4.3. Lista de referência (todas as envs)

| Nome                               | Como obter                                                 | Obrigatória?               |
| ---------------------------------- | ---------------------------------------------------------- | -------------------------- |
| `FRONTEND_HOST`                    | seu domínio do app, ex.: `bms-app.exemplo.ai`              | ✅                         |
| `CH_UI_HOST`                       | seu domínio do ch-ui, ex.: `ch-ui-bms.exemplo.ai`          | ✅                         |
| `FRONTEND_URL`                     | `https://${FRONTEND_HOST}`                                 | ✅                         |
| `CORS_ORIGINS`                     | `https://${FRONTEND_HOST}` (vírgula-separado se múltiplos) | ✅                         |
| `IMAGE_REGISTRY`                   | org no Docker Hub                                          | ✅ (default `etusdigital`) |
| `IMAGE_TAG`                        | tag das imagens (`latest` ou sha7)                         | ✅                         |
| `TRAEFIK_NETWORK_NAME`             | nome da rede overlay externa                               | ✅ (default `bmsNet`)      |
| `POSTGRES_PASSWORD`                | `openssl rand -base64 24`                                  | ✅                         |
| `RABBITMQ_USER`                    | qualquer string                                            | ✅ (default `bms`)         |
| `RABBITMQ_PASSWORD`                | `openssl rand -base64 24`                                  | ✅                         |
| `CLICKHOUSE_PASSWORD`              | `openssl rand -base64 24`                                  | ✅                         |
| `MINIO_ROOT_USER`                  | qualquer string                                            | ✅ (default `bmsadmin`)    |
| `MINIO_ROOT_PASSWORD`              | `openssl rand -base64 24`                                  | ✅                         |
| `JWT_SECRET`                       | `openssl rand -base64 48`                                  | ✅                         |
| `CRON_SECRET`                      | `openssl rand -base64 32`                                  | ✅                         |
| `INTERNAL_AUTH_TOKEN`              | `openssl rand -base64 32`                                  | ✅                         |
| `CH_UI_SECRET_KEY`                 | `openssl rand -base64 32`                                  | ✅                         |
| `ENTERPRISE_IMPORT_ENCRYPTION_KEY` | `openssl rand -base64 32` (AES-256)                        | ✅                         |
| `BOOTSTRAP_ADMIN_EMAIL`            | email do primeiro super-admin                              | ✅                         |
| `BOOTSTRAP_ADMIN_PASSWORD`         | `openssl rand -base64 18`                                  | ✅                         |

**WhatsApp Cloud (Meta direta + EvoHub)** — todas opcionais no boot. As credenciais reais
(APP_ID, APP_SECRET, HUB_API_KEY etc.) são configuradas pela UI **depois** do deploy em
Super Admin → Integrações → WhatsApp (Meta App) e WhatsApp (EvoHub). O backend lê primeiro
do `system_config` (DB) e cai pra env só como fallback. Guia operacional completo:
[`docs/operations/whatsapp-cloud.md`](../../docs/operations/whatsapp-cloud.md).

| Nome                           | Como obter                                        | Obrigatória?                    |
| ------------------------------ | ------------------------------------------------- | ------------------------------- |
| `WHATSAPP_PROVIDER`            | `cloud` ou `twilio`                               | default `cloud`                 |
| `WHATSAPP_GRAPH_VERSION`       | versão da Graph API Meta                          | default `v18.0`                 |
| `BMS_PUBLIC_URL`               | URL pública do webhook                            | default `${FRONTEND_URL}`       |
| `EVOLUTION_HUB_ENABLED`        | `true` se for usar EvoHub no lugar do Meta direto | default `false`                 |
| `EVOLUTION_HUB_URL`            | base URL do Hub                                   | default `https://api.evohub.ai` |
| `WHATSAPP_APP_ID`              | Meta App ID — preencher pela UI                   | ❌ (UI)                         |
| `WHATSAPP_APP_SECRET`          | Meta App Secret — preencher pela UI               | ❌ (UI)                         |
| `WHATSAPP_CONFIG_ID`           | Embedded Signup Config ID — preencher pela UI     | ❌ (UI)                         |
| `WHATSAPP_VERIFY_TOKEN`        | Token GET webhook Meta — preencher pela UI        | ❌ (UI)                         |
| `EVOLUTION_HUB_API_KEY`        | Bearer tenant no Hub — preencher pela UI          | ❌ (UI)                         |
| `EVOLUTION_HUB_WEBHOOK_SECRET` | HMAC-SHA256 Hub ↔ BMS — preencher pela UI         | ❌ (UI)                         |

Veja [`infra/swarm/secrets.env.example`](./secrets.env.example) pro template comentado.

---

## 5. Deploy do stack BMS

### 5.1. Criar stack no Portainer

**Portainer → Stacks → Add stack**:

- **Name**: `bms`
- **Build method**: Web editor
- **Web editor**: cola o conteúdo de [`infra/swarm/stack.bms.yml`](./stack.bms.yml)

### 5.2. Setar Environment variables

Na seção **Environment variables**:

- Clica **+ Add an environment variable** pra cada variável da §4.3
- OU clica **Load variables from .env file** e seleciona o `.env` que você gerou em §4.1

### 5.3. Deploy

Clica **Deploy the stack**.

Aguarda ~2 minutos pro pull das imagens e startup dos serviços.

---

## 6. Verificação pós-deploy

### 6.1. Todos os serviços rodando

**Portainer → Stacks → bms → Services**:

Todos devem estar `1/1` exceto:

- `bms_bms-config-init` → `0/1` (one-shot, rodou e saiu — normal)
- `bms_minio-bootstrap` → `0/1` (one-shot, rodou e saiu — normal)

Ou via CLI:

```bash
docker stack services bms
```

### 6.2. Frontend acessível

```bash
curl -sk -o /dev/null -w "HTTP=%{http_code}\n" https://${FRONTEND_HOST}/
# Esperado: HTTP=200
```

### 6.3. API roteada via Traefik

```bash
curl -sk -X POST https://${FRONTEND_HOST}/api/users \
  -H "Content-Type: application/json" \
  -H "Origin: https://${FRONTEND_HOST}" \
  -d '{"name":"x","email":"x@x.com","password":"x"}' \
  -w "\nHTTP=%{http_code}\n"
# Esperado: HTTP=401 (rota chega no msgops-api, ele rejeita sem token JWT)
```

Se HTTP=504 → ver [§8.3](#83-post-apiaccountsimport-ou-qualquer-endpoint-longo-dá-504).

### 6.4. ClickHouse com todas as tabelas

```bash
docker exec $(docker ps -q -f name=bms_clickhouse | head -1) \
  clickhouse-client --user default --password "$CLICKHOUSE_PASSWORD" \
  -q "SELECT name FROM system.tables WHERE database='BMS'"
```

Esperado (5 tabelas):

```
events_logs_v2
events_queue
mv_email_hourly
mv_events_to_logs
tb_email_hourly_stats
```

Se faltar `events_queue` / `mv_events_to_logs` → ver [§8.8](#88-clickhouse-criou-só-events_logs_v2-mas-não-events_queue-→-activity-feed-vazio).

### 6.5. RabbitMQ com filas + consumers

```bash
docker exec $(docker ps -q -f name=bms_rabbitmq | head -1) \
  rabbitmqctl list_queues name messages_ready consumers
```

Todas as filas (`send-email.*`, `event-process.*`, etc) devem ter consumer = 1.

---

## 7. Setup inicial pela UI

### 7.1. Wizard de configuração

Acessa `https://${FRONTEND_HOST}/setup` no browser. O wizard:

1. Cria o **super-admin inicial** (usa `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`).
2. Configura GeoIP (pode pular — preencher depois em Super Admin → GeoIP).
3. Configura S3/MinIO (já vem configurado pelas envs).

### 7.2. Configurar provider de email (SendGrid)

**Super Admin → Integrações → SendGrid**:

- **API key**: cole sua key do SendGrid (começa com `SG.`)
- **Webhook URL**: `https://${FRONTEND_HOST}/bms/events?platform=sendgrid&account=1`

No SendGrid console:

- Configura o webhook URL acima na seção **Mail Settings → Event Webhook**
- Marca todos os eventos (delivered, open, click, bounce, dropped, spam_report, unsubscribe)

### 7.3. Popular GeoIP (opcional)

O service `geolocation` precisa do arquivo `dbip-city-lite.mmdb`. Pra popular o volume:

```bash
docker cp /caminho/dbip-city-lite.mmdb \
  $(docker ps -q -f name=bms_geolocation):/data/geo/
```

Baixe o `dbip-city-lite.mmdb` mais recente em https://db-ip.com/db/lite.

### 7.4. Configurar WhatsApp (Meta direta ou EvoHub)

Diferente das envs comuns, as credenciais do WhatsApp são salvas pela UI no banco
(`system_config`) — você **não** preenche no stack. Após o boot:

1. Logue como super-admin → **Integrações** → **WhatsApp (Meta App)**.
2. Preencha `App ID`, `App Secret`, `Config ID` e `Verify Token` do seu Meta App.
3. Configure o webhook na Meta Developer Console apontando para `https://${FRONTEND_HOST}/api/webhooks/meta` e use o mesmo `Verify Token` que setou aqui.
4. Salve. Toggle `WHATSAPP_PROVIDER` (em system_config) já está `cloud` por default — não precisa mexer.

**Para usar EvoHub no lugar do Meta direto** (clientes que não querem Meta App próprio):

1. Em **Integrações** → **WhatsApp (EvoHub)** habilite "Modo EvoHub".
2. Preencha `API Key` e `Webhook Secret` da sua conta no EvoHub.
3. Cada conta tenant pode então em **Configurações** → **WhatsApp** clicar **Conectar via EvoHub** para o Embedded Signup OU **Usar canal existente** para anexar a um canal já conectado.

Guia operacional completo (troubleshoot, signature mismatch, BMS_PUBLIC_URL split, etc.):
[`docs/operations/whatsapp-cloud.md`](../../docs/operations/whatsapp-cloud.md).

---

## 8. Troubleshooting

### 8.1. Portainer dá erro 500 ao fazer Update do stack

Mensagem típica:

```
invalid interpolation format for x-backend-env.X:
required variable X is missing a value: must set X
```

**Causa**: alguma env `${VAR:?must set ...}` do stack file não está nas Environment variables do Portainer Stack.

**Fix**:

1. Portainer → Stacks → bms → Editor
2. Rola até **Environment variables**
3. Adiciona TODAS as envs obrigatórias da [§4.3](#43-lista-de-referência-todas-as-envs)
4. Update the stack

### 8.2. Traefik logs cheios de "port is missing"

```
ERR error="service \"X\" error: port is missing" providerName=swarm
```

**Causa**: Traefik v3 com 2 providers ativos ao mesmo tempo (`--providers.swarm` E `--providers.docker.endpoint=...`). Na v3 são providers **separados** (na v2 eram fundidos). Manter os dois faz o `docker` tentar descobrir portas em services Swarm que não declaram, gritando errors em loop.

**Fix**: usar **apenas** `--providers.swarm.*`. Substitua o stack do Traefik pelo [`infra/swarm/stack.traefik.yml`](./stack.traefik.yml) deste repo.

### 8.3. POST `/api/accounts/import` (ou qualquer endpoint longo) dá 504

**Causa antiga**: nginx do frontend-react com `proxy_read_timeout 60s` matava requests longas (import enterprise leva minutos).

**Fix neste stack**: msgops-api tem rota Traefik direta (`bms-api` router com `StripPrefix /api`), sem passar pelo nginx. O timeout vem do Traefik websecure (600s).

Se ainda der 504:

1. Confere que o `stack.traefik.yml` tem os flags de `respondingTimeouts.readTimeout=600s` etc (§3.3).
2. Confere que o stack do BMS tem o service `msgops-api` com as labels `traefik.http.routers.bms-api.*`.
3. Confere os logs do msgops-api — pode ser que a operação interna esteja travada (DB lock, chamada externa pendurada).

### 8.4. POST `/api/accounts/import` dá 404

**Causa**: `ENTERPRISE_IMPORT_ENABLED` não está `true` no env do msgops-api.

Código relevante (`apps/msgops-api/src/modules/enterprise-import/enterprise-import.guard.ts`):

```ts
if (process.env.ENTERPRISE_IMPORT_ENABLED === 'true') return true;
throw new NotFoundException();
```

**Fix**: o `stack.bms.yml` deste repo já tem `ENTERPRISE_IMPORT_ENABLED: 'true'` hardcoded no `x-backend-env`. Se você modificou e tirou, restaure.

### 8.5. Imagem `bms-enterprise-import:latest` não existe no Docker Hub

**Workaround**: buildar local no manager.

```bash
# do dev machine, mande o código:
tar czf /tmp/bms-eimport.tar.gz \
  --exclude='node_modules' --exclude='dist' --exclude='.git' \
  package.json pnpm-workspace.yaml pnpm-lock.yaml apps/enterprise-import
scp /tmp/bms-eimport.tar.gz manager:/tmp/

# no manager:
ssh manager
mkdir -p /tmp/bms-eimport-build && cd /tmp/bms-eimport-build
tar xzf /tmp/bms-eimport.tar.gz
docker build -f apps/enterprise-import/Dockerfile \
  -t etusdigital/bms-enterprise-import:latest .

# deploy o stack com --resolve-image=never pra usar a imagem local:
docker stack deploy --resolve-image=never -c stack.bms.yml bms
```

Via Portainer: marque **NÃO sempre puxar imagem** ao deployar.

**Fix permanente**: adicionar `bms-enterprise-import` ao pipeline de CI/CD que publica as outras imagens.

### 8.6. Job de import fica `status=pending` pra sempre

**Causa**: service `bms_enterprise-import` não está rodando. Sem worker, ninguém consome a fila BullMQ.

**Fix**: confira que o stack tem o service `enterprise-import` (o `stack.bms.yml` deste repo já inclui).

```bash
docker service ps bms_enterprise-import
```

Se REPLICAS = 0/1 e ERROR = "No such image" → ver §8.5.

### 8.7. Service `geolocation` em crash loop

```
invalid mount config for type "bind":
bind source path does not exist: /opt/bms-staging/data/geo
```

**Causa**: stack antigo usava bind mount de path do host (`/opt/bms-staging/data/geo`) que não existia.

**Fix neste stack**: já usa volume nomeado `geo-data` (não depende de path no host). Pra popular o `dbip-city-lite.mmdb` ver §7.3.

### 8.8. ClickHouse criou só `events_logs_v2` mas não `events_queue` → Activity Feed vazio

**Causa**: init scripts do ClickHouse só rodam quando data dir está **vazio**. Se o stack subiu uma vez com Config errado e depois você corrigiu, o script não roda no restart.

**Fix manual** (idempotente — usa `CREATE IF NOT EXISTS`):

```bash
docker exec \
  -e RABBITMQ_HOST_PORT=rabbitmq:5672 \
  -e RABBITMQ_USER="$RABBITMQ_USER" \
  -e RABBITMQ_PASSWORD="$RABBITMQ_PASSWORD" \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD="$CLICKHOUSE_PASSWORD" \
  $(docker ps -q -f name=bms_clickhouse | head -1) \
  /docker-entrypoint-initdb.d/02-events-rabbitmq.sh
```

Confere:

```bash
docker exec $(docker ps -q -f name=bms_clickhouse | head -1) \
  clickhouse-client --user default --password "$CLICKHOUSE_PASSWORD" \
  -q "SELECT name FROM system.tables WHERE database='BMS'"
```

Devem aparecer todas as 5 tabelas (ver §6.4).

### 8.9. POST `/api/accounts/import` retorna 500 com "ENTERPRISE_IMPORT_ENCRYPTION_KEY not set"

**Fix**: gerar key (`openssl rand -base64 32`) e adicionar nas Environment variables do Portainer Stack como `ENTERPRISE_IMPORT_ENCRYPTION_KEY`. Update the stack.

### 8.10. Bounce ≈100% após import do Enterprise

**Não é problema deste deploy.** Ver issue [EVO-1464](https://linear.app/evoai/issue/EVO-1464). A API do Enterprise (`bms-api.bri.us`) retorna emails mascarados (`lucas***@gmail.com`) no endpoint `GET /contacts`, e o worker `enterprise-import` grava esse valor literal no Postgres. Quando o `send-email` dispara, o servidor SMTP remoto rejeita o "endereço" com `User unknown` → bounce.

**Mitigação imediata**: pausar campanhas que usem contatos importados:

```sql
UPDATE contacts SET is_active = false WHERE email LIKE '%***%';
```

**Fix de longo prazo**: depende do time do Enterprise (closed source) expor endpoint admin que retorne email cru. Ver EVO-1464.

### 8.11. Segmentos ficam com Total = 0 após salvar

Ver issue [EVO-1463](https://linear.app/evoai/issue/EVO-1463). Bug do segment builder no frontend — campos `Email válido` e `Canais de comunicação` não persistem o default. Workaround: editar o segmento e clicar **explicitamente** no dropdown VALOR antes de salvar.

### 8.12. POST `/api/messages` em WhatsApp retorna 412 "BMS_PUBLIC_URL env is not set"

Quando você tenta conectar um canal EvoHub (`POST /accounts/:id/whatsapp-channels`) ou anexar a um existente, o backend precisa saber a URL pública que o Hub vai chamar de volta com webhooks.

**Fix**: setar `BMS_PUBLIC_URL` nas envs do stack. Default herda de `FRONTEND_URL`. Se você está num cenário split (webhook num subdomínio dedicado), seta explícito (ex: `https://webhooks.bms.exemplo.ai`). Update the stack.

### 8.13. Webhook EvoHub chega como `evohub_webhook_event kind=unknown`

Significa que o payload não tem `event` (ciclo de vida) nem `object: whatsapp_business_account` (event Meta encaminhado). Provavelmente um payload novo que o Hub começou a mandar. Olha o log seguinte `evohub_webhook_event_unrecognised body=...` pra ver o shape e abre uma issue.

### 8.14. Campanha WhatsApp dispara mas `Contacts: 0` no log do campaign-packer

`contacts.has_whatsapp = false` para todos os contatos. Bases migradas de Evolution não tinham essa coluna populada — a migration `1781200000000-backfill-has-whatsapp-from-has-phone.ts` faz UPDATE one-shot, mas só corre uma vez.

**Fix**: confirma que a migration rodou:

```bash
docker exec -it $(docker ps -q -f name=bms_postgres) psql -U postgres -d msgops -c \
  "SELECT name FROM migrations WHERE name LIKE '%has_whatsapp%';"
```

Se não houver, sobe o `msgops-api` para forçar o `TYPEORM_MIGRATIONS_RUN=true`. Contatos novos via API/CSV já saem com `has_whatsapp=true` automaticamente (hook `BeforeInsert`).

---

## 9. Operação corrente

### 9.1. Logs

Via Portainer → Services → click no service → **Service logs**.

Via CLI:

```bash
docker service logs -f bms_msgops-api --tail 50 --no-task-ids
docker service logs -f bms_enterprise-import --tail 50 --no-task-ids
docker service logs -f bms_send-email --tail 50 --no-task-ids
```

### 9.2. Reiniciar um service

Via Portainer → Services → click no service → **Force update the service**.

Via CLI:

```bash
docker service update --force bms_msgops-api
```

### 9.3. Atualizar uma env sem subir stack inteiro

```bash
docker service update --env-add NOVA_VAR=valor bms_msgops-api
```

⚠️ A próxima vez que rodar `docker stack deploy` (ou Update no Portainer), a env é **removida** se não estiver no YAML ou nas Environment variables do stack. Sempre adicione no stack pra persistir.

### 9.4. Rotação de senha

Trocar `POSTGRES_PASSWORD` ou `JWT_SECRET` requer reiniciar **todos** os apps que usam a env. O stack inteiro reinicia automaticamente quando você atualiza a env via Portainer.

⚠️ **Rotar `ENTERPRISE_IMPORT_ENCRYPTION_KEY`** torna **ilegíveis** as API keys do Enterprise já cifradas no banco. Re-importar do zero é o único caminho. Não faça em produção sem plano.

### 9.5. Rollback do stack

```bash
docker stack rm bms
# volumes persistem; pra apagar TUDO (cuidado):
# docker volume rm $(docker volume ls -q | grep ^bms_)
```

Via Portainer → Stacks → bms → **Remove this stack** (oferece checkbox pra remover volumes).

### 9.6. Backups

- **Postgres** (`bms_postgres-data`): use `pg_dump` ou Restic com o volume.
- **ClickHouse** (`bms_clickhouse-data`): `BACKUP DATABASE BMS TO Disk(...)` ou snapshot do volume.
- **MinIO** (`bms_minio-data`): replicate pra S3 externo via `mc mirror` ou snapshot.
- **bms-config** (`bms_bms-config`): contém configs cifradas — backup com o resto.

---

## Issues relacionadas

- [EVO-1463](https://linear.app/evoai/issue/EVO-1463) — bug do segment builder (frontend).
- [EVO-1464](https://linear.app/evoai/issue/EVO-1464) — bug crítico do mascaramento de email no Enterprise.
- [EVO-1465](https://linear.app/evoai/issue/EVO-1465) — esta documentação.
