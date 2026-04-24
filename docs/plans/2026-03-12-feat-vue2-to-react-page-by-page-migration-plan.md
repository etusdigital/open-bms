---
title: 'feat: Vue 2 to React Page-by-Page Migration'
type: feat
status: active
date: 2026-03-12
deepened: 2026-03-12
origin: docs/plans/2026-03-12-feat-reusable-crud-list-page-components-plan.md
---

# Vue 2 to React Page-by-Page Migration

## Enhancement Summary

**Deepened on:** 2026-03-12
**Sections enhanced:** All phases + testing strategy + shared infrastructure
**Research agents used:** TanStack best practices, Testing patterns, TypeScript review, Architecture review, Performance review, Race conditions analysis, Vue 2 DTO extraction, Spec flow analysis

### Key Improvements

1. **Shared test infrastructure** — Centralize test utilities (createQueryWrapper, authenticateStore, ColumnsTable) to eliminate boilerplate duplication across 17 modules
2. **Query key factory pattern** — Extract `createEntityQueryKeys()` helper for consistent cache invalidation across all features
3. **Phase rebalancing** — Move Warmups to Phase 1 (simple CRUD), split Phase 4 into 4a (simple) and 4b (complex)
4. **Race condition guards** — Token refresh for long form edits, account-switch mutation guard, page clamping on last-item delete
5. **Zod schema primitives** — Shared `requiredString()`, `optionalString()` builders with i18n for DRY validation

### Critical Decisions Needed

- **Email editor library**: TipTap, Unlayer, or custom? (blocks Phase 3.3)
- **Automation workflow builder**: React Flow, custom canvas, or simplified list? (blocks Phase 4.1)
- **Permission catalog reconciliation**: Vue 2 has permissions not yet in React types (blocks Phases 2+)

---

## Overview

Port all pages and modules from the Vue 2 frontend (`apps/frontend-vue2`) to the React frontend (`apps/frontend-react`). The Tags feature is the completed reference implementation. Each feature follows the same established pattern: types, schema, hooks, columns, page, form, form-page — with full TDD coverage.

**Scope:** ~50 routes across 19 modules. 26 placeholder routes already exist in the React app.

**Approach:** Phase by phase, simplest CRUD first, then progressively more complex features. Each page is implemented with TDD (RED → GREEN → REFACTOR).

## Problem Statement / Motivation

The Vue 2 frontend (`msgops-frontend`) is built on Vue 2 which reached EOL. The React frontend has been bootstrapped with:

- Auth0 authentication flow
- TanStack Router with file-based routing
- Reusable CRUD components (ListPage, FormPage, DataTable)
- Tags as the complete reference implementation
- Full i18n support (pt-BR + en-US)

The remaining 26 placeholder routes need actual implementations ported from Vue 2.

## Shared Infrastructure (Build Before Phase 1)

Before starting Phase 1, extract and build these shared utilities from the Tags reference implementation. This prevents copy-paste duplication across 17 modules.

### Test Utilities (`src/test-utils/`)

```typescript
// src/test-utils/create-query-wrapper.tsx
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// src/test-utils/authenticate-store.ts
export function authenticateStore(overrides?: {
  permissions?: string[]
  effectiveRole?: string
}) {
  useAppStore.getState().setAuthenticated({
    user: { id: 1, name: 'Test', email: 'test@test.com', profile: '', providerId: 'auth0|123', status: 'active' },
    account: { id: 10, name: 'Account', description: '', isActive: true, isInternal: false, groupId: 1 },
    userAccounts: [],
    permissions: overrides?.permissions ?? [],
    effectiveRole: overrides?.effectiveRole ?? 'user',
    globalRole: null,
    isMasterUser: false,
    accountConfigs: [],
    timezone: 'UTC',
  })
}

// src/test-utils/columns-table.tsx — Generic ColumnsTable wrapper for column tests
export function ColumnsTable<T>({
  columns, data, ...props
}: { columns: ColumnDef<T>[]; data: T[] }) { /* ... */ }
```

### Query Key Factory (`src/lib/query-keys.ts`)

```typescript
export function createEntityQueryKeys(entity: string) {
  return {
    all: [entity] as const,
    lists: () => [...createEntityQueryKeys(entity).all, 'list'] as const,
    list: (params: Record<string, unknown>) => [...createEntityQueryKeys(entity).lists(), params] as const,
    details: () => [...createEntityQueryKeys(entity).all, 'detail'] as const,
    detail: (id: number) => [...createEntityQueryKeys(entity).details(), id] as const,
  };
}

// Usage in features:
// const tagKeys = createEntityQueryKeys('tags')
// queryKey: tagKeys.list({ page, search, accountId })
```

### Zod Schema Primitives (`src/lib/zod-primitives.ts`)

```typescript
import { z } from 'zod';

export function requiredString(fieldName: string, maxLength: number) {
  return z.string().min(1, `${fieldName}::required`).max(maxLength, `${fieldName}::maxLength::${maxLength}`);
}

export function optionalString(fieldName: string, maxLength: number) {
  return z.string().max(maxLength, `${fieldName}::maxLength::${maxLength}`).optional().default('');
}
```

