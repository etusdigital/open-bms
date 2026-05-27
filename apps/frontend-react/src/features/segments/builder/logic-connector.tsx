import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface LogicConnectorProps {
  variant: 'card' | 'step';
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const LogicConnector = memo(function LogicConnector({
  variant,
  value,
  onChange,
  disabled,
}: LogicConnectorProps) {
  const { t: _t } = useTranslation();

  const isCard = variant === 'card';
  const isOr = isCard ? value === 'UNION' : value === 'or';

  if (isCard) {
    return (
      <div className="flex flex-col items-center py-1">
        <div className="bg-border h-4 w-px" />
        <ConnectorPill value={value} onChange={onChange} disabled={disabled} isCard isOr={isOr} />
        <div className="bg-border h-4 w-px" />
      </div>
    );
  }

  // Step connector: just the pill. The horizontal line and vertical track
  // are rendered by the parent layout in condition-builder.tsx.
  return <ConnectorPill value={value} onChange={onChange} disabled={disabled} isCard={false} isOr={isOr} />;
});

function ConnectorPill({
  value,
  onChange,
  disabled,
  isCard,
  isOr,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isCard: boolean;
  isOr: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'h-auto w-auto min-w-[3.5rem] gap-1 rounded-full border-0 px-3 py-1 font-semibold tracking-wider uppercase shadow-sm',
          isCard ? 'text-xs' : 'text-[11px]',
          isOr
            ? 'bg-amber-500 text-white hover:bg-amber-600'
            : isCard
              ? 'bg-violet-600 text-white hover:bg-violet-700'
              : 'bg-emerald-600 text-white hover:bg-emerald-700',
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-[5rem]">
        {isCard ? (
          <>
            <SelectItem value="INTERSECT">{t('segments.builder.and', 'E')}</SelectItem>
            <SelectItem value="UNION">{t('segments.builder.or', 'OU')}</SelectItem>
          </>
        ) : (
          <>
            <SelectItem value="and">{t('segments.builder.and', 'E')}</SelectItem>
            <SelectItem value="or">{t('segments.builder.or', 'OU')}</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
