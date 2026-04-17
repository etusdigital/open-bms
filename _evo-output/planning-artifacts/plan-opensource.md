# Plano — BMS Monorepo Open Source

Feature slug: `bms-opensource`
Owner: Davidson
Criado: 2026-04-16
Atualizado: 2026-04-16 (pós-reunião Davidson+Pet 16/abr): escopo completo; 2 devs (Gui messaging + Danilo admin); **Datastore confirmado morto** no código (branch antigo) — não requer migração; **Super Admin** vem do branch antigo no GitLab (reuso, não rewrite); **Auth0 DESPRIORIZADO** (fica no v0.1.0 se não der tempo — tier grátis de 10k users cobre o caso); **Bridge AMQP via HTTP loopback** (camada extra de retry no server); **GeoDB** novo open question — research de mercado anexo com DB-IP Lite como recomendação Tier 1.
Fase (dev-phases.md): Planning
Deadline: **26 de maio de 2026** (terça-feira)
Recursos: **2 devs sêniores full-time** + Davidson em suporte

---

## Objetivo

Transformar o `bms-monorepo` (plataforma Etus de mensageria: email, push, whatsapp, sms, eventos, tracking, lead pipeline) em projeto open source publicável, removendo acoplamentos proprietários com GCP e Auth0.

**Escopo travado: completo.** Os **18 apps** do monorepo, o super admin e o setup wizard (UI) ficam. A viabilidade depende de paralelização disciplinada entre 2 devs + checkpoints duros. O plano é apertado por construção — a válvula de escape é **adiar launch**, não cortar escopo.

---

## Escopo

**Dentro (não negocia):**
- **18 apps** do monorepo — inclui `frontend-vue2` (app principal BMS), `msgops-api` (hub), e todos os workers/apps de pipeline.
- Todos os `packages/` (lib compartilhada)
- Super admin panel (Fase 7.6) — painel global de plataforma
- Setup wizard UI (Fase 7.5) — não é CLI-only
- Infra completa (`docker-compose.yml`, Dockerfiles, scripts)
- Documentação completa (README, LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, docs/architecture, docs/getting-started)

**Fora:**
- Migração de dados de produção
- Backwards compatibility com o deployment atual da Etus (tratado em paralelo, fora deste plano)
- Hospedagem/SaaS do projeto open source
- Migração Vue 2 → Vue 3 (registrada como known limitation — ver seção "Known Limitations")

---

## Success Criteria (global)

O projeto está "pronto pra publicar" quando **TODOS** os itens abaixo forem verificáveis:

- [ ] `git clone && docker compose up` funciona em VM Linux x86 virgem em < 10 min até primeiro health check verde
- [ ] Mesmo teste passa em Mac ARM (M-series)
- [ ] Zero dependência de `@google-cloud/*` em `package.json` (exceto `firebase-admin` que é destino FCM, não infra)
- [ ] Zero dependência de `auth0` / `@auth0/*` em qualquer `package.json`
- [ ] `git log --all -p | grep -iE "password|secret|api_key|BEGIN (RSA|OPENSSH)"` retorna zero hits
- [ ] `.env.example` de todos os apps auditado: zero `@etus.com.br`, zero project_id GCP real, zero URL interna
- [ ] Setup wizard completa fluxo end-to-end em VM virgem: cria admin, configura SMTP, health check verde, redireciona para dashboard
- [ ] Super admin panel carrega, lista accounts, mostra métricas de plataforma básicas
- [ ] Envia 1 email real end-to-end (SMTP de teste) e tracking registra open/click
- [ ] CI (GitHub Actions) roda build + lint + teste mínimo em PR e está verde no main
- [ ] README renderiza corretamente no GitHub (preview validado), LICENSE (Apache 2.0) no root
- [ ] `docs/getting-started.md`, `docs/architecture.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` existem e têm conteúdo útil (não placeholders)

---

## Decisões travadas

| Tema | Decisão |
|---|---|
| Licença | **Apache 2.0** (cláusula de patente explícita, compatibilidade com comercial, alinhamento com Evolution API) |
| Mensageria | Pub/Sub → RabbitMQ via lib compartilhada `@bms/messaging`. **Bridge HTTP:** consumer AMQP recebe msg e chama o service via HTTP loopback (não DI direto). Razão: camada extra de retry no server (se service responder 5xx, server faz requeue com backoff); desacoplamento consumer/service. |
| Job scheduling | Cloud Tasks → BullMQ (Redis já existe em 15+ apps) |
| Storage | Cloud Storage → S3-compatible (MinIO como default open source) |
| Push notification | `firebase-admin` (FCM) **mantido** — é destino, não infra |
| Analytics DB | ClickHouse mantido (sobe no docker-compose, não é Cloud) |
| Auth | **Auth0 mantido no v0.1.0** (tier grátis de 10k users cobre a maior parte dos self-hosters). Migração para auth local próprio vira **última prioridade** — faz se der tempo depois de tudo fechado; senão, roadmap v0.1.x. Motivo: reduz complexidade de setup, evita janela de bugs em camada crítica em prazo apertado. |
| Datastore | **Morto no código** (features não usadas mais — confirmado com Pet/Bragança). Migração Datastore → Postgres já foi feita anteriormente em outras entidades; resíduo de `@google-cloud/datastore` em apps está desativado. Fase 0 apenas remove código morto. Zero trabalho funcional. |
| Frontend | `frontend-vue2` mantido em Vue 2 para o lançamento. Migração Vue 3 / refactor pra React = workstream pós-lançamento no roadmap público do README (90k+ LOC, não cabe nas 6 semanas). |
| Setup inicial | **Wizard UI completo** (não CLI) em `frontend-vue2` — se banco vazio, redireciona pra tela de setup inicial. 5 passos, Fase 7.5. Rápido de fazer (CRUD simples). |
| Super admin | **`apps/msgops-manager-frontend` já está no monorepo** (Vue 3 + Vite + Vuetify + Pinia + Auth0 já integrado, v2.0.0, com Storybook e tests). **Não é adaptação de repo externo** — é ajuste/polimento do app existente pra open source. Fase 7.6 foca em: remover referências Etus-specific, trocar `.gitlab-ci.yml` por GitHub Actions, plugar endpoints da `msgops-api` migrada. |
| GeoDB | **DB-IP Lite City** (CC-BY 4.0, redistribuível) como default + feature flag `GEO_ENRICHMENT_ENABLED` (a confirmar Davidson após review do research). Ver seção GeoDB + research anexo. |
| Sizing | **Recomendações de infra mínima** publicadas em `docs/deployment.md`: RAM/CPU para ClickHouse, Postgres, RabbitMQ, Redis em faixas de uso (ex: "até 10k leads/mês, 4GB RAM total"). Pet: "é carga do DevOps do cara, mas a gente indica". |
| Nome da lib | **`@bms/messaging`** (travado 16/abr) |
| Git history | **`git filter-repo`** — limpar histórico antes de publicar (remove secrets, `.env`, referências internas Etus) |
| BigQuery | **Remover e documentar como extensão futura** (menor esforço, ~2h). Apaga chamadas, remove dep `@google-cloud/bigquery`, adiciona seção "Advanced Analytics" no README. Se self-hoster pedir, vira plugin/extensão v0.2.x. Fase 0 valida volume de chamadas antes de confirmar. |
| Dev A | **Gui** — Messaging & Apps (caminho crítico: devops/infra, lib RabbitMQ, bridge HTTP, 13 apps) |
| Dev B | **Danilo** — Admin & Config (Wizard UI, Super Admin polimento `msgops-manager-frontend`, GeoDB, docs + sizing guide) |

## Known Limitations (registradas explicitamente, não escondidas)

Estas são limitações conhecidas na v0.1.0. Ficam no README como roadmap, não como bug:

- **Vue 2 no frontend principal** — end of life oficial, mas estável e funcional. Migração Vue 3 planejada para v0.2.x. Security patches vão via community (Vue 2 NES) ou fork interno se necessário.
- **Super admin v0.1.0 cobre o básico** (accounts, users, métricas, health, logs). Gestão de planos e billing são roadmap futuro.

## Em aberto (honesto — serão fechados durante execução)

Questões reais ainda sem resposta. Cada uma tem fase-alvo para decisão. **Não inventar**.

- [ ] **Nomenclatura AMQP** (exchange naming convention, routing keys, DLQ suffix) — decide na **Fase 1** junto com a escrita da lib `@bms/messaging`. Dev A propõe, Davidson aprova no standup da semana 1. Risco: baixo (refactor se mudar).
- [ ] **JWT em cookie httpOnly vs Authorization header** — decide na **Fase 7** (início, antes de escrever `JwtStrategy`). Dev B propõe com prós/contras de CSRF vs XSS. Risco: médio (afeta frontend).
- [ ] **`git filter-repo` vs squash inicial** — decide na **Fase 0** após scan de credenciais. Se scan não encontrar nada sensível e history curto, squash é mais seguro; se history tem valor arqueológico e scan limpa, `filter-repo`. Davidson decide. Risco: médio.
- [ ] **Coexistência com fork Etus privado durante e após migração** — plano de cutover do deploy atual da Etus está fora deste plano, mas a interface entre os dois (se Etus continua rodando fork) afeta breaking changes na Fase 3/6/7. Davidson alinha com time Etus antes da semana 3.
- [ ] **BigQuery em msgops-api** — destino? Opções: (a) remover e migrar uso para ClickHouse (que já sobe na stack), (b) manter como integração opcional atrás de flag, (c) remover e documentar como extensão futura. **A investigar na Fase 0** (inventário de chamadas) e decidir na **Fase 8**. Risco: médio (pode adicionar trabalho).
- [ ] **Seed data para dev local** — o que acompanha `docker compose up` para dev/demo? Nada, fixtures mínimas, ou dataset anonimizado da Etus? Definir na **Fase 9** (docker-compose) — afeta DX do projeto open source.
- [ ] **Firebase FCM onboarding para usuário open source** — como quem clona configura FCM credentials? Documentar em `docs/getting-started.md` na **Fase 10**. Sem credencial, `send-push` fica desabilitado graciosamente (feature flag + health check avisa). Risco: baixo (UX docs).

---

## Inventário verificado

### Dependências Pub/Sub (13 apps — inclui event-receiver piloto)
event-receiver (piloto), event-process, send-email, send-push, send-whatsapp, tracker, lead-receive, lead-conception, tag-process, twilio-messaging, message-trigger, campaign-packer, msgops-api

### Dependências Cloud Tasks (5 apps)
msgops-api, message-trigger, campaign-packer, tag-process, campaign-events-tracker

### Dependências Datastore — ✅ JÁ MIGRADAS (histórico)

Datastore **já foi migrado para PostgreSQL** em trabalho anterior. Não há mais apps dependentes de `@google-cloud/datastore`. A Fase 0 valida que nenhum resíduo permanece (`grep -r "@google-cloud/datastore" .` → zero hits esperado; se aparecer algo, é bug residual tratado na Fase 0, não fase nova).

Consequência operacional:
- Schema Postgres já existe em `packages/database` (TypeORM) para as ~30 entidades (accounts, users, campaigns, contacts, messages, etc.)
- Dev B **não** precisa reimplementar provider nem projetar schema `datastore_entities` JSONB
- Capacidade liberada de Dev B vai para Fases 7, 7.5, 7.6 com folga real

### Dependências Auth0 (2 apps)
msgops-api, frontend-vue2

### Outras GCP
- `@google-cloud/storage` em send-email, msgops-api → substituído por S3 (Fase 5)
- `@google-cloud/bigquery` em msgops-api → destino **a decidir** (Open Question)
- `@google-cloud/logging` em tag-process → substituído na Fase 8
- `firebase-admin` em send-push → **mantém** (é destino FCM)

### Apps fora dos grupos acima
Os 18 apps incluem outros que não aparecem nas listas GCP/Auth0 (apps de infra interna, jobs, workers isolados). **A investigar na Fase 0**: inventário completo de `apps/` para confirmar que ninguém tem dependência GCP escondida.

---

## Paralelização — orquestração Gui + Danilo sem bloqueio

**Princípio:** 2 devs sêniores no caminho crítico desde o dia 1. Gui (infra & messaging) entrega a lib + piloto + playbook que destrava Danilo pra migrar apps em paralelo a partir da S3. Enquanto isso, Danilo ataca Wizard e Super Admin que são independentes da lib. Nenhum dev fica em "sala de docs" enquanto o outro carrega trilha crítica.

### Divisão dos apps da Fase 3 (14 apps = piloto + 12 + msgops)

| Onda | Apps | Quem migra | Semana |
|---|---|---|---|
| Piloto | `event-receiver` | **Gui** (produz playbook) | 2 |
| 1 | `send-email`, `event-process`, `tracker` | **Gui** (email/tracking core) | 3 |
| 2 | `send-push`, `send-whatsapp`, `twilio-messaging` | **Gui** (canais) | 4 |
| 3 | `lead-receive`, `lead-conception` | **Danilo** (lead pipeline) | 3 |
| 4 | `tag-process`, `message-trigger`, `campaign-packer` | **Danilo** (Pub/Sub + BullMQ no mesmo PR) | 3–4 |
| Hub | `msgops-api` | **Gui** (último, crítico) | 5 |

**Total:** Gui = 8 apps (piloto + 3 onda 1 + 3 onda 2 + msgops). Danilo = 5 apps (ondas 3+4) + `campaign-events-tracker` (BullMQ only).

**Regra:** Danilo segue o playbook `[C]migration-pattern.md` produzido pelo Gui na Fase 2. Onda 4 do Danilo combina Pub/Sub → RabbitMQ **+** Cloud Tasks → BullMQ no mesmo PR (3 dos 5 apps da Fase 4 são dele na Onda 4 — evita mexer 2x no mesmo código).

### Responsabilidades por trilha

**Gui — Infra & Messaging**
Fases 0 (join), 1 (lib + bridge HTTP), 2 (piloto), 3 ondas 1+2+hub, 5 (S3 nos apps dele), 9 (docker-compose completo).

**Danilo — Apps & Admin & Jobs**
Fases 0 (join + análise `msgops-manager-frontend`), 3 ondas 3+4, 4 (Cloud Tasks → BullMQ — toca os apps dele), 7.5 (Wizard), 7.6 (Super Admin polimento do `msgops-manager-frontend`), 7.7 (GeoDB), 8 (logging + BigQuery removal), 10 (docs + sizing guide).

**Stretch (se tudo verde em Qua 20/mai):** Fase 7 Auth local — Danilo ataca backend, Gui ajuda frontend.

### Orquestração dia-a-dia

#### Semana 1 (20–26 abr) — Fundação paralela

| Dia | Gui | Danilo |
|---|---|---|
| Seg 20 | Fase 0: scan git, limpeza `.env`, remover código morto Datastore | Fase 0: inventário `apps/` + **aplica fixes mecânicos no `msgops-manager-frontend`** (já analisado — ver `[C]analysis-msgops-manager-frontend.md`): `.env.example`, rename Brius→Bms, GitLab CI→GitHub Actions, strings Etus → ~1 dia |
| Ter 21 | Fase 1 start: design bridge HTTP + Publisher skeleton | Fase 7.5 start: detecção banco vazio + rota `/setup` + passo 1 (criar admin via seeder + Auth0) |
| Qua 22 | Fase 1: Publisher + testes unitários | Fase 7.5: passo 2 SMTP (form + botão "enviar teste") |
| Qui 23 | Fase 1: Consumer AMQP + retry com backoff | Fase 7.5: passo 3 domínio + passo 4 IP pool opcional |
| **Sex 24 16h** | **Standup 30min:** travar nomenclatura AMQP, contrato bridge HTTP, status | |

