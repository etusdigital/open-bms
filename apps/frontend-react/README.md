# MsgOps Frontend React

React frontend for the MsgOps platform, built with Vite, TanStack Router (file-based routing), TanStack Query, TanStack Table, and shadcn/ui.

## Getting Started

```bash
pnpm install
pnpm --filter @msgops/frontend-react dev
```

---

## Auth (local default, Auth0 opt-in)

The app supports two auth providers, selected by `VITE_AUTH_PROVIDER`:

| Mode              | When                                          | What runs                                                                                                      |
| ----------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `local` (default) | Self-hosted instances.                        | Email + password against `POST /auth/login`. Refresh via httpOnly cookie `bms_refresh`. Token stays in memory. |
| `auth0`           | Hosted Etus tenant or any IdP-fronted deploy. | `@auth0/auth0-react` SDK with redirect flow.                                                                   |

**The flag MUST match the backend's `AUTH_PROVIDER`** (`apps/msgops-api`). A mismatched front + back returns 410 / 403 from the auth endpoints and the login form silently fails.

### Local mode (default)

```bash
# .env
VITE_AUTH_PROVIDER=local
VITE_API_URL=http://localhost:5001
```

The first admin is created either by the **setup wizard** (see below) on first boot, or via `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` on the backend.

### Auth0 mode

```bash
# .env
VITE_AUTH_PROVIDER=auth0
VITE_AUTH0_DOMAIN=<tenant>.us.auth0.com
VITE_AUTH0_CLIENT_ID=<spa-client-id>
VITE_AUTH0_AUDIENCE=<api-audience>
VITE_API_URL=http://localhost:5001
```

In local mode the Auth0 SDK is **not** included in the entry chunk (Vite DCE removes the `if (VITE_AUTH_PROVIDER === 'auth0')` branch). To verify:

```bash
VITE_AUTH_PROVIDER=local pnpm --filter @msgops/frontend-react build
grep -E "@auth0/auth0-react|auth0-spa-js" dist/assets/index-*.js  # should print nothing
```

### Critical paths (auth)

- `src/features/auth/use-auth.ts` — drop-in `useAuth0` API; token in memory, single-flight `refresh()`, `bootstrapAuth()` for hard reload
- `src/features/auth/auth0-adapter.tsx` — bridge mounted only when `VITE_AUTH_PROVIDER=auth0`
- `src/lib/api-client.ts` — singleton axios; 401 → refresh → retry; redirects to `/login?returnTo=…` when refresh fails
- `src/hooks/use-auth-init.ts` — fetches `/users/me` + `/accounts/configs` and hydrates the Zustand store
- `src/routes/login.tsx` — local form (or Auth0 redirect in `auth0` mode)
- `src/routes/_authenticated.tsx` — protected layout guard

---

## Setup wizard

On first boot, `GET /setup/status` returns `{ configured: false, currentStep: N }`. The router gate in `src/main.tsx` (`applySetupGate`) redirects any path → `/setup` until the wizard finishes. After completion, `/setup` redirects back to `/`.

The wizard has 6 steps, each persisted server-side (idempotent: re-entering a step ≤ `currentStep` is a no-op):

1. **Admin** — create the first super-admin (auto-logs in immediately)
2. **SMTP** — host / port / from + a "send test email" button
3. **Domain** — `baseUrl` used by webhook URLs and email links
4. **SendGrid** — API key + subuser config (skippable; pre-fills webhook URL from step 3)
5. **IP Pool** — first account + IP pool (skippable)
6. **Health Check** — probes Postgres / Redis / ClickHouse / RabbitMQ / S3 / SMTP; can complete with failing services after explicit confirmation

### Critical paths (setup)

- `src/features/setup/setup-gateway.ts` — **isolated axios instance** (no auth interceptor) for `/setup/*`
- `src/features/setup/setup.types.ts` — TS types mirroring `apps/msgops-api/.../advance-step.dto.ts`
- `src/features/setup/steps/Step{1..6}*.tsx` — one component per step
- `src/routes/setup.tsx` — standalone layout (no header/sidebar)
- `src/main.tsx::applySetupGate()` — pre-mount redirect logic

---

## Creating a New CRUD Feature

Each CRUD entity follows the same patterns. Use Tags as the reference implementation.

### File Structure

