# Fix PR #16 Code Review Issues — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical, important, and warning-level issues found during code review of PR #16 (feat/statistics).

**Architecture:** Targeted fixes across existing files — no new features, no new abstractions beyond a shared CSV escape utility and a `useStatisticsContext` hook. Each task is a self-contained fix that can be committed independently.

**Tech Stack:** React 19, TypeScript, TanStack Router, Zustand, react-i18next, date-fns, ECharts, Vitest

---

## Task 1: Fix stale module-level date constants (C1)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/components/statistics-filter-bar.tsx:25-40`

**Step 1: Move `TODAY` and `MIN_DATE` inside the component, memoized by day**

Replace lines 25-40 with a `useMemo` inside the component body. Remove the module-level constants.

In `statistics-filter-bar.tsx`, delete lines 25-26:

```ts
const TODAY = startOfDay(new Date())
const MIN_DATE = subDays(TODAY, 180)
```

And delete lines 33-40 (the `PRESETS` constant).

Then inside `StatisticsFilterBar`, after line 46 (`const isInternal = ...`), add:

```ts
const today = useMemo(() => startOfDay(new Date()), [
  // Re-compute daily — key on the date string so it stays stable within a day
  format(startOfDay(new Date()), 'yyyy-MM-dd'),
])
const minDate = useMemo(() => subDays(today, 180), [today])

const presets: DatePreset[] = useMemo(() => [
  { labelKey: 'statistics.presetToday', getRange: () => ({ from: today, to: today }) },
  { labelKey: 'statistics.presetYesterday', getRange: () => { const d = subDays(today, 1); return { from: d, to: d } } },
  { labelKey: 'statistics.presetLast7Days', getRange: () => ({ from: subDays(today, 7), to: today }) },
  { labelKey: 'statistics.presetLast15Days', getRange: () => ({ from: subDays(today, 15), to: today }) },
  { labelKey: 'statistics.presetLast30Days', getRange: () => ({ from: subDays(today, 30), to: today }) },
  { labelKey: 'statistics.presetLastMonth', getRange: () => { const m = subMonths(today, 1); return { from: startOfMonth(m), to: endOfMonth(m) } } },
], [today])
```

Then update all references: `TODAY` → `today`, `MIN_DATE` → `minDate`, `PRESETS` → `presets` (at lines 137-140 and 145).

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors in statistics-filter-bar.tsx

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/components/statistics-filter-bar.tsx
git commit -m "fix(statistics): move date constants inside component to prevent stale values in long-lived SPA"
```

---

## Task 2: Stabilize `useParamsWithDefaults` memo (C2)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/email-statistics-page.tsx:37-48`

**Step 1: Use a stable fallback date string**

Replace the `useParamsWithDefaults` function (lines 37-48) with:

```ts
/** Fill in default date range (last 30 days) if not present in URL */
function useParamsWithDefaults(searchParams: StatisticsSearchParams): StatisticsSearchParams {
  // Stable per-day string — avoids creating a new Date() on every render
  const [fallbackDate] = useState(() => ({
    start: format(subDays(startOfDay(new Date()), 30), 'yyyy-MM-dd'),
    end: format(startOfDay(new Date()), 'yyyy-MM-dd'),
  }))

  return useMemo(() => {
    if (searchParams.startDate && searchParams.endDate) return searchParams
    return {
      ...searchParams,
      startDate: searchParams.startDate || fallbackDate.start,
      endDate: searchParams.endDate || fallbackDate.end,
    }
  }, [searchParams, fallbackDate])
}
```

