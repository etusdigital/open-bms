# Plano de Cleanup: Remoção do Modelo Legado de Guards

## Contexto

Com o RBAC implementado via `AuthzModule` (guards globais `PrincipalContextGuard` + `PermissionGuard`), o modelo antigo de autenticação via Passport `@UseGuards(AuthGuard(...))` é redundante nos controllers que já possuem `@RequirePermission`. Além disso, há controllers sem nenhum guard explícito que dependem apenas de `@ApiBearerAuth()` (decorador Swagger, sem enforcement real).

## Bug crítico encontrado

O `PrincipalContextGuard` (linha 22) retorna `true` quando `principalContext` é `null` e a rota **não** é pública. Isso significa que rotas sem `@RequirePermission` e sem `@PublicRoute` aceitam requests sem autenticação.

```typescript
// principal-context.guard.ts — ATUAL (bugado)
if (!principalContext) {
  if (isPublic) {
    return true;
  }
  return true; // ← BUG: deveria lançar UnauthorizedException
}
```

**Fix**: quando `principalContext` é null e a rota não é pública, deve lançar `UnauthorizedException`.

## Etapas

### Etapa 1 — Corrigir PrincipalContextGuard (BLOCKER)

Corrigir o bug onde requests sem credencial passam em rotas não-públicas.

**Arquivo**: `src/modules/authz/principal-context.guard.ts`

```typescript
if (!principalContext) {
  if (isPublic) {
    return true;
  }
  throw new UnauthorizedException('Unauthorized');
}
```

> **IMPORTANTE**: Só avançar para a etapa 2 depois de marcar como `@PublicRoute()` todas as rotas system/webhook/cron que precisam funcionar sem auth (etapa 2a).

### Etapa 2a — Anotar rotas internas como @PublicRoute

Antes de corrigir o guard, garantir que rotas de sistema continuem funcionando.

| Controller | Rota | Motivo |
|---|---|---|
| `ContactsController` | `POST /contacts/deactivate-inactive-contacts` | Cloud Tasks/cron |
| `ContactsController` | `POST /contacts/clean-push-devices` | Cron/cleanup |
| `ContactsController` | `POST /contacts/remove-push-devices` | Cron/cleanup |
| `ContactsController` | `POST /contacts/events-update` | Internal sync |
| `StatisticsController` | `GET /statistics/set-statistics-redis` | Cron |
| `StatisticsController` | `GET /statistics/aggregated-statistics` | Cron |
| `StatisticsController` | `GET /statistics/aggregated-statistics-backupdate/:date` | Cron |
| `StatisticsController` | `GET /statistics/remove-old-data-from-redis` | Cron |
| `StatisticsController` | `POST /statistics/usage/:accountId/:date` | Internal |
| `IpReputationController` | `POST /ip-reputation/sync` | Cron |
| `WarmupsController` | `POST /warmups/process-target` | Cron |
| `BatchController` | `POST /batch/campaigns-messages` | Internal |

### Etapa 2b — Adicionar @RequirePermission aos controllers restantes

Todos os controllers user-facing precisam de permissões explícitas.

| Controller | Permissão | Rotas |
|---|---|---|
| **ContactsController** | `audience:contacts_view` | GET (list, count, dashboard, suppressed, by ID, history) |
| | `audience:contacts_import` | POST /import |
| | `audience:contacts_export` | GET /export, /export-init, /export-stream, /export-status/:id |
| | `audience:contacts_suppress` | POST /unsubscribe, /bulk-unsubscribe, GET /count-unsubscribe |
| | `audience:contacts_view` | POST (create/edit), /custom-fields, /tags, PUT /custom-fields/edit |
| **TagsController** | `audience:tags_view` | GET (list, by ID, validate-name) |
| | `audience:tags_view` | POST /tags, PUT /tags/:id, DELETE /tags/:id |
| | `audience:segments_view` | GET /segment (check-segment, base-size) |
| | `audience:segments_execute` | POST /segment, PUT /segment/:id, POST /segment/:id/copy, GET /segment/run/:id, GET /segment/check/:id |
| **CustomFieldsController** | `audience:custom_fields_view` | Todos os endpoints |
| **CustomEventController** | `infra:view` | GET (list, by ID, logs) |
| | `infra:manage` | POST, PUT, DELETE |
| **PoolsController** | `infra:view` | GET (list, by ID, SendGrid queries) |
| | `infra:manage` | POST, PUT, DELETE |
| **WarmupsController** | `infra:view` | GET (list, by ID) |
| | `infra:manage` | POST, DELETE |
| **LabelsController** | `infra:view` | GET (list, by ID, entities, contents) |
| | `infra:manage` | POST, PUT, DELETE |
| **CampaignsRulesController** | `infra:view` | GET (list, by ID, validate-name) — rules e configs |
| | `infra:manage` | POST, PUT, DELETE, copy — rules e configs |
| **EmailsTemplatesController** | `messages:view` | GET (list, by ID) |
| | `messages:create` | POST, POST copy |
| | `messages:update` | PUT |
| | `messages:delete` | DELETE |
| **AuditsController** | `audit_logs:view` | GET /:id |
| **StatisticsController** | `analytics:dashboard_view` | GET /email, /push, /messages, /leads, /insights/:period |
| | `analytics:dashboard_view` | GET /automation/:id, /by-campaign-message |
| | `analytics:dashboard_view` | GET /account-usage, /account-usage/month |
| **PostmasterController** | `analytics:dashboard_view` | GET /postmaster |
| **IpReputationController** | (todas @PublicRoute — cron) | — |
| **VerifyController** | `account:settings_view` | GET /statistics |
| | `account:settings_update` | POST /generate, POST /validate |
| **BucketsController** | `infra:manage` | POST (upload, base64, generic-upload) |
| **LeadStateController** | `automations:view` | GET /automations/lead-state |

