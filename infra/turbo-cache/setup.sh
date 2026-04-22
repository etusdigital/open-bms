#!/usr/bin/env bash
#
# One-time GCP setup for the Turborepo remote cache.
#
# This script:
#   1. Creates a GCS bucket for cache artifacts
#   2. Creates a service account with minimal permissions
#   3. Generates a TURBO_TOKEN
#   4. Prints next steps
#
# Usage:
#   ./setup.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
GCP_PROJECT="${GCP_PROJECT:?Set GCP_PROJECT env var (GCP project ID to host the cache)}"
GCP_REGION="${GCP_REGION:-us-east1}"
GCS_BUCKET="${GCS_BUCKET:-bms-turbo-cache}"
SERVICE_ACCOUNT_NAME="turbo-cache"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com"

echo "=== Turborepo Remote Cache — GCP Setup ==="
echo "Project:         ${GCP_PROJECT}"
echo "Region:          ${GCP_REGION}"
echo "Bucket:          ${GCS_BUCKET}"
echo "Service Account: ${SERVICE_ACCOUNT}"
echo ""

# ---------------------------------------------------------------------------
# 1. Create GCS bucket
# ---------------------------------------------------------------------------
echo "1. Creating GCS bucket..."
if gsutil ls -b "gs://${GCS_BUCKET}" &>/dev/null; then
  echo "   Bucket gs://${GCS_BUCKET} already exists, skipping."
else
  gsutil mb -p "${GCP_PROJECT}" -l "${GCP_REGION}" "gs://${GCS_BUCKET}"
  echo "   Created gs://${GCS_BUCKET}"
fi

# Set lifecycle rule: delete cache artifacts after 30 days
echo "   Setting 30-day lifecycle rule..."
cat <<'LIFECYCLE' > /tmp/turbo-cache-lifecycle.json
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 30 }
    }
  ]
}
LIFECYCLE
gsutil lifecycle set /tmp/turbo-cache-lifecycle.json "gs://${GCS_BUCKET}"
rm /tmp/turbo-cache-lifecycle.json
echo "   Lifecycle rule set (artifacts expire after 30 days)."

# ---------------------------------------------------------------------------
# 2. Create service account
# ---------------------------------------------------------------------------
echo ""
echo "2. Creating service account..."
if gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" --project="${GCP_PROJECT}" &>/dev/null; then
  echo "   Service account ${SERVICE_ACCOUNT} already exists, skipping."
else
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --project="${GCP_PROJECT}" \
    --display-name="Turborepo Remote Cache"
  echo "   Created ${SERVICE_ACCOUNT}"
fi

# Grant Storage Object Admin on the bucket only (least privilege)
echo "   Granting Storage Object Admin on bucket..."
gsutil iam ch "serviceAccount:${SERVICE_ACCOUNT}:roles/storage.objectAdmin" "gs://${GCS_BUCKET}"
echo "   Permission granted."

# ---------------------------------------------------------------------------
# 3. Generate TURBO_TOKEN
# ---------------------------------------------------------------------------
echo ""
echo "3. Generating TURBO_TOKEN..."
TURBO_TOKEN=$(openssl rand -hex 32)
echo "   Token generated."

# ---------------------------------------------------------------------------
# 4. Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "GCP setup complete!"
echo ""
echo "TURBO_TOKEN=${TURBO_TOKEN}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Save the token as a GitHub Actions secret:"
echo "     gh secret set TURBO_TOKEN --body '${TURBO_TOKEN}'"
echo ""
echo "  2. Deploy the cache server:"
echo "     cd infra/turbo-cache"
echo "     TURBO_TOKEN='${TURBO_TOKEN}' ./deploy.sh"
echo ""
echo "  3. After deploy, set the API URL secret:"
echo "     gh secret set TURBO_API_URL --body '<url-from-deploy-output>'"
echo ""
echo "  4. For local dev, each developer runs:"
echo "     # From the repo root:"
echo "     mkdir -p .turbo"
echo "     echo '{\"apiurl\": \"<url-from-deploy-output>\", \"teamid\": \"team_bms\", \"token\": \"${TURBO_TOKEN}\"}' > .turbo/config.json"
echo ""
echo "============================================"
