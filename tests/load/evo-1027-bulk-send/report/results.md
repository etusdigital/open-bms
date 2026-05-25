# EVO-1027 — Resultados

Escada de carga `1k → 1M` rodada em dois ambientes: **local** (`docker compose up` em WSL2, validação de pipeline e curva inicial) e **staging** (stack `bms-loadtest` isolada no manager Evolution — `infra/swarm/stack.bms-loadtest.yml`, números de capacity planning). Pipeline completo coberto: `campaign → packer → send-email → sendgrid-mock → event-receiver → event-process`.

p95 do trigger é p95 real (k6 com `ITERATIONS=10`).

> A coluna "Ambiente" foi corrigida à mão pra refletir staging — o `run.sh` ainda escreve "local" hardcoded no template da row.

## Tabela

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain  | Status                        |
| ------ | -------- | -------- | -------- | ----------- | ------ | ----------------------------- |
| 1k     | local    | 580 MB   | 87.6 %   | 0.07 s      | 78s¹   | ok                            |
| 10k    | local    | 1777 MB  | 165.4 %  | 0.37 s      | 675s¹  | ok                            |
| 50k    | local    | 4277 MB  | 156.0 %  | 1.63 s      | 669s¹  | ok                            |
| 100k   | local    | 4465 MB  | 181.3 %  | 4.25 s      | 651s¹  | ok                            |
| 1k     | staging  | 712 MB   | 43.9 %   | 0.56 s      | 86s¹   | ok                            |
| 10k    | staging  | 804 MB   | 81.3 %   | 0.71 s      | 687s¹  | ok                            |
| 50k    | staging  | 966 MB   | 79.4 %   | 1.32 s      | 677s¹  | ok                            |
| 100k   | staging  | 977 MB   | 94.8 %   | 2.12 s      | 672s¹  | ok                            |
| 250k   | staging  | 763 MB   | 89.5 %   | 5.79 s      | 652s¹  | ok                            |
| 500k   | staging  | 768 MB   | 84.6 %   | 9.58 s      | 620s¹  | ok                            |
| 1M     | staging  | 824 MB   | 88.8 %   | 27.99 s     | 1156s² | ⚠️ bug (EVO-1451) — vide nota |

> **¹** Drain medido via Bull queues only (Redis-based). Subsestima o tempo real do pipeline, especialmente em volumes onde `send-email.campaign.send` (AMQP) acumula backlog. Pra 1k–500k a diferença é pequena (Bull drena ≈ AMQP drena). Pra 1M, AMQP fica ~25min com batches in-flight enquanto Bull já está zerado.
>
> **²** Drain real medido via polling do `send-email.campaign.send` na RabbitMQ (1156s = ~19min). Sem o bug EVO-1451 o pipeline teria fechado nesse range; com o bug, fica em loop infinito.

## Achei o limite — mas é bug, não capacity

Em 1M contatos, o pipeline **não converge por bug no `send-email`**, não por limitação de hardware. Stack isolada com volumes frescos, services restartados na ordem certa, e ainda assim:

- **31.906 ocorrências** do `TypeError: Cannot read properties of null (reading 'campaign_id')` em 1h de logs do `send-email`
- **22 mails entregues** de ~2.000 batches publicados (1.1% sucesso)
- RabbitMQ travada em ~620 mensagens oscilando em loop de redelivery sem ir pra DLQ
- Hardware folgado (RAM ~1GB, CPU 89% pico — manager Evolution tem MUITO headroom)

