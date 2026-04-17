---
title: "feat: Email Statistics Overview Page"
type: feat
status: active
date: 2026-04-07
---

# Email Statistics Overview Page

## Enhancement Summary

**Deepened on:** 2026-04-07
**Research agents used:** ECharts best practices, Data table patterns, Filter system patterns, Vercel React performance, Composition patterns, ECharts v6 docs, TanStack Router search params, Repo pattern analysis

### Key Improvements
1. **Architecture**: `StatisticsProvider` context pattern (matching existing `ListPage` compound component) with explicit variant components per display mode — no prop drilling, no boolean flags
2. **Performance**: Lazy-load ECharts via `React.lazy`, single `useMemo` for chart options, `placeholderData: keepPreviousData` for seamless filter changes, 4 memoized sibling components
3. **Filter UX**: Sheet (side drawer) instead of popover for 7 filter sections, reusable `FilterCheckboxList` component, draft state pattern matching existing campaigns filter bar
4. **Codebase alignment**: Follows exact project conventions — CSV string params with `parseCsvIds`/`serializeCsvIds`, `.default(x).catch(x)` Zod pattern, `usePermissions().can()`, `ListPage` layout shell

### New Considerations Discovered
- `analytics:dashboard_export` permission doesn't exist in the React Permission type yet — needs adding to `ALL_PERMISSIONS`
- ECharts colors must be set per-series via `itemStyle.color` + `lineStyle.color` (not palette index) to prevent color shifts when legend toggling
- The existing `CampaignsDateRangePicker` can be generalized and reused rather than building from scratch
- `echarts-for-react` is installed but unused — the custom `EChartsBase` component is the correct approach

---

## Overview

Recreate the Vue 2 `Dashboard.vue` statistics page in React, replacing the existing basic `email-statistics-page.tsx`. The page provides a comprehensive email/web-push statistics dashboard with summary metric cards, a multi-line time series chart (ECharts), a detailed daily data table with percentages and progress bars, advanced multi-filter system, numeric/percentage chart toggle, "per user" mode, CSV export, and URL state sync.

Route: `/messages/email/statistics` (replaces current page) and `/messages/web-push/statistics`.

## Problem Statement / Motivation

The current React email statistics page is a basic placeholder with 6 summary cards and a simple Recharts line chart. The Vue 2 `Dashboard.vue` is a 3800-line feature-rich page that the marketing and retention teams use daily. Full feature parity is needed to retire the Vue 2 frontend.

## Proposed Solution

Rewrite the `email-statistics` feature module at `apps/frontend-react/src/features/email-statistics/` with these components:

### UI Structure (top to bottom, matching screenshot)

1. **Page title**: "Estatísticas" / "Statistics"
2. **Tab navigation**: Email | Web Push (channel-dependent)
3. **Filter bar**: Date range picker, "Per user" toggle (internal accounts only), "More filters" expandable panel
4. **Filter chips**: Active filters shown as removable badges below the filter bar
5. **Summary metric cards**: 8 cards in a responsive grid (4 cols on desktop)
6. **Numeric/Percentage toggle**: `#` / `%` buttons (hidden in "per user" mode)
7. **Multi-line chart** (ECharts): All metrics as colored lines over time, with legend
8. **Daily data table**: Sortable columns with percentage badges + progress bars, pagination, CSV export

### API

Uses the existing msgops-api endpoint (proxied through Vite at `/api`):

```
GET /statistics/email
GET /statistics/push

Params: startDate, endDate, campaigns[], automations[], messages[], tags[], segments[], senders[], subUsers[]
```

