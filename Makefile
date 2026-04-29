COMPOSE := docker compose -f docker-compose.yml
API := msgops-api
INFRA := postgres redis rabbitmq clickhouse

.PHONY: up down restart ps logs logs-api build rebuild migrate db-reset db-shell redis-shell infra clean help

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