```
src/features/<entity>/
  types.ts                 # Entity TypeScript interface
  <entity>-schema.ts       # Zod validation schema + max length constants
  <entity>-columns.tsx     # TanStack Table column definitions
  <entity>-page.tsx        # List page component
  <entity>-form.tsx        # Form component (shared create & edit)
  <entity>-form-page.tsx   # Form page component (orchestrates query + mutation + form)
  use-<entity>.ts          # API hooks (list, detail, create, update, delete)
  __tests__/               # Tests

src/routes/_authenticated/_layout/<entity>/
  index.tsx                # List route
  create.tsx               # Create route
  $<entity>Id.tsx          # Edit route
```

---

## Part 1: List Page

### 1. Define the Entity Type

Create `src/features/<entity>/types.ts`:

```ts
export interface CustomField {
  id: number;
  name: string;
  type: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### 2. Create the API Hook

Create `src/features/<entity>/use-custom-fields.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { toPaginatedResponse, type PaginatedResponse, type RawPaginatedResponse } from '@/types';
import type { ListSearchParams } from '@/hooks/use-list-search-params';
import type { CustomField } from './types';
import type { CustomFieldFormValues } from './custom-field-schema';
import { toast } from 'sonner';
import i18n from '@/lib/i18n';

async function fetchList(params: ListSearchParams, signal?: AbortSignal): Promise<PaginatedResponse<CustomField>> {
  const { data } = await apiClient.get<RawPaginatedResponse<CustomField>>('/custom-fields', {
    params: {
      page: params.page,
      itemsPerPage: params.pageSize,
      ...(params.search && { title: params.search }),
      ...(params.sort && { sort: params.sort, order: params.order }),
    },
    signal,
  });
  return toPaginatedResponse(data);
}

export function useCustomFieldsList(params: ListSearchParams) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.customFields.list(accountId, params),
    queryFn: ({ signal }) => fetchList(params, signal),
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

export function useCustomField(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.customFields.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<CustomField>(`/custom-fields/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CustomFieldFormValues) => {
      const { data: result } = await apiClient.post<CustomField>('/custom-fields', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customFields.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('customFields.entityName') }));
    },
    onError: (error) => {
      const apiMessage =
        isAxiosError(error) && typeof error.response?.data?.error === 'string' ? error.response.data.error : null;
      toast.error(apiMessage ?? i18n.t('common.createError', { entity: i18n.t('customFields.entityName') }));
    },
  });
}

export function useUpdateCustomField(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CustomFieldFormValues) => {
      const { data: result } = await apiClient.put<CustomField>(`/custom-fields/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customFields.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('customFields.entityName') }));
    },
    onError: (error) => {
      const apiMessage =
        isAxiosError(error) && typeof error.response?.data?.error === 'string' ? error.response.data.error : null;
      toast.error(apiMessage ?? i18n.t('common.updateError', { entity: i18n.t('customFields.entityName') }));
    },
  });
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/custom-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customFields.all });
      toast.success(i18n.t('common.deleteSuccess', { entity: i18n.t('customFields.entityName') }));
    },
    onError: (error) => {
      const apiMessage =
        isAxiosError(error) && typeof error.response?.data?.error === 'string' ? error.response.data.error : null;
      toast.error(apiMessage ?? i18n.t('common.deleteError', { entity: i18n.t('customFields.entityName') }));
    },
  });
}
```

**Important:** The backend returns `{ results, totalItems, page, itemsPerPage }`. Always use `toPaginatedResponse()` from `@/types` to normalize it to `{ data, meta: { total, page, pageSize } }`.

### 3. Define Columns

Create `src/features/<entity>/custom-fields-columns.tsx`:

```tsx
import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CustomField } from './types';

// Define columns outside the hook to avoid re-renders
const staticColumns: ColumnDef<CustomField, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'customFields.name', // translation key, resolved in the hook
    enableSorting: true,
    cell: ({ row }) => (
      <Link
        to="/custom-fields/$id"
        params={{ id: String(row.original.id) }}
        className="text-primary font-medium hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: 'type',
    header: 'customFields.type',
  },
];

interface UseColumnsOptions {
  onDelete: (item: CustomField) => void;
  canDelete: boolean;
}