### Mutation Toast Utility (`src/lib/mutation-toast.ts`)

```typescript
export function mutationToast(options: { successKey: string; errorKey: string }) {
  return {
    onSuccess: () => toast.success(t(options.successKey)),
    onError: (error: unknown) => {
      const message = extractApiErrorMessage(error);
      toast.error(message ?? t(options.errorKey));
    },
  };
}

export function extractApiErrorMessage(error: unknown): string | null {
  if (isAxiosError<{ message: string }>(error)) {
    return error.response?.data?.message ?? null;
  }
  return null;
}
```

### Account Switch Safety (`src/hooks/use-account-switch-guard.ts`)

```typescript
// Clear all queries and cancel in-flight mutations on account switch
export function useAccountSwitchGuard(queryClient: QueryClient) {
  const accountId = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.account.id : null));
  const prevAccountId = useRef(accountId);

  useEffect(() => {
    if (prevAccountId.current && accountId && prevAccountId.current !== accountId) {
      queryClient.removeQueries(); // removeQueries() not just invalidateQueries()
      queryClient.cancelMutations();
    }
    prevAccountId.current = accountId;
  }, [accountId, queryClient]);
}
```

---

## Technical Approach

### Architecture

Every CRUD feature follows this file structure (established by Tags):

```
src/features/{entity}/
  types.ts                    # Entity TypeScript interface
  {entity}-schema.ts          # Zod validation schema + max length constants
  use-{entity}.ts             # React Query hooks (list, detail, create, update, delete)
  {entity}-columns.tsx        # TanStack Table column definitions
  {entity}-page.tsx           # List page (ListPage + DataTable + ConfirmDialog)
  {entity}-form.tsx           # Form component (create + edit, single component)
  {entity}-form-page.tsx      # Form page orchestrator (loading, error, mode detection)
  __tests__/
    {entity}-schema.test.ts   # Zod validation edge cases
    use-{entity}.test.ts      # All 5 hooks: API calls, error handling, toasts
    {entity}-form.test.tsx    # Form: fields, validation, character counters, submit
    {entity}-columns.test.tsx # Columns: headers, rendering, permissions, callbacks
    {entity}-page.test.tsx    # List page: rendering, empty state, permissions, delete flow
    {entity}-form-page.test.tsx # Form page: create/edit modes, loading, error, prefill
```

### TDD Flow Per Feature

For each feature, follow this exact sequence:

1. **types.ts** — Define the entity interface (from Vue 2 DTO)
2. **RED: schema tests** → **GREEN: schema** — Write Zod validation tests first, then schema
3. **RED: hook tests** → **GREEN: hooks** — Write API hook tests first, then implement hooks
4. **RED: form tests** → **GREEN: form** — Write form component tests, then implement
5. **RED: columns tests** → **GREEN: columns** — Write column definition tests, then implement
6. **RED: page tests** → **GREEN: page** — Write list page tests, then implement
7. **RED: form-page tests** → **GREEN: form-page** — Write form page tests, then implement
8. **Wire routes** — Connect to existing placeholder routes
9. **Add i18n keys** — Add entity-specific translations to both locales

### Research Insights: TanStack & React Query Patterns

**Best Practices:**

- Use `placeholderData: keepPreviousData` on all paginated list hooks to avoid flash of empty state during page transitions
- Set per-entity `staleTime` (5 min for CRUD lists, 30 min for rarely-changing configs)
- Use `EMPTY_ARRAY` constant (`const EMPTY_ARRAY: never[] = []`) for all `data ?? EMPTY_ARRAY` patterns to avoid new reference on every render
- For edit forms, add a `key={entity.id}` prop to force React to remount the form when switching between entities — avoids stale form state bugs

**Performance Patterns:**

- Use `select` option in queries to memoize transformed data at the query level
- Configure `refetchOnWindowFocus: false` globally for stable data
- Add `maxPages` safety limit to any `fetchAllPages` / infinite scroll utilities
- On account switch, call `queryClient.removeQueries()` (NOT just `invalidateQueries()`) to prevent stale cross-account data

**Testing Patterns:**

- Use `gcTime: 0` in test QueryClient to prevent cache leaks between tests
- Prefer `findBy*` (async) over `waitFor + getBy*` for elements that appear after async operations
- Add `defaultPendingMinMs: 0` to TanStack Router test config to skip loading delays
- Consider `pool: 'threads'` + `isolate: false` in vitest config for faster test execution

### Implementation Phases

---

## Phase 1: Simple CRUD Entities (Tags Pattern)

These entities are structurally identical to Tags — simple list + create + edit + delete with minimal custom logic. Each takes the least effort since they directly follow the reference implementation.

### 1.1 Custom Fields

**Vue 2 source:** `views/audience/customfields/`
**React target:** `src/features/custom-fields/`
**Routes:** `/customfields`, `/customfields/create`, `/customfields/$customFieldId`
**Permission:** `audience:custom_fields_view`, `audience:custom_fields_create`

**Entity fields (from Vue 2 DTO):**

