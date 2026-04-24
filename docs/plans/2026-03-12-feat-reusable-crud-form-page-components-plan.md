---
title: 'feat: Reusable CRUD create/edit form page component system'
type: feat
status: completed
date: 2026-03-12
---

# Reusable CRUD Create/Edit Form Page Component System

## Overview

Create a set of shared components and hooks that make building CRUD create and edit pages fast and consistent. This is the companion to the [list page component system](docs/plans/2026-03-12-feat-reusable-crud-list-page-components-plan.md). Most entities share the same pattern: a form with name + description (minimum), a page header with back navigation, client-side + server-side validation, and post-submit redirect to the list page. The Tags entity (name + description only) serves as the reference implementation.

## Problem Statement / Motivation

The app has ~20 placeholder routes waiting for real implementations. Each entity needs create and edit pages. Without shared components, each page would re-implement: form layout, validation wiring, server error mapping, loading states, unsaved changes protection, mutation lifecycle handling, and navigation. The list page system proved that shared components drastically reduce per-entity boilerplate (~20 lines of wiring). The form system should achieve the same.

## Proposed Solution

### Architecture: Shared Layout + Per-Entity Form + Hooks

```
src/components/
  form-page.tsx                    ← Compound layout: FormPage.Root/Header/Content/Footer
  unsaved-changes-dialog.tsx       ← Navigation blocker (useBlocker + beforeunload)

src/hooks/
  use-form-mutation.ts             ← Wraps create/update mutation lifecycle

src/lib/
  form-utils.ts                    ← Server error mapping helper

src/features/tags/
  tag-schema.ts                    ← Zod validation schema + TypeScript types
  tag-form.tsx                     ← Form component (shared between create & edit)
  tag-form-page.tsx                ← Page component (orchestrates query + mutation + form)
  use-tags.ts                      ← Extended with useTag, useCreateTag, useUpdateTag

src/routes/_authenticated/_layout/tags/
  index.tsx                        ← List page (already exists)
  create.tsx                       ← Create route → TagFormPage
  $tagId.tsx                       ← Edit route → TagFormPage with tagId
```

### Key Design Decisions

| Decision               | Choice                                                       | Rationale                                                                         |
| ---------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Form architecture      | Single form component for create & edit                      | Detect mode via presence of `defaultValues`; avoids duplication                   |
| Layout pattern         | Compound components (`FormPage.Root/Header/Content/Footer`)  | Matches existing `ListPage` pattern; familiar to team                             |
| Form library           | react-hook-form + zodResolver                                | Already installed (`^7.71.1`, `@hookform/resolvers ^5.2.2`), CLAUDE.md convention |
| Validation             | Zod schemas per entity                                       | Already used project-wide, type inference with `z.infer<>`                        |
| Server errors          | Map to form fields via `setError()` + generic toast fallback | Field-level errors for known fields, toast for unstructured errors                |
| Unsaved changes        | `useBlocker()` + `beforeunload`                              | TanStack Router built-in + browser tab close protection                           |
| Edit data fetching     | `useQuery` in component (not route loader)                   | Matches existing pattern (`useTagsList`), simpler, handles refetch/stale          |
| Post-submit navigation | Redirect to list page (no state preservation)                | Newly created/edited item may not match previous filters                          |
| Route structure        | `/tags/create` (static) + `/tags/$tagId` (dynamic)           | TanStack Router prioritizes static over dynamic segments                          |

### Out of Scope

- "Save and create another" flow — always redirect after submit
- Optimistic locking / concurrent edit detection — backend can add later using `updatedAt`
- Draft/autosave to localStorage — not needed for short forms
- Multi-step wizard forms — all initial entities are single-page forms
- File upload fields — will extend when needed (Templates with Content)
- Rich text editor — will extend when needed (Templates)

## Technical Approach

### FormPage Compound Components

```tsx
// src/components/form-page.tsx
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Skeleton } from '@/components/ui/skeleton';

function Root({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>;
}

function Header({ title, backTo, backLabel }: { title: string; backTo: string; backLabel: string }) {
  return (
    <div className="space-y-1">
      <Link to={backTo} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    </div>
  );
}

function Content({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ?? 'max-w-2xl'}>{children}</div>;
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="flex max-w-2xl items-center gap-2">{children}</div>;
}

function LoadingSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
  );
}

export const FormPage = { Root, Header, Content, Footer, LoadingSkeleton };
```

### Zod Schema Pattern (Per Entity)

