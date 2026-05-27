import { use } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, MailOpen, MousePointerClick, HandMetal, UserMinus, AlertTriangle } from 'lucide-react';
import { StatisticsContext } from '../../context/statistics-context';
import { METRIC_COLORS, getPercentage } from '../../constants';
import { StatCard } from './stat-card';

const ICON_SIZE = 'h-3.5 w-3.5';

export function EmailNumericCards() {
  const ctx = use(StatisticsContext)!;
  const { t } = useTranslation();
  const g = ctx.general;
  const loading = ctx.isLoading;
  const v = ctx.metricVisibility;
  const isVisible = (key: string) => v[key] !== false;

  const delivered = g?.delivered ?? 0;
  const open = g?.open ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isVisible('delivered') && (
        <StatCard
          icon={<CheckCircle className={ICON_SIZE} />}
          title={t('statistics.delivered')}
          count={g?.delivered}
          color={METRIC_COLORS.delivered}
          isLoading={loading}
        />
      )}
      {isVisible('open') && (
        <StatCard
          icon={<MailOpen className={ICON_SIZE} />}
          title={t('statistics.open')}
          percentage={g ? getPercentage(open, delivered) : undefined}
          count={g?.open}
          color={METRIC_COLORS.open}
          isLoading={loading}
        />
      )}
      {isVisible('unique_opens') && (
        <StatCard
          icon={<MailOpen className={ICON_SIZE} />}
          title={t('statistics.uniqueOpen')}
          percentage={g ? getPercentage(g.unique_opens, delivered) : undefined}
          count={g?.unique_opens}
          color={METRIC_COLORS.unique_opens}
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
      {isVisible('unique_clicks') && (
        <StatCard
          icon={<MousePointerClick className={ICON_SIZE} />}
          title={t('statistics.uniqueClick')}
          percentage={g ? getPercentage(g.unique_clicks, delivered) : undefined}
          count={g?.unique_clicks}
          color={METRIC_COLORS.unique_clicks}
          isLoading={loading}
        />
      )}
      {isVisible('percentageCtor') && (
        <StatCard
          icon={<HandMetal className={ICON_SIZE} />}
          title={t('statistics.ctor')}
          percentage={g ? getPercentage(g.click, open) : undefined}
          color={METRIC_COLORS.percentageCtor}
          isLoading={loading}
        />
      )}
      {isVisible('unsubscribe') && (
        <StatCard
          icon={<UserMinus className={ICON_SIZE} />}
          title={t('statistics.unsubscribe')}
          percentage={g ? getPercentage(g.unsubscribe, delivered) : undefined}
          count={g?.unsubscribe}
          color={METRIC_COLORS.unsubscribe}
          isLoading={loading}
        />
      )}
      {isVisible('bounce') && (
        <StatCard
          icon={<AlertTriangle className={ICON_SIZE} />}
          title={t('statistics.bounce')}
          percentage={g ? getPercentage(g.bounce, delivered) : undefined}
          count={g?.bounce}
          color={METRIC_COLORS.bounce}
          isLoading={loading}
        />
      )}
    </div>
  );
}
