import { createFileRoute } from '@tanstack/react-router';
import { AccountImportForm } from '@/features/super-admin/accounts/account-import-form';

export const Route = createFileRoute('/_authenticated/_layout/super-admin/accounts/import-enterprise')({
  component: ImportEnterpriseRoute,
});

function ImportEnterpriseRoute() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Importar conta do Enterprise</h1>
        <p className="text-muted-foreground text-sm">
          Cria uma nova conta no OSS e copia tags, contatos, campanhas, automações, mensagens e estatísticas a partir do msgops-api Enterprise.
        </p>
      </header>
      <AccountImportForm />
    </div>
  );
}
