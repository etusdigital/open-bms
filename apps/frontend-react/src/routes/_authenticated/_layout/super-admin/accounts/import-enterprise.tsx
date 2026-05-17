import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AccountImportForm } from '@/features/super-admin/accounts/account-import-form';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/accounts/import-enterprise')({
  component: ImportEnterpriseRoute,
});

function ImportEnterpriseRoute() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('superAdmin.accounts.import.pageTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.pageSubtitle')}</p>
      </header>
      <AccountImportForm />
    </div>
  );
}
