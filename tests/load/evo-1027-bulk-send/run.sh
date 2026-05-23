#!/usr/bin/env bash
# EVO-1027 — orquestrador da escada de carga bulk-send.
#
# Para cada volume N na lista:
#   1. seed account/contacts/campaign + setup sendgrid-mock
#   2. start sidecar de métricas (docker stats + bull LLEN + pg activity)
#   3. dispara k6 trigger (em container, na network do bms)
#   4. poll drenagem das filas (campaign-schedule-page, send-email, event-process)
#   5. stop sidecar
#   6. report.mjs append linha em report/results.md
#   7. teardown account
#
# Critério "achei o limite" — para a escada quando:
#   - trigger erra (status != 2xx)
#   - drain não completa em DRAIN_TIMEOUT_S
#   - p95 do trigger > 5s (heurística — packer só enqueueia, então isso já é stress)
#
# Uso:
#   ./tests/load/evo-1027-bulk-send/run.sh                 # 1k → 10k → 50k
#   ./tests/load/evo-1027-bulk-send/run.sh --levels 1k,10k # override
#   ./tests/load/evo-1027-bulk-send/run.sh --max 50k       # vai até 50k
#
# Env:
#   PG_DSN                     postgres://postgres:postgres@localhost:55432/msgops
#   BMS_NETWORK                bms-monorepo-open-source2_default
#   PACKER_INTERNAL            campaign-packer:3000
#   K6_IMAGE                   grafana/k6:latest
#   DRAIN_TIMEOUT_S            900  (15 min)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCENARIO_DIR="$REPO_ROOT/tests/load/evo-1027-bulk-send"
SHARED_DIR="$REPO_ROOT/tests/load/_shared"

PG_DSN="${PG_DSN:-postgres://postgres:postgres@localhost:55432/msgops}"
BMS_NETWORK="${BMS_NETWORK:-bms-monorepo-open-source2_default}"
PACKER_INTERNAL="${PACKER_INTERNAL:-campaign-packer:3000}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:latest}"
DRAIN_TIMEOUT_S="${DRAIN_TIMEOUT_S:-900}"

# Container names: resolve via `docker compose ps` so we don't hardcode the
# project name (would break under COMPOSE_PROJECT_NAME or a different clone
# directory). Allow env override for exotic setups.
cd "$REPO_ROOT"
REDIS_CONTAINER="${REDIS_CONTAINER:-$(docker compose ps -q redis 2>/dev/null | head -1)}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-$(docker compose ps -q postgres 2>/dev/null | head -1)}"
if [[ -z "$REDIS_CONTAINER" || -z "$POSTGRES_CONTAINER" ]]; then
  echo "ERROR: could not resolve redis/postgres containers via 'docker compose ps'." >&2
  echo "       Make sure the stack is running ('docker compose up -d'), or set" >&2
  echo "       REDIS_CONTAINER / POSTGRES_CONTAINER env vars explicitly." >&2
  exit 1
fi

# Full ladder. Default range is "1k → 50k" (the cheap shakeout); use --max to
# extend (e.g. --max 1M) or --levels to override completely.
ALL_LEVELS=("1k" "10k" "50k" "100k" "250k" "500k" "1M")
LEVELS=("1k" "10k" "50k")
MAX_LEVEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --levels) IFS=',' read -ra LEVELS <<<"$2"; shift 2 ;;
    --max) MAX_LEVEL="$2"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "$MAX_LEVEL" ]]; then
  # --max extends from ALL_LEVELS (1k → 1M), not from the default LEVELS
  # subset — otherwise --max 1M would silently stop at 50k.
  if ! printf '%s\n' "${ALL_LEVELS[@]}" | grep -qx "$MAX_LEVEL"; then
    echo "unknown level for --max: $MAX_LEVEL (valid: ${ALL_LEVELS[*]})" >&2
    exit 1
  fi
  filtered=()
  for l in "${ALL_LEVELS[@]}"; do
    filtered+=("$l")
    [[ "$l" == "$MAX_LEVEL" ]] && break
  done
  LEVELS=("${filtered[@]}")
fi

level_to_count() {
  case "$1" in
    1k) echo 1000 ;;
    10k) echo 10000 ;;
    50k) echo 50000 ;;
    100k) echo 100000 ;;
    250k) echo 250000 ;;
    500k) echo 500000 ;;
    1M) echo 1000000 ;;
    *) echo "unknown level: $1" >&2; exit 1 ;;
  esac
}

RUN_TS="$(date +%Y%m%dT%H%M%S)"
REPORT_DIR="$SCENARIO_DIR/report"
RAW_DIR="$REPORT_DIR/raw/$RUN_TS"
mkdir -p "$RAW_DIR"

REPORT_MD="$REPORT_DIR/results.md"
if [[ ! -f "$REPORT_MD" ]]; then
  cat >"$REPORT_MD" <<EOF
# EVO-1027 — Resultados (local)

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain | Status |
|---|---|---|---|---|---|---|
EOF
fi

log() { printf '\n[run.sh %s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }

# Poll queue depth for the given Bull queue name. Sums wait + active + delayed.
queue_depth() {
  local q="$1"
  local wait active delayed
  wait=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN "bull:${q}:wait" 2>/dev/null || echo 0)
  active=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN "bull:${q}:active" 2>/dev/null || echo 0)
  delayed=$(docker exec "$REDIS_CONTAINER" redis-cli ZCARD "bull:${q}:delayed" 2>/dev/null || echo 0)
  echo $((wait + active + delayed))
}

