import { use } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, UserCheck, UserPlus, MailOpen, MousePointerClick, UserMinus } from 'lucide-react';
import { StatisticsContext } from '../../context/statistics-context';
import { METRIC_COLORS, getPercentage } from '../../constants';
import { StatCard } from './stat-card';

const ICON_SIZE = 'h-3.5 w-3.5';

export function EmailPerUserCards() {
  const ctx = use(StatisticsContext)!;
  const { t } = useTranslation();
  const g = ctx.general;
  const loading = ctx.isLoading;
  const ud = Number(g?.unique_user_delivered) || 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        icon={<Users className={ICON_SIZE} />}
        title={t('statistics.baseSize')}
        count={Number(g?.unique_user_delivered) || undefined}
        color={METRIC_COLORS.unique_user_delivered}
        isLoading={loading}
      />
      <StatCard
        icon={<UserCheck className={ICON_SIZE} />}
        title={t('statistics.engagedUsers')}
        percentage={ud ? getPercentage(Number(g?.unique_user_open) || 0, ud) : undefined}
        count={Number(g?.unique_user_open) || undefined}
        color={METRIC_COLORS.unique_user_open}
        isLoading={loading}
      />
      <StatCard
        icon={<UserPlus className={ICON_SIZE} />}
        title={t('statistics.dau')}
        percentage={ud ? getPercentage(Number(g?.unique_user_click) || 0, ud) : undefined}
        count={Number(g?.unique_user_click) || undefined}
        color={METRIC_COLORS.unique_user_click}
        isLoading={loading}
      />
      <StatCard
        icon={<MailOpen className={ICON_SIZE} />}
        title={t('statistics.avgOpenRate')}
        count={Number(g?.opens_per_contact) || undefined}
        color={METRIC_COLORS.opens_per_contact}
        isLoading={loading}
      />
      <StatCard
        icon={<MousePointerClick className={ICON_SIZE} />}
        title={t('statistics.avgClickRate')}
        count={Number(g?.clicks_per_contact) || undefined}
        color={METRIC_COLORS.clicks_per_contact}
        isLoading={loading}
      />
      <StatCard
        icon={<UserMinus className={ICON_SIZE} />}
        title={t('statistics.unsubByBase')}
        percentage={ud ? getPercentage(Number(g?.unique_user_unsubscribe) || 0, ud) : undefined}
        count={Number(g?.unique_user_unsubscribe) || undefined}
        color={METRIC_COLORS.unique_user_unsubscribe}
        isLoading={loading}
      />
    </div>
  );
}