export function useCustomFieldsColumns({ onDelete, canDelete }: UseColumnsOptions): ColumnDef<CustomField, unknown>[] {
  const { t } = useTranslation();

  return useMemo(() => {
    const translated = staticColumns.map((col) => ({
      ...col,
      header: typeof col.header === 'string' ? t(col.header) : col.header,
    }));

    return [
      ...translated,
      {
        id: 'actions',
        cell: ({ row }) => {
          const editLabel = t('common.edit');
          const deleteLabel = t('common.deleteEntity', {
            entity: t('customFields.entityName'),
          });

          return (
            <div className="flex justify-end gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-xs" asChild>
                      <Link to="/custom-fields/$id" params={{ id: String(row.original.id) }}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">{editLabel}</span>
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{editLabel}</TooltipContent>
                </Tooltip>

                {canDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(row.original)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">{deleteLabel}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{deleteLabel}</TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
            </div>
          );
        },
      },
    ];
  }, [t, onDelete, canDelete]);
}
```

**Tips:**

- Define `staticColumns` outside the hook to prevent TanStack Table re-renders.
- Use translation keys as `header` strings, then resolve them inside the hook with `t()`.
- For the delete tooltip, use the entity type name (e.g., "Delete tag"), not the item's name.
- For 2 actions, use inline icon buttons with tooltips. Only use a kebab menu (dropdown) if there are 3+ actions.

### 4. Build the List Page Component

Create `src/features/<entity>/custom-fields-page.tsx`:

```tsx
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { LayoutList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { useCustomFieldsList, useDeleteCustomField } from './use-custom-fields';
import { useCustomFieldsColumns } from './custom-fields-columns';
import type { CustomField } from './types';

const EMPTY_ARRAY: CustomField[] = [];

interface Props {
  searchParams: ListSearchParams;
}

export default function CustomFieldsPage({ searchParams }: Props) {
  const { t } = useTranslation();

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useCustomFieldsList(searchParams);
  const deleteMutation = useDeleteCustomField();

  const [deleteTarget, setDeleteTarget] = useState<CustomField | null>(null);

  const handleDelete = useCallback((item: CustomField) => {
    setDeleteTarget(item);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        const data = query.data?.data ?? [];
        if (data.length === 1 && searchParams.page > 1) {
          setPagination((prev) => ({ ...prev, pageIndex: prev.pageIndex - 1 }));
        }
      },
    });
  }, [deleteTarget, deleteMutation, query.data?.data, searchParams.page, setPagination]);

  const columns = useCustomFieldsColumns({ onDelete: handleDelete, canDelete: true });

  const data = query.data?.data ?? EMPTY_ARRAY;
  const totalRows = query.data?.meta.total ?? 0;
  const totalPages = Math.ceil(totalRows / searchParams.pageSize);

  const table = useReactTable({
    columns,
    data,
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const isEmpty = !query.isLoading && data.length === 0;

  return (
    <>
      <ListPage.Root>
        <ListPage.Header title={t('customFields.title')}>
          <Button size="sm" asChild>
            <Link to="/custom-fields/create">
              <Plus className="mr-1 h-4 w-4" />
              {t('customFields.create')}
            </Link>
          </Button>
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('customFields.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={LayoutList}
            />
          </ListPage.Empty>
        ) : (
          <>
            <ListPage.Content>
              <DataTable
                columns={columns}
                table={table}
                isLoading={query.isLoading}
                isFetching={query.isFetching}
                error={query.error}
                onRetry={() => query.refetch()}
              />
            </ListPage.Content>

            <ListPage.Pagination>
              <DataTablePagination
                currentPage={searchParams.page}
                totalPages={totalPages}
                pageSize={searchParams.pageSize}
                totalRows={totalRows}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))}
                onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
              />
            </ListPage.Pagination>
          </>
        )}
      </ListPage.Root>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('common.deleteConfirmTitle', { entity: t('customFields.entityName') })}
        description={t('common.deleteConfirmMessage', { name: deleteTarget?.name ?? '' })}
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
```

### 5. Create the List Route

Create `src/routes/_authenticated/_layout/custom-fields/index.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import CustomFieldsPage from '@/features/custom-fields/custom-fields-page';

export const Route = createFileRoute('/_authenticated/_layout/custom-fields/')({
  validateSearch: listSearchSchema,
  component: CustomFieldsRoute,
});

function CustomFieldsRoute() {
  const searchParams = Route.useSearch();
  return <CustomFieldsPage searchParams={searchParams} />;
}
```

This gives you URL-persisted state for free. All pagination, search, and sorting changes update the query string and support browser back/forward navigation.

---

## Part 2: Create/Edit Form Pages

### 6. Create the Validation Schema

Create `src/features/<entity>/custom-field-schema.ts`:

```ts
import { z } from 'zod';

export const CUSTOM_FIELD_NAME_MAX = 40;
export const CUSTOM_FIELD_DESCRIPTION_MAX = 500;

export const customFieldFormSchema = z.object({
  name: z
    .string()
    .min(1, 'validation.required')
    .max(CUSTOM_FIELD_NAME_MAX, `validation.maxLength::${CUSTOM_FIELD_NAME_MAX}`),
  description: z
    .string()
    .max(CUSTOM_FIELD_DESCRIPTION_MAX, `validation.maxLength::${CUSTOM_FIELD_DESCRIPTION_MAX}`)
    .optional()
    .default(''),
  // Add entity-specific fields here:
  // type: z.string().min(1, 'validation.required'),
});

