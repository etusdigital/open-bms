# DataTable Toolbar Design

**Date**: 2026-02-24
**Status**: Approved
**Scope**: Columns visibility + Conditional formatting for all report tables

## Problem

Report tables lack column visibility control and cell-level conditional formatting (color scales, conditional colors). This makes it harder for the retention team to focus on key metrics and spot anomalies visually.

## Solution

Extend the existing `ReportTable` component with a toolbar that appears when a `tableId` prop is provided. Settings persist to `localStorage` per table.

## Decisions

- **Approach A**: Extend `ReportTable` directly (not a new component) — backward-compatible via optional `tableId` prop
- **Persistence**: `localStorage` keyed by `tableId`
- **Formatting types**: Both Color Scale (heatmap gradient) + Single Color (conditional)
- **Alignment**: Skipped — current column-level defaults are sufficient
- **Testing**: TDD with vitest + @testing-library/react

## Architecture

### New Files

```
apps/frontend/src/
  lib/
    color-utils.ts
  hooks/
    use-table-settings.ts
  components/data-table/
    columns-popover.tsx
    formatting-modal.tsx
    data-table-toolbar.tsx
  __tests__/
    lib/color-utils.test.ts
    hooks/use-table-settings.test.ts
    components/data-table/columns-popover.test.tsx
    components/data-table/formatting-modal.test.tsx
    components/data-table/data-table-toolbar.test.tsx
    features/reports/report-table.test.tsx
```

### Modified Files

- `apps/frontend/src/features/reports/components/report-table.tsx` — add `tableId`, `alwaysVisible`, `isNumeric` props; render toolbar; apply cell styles
- `apps/frontend/src/features/reports/components/sender-report-page.tsx` — add `tableId`
- `apps/frontend/src/features/reports/components/account-report-page.tsx` — add `tableId`
- `apps/frontend/src/features/reports/components/provider-report-page.tsx` — add `tableId`
- `apps/frontend/src/features/reports/components/ip-report-page.tsx` — add `tableId`
- `apps/frontend/src/features/reports/components/volume-report-page.tsx` — add `tableId`
- `apps/frontend/src/features/reports/components/event-detail-page.tsx` — add `tableId`
- `apps/frontend/src/features/reports/components/event-breakdown-page.tsx` — add `tableId`

## Types

### `ColumnDef<T>` extensions (backward compatible)

```typescript
export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  format?: (value: string | number) => string;
  className?: string;
  alwaysVisible?: boolean; // prevents hiding (identity columns)
  isNumeric?: boolean; // enables formatting rules for this column
}
```

### Formatting Rules

```typescript
export type FormattingRule =
  | {
      id: string;
      type: 'color-scale';
      columnKey: string;
      minColor: string; // hex
      midColor: string; // hex
      maxColor: string; // hex
    }
  | {
      id: string;
      type: 'single-color';
      columnKey: string;
      operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between';
      value1: number;
      value2?: number; // for 'between'
      backgroundColor: string; // hex
      textColor: string; // hex
    };
```

### `TableSettings`

```typescript
export interface TableSettings {
  visibleColumns: string[];
  formattingRules: FormattingRule[];
}
```

### localStorage schema

Key: `table-settings-{tableId}`

```json
{
  "visibleColumns": ["sender_email", "delivered", "opened", "delivery_rate"],
  "formattingRules": [
    {
      "id": "rule-1",
      "type": "color-scale",
      "columnKey": "delivered",
      "minColor": "#dc2626",
      "midColor": "#fbbf24",
      "maxColor": "#16a34a"
    }
  ]
}
```

## UI Components

### `DataTableToolbar`

```
[ ☰ Columns ]  [ ⚙ Formatting ]
```

Rendered above the table inside `ReportTable` when `tableId` is present.

### `ColumnsPopover`

- Shadcn Popover triggered by Columns button
- Checkbox list of all columns
- `alwaysVisible` columns: shown but disabled (can't uncheck)

### `FormattingModal`

- Shadcn Dialog triggered by Formatting button
- **Quick Presets** section: column selector + 3 buttons (Heatmap, High=Good, Low=Good)
- **Rules list**: each rule shows `{columnKey} → {rule type}` + delete button
- **Rule editor** (inline per rule):
  - Color Scale: min/mid/max color pickers + gradient preview bar
  - Single Color: operator dropdown + value input(s) + background/text color pickers
- **+ Add rule** button
- **Apply** / **Cancel** footer buttons

### Cell Styling

Applied inline on each `<td>` via `getCellStyle(rule, value, columnStats)`:

1. Find formatting rule for `col.key`
2. Color Scale: normalize value between column min/max → `interpolateThreeColors`
3. Single Color: evaluate operator condition → apply static background + text color
4. Return `React.CSSProperties` with `backgroundColor` and `color`

## Quick Presets

| Preset      | minColor  | midColor  | maxColor  |
| ----------- | --------- | --------- | --------- |
| Heatmap     | `#dc2626` | `#fbbf24` | `#16a34a` |
| High = Good | `#ef4444` | `#fbbf24` | `#22c55e` |
| Low = Good  | `#22c55e` | `#fbbf24` | `#ef4444` |

## TDD Test Plan

| File                          | Coverage                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `color-utils.test.ts`         | `interpolateColor`, `interpolateThreeColors`, `isColorDark`                                                            |
| `use-table-settings.test.ts`  | Load from localStorage, `toggleColumn`, `addRule`, `removeRule`, writes back to localStorage                           |
| `columns-popover.test.tsx`    | Renders all columns, checkbox toggles, `alwaysVisible` is disabled                                                     |
| `formatting-modal.test.tsx`   | Quick preset, add rule, delete rule, Apply calls callback                                                              |
| `data-table-toolbar.test.tsx` | Columns button opens popover, Formatting button opens modal                                                            |
| `report-table.test.tsx`       | No toolbar without `tableId`, toolbar present with `tableId`, hidden column absent from DOM, color-scale style on cell |

## Report Page `tableId` Values

| Page            | tableId           |
| --------------- | ----------------- |
| Sender Report   | `sender-report`   |
| Account Report  | `account-report`  |
| Provider Report | `provider-report` |
| IP Report       | `ip-report`       |
| Volume Report   | `volume-report`   |
| Event Details   | `event-detail`    |
| Event Breakdown | `event-breakdown` |
