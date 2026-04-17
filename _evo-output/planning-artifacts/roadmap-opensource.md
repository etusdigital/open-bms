# Roadmap de Implementação — BMS Open Source

Feature slug: `bms-opensource`
Owner: Davidson
Criado: 2026-04-16
Atualizado: 2026-04-16 (pós-reunião Davidson+Pet 16/abr + decisões travadas): escopo travado completo; **Datastore morto no código** (Fase 6 não existe); **Super Admin** vem do branch antigo GitLab (Vue 3 pronto); **Auth0 mantido no v0.1.0** (Fase 7 vira stretch goal); **Bridge AMQP via HTTP loopback** (double retry); **GeoDB** nova Fase 7.7 com DB-IP Lite; **sizing guide** na Fase 10; **Gui** (messaging) + **Danilo** (admin); lib `@bms/messaging`; `git filter-repo` pra limpar histórico; BigQuery removido.
Fase (dev-phases.md): Planning (execução)
Deadline: **26 de maio de 2026** (terça-feira)
Recursos: **2 devs sêniores full-time** (+ Davidson em suporte)

> **Nota:** este documento é o companion de `[C]plan-opensource.md`. O plan define o "o quê" e "por quê" com acceptance criteria. Este roadmap detalha o "quando" — agenda semana-a-semana com base na divisão de trilhas definida no plan.

---

## 1. Premissa

Davidson travou o escopo como completo: **18 apps**, Super Admin e Setup Wizard UI. O prazo é apertado por construção. A viabilidade vem de **paralelização disciplinada** entre 2 devs e **checkpoints duros** que detectam slippage cedo.

**Se um checkpoint falhar, a resposta é:** revisar alocação → reforçar → adiar launch 1 semana. **Não cortar escopo.**

---

## 2. Estratégia de paralelização (resumo)

Duas trilhas independentes, caminhos críticos balanceados:

- **Trilha A (Dev A (Gui)) — Messaging & Apps (caminho crítico):** Fases 0 → 1 (lib + **bridge HTTP**) → 2 → 3 → 4 → 5 → 9
- **Trilha B (Dev B (Danilo)) — Admin & Config (com folga real):** 7.5 (Wizard) → 7.6 (Super Admin — **polir `msgops-manager-frontend` já existente no monorepo**) → 7.7 (GeoDB DB-IP Lite) → 8 → 10 (docs + sizing guide) → **[Fase 7 Auth local = stretch goal, só se sobrar tempo]**.
- **Eliminado:** Fase 6 (Datastore morto). Auth0 fica no v0.1.0.
- **Convergência:** S5 em polimento cruzado, smoke tests, docs finais

Detalhes da divisão, handoffs e regra de ouro estão na seção "Paralelização" do `[C]plan-opensource.md`.

---

## 3. Orquestração dia-a-dia (Gui + Danilo em paralelo)

**Princípio:** 2 devs sêniores no caminho crítico desde o dia 1. Gui destrava Danilo com o playbook da Fase 2 no fim da S2; a partir da S3 ambos migram apps em paralelo. Nenhum dev fica parado esperando o outro.

### Divisão dos apps (Fase 3)

| Onda | Apps | Quem | Quando |
|---|---|---|---|
| Piloto | `event-receiver` | **Gui** (produz playbook) | S2 qua 29–qui 30/abr |
| 1 | `send-email`, `event-process`, `tracker` | **Gui** | S3 seg 4–qua 6/mai |
| 2 | `send-push`, `send-whatsapp`, `twilio-messaging` | **Gui** | S3 sex 8 → S4 seg 11–ter 12/mai |
| 3 | `lead-receive`, `lead-conception` | **Danilo** | S3 seg 4–ter 5/mai |
| 4 | `tag-process`, `message-trigger`, `campaign-packer` | **Danilo** (combina Pub/Sub + BullMQ no mesmo PR) | S3 qui 7 → S4 seg 11/mai |
| Extra | `campaign-events-tracker` (só BullMQ) | **Danilo** | S4 ter 12/mai |
| Hub | `msgops-api` | **Gui** (último, crítico) | S5 seg 18–qua 20/mai |

