#!/usr/bin/env bash
#
# Deploy the Turborepo remote cache server to Cloud Run.
#
# Prerequisites:
#   1. gcloud CLI authenticated (gcloud auth login)
#   2. GCS bucket created (see setup.sh)
#   3. Service account created with Storage Object Admin on the bucket
#
# Usage:
#   ./deploy.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — edit these to match your GCP project
# ---------------------------------------------------------------------------
GCP_PROJECT="${GCP_PROJECT:-etus-media-prod}"
GCP_REGION="${GCP_REGION:-us-east1}"
REGISTRY="${REGISTRY:-us-east1-docker.pkg.dev/etus-media-mgmt/msgops}"
SERVICE_NAME="turbo-cache"
IMAGE="${REGISTRY}/${SERVICE_NAME}"
GCS_BUCKET="${GCS_BUCKET:-etus-turbo-cache}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-turbo-cache@${GCP_PROJECT}.iam.gserviceaccount.com}"

# Generate a random token if TURBO_TOKEN is not set
TURBO_TOKEN="${TURBO_TOKEN:?Set TURBO_TOKEN env var (shared secret for turbo clients)}"

# ---------------------------------------------------------------------------
# Authenticate Docker with Artifact Registry
# ---------------------------------------------------------------------------
echo "Configuring Docker for Artifact Registry..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

# ---------------------------------------------------------------------------
# Build & push
# ---------------------------------------------------------------------------
echo "Building image (linux/amd64 for Cloud Run)..."
docker build --platform linux/amd64 -t "${IMAGE}:latest" .

echo "Pushing image..."
docker push "${IMAGE}:latest"

# ---------------------------------------------------------------------------
# Deploy to Cloud Run
# ---------------------------------------------------------------------------
echo "Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --project="${GCP_PROJECT}" \
  --region="${GCP_REGION}" \
  --image="${IMAGE}:latest" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=2 \
  --service-account="${SERVICE_ACCOUNT}" \
  --set-env-vars="STORAGE_PROVIDER=google-cloud-storage,STORAGE_PATH=${GCS_BUCKET},TURBO_TOKEN=${TURBO_TOKEN},NODE_ENV=production"

# ---------------------------------------------------------------------------
# Print the service URL
# ---------------------------------------------------------------------------
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${GCP_PROJECT}" \
  --region="${GCP_REGION}" \
  --format='value(status.url)')

echo ""
echo "============================================"
echo "Turbo remote cache deployed!"
echo "URL: ${SERVICE_URL}"
echo ""
echo "Add these to GitHub Actions secrets:"
echo "  TURBO_API_URL = ${SERVICE_URL}"
echo "  TURBO_TOKEN   = ${TURBO_TOKEN}"
echo ""
echo "For local dev, run:"
echo "  npx turbo login --api=${SERVICE_URL} --token=\$TURBO_TOKEN"
echo "  or set in .turbo/config.json (see setup.sh output)"
echo "============================================"