Response:
```typescript
{
  general: {
    delivered: number, open: number, unique_opens: number, click: number,
    unique_clicks: number, unsubscribe: number, bounce: number, sent: number, close: number,
    unique_user_delivered: number, unique_user_open: number, unique_user_click: number,
    unique_user_unsubscribe: number, unique_user_bounce: number,
    opens_per_contact: number, clicks_per_contact: number
  },
  daily: Array<{
    date: string,
    delivered: number, open: number, unique_opens: number, click: number,
    unique_clicks: number, unsubscribe: number, bounce: number, sent: number, close: number,
    unique_user_delivered: number, unique_user_open: number, unique_user_click: number,
    unique_user_unsubscribe: number, unique_user_bounce: number,
    opens_per_contact: number, clicks_per_contact: number
  }>
}
```

Filter option endpoints (existing):
- `GET /campaigns` — campaign list
- `GET /automations` — automation list
- `GET /messages` — message list
- `GET /tags` — tag list
- `GET /segments` — segment list
- Senders/sub-users from account data

## Technical Considerations

### Architecture: StatisticsProvider Context

Follow the existing `ListPage` compound component pattern. Create a `StatisticsProvider` that lifts shared state into context:

- **state**: `{ mode, dateRange, filters, data, summary, timeSeries, isLoading }`
- **actions**: `{ setMode, setDateRange, applyFilters, clearFilters, toggleChartType }`

Children read from context via `use(StatisticsContext)` (React 19) — no prop drilling. The page component becomes pure composition:

```
<StatisticsProvider params={searchParams}>
  <ListPage.Root>
    <ListPage.Header />
    <ListPage.Toolbar> (tabs, filter bar) </ListPage.Toolbar>
    <FilterChips />
    <SummaryCards />
    <ChartToggle />
    <Suspense fallback={<ChartSkeleton />}>
      <StatisticsChart />  <!-- lazy-loaded -->
    </Suspense>
    <StatisticsTable />
  </ListPage.Root>
</StatisticsProvider>
```

### Research Insights: Component Architecture

**Explicit variant components per display mode** (not boolean props):
- `EmailNumericCards` / `EmailPercentageCards` / `EmailPerUserCards` — each reads same data from context but formats differently
- Column definition hooks per mode: `useEmailColumns()`, `usePushColumns()`, `usePerUserColumns()`
- Mode selector renders the appropriate variant: `{mode === 'numeric' && <EmailNumericCards />}`

**4 memoized sibling components** to isolate re-renders:
1. `StatisticsFilterBar` — owns filter state synced to URL
2. `StatisticsSummaryCards` — receives summary values
3. `StatisticsChart` (lazy-loaded) — receives memoized ECharts option
4. `StatisticsTable` — owns pagination/sorting state internally (not in parent)

### Chart Library: ECharts

- ECharts v6 already installed with `EChartsBase` component at `src/components/charts/echarts-base.tsx`
- Multi-line chart with 7 series (email numeric mode) or 6 series (email percentage mode)
- Legend click toggles series visibility (built-in, no extra config)
- Smooth curves, stroke width configurable

### Research Insights: ECharts Configuration

**Per-series color binding** (critical — do NOT use palette index):
```typescript
{
  name: 'Open',
  type: 'line',
  smooth: 0.3,                        // controlled Bezier (not boolean true which defaults to 0.5)
  showSymbol: false,                   // hide dots, show on hover
  emphasis: { focus: 'series' },       // dim other series on hover — key for 7+ series
  lineStyle: { width: 2, color: '#0FB75C' },
  itemStyle: { color: '#0FB75C' },     // affects legend swatch + tooltip marker
  data: daily.map(d => d.open),
}
```

**Legend**: Use `legend.type: 'scroll'` for 7+ series to prevent wrapping/layout shift.

**Dual Y-axis for "per user" mode**:
- `yAxis: [{position: 'left', ...}, {position: 'right', min: 0, max: 100, splitLine: { show: false }}]`
- Lines (counts) use `yAxisIndex: 0`, bars (rates) use `yAxisIndex: 1`
- `xAxis.boundaryGap: true` required when mixing bars

