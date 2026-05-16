import { useState } from 'react';
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
  const { data, isLoading, error } = useImportStatus(jobId);
  const resume = useResumeImport();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resumeApiKey, setResumeApiKey] = useState('');

  if (isLoading) return <p>Carregando…</p>;
  if (error) return <p>Falha ao carregar status: {(error as Error).message}</p>;
  if (!data) return null;

  const onResumeConfirm = async () => {
    try {
      await resume.mutateAsync({ jobId, apiKey: resumeApiKey || undefined });
      toast.success('Job re-enfileirado');
      setDialogOpen(false);
      setResumeApiKey('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Falha ao retomar');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm text-muted-foreground">Job</p>
            <p className="font-mono text-xs">{data.jobId}</p>
          </div>
          <Badge variant={STATUS_VARIANT[data.status]}>{data.status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Source: {data.enterpriseBaseUrl} · Scope: {data.scope}
          {data.accountId !== null ? ` · Account #${data.accountId}` : ''}
        </p>
      </Card>

      {data.error && (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <h3 className="font-medium mb-3">Progresso</h3>
        <ProgressList progress={data.progress} jobStatus={data.status} />
      </Card>

      {data.status === 'failed' && !hideResume && (
        <Button onClick={() => setDialogOpen(true)}>Retomar do checkpoint</Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retomar import</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Se a apiKey original ainda for válida, pode deixar em branco. Caso contrário, informe a nova:
            </p>
            <Input
              type="password"
              value={resumeApiKey}
              onChange={(e) => setResumeApiKey(e.target.value)}
              placeholder="(opcional)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={onResumeConfirm} disabled={resume.isPending}>
              {resume.isPending ? 'Retomando…' : 'Retomar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
