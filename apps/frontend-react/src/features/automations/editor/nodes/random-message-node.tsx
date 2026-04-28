import { memo, useState, type ComponentType } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { RandomMessageNodeData } from '../types';
import { NodeDeleteButton } from './node-delete-button';
import { useEditorActions } from '../editor-context';
import { MessagePreviewDialog } from '@/components/message-preview-dialog';
import { MessageStatsDialog } from '../panels/message-stats-dialog';

const MESSAGE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

interface RandomMessageNodeConfig {
  labelKey: string;
  countKey: string;
  noMessagesKey: string;
  icon: ComponentType<{ className?: string }>;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  handleColor: string;
}

export function createRandomMessageNode(config: RandomMessageNodeConfig) {
  const { labelKey, countKey, noMessagesKey, icon: Icon, borderColor, iconBg, iconColor, handleColor } = config;

  return memo(function RandomMessageNode({ id, data, selected }: NodeProps) {
    const { t } = useTranslation();
    const { messageStats } = useEditorActions();
    const { settings } = data as RandomMessageNodeData;

    const [statsDialogOpen, setStatsDialogOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const messageCount = settings.messages?.length ?? 0;
    const hasStats = settings.messages?.some((msg) => messageStats[String(msg.id)]) ?? false;

    return (
      <div
        className={`group bg-card relative max-w-[300px] min-w-[260px] rounded-lg border-2 p-3 shadow-sm transition-colors ${
          selected ? 'border-primary ring-primary/20 ring-2' : borderColor
        }`}
      >
        <Handle type="target" position={Position.Top} className={handleColor} />

        <div className="mb-2 flex items-center gap-2">
          <div className={`rounded-md p-1.5 ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {t(labelKey as never)}
            </p>
            {messageCount > 0 && (
              <p className="text-muted-foreground text-xs">{t(countKey as never, { count: messageCount })}</p>
            )}
          </div>
        </div>

        {messageCount > 0 ? (
          <div className="space-y-1">
            {settings.messages.map((msg, i) => (
              <div key={msg.id} className="flex items-center gap-2">
                <div className="bg-muted/50 flex min-w-0 flex-1 gap-1.5 rounded border px-2 py-1.5 text-xs">
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
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs italic">{t(noMessagesKey as never)}</p>
        )}

        {messageCount > 0 && hasStats && (
          <div className="mt-2 flex justify-end border-t pt-2">
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
          </div>
        )}

        <Handle type="source" position={Position.Bottom} className={handleColor} />
        <NodeDeleteButton nodeId={id} />

        {/* Dialogs — wrapped to stop event propagation to React Flow */}
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
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

          {statsDialogOpen && (
            <MessageStatsDialog
              open={statsDialogOpen}
              onOpenChange={setStatsDialogOpen}
              title={t(labelKey as never)}
              messages={settings.messages ?? []}
            />
          )}
        </div>
      </div>
    );
  });
}