**Y-axis formatter** (abbreviations like "100 MIL", "1M"):
```typescript
function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')} MIL`
  return String(value)
}
```

**Custom tooltip** — use `params.marker` (auto-generated colored dot HTML from ECharts) instead of building your own.

**Performance**: 90 days × 7 series = 630 data points — trivially small, no `sampling` or `large` mode needed. Single `useMemo` with `[daily, displayMode]` as deps.

**Lazy-load ECharts** via `React.lazy` — echarts is ~300KB. Show `<ChartSkeleton />` via `<Suspense>`. The chart is below the fold.

**Hoist static chart config** (grid, legend position, axis formatters) to module-level constants outside the component.

### Metric Colors (exact from Vue 2 `Dashboard.vue:1221-1334`)

| Metric | Color | Used in cards, chart, table progress bars |
|--------|-------|------------------------------------------|
| delivered | `#0057f4` | Blue (email); `#0FB75C` for push |
| open | `#0FB75C` | Green |
| unique_opens | `#076e62` | Dark teal |
| click | `#00cefc` | Cyan |
| unique_clicks | `#436bba` | Blue-purple |
| CTOR | `#800080` | Purple |
| unsubscribe | `#f06158` | Red |
| bounce | `#ff9654` | Orange |
| sent | `#0057f4` | Blue (push only) |
| close | `#f06158` | Red (push only) |
| UTO | `#F06158` | Red |

"Per user" mode metrics:
| Metric | Color |
|--------|-------|
| unique_user_delivered (Base Size) | `#0057f4` |
| unique_user_open (Engaged Users) | `#0FB75C` |
| unique_user_click (DAU) | `#00cefc` |
| opens_per_contact (Avg Open Rate) | `#B0E2C7` |
| clicks_per_contact (Avg Click Rate) | `#98C7FD` |
| unique_user_unsubscribe (Unsub by Base) | `#f06158` |

### Summary Cards Layout

**Email mode** (8 cards, 2 rows of 4):

| Card | Display | Percentage formula |
|------|---------|-------------------|
| Entregue (Delivered) | count only | — |
| Abertura (Open) | `%` + count | open / delivered |
| Abertura Única (Unique Open) | `%` + count | unique_opens / delivered |
| Clique (Click) | `%` + count | click / delivered |
| Clique Único (Unique Click) | `%` + count | unique_clicks / delivered |
| CTOR | `%` only | click / open |
| Insc. cancelada (Unsubscribe) | `%` + count | unsubscribe / delivered |
| Bounce | `%` + count | bounce / delivered |

Card format: colored percentage text (large), gray count text (small, formatted with locale separator).

### Table Columns (Email)

| Column | Key | Format | Progress bar color |
|--------|-----|--------|--------------------|
| Data (Date) | `date` | DD/MM/YYYY | — |
| Entregue | `delivered` | count | — |
| Abertura | `open` | `%` + count | `#0FB75C` |
| Abertura Única | `unique_opens` | `%` + count | `#076e62` |
| Clique | `click` | `%` + count | `#00cefc` |
| Clique Único | `unique_clicks` | `%` + count | `#436bba` |
| CTOR | `percentageCtor` | `%` | `#800080` |
| Insc. cancelada | `unsubscribe` | `%` + count | `#f06158` |
| UTO | `percentageUto` | `%` | `#F06158` |
| Bounce | `bounce` | `%` + count | `#ff9654` |

Each cell with `%` shows: colored percentage badge + absolute count below, with a thin (4px) progress bar underneath.

### Research Insights: Data Table

**Custom cell renderer** — extract a `StatsCell` component (not inline arrow function):
```typescript
function StatsCell({ rate, count, color }: { rate: number; count: number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5 tabular-nums">
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-medium" style={{ color }}>{rate.toFixed(2)}%</span>
        <span className="text-xs text-muted-foreground">{count.toLocaleString()}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted">
        <div className="h-1 rounded-full" style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}
```

