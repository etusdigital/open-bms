import { createFileRoute, Link } from '@tanstack/react-router';
import { FileQuestion } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
});

function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <FileQuestion className="text-muted-foreground h-12 w-12" />
      <h1 className="text-xl font-semibold">{t('common.notFound')}</h1>
      <p className="text-muted-foreground text-sm">{t('common.notFoundMessage')}</p>
      <Button asChild variant="outline">
        <Link to="/">{t('common.backToHome')}</Link>
      </Button>
    </div>
  );
}
