import { use } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, CheckCircle, MousePointerClick, XCircle } from 'lucide-react';
import { StatisticsContext } from '../../context/statistics-context';
import { METRIC_COLORS, PUSH_DELIVERED_COLOR, getPercentage } from '../../constants';
import { StatCard } from './stat-card';

const ICON_SIZE = 'h-3.5 w-3.5';

export function PushCards() {
  const ctx = use(StatisticsContext)!;
  const { t } = useTranslation();
  const g = ctx.general;
  const loading = ctx.isLoading;
  const v = ctx.metricVisibility;
  const isVisible = (key: string) => v[key] !== false;
  const sent = g?.sent ?? 0;
  const delivered = g?.delivered ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isVisible('sent') && (
        <StatCard
          icon={<Send className={ICON_SIZE} />}
          title={t('statistics.sent')}
          count={g?.sent}
          color={METRIC_COLORS.sent}
          isLoading={loading}
        />
      )}
      {isVisible('delivered') && (
        <StatCard
          icon={<CheckCircle className={ICON_SIZE} />}
          title={t('statistics.delivered')}
          percentage={g ? getPercentage(delivered, sent) : undefined}
          count={g?.delivered}
          color={PUSH_DELIVERED_COLOR}
          isLoading={loading}
        />
      )}
      {isVisible('click') && (
        <StatCard
          icon={<MousePointerClick className={ICON_SIZE} />}
          title={t('statistics.click')}
          percentage={g ? getPercentage(g.click, delivered) : undefined}
          count={g?.click}
          color={METRIC_COLORS.click}
          isLoading={loading}
        />
      )}
      {ctx.messageType === 'web-push' && isVisible('close') && (
        <StatCard
          icon={<XCircle className={ICON_SIZE} />}
          title={t('statistics.close')}
          percentage={g ? getPercentage(g.close, delivered) : undefined}
          count={g?.close}
          color={METRIC_COLORS.close}
          isLoading={loading}
        />
      )}
    </div>
  );
}
