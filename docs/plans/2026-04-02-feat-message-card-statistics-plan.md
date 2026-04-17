---
title: "feat: Add Per-Step Statistics to Message Cards"
type: feat
status: active
date: 2026-04-02
---

# Per-Step Statistics on Message Cards

## Overview

Add live statistics to message step cards (email, webPush, mobilePush, testAB, randomMessage) in the React Flow editor. Shows delivery stats directly on the node cards with a date range selector, and a "More Statistics" dialog for detailed per-message breakdowns.

## API

**Endpoint:** `GET /statistics/messages`

**Params:**
```
email: string[]       // single-quoted message IDs: ["'123'", "'456'"]
webPush: string[]     // same format
mobilePush: string[]  // same format
startDate: string     // YYYY-MM-DD
endDate: string       // YYYY-MM-DD
automationId: number
```

**Response:** Object keyed by `message_id`:
```json
{
  "123": {
    "message_id": 123,
    "delivered": 2858,
    "open": 501,
    "unique_open": 315,
    "click": 142,
    "unique_click": 100,
    "unsubscribe": 7,
    "bounce": 18,
    "sent": 3000,
    "close": 0
  }
}
```

## Stat Display Per Step Type

### Single Email Step
4 inline stat tiles on the card:
| Stat | Formula | Display |
|------|---------|---------|
| Total Delivered | raw count | `2,858` |
| Open | `open/delivered × 100` | `17.5% 501` |
| Unique Open | `unique_open/delivered × 100` | `11.0% 315` |
| Click | `click/delivered × 100` | `5.0% 142` |

"More Statistics" button → opens link to `/messages/email/statistics?messages={id}` in new tab.

### TestAB Step (running)
Per-message: shows winner criteria stat (open or click) with percentage + count.
Winner highlighted green, loser red.
Total delivered at bottom.
"More Statistics" button → opens dialog with all 8 stat columns per message.
"Finish Test" button → calls `POST /automations/finish-testab`.

### TestAB Step (finished)
Shows winner message with all 4 inline stats.
"View A/B Test" button → opens dialog with full stats.

### Random Message Steps
List of messages on card.
"More Statistics" button → opens dialog with all 8 stat columns per message.

### Full Stats Dialog (8 columns)
| Column | Formula |
|--------|---------|
| Total Delivered | raw count |
| Open | `open/delivered × 100` |
| Unique Open | `unique_open/delivered × 100` |
| Click | `click/delivered × 100` |
| Unique Click | `unique_click/delivered × 100` |
| CTOR | `click/open × 100` |
| Unsubscribe | `unsubscribe/delivered × 100` |
| Bounce | `bounce/delivered × 100` |

## Implementation Tasks

### Task 1: Create useMessageStatistics hook

**File:** `use-automations.ts`

Fetches `GET /statistics/messages` with the automation's message IDs. Collects all message IDs from the current flow by walking nodes.

```typescript
export function useMessageStatistics(automationId: number, messageIds: number[], daysFilter: number)
```

### Task 2: Add date range selector to top bar

A small dropdown in the top bar (or below it): Today / Yesterday / 7 Days / 30 Days. Default: Today. Changes trigger a re-fetch.

### Task 3: Update single message node cards

Expand `message-node.tsx` (the generic factory) to show inline stat tiles below the message title when statistics are available. Pass stats via the editor context.

### Task 4: Update testAB node card

Expand `testab-node.tsx` to show:
- Per-message winner criteria stat with green/red highlighting
- Total delivered count
- "More Statistics" / "Finish Test" buttons

### Task 5: Update random message node card

Add "More Statistics" button to random message nodes.

### Task 6: Create MessageStatsDialog component

A dialog that shows all 8 stat columns for each message in a step. Used by testAB, randomMessage, and "More Statistics" button.

### Task 7: Stats context/provider

Pass statistics data from the form page down to all nodes via the editor context, avoiding prop drilling through React Flow's data system.

### Task 8: i18n

Translation keys for all stat labels.

## Acceptance Criteria

- [ ] Statistics load automatically when opening an existing automation
- [ ] Date range dropdown (Today/Yesterday/7 Days/30 Days) refreshes stats
- [ ] Single email cards show 4 inline stat tiles
- [ ] TestAB cards show per-message winner criteria stat with highlighting
- [ ] "More Statistics" opens dialog with 8 columns per message
- [ ] Random message cards have "More Statistics" button
- [ ] Stats formatted with locale (pt-BR numbers)
- [ ] TypeScript type-check passes
- [ ] i18n in pt-BR and en-US

## Sources

- Vue2 stats fetch: `apps/frontend-vue2/src/modules/automations/views/Automation.vue:961-1010`
- Vue2 card display: `apps/frontend-vue2/src/modules/automations/components/MessageCardComponent.vue`
- API endpoint: `GET /statistics/messages`
