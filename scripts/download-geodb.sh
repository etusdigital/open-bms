#!/bin/bash
# Refreshes the GeoIP MMDB used by apps/geolocation.
#
# Pipeline: download -> stage to ${DEST}.tmp -> validate (size + fixtures) ->
#           atomic mv -> bump mtime so apps/geolocation file watcher reloads.
# On any failure, the previous ${DEST} stays in place (no partial overwrite).
#
# Tiers (selected via GEO_TIER):
#   lite     — DB-IP Lite City, public mirror, no auth (default)
#   full     — DB-IP Full subscriber API, requires DBIP_API_KEY
#   maxmind  — MaxMind GeoLite2 City, requires MAXMIND_ACCOUNT_ID +
#              MAXMIND_LICENSE_KEY; uses the official `geoipupdate` binary
#              (the EULA forbids redistributing the database, so we never
#              cache the raw .mmdb in the image)
#
# Required runtime: bash, curl, gunzip; pnpm + node for fixture validation
# (skipped if SKIP_VALIDATION=1). Tier=maxmind also needs `geoipupdate` on
# PATH and a `GeoLite2-City.mmdb`-shaped output.

set -euo pipefail

# Load wizard-generated config if present. Written by msgops-api whenever the
# GeoIP wizard step is saved (and bootstrapped from system_config on startup).
# Takes priority over env_file / shell env so the wizard is the source of
# truth — no manual .env editing required after running the setup wizard.
_WIZARD_CONFIG="${BMS_CONFIG_DIR:-/data/config}/geoip.env"
if [[ -f "$_WIZARD_CONFIG" ]]; then
  echo "[download-geodb] Loading wizard config from $_WIZARD_CONFIG"
  set -a; . "$_WIZARD_CONFIG"; set +a
fi
unset _WIZARD_CONFIG

# Filename is derived from GEO_TIER — single source of truth so that
# `ls $GEO_MMDB_DIR` always shows which tier produced the live database.
# This mapping is mirrored in apps/geolocation/src/app.service.ts; keep
# the two in sync if you add a tier here.
GEO_TIER="${GEO_TIER:-lite}"
GEO_MMDB_DIR="${GEO_MMDB_DIR:-./data/geo}"

case "$GEO_TIER" in
  lite)    GEO_MMDB_FILENAME="dbip-city-lite.mmdb" ;;
  full)    GEO_MMDB_FILENAME="dbip-city-full.mmdb" ;;
  maxmind) GEO_MMDB_FILENAME="geolite2-city.mmdb" ;;
  api|disabled)
    echo "[download-geodb] Tier=${GEO_TIER} uses a remote/no-op provider — no local MMDB needed. Skipping."
    exit 0
    ;;
  *)
    echo "[download-geodb] ERROR: unknown GEO_TIER='$GEO_TIER' (expected: lite|full|maxmind|api|disabled)" >&2
    exit 2
    ;;
esac

DEST="${GEO_MMDB_DIR}/${GEO_MMDB_FILENAME}"
DEST_DIR="$GEO_MMDB_DIR"
TMP_GZ="${DEST_DIR}/.dbip-download.mmdb.gz"
TMP_MMDB="${DEST}.tmp"
SKIP_VALIDATION="${SKIP_VALIDATION:-0}"

# How to invoke the TypeScript validator. Defaults to `pnpm tsx` for in-repo
# usage; set GEO_VALIDATE_RUNNER="tsx" in containers where pnpm is absent
# but tsx is on the PATH (see geolocation-refresh sidecar).
GEO_VALIDATE_RUNNER="${GEO_VALIDATE_RUNNER:-pnpm tsx}"

# Where validate-mmdb.ts lives — script and fixtures share a directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALIDATOR="${SCRIPT_DIR}/validate-mmdb.ts"

mkdir -p "$DEST_DIR"

cleanup() {
  rm -f "$TMP_GZ" "$TMP_MMDB"
}
trap cleanup EXIT