- `id`, `name`, `description`, `type` (text, number, date, boolean, list), `accountId`
- `createdAt`, `updatedAt`

**API endpoints:**

- `GET /custom-fields` — list with pagination
- `GET /custom-fields/:id` — detail
- `POST /custom-fields` — create
- `PUT /custom-fields/:id` — update
- `DELETE /custom-fields/:id` — delete

**Special considerations:**

- `type` field is a select/dropdown (not free text) — needs a `Select` component in the form
- Type options: text, number, date, boolean, list
- Type column in list should render as a Badge (like Tags type)

**Files to create:**

- `types.ts`, `custom-field-schema.ts`, `use-custom-fields.ts`
- `custom-fields-columns.tsx`, `custom-fields-page.tsx`
- `custom-field-form.tsx`, `custom-field-form-page.tsx`
- 6 test files mirroring Tags test structure

**Tests (TDD RED stage):**

- Schema: validate name required, max lengths, type enum validation
- Hooks: list with params, detail, create, update, delete + error toasts
- Form: fields render (including type select), validation, character counters, submit
- Columns: name link, type badge, edit/delete buttons, permission gating
- Page: list rendering, empty state, search, delete flow, permissions
- Form page: create mode, edit mode loading/error/prefill, type dropdown

---

### 1.2 Labels

**Vue 2 source:** `views/infrastructure/labels/`
**React target:** `src/features/labels/`
**Routes:** `/labels`, `/labels/create`, `/labels/$labelId`
**Permission:** `infra:view`, `infra:create`

**Entity fields:**

- `id`, `name`, `color`, `accountId`
- `createdAt`, `updatedAt`

**API endpoints:**

- `GET /labels` — list
- `GET /labels/:id` — detail
- `POST /labels` — create
- `PUT /labels/:id` — update
- `DELETE /labels/:id` — delete

**Special considerations:**

- `color` field — may need a color picker or predefined palette in the form
- Color column should render as a colored badge/dot

**Files to create:**

- `types.ts`, `label-schema.ts`, `use-labels.ts`
- `labels-columns.tsx`, `labels-page.tsx`
- `label-form.tsx`, `label-form-page.tsx`
- 6 test files

**Tests (TDD RED stage):**

- Schema: name required, color format validation
- Hooks: all CRUD operations
- Form: name + color fields, validation
- Columns: name, color badge, actions
- Page: list, empty, delete flow
- Form page: create/edit modes

---

### 1.3 Custom Events

**Vue 2 source:** `views/infrastructure/custom-events/`
**React target:** `src/features/custom-events/`
**Routes:** `/custom-events`, `/custom-events/create`, `/custom-events/$customEventId`
**Permission:** `infra:view`, `infra:create`

**Entity fields:**

- `id`, `name`, `description`, `key` (unique event identifier), `accountId`
- `createdAt`, `updatedAt`

**API endpoints:**

- `GET /custom-events` — list
- `GET /custom-events/:id` — detail
- `POST /custom-events` — create
- `PUT /custom-events/:id` — update
- `DELETE /custom-events/:id` — delete

**Special considerations:**

- `key` field is auto-generated or manually set (slug-like)
- Vue 2 has an event logs sub-page (`/custom-events/:id/logs`) — defer to Phase 4
- Columns should show: name, key, description

**Files to create:**

- `types.ts`, `custom-event-schema.ts`, `use-custom-events.ts`
- `custom-events-columns.tsx`, `custom-events-page.tsx`
- `custom-event-form.tsx`, `custom-event-form-page.tsx`
- 6 test files

**Tests (TDD RED stage):**

- Schema: name + key required, key format (alphanumeric/dashes)
- Hooks: all CRUD operations
- Form: name, key, description fields
- Columns: name link, key, description
- Page: list, empty, delete flow
- Form page: create/edit modes

---

### 1.4 Pools

**Vue 2 source:** `views/infrastructure/pools/`
**React target:** `src/features/pools/`
**Routes:** `/pools`, `/pools/create`, `/pools/$poolId`
**Permission:** `infra:view`, `infra:create`

**Entity fields:**

- `id`, `name`, `sendingDomain`, `provider`, `status`, `accountId`
- Various email configuration fields
- `createdAt`, `updatedAt`

**API endpoints:**

- `GET /pools` — list
- `GET /pools/:id` — detail
- `POST /pools` — create
- `PUT /pools/:id` — update
- `DELETE /pools/:id` — delete

**Special considerations:**

- More form fields than Tags (domain, provider, etc.)
- Provider is a select (SendGrid, SparkPost, etc.)
- Status column should render as a colored badge (active/inactive)
- Pool form is more complex — may need multiple sections/cards

**Files to create:**

- `types.ts`, `pool-schema.ts`, `use-pools.ts`
- `pools-columns.tsx`, `pools-page.tsx`
- `pool-form.tsx`, `pool-form-page.tsx`
- 6 test files

**Tests (TDD RED stage):**

- Schema: name, domain, provider required, domain format validation
- Hooks: all CRUD operations
- Form: all fields including selects, validation
- Columns: name, domain, provider, status badge, actions
- Page: list, empty, delete, permissions
- Form page: create/edit modes

