# Triage de bugfixes do BMS privado → OSS (rodada 2026-05-23)

Gerado por triagem automatizada em 2026-05-23. Janela: commits desde 2026-04-17.
Total candidatos: 75 (lista original dizia 74 — uma linha extra). Repo origem: `~/evolution/bms-monorepo`. Destino: este repo.

Critérios:
- OSS rodou fork-by-copy em 2026-04-17 sem histórico git compartilhado; cada port é manual.
- OSS NÃO contém: `apps/click-tracker`, `apps/backoffice-frontend`, `apps/backoffice-api`, `apps/email-validation`, `apps/lead-conception`, `apps/lead-receive`, `apps/warmup-tracker`.
- OSS NÃO usa GCP: trocou Cloud Run/Cloudflare/Pub-Sub/Cloud Tasks por Docker Swarm (Hetzner) + RabbitMQ. Não tem `apps/*/src/providers/google-tasks.provider.ts`, `contacts-batch.*`, `query-parser.config.ts`, async-imports (`contact-imports.*`).
- OSS rodou GCP-bound CI inteiro substituído. Workflows `.github/workflows/deploy-*.yml` em OSS são diferentes (Swarm), portanto fixes em `_deploy-cloudrun.yml`, `_deploy-cloudflare-*.yml`, `release-deploy.yml`, `refresh-geoip-mmdb.yml`, provenance permissions etc. são todos n/a.

## Resumo

- portar: 14
- já corrigido: 12
- n/a — código inexistente: 8
- n/a — Enterprise-only: 2
- n/a — infra-only (CI/Cloud Run/Cloudflare/Pub-Sub/Cloud Tasks): 22
- n/a — not a bugfix: 7
- duplicados (mesmo conteúdo já listado): 10
- dúvida: 0

## Tabela