**Fim S1:** lib tem Publisher funcional; Wizard passos 1-4 clicáveis. Zero dependência cruzada.

---

#### Semana 2 (27 abr – 3 mai) — Piloto + Wizard fecha

| Dia | Gui | Danilo |
|---|---|---|
| Seg 27 | Fase 1 close: Consumer + DLQ + circuit breaker + graceful shutdown | Fase 7.5: passo 5 health check dos serviços |
| Ter 28 | Fase 1 close: testes integração (testcontainers RabbitMQ) | Fase 7.5 close: flag `setup_complete` + E2E do wizard |
| Qua 29 | Fase 2 start: migrar `event-receiver` (piloto) end-to-end | Fase 7.6 start: rodar `msgops-manager-frontend` local, remover features Etus-specific, trocar `.gitlab-ci.yml` por GitHub Actions |
| Qui 30 | Fase 2: validar DLQ + **documentar `[C]migration-pattern.md`** (playbook) | Fase 7.6: ajustar `.env.example` pra zero referência @etus, plugar endpoints da `msgops-api` **não migrada** (fallback provisório) |
| **Sex 1/mai 18h** | **🚨 CHECKPOINT 1** (30min): lib done, piloto rodando, wizard 1-5 completo, painel admin builda | |

**Entregáveis S2:** playbook publicado → **destrava Danilo pra migrar apps na S3**. Wizard end-to-end funcional. `msgops-manager-frontend` rodando local com CI GitHub Actions + `.env.example` limpo.

---

#### Semana 3 (4–10 mai) — Migração dispara em paralelo 🔥

| Dia | Gui | Danilo |
|---|---|---|
| Seg 4 | Fase 3 Onda 1: `send-email` (aplica playbook) | Onda 3 start: `lead-receive` (aplica playbook) |
| Ter 5 | Fase 3 Onda 1: `event-process` | Onda 3: `lead-conception` |
| Qua 6 | Fase 3 Onda 1: `tracker` | Fase 7.6 core: ajustes UI accounts/users (enquanto lead-* roda CI) |
| Qui 7 | Fase 5: trocar `@google-cloud/storage` → S3 em `send-email` + MinIO no compose | Onda 4 start: `tag-process` (**Pub/Sub + Cloud Tasks BullMQ no mesmo PR**) |
| Sex 8 | Fase 3 Onda 2 start: `send-push` | Onda 4: `message-trigger` (Pub/Sub + BullMQ) |
| **Sex 10 18h** | **🚨 CHECKPOINT 2 (crítico)** (30min): 3 apps Gui + 2-3 apps Danilo migrados; painel admin base funcionando contra msgops fallback; smoke test pipeline completo | |

**Entregáveis S3:** 5-6 apps migrados. Fase 4 (BullMQ) feita *junto* com Pub/Sub nos apps do Danilo (1 PR em vez de 2). Fase 5 concluída em `send-email`.

---

#### Semana 4 (11–17 mai) — Fanout total + Super Admin funcional

| Dia | Gui | Danilo |
|---|---|---|
| Seg 11 | Onda 2: `send-whatsapp` | Onda 4: `campaign-packer` (Pub/Sub + BullMQ) |
| Ter 12 | Onda 2: `twilio-messaging` | Onda 4: `campaign-events-tracker` (BullMQ only — não tem Pub/Sub) |
| Qua 13 | Fase 5: trocar S3 em `msgops-api` (antecipa pra desbloquear Super Admin do Danilo na S5) | Fase 7.7 GeoDB: `packages/geo` + `DbIpProvider` + feature flag |
| Qui 14 | Buffer / bugfix / Fase 9 start (compose skeleton com 4 serviços infra) | Fase 7.7 GeoDB: integração em `tracker` + graceful degradation + teste |
| Sex 15 | Fase 9: compose com 4 serviços infra + 10 apps migrados | Fase 7.6 close: Super Admin funcional contra msgops fallback |
| **Sex 15 18h** | **🚨 CHECKPOINT 3** (smoke test coletivo VM x86): compose sobe tudo, Wizard E2E, Super Admin carrega, GeoDB enriquece | |

**Entregáveis S4:** 10 apps migrados, GeoDB pronto, Super Admin funcional. Restam `msgops-api` hub (Gui na S5). Fase 9 compose skeleton.

---

#### Semana 5 (18–24 mai) — Msgops hub + polimento + stretch Auth

| Dia | Gui | Danilo |
|---|---|---|
| Seg 18 | **Onda 5: `msgops-api` hub start** (maior, quebra tudo se errar) | Fase 8: remover `@google-cloud/logging` + **remover BigQuery** + padronizar pino |
| Ter 19 | Onda 5: msgops-api Pub/Sub migration + testes | Fase 10: README reescrito + `docs/architecture.md` |
| Qua 20 | Onda 5: msgops-api + Fase 4 BullMQ nele (coordenação com Danilo) | Fase 10: `docs/getting-started.md` + `docs/geodb.md` + `docs/firebase-fcm-setup.md` |
| **Qua 20 EOD** | **🎯 Gate stretch Auth:** tudo acima verde → Danilo ataca Fase 7 Auth local. Senão → Auth0 fica no v0.1.0. | |
| Qui 21 | Fase 9 close: compose completo 18 apps + healthchecks + multi-arch `linux/amd64+arm64` | Fase 10: `docs/deployment.md` (sizing guide do Pet) + CONTRIBUTING/SECURITY/CODE_OF_CONDUCT |
| **Qui 21 18h** | **🚨 CHECKPOINT 4**: VM x86 virgem + Mac ARM virgem passam `git clone && docker compose up` | |
| Sex 22 | Bugfix / apontar Super Admin do Danilo pra msgops migrada (produção) | Docs finalização; se stretch: Fase 7 Auth local backend start |
| **Sex 22 18h** | **🧊 CODE FREEZE** | |

**Entregáveis S5:** tudo verde, code freeze, docs completo. msgops-api migrada e Super Admin apontando pra ela.

---

#### Semana 6 (25–26 mai) — Launch

| Dia | Ambos |
|---|---|
| Seg 25 manhã | Dry-run launch checklist item por item; validar 3 VMs virgens (Linux x86 + Mac ARM + VPS limpa) |
| Seg 25 tarde | Correções de última hora; embargo em comunicações (blog, threads) |
| **Ter 26 09:00 BRT** | **🚀 LAUNCH**: repo público → 09:15 blog → 09:30 social → 10:00 Discord/WhatsApp → 10:30 Show HN (opcional) |
| Ter 26 resto | Plantão: Davidson + 1 dev monitorando issues a cada 1h até 18h |

### Pontos de sincronização (handoffs explícitos)

| Quando | Handoff | Origem → Destino | Bloqueador? |
|---|---|---|---|
| Seg 20 EOD | `msgops-manager-frontend` com fixes mecânicos aplicados (env, rename, CI, strings) | Danilo (self) | **Não-bloqueante** — análise já pronta em `[C]analysis-msgops-manager-frontend.md` |
| Sex 24 | Nomenclatura AMQP + contrato bridge HTTP travados | Gui + Davidson | **Sim pra Fase 1 fechar** |
| Sex 1/mai | `[C]migration-pattern.md` publicado | Gui → Danilo | **Sim — Checkpoint 1 destrava S3 do Danilo** |
| Qui 7/mai | S3 em `send-email` funcional (MinIO no compose) | Gui → Danilo (pra Super Admin poder testar uploads) | Não-bloqueante |
| Qua 13/mai | S3 em `msgops-api` antecipado | Gui → Danilo (pra Super Admin S5 bater em msgops com S3 pronto) | Não-bloqueante |
| Qua 20 EOD | Msgops-api hub migrada + estável | Gui → Danilo (re-aponta Super Admin do fallback pra produção) | **Sim — única dependência dura da S5** |
| Sex 22 18h | Code freeze | Todos | **Sim — launch day Monday** |