---

### Phase 1 Research Insights

**Architecture Notes:**

- Warmups should be moved to Phase 1 — its CRUD is simpler than originally assessed (no condition builder, no multi-step wizard). The "progress stats" detail view is a read-only dashboard on top of standard CRUD, implementable after the base form.
- Each Phase 1 entity should use the shared `createEntityQueryKeys()` factory from the infrastructure step.
- All entities should have `accountId` in their query key for multi-tenancy cache isolation.

**Race Condition: Delete Last Item on Page**
When deleting the last item on a paginated page (e.g., page 3 has 1 item, user deletes it), the `onSuccess` callback should clamp `pageIndex` to `Math.max(0, pageIndex - 1)` before refetching. Implement this pattern in the first Phase 1 entity and reuse.

---

## Phase 2: Medium CRUD Entities (Extended Patterns)

These entities follow the CRUD pattern but have additional complexity: richer forms, more columns, extra features like copy/import/export.

### 2.1 Segments

**Vue 2 source:** `views/audience/segments/`
**React target:** `src/features/segments/`
**Routes:** `/segments`, `/segments/create`, `/segments/$segmentId`
**Permission:** `audience:segments_view`, `audience:segments_create`

**Entity fields:**

- `id`, `name`, `description`, `conditions` (complex JSON), `contactCount`
- `lastRunAt`, `recurrence`, `status`, `accountId`
- `createdAt`, `updatedAt`

**API endpoints:**

- `GET /tags/segment` — list (segments share the tags endpoint with type=segment)
- `GET /tags/segment/:id` — detail
- `POST /tags/segment` — create
- `PUT /tags/segment/:id` — update
- `DELETE /tags/segment/:id` — delete
- `POST /tags/segment/:id/copy` — duplicate segment

**Special considerations:**

- Segment form has a **condition builder** (nested AND/OR groups with field/operator/value)
- This is the most complex form component — needs its own sub-components
- List shows contact count and last run time
- Copy feature (duplicate existing segment)
- Recurrence scheduling (optional)

**Recommended approach:**

1. First implement basic CRUD (list, simple create/edit without condition builder)
2. Then add the condition builder as a separate component
3. Then add copy and recurrence features

**Spec Gap (from analysis):** The condition builder needs a complete field/operator catalog:

- What fields are available? (contact fields, custom fields, tags, events)
- What operators per field type? (string: contains/equals/starts_with, number: gt/lt/eq, date: before/after/between)
- What value input per operator? (text, number, date picker, multi-select for "in")
- Review Vue 2 `SegmentCondition.vue` component for the exact catalog before implementation

**Files to create:**

- `types.ts`, `segment-schema.ts`, `use-segments.ts`
- `segments-columns.tsx`, `segments-page.tsx`
- `segment-form.tsx`, `segment-form-page.tsx`
- `components/condition-builder.tsx` — reusable condition builder
- `components/condition-row.tsx` — single condition row
- 6+ test files

---

### 2.2 Contacts

**Vue 2 source:** `views/audience/contacts/`
**React target:** `src/features/contacts/`
**Routes:** `/contacts`, `/contacts/import`, `/contacts/$contactId`, `/contacts/suppressions/$type`
**Permission:** `audience:contacts_view`, `audience:contacts_create`, `audience:contacts_import`

**Entity fields:**

- `id`, `email`, `name`, `phone`, `status`, `tags[]`, `customFields{}`
- `createdAt`, `updatedAt`, `lastActivityAt`

**API endpoints:**

- `GET /contacts` — list with filters
- `GET /contacts/:id` — detail with tags and custom fields
- `POST /contacts` — create
- `PUT /contacts/:id` — update
- `DELETE /contacts/:id` — delete (soft)
- `POST /contacts/import` — bulk CSV import
- `GET /contacts/suppressed` — suppression list
- `POST /contacts/export-init` + `GET /contacts/export-stream` — export workflow
- `POST /contacts/tags` — manage contact tags
- `PUT /contacts/custom-fields/edit` — update custom fields

**Special considerations:**

- Contact detail page is NOT a simple form — it's a detail view with tabs (info, tags, custom fields, history)
- Import is a multi-step wizard (upload CSV → map fields → confirm → process)
- Suppression page has sub-types: bounced, unsubscribed, invalid, blocked
- Export feature (async with streaming)
- List has more filters than Tags (status, tags, segments)

**Recommended approach:**

1. Contact list page (with basic filters)
2. Contact detail page (read-only info + inline edit)
3. Suppression list page
4. Import wizard (separate sub-feature)
5. Export feature

**Files to create:**

- `types.ts`, `contact-schema.ts`, `use-contacts.ts`
- `contacts-columns.tsx`, `contacts-page.tsx`
- `contact-detail-page.tsx` — detail view (not a form)
- `contacts-import/` — import wizard sub-feature
- `contacts-suppression-page.tsx`
- 8+ test files

---

### 2.3 Templates

**Vue 2 source:** `views/messages/templates/`
**React target:** `src/features/templates/`
**Routes:** `/templates`, `/templates/create`, `/templates/$templateId`
**Permission:** `messages:view`, `messages:create`

