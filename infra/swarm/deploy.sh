#!/usr/bin/env bash
# Deploy / atualiza o stack do BMS Open Source no manager (alternativa CLI ao
# Portainer — pro fluxo Portainer ver infra/swarm/DEPLOY.md).
#
# Carrega segredos de $ENV_FILE (default /opt/bms/.env) e chama
# `docker stack deploy`. Idempotente — pode ser executado várias vezes
# pra atualizar tags de imagem ou envs.
#
# Pré-requisitos no manager:
#   - $ENV_FILE populado (ver secrets.env.example nesta pasta)
#   - Swarm configs ClickHouse criados (ver infra/swarm/DEPLOY.md §2)
#   - Rede overlay externa criada (ex: docker network create --driver overlay --attachable bmsNet)
#   - `docker login` feito com credenciais que enxergam $IMAGE_REGISTRY/bms-*
#
# Uso (a partir de uma checkout do repo no manager):
#   sudo bash infra/swarm/deploy.sh
#
# Ou remoto, do laptop:
#   DOCKER_HOST=ssh://evolution_manager bash infra/swarm/deploy.sh
#
# Override via env:
#   ENV_FILE=/caminho/.env STACK_NAME=bms-prod bash infra/swarm/deploy.sh

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/bms/.env}"
STACK_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/stack.bms.yml"
STACK_NAME="${STACK_NAME:-bms}"

if [[ ! -f "$STACK_FILE" ]]; then
  echo "ERRO: $STACK_FILE não encontrado." >&2
  exit 1
fi

# Quando rodando do laptop via DOCKER_HOST=ssh://<host>, o .env vive no
# manager — puxa via ssh pra um tmpfile local e usa-o. Quando rodando
# direto no manager, ENV_FILE local já existe e segue o fluxo normal.
if [[ ! -f "$ENV_FILE" ]] && [[ "${DOCKER_HOST:-}" == ssh://* ]]; then
  REMOTE_HOST="${DOCKER_HOST#ssh://}"
  echo "==> $ENV_FILE não existe localmente; puxando de $REMOTE_HOST via SSH"
  TMP_ENV="$(mktemp)"
  trap 'rm -f "$TMP_ENV"' EXIT
  ssh "$REMOTE_HOST" "cat $ENV_FILE" > "$TMP_ENV"
  ENV_FILE="$TMP_ENV"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não existe. Veja secrets.env.example nesta pasta." >&2
  exit 1
fi

# Carrega POSTGRES_PASSWORD, JWT_SECRET, IMAGE_TAG, etc. como vars de ambiente.
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${IMAGE_TAG:?defina IMAGE_TAG no $ENV_FILE (use a tag impressa por build-and-push.sh)}"

echo "==> Stack:    $STACK_NAME"
echo "==> Tag:      $IMAGE_TAG"
echo "==> Env file: $ENV_FILE"
echo

exec docker stack deploy \
  --with-registry-auth \
  -c "$STACK_FILE" \
  "$STACK_NAME"