**Total:** Gui = 8 apps (piloto + 3 + 3 + msgops). Danilo = 6 apps (2 + 3 + 1 só-BullMQ).

---

### Semana 1 (20–26 abril) — Fundação paralela

| Dia | Gui | Danilo |
|---|---|---|
| Seg 20 | Fase 0: scan git, limpeza `.env`, remover código morto Datastore | Fase 0: inventário `apps/` + **análise `msgops-manager-frontend` existente** (features Etus-specific, CI GitLab, `.env.example`) |
| Ter 21 | Fase 1 start: design bridge HTTP + Publisher skeleton | Fase 7.5 start: detecção banco vazio + rota `/setup` + passo 1 (admin via seeder + Auth0) |
| Qua 22 | Fase 1: Publisher + testes unitários | Fase 7.5: passo 2 SMTP (form + botão "enviar teste") |
| Qui 23 | Fase 1: Consumer AMQP + retry com backoff | Fase 7.5: passo 3 domínio + passo 4 IP pool opcional |
| **Sex 24 16h** | **Standup 30min:** travar nomenclatura AMQP, contrato bridge HTTP, status | |

**Davidson em paralelo:** responder Open Questions restantes, agendar checkpoints no Calendar, coletar sizing com Pet.

**Entregável fim S1:**
- Git history limpo, `.env` fora do repo, 18 apps confirmados, Datastore morto removido
- Lib `@bms/messaging` com Publisher funcional + design bridge HTTP documentado
- Wizard UI passos 1-4 clicáveis em VM local

---

### Semana 2 (27 abr – 3 mai) — Piloto + Wizard fecha

| Dia | Gui | Danilo |
|---|---|---|
| Seg 27 | Fase 1 close: Consumer + DLQ + circuit breaker + graceful shutdown | Fase 7.5: passo 5 health check dos serviços |
| Ter 28 | Fase 1 close: testes integração (testcontainers RabbitMQ) | Fase 7.5 close: flag `setup_complete` + E2E do wizard |
| Qua 29 | Fase 2 start: migrar `event-receiver` (piloto) end-to-end | Fase 7.6 start: rodar `msgops-manager-frontend` local, remover features Etus-specific identificadas, trocar `.gitlab-ci.yml` por GitHub Actions |
| Qui 30 | Fase 2: validar DLQ + **documentar `[C]migration-pattern.md`** (playbook) | Fase 7.6: ajusta imports, plugar endpoints `msgops-api` **não migrada** (fallback provisório) |
| **Sex 1/mai 18h** | **🚨 CHECKPOINT 1** (30min): lib done, piloto rodando, wizard 1-5 completo, painel admin builda | |

**Entregáveis S2:** playbook publicado → **destrava Danilo pra S3**. Wizard E2E. Super Admin builda (features quebradas OK por ora).

**🚨 Checkpoint 1 (sex 1/mai):**
- [ ] Lib `@bms/messaging` feature-complete (Publisher + Consumer + **bridge HTTP double retry** + DLQ + graceful shutdown)
- [ ] `event-receiver` rodando contra RabbitMQ local (AMQP → consumer → HTTP → service OK)
- [ ] Wizard UI passos 1-5 acessíveis em VM virgem (botão "enviar teste SMTP" funcional)
- [ ] `msgops-manager-frontend` rodando local limpo (sem features Etus, sem GitLab CI, `.env.example` OK) contra msgops fallback
- [ ] Playbook `[C]migration-pattern.md` publicado

Se falhar: revisar alocação, daily extra, Davidson reforça. **Não cortar escopo.**

---

### Semana 3 (4–10 mai) — Migração dispara em paralelo 🔥

