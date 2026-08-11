import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ImportStatusView } from '@/features/super-admin/accounts/import-status-view';

// Search/filter/pagination state for the two lists on this page (the flat
// items listing and the ambiguous review queue) — kept in the URL so a
// reload or back/forward restores where the operator was, instead of
// resetting to page 1 with every filter cleared. Namespaced per list
// (items* / amb*) since both live on the same route at once.
export const reconcileStatusSearchSchema = z.object({
  itemsQ: z.string().catch('').default(''),
  itemsKind: z.enum(['all', 'auto', 'ambiguous']).catch('all').default('all'),
  itemsStatus: z.enum(['all', 'pending', 'applied', 'skipped', 'failed', 'conflict']).catch('all').default('all'),
  itemsOffset: z.number().int().nonnegative().catch(0).default(0),
  ambQ: z.string().catch('').default(''),
  ambOffset: z.number().int().nonnegative().catch(0).default(0),
  ambPageSize: z.number().int().positive().catch(25).default(25),
});

export const Route = createFileRoute('/_authenticated/_layout/super-admin/accounts/import-enterprise/$jobId')({
  validateSearch: reconcileStatusSearchSchema,
  component: ImportEnterpriseStatusRoute,
});

function ImportEnterpriseStatusRoute() {
  const { t } = useTranslation();
  const { jobId } = Route.useParams();
  return (
    <div className="container mx-auto space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('superAdmin.accounts.import.statusPageTitle')}</h1>
      </header>
      <ImportStatusView jobId={jobId} />
    </div>
  );
}
