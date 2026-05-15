import { createFileRoute } from '@tanstack/react-router';
import { ImportStatusView } from '@/features/super-admin/accounts/import-status-view';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/accounts/import-enterprise/$jobId')({
  component: ImportEnterpriseStatusRoute,
});

function ImportEnterpriseStatusRoute() {
  const { jobId } = Route.useParams();
  return (
    <div className="container mx-auto py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Status do import</h1>
      </header>
      <ImportStatusView jobId={jobId} />
    </div>
  );
}