| Dia | Gui | Danilo |
|---|---|---|
| Seg 4 | Fase 3 Onda 1: `send-email` | Onda 3 start: `lead-receive` |
| Ter 5 | Fase 3 Onda 1: `event-process` | Onda 3: `lead-conception` |
| Qua 6 | Fase 3 Onda 1: `tracker` | Fase 7.6 core: ajustes UI accounts/users (enquanto lead-* roda CI) |
| Qui 7 | Fase 5: `@google-cloud/storage` → S3 em `send-email` + MinIO no compose | Onda 4 start: `tag-process` (**Pub/Sub + BullMQ no mesmo PR**) |
| Sex 8 | Fase 3 Onda 2 start: `send-push` | Onda 4: `message-trigger` (Pub/Sub + BullMQ) |
| **Sex 10 18h** | **🚨 CHECKPOINT 2 (crítico)** (30min): 3 apps Gui + 2-3 apps Danilo migrados; Super Admin base funcionando; smoke test pipeline | |

**Sincronização seg 4/mai:** alinhar contratos Super Admin (endpoints, shape de dados) — decidir o que fica e o que sai do painel original.

**Entregáveis S3:** 5-6 apps migrados. Fase 4 (BullMQ) sendo feita *junto* com Pub/Sub no Danilo. Fase 5 completa em `send-email`.

**🚨 Checkpoint 2 (sex 10/mai) — O MAIS CRÍTICO:**
- [ ] 3 apps Gui migrados (`send-email`, `event-process`, `tracker`)
- [ ] 2-3 apps Danilo migrados (`lead-receive`, `lead-conception`, `tag-process`)
- [ ] Super Admin base funcionando contra msgops fallback (accounts, users listam)
- [ ] `docker compose up` sobe infra + 6 apps migrados
- [ ] Zero regressão detectada em smoke test do pipeline de email

Se falhar: **Plano B** — revisão profunda, reforço Davidson, avaliar adiar launch 2/jun.

---

### Semana 4 (11–17 mai) — Fanout total + Super Admin funcional

| Dia | Gui | Danilo |
|---|---|---|
| Seg 11 | Onda 2: `send-whatsapp` | Onda 4: `campaign-packer` (Pub/Sub + BullMQ) |
| Ter 12 | Onda 2: `twilio-messaging` | Onda 4: `campaign-events-tracker` (BullMQ only) |
| Qua 13 | Fase 5: S3 em `msgops-api` (antecipa pra desbloquear Super Admin do Danilo na S5) | Fase 7.7 GeoDB: `packages/geo` + `DbIpProvider` + feature flag |
| Qui 14 | Buffer / bugfix / Fase 9 start (compose skeleton com 4 serviços infra) | Fase 7.7 GeoDB: integração em `tracker` + graceful degradation + teste |
| Sex 15 | Fase 9: compose com 4 serviços + 10 apps migrados | Fase 7.6 close: Super Admin funcional contra msgops fallback (ainda) |
| **Sex 15 18h** | **🚨 CHECKPOINT 3** (60-90min) — smoke test coletivo VM x86 virgem | |

**Entregáveis S4:** 10 apps migrados, GeoDB pronto, Super Admin funcional, compose skeleton. Restam `msgops-api` hub (Gui S5) + polimento.

**🚨 Checkpoint 3 (sex 15/mai):**
- [ ] `docker compose up` em VM x86 virgem sobe 10+ apps + infra em < 3 min
- [ ] Smoke test de envio de email passa E2E
- [ ] Super Admin carrega, lista accounts, mostra métricas (contra msgops fallback)
- [ ] GeoDB enriquece evento de tracking com cidade/estado em < 2ms
- [ ] `GEO_ENRICHMENT_ENABLED=false` → evento registrado sem geo, sem erro

Se falhar: Davidson reavalia cronograma; adiar launch é opção real.

---

### Semana 5 (18–24 mai) — Msgops hub + polimento + stretch Auth

