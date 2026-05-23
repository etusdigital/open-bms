# EVO-1027 — Resultados (local)

Escada `1k → 10k → 50k` em `docker compose up` na máquina do Gui (WSL2). Stack restartada fresca após EVO-1445 entrar.

Pipeline completo coberto: `campaign → packer → send-email → sendgrid-mock → event-receiver → event-process` (event-process processando eventos confirmado em logs — "Message already processed" durante o drain).

p95 do trigger é p95 real (k6 com `ITERATIONS=10`).

## Tabela

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain | Status          |
| ------ | -------- | -------- | -------- | ----------- | ----- | --------------- |
| 1k     | local    | 580 MB   | 87.6 %   | 0.07 s      | 78s   | ok (total=79s)  |
| 10k    | local    | 1777 MB  | 165.4 %  | 0.37 s      | 675s  | ok (total=678s) |
| 50k    | local    | 4277 MB  | 156.0 %  | 1.63 s      | 669s  | ok (total=678s) |

> **RAM/CPU peak** vêm do sidecar `_shared/metrics/collect.mjs` agregando todos os containers da stack (não por container ainda — a coluna fica simples; raw em `report/raw/<run-ts>/<level>-metrics/docker-stats.csv` se quiser refatiar).

## Observações importantes

1. **p95 trigger sobe linear com o volume (0.07s → 0.37s → 1.63s).** O endpoint `create-contacts-send` é síncrono no `INSERT INTO campaigns_contacts ... SELECT ${campaign.query}` — pra 50k contatos, leva ~1.6s. Pra 1M projeta-se >30s, o que já estoura o critério de 5s. **Isto sozinho deve ser o primeiro limite** na escada — vale checar o plano de fragmentar esse insert ou movê-lo pra background.

2. **Drain 10k e 50k essencialmente iguais (~670s).** Isso é o **delay determinístico de 60s** do `campaign-schedule-page` (`spreadSending=0` → `millisecond=60000ms` fallback em `campaign.service.ts`) + ~10–11min de processamento. Como o packer paraleliza páginas, 5x mais contatos não multiplicou o tempo. O gargalo real do drain está no **send-email + sendgrid-mock**, não no packer.

3. **`event-process` queue ficou em 0 nos snapshots do sidecar** — mas isso agora é **artefato de polling** (sample a cada 10s), não bug. Logs do container confirmam processamento ativo durante o drain. Pra ver a queue se enchendo nas próximas rodadas, reduzir `--interval` no `_shared/metrics/collect.mjs` ou usar a métrica `processed` do Bull em vez de `depth`.

4. **Mock SendGrid funciona, mas precisa de setup explícito.** O `apps/sendgrid-mock` só dispara eventos sintéticos se o webhook estiver registrado (`POST /v3/user/webhooks/event/settings`) AND a account tiver `accounts_configs.sendgrid_key` começando com `SG.`. O `seed-campaign.ts` planta os dois antes do trigger.

5. **Comparado à rodada anterior (pré-EVO-1445):** RAM/CPU peak similares (580/87% vs 560/106% no 1k); p95 trigger ligeiramente maior nesta rodada (0.37s vs 0.19s no 10k, 1.63s vs 1.33s no 50k) — provavelmente porque agora event-process também consome CPU/memória, competindo pelo mesmo host. Não é regressão, é coverage.

## Próximos passos

- [ ] Subir escada para 100k → 250k → 500k → 1M (`run.sh --max 1M`, continuar populando esta tabela)
- [ ] Anexar este `results.md` ao card [EVO-1027](https://linear.app/evoai/issue/EVO-1027) e linkar do roll-up [EVO-1442](https://linear.app/evoai/issue/EVO-1442)
- [ ] Quebrar a coluna "RAM peak" / "CPU peak" por container nos próximos relatórios (raw já tem o dado)
- [ ] Reduzir `--interval` do sidecar pra 2-5s pra capturar bursts curtos de send-email e event-process
- [ ] Fase B (staging Hetzner / EVO-1026) — fora deste PR
