---
title: "feat: Add HTTP Request Integration Step"
type: feat
status: active
date: 2026-04-01
---

# Add HTTP Request Integration Step

## Overview

Add the `httpRequest` step type for making HTTP webhook calls from automations. This is the first "Integration" category step in the sidebar.

## Settings Shape

```typescript
interface HttpRequestSettings {
  operation: 'get' | 'post' | 'put' | 'delete'
  url: string
  headers: HttpKeyValueItem[]
  body: HttpKeyValueItem[]        // only for POST/PUT
  queryString?: string
  newTry: boolean                  // retry flag (UI commented out in Vue2)
  quantityTry: number              // retry count (UI commented out in Vue2)
}

interface HttpKeyValueItem {
  key: string
  value: {
    id: string            // the actual value or field path
    description: string   // display label
    type: 'custom' | 'replace'  // custom = literal, replace = dynamic variable
  }
}
```

## Implementation Tasks

### Task 1: Add types

Add `httpRequest` to `AutomationStepType`, `HttpRequestSettings`, `HttpKeyValueItem` interfaces, step variant, node data, `KNOWN_STEP_TYPES`.

### Task 2: Create node component

**`http-request-node.tsx`** — Globe icon, shows:
- "HTTP Request" label
- URL truncated to 40 chars
- HTTP method badge (GET/POST/PUT/DELETE)

### Task 3: Create config panel

**Form layout:**
1. **Method select** — GET, POST, PUT, DELETE
2. **URL input** — free text
3. **Headers section** — repeating key-value rows with add/remove buttons
   - Key: text input
   - Value: variable picker (HttpValuePicker) with 4 categories:
     - Custom: freeform text input (type='custom')
     - Contact info: 22 fields (contact.email, contact.firstName, etc.) (type='replace')
     - Automation fields: 5 fields (automation.id, automation.name, etc.) (type='replace')
     - Custom fields: searchable list from API (contact.customFields[{id}]) (type='replace')
4. **Body section** (only for POST/PUT) — same repeating key-value rows with same picker
5. **Test button** — sends POST to `/automations/http-request-test`, shows response status + data in a collapsible output area

### Task 4: Update sidebar + defaults

Add "Integrations" category to the sidebar with HTTP Request block. Add default settings.

### Task 5: i18n + type-check

Add translation keys for all UI elements.

## Acceptance Criteria

- [ ] httpRequest step can be dragged from sidebar
- [ ] Config: method select, URL input, headers key-value pairs, body key-value pairs (POST/PUT only)
- [ ] Headers/body: add row, remove row, edit key and value
- [ ] Test button sends request to API and shows response
- [ ] Node card shows method + truncated URL
- [ ] Settings shape matches API schema
- [ ] TypeScript type-check passes
- [ ] i18n in pt-BR and en-US

## Sources

- Vue2 HttpRequestComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/HttpRequestComponent.vue`
- Vue2 SelectHttpComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/SelectHttpComponent.vue`
- API schema: `apps/msgops-api/src/modules/automations/schema/automation-schema.json`
- Test endpoint: `POST /automations/http-request-test`
