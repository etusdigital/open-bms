import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useImportStatus } from './use-import-status';
import { useResumeImport } from './use-account-import';
import { ProgressList } from './progress-list';
import type { ImportStatus } from './import-gateway';

const STATUS_VARIANT: Record<ImportStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  running: 'default',
  paused: 'outline',
  completed: 'default',
  failed: 'destructive',
};

export function ImportStatusView({ jobId, hideResume = false }: { jobId: string; hideResume?: boolean }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useImportStatus(jobId);
  const resume = useResumeImport();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resumeApiKey, setResumeApiKey] = useState('');

  if (isLoading) return <p>{t('common.loading')}</p>;
  if (error) return <p>{t('superAdmin.accounts.import.loadError', { message: (error as Error).message })}</p>;
  if (!data) return null;

  const onResumeConfirm = async () => {
    try {
      await resume.mutateAsync({ jobId, apiKey: resumeApiKey || undefined });
      toast.success(t('superAdmin.accounts.import.resumeQueuedToast'));
      setDialogOpen(false);
      setResumeApiKey('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('superAdmin.accounts.import.resumeErrorToast'));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.job')}</p>
            <p className="font-mono text-xs">{data.jobId}</p>
          </div>
          <Badge variant={STATUS_VARIANT[data.status]}>{data.status}</Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          {t('superAdmin.accounts.import.sourceLabel')} {data.enterpriseBaseUrl} ·{' '}
          {t('superAdmin.accounts.import.scopeLabel')} {data.scope}
          {data.accountId !== null ? ` · ${t('superAdmin.accounts.import.accountTag', { id: data.accountId })}` : ''}
        </p>
      </Card>

      {data.error && (
        <Alert variant="destructive">
          <AlertTitle>{t('superAdmin.accounts.import.errorTitle')}</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <h3 className="mb-3 font-medium">{t('superAdmin.accounts.import.progressTitle')}</h3>
        <ProgressList progress={data.progress} jobStatus={data.status} />
      </Card>

      {data.status === 'failed' && !hideResume && (
        <Button onClick={() => setDialogOpen(true)}>{t('superAdmin.accounts.import.resumeFromCheckpoint')}</Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('superAdmin.accounts.import.resumeDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.resumeDialogHelp')}</p>
            <Input
              type="password"
              value={resumeApiKey}
              onChange={(e) => setResumeApiKey(e.target.value)}
              placeholder={t('superAdmin.accounts.import.apiKeyOptionalPlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onResumeConfirm} disabled={resume.isPending}>
              {resume.isPending ? t('superAdmin.accounts.import.resuming') : t('superAdmin.accounts.import.resume')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