```tsx
// src/features/tags/tag-schema.ts
import { z } from 'zod';

export const tagFormSchema = z.object({
  name: z.string().min(1, 'tags.validation.nameRequired').max(100),
  description: z.string().max(500).optional().default(''),
});

export type TagFormValues = z.infer<typeof tagFormSchema>;
```

**Translation of validation messages:** Use i18n keys in the zod schema message, resolve them in a custom error map or in the `FormMessage` component. Alternatively, pass `t()` to a schema factory function (already done in profile page: `createProfileSchema(t)`).

**Schema extension for entities with more fields:**

```tsx
// src/features/templates/template-schema.ts
const templateFormSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(500).optional().default(''),
  content: z.string().min(1, 'Content is required'),
});
```

No base schema abstraction needed — each entity defines its own schema. Name + description fields are copy-pasted, not inherited. Premature abstraction for 2 fields is not worth it.

### Form Component (Per Entity, Shared Between Create & Edit)

```tsx
// src/features/tags/tag-form.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { tagFormSchema, type TagFormValues } from './tag-schema';

interface TagFormProps {
  defaultValues?: TagFormValues;
  onSubmit: (data: TagFormValues) => void;
  isPending: boolean;
}

export function TagForm({ defaultValues, onSubmit, isPending }: TagFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: defaultValues ?? { name: '', description: '' },
  });

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
                <FormLabel>{t('tags.name')}</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>{t('tags.description')}</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root?.serverError && (
            <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {form.formState.errors.root.serverError.message}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
```

### Page Component (Orchestrates Query + Mutation + Form)

```tsx
// src/features/tags/tag-form-page.tsx
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { FormPage } from '@/components/form-page';
import { TagForm } from './tag-form';
import { useTag, useCreateTag, useUpdateTag } from './use-tags';
import type { TagFormValues } from './tag-schema';

interface TagFormPageProps {
  tagId?: number;
}

export function TagFormPage({ tagId }: TagFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = tagId !== undefined;

  const tagQuery = useTag(tagId!);
  const createMutation = useCreateTag();
  const updateMutation = useUpdateTag(tagId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: TagFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/tags' });
      },
      onError: (error) => {
        // API error message shown via toast (same pattern as delete)
        // Field-level server errors can be mapped here if backend supports it
      },
    });
  };

  if (isEditing && tagQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('tags.edit')} backTo="/tags" backLabel={t('tags.title')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && tagQuery.error) {
    // 404 or fetch error
    return (
      <FormPage.Root>
        <FormPage.Header title={t('tags.edit')} backTo="/tags" backLabel={t('tags.title')} />
        <FormPage.Content>
          <div className="text-muted-foreground text-sm">{t('common.entityNotFound')}</div>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('tags.edit') : t('tags.createTag')}
        backTo="/tags"
        backLabel={t('tags.title')}
      />
      <FormPage.Content>
        <TagForm
          defaultValues={isEditing ? tagQuery.data : undefined}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
```

### Unsaved Changes Dialog

```tsx
// src/components/unsaved-changes-dialog.tsx
import { useBlocker } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface UnsavedChangesDialogProps {
  isDirty: boolean;
  isPending?: boolean;
}

export function UnsavedChangesDialog({ isDirty, isPending = false }: UnsavedChangesDialogProps) {
  const { t } = useTranslation();

  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => isDirty && !isPending,
    enableBeforeUnload: isDirty && !isPending,
  });

  return (
    <AlertDialog
      open={status === 'blocked'}
      onOpenChange={(open) => {
        if (!open) reset();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('common.unsavedChangesTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('common.unsavedChangesMessage')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={reset}>{t('common.stay')}</AlertDialogCancel>
          <AlertDialogAction onClick={proceed}>{t('common.leave')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Key:** Pass `isPending` so the blocker is disabled during form submission — otherwise it blocks the post-submit navigation to the list page.

### API Hooks (Extended use-tags.ts)

Add to existing `src/features/tags/use-tags.ts`:

```tsx
export function useTag(id: number) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: queryKeys.tags.detail(accountId, id),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<Tag>(`/tags/${id}`, { signal });
      return data;
    },
    enabled: auth.status === 'authenticated' && id > 0,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TagFormValues) => {
      const { data: result } = await apiClient.post<Tag>('/tags', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(i18n.t('common.createSuccess', { entity: i18n.t('tags.entityName') }));
    },
    onError: (error) => {
      const apiMessage =
        isAxiosError(error) && typeof error.response?.data?.error === 'string' ? error.response.data.error : null;
      toast.error(apiMessage ?? i18n.t('common.createError', { entity: i18n.t('tags.entityName') }));
    },
  });
}

