# Plano RBAC MsgOps (Role Global + Override por Conta)

## Resumo
Implementar RBAC interno no MsgOps (sem depender de roles do Auth0), com:
1. **Role global principal por usuário**.
2. **Role por conta com herança da role global ou override explícito**.
3. **Autorização unificada para dois tipos de principal**: `user` (JWT) e `api_key` (header `api-key`, com compatibilidade temporária para `x-api-key`).
4. **Autorização no backend por principal + permissão**, removendo dependência de `User-Id` header.
5. **Bloqueio de navegação e ações no frontend atual** (`msgops-frontend`) com base nas permissões vindas da API.
6. **Fluxo de convite e gestão de roles via API** para consumo pelo novo backoffice `etus-retention-backoffice`.
7. **Migração dos api keys legados** (`accounts_configs.name in ('api_key', 'api_key_tracker')`) sem quebrar integrações externas.

## Achados do review (base técnica)
- O frontend ainda envia `User-Id` no header e usa claims de role do Auth0: [api.service.ts](/Users/filipe/Projects/Etus/msgops-frontend/src/services/api.service.ts:39), [App.vue](/Users/filipe/Projects/Etus/msgops-frontend/src/App.vue:86).
- O backend confia em headers para identidade/autorização e não em `sub` do JWT: [users.controller.ts](/Users/filipe/Projects/Etus/msgops-api/src/modules/users/users.controller.ts:25), [account.middleware.ts](/Users/filipe/Projects/Etus/msgops-api/src/middlewares/account.middleware.ts:19).
- Há controllers sem guard de autenticação ativo (exemplo explícito): [automations.controller.ts](/Users/filipe/Projects/Etus/msgops-api/src/modules/automations/automations.controller.ts:33), [messages.controller.ts](/Users/filipe/Projects/Etus/msgops-api/src/modules/messages/messages.controller.ts:12).
- O modelo atual de acesso é `is_master_user` em `users_accounts`: [users-account.entity.ts](/Users/filipe/Projects/Etus/msgops-api/src/entities/users-account.entity.ts:13).
- Já existem api keys legados em `accounts_configs` (`api_key`, `api_key_tracker`) sem RBAC explícito por permissão.
- Há inconsistência de header para API key (`api-key`, `x-api-key`, `X-API-KEY`) em middleware/strategy/controllers, exigindo normalização única.
- Existem validações manuais de API key em controllers; isso deve ser centralizado em guard para evitar bypass e comportamento divergente.
- O grafo atual de módulos não tem ciclo explícito, mas há risco de ciclo futuro se o novo RBAC depender de `UsersService` e `AccountsService` ao mesmo tempo.

## Modelo alvo de autorização

## Roles fixas (6)
| Role | Escopo |
|---|---|
| `super_admin` | Acesso total plataforma, todas as contas, sem limitação |
| `admin` | Acesso total na conta em que possui membership |
| `editor` | Operação de engajamento; audiência e análises leitura; sem settings/usuários/infra/auditoria |
| `analyst` | Leitura ampla em todos os recursos da conta; sem mutações |
| `support` | Contatos + suppressions; dashboard leitura; sem auditoria |
| `billing` | **Postergado** (role existente sem permissões funcionais nesta fase) |

## Tipos de principal (autorização unificada)
| Principal | Autenticação | Identidade efetiva | Escopo |
|---|---|---|---|
| `user` | JWT (`Authorization`) | `users.id` via `sub/provider_id` | Global + por conta |
| `api_key` | Header `api-key` | `account_api_keys.id` | Sempre por conta |

- `api_key` **não** usa `users` como armazenamento primário.
- Ambos passam pelo mesmo `PermissionGuard` após resolver `effectiveRole` e `permissions`.
- Canonical header para integrações: `api-key` (aceitar `x-api-key` durante migração para manter compatibilidade).