### Regra de ouro da paralelização

1. **Quem terminar primeiro puxa item independente do outro** (ex: Danilo termina GeoDB qui 14/mai, Gui ainda em Onda 2 → Danilo adianta Fase 8 logging cleanup).
2. **Nunca puxar item com dependência aberta do outro** (ex: Danilo não mexe em Super Admin apontando pra msgops migrada antes de qua 20/mai, quando Gui entrega).
3. **Pair programming 1h antes de retrabalho** — em dúvida sobre ownership, alinham juntos.
4. **Code review cruzado obrigatório** (padrão de par sênior) — Gui aprova PRs do Danilo e vice-versa.
5. **Daily 15min 09:00 BRT na S5** (semana mais crítica) — nas outras, só standup sexta 16h.

### O que NÃO paralelizar

- Fase 2 (piloto) precede Fase 3 — sem playbook, não há fanout confiável
- Fase 7 backend precede Fase 7 frontend — Dev B sequencial natural dentro da própria trilha
- **Fase 7 (Auth) precede Fase 7.5 (Setup Wizard)** — Auth é prioridade. Wizard cria o primeiro admin usando `AuthModule`: sem Auth pronto, Setup não tem como funcionar. Não começar 7.5 enquanto 7 backend estiver incompleto.
- Fase 7.6 (Super admin) também depende de Fase 7 (roles `SUPER_ADMIN`) + `msgops-api` migrada
- `msgops-api` é o último da Fase 3 — é hub, quebra tudo se migrar antes de todos os produtores

---

## Fases

### Fase 0 — Pre-flight
**Donos:** Gui + Danilo (join na S1 seg 20/abr — Gui no scan git + `.env`, Danilo no inventário + análise do `msgops-manager-frontend`)
**Bloqueia:** publicação
**Esforço:** S (~0,5 semana-dev)