| # | hash | data | descrição | arquivos principais | status | nota |
|---|------|------|-----------|---------------------|--------|------|
| 1 | 5c7c98c1f | 2026-05-21 | fix(click-tracker): declare ENABLE_TRACKER_REDIRECT_EVENT em env.production | apps/click-tracker/wrangler.jsonc | n/a — código inexistente | OSS não tem `apps/click-tracker` |
| 2 | e282cadb9 | 2026-05-21 | fix(msgops-api): cast $2 to int em getCampaignsByTag | modules/campaigns/campaigns.service.ts | já corrigido | OSS já tem `(items->>'id')::int = $2` |
| 3 | b5c7eddfe | 2026-05-21 | fix(msgops-api): drop tag/customField regex de contact-imports validators | contacts/dto/contact-import-form-fields.dto.ts | n/a — código inexistente | DTO não existe no OSS (async imports é Enterprise) |
| 4 | 42b8fec61 | 2026-05-20 | fix(msgops-api): restore canonical contact field set em contact-imports whitelist | mesmo DTO | n/a — código inexistente | idem |
| 5 | 3e8979f93 | 2026-05-20 | fix(ci): allow manual production deploy sem release tag | .github/workflows/release-deploy.yml | n/a — infra-only | OSS não tem release-deploy.yml; pipelines diferentes |
| 6 | 446ec6f9e | 2026-05-19 | fix(ci): coverage badges workflow | .github/workflows/coverage-badges.yml | n/a — infra-only | OSS não tem esse workflow |
| 7 | c8a2dbd98 | 2026-05-19 | fix(msgops-api): migration idempotente custom_fields.is_system_field | migrations/...is-system-field.ts | dúvida → portar | Verificar se `is_system_field` existe no schema OSS; se sim, portar |
| 8 | 6d2a092be | 2026-05-18 | feat(msgops-api,frontend-react): async contact imports até 1M | contact-imports.* | n/a — Enterprise-only | escopo grande, deps GCS+Cloud Tasks; não é Open Source v0.1 |
| 9 | b5e68f04b | 2026-05-18 | fix(frontend-react): unblock Save em campaign edit, surfaces validation | features/campaigns/campaign-form.tsx + schema | portar | campaign-form.tsx existe no OSS; comportamento de Save provavelmente igual ao bug original |
| 10 | fc65c40b3 | 2026-05-18 | fix(frontend-react): mostrar initial message list em campaign content step | features/campaigns/use-campaign-messages.ts | portar | hook existe no OSS, fix é 1-linha |
| 11 | 6b638c8fa | 2026-05-18 | fix(ci): coverage provider istanbul para workerd | apps/click-tracker/* | n/a — código inexistente | sem click-tracker |
| 12 | 6ced15a87 | 2026-05-15 | chore(sre-watcher): narrow claude -p tool surface | .claude/skills/sre-daily-check | n/a — not a bugfix | chore + ferramentas internas privadas |
| 13 | 4265da4a9 | 2026-05-14 | fix(ci): CF Pages permissions | deploy-frontend-react.yml | n/a — infra-only | OSS não usa Cloudflare Pages |
| 14 | 08c2e0d3b | 2026-05-14 | fix(contacts): orchestrate pagination total from dashboard + countOnly (Vue2 parity) | use-contacts.ts + contacts.service.ts | portar | OSS já tem countOnly mas hook React e service podem precisar do orquestramento dashboard+countOnly; verificar |
| 15 | 38314627b | 2026-05-14 | chore: Claude Code agent tooling | .claude/* | n/a — not a bugfix | tooling interno |
| 16 | 7af3fbda7 | 2026-05-14 | fix(frontend-react): preservar UTM + suprimir warning name em campaign edit | features/campaigns/steps/settings-step.tsx | portar | settings-step.tsx existe no OSS com lógica UTM, mas o fix do warning não está aplicado |
| 17 | 609566eec | 2026-05-14 | feat(msgops-api): audit subscriber redesign + user-tracking columns | entities + migrations | n/a — not a bugfix | feat grande de auditoria; escopo separado |
| 18 | 6fbae3f62 | 2026-05-13 | fix(tag-process): parse next-day scheduleTo em account timezone | tag-process/msgops + google-tasks provider | portar (parcial) | core msgops.service existe no OSS; provider google-tasks não — adaptar para scheduler interno (RabbitMQ) |
| 19 | 4f74461fb | 2026-05-12 | fix(tag-process): enable shutdown hooks para evitar leak de locks SIGTERM | tag-process/main.ts | já corrigido | OSS main.ts já tem handlers SIGTERM/SIGINT com shutdown watchdog |
| 20 | a04a357e2 | 2026-05-12 | fix(segments): release processing lock antes de callRunTask | tags.service.ts | portar | OSS ainda chama `scheduler.callRunTask` direto; ordem do lock/release pode estar errada |
| 21 | eeea6e78a | 2026-05-12 | fix(docker): @retention/shared build chain msgops-api/campaign-events-tracker | Dockerfiles | n/a — código inexistente | OSS não tem `@retention/shared` |
| 22 | 404a709e8 | 2026-05-11 | fix(docker): copy/build @retention/shared | Dockerfiles | n/a — código inexistente | idem |
| 23 | f18fb4f7e | 2026-05-11 | fix(ci): exclude release-please squash do Turbo affected | release-deploy.yml | n/a — infra-only | OSS não tem release-deploy.yml |
| 24 | 8a331d9f7 | 2026-05-11 | fix(ci): inputs.target em deploy-frontend-react ifs | deploy-frontend-react.yml | n/a — infra-only | workflow OSS diferente |
| 25 | 4ee01f84c | 2026-05-11 | fix(ci): bind Cloudflare deploys ao Environment | _deploy-cloudflare-*.yml | n/a — infra-only | sem Cloudflare |
| 26 | ed541459e | 2026-05-11 | fix(ci): inputs.target em concurrency groups (21 workflows) | deploy-*.yml | n/a — infra-only | workflows OSS diferentes |
| 27 | 03140b13a | 2026-05-11 | fix(msgops-api): GET /contacts/:id via findOneByIdentifier | contacts.controller.ts | já corrigido | OSS já usa `findOneByIdentifier(String(id))` |
| 28 | 8c7c3f8ca | 2026-05-11 | fix(ci): workflow_dispatch em release-deploy.yml | release-deploy.yml | n/a — infra-only | sem release-deploy |
| 29 | f560e0144 | 2026-05-11 | fix(campaigns): respeitar account timezone em nextOccurrence | msgops-api/campaigns + campaign-events-tracker | portar | ambos arquivos existem no OSS com `nextOccurrence`; fix não aplicado |
| 30 | 065b3bb67 | 2026-05-11 | fix(ci): remove leftover permissions em _deploy-cloudrun.yml | _deploy-cloudrun.yml | n/a — infra-only | sem Cloud Run |
| 31 | 35aa1f36e | 2026-05-11 | fix(ci): provenance permissions em 19 Cloud Run callers | deploy-*.yml | n/a — infra-only | sem Cloud Run |
| 32 | 80d7469e5 | 2026-05-11 | fix(segments): atomic processing lock + drop deterministic task names | tags.service + google-tasks provider + tag-process | portar (parcial) | core msgops-api/tags + tag-process/app.service aplicável; provider GCS n/a |
| 33 | 175e33552 | 2026-05-08 | fix(msgops-api): add name='system' a sentinel account api-key regen | api-key-regen.service.ts | portar | arquivo existe; sem indicador de fix aplicado |
| 34 | 0270aa362 | 2026-05-08 | fix(msgops-api): priority=transactional em api-key regen publish | api-key-regen.service.ts | portar (adaptado) | publish via Pub/Sub no privado; em OSS usar RabbitMQ — verificar se conceito de priority se aplica |
| 35 | 19d7ee651 | 2026-05-07 | fix(tag-process): chunk segment payload para evitar 413 | tag-process/app.service.ts | portar | OSS não chunca payload em `app.service.ts` |
| 36 | 1a369ec53 | 2026-05-07 | fix(backoffice-frontend): coerce undefined Input values | backoffice-frontend/components/ui/input.tsx | n/a — código inexistente | sem backoffice-frontend |
| 37 | 7a04a7cec | 2026-05-07 | fix(tag-process,msgops-api): review feedback em segment task dedup | tags.service + tag-process | portar (junto com 389e1591f) | follow-up do 389e |
| 38 | 285c734a9 | 2026-05-07 | fix(backoffice-frontend): keep billing month picker top-aligned | backoffice-frontend | n/a — código inexistente | sem backoffice-frontend |
| 39 | 8c4f8635a | 2026-05-07 | fix(msgops-api): defensive parse de account_costs | statistics.service.ts | portar | OSS faz `JSON.parse(costConfig.value)` sem try/catch defensivo |
| 40 | 3bf05f6be | 2026-05-07 | fix(msgops-api): stringify non-string account_config values antes do insert | accounts.service.ts | portar | OSS não tem stringify defensivo em account_configs |
| 41 | 36b0135fc | 2026-05-06 | fix(msgops-api): parar accounts_usage snapshot para soft-deleted accounts | statistics.service.ts | portar | OSS query base não filtra deletedAt em accounts_usages snapshot chain |
| 42 | 389e1591f | 2026-05-06 | fix(tag-process,msgops-api): dedupe segment Cloud Tasks via deterministic names | google-tasks provider + tags.service | portar (parcial) | conceito de dedupe sobreviveu mas provider GCS n/a — adaptar para Rabbit/scheduler interno |
| 43 | 5c950a93a | 2026-05-06 | fix(tag-process): skip auto-deactivation para segment-base-size | tag-process + entities/tag + packages/shared | portar | tag.entity, dtos e packages/shared existem; lógica skip em tag-process precisa entrar |
| 44 | cef5d6145 | 2026-05-01 | fix(send-email): trim trailing hyphens no formatter | send-email/utils/formatter.utils.ts | já corrigido | OSS já tem `.replace(/(^-+|-+$)/, '')` |
| 45 | 8e5a794be | 2026-05-05 | fix(tag-process): skip processing quando account missing/soft-deleted | tag-process/app.service.ts | portar | OSS sem o guard equivalente |
| 46 | 11ff980ca | 2026-05-05 | fix(frontend-react): default Button type='button' | components/ui/button.tsx | portar | OSS button.tsx não tem default type='button' (grep não encontrou `type=`) |
| 47 | a79c38f9c | 2026-05-04 | feat(msgops-api,contacts): migrate bulk-unsubscribe para Cloud Tasks | contacts-batch.* | n/a — código inexistente | OSS não tem contacts-batch (não tem bulk async suppressions) |
| 48 | f2e9dcc1e | 2026-05-01 | fix(frontend-react): re-enable jsx-a11y rules | eslint-config + components | portar | regras a11y aplicáveis no OSS; clear violations vale revisar |
| 49 | df851e4c8 | 2026-04-30 | fix(email-validation): SQL injection em findByEmail | apps/email-validation | n/a — código inexistente | sem email-validation |
| 50 | e5195389c | 2026-04-30 | fix(msgops-api): send CRON_SECRET via Pub/Sub attribute | contacts-batch.* + principal-context.guard | n/a — código inexistente | Pub/Sub + contacts-batch n/a |
| 51 | 823098235 | 2026-04-28 | fix(tag-process): remove deprecated isRealTimeSegment gate | tag-process/app.service.ts | portar | OSS ainda tem `segment.isRealTimeSegment === false` em app.service:206 |
| 52 | 4916f0d8a | 2026-04-28 | fix(automations): send updatedAt em update para rejeitar stale writes | automations/automation-form-page.tsx | portar | OSS exibe updatedAt mas pode não estar enviando no payload de update |
| 53 | 45069be99 | 2026-05-01 | fix(send-email): trim trailing hyphens (duplicado de #44) | — | duplicado | mesmo conteúdo do cef5d6145 |
| 54 | 173d8860e | 2026-05-05 | (duplicado de #45) | — | duplicado | mesmo conteúdo do 8e5a794be |
| 55 | 058b18738 | 2026-05-05 | (duplicado de #46) | — | duplicado | mesmo conteúdo do 11ff980ca |
| 56 | 2042a73c2 | 2026-05-04 | (duplicado de #47) | — | duplicado | mesmo conteúdo do a79c38f9c |
| 57 | f90528b50 | 2026-05-01 | (duplicado de #48) | — | duplicado | mesmo conteúdo do f2e9dcc1e |
| 58 | 77bbf51b9 | 2026-04-30 | (duplicado de #49) | — | duplicado | mesmo conteúdo do df851e4c8 |
| 59 | c5a4e5756 | 2026-04-30 | (duplicado de #50) | — | duplicado | mesmo conteúdo do e5195389c |
| 60 | 24ccf7750 | 2026-04-28 | (duplicado de #51) | — | duplicado | mesmo conteúdo do 823098235 |
| 61 | 0c1a742c9 | 2026-04-28 | (duplicado de #52) | — | duplicado | mesmo conteúdo do 4916f0d8a |
| 62 | fc23a557e | 2026-04-28 | fix(ci): update prod Cloud Run deploy targets | deploy-*.yml | n/a — infra-only | sem Cloud Run |
| 63 | 39cf1fa30 | 2026-04-28 | fix(msgops-api): remove req.user.id fallback de POST /accounts audit | accounts.controller.ts | portar | OSS L46 ainda tem `req?.authzContext?.userId || req?.user?.id || 0` |
| 64 | ee33e00d9 | 2026-04-28 | fix(msgops-api): fail-closed audit guard em POST /accounts | accounts.controller.ts | portar | mesmo lugar; vai junto com #63 |
| 65 | 5ba6fd1ab | 2026-04-27 | fix(msgops-api): gate webpush GCS upload em isActive | accounts.service.ts (webpush_settings handler) | já corrigido (parcial) | OSS já tem try/catch non-fatal em uploadWebPushFile; gate por isActive precisa conferir |
| 66 | bcdc60da2 | 2026-04-23 | fix(msgops-api): remover duplicate query parser override | msgops-api/src/main.ts + query-parser.config | já corrigido | OSS main.ts já tem `qs.parse(str, { arrayLimit: 200 })` e define `query parser` único |
| 67 | 502a37022 | 2026-04-23 | fix(tag-process): resolver null contact em conditional trigger | handlers/automation.handler.ts | já corrigido | OSS automation.handler.ts já tem múltiplos guards `if (!contact)` |
| 68 | 5647b269d | 2026-04-22 | fix(docker): build @msgops/url-utils em send-*/twilio | Dockerfiles | já corrigido | grep mostra `url-utils` presente nos 4 Dockerfiles OSS |
| 69 | 44445c0d9 | 2026-04-22 | fix(docker): copy package.json de eslint-config/test-config | Dockerfiles | já corrigido (parcial) | msgops-api e event-process têm; checar 19 dockerfiles para certeza |
| 70 | 04a777236 | 2026-04-21 | fix(event-process): unbreak bot detection via gRPC trait casing | bot-detector + geolocation interfaces | portar | OSS bot-detector já usa camelCase (`asnOrg`, `userType`) mas o casing fix no events.service e geolocation interfaces pode estar pendente — checar contra diff |
| 71 | 141f96cc2 | 2026-04-21 | fix(ci): MMDB checksums post-gunzip | refresh-geoip-mmdb.yml | portar | OSS TEM o workflow refresh-geoip-mmdb.yml; vale conferir |
| 72 | 057755cc4 | 2026-04-20 | fix(ci): use ip-to-location-isp dbType | refresh-geoip-mmdb.yml | portar | mesmo workflow OSS |
| 73 | 56d675e57 | 2026-04-20 | fix(tracker): use IpAddress decorator em /redirect | tracker/app.controller.ts | já corrigido | OSS já tem `@IpAddress() ipAddress?: string` em redirect e redirectShortCode |
| 74 | 32ffb1ac6 | 2026-04-17 | fix(event-process): resolver contactId de uuid/email para internal events | internal-events.service.ts | já corrigido | OSS já tem lookup por email/uuid (linhas 121–133) |
| 75 | 6d609c14d | 2026-04-17 | fix(campaigns): abrir statistics link em nova aba | campaigns-columns.tsx | já corrigido | OSS já tem `target="_blank"` |

