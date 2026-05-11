#!/usr/bin/env bash
# Build, push e deploya o stack bms-staging em um único comando.
#
# Uso (do repo root):
#   bash scripts/staging-deploy.sh
#   SKIP_BUILD=1 bash scripts/staging-deploy.sh   # só deploy, sem rebuild
#   MANAGER=other-host bash scripts/staging-deploy.sh
#
# Pré-requisitos:
#   - docker login feito com credenciais do evoapicloud
#   - SSH configurado para o alias `evolution_manager` (ou definir MANAGER=<host>)

set -euo pipefail

SWARM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../_evo-output/implementation-artifacts/evo-1026/swarm" && pwd)"
MANAGER="${MANAGER:-evolution_manager}"
REGISTRY="${REGISTRY:-evoapicloud}"
SHA="$(git rev-parse --short=7 HEAD)"
TAG="${IMAGE_TAG:-bms-staging-${SHA}}"
ENV_FILE="/opt/bms-staging/.env"

echo "==> Staging deploy"
echo "    Tag:     $TAG"
echo "    Manager: $MANAGER"
echo

# 1. Build e push (pode ser pulado com SKIP_BUILD=1)
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  IMAGE_TAG="$TAG" REGISTRY="$REGISTRY" bash "$SWARM_DIR/build-and-push.sh"
else
  echo "==> [skip] build (SKIP_BUILD=1)"
fi

# 2. Atualiza IMAGE_TAG no .env do manager
echo
echo "==> Atualizando IMAGE_TAG no manager ($MANAGER:$ENV_FILE)"
ssh "$MANAGER" "sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=${TAG}/' $ENV_FILE"

# 3. Deploy via DOCKER_HOST ssh
echo "==> Deploy stack"
DOCKER_HOST="ssh://$MANAGER" bash "$SWARM_DIR/deploy.sh"

echo
echo "==> Pronto! Stack atualizado para $TAG"