**Entity fields:**

- `id`, `name`, `subject`, `htmlContent`, `textContent`, `category`
- `accountId`, `createdAt`, `updatedAt`

**API endpoints:**

- `GET /messages?type=template` — list
- `GET /messages/:id` — detail
- `POST /messages` — create
- `PUT /messages/:id` — update
- `DELETE /messages/:id` — delete

**Special considerations:**

- Template editor needs an HTML editor component (rich text or code editor)
- Preview functionality
- Template categories

**Recommended approach:**

1. Basic CRUD list and form (name, subject, category)
2. Add HTML editor component
3. Add preview

**Decision needed:** Email editor library choice impacts both Templates and Messages (Phase 3.3). Options:

- **TipTap** — Open source, React-native, highly extensible, good for rich text
- **Unlayer** — Commercial, drag-and-drop email builder, better for non-technical users
- **Monaco Editor** — Code editor (HTML source editing), lightweight but no visual preview
- Decide before starting Templates to avoid rework

---

### 2.4 Warmups

**Vue 2 source:** `views/infrastructure/warmups/`
**React target:** `src/features/warmups/`
**Routes:** `/warmups`, `/warmups/create`, `/warmups/$warmupId`
**Permission:** `infra:view`, `infra:create`

**Entity fields:**

- `id`, `name`, `poolId`, `status`, `schedule`, `progress`
- `startDate`, `endDate`, `dailyVolume`, `accountId`

**API endpoints:**

- `GET /warmups` — list
- `GET /warmups/:id` — detail with stats
- `POST /warmups` — create
- `PUT /warmups/:id` — update

**Special considerations:**

- Warmup detail page shows progress stats (not a simple edit form)
- Pool selector in the form
- Schedule visualization
- No delete (warmups are stopped, not deleted)

---

### Phase 2 Research Insights

**Contact Import Wizard — Build Incrementally:**

1. File upload (CSV/XLSX) → field mapping UI → preview → confirm → async process
2. Use a `useStepper` hook (custom or from a library) for wizard state
3. Field mapping should be a two-column layout: CSV headers ↔ contact fields
4. Consider `papaparse` for client-side CSV parsing and preview

**Race Condition: Token Refresh on Long Form Edits (CRITICAL)**
Users editing complex segment conditions or contact details may have sessions lasting 30+ minutes. If the Auth0 token expires mid-edit and the form submit fails with 401, the user loses their work. Mitigation:

- Implement a silent token refresh interceptor in the axios instance
- On 401, refresh token, replay the failed request automatically
- Add a `useTokenRefresh` hook that proactively refreshes before expiry

---

## Phase 3: Campaign & Message Modules

These are the most complex features with specialized UIs.

### 3.1 Campaigns (Regular)

**Vue 2 source:** `views/campaigns/`
**React target:** `src/features/campaigns/`
**Routes:** `/campaigns`, `/campaigns/create`, `/campaigns/$campaignId`
**Permission:** `campaigns:view`, `campaigns:create`, `campaigns:update`

**Special considerations:**

- Campaign editor is a multi-step form (audience, message, schedule, review)
- Template selection integration
- Send configuration (immediate, scheduled, A/B test)
- Campaign statistics after sending
- This is one of the most complex pages

**Recommended approach:**

1. Campaign list page (CRUD pattern)
2. Campaign create/edit wizard (multi-step)
3. Campaign statistics view
4. Template selection modal

---

### 3.2 Trigger Campaigns

**Vue 2 source:** `views/trigger-campaign/`
**React target:** `src/features/trigger-campaigns/`
**Routes:** `/trigger-campaign`, `/trigger-campaign/create`, `/trigger-campaign/$campaignId`
**Permission:** `campaigns:view`, `campaigns:create`

**Similar to regular campaigns but:**

- Event-trigger configuration instead of schedule
- Simpler form (no scheduling step)
- Different statistics view

---

### 3.3 Messages (Multi-Channel)

**Vue 2 source:** `views/messages/`
**React target:** `src/features/messages/`
**Routes:** `/messages/:type` (email, sms, web-push, mobile-push, whatsapp)
**Permission:** `messages:view`, `messages:create`

**Special considerations:**

- Each channel has a different editor component
- Email: Full HTML editor (WriteEmail.vue is 67KB in Vue 2 — very complex)
- SMS: Simple text with character counter + variable insertion
- Web Push: Title, body, icon, action URL
- Mobile Push: Similar to web push + image
- WhatsApp: Template-based with Evolution API or Twilio variants
- Postmaster page (email deliverability config)
- Deliverability testing (Glock apps integration)

**Recommended approach:**

1. Message list pages (shared across channels, just different type filter)
2. SMS editor (simplest channel)
3. Web Push editor
4. Mobile Push editor
5. WhatsApp editor
6. Email editor (most complex — last)
7. Postmaster and deliverability testing

---

### 3.4 2FA Messages

**Vue 2 source:** `views/messages/twoFA/`
**React target:** `src/features/messages-2fa/`
**Routes:** `/messages/2fa/:type`

