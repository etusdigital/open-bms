#!/usr/bin/env bash
# EVO-1027 — orquestrador da escada bulk-send pra stack `bms-loadtest` no
# manager Evolution, via DOCKER_HOST=ssh://manager (sem tunnels SSH locais).
#
# Diferenças vs run.sh local:
#   - seed via `docker run bms-load-harness` na network bms-loadtest_internal
#     (image baked com seed-campaign.ts + deps; PG resolvido via swarm DNS)
#   - k6 via `docker run --network bms-loadtest_internal grafana/k6` com
#     /opt/bms-loadtest-harness/bulk-send.js montado
#   - drain check via `docker exec` em REDIS_CONTAINER (resolvido por label
#     swarm), sem redis-cli local
#   - artefatos por execução escritos em /opt/bms-loadtest-harness/runs/<ts>
#     no manager, scp'ados pra report/raw/<ts>/ no final de cada nível
#
# Pré-requisitos no manager (one-time):
#   1. docker load < bms-load-harness:latest (build local + save/load)
#   2. /opt/bms-loadtest-harness/bulk-send.js (rsync do scenario)
#   3. Stack `bms-loadtest` rodando (`infra/swarm/stack.bms-loadtest.yml`)
#
# Uso (do laptop):
#   ./tests/load/evo-1027-bulk-send/run-staging.sh --levels 1k
#   ./tests/load/evo-1027-bulk-send/run-staging.sh --max 1M
#
# Env:
#   MANAGER                  ssh alias (default: evolution_manager)
#   STACK_NAME               default: bms-loadtest
#   STACK_NET                default: ${STACK_NAME}_internal
#   PG_SERVICE               default: postgres
#   REDIS_SERVICE            default: redis
#   PACKER_SERVICE           default: campaign-packer
#   MOCK_SERVICE             default: sendgrid-mock
#   EVENT_RECEIVER_SERVICE   default: event-receiver
#   HARNESS_IMAGE            default: bms-load-harness:latest
#   K6_IMAGE                 default: grafana/k6:latest
#   MANAGER_HARNESS_DIR      default: /opt/bms-loadtest-harness
#   DRAIN_TIMEOUT_S          default: 7200 (2h — pro 1M)
#   P95_CEILING_MS           default: 60000

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCENARIO_DIR="$REPO_ROOT/tests/load/evo-1027-bulk-send"
SHARED_DIR="$REPO_ROOT/tests/load/_shared"

MANAGER="${MANAGER:-evolution_manager}"
STACK_NAME="${STACK_NAME:-bms-loadtest}"
STACK_NET="${STACK_NET:-${STACK_NAME}_internal}"
PG_SERVICE="${PG_SERVICE:-postgres}"
REDIS_SERVICE="${REDIS_SERVICE:-redis}"
PACKER_SERVICE="${PACKER_SERVICE:-campaign-packer}"
MOCK_SERVICE="${MOCK_SERVICE:-sendgrid-mock}"
EVENT_RECEIVER_SERVICE="${EVENT_RECEIVER_SERVICE:-event-receiver}"
HARNESS_IMAGE="${HARNESS_IMAGE:-bms-load-harness:latest}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:latest}"
MANAGER_HARNESS_DIR="${MANAGER_HARNESS_DIR:-/opt/bms-loadtest-harness}"
DRAIN_TIMEOUT_S="${DRAIN_TIMEOUT_S:-7200}"
P95_CEILING_MS="${P95_CEILING_MS:-60000}"

export DOCKER_HOST="ssh://$MANAGER"

# PG password do .env do manager.
PGPASS=$(ssh "$MANAGER" "grep ^POSTGRES_PASSWORD= /opt/bms-staging/.env | cut -d= -f2")
PG_DSN_INTERNAL="postgres://postgres:${PGPASS}@${PG_SERVICE}:5432/msgops"

# Resolve container IDs no manager via label do swarm service.
REDIS_CONTAINER=$(docker ps -q --filter "label=com.docker.swarm.service.name=${STACK_NAME}_${REDIS_SERVICE}" | head -1)
RABBIT_CONTAINER=$(docker ps -q --filter "label=com.docker.swarm.service.name=${STACK_NAME}_rabbitmq" | head -1)
if [[ -z "$REDIS_CONTAINER" || -z "$RABBIT_CONTAINER" ]]; then
  echo "ERROR: redis/rabbitmq container not found in stack $STACK_NAME on $MANAGER" >&2
  echo "       Make sure the stack is up: docker -H ssh://$MANAGER stack services $STACK_NAME" >&2
  exit 1