**Client-side sorting + pagination**: Use `getSortedRowModel()` + `getPaginationRowModel()` from TanStack Table (NOT `manualSorting`/`manualPagination` which are for server-side). Default sort: `[{ id: 'date', desc: true }]`.

**Dynamic columns via hook**: `useStatisticsColumns(mode)` returns `ColumnDef[]` wrapped in `useMemo([mode])`. When columns change, set `autoResetSorting: false` to preserve sort state.

**Progress bars**: CSS-only (no component library needed) — `h-1 rounded-full bg-muted` track + fill div with inline `width` style. 4px decorative bars don't need ARIA progressbar semantics.

**Tabular numbers**: Apply `tabular-nums` class on table container or cells for aligned numeric columns.

**CSV export**: Native `Blob` + `URL.createObjectURL` with `\uFEFF` BOM prefix for UTF-8 Excel compatibility. Export full dataset, not just current page.

**Performance**: 90 rows × 10 columns = 900 cells — no virtualization needed. Keep column definitions in `useMemo` and data reference stable.

### Table Columns (Push)

Date, Sent, Delivered (`%` + count), Click (`%` + count), Close (`%` + count, web-push only).

### "Per user" Mode Table Columns

Date, Base Size, Engaged Users (`%` + count), DAU (`%` + count), Avg Open Rate, Avg Click Rate, Unsub by Base (`%` + count).

### Chart Series

