# EVO-1027 — Resultados (local)

Escada `1k → 10k → 50k → 100k` em `docker compose up` na máquina do Gui (WSL2). Pipeline completo coberto: `campaign → packer → send-email → sendgrid-mock → event-receiver → event-process` (event-process confirmado em logs durante o drain).

p95 do trigger é p95 real (k6 com `ITERATIONS=10`).

> Rows 1k/10k/50k foram rodadas numa sessão; row 100k em sessão separada (stack rebuilt entre as duas). Esperar pouca noise de hardware entre rodadas mas não comparar absoluto.

## Tabela

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain | Status          |
| ------ | -------- | -------- | -------- | ----------- | ----- | --------------- |
| 1k     | local    | 580 MB   | 87.6 %   | 0.07 s      | 78s   | ok (total=79s)  |
| 10k    | local    | 1777 MB  | 165.4 %  | 0.37 s      | 675s  | ok (total=678s) |
| 50k    | local    | 4277 MB  | 156.0 %  | 1.63 s      | 669s  | ok (total=678s) |
| 100k   | local    | 4465 MB  | 181.3 %  | 4.25 s      | 651s  | ok (total=676s) |

> **RAM/CPU peak** vêm do sidecar `_shared/metrics/collect.mjs` agregando todos os containers da stack (não por container ainda — a coluna fica simples; raw em `report/raw/<run-ts>/<level>-metrics/docker-stats.csv` se quiser refatiar).

## Observações importantes

1. **p95 trigger sobe quase-quadrático com o volume (0.07s → 0.37s → 1.63s → 4.25s).** O endpoint `create-contacts-send` é síncrono no `INSERT INTO campaigns_contacts ... SELECT ${campaign.query}` — pra 100k contatos, leva ~4.25s, já a 0.75s do critério de 5s. Pra 250k a projeção (continuando a curva) é >10s, **estoura o limite no próximo nível**. Fragmentar esse INSERT ou movê-lo pra background é o ponto óbvio de otimização antes de tentar 250k+.

2. **Drain do 100k essencialmente igual ao 10k/50k (~650s).** Mesmo padrão: **delay determinístico de 60s** do `campaign-schedule-page` (`spreadSending=0` → `millisecond=60000ms` fallback em `campaign.service.ts`) + ~10min de processamento. Como o packer paraleliza páginas + send-email tem worker concurrency, 10x mais contatos não multiplicou o tempo. O gargalo real do drain está no **send-email + sendgrid-mock**, não no packer.

3. **RAM peak plateu entre 50k e 100k (4277 → 4465 MB).** Indica que o working set do pipeline já saturou — mais contatos não enchem mais memória, apenas processam por mais tempo. CPU peak também relativamente estável (156% → 181% num WSL2 de ~6 cores efetivos). **Não é o limite de RAM/CPU que vai quebrar primeiro — é o p95 do INSERT síncrono do packer.**

4. **`event-process` queue ficou em 0 nos snapshots do sidecar** — artefato de polling (sample a cada 10s), não bug. Logs do container confirmam processamento ativo durante o drain. Pra ver a queue se enchendo nas próximas rodadas, reduzir `--interval` no `_shared/metrics/collect.mjs` ou usar a métrica `processed` do Bull em vez de `depth`.

5. **Mock SendGrid funciona, mas precisa de setup explícito.** O `apps/sendgrid-mock` só dispara eventos sintéticos se o webhook estiver registrado (`POST /v3/user/webhooks/event/settings`) AND a account tiver `accounts_configs.sendgrid_key` começando com `SG.`. O `seed-campaign.ts` planta os dois antes do trigger.

## Próximos passos

- [ ] Antes de 250k+: investigar fragmentação ou background-isolation do INSERT em `create-contacts-send` (sem isso, 250k já estoura p95 5s e 500k+ vira inviável).
- [ ] Anexar este `results.md` ao card [EVO-1027](https://linear.app/evoai/issue/EVO-1027) e linkar do roll-up [EVO-1442](https://linear.app/evoai/issue/EVO-1442).
- [ ] Quebrar a coluna "RAM peak" / "CPU peak" por container nos próximos relatórios (raw já tem o dado).
- [ ] Reduzir `--interval` do sidecar pra 2-5s pra capturar bursts curtos de send-email e event-process.
- [ ] Fase B (staging Hetzner / EVO-1026): tentativa de hoje (24/05) não convergiu — `send-email` consumer ack mas trabalho silencioso após receive AMQP, provável race do Bull/Redis dentro do handler. Próxima sessão ataca isso (ver `WORKING-ON-TESTS`).
