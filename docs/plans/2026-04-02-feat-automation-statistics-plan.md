---
title: 'feat: Add Automation Statistics Dialog'
type: feat
status: active
date: 2026-04-02
---

# Automation Statistics

## Overview

Add a statistics dialog accessible from the top bar of the automation editor. Shows 4 summary KPI cards and a "Contacts who reached the goal" line chart with date range picker. Internal accounts only (matching Vue 2 behavior).

## API Endpoints

### 1. Summary KPIs

**`GET /statistics/automation/:automationId`**

Response (array with one row):

```json
[
  {
    "unique_open": 1234,
    "unique_click": 567,
    "total_running": 8900,
    "total_running_today": 42
  }
]
```

### 2. Goal Chart

**`GET /automations/target/statistics`**

Params: `{ automationId, startDate, endDate }` (YYYY-MM-DD)

Response (array of daily counts):

```json
[
  { "date": "2025-04-01", "count": 15 },
  { "date": "2025-04-02", "count": 0 }
]
```

## Implementation Tasks

### Task 1: Create hooks

**File:** `use-automations.ts`

```typescript
export function useAutomationStatistics(automationId: number) { ... }
export function useAutomationGoalStats(automationId: number, startDate: string, endDate: string) { ... }
```

### Task 2: Create AutomationStatisticsDialog

**File:** `editor/panels/automation-statistics-dialog.tsx`

A `Dialog` component containing:

**Top section — 4 KPI cards:**
| Card | Key | Label (pt-BR) | Icon |
|------|-----|---------------|------|
| Unique Opens | `unique_open` | Abertura Única | Mail icon |
| Unique Clicks | `unique_click` | Clique Único | MousePointer icon |
| Entered Today | `total_running_today` | Entrou Hoje | UserPlus icon |
| Running | `total_running` | Automação Rodando | Activity icon |

Each card shows the number formatted with locale (e.g., `3.797` in pt-BR).

**Bottom section — Goal chart:**

- Date range picker (default: last 30 days, max 180 days back)
- Line chart using **Recharts** (already installed in the project) showing daily goal completions
- X-axis: dates (formatted short, e.g., "1 mar")
- Y-axis: count
- Single series line

### Task 3: Add Statistics button to top bar

**File:** `automation-form-page.tsx`

A `BarChart3` icon button in the top bar, next to the History button. Only shown when:

- Editing an existing automation (`isEditing`)
- Not in preview mode
- Account is internal (`isInternal`) — matching Vue 2 behavior

Opens the `AutomationStatisticsDialog`.

### Task 4: i18n

Add translation keys for all labels and card titles.

## Acceptance Criteria

- [ ] Statistics button in top bar (internal accounts only, edit mode only)
- [ ] Dialog shows 4 KPI cards with formatted numbers
- [ ] Goal chart with date range picker (default 30 days, max 180 days)
- [ ] Chart uses Recharts (already in the project)
- [ ] Loading states for both KPIs and chart
- [ ] i18n in pt-BR and en-US
- [ ] TypeScript type-check passes

## Sources

- Vue2 statistics dialog: `apps/frontend-vue2/src/modules/automations/views/Automation.vue:266-386`
- API endpoint: `GET /statistics/automation/:id`
- API endpoint: `GET /automations/target/statistics`
- Vue2 chart: ApexCharts (line chart) — we'll use Recharts instead (already installed)