- Scan do histórico git em busca de credenciais vazadas (`git log --all -S` + ferramentas: `gitleaks`, `trufflehog`)
- Verificar e limpar `.env` versionados (confirmados: `apps/msgops-api/.env`, `apps/frontend-vue2/.env`)
- **Decidir `git filter-repo` vs squash inicial** (Open Question #3)
- Auditar `.env.example` de todos os apps buscando: emails `@etus.com.br`, IDs de projeto GCP reais, URLs internas, nomes de bucket, domínios internos
- Revisar `CLAUDE.md`, `docs/`, `.claude/` atrás de referências internas
- **Inventário completo** de `apps/` — confirmar quais são os 20 apps, quais têm dependências GCP não listadas ainda
- **Investigar uso de BigQuery** em msgops-api (Open Question #5) — documentar chamadas para decisão na Fase 8

**Saída:** `[C]discovery-preflight.md` + commits de limpeza (se in-place) ou repo limpo (se fork)

**Given/When/Then (aceitação):**
- *Given* o monorepo atual, *When* rodamos o scan final de credenciais, *Then* `git log --all -p | grep -iE "password|secret|BEGIN (RSA|OPENSSH)"` retorna zero hits reais (falsos positivos documentados).
- *Given* os `.env.example` auditados, *When* buscamos por `@etus.com.br`, *Then* zero ocorrências.
- *Given* o inventário de `apps/`, *When* listamos dependências GCP, *Then* temos lista completa e nenhuma é surpresa na Fase 3+.

---

### Fase 1 — Lib `packages/messaging`
**Dono:** Gui
**Bloqueia:** Fases 2, 3
**Esforço:** M (~1,5 semanas-dev — S1 ter 21 a S2 ter 28/abr)

Criar `packages/messaging` com:

- `Publisher`: interface que substitui `PubSub.topic(X).publishMessage(...)` — recebe exchange/routing-key (nomenclatura travada no start da semana 1)
- `Consumer`: wrapper sobre `amqplib` com:
  - `channel.consume()` push via AMQP
  - ack/nack automático baseado no retorno do handler
  - retry com backoff exponencial
  - max-retries → DLQ
  - graceful shutdown
- `types.ts`: tipos compartilhados para payloads
- Testes unitários (mock `amqplib`) + integração (testcontainers com RabbitMQ real)
- README da lib

**Abordagem definida — Bridge HTTP (decisão da reunião 16/abr):**
- Consumer AMQP recebe msg → chama endpoint HTTP interno do Nest service (loopback)
- **Duas camadas de retry:**
  1. AMQP → Consumer: retry com backoff exponencial em caso de erro de parsing/infra
  2. Consumer → HTTP Service: retry em caso de 5xx do service (requeue no AMQP com headers de tentativa)
- **Vantagens:** desacopla consumer/service (service continua respondendo HTTP como em Pub/Sub push); camada extra de retry no server (se service cair temporariamente, msg volta pra fila); mantém padrão existente dos apps (já têm controllers HTTP).
- **Tradeoff:** +50-200µs por msg vs DI direto. Aceitável pra volume atual.
- Requer endpoint interno protegido (ex: header `X-Internal-Token` ou rede Docker isolada)

**Saída:** lib publicável internamente ao monorepo, exportada via `pnpm-workspace.yaml`

**Given/When/Then (aceitação):**
- *Given* a lib publicada, *When* Dev A publica msg em exchange X e Consumer em app Y está conectado, *Then* msg é recebida, processada e ack em < 1s localmente.
- *Given* handler que falha, *When* msg é consumida, *Then* retry com backoff acontece N vezes e msg vai para DLQ nomeada `{queue}.dlq`.
- *Given* sinal SIGTERM no consumer, *When* recebe, *Then* para de consumir novas msgs, completa in-flight, fecha channel/conn e sai com exit 0.

---

### Fase 2 — Piloto (`event-receiver`)
**Dono:** Gui (S2 qua 29/abr a sex 1/mai)
**Bloqueia:** Fase 3 (Danilo só começa ondas 3/4 após playbook publicado no Checkpoint 1)
**Esforço:** M (~1,5 semanas-dev)

Migrar `event-receiver` end-to-end como piloto. É um **leaf** (só recebe, não fan-out), baixo blast radius.

- Remover `@google-cloud/pubsub@^4.10.0` (nota: este é o único na v4, demais na v5)
- Adicionar `@bms/messaging`
- Configurar filas/exchanges no `docker-compose.yml` (RabbitMQ management image)
- Validar em dev local: mensagem publicada → consumida → processada → ack
- Validar DLQ: forçar erro no handler, verificar que vai pra DLQ após N tentativas
- Documentar padrão de migração em `[C]migration-pattern.md` (playbook para Fase 3)

**Saída:** 1 app migrado + playbook para os outros 12

**Given/When/Then (aceitação):**
- *Given* `event-receiver` migrado, *When* msg é publicada no RabbitMQ local, *Then* é processada idêntico ao comportamento Pub/Sub anterior (eventos registrados no DB/log).
- *Given* handler força erro, *When* retries esgotam, *Then* msg está na DLQ e métrica é emitida.
- *Given* `migration-pattern.md`, *When* Dev A começa o próximo app, *Then* playbook cobre: diff do `package.json`, diff do bootstrap, template de configuração de fila, troubleshooting comum.

---

### Fase 3 — Fanout Pub/Sub (12 apps)
**Donos:** Gui (ondas 1, 2, hub) + Danilo (ondas 3, 4) — rodam em paralelo desde S3
**Esforço:** L (~4 semanas-dev total, distribuídas)

Aplicar o playbook da Fase 2 em ondas (ver seção de Paralelização acima para orquestração dia-a-dia).

Para cada app: remover `@google-cloud/pubsub`, migrar publishers, migrar consumers, testar.

**Saída:** zero dependências de Pub/Sub no monorepo (todos os 13 apps migrados, incluindo piloto)

**Given/When/Then (aceitação por onda):**
- *Given* uma onda de apps, *When* `grep -r "@google-cloud/pubsub" apps/*/package.json`, *Then* zero matches naquela onda.
- *Given* o pipeline end-to-end daquela onda, *When* publicamos evento real (ex: onda 1 = evento de abertura de email), *Then* evento flui por todos os apps da onda corretamente em < 3s local.
- *Given* `msgops-api` (onda 5, último), *When* migra, *Then* todas as ondas anteriores continuam funcionando (regression test manual do pipeline completo).

---

### Fase 4 — Cloud Tasks → BullMQ (5 apps)
**Dono:** Danilo (toca apps que ele já migra na Fase 3 Onda 4 — combinado no mesmo PR pra evitar mexer 2x no mesmo código)
**Esforço:** M (~2 semanas-dev, diluído na Fase 3)

**Apps afetados:** `msgops-api`, `message-trigger`, `campaign-packer`, `tag-process`, `campaign-events-tracker` — 3 dos 5 (`message-trigger`, `campaign-packer`, `tag-process`) coincidem com Onda 4 do Danilo; `msgops-api` é do Gui (coordenação cruzada na S5); `campaign-events-tracker` é só BullMQ (Danilo pega).

- Adicionar `@nestjs/bullmq` + `bullmq` em `packages/messaging` ou `packages/jobs`
- Padrão: fila BullMQ por use-case (ex.: `queueTimer`, `queueCondition` no message-trigger)
- Mapear `scheduleTime` → `delay` do BullMQ
- Remover `@google-cloud/tasks` dos 5 apps
- Setup `bull-board` opcional no `docker-compose.yml` para dashboard de jobs

**Saída:** zero Cloud Tasks, Redis já existente reutilizado

**Given/When/Then (aceitação):**
- *Given* job agendado com `scheduleTime` em 30s, *When* 30s passam, *Then* job é processado e registrado como sucesso.
- *Given* 5 apps migrados, *When* `grep -r "@google-cloud/tasks" apps/`, *Then* zero matches.

---

### Fase 5 — Storage → S3-compatible
**Dono:** Gui (os 2 apps afetados — `send-email` e `msgops-api` — são dele na Fase 3)
**Esforço:** S (~0,75 semana-dev, diluído)

- Substituir `@google-cloud/storage` por `@aws-sdk/client-s3` em `send-email` (S3, qui 7/mai) e `msgops-api` (qua 13/mai, antecipado pra desbloquear Super Admin do Danilo)
- Configurar endpoint customizável (apontando para S3/MinIO/R2/etc.)
- Adicionar MinIO no `docker-compose.yml` como default de dev
- Atualizar `.env.example` com `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`

**Saída:** storage agnóstico de cloud

---

### Fase 6 — Datastore → PostgreSQL ✅ JÁ CONCLUÍDA (histórico)

**Status:** Migração Datastore → Postgres foi executada em trabalho anterior, fora do escopo deste plano. Schema Postgres existe em `packages/database` (TypeORM) cobrindo as ~30 entidades (accounts, users, campaigns, contacts, messages, statistics, pools, etc).

**Validação na Fase 0:** `grep -r "@google-cloud/datastore" .` → zero hits esperado. Se aparecer resíduo, é bug pontual tratado na Fase 0 (não reabre esta fase).

**Consequência no plano:** ~5 semanas-dev liberadas de Dev B, redistribuídas para Auth (Fase 7) ganhar folga desde o dia 1 e Super Admin (7.6) ter buffer real.

---

### Fase 7 — Auth local próprio + remover Auth0 (DESPRIORIZADA — stretch goal)
**Donos:** Danilo (backend) + Gui (ajuda frontend) — **só se gate de qua 20/mai EOD for verde**
**Esforço:** M/L (~3 semanas-dev)
**Prioridade:** **ÚLTIMA.** Decisão da reunião 16/abr (Pet): Auth0 tem tier gratuito de 10k users que cobre a maior parte dos self-hosters. Trocar auth em prazo apertado adiciona janela de bugs em camada crítica. **Auth0 fica no v0.1.0 por padrão.** Migração pra auth local vira **v0.1.x** se ambos devs fecharem tudo antes de qua 20/mai.

**Trigger pra ativar:** Dev B termina Fase 7.6 + Fase 8 + Fase 10 até sexta 16/mai com folga. Nesse caso, ataca Fase 7 na S5.

**Quando ativar NÃO:** qualquer atraso no Checkpoint 3 (15/mai) ou sinais de bug no Super Admin / Wizard. Auth cutover quebrando no launch day custa mais que manter Auth0.

Autenticação própria, zero dependência externa. Padrão da maioria dos projetos open source self-hosted (n8n, Directus, Evolution API).

**Stack:**
- `@nestjs/passport` + `passport-local` (login) + `passport-jwt` (proteção)
- `bcrypt` ou `argon2` para hash de senha (Dev B decide no start)
- Tabelas `users`, `sessions`, `password_resets` em Postgres via `packages/database`
- **JWT em httpOnly cookie vs Authorization header — decidir no início da Fase 7** (Open Question #2)
- Refresh tokens com rotação
- Reset de senha por email (reaproveita `send-email` do próprio monorepo)

**Arquitetura:**
- Módulo `AuthModule` local e direto (sem abstrações de provider externo)
- Decorator `@CurrentUser()` e guards compartilhados em `packages/shared`
- Roles: `USER`, `ADMIN` (account-level), `SUPER_ADMIN` (platform-level — usado na Fase 7.6)

**Apps afetados (escopo open source):**
- **Backend** (remover `auth0`, implementar JwtStrategy local): `msgops-api`
- **Frontend** (remover Auth0, implementar login/refresh client-side): `frontend-vue2`


**Rollback / Feature flag strategy (Fase 7):**
- `AUTH_PROVIDER=local|auth0` env var seleciona provider no Nest module (mantém dois até launch)
- Durante Fase 7, CI roda testes em ambos os providers para evitar regressão acidental no legado
- Após launch, `auth0` é removido em v0.1.1 (mesmo padrão da Fase 6)
- Se cutover do frontend quebra em prod local em Fase 7 final, rollback via env flag sem precisar redeploy de código

**Saída:** zero Auth0 nos apps open source (`msgops-api` + `frontend-vue2`), auth totalmente local, `docker compose up` + seed cria admin e funciona.

**Given/When/Then (aceitação):**
- *Given* `AUTH_PROVIDER=local` e user criado via setup wizard, *When* user faz login com email+senha válidos, *Then* recebe JWT (cookie httpOnly OU header — conforme decisão), e rota protegida passa em 200.
- *Given* JWT expirado, *When* faz request protegido, *Then* backend responde 401 + hint de refresh, frontend executa refresh automaticamente, request original é re-tentado.
- *Given* 2 apps migrados (`msgops-api`, `frontend-vue2`), *When* `grep -r "auth0\|@auth0" apps/msgops-api apps/frontend-vue2`, *Then* zero matches (exceto em comentários ou histórico).
- *Given* `SUPER_ADMIN` role atribuída ao user X, *When* acessa rota `/internal/admin/*`, *Then* passa; *When* user `ADMIN` comum tenta, *Then* 403.

---

### Fase 7.5 — Tela de setup inicial (Wizard UI completo)
**Dono:** Danilo (S1 ter 21 a S2 ter 28/abr — começa dia 1)
**Esforço:** M (~1,5 semanas-dev)
**Prioridade:** ALTA — começa dia 1. Depende do **Auth0 existente** (não do auth local, que foi despriorizado). Wizard cria o primeiro admin usando o fluxo Auth0 atual + seeder inicial. Pet (reunião 16/abr): "é uma telinha, CRUD simples, rapidinho de fazer".

**Escopo: UI completa, não CLI.** Sem wizard visual, usuário trava na primeira tela após `docker compose up`. Padrão de mercado (Evolution API, n8n, Directus, Ghost, Outline).

**Fluxo:**
1. **Detecção:** app checa se existe ao menos 1 user admin no DB — se não, redireciona tudo pra `/setup`
2. **Passo 1:** criar admin user (email + senha + confirmação)
3. **Passo 2:** configurar SMTP (host, port, user, pass, from) — com botão "Enviar email de teste" antes de avançar
4. **Passo 3:** configurar domínio base / URL pública
5. **Passo 4:** (opcional, skippable) conectar primeiro IP pool, criar primeira conta (tenant)
6. **Passo 5:** health check — testa RabbitMQ, Redis, ClickHouse, S3, SMTP, Postgres — e só avança com tudo verde (ou skip explícito com warning)
7. Marca setup como completo (flag em tabela `system_config`)

**Implementação:**
- Endpoints `/api/setup/status`, `/api/setup/advance`, `/api/setup/test-smtp`, `/api/setup/health` em `msgops-api`
- Rotas `/setup/*` no `frontend-vue2` (app principal BMS) — componentes Vue 2 usando o mesmo design system atual
- Middleware/guard no Vue Router: se setup não completo → redirect para `/setup`
- Após setup completo, middleware deixa passar e redireciona `/setup` para dashboard

**Given/When/Then (aceitação):**
- *Given* VM virgem + `docker compose up`, *When* abro `http://localhost:8080`, *Then* sou redirecionado para `/setup` e vejo passo 1.
- *Given* passo 2 (SMTP) preenchido, *When* clico "Enviar teste", *Then* recebo email real no endereço do admin criado no passo 1.
- *Given* passo 5 (health check), *When* todos os serviços estão up, *Then* todos aparecem verdes em < 10s e botão "Concluir" habilita.
- *Given* setup concluído, *When* recarrego `/setup`, *Then* sou redirecionado para dashboard (setup não pode ser refeito sem reset explícito).

---

### Fase 7.6 — Painel Super Admin (POLIMENTO do `msgops-manager-frontend`)
**Dono:** Danilo (começa seg 20/abr — Dia 1 — com a análise pronta em mão)
**Esforço:** S/M (~5-6 dias-dev) — análise concluída, zero investigação pendente
**Análise completa:** `[C]analysis-msgops-manager-frontend.md`

**Stack confirmada:** Vue 3 + Vite + Vuetify 3 + Pinia + vue-router + vue-i18n + Auth0 (`@auth0/auth0-vue`) + vee-validate/zod + Storybook + Vitest. Versão 2.0.0.

**Domínios:** Accounts + Billing + Users (painel enxuto).

**Trabalho mecânico (1 dia-dev total):**
1. `.env.example` placeholders (5min)
2. Roles Auth0 via env var em vez de hardcode `https://bri.us/roles` (1h)
3. Rename `_common/Brius` → `_common/Bms` (30min)
4. `.gitlab-ci.yml` → GitHub Actions (1h)
5. 30 arquivos com strings Etus/Brius → busca + replace (1h)
6. README do app (30min)
7. Storybook + tests verdes (1h)

**Trabalho de produto (4-5 dias-dev):**
- Plugar endpoints na `msgops-api` migrada (quando Gui entregar qua 20/mai — 2h)
- Adicionar features globais que Super Admin open source precisa ter: health dashboard de RabbitMQ/Redis/ClickHouse/Postgres/MinIO, visualização de DLQs com contagem, configs globais (rate limits default, flags de feature), IP pools (se o painel atual não tiver)

Administração global (meta-admin). Distinto do "admin de uma account".

**Features v0.1.0:**
- Listar/criar/suspender **accounts** (tenants)
- Listar/gerenciar todos os **users** (reset senha, impersonar, promover/rebaixar role)
- **Métricas de plataforma:** mensagens/s, accounts ativos, uso de recursos, tamanho de filas
- **Health do sistema:** status RabbitMQ, Redis, ClickHouse, Postgres, MinIO; DLQs com contagem
- **Logs e auditoria globais** (integra com logger padronizado da Fase 8)
- **Configurações globais:** rate limits default, limits por plano, flags de feature
- **Gestão de IP pools** a nível de plataforma (já existia na Etus — porta pra super admin)

**Arquitetura:**
- Role `SUPER_ADMIN` no sistema de auth (definida na Fase 7)
- Guard `@Roles(SUPER_ADMIN)` protegendo rotas `/internal/admin/*` na `msgops-api`
- UI no `frontend-vue2` em seção dedicada (`/admin/*`) — acesso condicional à role do user logado, menu item só aparece para super admin

**Dependências de ordem:**
- Fase 7 (auth + roles) **completa** antes de começar
- Fase 8 (logging) ideal antes (Super Admin consome logs), mas pode ser concurrent
- Deve rodar contra `msgops-api` **já migrado** da Fase 3 onda 5 (última) — sem isso, endpoints admin ficam quebrados

**Given/When/Then (aceitação):**
- *Given* user com `SUPER_ADMIN`, *When* abre `/admin/accounts`, *Then* vê lista de accounts com filtros e ações.
- *Given* Super Admin, *When* clica "Impersonar" em user X, *Then* sessão fica em contexto de X (com banner visível indicando), e "Sair da impersonação" volta ao admin.
- *Given* Super Admin, *When* abre `/admin/health`, *Then* vê status de RabbitMQ, Redis, ClickHouse, Postgres, MinIO atualizando em < 30s.
- *Given* DLQ com mensagens, *When* Super Admin abre `/admin/queues`, *Then* vê lista de DLQs com contagem e link pra requeue (pode ser apenas visualização na v0.1.0 — requeue é roadmap).

---

### Fase 7.7 — GeoDB (geolocalização IP → cidade)
**Dono:** Danilo (S4 qua 13 a qui 14/mai)
**Esforço:** S (~0,5 semana-dev)

**Contexto:** descoberto na reunião 16/abr. Hoje a Etus usa um serviço pago de geolocalização (banco local, ~1-2ms de latência) que faz match IP → cidade. Volume alto (milhões de eventos/mês). API pública (200-300ms) não serve.

**Decisão:** **DB-IP Lite City** (CC-BY 4.0, redistribuível) como default + feature flag `GEO_ENRICHMENT_ENABLED`.

**Por que DB-IP Lite:**
- Único com licença permissiva pra embutir em imagem Docker pública open source (CC-BY 4.0)
- Granularidade cidade + estado + lat/long (não só estado)
- ~125 MB MMDB, atualização mensal, download público sem conta
- Lib Node.js `maxmind` (258k dl/semana) lê o `.mmdb` nativo

**Alternativas registradas no research:**
- **Tier 2 (opt-in):** MaxMind GeoLite2 — mais preciso mas EULA proíbe redistribuição (self-hoster traz o próprio banco)
- **Tier 3 (opcional):** ip-api.com Pro / ipinfo.io Core — feature flag `GEO_PROVIDER=api` pra quem não quer gerenciar banco local

**Graceful degradation:** se self-hoster não configurar nada, evento de tracking é registrado mas campos `geo_city`/`geo_region`/`geo_country` ficam `null`. Dashboard mostra "Localização não disponível", não quebra.

**Saída:**
- `packages/geo` com interface `GeoProvider` + implementações `DbIpProvider`, `MaxMindProvider`, `ApiProvider`, `NoopProvider`
- Script `scripts/download-geodb.sh` ou cron no container pra refresh mensal
- Atribuição CC-BY visível na UI ("IP geolocation by DB-IP.com")
- Feature flag `GEO_ENRICHMENT_ENABLED` + `GEO_PROVIDER=local|api|disabled`

**Research completo:** ver `workspace/development/features/bms-opensource/[C]research-geodb.md` (output do scroll-docs).

---

### Fase 8 — Logging e GCP cleanup final
**Dono:** Danilo (S5 seg 18/mai)
**Esforço:** S (~0,5 semana-dev)

- Remover `@google-cloud/logging` do tag-process → padronizar em `pino` (verificar uso atual no monorepo)
- **Decidir destino de BigQuery** (Open Question #5) — remover / ClickHouse / opcional behind flag
- Remover referências a Cloud Run, Cloud Scheduler, Artifact Registry da documentação
- Trocar por docker-compose + sugestões de deployment genéricas (Kubernetes, Docker Swarm, Nomad)
- Remover ADC (Application Default Credentials) dos bootstraps

---

### Fase 9 — docker-compose.yml completo
**Donos:** Gui (lead — ele é devops, skeleton na S4 qui 14/mai, close na S5 qui 21/mai) + Danilo (review)
**Bloqueia:** publicação
**Esforço:** M (~1,5 semanas-dev)

`docker-compose.yml` root que suba **tudo que é necessário**:
- PostgreSQL
- ClickHouse
- RabbitMQ (com management UI)
- Redis
- MinIO (S3)
- **Todos os 18 apps**

**Sem Keycloak** — auth é local (Fase 7).

Healthchecks (`depends_on: condition: service_healthy`) em todos os serviços de infra. Imagens multi-arch `linux/amd64` + `linux/arm64` documentadas (ou confirmadas testadas).

Objetivo: `git clone && docker compose up` funciona out of the box.

**Given/When/Then (aceitação):**
- *Given* VM Linux x86 virgem com Docker, *When* `git clone && docker compose up`, *Then* todos os serviços de infra passam healthcheck em < 90s e todos os 18 apps ficam up em < 3 min.
- *Given* Mac ARM (M-series) virgem, *When* mesmo comando, *Then* sobe sem `platform: linux/amd64` overrides manuais.
- *Given* seed data decidida (Open Question #6), *When* primeiro boot, *Then* seed roda automaticamente e setup wizard vê DB pronto.

---

### Fase 10 — Docs e licenciamento
**Donos:** Danilo (lead — S5 ter 19 a qui 21/mai) + Gui (review)
**Bloqueia:** publicação
**Esforço:** S (~1 semana-dev)

- LICENSE = **Apache 2.0** (já decidido)
- README reescrito (atualmente descreve só 2 apps, precisa cobrir os 18 apps open source + roadmap de Known Limitations + seção de Vue 2/v0.2 migration)
- `docs/architecture.md` — visão geral dos **18 apps**, pipelines, contratos
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md` (email de contato, disclosure policy)
- `.github/` templates: issue, PR, + workflow CI básico (build + lint + teste mínimo)
- `docs/getting-started.md` — `docker compose up` + primeiros passos pós-setup wizard
- **`docs/firebase-fcm-setup.md`** (Open Question #7) — como configurar FCM para quem usa push
- **`docs/deployment.md`** (NOVO — decisão reunião 16/abr) — **sizing guide**: faixas de RAM/CPU recomendadas por volume de leads/mensagens para ClickHouse, Postgres, RabbitMQ, Redis. Pet: "a gente recomenda, o provisionamento é carga do DevOps do cliente". Incluir templates para DigitalOcean RDS (ClickHouse), AWS RDS Postgres, e VPS genérica.
- **`docs/geodb.md`** — como configurar DB-IP Lite (download, path, refresh), com opção de trocar pra MaxMind ou API remota

---

## Ordem de execução (com trilhas paralelas)

```
         Gui (Infra & Messaging)                  Danilo (Apps & Admin & Jobs)
              |                                         |
     Fase 0 (split/pre-flight)  --------- (compartilhada) ----
              |                                         |
         Fase 1 (lib + bridge HTTP)           Fase 7.5 start (Wizard)
              |                                         |
         Fase 2 (piloto)                      Fase 7.5 core ⟵ Checkpoint 1
              |                                         |
         Fase 3 (onda 1)                      Fase 7.5 close
         + Fase 4 start                       + Fase 7.6 start
              |                                   (polir msgops-manager-frontend)
                       ⟵ Checkpoint 2 ⟶
              |                                         |
         Fase 3 (ondas 2,3,4)                 Fase 7.6 core
         + Fase 4 close                       + Fase 7.7 (GeoDB - DB-IP Lite)
         + Fase 5 (S3)                                   
              |                                         |
                       ⟵ Checkpoint 3 ⟶
              |                                         |
         Fase 3 (onda 5: msgops-api)          Fase 7.6 close
         + Fase 9 (compose 4 serviços)        + Fase 8 (logging)
                                              + Fase 10 (docs + sizing guide)
                                              + [STRETCH: Fase 7 Auth local]
              |                                         |
                       ⟵ Checkpoint 4 ⟶
              |                                         |
                    Semana 6 — Launch (26/mai)

// Morto no código (Fase 0 só remove resíduo):
Fase 6 (Datastore → Postgres) — FEATURES NÃO USADAS

// Pós-publicação (não bloqueia lançamento):
Fase 7 (Auth local) — v0.1.x se não der tempo
Migração Vue 2 → Vue 3 / React — v0.2.x (90k+ LOC)
```

---

## Checkpoints obrigatórios

| Quando | O que precisa estar verde | Se falhar |
|---|---|---|
| **Sexta 1/mai** (fim S2) | Lib messaging done, `event-receiver` rodando, **auth backend feature-complete com E2E verde** | Revisão imediata da distribuição de trabalho + daily extra; sem corte de escopo |
| **Sexta 10/mai** (fim S3) — **CRÍTICO** | 3 apps Fase 3 migrados + auth frontend funcional + Wizard passos 1–3 | Ativa Plano B (ver abaixo) |
| **Sexta 15/mai** (fim S4) | `docker compose up` sobe tudo + Wizard end-to-end verde + Super Admin começou + 8+ apps migrados | Revisão + daily intensificado + Davidson reavalia launch |
| **Quinta 21/mai** (S5) | `git clone && docker compose up` funciona em VM x86 virgem **E** Mac ARM virgem | **Adiar launch 1 semana (2/jun)** — Davidson decide |

### Plano B (emergência, ativado se Checkpoint 2 em 10/mai falhar)

**Davidson foi explícito: não cortar escopo.** A válvula de escape é **adiar launch**, não cortar features.

Sequência de resposta:
1. **Revisão profunda da alocação:** há item estilo "gold-plating" em progresso? Pair programming para destravar?
2. **Davidson reavalia cronograma:** launch pode ir para 2/jun (segunda semana de junho)? Em caso afirmativo, recalibrar checkpoints.
3. **Reforço temporário:** Davidson entra como 3º dev em itens de trilha (não só review) na semana do pico?
4. **Última linha:** se mesmo com reforço e prazo estendido em 1 semana não couber, reabrir conversa com Davidson sobre tradeoff prazo vs escopo. Este plano não toma essa decisão.

---

## Riscos

### ~~Risco 1 — Fase 6.1 (Datastore → Postgres) escorrega~~ ✅ ELIMINADO
Datastore morto no código (confirmado reunião 16/abr com Pet/Bragança). Sem trabalho a fazer.

### ~~Risco 2 — Auth cutover atrasa~~ ✅ MITIGADO
Auth0 mantido no v0.1.0 (decisão Pet). Auth local vira stretch goal — não bloqueia launch.

### Risco 1 (novo) — Bridge HTTP adiciona latência / complexidade no pipeline de mensageria
**Probabilidade: BAIXA-MÉDIA. Impacto: MÉDIO.**

Consumer AMQP → HTTP service adiciona ~50-200µs por msg + ponto de falha extra (service HTTP indisponível). No pipeline de email tracking com milhões de eventos/mês, isso escala.

**Mitigação:**
- Retry com backoff no consumer em caso de 5xx do service
- Circuit breaker simples (após N falhas consecutivas, pausa consumer por X segundos)
- Healthcheck HTTP no service antes do consumer começar a puxar msgs
- Smoke test de carga no Checkpoint 2 (10/mai) com volume realista

### ~~Risco 2 — Super Admin tem dependências não mapeadas~~ ✅ ELIMINADO (mapeadas)
App `msgops-manager-frontend` confirmado no monorepo + análise concluída em `[C]analysis-msgops-manager-frontend.md`. Stack: Vue 3 + Vite + Vuetify 3 + Pinia + Auth0 já integrado. Apenas **4 domínios de página** (Accounts, Billing, Users, Home/Callback).

**Alterações necessárias já mapeadas (~7h de trabalho mecânico):**
1. `.env.example` — placeholders genéricos (5min)
2. Roles Auth0 hardcoded (`https://bri.us/roles`, `etus_superbilling`) — namespace via env var (1h)
3. Rename namespace `Brius` em `_common/` → `Bms` (30min, mecânico)
4. `.gitlab-ci.yml` → GitHub Actions workflow (1h)
5. Strings Etus/Brius em 30 arquivos (i18n/, pages/, stores/) — 1h
6. README do app reescrito (30min)
7. Plugar endpoints na `msgops-api` migrada quando Gui entregar qua 20/mai (2h)

**Risco residual:** features globais que o Super Admin deveria ter no open source mas não existem ainda (health dashboard, DLQ view, rate limits globais) — são **features adicionadas**, não bugs. Tempo total da Fase 7.6 (~5-6 dias-dev) já inclui.

### Risco 3 — `docker compose up` falha em ambiente de reviewer (launch day desastre)
**Probabilidade: MÉDIA. Impacto: FATAL reputacionalmente.**

Variáveis de env, imagens ARM vs x86, portas colididas, healthcheck de RabbitMQ que demora 40s e timeouts errados.

**Mitigação:**
- Smoke test em VM limpa na sexta 15/mai (S4) — não deixar pra S5
- Segundo smoke test na quinta 21/mai em VM **ARM** (Mac M-series) além do x86
- Imagens `linux/amd64` **E** `linux/arm64` no compose
- Healthchecks com `depends_on: condition: service_healthy` em todo serviço de infra
- Sentinela: rodar em CI (GitHub Actions) um job `docker compose up` + curl num healthcheck antes do launch

### Risco 4 — Escopo completo + 2 devs + 6 semanas (com folga real após reunião 16/abr)
**Probabilidade: BAIXA-MÉDIA (reduzida significativamente: Fase 6 morta + Auth0 mantido + Super Admin com reuso).** Impacto: alto no prazo se surpresa.

Davidson foi explícito: escopo não corta. Isso significa que o plano **tem que funcionar com eficiência de paralelização > 70%**. Qualquer dev em doença, qualquer dia perdido em bug imprevisto, qualquer handoff mal-feito consome buffer.

**Mitigação:**
- 4 checkpoints duros que detectam slippage em até 5 dias
- Davidson dedicado a unblock (não é caminho crítico de feature, mas está sempre disponível em menos de 2h úteis)
- Válvula de escape acordada: **launch pode ir 1 semana** (para 2/jun) se checkpoint de 21/mai falhar — melhor adiar que publicar quebrado
- Daily sync curtos na S5 (semana mais crítica)

---

## Open Questions

(Repetidas aqui para tracking. Detalhes e fase-alvo acima na seção "Em aberto").

**Abertas (resolvem durante execução):**
- [ ] Nomenclatura AMQP (exchanges, routing-keys, DLQ suffix) — decide **Fase 1** (Dev A/Gui propõe). Risco: baixo.
- [ ] Seed data para dev local — defina na **Fase 9**. Risco: baixo.
- [ ] FCM onboarding UX — documenta na **Fase 10**. Risco: baixo.

**Abertas (dependem de terceiros):**
- ~~Bragança libera repo do Super Admin do branch antigo GitLab~~ ✅ **resolvido** — `msgops-manager-frontend` já está no monorepo (confirmado 16/abr). Nenhuma ação externa necessária.
- [ ] **Sizing numbers do Pet** (RAM/CPU/conexões operação atual Etus). Pode entregar até S5. Risco: baixo.
- [ ] **Pet OK final** no plano atualizado (action item reunião). Não bloqueia tecnicamente. Risco: baixo.
- [ ] **Davidson confirma DB-IP Lite** como GeoDB default após review do research (`[C]research-geodb.md`). Prazo: antes Fase 7.7 (S4). Risco: baixo.

**Travadas pós-reunião 16/abr:**
- ✅ Nome da lib → **`@bms/messaging`**
- ✅ Git history → **`git filter-repo`** (limpar histórico)
- ✅ BigQuery → **remover + doc** (menor esforço, ~2h)
- ✅ Dev A → **Gui** (messaging & apps, devops)
- ✅ Dev B → **Danilo** (admin & config, UI)

**Resolvidas pela reunião 16/abr:**
- ~~JWT cookie vs header~~ não aplicável (Auth0 fica, Fase 7 stretch)
- ~~Coexistência fork Etus~~ resolvido (apps de retention já removidos do projeto)
- ~~Acesso a staging Etus~~ Datastore morto, sem provider novo
- ~~Dev A/B nominal~~ Gui/Danilo

Estas Open Questions são também trackadas em `workspace/development/plans/[C]open-questions.md`.

---

## Próximos passos imediatos

**Pendências Davidson:**
1. Revisar `[C]research-geodb.md` e confirmar DB-IP Lite (ou trocar pra MaxMind Tier 2)
2. Alinhar com **Bragança**: formalizar commit removendo Datastore morto (o Super Admin já está no monorepo como `apps/msgops-manager-frontend`)
3. Coletar números de sizing com **Pet** (RAM/CPU/conexões operação atual Etus) pro sizing guide
4. Mandar plano atualizado pro **Pet** pra OK final
5. Abrir feature no Linear/GitHub Project com issues por fase, labels `track-a` (Gui) / `track-b` (Danilo), milestone `v0.1.0 launch 2026-05-26`
6. Agendar os 4 checkpoints no Calendar: 1/mai, 10/mai, 15/mai, 21/mai — 30min cada, Davidson + Gui + Danilo

**Handoff técnico:**
7. `@apex-architect` (Phase 3 — Solutioning) para 2 ADRs:
   - ADR-1: Contrato `@bms/messaging` + **bridge HTTP loopback** (double retry AMQP→consumer→HTTP→service, DLQ naming, routing keys, circuit breaker, health check)
   - ADR-2: **GeoDB provider arquitetura** — interface pluggable (local/api/disabled), download/refresh strategy do `.mmdb`, graceful degradation
   - ~~ADR-3: Auth local~~ — **adiado** (Fase 7 stretch)
   - ~~ADR-4: Provider Postgres JSONB~~ — **não necessário** (Datastore morto)

**Critério pra começar execução (Fase 0 no dia 20/abr):** itens 1-6 resolvidos. ADRs (item 7) podem rodar em paralelo com Fase 0.

---

## Handoff

**Próximo agente:** `@apex-architect` (Phase 3 — Solutioning) para as 2 ADRs acima (**Messaging com bridge HTTP** + **GeoDB provider**).

**Em paralelo:** Davidson responde Open Questions #4/#5/#8/#9 (bloqueiam o start).

**Depois das ADRs:** `@bolt-executor` (Phase 4 — Build) executa fase por fase conforme este plano, com `@oath-verifier` no fim de cada semana validando o checkpoint.
