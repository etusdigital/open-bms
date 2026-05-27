import { memo } from 'react';
import { formatNumber } from '../../utils/format-number';

interface StatsCellProps {
  rate: number;
  count?: number;
  color: string;
  locale?: string;
}

export const StatsCell = memo(function StatsCell({ rate, count, color, locale = 'pt-BR' }: StatsCellProps) {
  const safeRate = rate ?? 0;
  return (
    <div className="flex min-w-[80px] flex-col gap-0.5 tabular-nums">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium" style={{ color }}>
          {safeRate.toFixed(2)}%
        </span>
        {count != null && <span className="text-muted-foreground text-xs">{formatNumber(count ?? 0, locale)}</span>}
      </div>
      <div className="bg-muted h-1 w-full rounded-full">
        <div
          className="h-1 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(safeRate, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
});