### Etapa 3 — Remover @UseGuards(AuthGuard(...)) de controllers

Depois das etapas 1 e 2, o guard global cuida de tudo. Remover guards explícitos que agora são redundantes:

| Controller | Guard a remover |
|---|---|
| `AccountsController` | `@UseGuards(AuthGuard(['api-key', 'jwt']))` (class) |
| `AutomationsController` | `@UseGuards(AuthGuard(['api-key', 'jwt']))` (class) |
| `CampaignsController` | `@UseGuards(AuthGuard(['api-key', 'jwt']))` (class) |
| `MessagesController` | `@UseGuards(AuthGuard(['api-key', 'jwt']))` (class) |
| `ServicesController` | `@UseGuards(AuthGuard(['api-key', 'jwt']))` (class) |
| `LeadStateController` | `@UseGuards(AuthGuard(['api-key', 'jwt']))` (class) |
| `BucketsController` | `@UseGuards(AuthGuard('jwt'))` (class) |
| `TestsController` | `@UseGuards(AuthGuard('jwt'))` (class) |
| `UsersController` | `@UseGuards(AuthGuard('jwt'))` (method: /me) |

Depois de remover, limpar imports não usados de `AuthGuard` e `UseGuards` (quando não houver mais uso no arquivo).

### Etapa 4 — Eliminar @Headers('Current-User') e @Headers('User-Id')

Substituir leitura de headers de identidade por contexto do `ClsService` ou `request.authzContext`.

| Controller | Header | Substituir por |
|---|---|---|
| `AutomationsController` | `@Headers('Current-User')` | `cls.get('userId')` ou `req.authzContext.userId` |
| `MessagesController` | `@Headers('Current-User')` | idem |
| `ContactsController` | `@Headers('Current-User')` | idem |

Nota: `@Headers('User-Agent')` deve ser mantido — é header HTTP padrão para auditoria.

### Etapa 5 — Limpar AccountMiddleware

O `AccountMiddleware` foi desconectado do `app.module.ts` mas o arquivo ainda existe. A resolução de conta agora é feita pelo `PrincipalContextGuard` + CLS setup no `app.module.ts`.

**Ação**: Deletar `src/middlewares/account.middleware.ts`.

### Etapa 6 — Remover HeaderApiKeyStrategy do Passport

Com a autenticação de API key centralizada no `PrincipalContextGuard` (via `AuthzService`), o `HeaderApiKeyStrategy` do Passport é redundante — só é invocado pelas `@UseGuards(AuthGuard(['api-key', ...]))` que serão removidas na etapa 3.

**Ações**:
1. Remover `src/auth/header-api-key.strategy.ts`
2. Remover referência em `src/auth/auth.module.ts`
3. Remover import/registro do Passport strategy se não houver mais nenhum strategy em uso

**Cuidado**: Verificar se `JwtStrategy` (Passport) ainda é usado em algum `@UseGuards(AuthGuard('jwt'))` remanescente antes de remover o Passport por completo. Se todos os `AuthGuard('jwt')` forem removidos na etapa 3, o Passport inteiro pode sair.

### Etapa 7 — Limpar CLS setup legado no app.module.ts

O `ClsModule.forRoot()` setup no `app.module.ts` ainda lê `api-key` e `account-id` dos headers diretamente. Isso é legado — o `PrincipalContextGuard` já faz essa resolução. Simplificar o CLS setup para remover a leitura redundante de headers.

**Nota**: Verificar se algum ponto fora do guard depende do `cls.get('apiKey')` legado antes de remover. Atualmente o `AccountMiddleware` (deletado na etapa 5) era o único consumidor.

### Etapa 8 — Verificação final

1. Build sem erros (`npx tsc --noEmit`)
2. Testar login (`POST /users/login`) — rota pública
3. Testar `/users/me` com JWT válido
4. Testar rota protegida com API key válida
5. Testar request sem credencial em rota protegida → deve retornar 401
6. Testar request sem permissão em rota com `@RequirePermission` → deve retornar 403
7. Testar rotas cron/webhook marcadas `@PublicRoute()` sem credencial → deve funcionar

## Ordem de execução

```
Etapa 2a (anotar @PublicRoute nas rotas internas)
  ↓
Etapa 1 (fix do PrincipalContextGuard)
  ↓
Etapa 2b (adicionar @RequirePermission nos controllers restantes)
  ↓
Etapa 3 (remover @UseGuards redundantes)
  ↓
Etapa 4 (eliminar headers Current-User/User-Id)
  ↓
Etapa 5 (deletar AccountMiddleware)
  ↓
Etapa 6 (remover HeaderApiKeyStrategy)
  ↓
Etapa 7 (limpar CLS setup legado)
  ↓
Etapa 8 (verificação)
```