export function useUpdateTag(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TagFormValues) => {
      const { data: result } = await apiClient.put<Tag>(`/tags/${id}`, data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
      toast.success(i18n.t('common.updateSuccess', { entity: i18n.t('tags.entityName') }));
    },
    onError: (error) => {
      const apiMessage =
        isAxiosError(error) && typeof error.response?.data?.error === 'string' ? error.response.data.error : null;
      toast.error(apiMessage ?? i18n.t('common.updateError', { entity: i18n.t('tags.entityName') }));
    },
  });
}
```

### Route Files

**Create route:**

```tsx
// src/routes/_authenticated/_layout/tags/create.tsx
import { createFileRoute } from '@tanstack/react-router';
import { TagFormPage } from '@/features/tags/tag-form-page';

export const Route = createFileRoute('/_authenticated/_layout/tags/create')({
  component: TagCreateRoute,
});

function TagCreateRoute() {
  return <TagFormPage />;
}
```

**Edit route:**

```tsx
// src/routes/_authenticated/_layout/tags/$tagId.tsx
import { createFileRoute } from '@tanstack/react-router';
import { TagFormPage } from '@/features/tags/tag-form-page';

export const Route = createFileRoute('/_authenticated/_layout/tags/$tagId')({
  component: TagEditRoute,
});

function TagEditRoute() {
  const { tagId } = Route.useParams();
  return <TagFormPage tagId={Number(tagId)} />;
}
```

TanStack Router prioritizes static routes (`create.tsx`) over dynamic segments (`$tagId.tsx`), so `/tags/create` will never match the `$tagId` route.

### Server Error Handling

The backend currently returns errors as `{ status: number, error: string }`. The mutation's `onError` shows this via toast (same pattern as delete). If the backend later adds field-level validation errors, the form page can map them:

```tsx
// Future enhancement when backend supports field-level errors
// In tag-form-page.tsx handleSubmit onError:
if (isAxiosError(error) && error.response?.data?.errors) {
  const fieldErrors = error.response.data.errors as Array<{ field: string; message: string }>;
  for (const { field, message } of fieldErrors) {
    form.setError(field as keyof TagFormValues, { type: 'server', message });
  }
} else {
  // Generic toast (current behavior)
}
```

For now, all server errors show as toasts. Root-level form errors (`form.formState.errors.root?.serverError`) are rendered inline in the form for cases where the page component calls `form.setError('root.serverError', ...)`.

### Wiring the List Page Create Button

Update `tags-page.tsx` to link the "Create" button:

```tsx
<Button size="sm" asChild>
  <Link to="/tags/create">
    <Plus className="mr-1 h-4 w-4" />
    {t('tags.createTag')}
  </Link>