Subset of messages but with group configuration and channel-specific settings.

---

### Phase 3 Research Insights

**Campaign Wizard State Persistence:**
The multi-step campaign form (audience → message → schedule → review) needs a state persistence decision:

- **Option A**: Keep wizard state in React state (lose on navigation/refresh)
- **Option B**: Auto-save draft to API on each step completion
- **Option C**: Use `sessionStorage` for client-side persistence
- **Recommendation**: Option B (auto-save drafts) — matches Vue 2 behavior and prevents data loss

**Build Reusable Components BEFORE Phase 3:**

- **Stepper component** — Reused by Campaigns, Import Wizard, possibly Automations
- **Template selector modal** — Reused by Campaigns, Trigger Campaigns, Automations
- Build these as shared components in `src/components/` before starting Phase 3

**Multi-Channel Message Editors:**

- Each channel editor should be a separate component but share a common interface (`MessageEditorProps`)
- SMS: Simple `textarea` with character counter (160/306 chars) + variable insertion toolbar
- Web Push: Title (50 chars) + body (120 chars) + icon upload + action URL
- WhatsApp: Template selector + variable mapping (API-dependent on Evolution vs Twilio)
- Email: Full editor — see decision in Phase 2.3

---

## Phase 4: Automation & Analytics

Split Phase 4 into two sub-phases for better risk management.

### Phase 4a: Simple CRUD (Campaign Rules, Products)

These follow standard CRUD patterns and can proceed immediately.

### Phase 4b: Complex Features (Automations, Analytics, Settings)

These require dedicated design effort and should not block Phase 4a.

---

### 4.1 Email Automations

**Vue 2 source:** `views/automations/`
**React target:** `src/features/automations/`
**Routes:** `/automations/emails`, `/automations/emails/create`, `/automations/emails/$automationId`
**Permission:** `automations:view`, `automations:create`

**Special considerations:**

- **Automation workflow builder** — the most complex UI in the app
- Conditional steps with drag-and-drop
- Multiple step types: send message, wait, condition, tag, custom field, HTTP request, sub-automation
- Automation statistics
- Audit logs
- Active Campaign integration
- This will require a dedicated design effort

**Recommended approach:**

1. Automation list page (CRUD pattern)
2. Basic automation create/edit (name, trigger type)
3. Step builder component (iterative development)
4. Individual step type components
5. Automation statistics view

**Spec Gap (from analysis):** The automation builder needs an interaction specification:

- **Library decision**: React Flow (visual DAG editor), custom canvas, or simplified vertical list?
- **Step serialization format**: How are steps stored in the API? (JSON tree, flat array with parent refs?)
- **Undo/redo**: Does the workflow builder need undo support?
- **Validation**: Can an automation be saved in an incomplete state (draft)?
- Review Vue 2 `AutomationBuilder.vue` for the exact step types and their configs before implementation
- **Recommendation**: Start with a simplified vertical list of steps (no drag-and-drop DAG). Upgrade to React Flow later if needed. This reduces risk dramatically while preserving functionality.

---

### 4.2 Campaign Rules

**Vue 2 source:** `views/campaigns-rules/`
**React target:** `src/features/campaign-rules/`
**Routes:** `/campaign-rules`, `/campaign-rules/create`, `/campaign-rules/$ruleId`
**Permission:** `infra:view`, `infra:create`

Has two sub-modules: rules and configurations. Both follow CRUD pattern but with more complex forms.

---

### 4.3 Products

**Vue 2 source:** `views/products/`
**React target:** `src/features/products/`
**Routes:** `/product`
**Permission:** Based on campaigns permissions

Product catalog for campaign targeting.

---

### 4.4 Analytics Pages

**Vue 2 source:** `views/dashboard/`, `views/insights/`, `views/leads/`
**React target:** `src/features/analytics/`
**Routes:** `/messages/:type/statistics`, `/messages/:type/comparison`, `/leads`, `/insights`
**Permission:** `analytics:dashboard_view`, `analytics:comparison_view`, `analytics:insights_view`

**Special considerations:**

- Chart components (Recharts already in the project)
- Date range selectors
- Data aggregation from ClickHouse
- Comparison views (period A vs period B)
- These pages are read-only (no CRUD)

**Recommended approach:**

1. Statistics dashboard (email channel first)
2. Comparison view
3. Leads analytics
4. Insights page

---

### 4.5 Settings & Profile

**Vue 2 source:** `views/settings/`, `views/profile/`
**React target:** `src/features/settings/`, `src/features/profile/`
**Routes:** `/settings`, `/profile`

**Profile** is already partially implemented in React.

**Settings** includes:

- Account configuration
- Channel settings
- API key management
- User management and role assignment

---

## Implementation Priority & Order (Rebalanced)