Add `useState` to the import from `react` on line 1 (it's already there).

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/email-statistics-page.tsx
git commit -m "fix(statistics): stabilize default date params to prevent cascading re-renders"
```

---

## Task 3: Add missing permission to types (I1)

**Files:**
- Modify: `apps/frontend-react/src/types.ts:2-39`

**Step 1: Add the missing permission**

In `types.ts`, add `'audience:contacts_suppress'` to the `ALL_PERMISSIONS` array. Insert it after line 27 (`'audience:custom_fields_create'`):

```ts
  'audience:custom_fields_create',
  'audience:contacts_suppress',
```

**Step 2: Run type check to confirm it resolves**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No type errors related to `audience:contacts_suppress`

**Step 3: Commit**

```bash
git add apps/frontend-react/src/types.ts
git commit -m "fix(types): add audience:contacts_suppress to ALL_PERMISSIONS"
```

---

## Task 4: Fix stale `initialIndex` in MessagePreviewDialog (I2)

**Files:**
- Modify: `apps/frontend-react/src/features/campaigns/steps/message-preview-dialog.tsx:57-58`

**Step 1: Add useEffect to sync initialIndex on open**

Add `useEffect` to the import on line 1 (wherever React imports are).

After line 58 (`const [currentIndex, setCurrentIndex] = useState(initialIndex)`), add:

```ts
  useEffect(() => {
    if (open) setCurrentIndex(initialIndex)
  }, [open, initialIndex])
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/campaigns/steps/message-preview-dialog.tsx
git commit -m "fix(dialog): sync initialIndex when MessagePreviewDialog reopens"
```

---

## Task 5: Remove extra prop in dashboard route (I4)

**Files:**
- Modify: `apps/frontend-react/src/routes/_authenticated/_layout/analytics.dashboard.tsx:12`

**Step 1: Remove the unused `messageType` prop**

Replace line 12:

```tsx
  return <EmailStatisticsPage searchParams={searchParams} messageType={searchParams.channel} />
```

With:

```tsx
  return <EmailStatisticsPage searchParams={searchParams} />
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors (EmailStatisticsPageProps only has `searchParams`)

**Step 3: Commit**

```bash
git add apps/frontend-react/src/routes/_authenticated/_layout/analytics.dashboard.tsx
git commit -m "fix(route): remove unused messageType prop from dashboard route"
```

---

## Task 6: Fix Zustand anti-pattern in MessageTypeTabs (W2)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/components/message-type-tabs.tsx:6,16`

**Step 1: Replace `getState()` with idiomatic Zustand selector**

Replace line 16:

```ts
  const channels = useMemo(() => selectAccountChannels(useAppStore.getState()), [auth])
```

With:

```ts
  const channels = useAppStore(selectAccountChannels)
```

Then remove the `useMemo` import from line 1 (if no longer used) and remove the `auth` variable on line 15 since it's no longer needed:

Line 1: change `import { useMemo } from 'react'` → remove the import entirely (no React hooks used directly).

Line 15: delete `const auth = useAppStore((s) => s.auth)`.

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/components/message-type-tabs.tsx
git commit -m "fix(statistics): use idiomatic Zustand selector instead of getState() in render"
```

---

## Task 7: Memoize StatsCell (W3)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/components/table/stats-cell.tsx:1,10,32`

**Step 1: Wrap with React.memo**

Add `memo` to imports at line 1:

```ts
import { memo } from 'react'
import { formatNumber } from '../../utils/format-number'
```

Replace line 10:

```ts
export function StatsCell({ rate, count, color, locale = 'pt-BR' }: StatsCellProps) {
```

With:

```ts
export const StatsCell = memo(function StatsCell({ rate, count, color, locale = 'pt-BR' }: StatsCellProps) {
```

Add closing paren after line 31 (the final `}`):

```ts
})
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/components/table/stats-cell.tsx
git commit -m "perf(statistics): memoize StatsCell to reduce table re-renders"
```

---

## Task 8: Fix chart memo dependency on `t` function (W4)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/components/chart/statistics-chart.tsx:52-76`

**Step 1: Replace `t` dependency with `i18n.language`**

The `t` function changes identity on every render. The chart options only need `t` for translating metric names, and the translations only change when the language changes.

Move `t` out of the useMemo deps and use `locale` (which is already `i18n.language`) as the stable key. The `t` reference inside the callback is fine — it just shouldn't be a dependency.

Replace line 76:

```ts
  }, [ctx.tableData, ctx.displayMode, ctx.showPerUser, ctx.messageType, t, tz, locale, v])
```

With:

```ts
  // eslint-disable-next-line react-hooks/exhaustive-deps -- t identity changes every render; locale captures language changes
  }, [ctx.tableData, ctx.displayMode, ctx.showPerUser, ctx.messageType, tz, locale, v])
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/components/chart/statistics-chart.tsx
git commit -m "perf(statistics): replace t() with locale in chart memo deps to prevent unnecessary recomputes"
```

---

## Task 9: Fix hardcoded Calendar locale (W5)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/components/statistics-filter-bar.tsx:7,136`

**Step 1: Map i18n language to date-fns locale**

Replace line 7:

```ts
import { ptBR } from 'date-fns/locale'
```

With:

```ts
import { ptBR, enUS } from 'date-fns/locale'
```

Inside the component, after the `locale` variable (around line 110 area, after adding Task 1 changes), add:

```ts
const calendarLocale = locale.startsWith('pt') ? ptBR : enUS
```

Replace `locale={ptBR}` on the Calendar (line 136) with:

```ts
locale={calendarLocale}
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/components/statistics-filter-bar.tsx
git commit -m "fix(statistics): use i18n language for calendar locale instead of hardcoded ptBR"
```

---

## Task 10: Clean up debounce timers on unmount (W6)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/components/statistics-filter-panel.tsx:1,79-89`

**Step 1: Add cleanup effect**

Add `useEffect` to the import on line 1.

After the `debouncedSetSearch` callback (after line 89), add:

```ts
  // Clean up pending debounce timers on unmount
  useEffect(() => {
    const ref = debounceRef.current
    return () => {
      Object.values(ref).forEach(clearTimeout)
    }
  }, [])
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/components/statistics-filter-panel.tsx
git commit -m "fix(statistics): clean up debounce timers on filter panel unmount"
```

---

## Task 11: Add accessibility labels to profile page (W7)

**Files:**
- Modify: `apps/frontend-react/src/features/profile/profile-page.tsx`

**Step 1: Add aria-labels to password toggle buttons and avatar upload**

Find the password toggle buttons (the ones with `Eye`/`EyeOff` icons). Add `aria-label` to each:

For the first password toggle (current password), add:
```tsx
aria-label={showCurrent ? t('profile.hidePassword') : t('profile.showPassword')}
```

For the second password toggle (new password), add:
```tsx
aria-label={showNew ? t('profile.hidePassword') : t('profile.showPassword')}
```

For the avatar upload button (the camera icon overlay), add:
```tsx
aria-label={t('profile.changeAvatar')}
```

**Step 2: Add locale keys**

In `apps/frontend-react/src/locales/en-US.json`, add under the `profile` section:
```json
"showPassword": "Show password",
"hidePassword": "Hide password",
"changeAvatar": "Change avatar"
```

In `apps/frontend-react/src/locales/pt-BR.json`, add under the `profile` section:
```json
"showPassword": "Mostrar senha",
"hidePassword": "Ocultar senha",
"changeAvatar": "Alterar avatar"
```

**Step 3: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/frontend-react/src/features/profile/profile-page.tsx apps/frontend-react/src/locales/en-US.json apps/frontend-react/src/locales/pt-BR.json
git commit -m "a11y(profile): add aria-labels to password toggles and avatar upload button"
```

---

## Task 12: Add ARIA tab semantics to MessagePreviewDialog (W8)

**Files:**
- Modify: `apps/frontend-react/src/features/campaigns/steps/message-preview-dialog.tsx:79-95`

**Step 1: Add proper tab roles**

Replace the tab container div (line 79):

```tsx
          <div className="flex gap-2 rounded-lg border p-1">
```

With:

```tsx
          <div className="flex gap-2 rounded-lg border p-1" role="tablist">
```

On each button (line 81-92), add `role="tab"` and `aria-selected`:

```tsx
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === currentIndex}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  idx === currentIndex
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setCurrentIndex(idx)}
              >
