---
title: 'feat: Implement Full Trigger Configuration'
type: feat
status: active
date: 2026-04-02
---

# Implement Full Trigger Configuration

## Overview

Replace the current basic trigger config panel (just trigger type + tag name input) with the full Vue 2 trigger configuration. This includes all 5 trigger types with their sub-fields, entry frequency options, and an entry condition filter using the same condition builder.

## Current State

The existing `TriggerConfig` in `step-config-panel.tsx` has:

- Trigger type select (tag, events, custom_events, web-push, mobile-push)
- Tag name text input (only for tag type)

**Missing**: tag API search, event type sub-select, message picker for events, custom event API search, entry frequency (applyFrequency) radio group with period config, and entry condition filter (conditional builder).

## Form Layout (matching Vue 2)

### Section 1: Trigger Type

**Select dropdown** with 5 options:

- Tag added (`tag`)
- Email events (`events`)
- Custom event (`custom_events`)
- Web push (`web-push`)
- Mobile push (`mobile-push`)

### Section 2: Type-specific sub-fields

**Tag** (`type === 'tag'`):

- Searchable tag select from `GET /tags?type=tag&title={search}&page=1&itemsPerPage=40`
- Stores: `{ id, name, type: 'tag' }`

**Events** (`type === 'events'`):

- Event type select: Open, Click, First open in 30 days
- Message picker (hidden when `first_open_30_days`): searchable from `GET /messages?type=email&title={search}` with "Any message" option (id=0)
- Stores: `{ id, name, title, type: 'events', eventType: 'open'|'click'|'first_open_30_days' }`

**Custom events** (`type === 'custom_events'`):

- Searchable custom event select from `GET /custom-events?title={search}&page=1&itemsPerPage=20`
- Stores: `{ id, name, type: 'custom_events' }`

**Web push / Mobile push**:

- No sub-fields — just sets `{ id: 0, type: 'web-push'|'mobile-push' }`

### Section 3: Entry Frequency (`applyFrequency`)

Radio group with 3 options:

| Value             | Label              | Extra fields                                    |
| ----------------- | ------------------ | ----------------------------------------------- |
| `unique`          | Only once          | None                                            |
| `multiply-period` | Once during period | Number input + unit select (days/hours/minutes) |
| `multiply`        | Multiple times     | None                                            |

**Period conversion**: stored in minutes internally. UI shows in selected unit, converts on save (days×24×60, hours×60, minutes×1).

### Section 4: Entry Condition Filter (`conditional`)

Embeds the `AutomationConditionBuilder` (same one used in the conditional step). Rules stored in `settings.conditional[]`. All 7 rule types available (interaction, custom_field, user_field, tag, automation_state, custom_event, lead).

## Implementation Tasks

### Task 1: Create new TriggerConfigPanel

**File:** `editor/panels/trigger-config-panel.tsx`

A dedicated file (the trigger config is too complex for a section in `step-config-panel.tsx`). Contains:

1. **Trigger type select** — `<Select>` with 5 options
2. **Tag sub-field** — `SearchableApiSelect` fetching tags with debounce
3. **Events sub-fields** — event type `<Select>` + message `SearchableApiSelect` (hidden for first_open_30_days)
4. **Custom events sub-field** — `SearchableApiSelect` fetching custom events with debounce
5. **Entry frequency radio group** — 3 radios + period input + unit select for `multiply-period`
6. **Entry condition filter** — `BuilderProvider` + `AutomationConditionBuilder`, same as conditional step but operating on `settings.conditional[]`

All changes apply immediately via `onSave`.

### Task 2: Update step-config-panel to use new TriggerConfigPanel

Replace the inline `TriggerConfig` function with the new component. The sheet should be wide (`sm:max-w-2xl`) for trigger since the conditional builder needs space.

### Task 3: Add i18n keys

New translation keys for trigger-specific labels.

### Task 4: Type-check + test

## Settings Shape (matches API)

```typescript
// Already defined in TriggerSettings
{
  id?: number,
  type?: 'tag' | 'events' | 'custom_events' | 'web-push' | 'mobile-push',
  name?: string,
  applyFrequency?: 'unique' | 'multiply' | 'multiply-period',
  timePeriod?: number,       // stored in minutes
  typeMultiply?: 'days' | 'hours' | 'minutes' | '',
  eventType?: 'open' | 'click' | 'first_open_30_days',
  title?: string,
  conditional?: ConditionalRule[],
}
```

## Acceptance Criteria

- [ ] All 5 trigger types selectable with correct sub-fields
- [ ] Tag: searchable API select, single select
- [ ] Events: event type select + message picker (hidden for first_open_30_days)
- [ ] Custom events: searchable API select
- [ ] Web push / mobile push: no sub-fields, just type selection
- [ ] Entry frequency: 3 radio options, period input for multiply-period
- [ ] Period stored in minutes, displayed in selected unit
- [ ] Entry condition filter: full condition builder with all 7 rule types
- [ ] Settings shape matches API
- [ ] Wide sheet for trigger config
- [ ] i18n in pt-BR and en-US
- [ ] TypeScript type-check passes

## Sources

- Vue2 TriggerComponent: `apps/frontend-vue2/src/modules/automations/components/UpdateModal/TriggerComponent.vue`
- React TriggerSettings: `apps/frontend-react/src/features/automations/editor/types.ts`
- AutomationConditionBuilder: `apps/frontend-react/src/features/automations/editor/panels/automation-condition-builder.tsx`
