import { use } from 'react';
import { useTranslation } from 'react-i18next';
import { Hash, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatisticsContext } from '../context/statistics-context';

export function ChartTypeToggle() {
  const ctx = use(StatisticsContext)!;
  const { t } = useTranslation();

  if (ctx.showPerUser) return null;

  return (
    <div className="flex justify-end">
      <div className="flex rounded-lg border">
        <button
          type="button"
          title={t('statistics.numeric')}
          className={cn(
            'flex items-center justify-center rounded-l-lg p-2 transition-colors',
            ctx.displayMode === 'numeric'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
          onClick={() => ctx.setDisplayMode('numeric')}
        >
          <Hash className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t('statistics.percentage')}
          className={cn(
            'flex items-center justify-center rounded-r-lg p-2 transition-colors',
            ctx.displayMode === 'percentage'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
          onClick={() => ctx.setDisplayMode('percentage')}
        >
          <Percent className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
