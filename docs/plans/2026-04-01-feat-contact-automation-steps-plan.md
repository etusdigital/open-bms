---
title: 'feat: Add Contact Automation Steps (Tag, Custom Field, Validate, Transfer, Remove)'
type: feat
status: active
date: 2026-04-01
---

# Add Contact Automation Steps

## Overview

Add 6 contact-related automation step types: **addTag**, **removeTag**, **updateCustomField**, **contactValidate**, **contactTransfer**, and **removeAutomation**. These match the Vue 2 implementation exactly in data shape while using the React editor's existing patterns (generic node factory, config panels, sidebar blocks).

## Step Types Summary

| Step                | Settings Shape                                                   | Config UI                               | Internal Only |
| ------------------- | ---------------------------------------------------------------- | --------------------------------------- | :-----------: |
| `addTag`            | `Array<{ id, name }>`                                            | Multi-select searchable tags            |      No       |
| `removeTag`         | `Array<{ id, name }>`                                            | Multi-select searchable tags            |      No       |
| `updateCustomField` | `{ customFieldValue, customFieldSelected: { id, title, type } }` | Field picker + value input (type-aware) |      No       |
| `contactValidate`   | `{}` (empty)                                                     | No config needed — just click to add    |      No       |
| `contactTransfer`   | `{ accountId, accountName, tagId, tagName, apiKey }`             | Account picker → tag picker (cascading) |    **Yes**    |
| `removeAutomation`  | `{ automations: [{ id, name, title }] }`                         | Multi-select searchable automations     |    **Yes**    |

## Implementation Tasks

### Task 1: Update types

**File:** `editor/types.ts`

Add to `AutomationStepType`:

```typescript
| 'addTag' | 'removeTag' | 'updateCustomField' | 'contactValidate' | 'contactTransfer' | 'removeAutomation'
```

Add settings interfaces:

```typescript
export interface TagStepSettings {
  // Can be array (new) or single object (legacy) — normalize to array on load
  [index: number]: { id: number; name: string }; // when it's an array
}
// Actually store as: Array<{ id: number; name: string }>

export interface UpdateCustomFieldSettings {
  customFieldValue: string;
  customFieldSelected: { id: number; title: string; type: string };
}

export interface ContactTransferSettings {
  accountId: number;
  accountName: string;
  tagId: number;
  tagName: string;
  apiKey: string;
}

export interface RemoveAutomationSettings {
  automations: Array<{ id: number; name: string; title: string }>;
}
```

Add discriminated step types, node data types, and update `KNOWN_STEP_TYPES`.

### Task 2: Create node components

Use the existing `createMessageNode` factory pattern — but these aren't message nodes, they're action nodes. Create a simpler approach:

**6 new node components** in `editor/nodes/`:

- `add-tag-node.tsx` — Green tag icon, shows selected tag names (or "Select tag(s)")
- `remove-tag-node.tsx` — Orange tag icon, shows selected tag names
- `update-custom-field-node.tsx` — Blue icon, shows "Set {fieldName} = {value}"
- `contact-validate-node.tsx` — Teal icon, just shows "Validate email" (no settings)
- `contact-transfer-node.tsx` — Indigo icon, shows "Transfer to {accountName}" (internal only)
- `remove-automation-node.tsx` — Red icon, shows automation names (internal only)

All use `NodeDeleteButton` and `memo()`.

### Task 3: Create config panels

Add to `step-config-panel.tsx`:

- **TagConfig** (shared by addTag and removeTag) — Searchable multi-select for tags via `GET /tags?type=tag&title={search}`. Uses debounced search. Shows selected tags as removable chips.

- **UpdateCustomFieldConfig** — Two-part: (1) searchable select for custom fields via `GET /custom-fields`, (2) value input that changes based on field type (text/number/date).

- **contactValidate** — No config needed. When added, it works immediately.

- **ContactTransferConfig** — (internal only) Cascading selects: first pick account from `GET /accounts`, then pick tag from `GET /tags` with that account's ID header.

- **RemoveAutomationConfig** — (internal only) Searchable multi-select for automations via `GET /automations?type=email`.

### Task 4: Update sidebar

Add a "Contacts" category between "Actions" and "Timing":

```
Contacts
  ⊞ Add Tag
  ⊞ Remove Tag
  ⊞ Update Custom Field
  ⊞ Validate Email
  ⊞ Transfer Contact      (internal only — hidden, not just disabled)
  ⊞ Remove from Automation (internal only — hidden, not just disabled)
```

Internal-only steps are hidden entirely (not disabled) when `!isInternal`, matching Vue 2 behavior.

### Task 5: Update editor defaults + register nodeTypes

- Add default settings for each new step type in `DEFAULT_SETTINGS`
- Register all new node components in `automationNodeTypes`

### Task 6: Add i18n keys + type-check + test

New translation keys for all 6 step types in both `pt-BR.json` and `en-US.json`.

## API Endpoints Used

| Endpoint                             | Used by           | Params                                              |
| ------------------------------------ | ----------------- | --------------------------------------------------- |
| `GET /tags`                          | addTag, removeTag | `?type=tag&title={search}&page=1&itemsPerPage=40`   |
| `GET /custom-fields`                 | updateCustomField | `?page=1`                                           |
| `GET /accounts`                      | contactTransfer   | —                                                   |
| `GET /tags` (with Account-Id header) | contactTransfer   | `?status=active&type=tag`                           |
| `GET /automations`                   | removeAutomation  | `?type=email&title={search}&page=1&itemsPerPage=10` |

## Acceptance Criteria

- [ ] All 6 contact steps can be dragged from sidebar and configured
- [ ] addTag/removeTag: multi-select tags with search, shows tags as chips
- [ ] updateCustomField: field picker + type-aware value input
- [ ] contactValidate: no config, just add and it works
- [ ] contactTransfer: internal-only, cascading account→tag pickers
- [ ] removeAutomation: internal-only, multi-select automations
- [ ] Internal-only steps hidden for non-internal accounts
- [ ] Settings shapes match API schema exactly
- [ ] TypeScript type-check passes
- [ ] Existing tests pass
- [ ] i18n in pt-BR and en-US

## Sources

- Vue2 UpdateStepModal: `apps/frontend-vue2/src/modules/automations/components/UpdateStepModal.vue`
- Vue2 CustomFieldComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/CustomFieldComponent.vue`
- Vue2 ContactTransferComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/ContactTransferComponent.vue`
- Vue2 RemoveAutomationComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/RemoveAutomationComponent.vue`
- API schema: `apps/msgops-api/src/modules/automations/schema/automation-schema.json`