</Button>
```

### shadcn Components to Install

- `textarea` — for description fields (`npx shadcn@latest add textarea`)
- `skeleton` — for loading states (check if already installed)

## Acceptance Criteria

### Shared Components

- [x] `FormPage` compound components: `Root`, `Header` (with back link), `Content`, `Footer`, `LoadingSkeleton`
- [x] `UnsavedChangesDialog` blocks navigation when form is dirty, disables during submission
- [x] `UnsavedChangesDialog` triggers `beforeunload` for tab close protection

### Form Pattern

- [x] Single form component works for both create and edit (detect via `defaultValues`)
- [x] react-hook-form + zodResolver for client-side validation
- [x] `FormMessage` renders validation errors inline under each field
- [x] Root-level server errors rendered inline in form
- [x] Submit button disabled during mutation (`isPending`)
- [x] Submit button text changes: "Create" / "Save" / "Loading..."

### API Integration

- [x] `useTag(id)` — fetches single entity for edit mode, disabled when `id` is 0
- [x] `useCreateTag()` — POST mutation, invalidates list cache, success/error toasts
- [x] `useUpdateTag(id)` — PUT mutation, invalidates list/detail cache, success/error toasts
- [x] Server error messages from API shown in toast (same pattern as delete)
- [x] Query keys include account ID for cache isolation

### Page Component

- [x] Edit mode: loading skeleton while fetching entity
- [x] Edit mode: error state when entity not found (404)
- [x] Create mode: empty form with defaults
- [x] Post-submit redirect to list page
- [x] Page title: "Create Tag" / "Edit Tag"
- [x] Back link navigates to list page

### Routes

- [x] `/tags/create` route renders create form
- [x] `/tags/$tagId` route renders edit form with prefetched data
- [x] Static `create` route takes priority over dynamic `$tagId`

### List Page Integration

- [x] "Create" button on list page links to `/tags/create`
- [x] Edit icon on list rows links to `/tags/$tagId`
- [x] Both already work (edit link exists in tags-columns.tsx)

### i18n

- [x] Translation keys for: form field labels, validation messages, page titles, button text, unsaved changes dialog, success/error toasts, entity not found
- [x] Both `pt-BR.json` and `en-US.json` updated

### Testing

- [x] Unit tests for `UnsavedChangesDialog` (blocks when dirty, allows when clean, allows during submit)
- [x] Unit tests for tag form validation (required name, max lengths)
- [x] Unit tests for `useCreateTag` and `useUpdateTag` mutations
- [x] Component test for `TagForm` (renders fields, submits valid data, shows validation errors)
- [x] Component test for `TagFormPage` (loading state, error state, create mode, edit mode)

## Implementation Tasks

### Phase 1: Shared Components + Tags Form

Build shared components and the Tags create/edit pages together.

1. - [x] **Install `textarea` shadcn component** — needed for description fields
2. - [x] **`FormPage` compound components** — `form-page.tsx` with Root, Header, Content, Footer, LoadingSkeleton
3. - [x] **`UnsavedChangesDialog`** — `unsaved-changes-dialog.tsx` using `useBlocker()` + `beforeunload`
4. - [x] **`tag-schema.ts`** — zod validation schema for tag form (name required, description optional)
5. - [x] **`tag-form.tsx`** — form component with react-hook-form + shadcn Form fields + unsaved changes
6. - [x] **Extend `use-tags.ts`** — add `useTag`, `useCreateTag`, `useUpdateTag` hooks
7. - [x] **`tag-form-page.tsx`** — page component orchestrating query + mutation + form + navigation
8. - [x] **Create route** — `src/routes/_authenticated/_layout/tags/create.tsx`
9. - [x] **Edit route** — `src/routes/_authenticated/_layout/tags/$tagId.tsx`
10. - [x] **Wire list page** — update Create button to link to `/tags/create`
11. - [x] **Add i18n keys** — form labels, validation, page titles, toasts, unsaved changes dialog
12. - [x] **Tests** — unit + component tests for all shared and tags-specific code

## Dependencies & Risks

| Risk                                                     | Mitigation                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Backend API error format varies per entity               | Show API error string via toast (current pattern); add field-level mapping later                |
| `useBlocker` API may change in TanStack Router updates   | It's stable since v1; wrap in our own component for easy migration                              |
| Route conflict between `/tags/create` and `/tags/$tagId` | TanStack Router prioritizes static routes; verified in docs                                     |
| Long forms need sections/tabs (future entities)          | `FormPage.Content` accepts children — sections are just React children, not a framework concern |
| File upload / rich text fields (Templates)               | Out of scope; extend form pattern when needed                                                   |

## Success Metrics

- A new create/edit page can be built with: 1 schema file (~10 lines) + 1 form component (~50 lines) + 1 page component (~60 lines) + 2 route files (~10 lines each)
- All form pages share the same layout, validation pattern, error handling, and unsaved changes protection
- Changes to shared components (e.g., FormPage header design) propagate to all pages automatically

## Sources & References

### Internal References

- List page plan: `docs/plans/2026-03-12-feat-reusable-crud-list-page-components-plan.md`
- Existing form pattern: `src/features/profile/profile-page.tsx`
- shadcn Form component: `src/components/ui/form.tsx`
- Tags list page: `src/features/tags/tags-page.tsx`
- API client: `src/lib/api-client.ts`
- Query keys: `src/lib/query-keys.ts`
- Tags columns (edit link): `src/features/tags/tags-columns.tsx`

### External References

- [react-hook-form — useForm](https://react-hook-form.com/docs/useform)
- [react-hook-form — setError for server errors](https://react-hook-form.com/docs/useform/seterror)
- [shadcn/ui — Form](https://ui.shadcn.com/docs/components/form)
- [TanStack Router — Navigation Blocking](https://tanstack.com/router/latest/docs/framework/react/guide/navigation-blocking)
- [TanStack Router — Path Params](https://tanstack.com/router/latest/docs/framework/react/guide/path-params)
- [Zod v4 Changelog](https://zod.dev/v4/changelog) — `.merge()` deprecated, use `.extend()`
