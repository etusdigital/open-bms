import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface DataTableEmptyStateProps {
  entityName: string;
  hasSearch: boolean;
  onClearSearch?: () => void;
  icon?: LucideIcon;
  createAction?: () => void;
  createLabel?: string;
}

/**
 * Empty state for data tables. Distinguishes between:
 * - Zero items exist (with optional CTA to create first item)
 * - No results match search/filters (with clear search action)
 */
export function DataTableEmptyState({
  entityName,
  hasSearch,
  onClearSearch,
  icon: Icon,
  createAction,
  createLabel,
}: DataTableEmptyStateProps) {
  const { t } = useTranslation();

  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <p className="text-muted-foreground text-sm font-medium">{t('common.noResults')}</p>
        <p className="text-muted-foreground text-sm">{t('common.noResultsMessage', { entity: entityName })}</p>
        {onClearSearch && (
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            {t('common.clearSearch')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      {Icon && <Icon className="text-muted-foreground/50 h-12 w-12" />}
      <p className="text-muted-foreground text-sm font-medium">{t('common.emptyState', { entity: entityName })}</p>
      <p className="text-muted-foreground text-sm">{t('common.emptyStateMessage', { entity: entityName })}</p>
      {createAction && createLabel && (
        <Button size="sm" onClick={createAction}>
          {createLabel}
        </Button>
      )}
    </div>
  );
}
