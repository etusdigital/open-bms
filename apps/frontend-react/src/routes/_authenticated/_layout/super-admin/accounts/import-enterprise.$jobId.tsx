import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ImportStatusView } from '@/features/super-admin/accounts/import-status-view';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/accounts/import-enterprise/$jobId')({
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
