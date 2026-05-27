import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useImportJobs } from './use-import-jobs';
import type { ImportStatus } from './import-gateway';

const STATUS_VARIANT: Record<ImportStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  running: 'default',
  paused: 'outline',
  completed: 'default',
  failed: 'destructive',
};

/**
 * List of recent import jobs shown below the create-import form. Each row
 * links to the job's status page where the post-import reconcile step lives.
 *
 * Surface design: this page used to be a dead-end after submitting an import
 * — the operator had to know the UUID to find the job again. Adding the list
 * makes the reconcile (EVO-1464) discoverable without context-switching.
 */
export function ImportJobsList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useImportJobs();

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>;
  }

  if (error) {
    return (
      <p className="text-destructive text-sm">
        {t('superAdmin.accounts.import.jobsList.loadError', { message: (error as Error).message })}
      </p>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.jobsList.empty')}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-muted-foreground text-xs">
          <tr>
            <th className="px-4 py-2 text-left font-medium">{t('superAdmin.accounts.import.jobsList.colJob')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('superAdmin.accounts.import.jobsList.colAccount')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('superAdmin.accounts.import.jobsList.colStatus')}</th>
            <th className="px-4 py-2 text-left font-medium">{t('superAdmin.accounts.import.jobsList.colCreated')}</th>
            <th className="px-4 py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {data.map((job) => (
            <tr key={job.jobId} className="border-t">
              <td className="px-4 py-2 font-mono text-xs">{job.jobId.slice(0, 8)}…</td>
              <td className="px-4 py-2">
                {job.accountId !== null
                  ? t('superAdmin.accounts.import.accountTag', { id: job.accountId })
                  : '—'}
              </td>
              <td className="px-4 py-2">
                <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
              </td>
              <td className="text-muted-foreground px-4 py-2 text-xs">
                {new Date(job.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right">
                <Link
                  to="/super-admin/accounts/import-enterprise/$jobId"
                  params={{ jobId: job.jobId }}
                  className="text-primary text-xs hover:underline"
                >
                  {t('superAdmin.accounts.import.jobsList.view')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
