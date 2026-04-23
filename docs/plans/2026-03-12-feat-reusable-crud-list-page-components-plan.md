---
title: 'feat: Reusable CRUD list page component system'
type: feat
status: completed
date: 2026-03-12
deepened: 2026-03-12
---

# Reusable CRUD List Page Component System

## Enhancement Summary

**Deepened on:** 2026-03-12
**Research agents used:** Vercel React Best Practices, Vercel Composition Patterns, Architecture Strategist, TypeScript Reviewer, Code Simplicity Reviewer, Performance Oracle, Frontend Races Reviewer, Context7 (TanStack Table + TanStack Router docs)

### Key Improvements

1. **Simplified component list** — reduced from 8 shared components to 5 by merging `DataTableColumnHeader` into `DataTable`, removing `DataTableToolbar` (just a div), and removing `DataTableRowActions` (per-feature code using shadcn primitives directly)
2. **Compound component pattern** — `ListPage.Root/Header/Toolbar/Content/Pagination/Empty` instead of slot props, with per-entity providers for data/actions
3. **Concrete TypeScript patterns** — generic `DataTable<TData>`, `Permission` type for permissions (not `string`), `ListSearchParams` exported type, column factories with stable references
4. **Performance guardrails** — `placeholderData: keepPreviousData` for smooth pagination, module-level column constants, `startTransition` for search, debounce cleanup on unmount
5. **Race condition protections** — `AbortSignal` forwarding to axios, search+page reset batched in single navigation, `replace: true` for search updates

### Decisions from Research

- **No `DataTableToolbar`** — a `div` with flexbox is not a component (Simplicity Reviewer)
- **No `DataTableRowActions`** — per-feature code disguised as shared; use shadcn `DropdownMenu` directly (Simplicity Reviewer)
- **Merge `DataTableColumnHeader` into `DataTable`** — default header renderer handles sort icons when `column.getCanSort()` is true (Simplicity Reviewer)
- **Permissions handled at page level** — each page calls `can()` directly, no `ListPagePermissions` interface threaded through shared components (Simplicity Reviewer)
- **No Phase 3** — reusability validates naturally when the next entity is built (Simplicity Reviewer)
- **Create/edit routes are out of scope** — this plan covers list pages only (Simplicity Reviewer)
- **Compound components over slot props** — `ListPage.Header`, `ListPage.Toolbar`, etc. (Composition Patterns)

## Overview

Create a set of shared components and hooks that make building CRUD list pages fast and consistent across the frontend-react app. Most pages being ported from the Vue2 frontend follow the same pattern: a searchable, sortable, paginated data table with row actions (edit, delete). This plan establishes the foundational components that all future CRUD pages will use.

## Problem Statement / Motivation

The app currently has ~20 placeholder routes waiting for real implementations. Almost all of them are CRUD list pages (tags, segments, templates, campaigns, contacts, pools, warmups, custom fields, etc.). Without shared components, each page would re-implement tables, pagination, search, sorting, delete confirmation, URL state, and loading/empty states — leading to inconsistency, duplication, and maintenance burden.

The Vue2 app (`msgops-frontend`) already has a `DataTable.vue` component that handles this, but it's tightly coupled to Vuetify. The React version should be more composable, using TanStack Table + shadcn/ui + TanStack Router search params.

## Proposed Solution

### Architecture: Shared Components + Compound Layout + Feature Hooks

```
src/components/data-table/          ← Reusable across all CRUD pages
  data-table.tsx                    ← Generic table renderer (TanStack Table + shadcn Table)
                                       Includes built-in sortable column headers
  data-table-pagination.tsx         ← Pagination controls (page numbers + page size)
  data-table-search.tsx             ← Debounced search input
  data-table-empty-state.tsx        ← Empty/zero/error states

src/components/list-page.tsx        ← Compound layout: ListPage.Root/Header/Toolbar/Content/Pagination/Empty
src/components/confirm-dialog.tsx   ← Reusable AlertDialog for destructive actions

src/hooks/
  use-list-search-params.ts        ← TanStack Router search params ↔ table state bridge

src/types.ts                        ← PaginatedResponse<T>, PaginationMeta (extend existing)
src/lib/query-keys.ts              ← Extended with per-entity list/detail key factories
```

Each CRUD page then only provides what's unique:

```
src/features/tags/
  tags-page.tsx                    ← Wires shared components via compound layout (~20 lines)
  tags-columns.tsx                 ← Column definitions (name as Link, type, count, actions)
  use-tags.ts                      ← API hooks (useTagsList, useDeleteTag)
  __tests__/
```

### Compound Component Pattern

Instead of slot props on a monolithic `ListPage`, use compound components:

```tsx
// tags-page.tsx — each page is ~20 lines, self-documenting
function TagsPage() {
  return (
    <TagsListProvider>
      <ListPage.Root>
        <ListPage.Header title={t('tags.title')}>{can('audience:tags_create') && <CreateTagButton />}</ListPage.Header>
        <ListPage.Toolbar>
          <DataTableSearch />
        </ListPage.Toolbar>
        <ListPage.Content>
          <DataTable columns={tagColumns} />
        </ListPage.Content>
        <ListPage.Pagination />
        <ListPage.Empty icon={TagIcon} />
      </ListPage.Root>
    </TagsListProvider>
  );
}
```

Each sub-component is a simple wrapper (`ListPage.Header` renders a flex container with title `<h1>` and `{children}` for actions). The `ListPage.Root` just renders `{children}` — no conditionals.

### Per-Entity Provider

Each entity page gets a provider that implements a shared context interface:

```typescript
interface ListPageContextValue<TData> {
  state: {
    data: TData[];
    isLoading: boolean;
    isFetching: boolean;
    isEmpty: boolean;
    totalRows: number;
  };
  table: {
    pagination: PaginationState;
    sorting: SortingState;
    setPagination: (updater: Updater<PaginationState>) => void;
    setSorting: (updater: Updater<SortingState>) => void;
  };
  search: {
    value: string;
    set: (value: string) => void;
  };
  meta: {
    entityName: string; // "tag"
    entityNamePlural: string; // "tags"
    basePath: string; // "/tags"
  };
}
```

Sub-components read from context — `ListPage.Pagination` reads pagination state, `ListPage.Empty` uses `meta.entityNamePlural` for default messages. Swapping the provider swaps the data source; the UI components work unchanged.

### Key Technology Choices

| Concern       | Choice                                                           | Rationale                                                      |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Table logic   | `@tanstack/react-table`                                          | Headless, server-side pagination/sorting, industry standard    |
| URL state     | TanStack Router `searchParams` + `validateSearch` with zod       | Already installed, idiomatic, type-safe, no extra dependency   |
| Table UI      | shadcn `table` component                                         | Consistent with existing UI system                             |
| Delete dialog | shadcn `alert-dialog` (Radix AlertDialog)                        | Proper a11y for destructive actions (focus trap, Esc behavior) |
| Pagination UI | shadcn `pagination`                                              | Consistent with existing UI system                             |
| Data fetching | `@tanstack/react-query` with `placeholderData: keepPreviousData` | Smooth pagination transitions                                  |

## Technical Considerations

### URL State with TanStack Router Search Params

Use `validateSearch` with a zod schema on each route. From TanStack Router docs, the idiomatic pattern:

```typescript
// src/hooks/use-list-search-params.ts
import { z } from 'zod';

export const listSearchSchema = z.object({
  page: z.number().int().positive().default(1).catch(1),
  pageSize: z.number().int().positive().default(20).catch(20),
  search: z.string().default('').catch(''),
  sort: z.string().default('').catch(''),
  order: z.enum(['asc', 'desc']).default('asc').catch('asc'),
});

export type ListSearchParams = z.infer<typeof listSearchSchema>;
```

The `.catch()` calls handle invalid URL params gracefully — if someone types `?page=abc`, it falls back to the default silently.

**Route definition** (from Context7 TanStack Router docs):

```typescript
// src/routes/_authenticated/_layout/tags/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';

export const Route = createFileRoute('/_authenticated/_layout/tags/')({
  validateSearch: listSearchSchema,
  component: TagsPage,
});
```

**Extending for per-entity custom filters:**

```typescript
// Entities with extra filters extend the base schema
const contactsSearchSchema = listSearchSchema.extend({
  tagId: z.number().optional().catch(undefined),
  status: z.enum(['active', 'inactive']).optional().catch(undefined),
});
```

All filter state must live in URL search params — never store filter values in Zustand while the rest lives in the URL.

**The `useListSearchParams()` hook** bridges TanStack Router search params with TanStack Table's state format:

```typescript
interface UseListSearchParamsReturn {
  // For TanStack Table state (note: pageIndex is 0-based, page in URL is 1-based)
  pagination: PaginationState; // { pageIndex: number; pageSize: number }
  sorting: SortingState; // { id: string; desc: boolean }[]

  // For API query params (1-based page)
  searchParams: ListSearchParams; // { page, pageSize, search, sort, order }

  // Setters (update URL → triggers re-render → TanStack Query refetches)
  setPagination: (updater: Updater<PaginationState>) => void;
  setSorting: (updater: Updater<SortingState>) => void;
  setSearch: (value: string) => void; // debounced 300ms, resets page to 1
}
```

**Critical: 0-based vs 1-based page index.** TanStack Table uses `pageIndex: 0`, URLs show `page=1`. The hook handles this conversion internally. Document and test this boundary carefully.

**Updating search params** (from Context7 TanStack Router docs):

```typescript
const navigate = useNavigate({ from: Route.fullPath });

// Use replace: true for search/sort to avoid polluting browser history
navigate({
  search: (prev) => ({ ...prev, search: value, page: 1 }),
  replace: true,
});
```

### Research Insights: URL State

**Race condition protection — batch search + page reset:**
The debounced search must reset page to 1 _inside_ the debounce callback, not outside. If page reset happens immediately but search updates after 300ms, there's a brief flash of page-1 results for the old search term. Both must update in a single `navigate()` call.

**Use `startTransition` for search updates** so typing remains responsive while the table refetches:

```typescript
const handleSearch = (value: string) => {
  startTransition(() => {
    navigate({ search: (prev) => ({ ...prev, search: value, page: 1 }), replace: true });
  });
};
```

**Debounce cleanup on unmount:**

```typescript
useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);
```

### Server-Side Table Configuration

From TanStack Table docs, the canonical controlled-state pattern for server-side operations:

```typescript
const table = useReactTable({
  columns,
  data: query.data?.data ?? EMPTY_ARRAY,
  rowCount: query.data?.meta.total ?? 0,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  manualSorting: true,
  state: { pagination, sorting },
  onPaginationChange: setPagination,
  onSortingChange: setSorting,
});
```

**Important:** Use a module-level `const EMPTY_ARRAY: never[] = []` as the default for `data` to avoid creating a new array reference on every render.

### API Response Contract

Place in `src/types.ts` alongside other shared types:

```typescript
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
```

**Drop `totalPages`** from the contract — it's derivable from `Math.ceil(total / pageSize)` and having both sources of truth risks inconsistency.

**Typed fetcher pattern** — use the axios generic to avoid `any` leaking through:

```typescript
async function fetchTagsList(params: ListSearchParams, signal?: AbortSignal): Promise<PaginatedResponse<Tag>> {
  const { data } = await apiClient.get<PaginatedResponse<Tag>>('/tags', { params, signal });
  return data;
}
```

**Forward `AbortSignal`** from TanStack Query to axios for proper request cancellation on rapid search/pagination:

```typescript
useQuery({
  queryKey: queryKeys.tags.list(accountId, searchParams),
  queryFn: ({ signal }) => fetchTagsList(searchParams, signal),
  placeholderData: keepPreviousData,
});
```

### Delete Confirmation

Uses Radix AlertDialog (not Dialog) — critical distinction for a11y:

- Focus moves to Cancel button on open (not the destructive Confirm button)
- Esc closes without confirming
- Cannot dismiss by clicking outside (prevents accidental closure)
- Focus returns to trigger element on close

The `ConfirmDialog` component accepts `open`, `onOpenChange`, `title`, `description`, `onConfirm`, `loading`, and optional `variant` (destructive by default).

**On delete failure:** dialog stays open, error toast shown, confirm button re-enabled for retry.

**Edge case — last item on page:** After deletion, if the refetch returns an empty page and `page > 1`, auto-navigate to `page - 1`.

### Pagination

Custom pagination component showing:

- Previous / Next buttons (disabled at boundaries)
- Window of 5 page numbers with ellipsis for large page counts
- Page size selector: [10, 20, 40, 100], default 20
- "Showing X–Y of Z" results text

Page window algorithm: always show first/last page, with ellipsis when gap > 1. Current page stays centered in the window when possible.