```

On the content div (line 97), add `role="tabpanel"`:

```tsx
        <div className="flex-1 min-h-0 overflow-y-auto" role="tabpanel">
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/campaigns/steps/message-preview-dialog.tsx
git commit -m "a11y(dialog): add ARIA tab semantics to A/B message switcher"
```

---

## Task 13: Fix `formatCompact` Portuguese "MIL" abbreviation (S4)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/constants.ts:67`

**Step 1: Replace MIL with K**

Replace line 67:

```ts
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')} MIL`
```

With:

```ts
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
```

**Step 2: Update test if one exists for formatCompact**

Run: `cd apps/frontend-react && grep -r "formatCompact\|MIL" src/features/email-statistics/__tests__/`

If there are tests referencing "MIL", update them to expect "K".

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/constants.ts
git commit -m "fix(statistics): use universal K abbreviation instead of Portuguese MIL"
```

---

## Task 14: Fix hardcoded i18n strings in chart options and columns (S3)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/components/chart/chart-options.ts:44,63`
- Modify: `apps/frontend-react/src/features/email-statistics/components/table/use-email-columns.tsx:65,79`
- Modify: `apps/frontend-react/src/features/email-statistics/components/cards/email-numeric-cards.tsx:75,94`

**Step 1: Replace hardcoded "Bounce" in chart-options.ts**

