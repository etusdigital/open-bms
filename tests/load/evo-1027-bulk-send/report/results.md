# EVO-1027 — Resultados (local)

Rodada inicial em `docker compose up` na máquina do Gui (WSL2). Escada `1k → 10k → 50k` — primeira validação do pipeline. Próximas rodadas continuam de 100k.

p95 do trigger é p95 real (k6 com `ITERATIONS=10`), não amostra única.

## Tabela

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain | Status                                         |
| ------ | -------- | -------- | -------- | ----------- | ----- | ---------------------------------------------- |
| 1k     | local    | 560 MB   | 106.0 %  | 0.09 s      | 137s  | ok ⚠️ event-process not exercised (total=138s) |
| 10k    | local    | 1784 MB  | 115.5 %  | 0.19 s      | 675s  | ok ⚠️ event-process not exercised (total=678s) |
| 50k    | local    | 4421 MB  | 289.7 %  | 1.33 s      | 669s  | ok ⚠️ event-process not exercised (total=680s) |

> **RAM/CPU peak** vêm do sidecar `_shared/metrics/collect.mjs` agregando todos os containers da stack (não por container ainda — a coluna fica simples; raw em `report/raw/<run-ts>/<level>-metrics/docker-stats.csv` se quiser refatiar).

## Observações importantes

1. **p95 trigger sobe linear com o volume (0.09s → 0.19s → 1.33s).** O endpoint `create-contacts-send` é síncrono no `INSERT INTO campaigns_contacts ... SELECT ${campaign.query}` — pra 50k contatos, leva ~1.3s. Pra 1M projeta-se >25s, o que já estoura o critério de 5s. **Isto sozinho deve ser o primeiro limite** na escada — vale checar o plano de fragmentar esse insert ou movê-lo pra background.

2. **Drain 10k e 50k essencialmente iguais (~670s).** Isso é o **delay determinístico de 60s** do `campaign-schedule-page` (`spreadSending=0` → `millisecond=60000ms` fallback em `campaign.service.ts`) + ~10–11min de processamento. Como o packer paraleliza páginas, 5x mais contatos não multiplicou o tempo. Suspeito que o gargalo real do drain venha do **send-email + sendgrid-mock**, não do packer.

3. **`event-process` queue ficou em 0 o tempo todo** — bloqueado por [EVO-1445](https://linear.app/evoai/issue/EVO-1445) (env mismatch `DATABASE_*` vs `TYPEORM_*` no `event-process`). Resultado: ECONNREFUSED a cada evento, retry exponencial, eventos se acumulam no `events` queue / DLQ. **Os números aqui medem o pipeline `campaign → packer → send-email → sendgrid-mock` mas NÃO a ingestão de eventos.** A coluna Status anota isso unconditionally até EVO-1445 ser fechado.

4. **Mock SendGrid funciona, mas precisa de setup explícito.** O `apps/sendgrid-mock` só dispara eventos sintéticos se o webhook estiver registrado (`POST /v3/user/webhooks/event/settings`) AND a account tiver `accounts_configs.sendgrid_key` começando com `SG.`. O `seed-campaign.ts` planta os dois antes do trigger.

5. **RAM/CPU peak desta rodada > anterior** (50k: 4421 MB / 289 % vs 2158 MB / 144 %). Stack ficou de pé entre runs acumulando state (caches, conexões idle) — não é regressão, é noise de ambiente. Pra números limpos por nível, recomendado restartar a stack antes de cada escada.

## Próximos passos

- [ ] Subir escada para 100k → 250k → 500k → 1M (`run.sh --max 1M`, continuar populando esta tabela)
- [ ] Anexar este `results.md` ao card [EVO-1027](https://linear.app/evoai/issue/EVO-1027) e linkar do roll-up [EVO-1442](https://linear.app/evoai/issue/EVO-1442)
- [ ] Aguardar fix de [EVO-1445](https://linear.app/evoai/issue/EVO-1445) e re-rodar a escada cobrindo o leg de ingestão
- [ ] Quebrar a coluna "RAM peak" / "CPU peak" por container nos próximos relatórios (raw já tem o dado)
- [ ] Fase B (staging Hetzner / EVO-1026) — fora deste PR
