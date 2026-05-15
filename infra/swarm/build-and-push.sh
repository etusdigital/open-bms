#!/usr/bin/env bash
# Build & push BMS Open Source images for staging deploy.
#
# Builds 13 service images, tags them as
# evoapicloud/bms-<app>:bms-staging-<sha7>, also tags
# bms-staging-latest, and pushes both tags to Docker Hub.
#
# Pre-req: `docker login` already done with credentials that can push to
# the evoapicloud namespace.
#
# Usage (do repo root ou de qualquer cwd):
#   bash infra/swarm/build-and-push.sh
#   IMAGE_TAG=foo bash infra/swarm/build-and-push.sh   # tag custom
#   REGISTRY=other bash infra/swarm/build-and-push.sh  # outro registry
#
# Após terminar, deploy via:
#   bash infra/swarm/deploy.sh

set -euo pipefail

REGISTRY="${REGISTRY:-evoapicloud}"
SHA="$(git rev-parse --short=7 HEAD)"
TAG="${IMAGE_TAG:-bms-staging-${SHA}}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

APPS=(
  msgops-api
  frontend-react
  event-receiver
  event-process
  send-email
  campaign-packer
  campaign-events-tracker
  send-push
  send-whatsapp
  twilio-messaging
  tracker
  tag-process
  message-trigger
  geolocation
)

echo "==> Registry: $REGISTRY"
echo "==> Tag:      $TAG"
echo "==> Apps:     ${#APPS[@]}"
echo

for app in "${APPS[@]}"; do
  image_sha="${REGISTRY}/bms-${app}:${TAG}"
  image_latest="${REGISTRY}/bms-${app}:bms-staging-latest"
  echo "==> [build] $app"
  docker build \
    -f "apps/${app}/Dockerfile" \
    -t "$image_sha" \
    -t "$image_latest" \
    .
done

echo
for app in "${APPS[@]}"; do
  image_sha="${REGISTRY}/bms-${app}:${TAG}"
  image_latest="${REGISTRY}/bms-${app}:bms-staging-latest"
  echo "==> [push] $app"
  docker push "$image_sha"
  docker push "$image_latest"
done

echo
echo "==> Done."
echo "    export IMAGE_TAG=$TAG"
echo "    bash $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy.sh"