**Numeric mode (email):** Delivered, Open, Unique Opens, Click, Unique Clicks, Unsubscribe, Bounce
**Percentage mode (email):** Open%, Unique Open%, Click%, Unique Click%, Unsubscribe%, Bounce% (no Delivered — it's the base)
**Numeric mode (push):** Sent, Delivered, Click, Close (web-push only)
**Percentage mode (push):** Delivered%, Click%, Close%
**Per user mode:** Base Size (line), Engaged Users (line), DAU (line), Avg Open Rate (bar), Avg Click Rate (bar), Unsub by Base (line) — mixed chart with dual Y-axes

### Filters ("Mais filtros" / "More Filters")

### Research Insights: Filter System

**Use Sheet (side drawer)** instead of popover for 7 filter sections — a popover at 340px is too cramped. Sheet gives full viewport height. Project already has `Sheet` component at `src/components/ui/sheet.tsx`.

**Reusable `FilterCheckboxList` component** — extract the repeated Collapsible + Search + Checkbox pattern (seen 5 times in `campaigns-filter-bar.tsx`) into one component used 7 times. Props: `title`, `options: FilterOption[]`, `selected: string[]`, `onToggle`, `onSelectAll?`, `onSearch?`, `isLoading?`.

**Draft state pattern** (matching existing campaigns filter bar):
1. Sheet opens → copy URL state into local `useState` (draft)
2. User edits draft (no URL changes yet)
3. Click "Apply" → serialize draft to URL via `navigate({ search: prev => ({...prev, ...}) })`
4. Click "Clear" → reset draft to empty strings

**"Select All" = empty string in URL** (no filter applied). Do not send all IDs — empty means "show everything". This is the existing project convention.

**Server-side search for large lists** (campaigns, tags): Use `useDebouncedSearch(300)` hook + TanStack Query with `placeholderData: keepPreviousData` to prevent flashing.

**Date range picker**: Generalize the existing `CampaignsDateRangePicker` (`src/features/campaigns/components/campaigns-date-range-picker.tsx`). Improvements: highlight active preset, 2-month calendar (`numberOfMonths={2}`), detect which preset matches current range.

### URL State Sync

### Research Insights: TanStack Router Search Params

**Follow project conventions exactly**:
- Use `.default('').catch('')` on every field (not `fallback()` from zod-adapter)
- Pass Zod schema directly to `validateSearch` (not wrapped in `zodValidator()`)
- Store arrays as CSV strings with `parseCsvIds`/`serializeCsvIds` (already exist in contacts search schema)
- Extract schema into `statistics-search-schema.ts`
- Use `Route.useSearch()` to read, `useNavigate()` with `search: (prev) => ({...prev, ...})` to write
- Wrap navigation calls in `startTransition` for non-blocking updates
- Use `replace: true` for filter changes (don't pollute history)

**Share schema between email and web-push routes**:
```typescript
// statistics-search-schema.ts
export const statisticsSearchSchema = z.object({
  startDate: z.string().default('').catch(''),
  endDate: z.string().default('').catch(''),
  sortBy: z.string().default('date').catch('date'),
  sortDesc: z.boolean().default(true).catch(true),
  campaigns: z.string().default('').catch(''),
  automations: z.string().default('').catch(''),
  messages: z.string().default('').catch(''),
  tags: z.string().default('').catch(''),
  segments: z.string().default('').catch(''),
  senders: z.string().default('').catch(''),
  subUsers: z.string().default('').catch(''),
})
```

Both route files use the same schema via `validateSearch: statisticsSearchSchema`.

### Timezone Handling

Use `date-fns` (already installed) with timezone from Zustand app store (`currentAccountTimezone`).

### Research Insights: React Query Configuration

- **Override `staleTime` to 10-15 minutes** for statistics queries (historical/aggregated data, not real-time)
- **Set `gcTime` to 30 minutes** — users flip between dashboard views; keep cache warm
- **Use `placeholderData: keepPreviousData`** — single most impactful UX improvement for filter-heavy dashboards; avoids flash of loading skeletons when filters change
- **Include all filter params in query key**: `['statistics', { accountId, ...searchParams }]`
- **Set `enabled` based on valid date range** — disable query when required dates missing
- **Do NOT use `refetchInterval`** — statistics data doesn't change frequently; add manual refetch button if needed
- **`refetchOnWindowFocus: false`** — already set globally, appropriate for stable data

### Pagination

Client-side pagination: 20 items per page, prev/next buttons. Pagination state lives in `StatisticsTable` component only (not in parent/context) to isolate re-renders.

### CSV Export

Export button in table footer (permission-gated: `analytics:dashboard_export`). Exports all `tableData` rows as CSV.

**Note**: `analytics:dashboard_export` permission does not exist in the React `Permission` type at `src/types.ts`. Add it to `ALL_PERMISSIONS` array.

## Acceptance Criteria

### Core Layout
- [ ] Replace existing email statistics page at `/messages/email/statistics`
- [ ] Add `/messages/web-push/statistics` route
- [ ] Tab navigation between email/web-push (channel-dependent via account config)
- [ ] Responsive card grid: 4 cols on desktop, 2 on tablet, 1 on mobile
- [ ] Use `ListPage` compound component as layout shell

### Summary Cards
- [ ] 8 metric cards for email: Delivered, Open, Unique Open, Click, Unique Click, CTOR, Unsubscribe, Bounce
- [ ] Card format: colored percentage (large) + gray absolute count (small, locale-formatted)
- [ ] CTOR shows percentage only (click/open), Delivered shows count only (email)
- [ ] Push cards: Sent (count), Delivered (% + count), Click (% + count), Close (web-push, % + count)

### Chart
- [ ] ECharts multi-line chart with all metrics as separate colored series
- [ ] Lazy-loaded via `React.lazy` with `Suspense` fallback skeleton
- [ ] Legend at bottom (`type: 'scroll'`), clickable to toggle series visibility
- [ ] X-axis: dates formatted DD/MM, Y-axis: formatted numbers (MIL/M suffix)
- [ ] Numeric/Percentage toggle (`#` / `%`) — hidden in "per user" mode
- [ ] Percentage mode: removes Delivered line, shows %s for remaining metrics
- [ ] Per-series colors via `itemStyle.color` + `lineStyle.color` matching Vue 2 exactly
- [ ] `emphasis: { focus: 'series' }` for dimming non-hovered series
- [ ] `smooth: 0.3` for controlled Bezier curves
- [ ] Per-user mode: dual Y-axis mixed line+bar chart

### Data Table
- [ ] Client-side sorting via `getSortedRowModel()` (default: date descending)
- [ ] `StatsCell` component for percentage badge + count + 4px progress bar cells
- [ ] `tabular-nums` class for aligned numbers
- [ ] Client-side pagination via `getPaginationRowModel()` (20 per page) with prev/next
- [ ] Export CSV button in footer (permission-gated — add `analytics:dashboard_export` to `ALL_PERMISSIONS`)
- [ ] Column definitions via `useStatisticsColumns(mode)` hook with `useMemo`

### Filters
- [ ] Date range picker generalized from `CampaignsDateRangePicker` (2-month calendar, preset highlighting)
- [ ] "Per user" toggle (only for internal accounts with `currentAccount.isInternal`)
- [ ] "More filters" opens Sheet (side drawer) with 7 sections
- [ ] Reusable `FilterCheckboxList` component with search, checkboxes, Select All, Apply/Clear
- [ ] Draft state pattern: copy URL state on open, write to URL on Apply
- [ ] Active filter chips below filter bar, expand/collapse at 8+, removable
- [ ] URL state sync via `statisticsSearchSchema` with CSV string params
- [ ] `startTransition` wrapping all `navigate()` calls
- [ ] `parseCsvIds`/`serializeCsvIds` from existing contacts schema

### Performance
- [ ] ECharts lazy-loaded via `React.lazy` + `Suspense`
- [ ] Single `useMemo` for chart options with `[daily, displayMode]` deps
- [ ] Static chart config hoisted to module scope
- [ ] `placeholderData: keepPreviousData` on statistics query
- [ ] `staleTime: 10 * 60 * 1000` (10min), `gcTime: 30 * 60 * 1000` (30min) on statistics query
- [ ] Pagination/sorting state lives in `StatisticsTable` only (not in parent)

### Loading & Empty States
- [ ] Skeleton loaders for cards, chart, and table while loading
- [ ] "No data" message in table when empty

### i18n
- [ ] All labels translatable via i18next (pt-BR and en)
- [ ] New top-level `"statistics"` namespace in both locale files

## Success Metrics

- Visual parity with Vue 2 `Dashboard.vue` (matching the provided screenshot)
- Same colors, same table layout, same card format, same chart behavior
- URL state allows sharing/bookmarking filtered views

## Dependencies & Risks

- **Dependency**: `/statistics/email` and `/statistics/push` endpoints on msgops-api (exist today)
- **Dependency**: Filter endpoints (`/campaigns`, `/automations`, `/messages`, `/tags`, `/segments`) exist on msgops-api
- **Risk**: Vite proxy must forward `/api/statistics/*` — verify in `vite.config.ts`
- **Risk**: "Per user" mode has a mixed chart (line + bar with dual Y-axes) — ECharts handles this natively but needs `xAxis.boundaryGap: true` and `splitLine: { show: false }` on secondary Y-axis
- **Risk**: The Vue 2 page is 3800 lines with significant complexity; the `StatisticsProvider` context + explicit variant components architecture is critical to keeping this manageable
- **Risk**: `analytics:dashboard_export` permission must be added to the React `Permission` type

## Implementation Structure

### File Layout

```
src/features/email-statistics/
  context/
    statistics-context.ts               # StatisticsState, StatisticsActions interface
    statistics-provider.tsx             # provider: filter state, data fetching, mode
  statistics-search-schema.ts           # Zod schema for URL search params
  types.ts                              # TypeScript interfaces (rewrite existing)
  constants.ts                          # metric definitions, colors, chart config (module-level)
  use-email-statistics.ts               # React Query hook (rewrite existing)
  components/
    message-type-tabs.tsx               # email/web-push tab navigation
    statistics-filter-bar.tsx           # date picker + per-user toggle + more filters button
    statistics-filter-panel.tsx         # Sheet (drawer) with all filter sections
    filter-checkbox-list.tsx            # reusable: search + checkbox list + Apply/Clear
    filter-chips.tsx                    # active filter chips with expand/collapse
    cards/
      email-numeric-cards.tsx           # 8 cards for numeric mode
      email-per-user-cards.tsx          # cards for per-user mode
      push-cards.tsx                    # cards for push mode
      stat-card.tsx                     # shared presentational card primitive
    chart/
      statistics-chart.tsx              # reads context, owns chart-type toggle
      chart-options.ts                  # pure functions: buildNumericOption, buildPercentageOption, buildPerUserOption
    table/
      statistics-table.tsx              # TanStack Table with client-side sort/pagination
      stats-cell.tsx                    # cell: percentage badge + count + progress bar
      use-email-columns.ts             # email column definitions hook
      use-push-columns.ts              # push column definitions hook
      use-per-user-columns.ts          # per-user column definitions hook
      csv-export.ts                     # Blob + BOM CSV generation
  email-statistics-page.tsx             # main page: composes all components (rewrite existing)
```

### Route Files

```
src/routes/_authenticated/_layout/
  messages.email.statistics.tsx         # email statistics route (already exists)
  messages.web-push.statistics.tsx      # web-push statistics route (new)
```

Both routes use `validateSearch: statisticsSearchSchema` and pass `Route.useSearch()` as props.

### Key Component Breakdown

**`email-statistics-page.tsx`** — Orchestrator:
- Reads route params for message type (email/web-push)
- Reads URL search params via `Route.useSearch()`
- Wraps everything in `<StatisticsProvider params={searchParams}>`
- Composes: `ListPage.Root` > tabs > filter bar > chips > cards > toggle > chart (in Suspense) > table

**`statistics-provider.tsx`** — Context provider:
- Fetches statistics data via `useEmailStatistics` with all filter params
- Computes summary and table data with percentages via `useMemo`
- Exposes state + actions via context
- Children read via `use(StatisticsContext)` (React 19)

**`statistics-filter-panel.tsx`** — Sheet (side drawer):
- Opens via "Mais filtros" button
- Contains 7 `FilterCheckboxList` sections in `ScrollArea`
- Manages draft state locally (copy from URL on open, write to URL on Apply)
- `SheetFooter` with Clear/Apply buttons

**`filter-checkbox-list.tsx`** — Reusable filter section:
- `Collapsible` wrapper with title + active count badge
- Search input (debounced for server-side, instant for client-side)
- `ScrollArea` (max-height ~160px) with checkbox list
- "Select All" checkbox (empty = all, presence = specific filter)
- Props: `title`, `options`, `selected`, `onToggle`, `onSelectAll?`, `onSearch?`

**`statistics-chart.tsx`** — Lazy-loaded ECharts wrapper:
- Reads data and display mode from `StatisticsContext`
- Builds chart options via pure functions from `chart-options.ts`
- Single `useMemo` with `[daily, displayMode]` as deps
- Static config (grid, legend position) hoisted to module constants
- Per-user mode renders dual Y-axis mixed chart

**`statistics-table.tsx`** — Client-side TanStack Table:
- Owns `sorting` and `pagination` state internally (isolates re-renders)
- Selects columns via `useEmailColumns()` / `usePushColumns()` / `usePerUserColumns()` based on mode
- Uses `getSortedRowModel()` + `getPaginationRowModel()`
- Custom `StatsCell` for percentage + progress bar cells
- Footer: export CSV button (gated by `usePermissions().can('analytics:dashboard_export')`)

**`stats-cell.tsx`** — Table cell component:
- Colored percentage text (matching metric color via inline `style={{ color }}`)
- Absolute count in muted text below
- 4px CSS-only progress bar (`h-1 rounded-full`) underneath
- `tabular-nums` for aligned numbers

**`chart-options.ts`** — Pure functions:
- `buildNumericChartOption(daily, metricColors, t)` — 7-series line chart
- `buildPercentageChartOption(daily, metricColors, t)` — 6-series line chart (no Delivered)
- `buildPerUserChartOption(daily, metricColors, t)` — mixed line+bar with dual Y-axes
- Common config: `emphasis: { focus: 'series' }`, `legend: { type: 'scroll', bottom: 0 }`, `smooth: 0.3`, `showSymbol: false`

**`csv-export.ts`** — Pure function:
- Generates CSV from columns + data with BOM prefix (`\uFEFF`)
- Escapes values containing commas/quotes per RFC 4180
- Creates `Blob` + `URL.createObjectURL` for download
- Exports all rows, not just current page

### Search Params Schema

```typescript
// statistics-search-schema.ts
import { z } from 'zod'

export const statisticsSearchSchema = z.object({
  startDate: z.string().default('').catch(''),
  endDate: z.string().default('').catch(''),
  sortBy: z.string().default('date').catch('date'),
  sortDesc: z.boolean().default(true).catch(true),
  campaigns: z.string().default('').catch(''),
  automations: z.string().default('').catch(''),
  messages: z.string().default('').catch(''),
  tags: z.string().default('').catch(''),
  segments: z.string().default('').catch(''),
  senders: z.string().default('').catch(''),
  subUsers: z.string().default('').catch(''),
})

export type StatisticsSearchParams = z.infer<typeof statisticsSearchSchema>

// Reuse from contacts-search-schema.ts or promote to shared:
export { parseCsvIds, serializeCsvIds } from '@/features/contacts/contacts-search-schema'
```

## Deferred

- **Message preview modal** — deferred to a follow-up task
- **Customize metrics modal** — Vue 2 has a modal to show/hide specific metrics and save to localStorage. Can be added later.
- **Mobile push statistics** — Vue 2 supports mobile-push as a third tab. Can be added after email + web-push are done.

## Sources & References

### Internal References

- Vue 2 source: `apps/frontend-vue2/src/modules/dashboard/views/Dashboard.vue` (3836 lines)
- Vue 2 API service: `apps/frontend-vue2/src/modules/dashboard/services/dashboard.service.ts`
- Vue 2 router: `apps/frontend-vue2/src/modules/dashboard/router/index.ts`
- Existing React page (to replace): `apps/frontend-react/src/features/email-statistics/`
- ECharts base component: `apps/frontend-react/src/components/charts/echarts-base.tsx`
- Messages hook (reuse for filter): `apps/frontend-react/src/features/messages/use-messages.ts`
- App store (timezone, account, permissions): `apps/frontend-react/src/stores/app-store.ts`
- API client: `apps/frontend-react/src/lib/api-client.ts`
- Query keys: `apps/frontend-react/src/lib/query-keys.ts`
- List page pattern: `apps/frontend-react/src/components/list-page.tsx`
- Campaigns filter bar (pattern reference): `apps/frontend-react/src/features/campaigns/components/campaigns-filter-bar.tsx`
- Campaigns date range picker (generalize): `apps/frontend-react/src/features/campaigns/components/campaigns-date-range-picker.tsx`
- Campaigns search schema (CSV pattern): `apps/frontend-react/src/features/campaigns/campaigns-search-schema.ts`
- Contacts search schema (parseCsvIds): `apps/frontend-react/src/features/contacts/contacts-search-schema.ts`
- List search params hook: `apps/frontend-react/src/hooks/use-list-search-params.ts`
- Permissions hook: `apps/frontend-react/src/hooks/use-permissions.ts`
- Permission types: `apps/frontend-react/src/types.ts` (lines 2-40)
- DataTable component: `apps/frontend-react/src/components/data-table/data-table.tsx`
- DataTable pagination: `apps/frontend-react/src/components/data-table/data-table-pagination.tsx`
- Backoffice dual-axis chart (reference): `apps/backoffice/src/components/charts/dual-axis-chart.tsx`
