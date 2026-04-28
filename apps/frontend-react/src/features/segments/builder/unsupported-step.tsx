import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import type { UnsupportedStepData } from './types';

interface UnsupportedStepProps {
  data: UnsupportedStepData;
}

export const UnsupportedStep = memo(function UnsupportedStep({ data }: UnsupportedStepProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300/60 bg-amber-50/50 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-950/20">
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
      <span className="text-xs text-amber-700 dark:text-amber-400">
        {t('segments.builder.unsupportedCondition', 'Condição não suportada')}:{' '}
        <code className="font-mono">{data.originalType}</code>
      </span>
    </div>
  );
});