case "$GEO_TIER" in
  lite)
    YEAR=$(date +%Y)
    MONTH=$(date +%m)
    URL="https://download.db-ip.com/free/dbip-city-lite-${YEAR}-${MONTH}.mmdb.gz"
    echo "[download-geodb] Tier=lite — downloading DB-IP Lite City for ${YEAR}-${MONTH}..."
    echo "[download-geodb] Target: $DEST"
    if ! curl -fL --retry 3 --retry-delay 10 -o "$TMP_GZ" "$URL"; then
      echo "[download-geodb] ERROR: download failed: $URL" >&2
      exit 1
    fi
    # Lite is ~125 MB compressed → ~250 MB uncompressed; bound 80..400 MB.
    MIN_SIZE=$((80 * 1024 * 1024))
    MAX_SIZE=$((400 * 1024 * 1024))
    FIXTURES="${SCRIPT_DIR}/mmdb-fixtures-lite.json"
    ;;
  full)
    if [[ -z "${DBIP_API_KEY:-}" ]]; then
      echo "[download-geodb] ERROR: GEO_TIER=full requires DBIP_API_KEY" >&2
      exit 2
    fi
    echo "[download-geodb] Tier=full — querying DB-IP subscriber API..."
    echo "[download-geodb] Target: $DEST"
    META=$(curl -fsSL -H "Authorization: Bearer ${DBIP_API_KEY}" \
      "https://db-ip.com/account/api/download?database=mmdb")
    DOWNLOAD_URL=$(echo "$META" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
    if [[ -z "$DOWNLOAD_URL" ]]; then
      echo "[download-geodb] ERROR: subscriber API did not return a download URL" >&2
      echo "[download-geodb] Response: $META" >&2
      exit 1
    fi
    if ! curl -fL --retry 3 --retry-delay 10 -o "$TMP_GZ" "$DOWNLOAD_URL"; then
      echo "[download-geodb] ERROR: download failed" >&2
      exit 1
    fi
    # Full is multi-GB; keep the validator's defaults (500 MB .. 3 GB).
    MIN_SIZE=$((500 * 1024 * 1024))
    MAX_SIZE=$((3 * 1024 * 1024 * 1024))
    FIXTURES="${SCRIPT_DIR}/mmdb-fixtures.json"
    ;;
  maxmind)
    if [[ -z "${MAXMIND_ACCOUNT_ID:-}" || -z "${MAXMIND_LICENSE_KEY:-}" ]]; then
      echo "[download-geodb] ERROR: GEO_TIER=maxmind requires MAXMIND_ACCOUNT_ID + MAXMIND_LICENSE_KEY" >&2
      exit 2
    fi
    if ! command -v geoipupdate >/dev/null 2>&1; then
      echo "[download-geodb] ERROR: geoipupdate binary not found on PATH" >&2
      echo "[download-geodb]   See https://github.com/maxmind/geoipupdate for install/runtime details." >&2
      exit 2
    fi
    echo "[download-geodb] Tier=maxmind — invoking geoipupdate for GeoLite2-City..."
    echo "[download-geodb] Target: $DEST"
    GEOIPUPDATE_CONF="${DEST_DIR}/.GeoIP.conf"
    cat > "$GEOIPUPDATE_CONF" <<EOF
AccountID ${MAXMIND_ACCOUNT_ID}
LicenseKey ${MAXMIND_LICENSE_KEY}
EditionIDs GeoLite2-City
DatabaseDirectory ${DEST_DIR}
EOF
    if ! geoipupdate -f "$GEOIPUPDATE_CONF"; then
      rm -f "$GEOIPUPDATE_CONF"
      echo "[download-geodb] ERROR: geoipupdate failed — keeping previous MMDB at $DEST" >&2
      exit 1
    fi
    rm -f "$GEOIPUPDATE_CONF"
    # geoipupdate writes ${DEST_DIR}/GeoLite2-City.mmdb — stage it for atomic
    # swap into our canonical $DEST path so the watcher logic stays uniform.
    if [[ ! -f "${DEST_DIR}/GeoLite2-City.mmdb" ]]; then
      echo "[download-geodb] ERROR: geoipupdate did not produce GeoLite2-City.mmdb" >&2
      exit 1
    fi
    cp "${DEST_DIR}/GeoLite2-City.mmdb" "$TMP_MMDB"
    rm -f "${DEST_DIR}/GeoLite2-City.mmdb"
    # GeoLite2-City sits between Lite (~125 MB) and Full (~500 MB+).
    MIN_SIZE=$((30 * 1024 * 1024))
    MAX_SIZE=$((250 * 1024 * 1024))
    # MaxMind ships country/region/city without ASN traits in the City DB,
    # so we reuse the lite fixtures (location-only) for sanity checks.
    FIXTURES="${SCRIPT_DIR}/mmdb-fixtures-lite.json"
    ;;
  *)
    echo "[download-geodb] ERROR: unknown GEO_TIER='$GEO_TIER' (expected: lite|full|maxmind)" >&2
    exit 2
    ;;