export type CustomFieldFormValues = z.infer<typeof customFieldFormSchema>;
```

**Conventions:**

- Export max length constants — used in both schema and form for `maxLength` + character counters.
- Use `'validation.required'` and `'validation.maxLength::N'` i18n keys — `FormMessage` auto-translates them.
- Name field: `max(40)` is the default for all entities.
- Description field: `max(500)`, optional with empty string default.

### 7. Create the Form Component

Create `src/features/<entity>/custom-field-form.tsx`:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import {
  customFieldFormSchema,
  CUSTOM_FIELD_NAME_MAX,
  CUSTOM_FIELD_DESCRIPTION_MAX,
  type CustomFieldFormValues,
} from './custom-field-schema';

interface CustomFieldFormProps {
  defaultValues?: CustomFieldFormValues;
  onSubmit: (data: CustomFieldFormValues) => void;
  isPending: boolean;
}

export function CustomFieldForm({ defaultValues, onSubmit, isPending }: CustomFieldFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<CustomFieldFormValues>({
    resolver: zodResolver(customFieldFormSchema),
    defaultValues: defaultValues ?? { name: '', description: '' },
  });

  const nameLength = form.watch('name')?.length ?? 0;
  const descriptionLength = form.watch('description')?.length ?? 0;

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t('customFields.name')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', { count: nameLength, max: CUSTOM_FIELD_NAME_MAX })}
                  </span>
                </div>
                <FormControl>
                  <Input {...field} maxLength={CUSTOM_FIELD_NAME_MAX} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t('customFields.description')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', { count: descriptionLength, max: CUSTOM_FIELD_DESCRIPTION_MAX })}
                  </span>
                </div>
                <FormControl>
                  <Textarea rows={3} {...field} maxLength={CUSTOM_FIELD_DESCRIPTION_MAX} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Add entity-specific fields here */}

          {form.formState.errors.root?.serverError && (
            <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {form.formState.errors.root.serverError.message}
            </div>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}
```

**Key patterns:**

- Single component for create & edit — detect mode via `defaultValues` presence.
- `UnsavedChangesDialog` blocks navigation when form is dirty, disabled during submission so post-submit redirect works.
- `maxLength` on inputs hard-caps typing + character counter shows `count/max`.
- Server errors render inline via `form.formState.errors.root?.serverError`.
- Submit button shows "Create" / "Save" / "Loading..." based on mode and state.

### 8. Create the Form Page Component

Create `src/features/<entity>/custom-field-form-page.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { CustomFieldForm } from './custom-field-form';
import { useCustomField, useCreateCustomField, useUpdateCustomField } from './use-custom-fields';
import type { CustomFieldFormValues } from './custom-field-schema';

interface CustomFieldFormPageProps {
  customFieldId?: number;
}

export function CustomFieldFormPage({ customFieldId }: CustomFieldFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = customFieldId !== undefined;

  const query = useCustomField(isEditing ? customFieldId : 0);
  const createMutation = useCreateCustomField();
  const updateMutation = useUpdateCustomField(customFieldId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: CustomFieldFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/custom-fields' });
      },
    });
  };

  // Loading skeleton while fetching entity for edit
  if (isEditing && query.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('customFields.edit')} backTo="/custom-fields" backLabel={t('customFields.title')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  // Error state (404 / fetch error)
  if (isEditing && query.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('customFields.edit')} backTo="/custom-fields" backLabel={t('customFields.title')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  // Map entity data to form defaultValues for edit mode
  const defaultValues =
    isEditing && query.data ? { name: query.data.name, description: query.data.description ?? '' } : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('customFields.edit') : t('customFields.create')}
        backTo="/custom-fields"
        backLabel={t('customFields.title')}
      />
      <FormPage.Content>
        <CustomFieldForm defaultValues={defaultValues} onSubmit={handleSubmit} isPending={mutation.isPending} />
      </FormPage.Content>
    </FormPage.Root>
  );
}
```

### 9. Create the Form Routes

**Create route** — `src/routes/_authenticated/_layout/custom-fields/create.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { CustomFieldFormPage } from '@/features/custom-fields/custom-field-form-page';

export const Route = createFileRoute('/_authenticated/_layout/custom-fields/create')({
  component: CustomFieldCreateRoute,
});

function CustomFieldCreateRoute() {
  return <CustomFieldFormPage />;
}
```