## Diretrizes para evitar dependência circular (implementação)
- Criar `AuthzModule` dedicado (infra de autorização), sem depender de serviços de feature (`UsersService`, `AccountsService`, etc.).
- `AuthzModule` usa apenas repositórios/entidades necessários para resolução de principal e permissões (`users`, `users_accounts`, `roles`, `role_permissions`, `account_api_keys`).
- Registrar `PrincipalContextGuard` e `PermissionGuard` como globais (`APP_GUARD`) a partir do `AuthzModule`.
- Feature modules não importam `AuthzModule` para resolver dados de autorização; consomem apenas decorators/metadados.
- Evitar `forwardRef` como solução padrão; se surgir necessidade, tratar como smell arquitetural e refatorar dependência.

## Regra de papel efetivo
`effectiveRole(accountId) = accountRoleOverride ?? globalRole`, com exceção:
- `super_admin` ignora membership por conta e sempre tem acesso total.
- `api_key` não tem role global; usa apenas role vinculada à chave na conta.

## Regra específica do Editor (decisão fechada)
- Editor **não cria campanha do zero**.
- Backend passa a exigir criação via configuração de regra (`configId`) para criação de campanha por Editor.

## Mudanças em dados e tipos públicos

## Banco (msgops-api)
- Criar tabela `roles` (source of truth de papéis):
  - `id` (PK), `code` (UNIQUE), `name`, `description`, `is_system`, `is_active`, `created_at`, `updated_at`.
- Criar tabela `role_permissions`:
  - `role_id` (FK `roles.id`), `permission_key`, `effect` (`allow`), UNIQUE (`role_id`, `permission_key`).
  - Nesta fase, povoada para as 6 roles fixas; estrutura já pronta para roles customizadas.
- `users.global_role_id` FK `roles.id` NOT NULL.
- `users.status` (`active|pending_invite|disabled`) para governar convite/ativação.
- `users_accounts.role_override_role_id` FK `roles.id` NULL (null = herda global).
- Criar tabela `account_api_keys`:
  - `id` (PK), `account_id` (FK), `name`, `key_hash`, `role_id` (FK `roles.id`), `status`, `expires_at`, `last_used_at`, `created_by_user_id` (FK nullable), `source` (`managed|legacy_import`), timestamps.
- Manter `is_master_user` temporariamente para compatibilidade e rollback; remover em fase posterior.

## Backfill e migração legada
- Seed inicial de `roles` + `role_permissions` para as 6 roles de sistema.
- Backfill de usuários:
  - Usuário com algum `is_master_user=true` => `global_role_id=admin`.
  - Demais => `global_role_id=editor`.
  - `users_accounts.role_override_role_id=NULL`.
- Migração de api keys legados:
  - Ler `accounts_configs` com `name in ('api_key', 'api_key_tracker')`.
  - Criar registros em `account_api_keys` com o mesmo segredo (armazenado como `key_hash`) e `role_id=admin` da respectiva conta.
  - Marcar `source='legacy_import'`.
  - Garantir compatibilidade sem rotação obrigatória imediata.

## Contratos de API (novos/ajustados)
- Header de API key: aceitar `api-key` e `x-api-key` no período de migração, com documentação oficial em `api-key`.
- `GET /users/me?accountId=`  
  Retorna usuário, `globalRole`, contas, `effectiveRole`, `permissions[]`.
- `POST /users/invite`  
  Cria convite com `globalRole` + accounts (com herança/override), persiste no DB e dispara e-mail.
- `PUT /users/:id/global-role`
- `POST /users/:id/accounts` (adiciona membership e role por conta)
- `PUT /users/:id/accounts/:accountId/role` (inherit/override)
- `DELETE /users/:id/accounts/:accountId`
- `GET /accounts/:accountId/api-keys` (listar metadados, sem segredo)
- `POST /accounts/:accountId/api-keys` (criar com `roleId`, expiração opcional, retorno do segredo apenas uma vez)
- `PUT /accounts/:accountId/api-keys/:keyId` (atualizar nome, role, expiração)
- `POST /accounts/:accountId/api-keys/:keyId/rotate`
- `POST /accounts/:accountId/api-keys/:keyId/revoke`
- `POST /campaigns/from-config/:configId` (criação permitida para Editor)
- Deprecar uso de `/users/master` e `/users/permissions` baseados em `is_master_user`.