esac

# Lite/Full deliver a .gz; maxmind delivers the .mmdb directly via geoipupdate.
if [[ "$GEO_TIER" != "maxmind" ]]; then
  echo "[download-geodb] Decompressing to staging path..."
  gunzip -c "$TMP_GZ" > "$TMP_MMDB"
  rm -f "$TMP_GZ"
fi

if [[ "$SKIP_VALIDATION" != "1" ]]; then
  if [[ ! -f "$VALIDATOR" ]]; then
    echo "[download-geodb] ERROR: validator missing at $VALIDATOR" >&2
    exit 2
  fi
  if [[ ! -f "$FIXTURES" ]]; then
    echo "[download-geodb] ERROR: fixtures missing at $FIXTURES" >&2
    exit 2
  fi
  echo "[download-geodb] Validating staged MMDB against $FIXTURES..."
  # shellcheck disable=SC2086
  if ! $GEO_VALIDATE_RUNNER "$VALIDATOR" \
        --min-size "$MIN_SIZE" --max-size "$MAX_SIZE" \
        "$TMP_MMDB" "$FIXTURES"; then
    echo "[download-geodb] ERROR: validation failed — keeping previous MMDB at $DEST" >&2
    exit 1
  fi
else
  echo "[download-geodb] SKIP_VALIDATION=1 — skipping fixture checks (size guard only)"
  SIZE=$(stat -c%s "$TMP_MMDB" 2>/dev/null || stat -f%z "$TMP_MMDB")
  if [[ "$SIZE" -lt "$MIN_SIZE" || "$SIZE" -gt "$MAX_SIZE" ]]; then
    echo "[download-geodb] ERROR: staged MMDB size $SIZE outside [$MIN_SIZE..$MAX_SIZE]" >&2
    exit 1
  fi
fi

# Idempotency guard: skip the swap when the staged file is byte-for-byte
# identical to the one already in place. This makes daily cron runs cheap
# on non-release days (download + compare, then exit) and avoids a
# pointless watcher reload. md5sum is available in BusyBox (Alpine) and
# GNU coreutils; macOS users calling the script directly have md5/md5sum.
if [[ -f "$DEST" ]]; then
  _md5() { md5sum "$1" 2>/dev/null | cut -d' ' -f1 || md5 -q "$1" 2>/dev/null; }
  NEW_MD5=$(_md5 "$TMP_MMDB")
  CUR_MD5=$(_md5 "$DEST")
  if [[ -n "$NEW_MD5" && "$NEW_MD5" == "$CUR_MD5" ]]; then
    echo "[download-geodb] MMDB unchanged (MD5 match) — no swap needed. Tier=${GEO_TIER}"
    exit 0
  fi
fi

# Atomic swap: rename only succeeds when source and dest are on the same FS.
mv -f "$TMP_MMDB" "$DEST"
# Bump mtime to nudge the geolocation file watcher even on filesystems where
# rename preserves the source mtime.
touch "$DEST"

echo "[download-geodb] OK. Tier=${GEO_TIER}, MMDB at $DEST"
echo "[download-geodb] Attribution: IP geolocation by DB-IP.com (CC-BY 4.0 for Lite)"