| Priority | Phase | Module                      | Complexity  | Estimated Tests | Notes                                         |
| -------- | ----- | --------------------------- | ----------- | --------------- | --------------------------------------------- |
| 0        | —     | Shared Infrastructure       | Low         | ~10             | Test utils, query key factory, zod primitives |
| 1        | 1.1   | Custom Fields               | Low         | ~36             |                                               |
| 2        | 1.2   | Labels                      | Low         | ~36             |                                               |
| 3        | 1.3   | Custom Events               | Low         | ~36             |                                               |
| 4        | 1.4   | Pools                       | Low-Medium  | ~40             |                                               |
| 5        | 1.5   | Warmups                     | Low-Medium  | ~36             | Moved from Phase 2 — simpler than assessed    |
| 6        | 2.1   | Segments                    | Medium-High | ~50             | Condition builder is the key complexity       |
| 7        | 2.2   | Contacts                    | High        | ~60             | Import wizard + detail page                   |
| 8        | 2.3   | Templates                   | Medium      | ~40             | Blocked by email editor decision              |
| —        | —     | Stepper + Template Selector | Medium      | ~15             | Build before Phase 3                          |
| 9        | 3.1   | Campaigns                   | High        | ~60             | Multi-step wizard                             |
| 10       | 3.2   | Trigger Campaigns           | Medium-High | ~45             |                                               |
| 11       | 3.3   | Messages                    | Very High   | ~80+            | Multi-channel editors                         |
| 12       | 3.4   | 2FA Messages                | Medium      | ~40             |                                               |
| 13       | 4a.1  | Campaign Rules              | Medium      | ~45             | Simple CRUD — don't block on 4b               |
| 14       | 4a.2  | Products                    | Low-Medium  | ~30             | Simple CRUD                                   |
| 15       | 4b.1  | Automations                 | Very High   | ~80+            | Workflow builder — needs design spike         |
| 16       | 4b.2  | Analytics                   | Medium      | ~50             | Read-only dashboards                          |
| 17       | 4b.3  | Settings                    | Medium      | ~45             |                                               |

## TDD Test Strategy Per Feature

### Standard CRUD Test Suite (6 files, ~36 tests)

Every simple CRUD entity gets these test files:

**1. `{entity}-schema.test.ts` (~7 tests)**

- Valid data acceptance
- Required field validation
- Max length validation (at boundary, over boundary)
- Default values
- Type-specific validation (enum, format, etc.)

**2. `use-{entity}.test.ts` (~15 tests)**

- `use{Entity}List` — correct API params, search handling, data returned
- `use{Entity}` — detail fetch, disabled when id=0
- `useCreate{Entity}` — POST call, success toast, error toast with API message
- `useUpdate{Entity}` — PUT call, success toast, error toast
- `useDelete{Entity}` — DELETE call, success toast, conflict error toast

**3. `{entity}-form.test.tsx` (~8 tests)**

- All fields render with correct labels
- Create vs edit button text
- Pre-fill with default values
- Character counters update
- Submit with valid data
- Validation error on empty required fields
- Disabled state when isPending

**4. `{entity}-columns.test.tsx` (~10 tests)**

- Translated headers
- Name renders as link
- Type/status renders as badge
- Formatting (numbers, dates, etc.)
- Edit button for each row
- Delete button visibility (permission gating)
- Delete callback fires correctly

**5. `{entity}-page.test.tsx` (~14 tests)**

- Page title renders
- Table data renders
- Search input present
- Pagination info correct
- Empty state (no data)
- Empty state with search (clear search link)
- Create button with permission
- Create button hidden without permission
- Super admin bypass
- Delete flow: dialog opens
- Delete flow: tag name in dialog
- Delete flow: mutation called
- Delete flow: dialog closes on cancel
- Loading state

**6. `{entity}-form-page.test.tsx` (~12 tests)**

- Create mode: title, empty form, create button, calls create mutation
- Edit mode: loading skeleton, error state, title, prefilled form, save button, calls update mutation
- Handles null/missing optional fields
- Back navigation link

### Extended Tests (for complex features)

Features with extra complexity get additional test files:

- `condition-builder.test.tsx` — for Segments
- `import-wizard.test.tsx` — for Contacts
- `contact-detail.test.tsx` — for Contact detail view
- `step-builder.test.tsx` — for Automations
- Channel-specific editor tests — for Messages

### Testing Anti-Patterns to Avoid

Based on research and the Tags reference implementation:

1. **Don't test mock behavior** — Mock the boundary (API calls, router), test the component's behavior. If you're asserting that a mock was called with specific args, make sure you're also asserting the UI effect.
2. **Don't create new `QueryClient` inside test files** — Use the shared `createQueryWrapper()` from test-utils.
3. **Don't copy `authenticateWithPermissions()` per test file** — Use the shared `authenticateStore()` from test-utils.
4. **Don't forget `gcTime: 0`** — Without this, React Query caches data between tests causing false positives.
5. **Use `findBy*` for async assertions** — `await screen.findByText(...)` instead of `await waitFor(() => expect(screen.getByText(...)).toBeInTheDocument())`.
6. **Always test the loading → loaded transition** — Don't just test the final state. Test that loading indicators appear and then resolve.

### Vitest Configuration Optimization