| Dia | Gui | Danilo |
|---|---|---|
| Seg 18 | **Onda 5: `msgops-api` hub** (start — maior, quebra tudo se errar) | Fase 8: remover `@google-cloud/logging` + **remover BigQuery** + padronizar pino |
| Ter 19 | Onda 5: msgops-api Pub/Sub migration + testes | Fase 10: README reescrito + `docs/architecture.md` |
| Qua 20 | Onda 5: msgops-api + Fase 4 BullMQ nele (coordenação com Danilo) | Fase 10: `docs/getting-started.md` + `docs/geodb.md` + `docs/firebase-fcm-setup.md` |
| **Qua 20 EOD** | **🎯 Gate stretch Auth:** tudo acima verde → Danilo ataca Fase 7 Auth local. Senão → Auth0 fica no v0.1.0. | |
| Qui 21 | Fase 9 close: compose completo 18 apps + healthchecks + multi-arch `linux/amd64+arm64` | Fase 10: `docs/deployment.md` (sizing guide do Pet) + CONTRIBUTING + SECURITY + CODE_OF_CONDUCT |
| **Qui 21 18h** | **🚨 CHECKPOINT 4** (ÚLTIMO FILTRO) — VM x86 + Mac ARM virgens passam `git clone && docker compose up` | |
| Sex 22 | Bugfix / re-aponta Super Admin pra msgops migrada (produção) | Docs finalização; se stretch: Fase 7 Auth local backend start |
| **Sex 22 18h** | **🧊 CODE FREEZE** — final de semana 23-24/mai é SÓ bugfix crítico | |

**Davidson S5 em paralelo:**
- Blog post draft seg + review qui
- Thread X/Twitter + LinkedIn + post Discord preparados
- Gravar vídeo demo 3-5min (`git clone && docker compose up` + envio de email + passeio Super Admin)

**Daily 15min 09:00 BRT toda manhã (S5).**

**🚨 Checkpoint 4 (qui 21/mai) — ÚLTIMO FILTRO:**
- [ ] `git clone && docker compose up` funciona em VM Linux x86 **virgem** em < 10 min até healthcheck verde
- [ ] Mesmo teste passa em Mac ARM (M-series) **virgem**
- [ ] Todos os 18 apps sobem sem erro
- [ ] Wizard UI completo flui E2E em VM virgem
- [ ] Super Admin carrega, lista accounts, mostra métricas de plataforma, apontando pra msgops migrada
- [ ] Envio real de email funciona (SMTP teste) + tracking registra + GeoDB enriquece
- [ ] README renderiza bonito no GitHub (preview validado)

Se **QUALQUER** item falhar: **Davidson decide adiar launch para 2/jun**. Reputação custa mais que 1 semana.

---

### Semana 6 (25–26 mai) — Launch

**Seg 25/mai (véspera):**
- Manhã: Davidson + Gui + Danilo validam Launch Day Checklist item por item
- Tarde: **dry-run** — repo privado vira público em staging (`bms-opensource-test`), validar CI verde, README render, `git clone` + `docker compose up` em VM virgem nunca usada
- Correções de última hora
- Embargo em comunicações (blog drafted, threads agendadas)

**Ter 26/mai (LAUNCH DAY):**
- **09:00 BRT** — Repo público no GitHub (executar checklist)
- **09:15 BRT** — Blog post publicado
- **09:30 BRT** — Thread X/Twitter + LinkedIn
- **10:00 BRT** — Post Discord + WhatsApp (canais Evolution)
- **10:30 BRT** — Show HN + r/selfhosted (opcional)
- **Resto do dia** — Davidson + 1 dev em plantão monitorando issues a cada 1h até 18h BRT

---

## 4. Trilhas paralelas — resumo rápido

| Semana | Gui (Infra & Messaging) | Danilo (Apps & Admin & Jobs) | Sync |
|---|---|---|---|
| **1** | Fase 0 + Fase 1 start (lib + bridge HTTP) | Fase 0 + Fase 7.5 start (Wizard passos 1-4) | Sex 24/abr — standup 30min |
| **2** | Fase 1 close + Fase 2 (piloto + playbook) | Fase 7.5 close + Fase 7.6 start (polir `msgops-manager-frontend`) | Sex 1/mai — **Checkpoint 1** |
| **3** | Fase 3 Onda 1 (3 apps) + Fase 5 em send-email | Fase 3 Ondas 3+4 (3 apps + BullMQ) + Fase 7.6 core | Seg 4 contratos + Sex 10 — **Checkpoint 2 (crítico)** |
| **4** | Fase 3 Onda 2 (3 apps) + Fase 5 em msgops + Fase 9 skeleton | Fase 3 Onda 4 close + Fase 7.7 GeoDB + Fase 7.6 close | Sex 15 — **Checkpoint 3** (smoke test) |
| **5** | Fase 3 Hub (msgops-api) + Fase 9 close | Fase 8 + Fase 10 + [STRETCH: Fase 7 Auth] | Daily 15min + Qui 21 — **Checkpoint 4** + Sex 22 code freeze |
| **6** | Dry-run + plantão | Dry-run + plantão | Seg 25 — dry-run. Ter 26 — **LAUNCH** |

