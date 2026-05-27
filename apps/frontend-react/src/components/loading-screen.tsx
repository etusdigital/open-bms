import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function LoadingScreen({ message }: { message?: string }) {
  const { t } = useTranslation();

  return (
    <div className="bg-background flex h-screen w-full flex-col items-center justify-center gap-4">
      <img src="/logo.png" alt="BMS" className="h-12 w-12 object-contain" />
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      <p className="text-muted-foreground text-sm">{message || t('common.loading')}</p>
    </div>
  );
}
