# `infra/swarm/` — Docker Swarm deploy

Arquivos pra deploy do BMS Open Source num cluster Docker Swarm (via Portainer ou CLI).

## Arquivos

| Arquivo | Pra quê |
|---|---|
| [`stack.bms.yml`](./stack.bms.yml) | Stack principal — todos os apps + infra (Postgres, Redis, RabbitMQ, MinIO, ClickHouse, ch-ui, msgops-api, frontend, workers). Header do arquivo tem instruções detalhadas. |
| [`stack.traefik.yml`](./stack.traefik.yml) | Stack do Traefik v3 (ingress controller) — necessário se você não tem Traefik rodando. Provider único `swarm` + timeouts 600s pra cobrir operações longas. |
| [`stack.bms-loadtest.yml`](./stack.bms-loadtest.yml) | Variante pra teste de carga (não use em produção). |
| [`secrets.env.example`](./secrets.env.example) | Template de envs com instruções de como gerar cada segredo (`openssl rand -base64 N`). Copie pra `.env` local ou cole no Portainer Stack. |
| [`build-and-push.sh`](./build-and-push.sh) | Script de build + push das imagens BMS pro Docker Hub. |
| [`deploy.sh`](./deploy.sh) | Script de deploy via CLI (alternativa ao Portainer). |

## Quick start

Guia completo passo-a-passo em [**`DEPLOY.md`**](./DEPLOY.md). Resumo:

1. **Pré-requisitos**: Docker Swarm + Portainer + DNS + rede overlay externa (`bmsNet`) + volume de certs Let's Encrypt.
2. **Criar 3 Swarm configs do ClickHouse** (Portainer → Configs → Add config) com conteúdo de `infra/clickhouse-init/*` e `infra/clickhouse-config/users.d/*`.
3. **Deploy do Traefik** com `stack.traefik.yml` (se ainda não tem).
4. **Gerar envs** com `openssl rand` (veja `secrets.env.example`).
5. **Deploy do stack BMS** com `stack.bms.yml` no Portainer (cola YAML + envs).
6. **Acessar** `https://${FRONTEND_HOST}/setup` pro wizard de configuração inicial.

## Issues relacionadas

- [EVO-1465](https://linear.app/evoai/issue/EVO-1465) — esta documentação.
- [EVO-1464](https://linear.app/evoai/issue/EVO-1464) — bug do mascaramento de email no Enterprise (afeta import).
- [EVO-1463](https://linear.app/evoai/issue/EVO-1463) — bug do segment builder (frontend).