fi

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
    1k) echo 1000 ;; 10k) echo 10000 ;; 50k) echo 50000 ;;
    100k) echo 100000 ;; 250k) echo 250000 ;; 500k) echo 500000 ;;
    1M) echo 1000000 ;;
    *) echo "unknown level: $1" >&2; exit 1 ;;
  esac
}

RUN_TS="$(date +%Y%m%dT%H%M%S)"
REPORT_DIR="$SCENARIO_DIR/report"
RAW_DIR="$REPORT_DIR/raw/$RUN_TS"
MANAGER_RUN_DIR="$MANAGER_HARNESS_DIR/runs/$RUN_TS"
mkdir -p "$RAW_DIR"
ssh "$MANAGER" "mkdir -p $MANAGER_RUN_DIR"

REPORT_MD="$REPORT_DIR/results.md"
if [[ ! -f "$REPORT_MD" ]]; then
  cat >"$REPORT_MD" <<EOF
# EVO-1027 — Resultados (staging)

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain | Status |
|---|---|---|---|---|---|---|
EOF
fi

log() { printf '\n[run-staging.sh %s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }

# Bull queue depth (Redis-backed). Usado pelo campaign-packer.
bull_queue_depth() {
  local q="$1"
  local wait active delayed
  wait=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN "bull:${q}:wait" 2>/dev/null || echo 0)
  active=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN "bull:${q}:active" 2>/dev/null || echo 0)
  delayed=$(docker exec "$REDIS_CONTAINER" redis-cli ZCARD "bull:${q}:delayed" 2>/dev/null || echo 0)
  echo $((wait + active + delayed))
}

# AMQP queue depth via rabbitmqctl. Usado pelo send-email e event-process.
amqp_queue_depth() {
  local q="$1"
  docker exec "$RABBIT_CONTAINER" rabbitmqctl list_queues name messages 2>/dev/null \
    | awk -v q="$q" '$1==q{print $2}' \
    | head -1
}

# Drain real do pipeline. Bull check sozinho retorna falso positivo porque
# o campaign-packer publica em RabbitMQ AMQP (não no Bull) e completa o job
# Bull antes do send-email consumir os batches. Pra cobrir o pipeline inteiro
# precisamos checar Bull (campaign-packer paginou) + AMQP (send-email mandou
# pro mock + event-process processou eventos sintéticos).
#
# Queues monitoradas:
#   - bull:campaign-schedule-page  (Bull)   — paginação no packer
#   - send-email.campaign.send     (AMQP)   — batches pendentes pro send-email
#   - event-process.event.received.sendgrid (AMQP) — eventos do mock pro
#                                              event-process
wait_for_drain() {
  local label="$1"
  local deadline=$(( $(date +%s) + DRAIN_TIMEOUT_S ))
  local zero_streak=0
  while (( $(date +%s) < deadline )); do
    local sp se ep
    sp=$(bull_queue_depth campaign-schedule-page)
    se=$(amqp_queue_depth send-email.campaign.send)
    ep=$(amqp_queue_depth event-process.event.received.sendgrid)
    printf '  [drain %s] bull:schedule-page=%s amqp:send-email=%s amqp:event-process=%s\n' \
      "$label" "$sp" "${se:-?}" "${ep:-?}" >&2
    if (( sp == 0 )) && [[ "${se:-1}" == "0" && "${ep:-1}" == "0" ]]; then
      zero_streak=$((zero_streak + 1))
      if (( zero_streak >= 3 )); then return 0; fi
    else
      zero_streak=0
    fi
    sleep 15
  done
  log "DRAIN TIMEOUT after ${DRAIN_TIMEOUT_S}s"
  return 1
}

