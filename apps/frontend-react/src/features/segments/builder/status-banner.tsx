import { useTranslation } from 'react-i18next';
import { Info, AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SegmentStatus } from '../types';

interface StatusBannerProps {
  status?: SegmentStatus;
  isProcessing?: boolean;
}

export function StatusBanner({ status, isProcessing }: StatusBannerProps) {
  const { t } = useTranslation();

  if (isProcessing) {
    return (
      <Alert className="border-amber-300/60 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-950/20">
        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          {t('segments.statusProcessing')}
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'inactive') {
    return (
      <Alert className="border-amber-300/60 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          {t('segments.statusInactive')}
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'active') {
    return (
      <Alert className="border-blue-300/60 bg-blue-50/50 dark:border-blue-700/40 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-700 dark:text-blue-400">{t('segments.statusActive')}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