**Edit route** — `src/routes/_authenticated/_layout/custom-fields/$customFieldId.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { CustomFieldFormPage } from '@/features/custom-fields/custom-field-form-page';

export const Route = createFileRoute('/_authenticated/_layout/custom-fields/$customFieldId')({
  component: CustomFieldEditRoute,
});

function CustomFieldEditRoute() {
  const { customFieldId } = Route.useParams();
  return <CustomFieldFormPage customFieldId={Number(customFieldId)} />;
}
```

TanStack Router prioritizes static routes (`create.tsx`) over dynamic segments (`$customFieldId.tsx`), so `/custom-fields/create` will never match the dynamic route.

---

## Part 3: Shared Setup

### 10. Add Query Keys

In `src/lib/query-keys.ts`, add keys for the new entity:

```ts
customFields: {
  all: ['custom-fields'] as const,
  list: (accountId: number, params: ListSearchParams) =>
    ['custom-fields', 'list', { accountId, ...params }] as const,
  detail: (accountId: number, id: number) =>
    ['custom-fields', 'detail', { accountId, id }] as const,
},
```

### 11. Add Translations

Add keys to both `src/locales/en-US.json` and `src/locales/pt-BR.json`:

```json
{
  "customFields": {
    "title": "Custom Fields",
    "name": "Name",
    "type": "Type",
    "description": "Description",
    "create": "Create custom field",
    "edit": "Edit custom field",
    "entityName": "custom field",
    "entityNamePlural": "custom fields"
  }
}
```

---

## Shared Components Reference

| Component              | Location                                               | Purpose                                                             |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| `ListPage.*`           | `src/components/list-page.tsx`                         | Compound layout (Root, Header, Toolbar, Content, Pagination, Empty) |
| `FormPage.*`           | `src/components/form-page.tsx`                         | Compound layout (Root, Header, Content, Footer, LoadingSkeleton)    |
| `UnsavedChangesDialog` | `src/components/unsaved-changes-dialog.tsx`            | Navigation blocker (useBlocker + beforeunload)                      |
| `DataTable`            | `src/components/data-table/data-table.tsx`             | Table with sortable headers, loading skeleton, error state          |
| `DataTablePagination`  | `src/components/data-table/data-table-pagination.tsx`  | Page navigation, page size selector, results count                  |
| `DataTableSearch`      | `src/components/data-table/data-table-search.tsx`      | Debounced search input with clear button                            |
| `DataTableEmptyState`  | `src/components/data-table/data-table-empty-state.tsx` | Empty/no-results state with icon and actions                        |
| `ConfirmDialog`        | `src/components/confirm-dialog.tsx`                    | Destructive confirmation modal (Radix AlertDialog)                  |
| `useListSearchParams`  | `src/hooks/use-list-search-params.ts`                  | Bridges URL search params with TanStack Table state                 |

## Key Conventions

- **URL is the single source of truth** for pagination, sorting, and search. No local state for these.
- **Page size preference** is persisted to `localStorage` and shared across all list pages.
- **Backend response normalization:** Always use `toPaginatedResponse()` from `@/types` to convert the backend's `{ results, totalItems, page, itemsPerPage }` format.
- **Delete error handling:** Show the API's error message (from `response.data.error`) when available, fall back to a generic translated message.
- **Confirmation dialog:** Stays open on error so the user can retry. Closes automatically on success.
- **Empty array constant:** Define `const EMPTY_ARRAY: Entity[] = []` outside the component to avoid re-renders from `?? []`.
- **Column definitions:** Define `staticColumns` outside the hook to prevent TanStack Table recalculation.
- **Single form for create & edit:** Detect mode via `defaultValues` prop. No separate components.
- **Max length fields:** Export constants from schema, use `maxLength` on inputs + character counter (`validation.charCount`).
- **Validation i18n:** Use `'validation.required'` and `'validation.maxLength::N'` keys in zod schemas. `FormMessage` auto-translates them.
- **Name max length:** 40 characters is the default for all entities.
- **Unsaved changes protection:** `UnsavedChangesDialog` handles both in-app navigation (useBlocker) and tab close (beforeunload). Pass `isPending` to disable during submission.

## Extending the Search Schema

If a page needs extra filters beyond the base `listSearchSchema`, extend it:

```ts
import { listSearchSchema } from '@/hooks/use-list-search-params';
import { z } from 'zod';

const customFieldsSearchSchema = listSearchSchema.extend({
  type: z.string().default('').catch(''),
});
```

Use the extended schema in `validateSearch` and access the extra params via `Route.useSearch()`.
