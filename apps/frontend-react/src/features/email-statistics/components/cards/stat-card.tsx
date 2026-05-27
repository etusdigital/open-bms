import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatNumber } from '../../utils/format-number';

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  percentage?: number;
  count?: number;
  color: string;
  isLoading?: boolean;
}

export const StatCard = memo(function StatCard({ icon, title, percentage, count, color, isLoading }: StatCardProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  if (isLoading) {
    return (
      <Card className="gap-2 py-6">
        <CardHeader className="pb-2">
          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="bg-muted h-7 w-20 animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-2 py-6">
      <CardHeader className="pb-2">
        <div className="text-muted-foreground flex items-center gap-1.5">
          {icon}
          <span className="text-xs font-medium">{title}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          {percentage != null && (
            <span className="text-xl font-bold tabular-nums" style={{ color }}>
              {(percentage ?? 0).toFixed(2)}%
            </span>
          )}
          {count != null && (
            <span
              className={
                percentage != null ? 'text-muted-foreground text-sm tabular-nums' : 'text-xl font-bold tabular-nums'
              }
              style={percentage == null ? { color } : undefined}
            >
              {formatNumber(count ?? 0, locale)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
