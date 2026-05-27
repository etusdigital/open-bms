import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FlaskConical, Loader2, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { TestABNodeData } from '../types';
import { NodeDeleteButton } from './node-delete-button';
import { useEditorActions } from '../editor-context';
import { pct, fmt } from '../stat-utils';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { MessageStatsDialog } from '../panels/message-stats-dialog';
import { MessagePreviewDialog } from '@/components/message-preview-dialog';

const MESSAGE_LABELS = ['A', 'B', 'C', 'D'];

export const TestABNode = memo(function TestABNode({ id, data, selected }: NodeProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { messageStats } = useEditorActions();
  const { settings } = data as TestABNodeData;

  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const messageCount = settings.messages?.length ?? 0;
  const criteriaKey = settings.winnerCriteria ?? 'open';
  const criteriaLabel =
    criteriaKey === 'open' ? t('automations.editor.testAB.openRate') : t('automations.editor.testAB.clickRate');

  const messageStatsArr =
    settings.messages?.map((msg) => {
      const s = messageStats[String(msg.id)];
      if (!s) return null;
      const delivered = Number(s.delivered) || 0;
      const criteriaValue = Number(s[criteriaKey]) || 0;
      const ratio = delivered > 0 ? criteriaValue / delivered : 0;
      return { delivered, criteriaValue, ratio };
    }) ?? [];

  const hasStats = messageStatsArr.some((s) => s !== null);
  const winnerIndex = messageStatsArr.reduce((best, s, i) => {
    if (!s) return best;
    if (best === -1) return i;
    const bestStats = messageStatsArr[best];
    if (!bestStats) return i;
    return s.ratio > bestStats.ratio ? i : best;
  }, -1);

  const totalDelivered = messageStatsArr.reduce((sum, s) => sum + (s?.delivered ?? 0), 0);

  const handleFinishTest = async () => {
    setFinishing(true);
    try {
      await apiClient.post('/automations/stop-testab', {
        ...{ id: Number(id), type: 'testAB', settings },
        automationId: undefined,
      });
      toast.success(t('automations.editor.testAB.finishSuccess'));
      queryClient.invalidateQueries({ queryKey: queryKeys.automations.all });
    } catch {
      toast.error(t('automations.editor.testAB.finishError'));
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div
      className={`group bg-card relative max-w-[340px] min-w-[280px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
        selected ? 'border-primary ring-primary/20 ring-2' : 'border-purple-300'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-400" />

      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="rounded-md bg-purple-100 p-1.5">
          <FlaskConical className="h-4 w-4 text-purple-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t('automations.editor.testAB.title')}
          </p>
        </div>
        {settings.status === 'running' &&
          settings.endDate &&
          (() => {
            const remaining = Math.max(
              0,
              Math.floor((new Date(settings.endDate.replace(' ', 'T')).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            );
            return (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                {t('automations.editor.testAB.remainingTime', { days: remaining })}
              </Badge>
            );
          })()}
        {settings.status === 'finished' && (
          <Badge variant="default" className="text-[10px]">
            {t('automations.editor.testAB.status_finished')}
          </Badge>
        )}
      </div>

      {/* Winner criteria */}
      <p className="text-muted-foreground mb-1.5 text-xs">
        {t('automations.editor.testAB.criteria')}: {criteriaLabel}
      </p>

      {/* Messages with stats */}
      {messageCount > 0 ? (
        <div className="space-y-1">
          {settings.messages.map((msg, i) => {
            const s = messageStatsArr[i];
            const isWinner = hasStats && settings.status !== 'notStarted' && i === winnerIndex;
            const isLoser = hasStats && settings.status !== 'notStarted' && i !== winnerIndex && winnerIndex !== -1;

            return (
              <div key={msg.id} className="flex items-center gap-2">
                <div className="bg-muted/50 min-w-0 flex-1 rounded border px-2 py-1.5 text-xs">
                  <div className="flex items-start gap-1.5">
                    <span className="text-muted-foreground font-semibold">{MESSAGE_LABELS[i]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{msg.title || msg.name}</p>
                      {msg.subject && <p className="text-muted-foreground truncate">{msg.subject}</p>}
                    </div>
                    <button
                      type="button"
                      className="nodrag text-muted-foreground hover:text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewIndex(i);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {s && (
                  <div
                    className={`min-w-[70px] shrink-0 rounded border px-2 py-1 text-center text-xs ${
                      isWinner
                        ? 'border-green-300 bg-green-50 dark:bg-green-950/30'
                        : isLoser
                          ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
                          : 'bg-muted/30'
                    }`}
                  >
                    <p className="text-muted-foreground text-[9px]">
                      {criteriaKey === 'open'
                        ? t('automations.editor.msgStats.open')
                        : t('automations.editor.msgStats.click')}
                    </p>
                    <p
                      className={`font-bold ${isWinner ? 'text-green-700 dark:text-green-400' : isLoser ? 'text-red-700 dark:text-red-400' : ''}`}
                    >
                      {pct(s.criteriaValue, s.delivered)}%
                    </p>
                    <span className="text-muted-foreground text-[9px]">{fmt(s.criteriaValue)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs italic">{t('automations.editor.testAB.noMessages')}</p>
      )}

      {/* Footer: total delivered + buttons */}
      {messageCount > 0 && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <div className="flex items-center">
            {hasStats && totalDelivered > 0 && (
              <span className="text-muted-foreground text-xs">
                {t('automations.editor.msgStats.delivered')}: {fmt(totalDelivered)}
              </span>
            )}
            <div className="flex-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="nodrag h-6 px-2 text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                setStatsDialogOpen(true);
              }}
            >
              {t('automations.editor.msgStats.moreStats')}
            </Button>
            {settings.status === 'running' && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="nodrag h-6 px-2 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmFinishOpen(true);
                }}
                disabled={finishing}
              >
                {finishing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {t('automations.editor.testAB.finishTest')}
              </Button>
            )}
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-purple-400" />
      {settings.status !== 'running' && <NodeDeleteButton nodeId={id} />}

      {/* Dialogs — wrapped to stop event propagation to React Flow */}
      <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <ConfirmDialog
          open={confirmFinishOpen}
          onOpenChange={setConfirmFinishOpen}
          title={t('automations.editor.testAB.finishConfirmTitle')}
          description={t('automations.editor.testAB.finishConfirmDescription')}
          onConfirm={() => {
            setConfirmFinishOpen(false);
            handleFinishTest();
          }}
          loading={finishing}
          variant="destructive"
          confirmLabel={t('automations.editor.testAB.finishTest')}
        />

        {previewIndex !== null && (
          <MessagePreviewDialog
            open={previewIndex !== null}
            onOpenChange={(open) => {
              if (!open) setPreviewIndex(null);
            }}
            messageIds={settings.messages?.map((m) => m.id) ?? []}
            showTabs
            tabLabels={settings.messages?.map(
              (_, i) => `${t('automations.editor.msgStats.messageLabel', { letter: MESSAGE_LABELS[i] })}`,
            )}
            initialIndex={previewIndex}
          />
        )}

        <MessageStatsDialog
          open={statsDialogOpen}
          onOpenChange={setStatsDialogOpen}
          title={t('automations.editor.testAB.statsDialogTitle')}
          messages={settings.messages ?? []}
          winnerCriteria={criteriaKey}
        />
      </div>
    </div>
  );
});
