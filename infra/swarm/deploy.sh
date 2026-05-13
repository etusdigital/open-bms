#!/usr/bin/env bash
# Deploy / atualiza o stack `bms-staging` no manager.
#
# Carrega segredos de /opt/bms-staging/.env (no manager) e chama
# `docker stack deploy`. Idempotente — pode ser executado várias vezes
# pra atualizar tags de imagem ou envs.
#
# Pré-requisitos no manager:
#   - /opt/bms-staging/.env populado (ver secrets.env.example nesta pasta)
#   - /opt/bms-staging/data/geo/dbip-city-lite.mmdb presente
#   - `docker login` feito com credenciais que enxergam evoapicloud/bms-*
#
# Uso (a partir de uma checkout do repo no manager):
#   sudo bash _evo-output/implementation-artifacts/evo-1026/swarm/deploy.sh
#
# Ou remoto, do laptop:
#   DOCKER_HOST=ssh://evolution_manager bash _evo-output/.../swarm/deploy.sh

set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/bms-staging/.env}"
STACK_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/stack.bms-staging.yml"
STACK_NAME="${STACK_NAME:-bms-staging}"

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