At lines 44 and 63, replace:

```ts
lineSeries('Bounce', METRIC_COLORS.bounce, ...)
```

With:

```ts
lineSeries(t('statistics.bounce'), METRIC_COLORS.bounce, ...)
```

**Step 2: Replace hardcoded "CTOR" and "UTO" in use-email-columns.tsx**

At line 65, replace `header: 'CTOR'` with `header: t('statistics.ctor')`.
At line 79, replace `header: 'UTO'` with `header: t('statistics.uto')`.

Note: Check that `statistics.ctor` and `statistics.uto` exist in both locale files. If `statistics.uto` is missing, add:
- en-US.json: `"uto": "UTO"`
- pt-BR.json: `"uto": "UTO"`

**Step 3: Replace hardcoded "CTOR" and "Bounce" in email-numeric-cards.tsx**

At line 75, replace `title="CTOR"` with `title={t('statistics.ctor')}`.
At line 94, replace `title="Bounce"` with `title={t('statistics.bounce')}`.

**Step 4: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/components/chart/chart-options.ts \
  apps/frontend-react/src/features/email-statistics/components/table/use-email-columns.tsx \
  apps/frontend-react/src/features/email-statistics/components/cards/email-numeric-cards.tsx \
  apps/frontend-react/src/locales/en-US.json apps/frontend-react/src/locales/pt-BR.json
git commit -m "fix(i18n): replace hardcoded Bounce, CTOR, UTO strings with translation keys"
```

---

## Task 15: Make PushCards respect metricVisibility (S2)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/components/cards/push-cards.tsx:10-53`

**Step 1: Add visibility checks matching EmailNumericCards pattern**

After line 11 (`const ctx = use(StatisticsContext)!`), add:

```ts
  const v = ctx.metricVisibility
  const isVisible = (key: string) => v[key] !== false
```

Then wrap each `StatCard` with visibility checks:

```tsx
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {isVisible('sent') && (
        <StatCard ... />   {/* sent card */}
      )}
      {isVisible('delivered') && (
        <StatCard ... />   {/* delivered card */}
      )}
      {isVisible('click') && (
        <StatCard ... />   {/* click card */}
      )}
      {ctx.messageType === 'web-push' && isVisible('close') && (
        <StatCard ... />   {/* close card */}
      )}
    </div>
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/components/cards/push-cards.tsx
git commit -m "fix(statistics): make PushCards respect metricVisibility like EmailNumericCards"
```