Root cause: **poison pill no retry handler** em `apps/send-email/src/batch/batch.controller.ts:37-44` combinado com `getdel` em `apps/send-email/src/batch/batch.service.ts`. Detalhes técnicos completos e caminhos de fix em [EVO-1451](https://linear.app/evoai/issue/EVO-1451/send-email-poison-pill-loop-em-campaigns-1m-getdel-null-em).

**Sem o bug:** a curva sugere que 1M completaria em ~19min (extrapolando do drain real medido). Hardware aguenta. Pipeline aguenta. Só o handler não aguenta.

## Throughput observado

Taxa de processamento end-to-end (contatos drenados ÷ tempo de drain real, polling AMQP onde disponível):

| Volume | Drain medido | Throughput aproximado |
| ------ | ------------ | --------------------- |
| 100k   | 672s         | 149 contatos/s        |
| 250k   | 652s         | 383 contatos/s        |
| 500k   | 620s         | 806 contatos/s        |
| 1M     | 1156s¹       | ~865 contatos/s¹      |

¹ Polling AMQP em rodada anterior (com bug em ação — alguns batches drenaram, alguns voltaram, contagem total ambígua). Valor sugestivo, não definitivo.

Pipeline **acelera** de 100k a 500k (workers warm + paralelismo do packer enchendo o pool de send-email), com peak de eficiência em ~500k. Acima disso, ou satura naturalmente ou desencadeia o bug — sem fix do EVO-1451 não dá pra distinguir.

## Observações importantes

1. **p95 trigger escala quase-quadrático.** O endpoint `create-contacts-send` do packer é síncrono no `INSERT INTO campaigns_contacts ... SELECT ${campaign.query}` — bloqueia HTTP até concluir. Análise dedicada em [`docs/brainstorms/2026-05-24-async-contact-materialization-brainstorm.md`](../../../docs/brainstorms/2026-05-24-async-contact-materialization-brainstorm.md). **Conclusão: não é gargalo de throughput** (drain depois é dominado por send-email), mas é risco operacional em volumes >500k pela proximidade de timeouts HTTP no scheduler.

2. **Drain reportado via Bull queues subestima o tempo real** em volumes grandes. Bull queues (campaign-schedule-page) zeram quando o `campaign-packer` termina de paginar, **mas o trabalho real ainda está fluindo via RabbitMQ** (`send-email.campaign.send`) por mais tempo. Pra 1k–500k o gap é pequeno; pra 1M ficou óbvio (Bull em 127s, AMQP em 1156s). `run-staging.sh` foi corrigido pra também monitorar AMQP no drain check; `run.sh` local ainda tem o bug histórico.

3. **Hardware nunca foi o gargalo em staging.** RAM pico ~1GB pra qualquer volume de 1k a 1M, CPU pico 89% no 250k e fica nesse patamar. Manager Evolution (16 cores, NVMe) tem muito headroom. Limite veio do throughput do pipeline E do bug do send-email, não da infra.

4. **`event-process` queue ficou em 0 nos snapshots do sidecar** — artefato de polling (sample a cada 10s), não bug. Logs do container confirmam processamento ativo. Pra capturar a queue se enchendo nas próximas rodadas, reduzir `--interval` no `_shared/metrics/collect.mjs` ou usar a métrica `processed` do Bull em vez de `depth`.

5. **Stack `bms-loadtest` em staging** (`infra/swarm/stack.bms-loadtest.yml`): clone íntegro do `bms-staging` (todos os 22 serviços, mesma image tag `bms-staging-a70cc2d`) + `sendgrid-mock`. Network `internal` attachable; postgres/redis/packer/mock publicados em `127.0.0.1` do manager pra tunelar com `ssh -L`. SendGrid configurado via `system_config` table; msgops-api lê do DB no boot e escreve `/data/config/sendgrid.env` que send-email lê no startup.

6. **Local serviu como validação de pipeline e curva inicial**, mas não pra capacity planning — WSL2 satura CPU bem antes do manager.

7. **Dois harnesses convivendo:** `run.sh` (local, via `docker compose`) e `run-staging.sh` (remote, via `DOCKER_HOST=ssh://manager` + harness image `bms-load-harness` baked com seed + `pg` + `tsx`). Este último elimina a fragilidade de SSH tunnel pra runs longas.

## Capacity planning (TL;DR)

| Volume único de campanha | Veredito                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| até 100k                 | sem stress visível (CPU/RAM folgados, drain ~11min)                                                               |
| 250k                     | safe (drain ~11min, p95 trigger 5.8s — atenção a timeouts HTTP no scheduler)                                      |
| 500k                     | safe-ish — **pico de eficiência do pipeline observado** (~806 contatos/s)                                         |
| 1M                       | **bloqueado por bug** (EVO-1451). Sem o bug, a curva projeta drain ~19min. Não é capacity, é qualidade de código. |
| 1M+                      | inviável até fix do EVO-1451 + reteste                                                                            |

## Próximos passos

- [ ] **EVO-1451**: resolver o poison pill no `send-email.batch.controller`. Investigar primeiro a causa raiz do erro original (instrumentação com `NODE_DEBUG` ou `--inspect` no send-email durante 1M) pra entender se o fix é só no retry path ou também upstream.
- [ ] **Retestar 1M após fix do EVO-1451** — vai destravar o último degrau da escada e dar capacity real pra 1M.
- [ ] **Decidir caminho do INSERT síncrono em `create-contacts-send`** (vide brainstorm dedicado). Não é gargalo de throughput; é risco operacional pra 500k+ (timeout HTTP no scheduler). Decisão de produto/ops, não urgente.
- [ ] **Anexar este `results.md`** ao card [EVO-1027](https://linear.app/evoai/issue/EVO-1027) e linkar do roll-up [EVO-1442](https://linear.app/evoai/issue/EVO-1442).
- [ ] **Quebrar coluna "RAM peak" / "CPU peak" por container** nos próximos relatórios (raw já tem o dado, faltando pivot no `report.mjs`).
- [ ] **Reduzir `--interval` do sidecar pra 2-5s** pra capturar bursts curtos de send-email e event-process.
- [ ] **Portar fix do drain check pro `run.sh` local** (monitorar `send-email.campaign.send` AMQP também, não só Bull queues).