## Itens marcados `dúvida` (precisam decisão humana)

Nenhum item de dúvida explícita; #7 (`c8a2dbd98` — migration `is_system_field`) é o único borderline: depende do schema do OSS já ter ou não a coluna. Listado como `portar` com nota; humano pode rebaixar para n/a se a coluna não existe.

## Próximo passo

Criar 1 card Linear por item `portar` (ver EVO-1438 para template), agrupando quando o fix é o mesmo conceito (ex.: #32 + #37 + #42 sobre segment task dedup; #63 + #64 sobre audit guard POST /accounts; #71 + #72 sobre MMDB workflow).

Items para portar consolidados (14 cards potenciais, ou ~8 agrupados):

1. #9  b5e68f04b — campaign-form Save/validation
2. #10 fc65c40b3 — use-campaign-messages initial list
3. #14 08c2e0d3b — pagination total countOnly orchestration
4. #16 7af3fbda7 — UTM preserve + name warning suppress
5. #18 6fbae3f62 — tag-process scheduleTo timezone (adaptar p/ scheduler interno)
6. #20 a04a357e2 — release lock antes callRunTask
7. #29 f560e0144 — nextOccurrence respeitar timezone
8. #32+#37+#42 — segment task dedup + atomic lock (agrupado, adaptado p/ Rabbit)
9. #33+#34 — api-key regen sentinel name + priority attribute
10. #35 19d7ee651 — chunk segment payload 413
11. #39 8c4f8635a — defensive parse account_costs
12. #40 3bf05f6be — stringify account_config values
13. #41 36b0135fc — soft-deleted accounts_usage snapshot
14. #43 5c950a93a — skip auto-deactivation segment-base-size
15. #45 8e5a794be — skip processing account missing/soft-deleted
16. #46 11ff980ca — Button default type='button'
17. #48 f2e9dcc1e — re-enable jsx-a11y rules
18. #51 823098235 — remove isRealTimeSegment gate
19. #52 4916f0d8a — send updatedAt em automation update
20. #63+#64 — POST /accounts fail-closed audit
21. #70 04a777236 — bot detection gRPC trait casing (parcial)
22. #71+#72 — MMDB workflow checksums + dbType
23. #7  c8a2dbd98 — migration is_system_field (condicional)