```typescript
// vitest.config.ts — consider for faster test runs across 17 modules
export default defineConfig({
  test: {
    pool: 'threads', // Faster than 'forks' for jsdom tests
    isolate: false, // Shared worker context (faster, but needs gcTime: 0)
    setupFiles: ['./src/test-utils/setup.ts'],
  },
});
```

## Acceptance Criteria

### Per Phase

- [ ] All CRUD operations work (list, create, edit, delete)
- [ ] All tests pass (RED → GREEN for each file)
- [ ] i18n keys added for both pt-BR and en-US
- [ ] Permission checks applied to create/edit/delete actions
- [ ] Routes wired to existing placeholders
- [ ] Empty states render correctly
- [ ] Loading and error states handled
- [ ] Form validation with proper error messages
- [ ] Character counters on text fields
- [ ] Unsaved changes dialog on forms
- [ ] Delete confirmation dialog

### Overall

- [ ] All 26 placeholder routes replaced with real implementations
- [ ] Feature parity with Vue 2 app for covered modules
- [ ] Consistent UX across all CRUD pages
- [ ] Full test coverage following Tags reference pattern
- [ ] No regressions in existing features (Tags, Profile, Auth)

## Dependencies & Prerequisites

- Tags reference implementation (completed)
- Shared components: ListPage, FormPage, DataTable (completed)
- Auth0 + account switching (completed)
- TanStack Router with file-based routing (completed)
- i18n infrastructure (completed)

## Risk Analysis & Mitigation

| Risk                                     | Impact | Mitigation                                                                                   |
| ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Automation builder complexity            | High   | Defer to Phase 4b, design separately. Start with vertical list, not DAG editor               |
| Email editor (67KB Vue component)        | High   | Decide library before Phase 2.3. TipTap recommended for flexibility                          |
| Vue 2 API inconsistencies                | Medium | Check each endpoint in Vue 2 service files before implementing                               |
| Segment condition builder                | Medium | Build as standalone component, test independently. Catalog fields/operators from Vue 2 first |
| Contact import wizard                    | Medium | Multi-step form, build incrementally. Use `papaparse` for CSV                                |
| Missing API documentation                | Low    | Vue 2 DTOs + service files serve as documentation                                            |
| Token expiry during long form edits      | High   | Implement silent token refresh interceptor in axios (see Shared Infrastructure)              |
| Account switch during in-flight mutation | High   | Guard with `useAccountSwitchGuard` — cancel mutations, removeQueries                         |
| Delete last item on page                 | Medium | Clamp `pageIndex` to `max(0, pageIndex - 1)` in delete `onSuccess`                           |
| Rapid account switching                  | Medium | Debounce account switch or cancel all queries before new ones fire                           |
| Permission catalog mismatch              | Medium | Audit Vue 2 permissions vs React `types/index.ts` — add missing permissions before Phase 2   |
| i18n namespace bloat                     | Low    | Consider splitting i18n into per-feature namespaces as modules grow                          |

## TypeScript Patterns

**Entity Interface Design:**

- Make fields that the API always returns **required** (not optional). Use optional only for fields that are truly nullable.
- Use `Pick<Entity, 'name' | 'description'>` for create/update DTOs rather than `Partial<Entity>` — be explicit about which fields each mutation accepts.
- Do NOT create a generic `createCrudHooks<T>()` factory — the abstraction leaks quickly when entities have different query param shapes, different mutation signatures, or custom logic. Keep hooks per-feature.

**Error Handling:**

```typescript
// src/lib/api-error.ts
import { isAxiosError } from 'axios';

interface ApiErrorResponse {
  message: string;
  statusCode: number;
}

export function extractApiErrorMessage(error: unknown): string | null {
  if (isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message ?? null;
  }
  return null;
}
```

**Form Key Pattern for Edit Mode:**

```tsx
// Force form remount when entity data changes (prevents stale state)
{
  entityData && <EntityForm key={entityData.id} defaultValues={entityData} />;
}
```

---

## Sources & References

### Origin

- **CRUD List components:** [docs/plans/2026-03-12-feat-reusable-crud-list-page-components-plan.md](docs/plans/2026-03-12-feat-reusable-crud-list-page-components-plan.md)
- **CRUD Form components:** [docs/plans/2026-03-12-feat-reusable-crud-form-page-components-plan.md](docs/plans/2026-03-12-feat-reusable-crud-form-page-components-plan.md)
- **Auth & Layout:** [docs/plans/2026-03-10-feat-react-frontend-auth-layout-plan.md](docs/plans/2026-03-10-feat-react-frontend-auth-layout-plan.md)

### Internal References

- Tags reference implementation: `src/features/tags/` (complete with 65 tests)
- Vue 2 router: `apps/frontend-vue2/src/routes/index.ts`
- Vue 2 views: `apps/frontend-vue2/src/views/`
- Vue 2 DTOs: `apps/frontend-vue2/src/dto/`
- Vue 2 services: `apps/frontend-vue2/src/services/`
- Vue 2 store: `apps/frontend-vue2/src/store/`
- React shared components: `apps/frontend-react/src/components/`
- React hooks: `apps/frontend-react/src/hooks/`
- Permissions: `apps/frontend-react/src/types/index.ts` (38 permissions)
