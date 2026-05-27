import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface AudienceConditionalProps {
  value: 'UNION' | 'EXCEPT';
  onChange: (value: 'UNION' | 'EXCEPT') => void;
  variant?: 'card' | 'step';
}

export default function AudienceConditional({ value, onChange, variant = 'card' }: AudienceConditionalProps) {
  const { t } = useTranslation();

  if (variant === 'step') {
    return (
      <div className="flex items-center justify-center py-1" data-testid="audience-conditional-step">
        <Select value={value} onValueChange={(v) => onChange(v as 'UNION' | 'EXCEPT')}>
          <SelectTrigger className="h-7 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UNION" className="text-xs">
              {t('campaigns.audienceInclude')}
            </SelectItem>
            <SelectItem value="EXCEPT" className="text-xs">
              {t('campaigns.audienceExclude')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 py-2" data-testid="audience-conditional">
      <div className="bg-border h-px flex-1" />
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={value === 'UNION' ? 'default' : 'outline'}
          className={cn('h-7 px-3 text-xs', value === 'UNION' && 'pointer-events-none')}
          onClick={() => onChange('UNION')}
        >
          {t('campaigns.audienceInclude')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === 'EXCEPT' ? 'destructive' : 'outline'}
          className={cn('h-7 px-3 text-xs', value === 'EXCEPT' && 'pointer-events-none')}
          onClick={() => onChange('EXCEPT')}
        >
          {t('campaigns.audienceExclude')}
        </Button>
      </div>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}