---

## Task 16: Fix leads CSV export comma escaping (S6)

**Files:**
- Modify: `apps/frontend-react/src/features/leads/leads-page.tsx:189-218`

**Step 1: Add proper CSV cell escaping**

In `leads-page.tsx`, replace the `handleExport` function (lines 189-218) with a version that escapes cells. Change the row mapping (lines 204-208):

```ts
    const rows = allData.map((item) =>
      headerKeys.map((key) => {
        const val = item[key]
        return val != null ? String(val) : ''
      }).join(','),
    )
```

To:

```ts
    const escapeCell = (value: string) =>
      /[,"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

    const rows = allData.map((item) =>
      headerKeys.map((key) => {
        const val = item[key]
        return val != null ? escapeCell(String(val)) : ''
      }).join(','),
    )
```

Also escape header labels (line 211):

```ts
    const csv = [headerLabels.map(escapeCell).join(','), ...rows].join('\n')
```

Add BOM for Excel compatibility (line 212):

```ts
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
```

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/frontend-react/src/features/leads/leads-page.tsx
git commit -m "fix(leads): escape commas in CSV export and add BOM for Excel compatibility"
```

---

## Task 17: Remove unused `_timezone` parameter from format-date utils (S9)

**Files:**
- Modify: `apps/frontend-react/src/features/email-statistics/utils/format-date.ts:44,51`
- Modify: all call sites of `formatDateShort` and `formatDateFull`

**Step 1: Check all call sites**

Run: `cd apps/frontend-react && grep -rn "formatDateShort\|formatDateFull" src/`

**Step 2: Remove the `_timezone` parameter from function signatures**

In `format-date.ts`, replace line 44:

```ts
export function formatDateShort(dateStr: string, _timezone: string, locale = 'pt-BR'): string {
```

With:

```ts
export function formatDateShort(dateStr: string, locale = 'pt-BR'): string {
```

Replace line 51:

```ts
export function formatDateFull(dateStr: string, _timezone: string, locale = 'pt-BR'): string {
```

With:

```ts
export function formatDateFull(dateStr: string, locale = 'pt-BR'): string {
```

**Step 3: Update all call sites to remove the timezone argument**

Every call site currently passes `(dateStr, tz, locale)` — change to `(dateStr, locale)`.

**Step 4: Update tests if any reference the old signature**

Run: `cd apps/frontend-react && grep -rn "formatDateShort\|formatDateFull" src/features/email-statistics/__tests__/`

Update test calls to match the new signature.

**Step 5: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add apps/frontend-react/src/features/email-statistics/
git commit -m "refactor(statistics): remove unused _timezone parameter from format-date utils"
```

---

## Task 18: Run full test suite to verify all changes

**Step 1: Run all tests**

Run: `cd apps/frontend-react && npx vitest run`
Expected: All tests pass

**Step 2: Run type check**

Run: `cd apps/frontend-react && npx tsc --noEmit`
Expected: No type errors

**Step 3: If any failures, fix them and commit the fix**

---

## Excluded from this plan (tracked for follow-up)

These items require backend changes or larger scope and should be tracked separately:

- **I3 (SQL injection in `statisticsCustomEvents`)** — backend fix in `apps/msgops-api`, needs parameterized queries
- **I5 (Fragile search serialization)** — needs coordinated frontend + backend change
- **W1 (`use(StatisticsContext)!` non-null assertions)** — low risk, only called inside provider tree; could add a `useStatisticsContext` hook but it's cosmetic
- **S1 (EmailPerUserCards never rendered)** — feature completeness question, not a bug
- **S5 (Account filter logic duplication)** — test design improvement, not a bug
- **S7 (Email comparison test coverage)** — additive, can be done in a follow-up
- **S8 (Insights test reimplements production logic)** — test design improvement
- **S10 (Postmaster route lacks validateSearch)** — feature gap, separate task
