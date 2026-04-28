import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import AutomationsPage from '@/features/automations/automations-page';

const automationsSearchSchema = listSearchSchema.extend({
  sort: z.string().default('updatedAt').catch('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc').catch('desc'),
  status: z.enum(['active', 'inactive', 'all']).default('active').catch('active'),
});

export type AutomationsSearchParams = z.infer<typeof automationsSearchSchema>;

export const Route = createFileRoute('/_authenticated/_layout/automations/')({
  validateSearch: automationsSearchSchema,
  component: () => {
    const search = Route.useSearch();
    return <AutomationsPage searchParams={search} />;
  },
});
