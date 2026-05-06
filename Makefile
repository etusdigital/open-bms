COMPOSE := docker compose -f docker-compose.yml
API := msgops-api
INFRA := postgres redis rabbitmq clickhouse

.PHONY: up down restart ps logs logs-api build rebuild migrate db-reset db-shell redis-shell infra clean help geo-refresh geo-refresh-force geo-status

help:
	@echo "Targets:"
	@echo "  up          - build (if needed) and start all backend services"
	@echo "  down        - stop and remove containers (keeps volumes)"
	@echo "  restart     - restart all services"
	@echo "  ps          - list service status"
	@echo "  logs        - tail logs from all services"
	@echo "  logs-api    - tail logs from msgops-api"
	@echo "  build       - build all images"
	@echo "  rebuild     - rebuild all images (no cache) and restart"
	@echo "  migrate     - run TypeORM migrations against compose postgres"
	@echo "  db-reset    - drop public schema, recreate, run migrations"
	@echo "  db-shell    - psql into compose postgres"
	@echo "  redis-shell - redis-cli into compose redis"
	@echo "  infra       - start only infra (postgres, redis, rabbitmq, clickhouse)"
	@echo "  clean       - down + remove volumes (DESTROYS DATA)"
	@echo ""
	@echo "GeoIP:"
	@echo "  geo-refresh       - run download-geodb.sh on the host (bypasses sidecar/cron)"
	@echo "  geo-refresh-force - trigger the running sidecar to refresh now (bypasses sleep)"
	@echo "  geo-status        - print apps/geolocation runtime status via the admin endpoint"

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=100

logs-api:
	$(COMPOSE) logs -f --tail=200 $(API)

build:
	$(COMPOSE) build

rebuild:
	$(COMPOSE) build --no-cache
	$(COMPOSE) up -d --force-recreate

infra:
	$(COMPOSE) up -d $(INFRA)

migrate:
	cd apps/msgops-api && pnpm typeorm:migration:run

db-reset:
	$(COMPOSE) up -d postgres
	@until $(COMPOSE) exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	$(COMPOSE) exec -T postgres psql -U postgres -d msgops -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
	$(MAKE) migrate

db-shell:
	$(COMPOSE) exec postgres psql -U postgres -d msgops

redis-shell:
	$(COMPOSE) exec redis redis-cli

clean:
	$(COMPOSE) down -v

# Run download-geodb.sh on the host. No docker, no cron loop, no sleep — it
# executes once and exits. Auto-loads apps/geolocation/.env (the same file
# docker-compose feeds into the geolocation service + refresh sidecar via
# `env_file:`), so the host path and the container path use the same source
# of truth for GEO_TIER / DBIP_API_KEY / MAXMIND_*. Make does NOT do this
# loading natively. The on-disk filename is derived from GEO_TIER, so
# `ls $GEO_MMDB_DIR` shows which tier produced the live DB.
#
# Note: sourcing reapplies the file's values, so apps/geolocation/.env wins
# over inline `GEO_TIER=foo make geo-refresh`. For a one-off override
# without editing the file, call the script directly:
#     GEO_TIER=full bash scripts/download-geodb.sh
geo-refresh:
	@ENVFILE=apps/geolocation/.env; \
	if [ -f "$$ENVFILE" ]; then \
		echo "[geo-refresh] loading $$ENVFILE"; \
		set -a; . ./$$ENVFILE; set +a; \
	else \
		echo "[geo-refresh] $$ENVFILE not found — using shell defaults"; \
	fi; \
	bash scripts/download-geodb.sh

# Force the geolocation-refresh sidecar to run a refresh cycle right now,
# without waiting for the next 30-day sleep tick. Uses `docker compose exec`
# so the script runs inside the same container (same image, same volumes,
# same env) — keeps the production refresh path under test, just on demand.
# Falls back to forcing a recreate if the sidecar isn't running yet.
geo-refresh-force:
	@if $(COMPOSE) ps --status running --services 2>/dev/null | grep -qx geolocation-refresh; then \
		echo "[geo-refresh-force] sidecar running — invoking download-geodb.sh inside it"; \
		$(COMPOSE) exec -T geolocation-refresh bash /workspace/scripts/download-geodb.sh; \
	else \
		echo "[geo-refresh-force] sidecar not running — recreating to trigger an immediate cycle"; \
		$(COMPOSE) up -d --force-recreate geolocation-refresh; \
	fi

geo-status:
	@if [ -z "$$BMS_ADMIN_TOKEN" ]; then \
		echo "BMS_ADMIN_TOKEN not set — export a super-admin JWT first" >&2; exit 2; \
	fi
	curl -sS -H "Authorization: Bearer $$BMS_ADMIN_TOKEN" \
		"$${BMS_API_URL:-http://localhost:3000}/admin/geoip/status" | \
		(command -v jq >/dev/null && jq . || cat)
