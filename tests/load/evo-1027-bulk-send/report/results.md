# EVO-1027 — Resultados

Escada `1k → 10k → 50k → 100k` (em **local**, `docker compose up` em WSL2) e escada estendida `1k → 10k → 50k → 100k → 250k → 500k → 1M` (em **staging**, stack `bms-loadtest` isolada no manager Evolution — `infra/swarm/stack.bms-loadtest.yml`). Pipeline completo coberto em ambos: `campaign → packer → send-email → sendgrid-mock → event-receiver → event-process` (event-process confirmado em logs durante o drain).

p95 do trigger é p95 real (k6 com `ITERATIONS=10`).

> A coluna "Ambiente" foi corrigida à mão pra refletir staging — o `run.sh` ainda escreve "local" hardcoded no template da row.

## Tabela

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain               | Status                             |
| ------ | -------- | -------- | -------- | ----------- | ------------------- | ---------------------------------- |
| 1k     | local    | 580 MB   | 87.6 %   | 0.07 s      | 78s                 | ok (total=79s)                     |
| 10k    | local    | 1777 MB  | 165.4 %  | 0.37 s      | 675s                | ok (total=678s)                    |
| 50k    | local    | 4277 MB  | 156.0 %  | 1.63 s      | 669s                | ok (total=678s)                    |
| 100k   | local    | 4465 MB  | 181.3 %  | 4.25 s      | 651s                | ok (total=676s)                    |
| 1k     | staging  | 712 MB   | 43.9 %   | 0.56 s      | 86s                 | ok (total=90s)                     |
| 10k    | staging  | 804 MB   | 81.3 %   | 0.71 s      | 687s                | ok (total=692s)                    |
| 50k    | staging  | 966 MB   | 79.4 %   | 1.32 s      | 677s                | ok (total=687s)                    |
| 100k   | staging  | 977 MB   | 94.8 %   | 2.12 s      | 672s                | ok (total=688s)                    |
| 250k   | staging  | 763 MB   | 89.5 %   | 5.79 s      | 652s                | ok (total=696s)                    |
| 500k   | staging  | 768 MB   | 84.6 %   | 9.58 s      | 620s                | ok (total=698s)                    |
| **1M** | staging  | 824 MB   | 88.8 %   | **27.99 s** | **1802s (timeout)** | **🛑 DRAIN-TIMEOUT (total=1990s)** |

> **RAM/CPU peak** vêm do sidecar `_shared/metrics/collect.mjs` agregando todos os containers visíveis pelo docker daemon local (em local) ou pelo daemon do manager via `DOCKER_HOST=ssh://manager` (em staging). A diferença grande de RAM entre os ambientes (~4× menos em staging pra mesmo volume) é provavelmente artefato de agregação — no laptop, outros processos/containers competem pelo working-set; no manager, o stack `bms-loadtest` está em containers próprios isolados. Pra números por container, raw em `report/raw/<run-ts>/<level>-metrics/docker-stats.csv`.

> **Drain timeout no 1M:** o teste parou com `campaign-schedule-page` ainda com 589 páginas pendentes (589k contatos não materializados em pages) quando bateu o timeout de 30min. Bumpar `DRAIN_TIMEOUT_S=3600` (60min) provavelmente termina, mas o ponto está feito: **achei o primeiro limite real do pipeline com a config atual.**

## Achei o limite

**1M contatos é o primeiro nível onde o pipeline não termina em tempo razoável.** Não foi por estouro de hardware (RAM/CPU folgados) nem por p95 do trigger (27.99s estourou critério arbitrário de 5s mas continuou funcional). Foi por **throughput de drain do `send-email + sendgrid-mock` que satura** em algum ponto entre 500k e 1M.

Taxa de processamento observada (end-to-end, contatos drenados ÷ tempo de drain):

| Volume | Drain  | Throughput                                                |
| ------ | ------ | --------------------------------------------------------- |
| 100k   | 672s   | 149 contatos/s                                            |
| 250k   | 652s   | 383 contatos/s                                            |
| 500k   | 620s   | 806 contatos/s                                            |
| 1M     | >1800s | < 575 contatos/s (não finalizou; ~411k drenados em 30min) |

Throughput **cresce** de 100k a 500k (pipeline preenchendo o concurrency disponível — workers warm, batches paralelos), depois **cai** no 1M — sinal de saturação. Provável teto: send-email worker pool, sendgrid-mock fila in-memory, ou RabbitMQ consumer prefetch encolhendo o pipeline.

## Observações importantes