### Handoffs críticos (bloqueadores)

| Quando | O quê | Gui → Danilo (ou inverso) | Por quê |
|---|---|---|---|
| Seg 20 EOD | `msgops-manager-frontend` analisado (lista de features Etus-specific a remover) | Danilo (self) | Não-bloqueante (app já no monorepo) |
| Sex 24 | Nomenclatura AMQP + contrato bridge HTTP | Gui + Davidson travam | Bloqueia Fase 1 fechar |
| Sex 1/mai | `[C]migration-pattern.md` publicado | Gui → Danilo | **Destrava S3 do Danilo** |
| Qui 7/mai | S3 funcional em `send-email` (MinIO no compose) | Gui → Danilo | Não-bloqueante (mas acelera GeoDB teste) |
| Qua 13/mai | S3 em `msgops-api` antecipado | Gui → Danilo | Não-bloqueante (acelera Super Admin S5) |
| Qua 20 EOD | Msgops-api migrada + estável | Gui → Danilo | **Única dep dura da S5** — re-aponta Super Admin |
| Sex 22 18h | Code freeze | Ambos | Launch Monday |

---

## 5. Checkpoints e triggers

### Checkpoints obrigatórios

| Quando | O que precisa estar verde | Se falhar |
|---|---|---|
| Sexta **1/mai** (fim S2) | Lib messaging done (com bridge HTTP + double retry), event-receiver rodando, **Wizard passos 1-4 funcionais** | Revisão de alocação + daily extra; Davidson reforça em itens específicos; **não cortar escopo** |
| Sexta **10/mai** (fim S3) — **CRÍTICO** | 4 apps Fase 3 + **Wizard completo (1-5) + Super Admin adaptado builds** | Plano B ativa (ver abaixo) |
| Sexta **15/mai** (fim S4) | compose sobe tudo + **Super Admin funcional + GeoDB integrado** + 10+ apps migrados | Davidson reavalia cronograma; adiar launch é opção |
| Quinta **21/mai** (S5) | `git clone && docker compose up` funciona em VM x86 + ARM virgens; Super Admin carrega | **Adiar launch 1 semana (2/jun)** em vez de publicar quebrado |

### Plano B (emergência — Davidson foi explícito: NÃO cortar escopo)

**Sequência de resposta, em ordem:**

1. **Revisão profunda da alocação** (1h, Davidson + 2 devs) — algum item foi gold-plating? Há pair programming que destrava?
2. **Reforço temporário** — Davidson entra como 3º dev em tarefas da trilha (não só review) na semana do pico.
3. **Adiar launch 1 semana (para 2/jun — segunda semana de junho)** — reutilizar todas as comunicações preparadas, mais 7 dias de fechamento.
4. **Última linha (se mesmo com reforço + 1 semana extra não couber):** reabrir conversa com Davidson sobre tradeoff prazo vs escopo. Este roadmap não toma essa decisão unilateralmente.

**Princípio:** publicar quebrado custa reputação > adiar 1 semana custa atraso.

---

## 6. Riscos pro prazo (top 4)

### ~~Risco — Datastore → Postgres~~ ✅ ELIMINADO
Datastore morto no código (confirmado Pet/Bragança). Fase 0 só remove resíduo.

### ~~Risco — Auth cutover quebra apps~~ ✅ MITIGADO
Auth0 fica no v0.1.0. Auth local vira stretch goal.

