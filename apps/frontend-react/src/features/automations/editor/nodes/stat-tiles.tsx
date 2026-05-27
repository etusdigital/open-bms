/**
 * Inline stat tiles for message node cards.
 * Email: Total Delivered, Open %, Unique Open %, Click %
 * Push:  Total Sent, Delivered %, Click %, Unique Click %
 */
import { useTranslation } from 'react-i18next';
import { useEditorActions } from '../editor-context';
import { pct, fmt } from '../stat-utils';

interface StatTilesProps {
  messageId: number;
  /** Channel type — changes which stats are shown */
  channelType?: string;
}

export function StatTiles({ messageId, channelType }: StatTilesProps) {
  const { t } = useTranslation();
  const { messageStats } = useEditorActions();
  const stats = messageStats[String(messageId)];

  if (!stats) return null;

  const isPush = channelType === 'webPush' || channelType === 'mobilePush';

  if (isPush) {
    const sent = Number(stats.sent) || 0;
    const delivered = Number(stats.delivered) || 0;
    if (!sent && !delivered) return null;

    return (
      <div className="mt-2 grid grid-cols-4 gap-1">
        <StatBox label={t('automations.editor.msgStats.sent')} value={fmt(sent)} />
        <StatBox
          label={t('automations.editor.msgStats.delivered')}
          value={`${pct(delivered, sent)}%`}
          sub={fmt(delivered)}
        />
        <StatBox
          label={t('automations.editor.msgStats.click')}
          value={`${pct(stats.click, delivered)}%`}
          sub={fmt(stats.click)}
        />
        <StatBox
          label={t('automations.editor.msgStats.uniqueClick')}
          value={`${pct(stats.unique_click, delivered)}%`}
          sub={fmt(stats.unique_click)}
        />
      </div>
    );
  }

  // Email / SMS / WhatsApp
  const delivered = Number(stats.delivered) || 0;
  if (!delivered) return null;

  return (
    <div className="mt-2 grid grid-cols-4 gap-1">
      <StatBox label={t('automations.editor.msgStats.delivered')} value={fmt(delivered)} />
      <StatBox
        label={t('automations.editor.msgStats.open')}
        value={`${pct(stats.open, delivered)}%`}
        sub={fmt(stats.open)}
      />
      <StatBox
        label={t('automations.editor.msgStats.uniqueOpen')}
        value={`${pct(stats.unique_open, delivered)}%`}
        sub={fmt(stats.unique_open)}
      />
      <StatBox
        label={t('automations.editor.msgStats.click')}
        value={`${pct(stats.click, delivered)}%`}
        sub={fmt(stats.click)}
      />
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-muted/30 rounded border px-1.5 py-1 text-center">
      <p className="text-muted-foreground truncate text-[9px] leading-tight">{label}</p>
      <p className="text-xs leading-tight font-bold">{value}</p>
      {sub && <span className="text-muted-foreground text-[9px]">{sub}</span>}
    </div>
  );
}
