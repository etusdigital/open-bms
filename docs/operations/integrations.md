# Integrações (UI super_admin)

A partir de **EVO-1034**, as credenciais sistema-wide das integrações abaixo deixam de ser configuradas via `.env` e passam a ser gerenciadas exclusivamente pela UI super_admin em `/super-admin/integrations`:

| Provider                 | Tab UI             | Key em `system_config`     | Arquivo gerado               | Consumidores                 |
| ------------------------ | ------------------ | -------------------------- | ---------------------------- | ---------------------------- |
| SendGrid (system)        | SendGrid (sistema) | `sendgrid_system_settings` | `/data/config/sendgrid.env`  | `msgops-api`, `send-email`   |
| S3 / Cloud Storage       | S3                 | `s3_settings`              | `/data/config/s3.env`        | `msgops-api`, `send-email`   |
| Firebase Cloud Messaging | FCM                | `fcm_settings`             | `/data/config/fcm.env`       | `send-push`                  |
| Emailable                | Emailable          | `emailable_settings`       | `/data/config/emailable.env` | `email-validation`           |
| GeoIP                    | GeoIP              | `geoip_settings`           | `/data/config/geoip.env`     | `geolocation` (gRPC sidecar) |

> **SendGrid account-scoped** (chave por conta) continua em `/settings → SendGrid` — não muda nesta entrega.
> **GeoIP** continua usando o fluxo gRPC + cron de download; apenas a UI foi movida para a nova seção.

## Arquitetura

1. Super-admin abre `/super-admin/integrations`, escolhe a sub-tab e salva.
2. `msgops-api` persiste em `system_config` (JSONB plaintext) e:
   - **Para consumidores in-process (msgops-api):** invalida o cache Redis `system_config:<key>` (TTL 60s). A próxima leitura via `SystemConfigCacheProvider` usa o valor novo. _Hot-reload sem restart._
   - **Para workers separados:** escreve idempotentemente o arquivo `/data/config/<provider>.env` no volume `bms-config`. Workers carregam via `dotenv.config({ path, override: true })` no `main.ts`. **Restart do worker é necessário** para aplicar mudanças.
3. No boot do msgops-api, cada `Admin*Service.onModuleInit` reidrata o arquivo `.env` correspondente a partir do DB se ele estiver ausente (cobre cenário de volume recriado).

## Volume `bms-config`

- Definido em `docker-compose.yml`.
- `bms-config-init` (alpine, root) faz `chown 1001:1001 /data/config` antes de qualquer serviço com permissão de escrita subir.
- Mount: `rw` no `msgops-api`, `ro` em `geolocation`, `geolocation-refresh`, `send-email`, `send-push`, `email-validation`.
- Variável de ambiente em todos esses containers: `BMS_CONFIG_DIR=/data/config`.

## Sequência de boot

`bms-config-init` → `msgops-api` (até `service_healthy`) → workers (`send-email`, `send-push`, `email-validation`, `geolocation`).

Os 4 workers declaram `depends_on: msgops-api: { condition: service_healthy }` — isso garante que `onModuleInit` rehydrate já rodou antes do boot dos workers.

## Procedimento de migração (instâncias existentes pré-EVO-1034)

1. Faça o upgrade do msgops-api (a tabela `system_config` já existe; nenhuma migration estrutural).
2. Acesse `/super-admin/integrations` como super-admin.
3. Para cada provider, preencha os campos. Use **Test connection** antes de salvar.
4. Após salvar, reinicie os workers que consomem o provider:
   - SendGrid → `docker compose restart send-email msgops-api`
   - S3 → `docker compose restart send-email msgops-api`
   - FCM → `docker compose restart send-push`
   - Emailable → `docker compose restart email-validation`
5. Remova as variáveis legadas dos `.env` locais (`apps/<worker>/.env`) — elas serão sobrescritas pelo arquivo do volume, mas mantê-las pode confundir operadores.

## Comportamento sem configuração

- **msgops-api:** endpoints que precisam de S3 ou SendGrid system retornam `503 Service Unavailable` com mensagem orientando configurar via UI.
- **Workers:** falham no boot se o arquivo `<provider>.env` não existe E o `system_config` está vazio (preconditon: msgops-api precisa rodar antes para gerar os arquivos).

## Mascaramento e segurança

- Endpoints `GET /admin/integrations/<provider>/settings` retornam apenas valores mascarados (`abc***xyz`) para credenciais.
- Apenas super_admin pode acessar (decorator `@RequireSuperAdmin()` + `PermissionGuard` global).
- Rate-limit nos endpoints `test-connection`: 5 requests/minuto/IP por provider.
- Valores em `system_config.value` (JSONB) ficam **plaintext**. Acesso ao DB já é restrito por roles do Postgres. Envelope encryption (KMS) está fora do escopo de v0.1.

## Riscos conhecidos

- Race condition de boot é mitigada pelo `depends_on: service_healthy`. Em ambientes não-compose (k8s), garanta a mesma ordem com initContainers/probes.
- Hot-reload no msgops-api é per-instância (sem pub/sub cross-replica). Em deployments multi-replica, a janela máxima de inconsistência é o TTL do cache (60s).

## Referências

- ADR do padrão DB+arquivo: `docs/plans/2026-04-30-adr-geo-grpc-architecture.md`.
- Tech-spec EVO-1034: `_evo-output/implementation-artifacts/evo-1034-credenciais-integracoes/tech-spec-evo-1034-credenciais-integracoes.md`.
