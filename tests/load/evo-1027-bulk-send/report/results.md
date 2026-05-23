# EVO-1027 — Resultados (local)

Rodada inicial em `docker compose up` na máquina do Gui (WSL2). Escada `1k → 10k → 50k` — primeira validação do pipeline. Próximas rodadas continuam de 100k.

## Tabela

| Volume | Ambiente | RAM peak | CPU peak | p95 trigger | Drain | Status             |
| ------ | -------- | -------- | -------- | ----------- | ----- | ------------------ |
| 1k     | local    | 466 MB   | 91.3 %   | 0.08 s      | 79s   | ✅ ok (total=81s)  |
| 10k    | local    | 1394 MB  | 101.8 %  | 0.20 s      | 674s  | ✅ ok (total=674s) |
| 50k    | local    | 2158 MB  | 144.6 %  | 1.10 s      | 677s  | ✅ ok (total=679s) |

> **RAM/CPU peak** vêm do sidecar `_shared/metrics/collect.mjs` agregando todos os containers da stack (não por container ainda — a coluna fica simples; raw em `report/raw/<run-ts>/<level>-metrics/docker-stats.csv` se quiser refatiar).

## Observações importantes

1. **p95 trigger sobe linear com o volume (0.08s → 0.20s → 1.10s).** O endpoint `create-contacts-send` é síncrono no `INSERT INTO campaigns_contacts ... SELECT ${campaign.query}` — pra 50k contatos, leva ~1s. Pra 1M projeta-se >20s, o que já estoura o critério de 5s. **Isto sozinho deve ser o primeiro limite** na escada — vale checar o plano de fragmentar esse insert ou movê-lo pra background.

2. **Drain 10k e 50k essencialmente iguais (~675s).** Isso é o **delay determinístico de 60s** do `campaign-schedule-page` (`spreadSending=0` → `millisecond=60000ms` fallback em `campaign.service.ts`) + ~10–11min de processamento. Como o packer paraleliza páginas, 5x mais contatos não multiplicou o tempo. Suspeito que o gargalo real do drain venha do **send-email + sendgrid-mock**, não do packer.

3. **event-process queue ficou em 0 o tempo todo** — mas é por **bug pré-existente**, não porque drenou: `event-process` lê `DATABASE_HOST`/`DATABASE_PORT` (`apps/event-process/src/providers/db.provider.ts`) e essas envs **não existem** no `docker-compose.yml` (que define `TYPEORM_HOST`/`TYPEORM_PORT`). Resultado: ECONNREFUSED a cada evento, retry exponencial, eventos se acumulam no `events` queue / DLQ. **Os números aqui medem o pipeline `campaign → packer → send-email → sendgrid-mock` mas NÃO a ingestão de eventos.** Fix proposto pra abrir ticket separado: adicionar `DATABASE_HOST: postgres` e `DATABASE_PORT: '5432'` ao `x-backend-env` em `docker-compose.yml`.

4. **Mock SendGrid funciona, mas precisa de setup explícito.** O `apps/sendgrid-mock` só dispara eventos sintéticos se o webhook estiver registrado (`POST /v3/user/webhooks/event/settings`) AND a account tiver `accounts_configs.sendgrid_key` começando com `SG.`. O `seed-campaign.ts` planta os dois antes do trigger.

## Próximos passos

- [ ] Subir escada para 100k → 250k → 500k → 1M (continuar populando esta tabela)
- [ ] Anexar este `results.md` ao card [EVO-1027](https://linear.app/evoai/issue/EVO-1027) e linkar do roll-up [EVO-1442](https://linear.app/evoai/issue/EVO-1442)
- [ ] Abrir ticket separado pro bug de `DATABASE_HOST`/`DATABASE_PORT` faltando no compose (bloqueia event-process)
- [ ] Quebrar a coluna "RAM peak" / "CPU peak" por container nos próximos relatórios (raw já tem o dado)
- [ ] Fase B (staging Hetzner / EVO-1026) — fora deste PR