## Tipos frontend (msgops-frontend)
- `UserDto` passa a incluir `globalRole`, `effectiveRole`, `permissions`.
- `UserAccountDto` passa a incluir `roleOverride` e metadado de herança.
- Introduzir `RoleDto` (`id`, `code`, `name`, `isSystem`, `isActive`).
- Remover dependência de `isSuperAdmin/isSuportUser/isMasterRetentionUser/userMaster` como fonte primária.

## Plano de implementação

## Fase 1 — Segurança de identidade e contexto (backend)
- Criar `AuthzModule` e `PrincipalContextGuard` para:
  - Resolver `principalType=user` via JWT (`sub/provider_id` -> `users.id`) usando repositórios.
  - Resolver `principalType=api_key` via header (`api-key` ou `x-api-key`) -> `account_api_keys` usando repositórios.
  - Validar `accountId` solicitado contra membership (user) ou conta da chave (api_key), com exceção de `super_admin`.
  - Popular `ClsService` com `principalType`, `principalId`, `userId?`, `apiKeyId?`, `accountId`, `effectiveRole`, `permissions`.
- Remover dependência de `User-Id` header em controllers/services.
- Substituir `AccountMiddleware` por guard/contexto pós-autenticação.
- Aplicar guards globalmente (`APP_GUARD`) e declarar exceções explicitamente com metadata (`@PublicRoute`/equivalente).
- Separar rotas técnicas (cron/webhook/sync) em guard interno dedicado, sem bypass de RBAC em rotas de produto.

## Fase 2 — Modelo RBAC em dados (backend)
- Criar migrations de `roles`, `role_permissions`, `users.global_role_id`, `users_accounts.role_override_role_id`, `account_api_keys`.
- Seed de roles de sistema e permissões padrão.
- Implementar rotina de backfill/migração legada descrita acima.
- Criar constraints para impedir deleção de roles `is_system=true` em uso.

## Fase 3 — Núcleo RBAC (backend)
- Criar catálogo canônico de permissões (`resource:action`).
- Criar `@RequirePermission(...)` + `PermissionGuard`.
- Carregar permissões por role via `role_permissions` (cacheado).
- Anotar endpoints críticos por permissão.
- Garantir `403` padronizado quando faltar permissão.

## Fase 4 — Higienização de autenticação legada (backend)
- Remover validações manuais de chave em controllers e centralizar decisão no `PrincipalContextGuard`/guard interno dedicado.
- Eliminar pontos que dependem de header de usuário (`User-Id`) para autorização.
- Garantir comportamento único de autenticação para todas as rotas protegidas.

## Fase 5 — Fluxo de convite e papéis de usuário (backend)
- Implementar endpoints de convite/atribuição listados acima.
- Persistir role global e override por conta no convite.
- Fluxo de e-mail de convite (API responsável por disparo).
- Garantir validações:
  - `super_admin` não requer membership.
  - Para demais roles, sem membership => `403`.
  - Override inválido => `422`.

## Fase 6 — RBAC para API keys (backend)
- Implementar CRUD/rotação/revogação de chaves por conta.
- Restringir API key a escopo de conta; bloquear `super_admin` para chaves.
- Permitir role por chave (reuso das roles existentes, com policy própria de quem pode atribuir).
- Manter compatibilidade dos segredos legados já em uso externo.

## Fase 7 — Editor via regra de campanha (backend)
- Criar endpoint `POST /campaigns/from-config/:configId`.
- Implementar validação no guard/service:
  - Editor não usa `POST /campaigns` padrão.
  - Editor só cria via `from-config` (com `configId` existente e autorizado).
