---
title: "feat: Add Automation Version History with Preview and Restore"
type: feat
status: active
date: 2026-04-02
---

# Automation Version History

## Overview

Add a version history panel to the automation editor. Users can view all past versions, click one to preview it in the editor (read-only), and restore it via a "Restore this version" button. Matches the Vue 2 `AutomationHistoric` component.

## API

**Endpoint:** `GET /audits/:automationId`

**Response:** Array of audit records, newest first:
```typescript
interface AuditRecord {
  id: number
  entityId: number         // automation ID
  type: string             // "update"
  oldValues: any           // full state before change
  newValues: {             // full state after change
    steps: ApiStep         // the step tree for this version
    flowLayout?: FlowLayout
    [key: string]: unknown
  }
  user: string             // JSON string: '{"email":"user@example.com"}'
  createdAt: string        // ISO timestamp
}
```

**Restore:** No dedicated endpoint — just `PUT /automations/complete` with the historic version's steps as payload (same as regular save).

## Implementation Tasks

### Task 1: Create useAutomationAudits hook

**File:** `use-automations.ts`

```typescript
export function useAutomationAudits(automationId: number) {
  return useQuery<AuditRecord[]>({
    queryKey: ['audits', automationId],
    queryFn: () => apiClient.get(`/audits/${automationId}`).then(r => r.data),
    enabled: automationId > 0,
  })
}
```

### Task 2: Create VersionHistoryPanel component

**File:** `editor/panels/version-history-panel.tsx`

A Sheet (right side) containing:
- **Header:** "History" title + close button
- **Scrollable list** of audit entries, each showing:
  - Timestamp (formatted with `Intl.DateTimeFormat` — full date+time for older, date-only for current)
  - Author email (parsed from `audit.user` JSON string)
  - "Current version" badge on the first/latest entry
  - Click handler to preview that version
- Active state highlight on the selected version

### Task 3: Add History button to top bar

**File:** `automation-form-page.tsx`

A `History` (clock) icon button in the top bar header, between the "last saved" text and the save button. Only shown when editing (not on create). Toggles the `VersionHistoryPanel` sheet.

### Task 4: Preview mode

When a non-current version is clicked:
1. Deserialize `audit.newValues.steps` into React Flow nodes/edges
2. Pass to the editor with `readOnly={true}`
3. Show a banner/bar at the top: "Viewing version from {date} — [Restore this version] [Back to current]"
4. Hide the blocks sidebar (can't edit in preview mode)
5. The editor's `nodesDraggable`, `nodesConnectable` are already gated by `readOnly`

### Task 5: Restore

"Restore this version" button triggers the same `handleSave` flow but with the historic version's steps. After successful save:
- Exit preview mode
- Reload the automation (invalidate query cache)
- Show success toast

### Task 6: Back to current

"Back to current" button exits preview mode and restores the live editor state (the one before preview was activated).

## UX Flow

```
1. User clicks History button → Sheet opens with version list
2. User clicks an older version → Editor shows that version (read-only)
   - Banner appears: "Viewing version from May 18, 2022"
   - [Restore] [Back to current] buttons
   - Sidebar hidden, editor read-only
3a. User clicks "Restore" → saves historic steps → reloads → exits preview
3b. User clicks "Back to current" → restores live state → exits preview
4. User clicks the current version or closes sheet → exits preview
```

## Acceptance Criteria

- [ ] History button in top bar (only when editing existing automation)
- [ ] Sheet shows scrollable list of versions with timestamps and authors
- [ ] "Current version" badge on the latest entry
- [ ] Clicking a version previews it in the editor (read-only)
- [ ] Preview banner with version date + restore/back buttons
- [ ] Blocks sidebar hidden during preview
- [ ] "Restore this version" saves the historic steps via normal save flow
- [ ] "Back to current" returns to the live editor state
- [ ] i18n in pt-BR and en-US

## Sources

- Vue2 AutomationHistoric: `apps/frontend-vue2/src/modules/automations/components/AutomationHistoric.vue`
- Vue2 Automation.vue: `apps/frontend-vue2/src/modules/automations/views/Automation.vue:1091-1157`
- API audits controller: `apps/msgops-api/src/modules/audits/audits.controller.ts`
- API audit entity: `apps/msgops-api/src/entities/audit.entity.ts`
