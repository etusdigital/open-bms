import { createFileRoute, Link } from '@tanstack/react-router';
import { ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/access-denied')({
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <ShieldX className="text-muted-foreground h-12 w-12" />
      <h1 className="text-xl font-semibold">{t('auth.permissionDenied')}</h1>
      <p className="text-muted-foreground text-sm">{t('auth.permissionDeniedMessage')}</p>
      <Button asChild variant="outline">
        <Link to="/">{t('auth.backToHome')}</Link>
      </Button>
    </div>
  );
}