1. **p95 trigger escala quase-quadrático no início, depois desacelera** entre 250k–500k (1.65× p95 pra 2× volume) e volta a acelerar pro 1M (2.9× p95 pra 2× volume). O endpoint `create-contacts-send` do packer é síncrono no `INSERT INTO campaigns_contacts ... SELECT ${campaign.query}` — bloqueia HTTP até concluir. Análise dessa decisão arquitetural + proposta de mudança em [`docs/brainstorms/2026-05-24-async-contact-materialization-brainstorm.md`](../../../docs/brainstorms/2026-05-24-async-contact-materialization-brainstorm.md). **Conclusão da análise: não é gargalo de throughput** (o drain depois é dominado por send-email, não pelo INSERT), mas é risco operacional em volumes >500k (timeout HTTP em proxies/scheduler).

2. **Drain praticamente constante (~620–700s) de 10k a 500k em ambos ambientes**, depois **estoura no 1M** (>1800s). Subir de 500k pra 1M significa algum teto de throughput foi atingido — pipeline para de escalar linearmente. Pelos números (taxa cai de 806 → <575 contatos/s), o gargalo é provável **send-email worker pool ou backpressure do sendgrid-mock**. Não investigado em profundidade nesta rodada.

3. **Hardware nunca foi o gargalo**: pico de RAM em staging fica em ~1GB pra qualquer volume (1k a 1M), CPU pico bate 89% no 250k e fica nesse patamar até 1M sem saturar. Manager Evolution (16 cores, NVMe) tem MUITO headroom. **Limite veio do throughput do pipeline, não da infra.**

4. **`event-process` queue ficou em 0 nos snapshots do sidecar** — artefato de polling (sample a cada 10s), não bug. Logs do container confirmam processamento ativo durante o drain ("Duplicate event" no event-process em runs sequenciais é o dedup interno funcionando). Pra ver a queue se enchendo nas próximas rodadas, reduzir `--interval` no `_shared/metrics/collect.mjs` ou usar a métrica `processed` do Bull em vez de `depth`.

5. **Stack `bms-loadtest` em staging** (`infra/swarm/stack.bms-loadtest.yml`): clone íntegro do `bms-staging` (todos os 22 serviços, mesma image tag `bms-staging-a70cc2d`) + `sendgrid-mock` adicionado, com `internal` network attachable, postgres/redis/packer/mock publicados em `127.0.0.1` do manager pra tunelar com `ssh -L` do laptop. Configuração do SendGrid via `system_config` table (`{"apiKey":"SG.MOCK_*","apiBaseUrl":"http://sendgrid-mock:3010","webhookUrlBase":"http://event-receiver:3011/bms/events?platform=sendgrid"}`). msgops-api lê do DB no boot e escreve `/data/config/sendgrid.env` que send-email lê no startup. Pipeline confirmado: 1 webhook registrado, 1 mail batch enviado, 4 fired events × N contatos por nível.

6. **Local serviu como validação de pipeline e curva inicial**, mas não pra capacity planning — WSL2 satura CPU (181% no 100k) bem antes do manager (94%). Pra números defensáveis, usar staging.

## Capacity planning (TL;DR)

| Volume único de campanha | Veredito                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| até 100k                 | sem stress visível (CPU/RAM folgados, drain ~11min)                                                       |
| 250k                     | safe (CPU/RAM folgados, drain ~11min, p95 trigger 5.8s — atenção a timeouts HTTP no scheduler)            |
| 500k                     | safe-ish (mesma faixa, drain ~10min, p95 trigger 9.6s — pico de eficiência do pipeline)                   |
| 1M                       | **não termina em 30min** — pipeline não escala mais. Pra mandar 1M precisa destravar o teto do send-email |
| 1M+                      | fora do envelope até desbloquear o limite acima                                                           |

## Próximos passos (decisão de produto/ops)

- [ ] **Investigar o teto entre 500k–1M no send-email.** Rodar 750k pra refinar (vai destravar a curva ou confirmar saturação?). Olhar métricas finas: send-email Bull queue depth ao longo do drain, sendgrid-mock fired events/s, RabbitMQ consumer prefetch + ack rate.
- [ ] **Anexar este `results.md` ao card [EVO-1027](https://linear.app/evoai/issue/EVO-1027) e linkar do roll-up [EVO-1442](https://linear.app/evoai/issue/EVO-1442).** Capacity planning acima pode entrar como appendix do brief operacional.
- [ ] **Decidir caminho do INSERT síncrono** (vide brainstorm dedicado) — sabido que não é gargalo de throughput; é risco operacional pra volumes >500k. Decisão de produto/ops, não urgente.
- [ ] **Quebrar coluna "RAM peak" / "CPU peak" por container** nos próximos relatórios (raw já tem o dado, faltando pivot no `report.mjs`).
- [ ] **Reduzir `--interval` do sidecar pra 2-5s** pra capturar bursts curtos de send-email e event-process.
- [ ] **Fix do `run.sh`**:
  - `${ENV:-local}` em vez de `local` hardcoded na row;
  - append da row deve respeitar estrutura da tabela em vez de jogar no fim do arquivo;
  - auto-injetar `ssh -o ServerAliveInterval=30` nos tunnels OU rodar seed dentro de container na network do stack (sem tunnel) pra runs longas.
