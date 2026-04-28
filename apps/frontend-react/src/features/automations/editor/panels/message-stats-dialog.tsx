/**
 * Full statistics dialog for multi-message steps (testAB, randomMessage).
 * Shows all 8 stat columns per message with optional winner/loser highlighting.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEditorActions } from '../editor-context';
import { pct, fmt } from '../stat-utils';
import { MessagePreviewDialog } from '@/components/message-preview-dialog';

interface MessageStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  messages: Array<{ id: number; title?: string; name?: string; subject?: string }>;
  winnerCriteria?: 'open' | 'click';
}

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export function MessageStatsDialog({ open, onOpenChange, title, messages, winnerCriteria }: MessageStatsDialogProps) {
  const { t } = useTranslation();
  const { messageStats } = useEditorActions();
  const [previewMsgId, setPreviewMsgId] = useState<number | null>(null);

  // Find winner index for highlighting
  let winnerIndex = -1;
  if (winnerCriteria) {
    let bestRatio = -1;
    messages.forEach((msg, i) => {
      const s = messageStats[String(msg.id)];
      if (!s) return;
      const delivered = Number(s.delivered) || 0;
      const criteriaValue = Number(s[winnerCriteria]) || 0;
      const ratio = delivered > 0 ? criteriaValue / delivered : 0;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        winnerIndex = i;
      }
    });
  }

  const STAT_COLUMNS = [
    { key: 'delivered', labelKey: 'automations.editor.msgStats.delivered', denominator: null },
    { key: 'open', labelKey: 'automations.editor.msgStats.open', denominator: 'delivered' },
    {
      key: 'unique_open',
      labelKey: 'automations.editor.msgStats.uniqueOpen',
      denominator: 'delivered',
    },
    { key: 'click', labelKey: 'automations.editor.msgStats.click', denominator: 'delivered' },
    {
      key: 'unique_click',
      labelKey: 'automations.editor.msgStats.uniqueClick',
      denominator: 'delivered',
    },
    { key: 'CTOR', labelKey: 'automations.editor.msgStats.ctor', denominator: 'open' },
    {
      key: 'unsubscribe',
      labelKey: 'automations.editor.msgStats.unsubscribe',
      denominator: 'delivered',
    },
    { key: 'bounce', labelKey: 'automations.editor.msgStats.bounce', denominator: 'delivered' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {messages.map((msg, msgIdx) => {
            const s = messageStats[String(msg.id)] ?? {};
            const delivered = Number(s.delivered) || 0;
            const openCount = Number(s.open) || 0;

            return (
              <div key={msg.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {t('automations.editor.msgStats.messageLabel', { letter: LABELS[msgIdx] })}:{' '}
                      {msg.title || msg.name}
                    </p>
                    {msg.subject && (
                      <p className="text-muted-foreground text-xs">
                        {t('automations.editor.msgStats.subject')}: {msg.subject}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
                    onClick={() => setPreviewMsgId(msg.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
                  {STAT_COLUMNS.map((col) => {
                    const rawValue = col.key === 'CTOR' ? Number(s.click) || 0 : Number(s[col.key]) || 0;
                    const denom =
                      col.denominator === 'open' ? openCount : col.denominator === 'delivered' ? delivered : 0;

                    const isWinnerCol = winnerCriteria && col.key === winnerCriteria;
                    const isWinner = isWinnerCol && msgIdx === winnerIndex;
                    const isLoser = isWinnerCol && msgIdx !== winnerIndex && winnerIndex !== -1;

                    return (
                      <div
                        key={col.key}
                        className={`rounded border px-1.5 py-1 text-center ${
                          isWinner
                            ? 'border-green-300 bg-green-50 dark:bg-green-950/30'
                            : isLoser
                              ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
                              : 'bg-muted/30'
                        }`}
                      >
                        <p className="text-muted-foreground truncate text-[9px] leading-tight">
                          {t(col.labelKey as never)}
                        </p>
                        <p
                          className={`text-xs leading-tight font-bold ${
                            isWinner
                              ? 'text-green-700 dark:text-green-400'
                              : isLoser
                                ? 'text-red-700 dark:text-red-400'
                                : ''
                          }`}
                        >
                          {col.denominator === null ? fmt(rawValue) : `${pct(rawValue, denom)}%`}
                        </p>
                        {col.denominator !== null && (
                          <span className="text-muted-foreground text-[9px]">{fmt(rawValue)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>

      {/* Message preview sub-dialog */}
      {previewMsgId && (
        <MessagePreviewDialog
          open={previewMsgId !== null}
          onOpenChange={(open) => {
            if (!open) setPreviewMsgId(null);
          }}
          messageIds={[previewMsgId]}
        />
      )}
    </Dialog>
  );
}