- Registrar auditoria de criação por regra.

## Fase 8 — Integração frontend atual (msgops-frontend)
- Trocar bootstrap de sessão para `GET /users/me?accountId=`.
- Parar de enviar `User-Id` em [api.service.ts](/Users/filipe/Projects/Etus/msgops-frontend/src/services/api.service.ts:39).
- Remover leitura de roles Auth0 em [App.vue](/Users/filipe/Projects/Etus/msgops-frontend/src/App.vue:86).
- Adicionar helper único `can(permission)` no store.
- Aplicar bloqueio por permissão em rotas, menu e ações (criar/editar/deletar/enviar/exportar/importar/suppress).
- Implementar recarga de permissões ao trocar conta.
- Para rota não autorizada: redirecionar para `/access-denied` + toast de permissão.

## Fase 9 — Integração com novo backoffice
- Expor contratos estáveis no `msgops-api` para consumo do `etus-retention-backoffice`.
- Entrega desta fase não inclui UI de convite no `msgops-frontend` atual.

## Mapeamento mínimo de permissões por domínio
- `campaigns`: `view|create|create_from_rule|update|delete|send|schedule|pause|resume|cancel|duplicate`
- `automations`: `view|create|update|delete|activate|deactivate|test`
- `messages/templates`: `view|create|update|delete|test_send`
- `audience`: `contacts_view|contacts_import|contacts_export|contacts_suppress|segments_view|segments_execute|tags_view|custom_fields_view`
- `infra`: `custom_events|products|pools|warmups|campaign_rules|labels` (`view|manage`)
- `analytics`: `dashboard_view|dashboard_export|insights_view|comparison_view`
- `account`: `settings_view|settings_update|users_view|users_invite|users_update_roles|roles_view|api_keys_view|api_keys_create|api_keys_rotate|api_keys_revoke|api_keys_update_role`
- `audit_logs`: `view|export` (support sem acesso)

## Testes e cenários de aceitação

## Backend
- JWT com `sub` válido define `userId` sem usar header.
- Header forjado `User-Id` não altera autorização.
- API key válido define `principalType=api_key` e ignora headers de usuário.
- `api-key` e `x-api-key` autenticam de forma equivalente durante a migração.
- Usuário não membro da conta recebe `403`.
- API key acessa apenas sua conta; não acessa outras.
- Precedência correta: override por conta > global (apenas principal `user`).
- `super_admin` acessa múltiplas contas sem membership.
- Migração legada: chaves `api_key` e `api_key_tracker` continuam funcionais com role `admin` na conta de origem.
- Rotas protegidas não contêm mais comparação manual de segredo em controller.
- Matriz por role:
  - Admin permitido nas rotas de gestão e operação.
  - Editor bloqueado em settings/users/infra/audit e bloqueado em criação sem `configId`.
  - Analyst bloqueado em toda mutação.
  - Support permitido apenas em contatos/suppressions + dashboard leitura.
  - Billing sem permissões funcionais.

## Frontend
- Menu e rotas mudam conforme permissões.
- Troca de conta recalcula acesso imediatamente.
- Botões de export escondidos para Editor/Support.
- Deep-link para rota proibida cai em `/access-denied`.
- Fluxo de login não depende mais de role claim Auth0.

## Assumptions e defaults adotados
- Roles do Auth0 deixam de ser fonte de autorização; Auth0 permanece apenas como IdP de autenticação.
- Modelo em tabela (`roles` + `role_permissions`) será a base para liberar roles customizadas em fase seguinte.
- `support` não acessa auditoria.
- `billing` fica postergado (role existente, sem permissões funcionais).
- Api keys legados importados de `accounts_configs` terão `admin` por conta para manter compatibilidade.
- Header oficial para integrações é `api-key`; `x-api-key` fica como compatibilidade temporária.
- Convite e gestão de usuários serão consumidos pelo `etus-retention-backoffice`, não pelo frontend Vue atual.