run_level() {
  local level="$1"
  local count
  count=$(level_to_count "$level")

  log "=== LEVEL $level (count=$count) ==="

  # 1) seed via harness image dentro da network do stack
  local seed_log="$RAW_DIR/${level}-seed.log"
  local seed_json
  seed_json=$(docker run --rm --network "$STACK_NET" \
              "$HARNESS_IMAGE" \
              --count "$count" --label "${RUN_TS}-${level}" \
              --dsn "$PG_DSN_INTERNAL" \
              --mock-base "http://${MOCK_SERVICE}:3010" \
              --event-receiver-base "http://${EVENT_RECEIVER_SERVICE}:3011" \
              2>"$seed_log" | tail -1)
  local account_id campaign_id contacts
  account_id=$(echo "$seed_json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["accountId"])')
  campaign_id=$(echo "$seed_json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["campaignId"])')
  contacts=$(echo "$seed_json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["contacts"])')
  log "seeded: account=$account_id campaign=$campaign_id contacts=$contacts"

  # 2) k6 trigger via grafana/k6 dentro da network do stack
  local k6_out_manager="$MANAGER_RUN_DIR/${level}-k6"
  # 777 pra k6 container (uid 12345 não-root) conseguir escrever k6.csv/summary.json
  ssh "$MANAGER" "mkdir -p $k6_out_manager && chmod 777 $k6_out_manager"
  local trigger_t0=$(date +%s)
  if ! docker run --rm --network "$STACK_NET" \
        -v "$MANAGER_HARNESS_DIR/bulk-send.js:/scripts/bulk-send.js:ro" \
        -v "$k6_out_manager:/out" \
        -e CAMPAIGN_ID="$campaign_id" \
        -e EXPECTED_CONTACTS="$contacts" \
        -e PACKER_BASE_URL="http://${PACKER_SERVICE}:3000" \
        -e P95_CEILING_MS="$P95_CEILING_MS" \
        "$K6_IMAGE" run \
          --summary-export=/out/summary.json \
          --out csv=/out/k6.csv \
          /scripts/bulk-send.js >"$RAW_DIR/${level}-k6.log" 2>&1; then
    log "k6 trigger FAILED (see $RAW_DIR/${level}-k6.log) — stopping ladder"
    docker run --rm --network "$STACK_NET" "$HARNESS_IMAGE" \
      --teardown --account "$account_id" --dsn "$PG_DSN_INTERNAL" \
      >>"$RAW_DIR/${level}-teardown.log" 2>&1 || true
    return 2
  fi
  # Puxa raw k6 output pro laptop.
  local k6_out_local="$RAW_DIR/${level}-k6"
  mkdir -p "$k6_out_local"
  scp -q "$MANAGER:$k6_out_manager/*" "$k6_out_local/" 2>/dev/null || true

  # 3) drain wait (queue_depth via docker exec no manager)
  local drain_t0=$(date +%s)
  local drain_status="ok"
  if ! wait_for_drain "$level"; then
    drain_status="DRAIN-TIMEOUT"
  fi
  local drain_secs=$(( $(date +%s) - drain_t0 ))
  local total_secs=$(( $(date +%s) - trigger_t0 ))

  # 4) row no results.md — extrai p95 do summary.json do k6
  local p95_ms
  p95_ms=$(python3 -c "import json;d=json.load(open('$k6_out_local/summary.json'));m=d.get('metrics',{}).get('http_req_duration',{});print(int(m.get('p(95)') or m.get('values',{}).get('p(95)') or 0))" 2>/dev/null || echo "0")
  local p95_s=$(awk -v ms="$p95_ms" 'BEGIN{printf "%.2f", ms/1000}')
  local final_status="${drain_status} (total=${total_secs}s)"
  local row="| ${level} | staging | n/a | n/a | ${p95_s} s | ${drain_secs}s | ${final_status} |"
  echo "$row" >>"$REPORT_MD"
  log "row appended: $row"

  # 5) teardown — limpa account + reset mock (alpine pra ter wget)
  docker run --rm --network "$STACK_NET" "$HARNESS_IMAGE" \
    --teardown --account "$account_id" --dsn "$PG_DSN_INTERNAL" \
    >>"$RAW_DIR/${level}-teardown.log" 2>&1 || true
  docker run --rm --network "$STACK_NET" alpine:3.20 \
    wget --post-data="" -qO- "http://${MOCK_SERVICE}:3010/__mock/reset" \
    >>"$RAW_DIR/${level}-teardown.log" 2>&1 || true

  log "level $level done in ${total_secs}s (drain ${drain_secs}s, status ${drain_status})"
  return 0
}

main() {
  log "starting ladder: ${LEVELS[*]}"
  log "manager: $MANAGER, stack: $STACK_NAME, harness image: $HARNESS_IMAGE"
  log "raw output: $RAW_DIR (manager: $MANAGER_RUN_DIR)"
  for level in "${LEVELS[@]}"; do
    if ! run_level "$level"; then
      log "ladder stopped at $level"
      break
    fi
  done
  log "done. results → $REPORT_MD"
}

main "$@"