### Risco 1 (novo) — Bridge HTTP adiciona latência/complexidade
**Probabilidade: BAIXA-MÉDIA. Impacto: MÉDIO.**

Consumer AMQP → HTTP service adiciona ~50-200µs/msg + ponto de falha extra.

**Mitigação:** retry com backoff + circuit breaker; healthcheck HTTP antes do consumer puxar msgs; smoke test de carga no Checkpoint 2.

### ~~Risco 2 — Super Admin tem dependências não mapeadas~~ ✅ ELIMINADO
`msgops-manager-frontend` já está no monorepo (confirmado 16/abr, v2.0.0, Vue 3 + Vuetify + Pinia + Auth0 integrado, Storybook + tests funcionando). Não é repo externo — é polimento de app rodando.

**Risco residual menor:** features Etus-specific no `src/` precisam ser identificadas. Mitigação: análise do app na Fase 0 seg 20/abr (1 dia), lista fechada antes da S2.

### Risco 3 — `docker compose up` falha em máquina de reviewer no launch day
**Probabilidade: MÉDIA. Impacto: FATAL reputacionalmente.**

**Mitigação:** smoke test em VM limpa no Checkpoint 3 (S4, não S5); segundo smoke test ARM + x86 no Checkpoint 4; imagens multi-arch; healthchecks com `condition: service_healthy`; CI com `docker compose up` antes do launch.

### Risco 4 — Escopo completo + 2 devs + 6 semanas (com folga real)
**Probabilidade: BAIXA-MÉDIA (reduzida significativamente).** Impacto: alto se surpresa.

**Mitigação:** 4 checkpoints duros detectam slippage em até 5 dias; Davidson disponível em < 2h úteis para unblock; válvula de escape = **adiar launch 1 semana**, não cortar escopo.

---

## 7. Launch Day Checklist (26 de maio — ou 2/jun se adiado)

Usar este checklist item por item. Marcar `[x]` em tempo real.

### Pré-publicação (véspera)

```
[ ] Repo privado staging: `git clone && docker compose up` funciona em máquina Linux x86 virgem
[ ] Mesmo teste em Mac ARM (M-series) virgem
[ ] CI do GitHub Actions verde (build + lint + test mínimo)
[ ] README renderiza bonito no GitHub (preview)
[ ] LICENSE correto (Apache 2.0) no root
[ ] SECURITY.md com email de contato válido
[ ] `.env.example` de TODOS os apps auditados (zero email @etus, zero project_id GCP real)
[ ] Git history scan final: `git log --all -p | grep -iE "password|secret|api_key|BEGIN (RSA|OPENSSH)"` → zero hits reais
[ ] Wizard UI flui end-to-end em VM virgem
[ ] Super Admin carrega + mostra métricas + health de serviços
[ ] Envio real de email funciona + tracking registra
[ ] Demo video gravado (3–5 min) + subido no YouTube unlisted
[ ] Blog post draft revisado por Davidson
[ ] Posts social media agendados ou prontos pra copiar/colar
[ ] Discord announcement escrito
```

### No launch day

```
Bloco 1 — Publicação técnica (09:00 BRT)
[ ] Repo vira público no GitHub
[ ] Tag v0.1.0 criada e release publicado com changelog básico
[ ] README.md aparece corretamente na homepage do repo
[ ] `git clone` do repo público + `docker compose up` funciona (teste em 3ª máquina virgem)
[ ] Badge de build passando no README
[ ] Issues templates ativos (.github/ISSUE_TEMPLATE)

Bloco 2 — Anúncios (09:15–10:30 BRT)
[ ] Blog post publicado (link pronto)
[ ] Thread Twitter/X publicada
[ ] Post LinkedIn publicado
[ ] Post Discord (Evolution community)
[ ] Post WhatsApp (grupos Evolution)
[ ] Vídeo demo linkado em todas as peças
[ ] Show HN submetido (opcional — Davidson decide)
[ ] r/selfhosted post (opcional)

Bloco 3 — Plantão (resto do dia)
[ ] Davidson + 1 dev monitorando issues a cada 1h
[ ] Primeira issue aberta: responder em < 2h com carinho (seta o tom da comunidade)
[ ] Métricas: stars, forks, issues abertas — capturar screenshot às 18h BRT pro retro
[ ] Canal #bms-opensource-launch no Discord interno pra tracking ao vivo
```

