# EVO-1027 — Testes de Carga / Volume (16k+ e-mails até estresse)

Parte da bateria [EVO-1442](https://linear.app/evoai/issue/EVO-1442). Card: [EVO-1027](https://linear.app/evoai/issue/EVO-1027).

## Objetivo

Encontrar o limite de envio em massa de e-mail no pipeline `campaign → packer → send-email → sendgrid-mock → event-receiver → event-process → analytics` e medir consumo por nível de carga.

## Escopo desta entrega

- **Fase A (local, `docker compose up` na máquina do Gui)** — único alvo desta rodada.
- **Fase B (staging Hetzner / EVO-1026)** — fora deste PR.

## Abordagem

### Mock de SendGrid

Reutilizamos `apps/sendgrid-mock` que já está na stack. `msgops-api` aponta `SENDGRID_API_BASE_URL=http://sendgrid-mock:3010` por default; o mock recebe `/v3/mail/send` e dispara `processed → delivered → open → click` no `event-receiver`. **Sem provider novo, sem mock-webhook extra** — o caminho de evento sintético do `_shared/mock-webhook/` fica reservado pra testes isolados de ingestão (EVO-1073).

### Trigger da campanha

`msgops-api` agenda via BullMQ (`SchedulerService.create`) → no `scheduleTo` o scheduler HTTP-POST `http://campaign-packer:3000/create-contacts-send/:id`. Pra medição **limpa** (sem jitter de scheduler), k6 chama o endpoint do packer **diretamente** — o container k6 é anexado à network do compose (`docker run --network <bms-net>`) e bate em `campaign-packer:3000` sem precisar de port-mapping no host.

Modo alternativo (não default): setar `scheduleTo = now + 5s` e medir scheduler+packer fim-a-fim. Útil quando interessa o caminho real do botão "Enviar".

### Eventos

`sendgrid-mock` gera 3 eventos por envio (delivered/open/click), e `event-receiver` joga em `event-process`. Webhook ingestion entra naturalmente na medição — não precisamos rodar `_shared/mock-webhook/sendgrid-events.js` separado.

## Escada de carga

Tamanho do segmento da campanha:

```
1k → 10k → 50k → 100k → 250k → 500k → 1M → até quebrar
```

**Rodada inicial deste PR**: `1k → 10k → 50k` apenas, pra validar pipeline e pegar primeiros números. Volumes maiores ficam pra rodadas seguintes (compactando no mesmo card).

## Critério "achei o limite" (primeiro de)

- OOM em qualquer container
- p95 de qualquer endpoint > 5s sustentada por > 1min
- Error rate > 1%
- Fila Bull crescendo indefinidamente (waiting não escoa)
- Container reiniciando

## Métricas coletadas (por nível)

Containers: `msgops-api`, `campaign-packer`, `send-email`, `event-process`, `event-receiver`, `postgres`, `redis`.

- RAM/CPU peak (sidecar `_shared/metrics/collect.mjs`)
- p50/p95/p99 latência packer endpoint (k6)
- Throughput: emails/min, webhooks/min
- Filas Bull: waiting/active/failed/delayed
- Erros, OOMs, restarts
- Tempo total: trigger → último webhook processado

## Estrutura

```
seed/
  seed-campaign.ts    # cria account+segmento+contatos+campanha (TS direto no PG)
k6/
  bulk-send.js        # POST packer + polling de drain das filas
  drain-wait.js       # helper de espera
report/
  results.md          # tabela de resultados (markdown)
  raw/                # CSVs por execução (k6, docker-stats, bull, pg)
run.sh                # orquestrador da escada
```

## Golden path

```bash
# 1. Sobe a stack (precisa que apps/sendgrid-mock e campaign-packer estejam rodando)
docker compose up -d

# 2. Roda escada 1k → 10k → 50k
./tests/load/evo-1027-bulk-send/run.sh --max 50k

# 3. Tabela em tests/load/evo-1027-bulk-send/report/results.md
```

## Entregável

Tabela markdown em `report/results.md` (anexada ao EVO-1027, agregada em EVO-1442):

| Volume | Ambiente | RAM peak (por container) | CPU peak | p95 send | p95 webhook | Status |
| ------ | -------- | ------------------------ | -------- | -------- | ----------- | ------ |
| 1k     | local    | …                        | …        | …        | …           | OK     |
| 10k    | local    | …                        | …        | …        | …           | …      |
| 50k    | local    | …                        | …        | …        | …           | …      |

## Status

- [x] `seed/seed-campaign.ts` — cria account, contatos, message e campanha (query inline, sem segmento real)
- [x] `k6/bulk-send.js` — trigger single-shot do endpoint do packer
- [x] `run.sh` — escada + sidecar de métricas + relatório, com gate `saw_nonzero` por fila pra evitar drain de zero espúrio
- [x] Rodada `1k → 10k → 50k` em `report/results.md` (status partial — vide caveat de `event-process`)

## Caveats conhecidos

- **`event-process` não é medido nesta rodada.** Bug pré-existente no `docker-compose.yml` (faltam `DATABASE_HOST`/`DATABASE_PORT` no `x-backend-env`) impede o worker de conectar no Postgres; sua queue Bull fica em 0 mesmo com eventos chegando. `run.sh` flag automaticamente esses níveis com `(event-process not exercised)` na coluna Status. Fix vai em ticket separado, depois rodadas seguintes voltam a cobrir a ingestão.
- **`p95 trigger` é amostra única.** k6 roda `vus=1, iterations=1` por nível — o número é a latência do POST único do packer, não p95 estatístico. Suficiente como heurística de stress (>5s → packer travado), não como SLI.
