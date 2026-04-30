#!/bin/bash
set -e

DEST="${GEO_DB_PATH:-./data/geo/dbip-city-lite.mmdb}"
DEST_DIR="$(dirname "$DEST")"
YEAR=$(date +%Y)
MONTH=$(date +%m)
URL="https://download.db-ip.com/free/dbip-city-lite-${YEAR}-${MONTH}.mmdb.gz"
TMP_GZ="${DEST_DIR}/dbip-city-lite.mmdb.gz"

echo "[download-geodb] Downloading DB-IP Lite City MMDB for ${YEAR}-${MONTH}..."
mkdir -p "$DEST_DIR"

if ! curl -f -L -o "$TMP_GZ" "$URL"; then
  echo "[download-geodb] ERROR: Failed to download $URL" >&2
  exit 1
fi

echo "[download-geodb] Decompressing..."
gunzip -f "$TMP_GZ"
mv "${DEST_DIR}/dbip-city-lite.mmdb" "$DEST"

echo "[download-geodb] Done. MMDB saved to $DEST"
echo "[download-geodb] Attribution: IP geolocation by DB-IP.com (CC-BY 4.0)"
