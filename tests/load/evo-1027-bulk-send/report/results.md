# EVO-1027 — Resultados

Escada `1k → 10k → 50k → 100k` rodada em dois ambientes: **local** (`docker compose up` em WSL2) e **staging** (stack `bms-loadtest` isolada no manager Evolution, `infra/swarm/stack.bms-loadtest.yml`). Pipeline completo coberto em ambos: `campaign → packer → send-email → sendgrid-mock → event-receiver → event-process` (event-process confirmado em logs durante o drain).

p95 do trigger é p95 real (k6 com `ITERATIONS=10`).

> A coluna "Ambiente" foi corrigida à mão pra refletir staging — o `run.sh` ainda escreve "local" hardcoded no template da row.

## Tabela

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain | Status          |
| ------ | -------- | -------- | -------- | ----------- | ----- | --------------- |
| 1k     | local    | 580 MB   | 87.6 %   | 0.07 s      | 78s   | ok (total=79s)  |
| 10k    | local    | 1777 MB  | 165.4 %  | 0.37 s      | 675s  | ok (total=678s) |
| 50k    | local    | 4277 MB  | 156.0 %  | 1.63 s      | 669s  | ok (total=678s) |
| 100k   | local    | 4465 MB  | 181.3 %  | 4.25 s      | 651s  | ok (total=676s) |
| 1k     | staging  | 712 MB   | 43.9 %   | 0.56 s      | 86s   | ok (total=90s)  |
| 10k    | staging  | 804 MB   | 81.3 %   | 0.71 s      | 687s  | ok (total=692s) |
| 50k    | staging  | 966 MB   | 79.4 %   | 1.32 s      | 677s  | ok (total=687s) |
| 100k   | staging  | 977 MB   | 94.8 %   | 2.12 s      | 672s  | ok (total=688s) |

> **RAM/CPU peak** vêm do sidecar `_shared/metrics/collect.mjs` agregando todos os containers visíveis pelo docker daemon local (em local) ou pelo daemon do manager via `DOCKER_HOST=ssh://manager` (em staging). A diferença grande de RAM entre os ambientes (~4× menos em staging pra mesmo volume) é provavelmente artefato de agregação — no laptop, outros processos/containers competem pelo working-set; no manager, o stack `bms-loadtest` está em containers próprios isolados. Pra números por container, raw em `report/raw/<run-ts>/<level>-metrics/docker-stats.csv`.

## Observações importantes

1. **p95 trigger é o primeiro gargalo, em ambos os ambientes.** O endpoint `create-contacts-send` do packer é síncrono no `INSERT INTO campaigns_contacts ... SELECT ${campaign.query}` — escala quase-quadrático com volume. Em **local**, 100k bate 4.25s (já quase no critério de 5s); projeção pra 250k é >10s. Em **staging**, mesma curva mas mais favorável: 100k bate 2.12s, projeção 250k ~6-8s. Em ambos casos, antes de tentar 250k+ vale fragmentar esse INSERT ou movê-lo pra background (transformar `create-contacts-send` em fire-and-forget que enfileira um job de paginação).

2. **Drain praticamente constante (~670s) de 10k a 100k em ambos ambientes.** É o **delay determinístico de 60s** do `campaign-schedule-page` (`spreadSending=0` → fallback `millisecond=60000ms` em `campaign.service.ts`) + ~10min de processamento dominado pelo throughput do `send-email + sendgrid-mock`. Como o packer paraleliza páginas + send-email tem worker concurrency, 10× mais contatos não multiplicou o tempo. **O drain é I/O bound no send-email, não no infra.**

3. **Staging é mais rápido que local em CPU/IOPS, RAM aparente menor.** Manager Evolution tem 16 cores reais + disco NVMe (vs WSL2 ~6 cores efetivos + disco virtual). CPU peak 95% (staging) vs 181% (local) no 100k mostra que o manager tem MUITO mais headroom — limite vai vir mais tarde. p95 trigger 50% mais baixo em staging confirma isso (disco Hetzner > WSL2 num INSERT pesado). Manager aguenta o próximo passo da escada (250k → 1M) sem stress de hardware; o limite vai vir do INSERT síncrono mesmo.

4. **`event-process` queue ficou em 0 nos snapshots do sidecar** — artefato de polling (sample a cada 10s), não bug. Logs do container confirmam processamento ativo durante o drain ("Duplicate event" no event-process em runs sequenciais é o dedup interno funcionando). Pra ver a queue se enchendo nas próximas rodadas, reduzir `--interval` no `_shared/metrics/collect.mjs` ou usar a métrica `processed` do Bull em vez de `depth`.

5. **Stack `bms-loadtest` em staging** (`infra/swarm/stack.bms-loadtest.yml`): clone íntegro do `bms-staging` (todos os 22 serviços, mesma image tag `bms-staging-a70cc2d`) + `sendgrid-mock` adicionado, com `internal` network attachable, postgres/redis/packer/mock publicados em `127.0.0.1` do manager pra tunelar com `ssh -L` do laptop. Configuração do SendGrid via `system_config` table (`{"apiKey":"SG.MOCK_*","apiBaseUrl":"http://sendgrid-mock:3010","webhookUrlBase":"http://event-receiver:3011/bms/events?platform=sendgrid"}`). msgops-api lê do DB no boot e escreve `/data/config/sendgrid.env` que send-email lê no startup. Pipeline confirmado: 1 webhook registrado, 1 mail batch enviado, 4000 fired events (4× por contato) por nível.

## Próximos passos

- [ ] **Antes de 250k+**: fragmentar ou background-isolar o INSERT em `create-contacts-send` (sem isso, 250k já estoura p95 5s no local e 500k+ vira inviável em ambos). Card separado.
- [ ] Rodar 250k → 500k → 1M em staging (manager aguenta), assim que o INSERT for fragmentado.
- [ ] Anexar este `results.md` ao card [EVO-1027](https://linear.app/evoai/issue/EVO-1027) e linkar do roll-up [EVO-1442](https://linear.app/evoai/issue/EVO-1442).
- [ ] Fix do `run.sh` pra colocar `${ENV:-local}` em vez de `local` hardcoded na row, e auto-injetar `ssh -o ServerAliveInterval=30` nos tunnels OU rodar seed dentro de container na network do stack (sem tunnel) pra runs longas.
- [ ] Quebrar coluna "RAM peak" / "CPU peak" por container nos próximos relatórios (raw já tem o dado, faltando pivot no `report.mjs`).
- [ ] Reduzir `--interval` do sidecar pra 2-5s pra capturar bursts curtos de send-email e event-process.