**Memoize the page window array** with `useMemo` on `currentPage` and `totalPages` — not for computation cost (it's O(1)), but for referential stability of the array to prevent unnecessary child re-renders.

### Loading & Empty States

Distinct states handled by `DataTable` and `DataTableEmptyState`:

1. **Initial load** (`isLoading`): Full skeleton rows in table area. Header/search visible.
2. **Refetching** (`isFetching && !isLoading`): Keep previous data visible via `placeholderData: keepPreviousData`. Subtle loading indicator (opacity reduction or top progress bar). This is the single biggest perceived-performance improvement for paginated tables.
3. **Empty — zero items exist**: "Create your first [entity]" with CTA button. Uses `meta.entityNamePlural` from context.
4. **Empty — search/filter has no results**: "No [entities] match your search" with "Clear search" action.
5. **Error**: Error message with "Try again" button.

Loading skeleton and error states belong in `DataTable`. The `DataTableEmptyState` only handles cases 3 and 4.

### Permissions

Handled at the page level — each page calls `can()` directly where needed. Column definitions conditionally include/exclude action buttons. The "Create" button in `ListPage.Header` is wrapped in a permission check by the consuming page.

This keeps shared components permission-unaware and simple. Permissions stay close to the feature code.

### Account Context

The API client interceptor already injects `Account-Id` header from the Zustand store. List queries must include the account ID in their query key so that switching accounts triggers a refetch.

**Query key factory pattern** (extend existing `src/lib/query-keys.ts`):

```typescript
export const queryKeys = {
  // ... existing keys ...
  tags: {
    all: ['tags'] as const,
    list: (accountId: number, params: ListSearchParams) => ['tags', 'list', { accountId, ...params }] as const,
    detail: (accountId: number, id: number) => ['tags', 'detail', { accountId, id }] as const,
  },
} as const;
```

The `all` key is important for bulk invalidation — after delete, invalidate `queryKeys.tags.all` to cover both list and detail caches.

### Column Definitions

**Define static columns as module-level constants** to avoid re-creating the array on every render (TanStack Table uses referential equality checks):

```typescript
// tags-columns.tsx
const staticColumns: ColumnDef<Tag>[] = [
  {
    accessorKey: 'name', // type-checked against Tag — 'nme' would be a compile error
    header: 'Name',
    cell: ({ row }) => (
      <Link to="/tags/$id" params={{ id: row.original.id.toString() }}>
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: 'type', header: 'Type' },
]

// When columns need runtime callbacks (delete, edit), use a factory with useMemo
export function useTagsColumns(options: {
  onDelete: (tag: Tag) => void
}): ColumnDef<Tag>[] {
  return useMemo(
    () => [
      ...staticColumns,
      {
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <Link to="/tags/$id" params={{ id: row.original.id.toString() }}>
                  {t('common.edit')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => options.onDelete(row.original)}>
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [options.onDelete],
  )
}
```

Row actions use shadcn `DropdownMenu` directly — no generic wrapper component. Each entity defines its own actions, which is inherently per-feature code.

### Route Structure

Converting from flat file routes to directory routes is a prerequisite migration step per entity. Delete the existing `tags.tsx` placeholder and create:

```
src/routes/_authenticated/_layout/
  tags/
    index.tsx          ← List page (defines validateSearch with listSearchSchema)
```

Create/edit routes (`tags/new.tsx`, `tags/$id/edit.tsx`) are out of scope for this plan — they belong in a separate plan when form pages are needed.

### Research Insights: Performance

**Import each component directly** — never create barrel `index.ts` files that re-export:

```typescript
// Wrong: triggers tree-shaking issues
import { DataTable, DataTablePagination } from '@/components/data-table';

// Right: direct imports
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
```

**Memoize per-row components** — `memo()` cell renderers that render complex content (badges, dropdowns). DataTable itself does not need `memo` since it re-renders when data changes.

**Hoist default prop values for memoized components:**

```typescript
const EMPTY_ACTIONS: RowAction[] = []
const MyComponent = memo(function MyComponent({ actions = EMPTY_ACTIONS }: Props) { ... })
```

**Derive computed values, do not store them** — in `useListSearchParams`, derive TanStack Table state during render from URL search params via `useMemo`, not `useState` + `useEffect` sync.

**Optional future optimization — prefetch next page on hover:**

```typescript
queryClient.prefetchQuery({
  queryKey: queryKeys.tags.list(accountId, { ...params, page: page + 1 }),
  queryFn: () => fetchTags({ ...params, page: page + 1 }),
});
```

## Acceptance Criteria

### Shared Components

- [x] `DataTable` renders a table with built-in sortable column headers, row content, loading skeleton, and error state
- [x] `DataTablePagination` shows prev/next, page numbers (window of 5), page size selector, results count
- [x] `DataTableSearch` provides debounced search input (300ms) with `startTransition`, updates URL and resets page to 1
- [x] `DataTableEmptyState` distinguishes zero-state (no items) from no-results-state (search empty)
- [x] `ListPage` compound components: `Root`, `Header`, `Toolbar`, `Content`, `Pagination`, `Empty`
- [x] `ConfirmDialog` opens with focus on Cancel, supports Esc, shows loading during mutation

### URL State

- [x] Search, page, pageSize, sort, order are persisted to URL query string
- [x] Browser back/forward restores previous list state
- [x] Shared URLs reproduce the same list state for recipients
- [x] Invalid URL params fall back to defaults silently (via zod `.catch()`)
- [x] Changing search resets page to 1
- [x] Changing sort resets page to 1
- [x] Changing page size resets page to 1

### Data Flow

- [x] Table uses server-side pagination and sorting (`manualPagination`, `manualSorting`)
- [x] Query keys include account ID and all search params (proper cache isolation)
- [x] `placeholderData: keepPreviousData` for smooth pagination transitions
- [x] `AbortSignal` forwarded to axios for request cancellation on rapid interaction
- [x] Loading state: skeleton on initial load, subtle indicator on refetch
- [x] Error state: shown with retry action
- [x] Delete success: list query invalidated via `queryKeys.<entity>.all`, toast shown
- [x] Delete failure: dialog stays open, error toast, button re-enabled
- [x] Delete last item on page: auto-navigate to previous page

### Customizability Per Page

- [x] Column definitions are per-feature (module-level constants + `useMemo` for action columns)
- [x] Custom filters can be added to `ListPage.Toolbar` via React children
- [x] Row actions use shadcn `DropdownMenu` directly in column definitions (per-feature)
- [x] First column renders as a Link to the edit page
- [x] Permissions checked at page level via existing `can()` hook

### Testing

- [x] Unit tests for `useListSearchParams` hook (state ↔ URL conversion, defaults, 0-based/1-based page, invalid params)
- [x] Unit tests for `DataTablePagination` (page window calculation, boundary conditions)
- [x] Component tests for `ConfirmDialog` (focus management, keyboard navigation)
- [x] Component tests for `DataTable` (renders columns, sorting indicators, empty states)

### Libraries to Install

- [x] `@tanstack/react-table` — headless table
- [x] shadcn `table` — table UI primitives (`npx shadcn@latest add table`)
- [x] shadcn `alert-dialog` — delete confirmation (`npx shadcn@latest add alert-dialog`)
- [x] shadcn `pagination` — pagination primitives (`npx shadcn@latest add pagination`)
- [x] shadcn `badge` — status indicators (`npx shadcn@latest add badge`)

## Implementation Tasks

### Phase 1: Shared components + hooks + Tags reference page

Build shared components and the Tags page together iteratively — every component is validated against a real use case immediately.

1. ~~**Install dependencies** — TanStack Table, shadcn table/alert-dialog/pagination/badge~~ ✅
2. ~~**`PaginatedResponse<T>` and `PaginationMeta`** — add to `src/types.ts`~~ ✅
3. ~~**`listSearchSchema` and `useListSearchParams` hook** — zod schema, URL ↔ TanStack Table state bridge, debounced search with cleanup~~ ✅
4. ~~**`DataTable` component** — generic table with TanStack Table, built-in sortable column headers with sort indicators, loading skeleton, error state~~ ✅
5. ~~**`DataTablePagination` component** — page numbers (window of 5), prev/next, page size selector, results count, memoized page window~~ ✅
6. ~~**`DataTableSearch` component** — debounced search input with `startTransition`, local input state for instant feedback~~ ✅
7. ~~**`DataTableEmptyState` component** — zero-state vs no-results-state, uses context `meta` for default messages~~ ✅
8. ~~**`ListPage` compound components** — `Root`, `Header`, `Toolbar`, `Content`, `Pagination`, `Empty`, with `ListPageContext`~~ ✅
9. ~~**`ConfirmDialog` component** — AlertDialog with focus on Cancel, loading state, retry on failure~~ ✅
10. ~~**Extend `queryKeys`** — add `tags.all`, `tags.list(accountId, params)`, `tags.detail(accountId, id)`~~ ✅
11. ~~**Tags route** — convert `tags.tsx` to `tags/index.tsx` with `validateSearch`~~ ✅
12. ~~**`use-tags.ts`** — `useTagsList` (useQuery with `placeholderData: keepPreviousData`, `signal` forwarding) + `useDeleteTag` (useMutation)~~ ✅
13. ~~**`tags-columns.tsx`** — module-level static columns + `useTagsColumns` factory with `useMemo` for action column~~ ✅
14. ~~**`tags-page.tsx`** — `TagsListProvider` + compound layout wiring (~20 lines)~~ ✅
15. ~~**Add i18n keys** — CRUD list translation keys in both `pt-BR.json` and `en-US.json`~~ ✅
16. ~~**Unit + component tests** for all shared components, hooks, and tags page~~ ✅

## Dependencies & Risks

| Risk                                            | Mitigation                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| API response format varies per entity           | Define `PaginatedResponse<T>` contract; adapt in per-feature hooks if needed                 |
| Some entities need custom filters beyond search | Extend `listSearchSchema` with `.extend()` for per-entity params; all filter state in URL    |
| TanStack Table learning curve                   | Start with simplest config (pagination + sorting only); avoid advanced features until needed |
| Delete permissions not yet in backend           | Use existing `create` permission for V1; add granular permissions later                      |
| Column definitions re-created on every render   | Static columns as module-level constants; action columns via `useMemo`                       |
| Race conditions from rapid interaction          | `AbortSignal` forwarding, debounce cleanup, batched URL updates                              |
| Multiple tables on same page (future)           | Currently assumes single table per page; namespace search params if multi-table needed later |

## Success Metrics

- A new CRUD list page can be created with ~20 lines of feature-specific page wiring + columns file + API hooks
- All list pages share the same URL state, pagination, search, and delete UX
- Changes to shared components (e.g., pagination design) propagate to all pages automatically
- Smooth pagination: no skeleton flash between pages (keepPreviousData)

## Sources & References

### Internal References

- Vue2 DataTable: `msgops-frontend/src/components/data-table/DataTable.vue`
- Vue2 Tags list page: `msgops-frontend/src/modules/tags/views/Tags.vue`
- Vue2 Pagination model: `msgops-frontend/src/models/pagination.ts`
- Existing query keys: `apps/frontend-react/src/lib/query-keys.ts`
- Existing API client: `apps/frontend-react/src/lib/api-client.ts`
- Permissions hook: `apps/frontend-react/src/hooks/use-permissions.ts`
- Shared types: `apps/frontend-react/src/types.ts`
- Route structure: `apps/frontend-react/src/routes/_authenticated/_layout/`

### External References

- [TanStack Table — Server-Side Pagination](https://tanstack.com/table/v8/docs/guide/pagination)
- [TanStack Table — Controlled State](https://tanstack.com/table/latest/docs/framework/react/guide/table-state)
- [TanStack Table — Manual Sorting](https://tanstack.com/table/latest/docs/guide/sorting)
- [TanStack Router — Search Params with Zod](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)
- [TanStack Router — useNavigate with search](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)
- [shadcn/ui — Data Table](https://ui.shadcn.com/docs/components/radix/data-table)
- [shadcn/ui — AlertDialog](https://ui.shadcn.com/docs/components/radix/alert-dialog)
- [Radix AlertDialog a11y](https://www.radix-ui.com/primitives/docs/components/alert-dialog)

### Research Agents

- Vercel React Best Practices — barrel import avoidance, `memo()` per-row components, `startTransition` for search, derived state via `useMemo`
- Vercel Composition Patterns — compound components, per-entity providers, explicit page variants
- Architecture Strategist — route migration, schema extension pattern, `AbortSignal` forwarding, query key factory with `all` key
- TypeScript Reviewer — `Permission` type for permissions, `PaginationMeta` extraction, `ListSearchParams` export, column factory patterns
- Code Simplicity Reviewer — removed 3 unnecessary components, removed `ListPagePermissions` interface, collapsed phases, removed create/edit from scope
- Performance Oracle — `keepPreviousData`, module-level columns, page window memoization, debounce cleanup, next-page prefetch (future)