wait_for_drain() {
  local label="$1"
  local deadline=$(( $(date +%s) + DRAIN_TIMEOUT_S ))
  local zero_streak=0
  while (( $(date +%s) < deadline )); do
    local d1 d2 d3
    d1=$(queue_depth campaign-schedule-page)
    d2=$(queue_depth send-email)
    d3=$(queue_depth event-process)
    printf '  [drain %s] schedule-page=%s send-email=%s event-process=%s\n' "$label" "$d1" "$d2" "$d3" >&2
    if (( d1 == 0 && d2 == 0 && d3 == 0 )); then
      zero_streak=$((zero_streak + 1))
      # 3 consecutive 0-readings = drained. Avoids racing the first cycle.
      if (( zero_streak >= 3 )); then return 0; fi
    else
      zero_streak=0
    fi
    sleep 5
  done
  log "DRAIN TIMEOUT after ${DRAIN_TIMEOUT_S}s"
  return 1
}

# ----------------------------------------------------------------------
# Per-level execution
# ----------------------------------------------------------------------
run_level() {
  local level="$1"
  local count
  count=$(level_to_count "$level")

  log "=== LEVEL $level (count=$count) ==="

  # 1) seed
  local seed_json
  seed_json=$(pnpm --silent tsx "$SCENARIO_DIR/seed/seed-campaign.ts" \
                --count "$count" --label "${RUN_TS}-${level}" \
                --dsn "$PG_DSN" 2>"$RAW_DIR/${level}-seed.log" | tail -1)
  local account_id campaign_id contacts
  account_id=$(echo "$seed_json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["accountId"])')
  campaign_id=$(echo "$seed_json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["campaignId"])')
  contacts=$(echo "$seed_json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["contacts"])')
  log "seeded: account=$account_id campaign=$campaign_id contacts=$contacts"

  # 2) start sidecar
  local metrics_out="$RAW_DIR/${level}-metrics"
  mkdir -p "$metrics_out"
  node "$SHARED_DIR/metrics/collect.mjs" --out "$metrics_out" --interval 10000 \
    --queues 'campaign-packer,campaign-schedule-page,send-email,event-process' \
    --redis "${REDIS_URL:-redis://localhost:56379}" --pg "$PG_DSN" \
    >"$metrics_out/sidecar.log" 2>&1 &
  local metrics_pid=$!
  trap "kill $metrics_pid 2>/dev/null || true" EXIT
  sleep 2

  # 3) k6 trigger (in BMS network so it reaches campaign-packer:3000)
  local k6_out="$RAW_DIR/${level}-k6"
  mkdir -p "$k6_out"
  local trigger_t0=$(date +%s)
  if ! docker run --rm --network "$BMS_NETWORK" \
        --user "$(id -u):$(id -g)" \
        -v "$SCENARIO_DIR/k6:/scripts" -v "$k6_out:/out" \
        -e CAMPAIGN_ID="$campaign_id" \
        -e EXPECTED_CONTACTS="$contacts" \
        -e PACKER_BASE_URL="http://$PACKER_INTERNAL" \
        "$K6_IMAGE" run \
          --summary-export=/out/summary.json \
          --out csv=/out/k6.csv \
          /scripts/bulk-send.js >"$k6_out/k6.log" 2>&1; then
    log "k6 trigger FAILED (see $k6_out/k6.log) — stopping ladder"
    kill $metrics_pid 2>/dev/null || true
    pnpm --silent tsx "$SCENARIO_DIR/seed/seed-campaign.ts" \
      --teardown --account "$account_id" --dsn "$PG_DSN" \
      >>"$RAW_DIR/${level}-teardown.log" 2>&1 || true
    return 2
  fi

  # 4) drain wait
  local drain_t0=$(date +%s)
  local drain_status="OK"
  if ! wait_for_drain "$level"; then
    drain_status="DRAIN-TIMEOUT"
  fi
  local drain_secs=$(( $(date +%s) - drain_t0 ))
  local total_secs=$(( $(date +%s) - trigger_t0 ))

  # 5) stop sidecar
  kill $metrics_pid 2>/dev/null || true
  wait $metrics_pid 2>/dev/null || true
  trap - EXIT

  # 6) report row
  local docker_csv="$metrics_out/docker-stats.csv"
  [[ -f "$docker_csv" ]] || docker_csv="/dev/null"
  local row
  row=$(node "$SHARED_DIR/report/report.mjs" \
        --k6 "$k6_out/summary.json" \
        --docker "$docker_csv" \
        --label "$level" --env "local" 2>>"$RAW_DIR/${level}-report.log")
  # report.mjs row: "| label | env | RAM | CPU | p95 | Status |"
  # We want:        "| label | env | RAM | CPU | p95 | <drain>s | <status> (total=<n>s) |"
  # Inject drain_secs as a new column before the last (Status) cell.
  local row_with_drain
  row_with_drain=$(echo "$row" | sed -E "s/\| ([^|]+) \|$/| ${drain_secs}s | \1 (total=${total_secs}s) |/")
  echo "$row_with_drain" >>"$REPORT_MD"
  log "row appended: $row_with_drain"

  # 7) teardown
  pnpm --silent tsx "$SCENARIO_DIR/seed/seed-campaign.ts" \
    --teardown --account "$account_id" --dsn "$PG_DSN" \
    >>"$RAW_DIR/${level}-teardown.log" 2>&1
  curl -s -X POST http://localhost:4010/__mock/reset >/dev/null || true

  log "level $level done in ${total_secs}s (drain ${drain_secs}s, status ${drain_status})"
  return 0
}

main() {
  log "starting ladder: ${LEVELS[*]}"
  log "raw output: $RAW_DIR"
  for level in "${LEVELS[@]}"; do
    if ! run_level "$level"; then
      log "ladder stopped at $level"
      break
    fi
  done
  log "done. results → $REPORT_MD"
}

main "$@"