### Rollback plan (se algo estourar no launch)

```
[ ] Se docker compose quebra em massa: push hotfix + tag v0.1.1 imediatamente
[ ] Se security issue aparece em < 1h: considerar tornar repo privado temporariamente, fix, republicar
[ ] Decisão de tornar privado só se severidade >= exposição de credencial. Bugs funcionais ≠ privado.
```

---

## 8. Próximos passos imediatos (hoje 16/abril)

**Decisões travadas pós-reunião 16/abr:**
- ✅ Lib: **`@bms/messaging`**
- ✅ Git: **`filter-repo`** (limpar histórico)
- ✅ BigQuery: **remover + doc** (~2h, menor esforço — zero dep `@google-cloud/*` em package.json)
- ✅ Dev A = **Gui** (messaging/devops), Dev B = **Danilo** (admin/UI)

**Pendências Davidson (antes de 20/abr):**
1. Revisar `[C]research-geodb.md` e confirmar **DB-IP Lite** (ou trocar pra MaxMind Tier 2)
2. Alinhar com **Bragança**: formalizar commit removendo Datastore morto (Super Admin já está no monorepo como `apps/msgops-manager-frontend` — nenhuma ação pendente nesse ponto)
3. Coletar números de sizing com **Pet** (RAM/CPU/conexões operação atual Etus) pro `docs/deployment.md`
4. Mandar plano atualizado pro **Pet** pra OK final (action item reunião)
5. Abrir feature no Linear/GitHub Project com issues por fase, labels `track-gui`/`track-danilo`, milestone `v0.1.0 launch 2026-05-26`
6. Agendar 4 checkpoints no Calendar: 1/mai, 10/mai, 15/mai, 21/mai — 30min cada, Davidson + Gui + Danilo

**Handoff técnico (roda paralelo à Fase 0):**
7. `@apex-architect` (Phase 3 — Solutioning) para 2 ADRs:
   - ADR-1: Contrato `@bms/messaging` + **bridge HTTP loopback** (double retry AMQP+HTTP, DLQ, routing keys, circuit breaker, health check)
   - ADR-2: **GeoDB provider arquitetura** (interface pluggable local/api/disabled, refresh strategy do .mmdb, graceful degradation)

**Critério pra começar execução (Fase 0 no dia 20/abr):** itens 1-6 resolvidos. ADRs (item 7) podem rodar em paralelo.

---

## 9. Open Questions (consolidadas no plan — repetidas aqui para tracking no standup)

- [ ] Nomenclatura AMQP — decide **Fase 1** (Dev A (Gui) + Davidson)
- [ ] JWT cookie httpOnly vs header — decide início **Fase 7** (Dev B (Danilo))
- [ ] `git filter-repo` vs squash — decide **Fase 0** (Davidson)
- [ ] Coexistência com fork Etus privado — **Davidson alinha com time Etus antes S3**
- [ ] BigQuery em msgops-api — investiga **Fase 0**, decide **Fase 8**
- [ ] Seed data para dev local — defina **Fase 9**
- [ ] FCM onboarding — documenta **Fase 10**
- [ ] Nome final da lib — **travar antes da S1 começar**
- ~~Staging Etus para testes de carga~~ ✅ resolvida (Datastore já migrado)

---

## Handoff

**Próximo agente:** `@apex-architect` (Phase 3 — Solutioning) para as 2 ADRs da seção 8 (**Messaging com bridge HTTP** + **GeoDB provider**).

**Em paralelo:** Davidson responde as Open Questions travadas (bloqueiam start formal).

**Depois das ADRs:** `@bolt-executor` (Phase 4 — Build) executa fase por fase conforme este roadmap, com `@oath-verifier` no fim de cada semana validando o checkpoint correspondente.
