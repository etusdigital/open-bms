import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAccountImport } from './use-account-import';
import { accountImportSchema, type AccountImportFormValues } from './account-import-schema';
import { AccountNameCombobox } from './account-name-combobox';
import { ImportStatusView } from './import-status-view';

export function AccountImportForm() {
  const navigate = useNavigate();
  const importMutation = useAccountImport();
  // Progresso inline (como no wizard Step2EnterpriseImport): após iniciar o
  // job, mostramos o ImportStatusView aqui mesmo em vez de navegar para a rota
  // /import-enterprise/$jobId. A rota por jobId continua existindo para
  // deep-link, mas o fluxo do formulário não sai mais da página.
  const [jobId, setJobId] = useState<string | null>(null);

  const form = useForm<AccountImportFormValues>({
    resolver: zodResolver(accountImportSchema) as never,
    defaultValues: { accountName: '', enterpriseBaseUrl: '', enterpriseApiKey: '' },
  });

  const onSubmit = async (values: AccountImportFormValues) => {
    try {
      const { jobId: newJobId } = await importMutation.mutateAsync({
        accountData: { name: values.accountName },
        enterpriseBaseUrl: values.enterpriseBaseUrl,
        enterpriseApiKey: values.enterpriseApiKey,
      });
      toast.success('Import iniciado');
      setJobId(newJobId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Falha ao iniciar import');
    }
  };

  const startAnother = () => {
    setJobId(null);
    form.reset();
  };

  if (jobId) {
    return (
      <div className="max-w-xl space-y-6">
        <p className="text-muted-foreground text-sm">
          O import está rodando em background. Você pode acompanhar aqui ou voltar para a lista de contas — o worker
          segue importando.
        </p>
        <ImportStatusView jobId={jobId} />
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate({ to: '/super-admin/accounts', search: {} as never })}>
            Voltar para contas
          </Button>
          <Button variant="ghost" onClick={startAnother}>
            Iniciar outro import
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-6">
        <FormField
          control={form.control}
          name="accountName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta no OSS</FormLabel>
              <FormControl>
                <AccountNameCombobox
                  id={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={importMutation.isPending}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="enterpriseBaseUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL base do msgops-api Enterprise</FormLabel>
              <FormControl>
                <Input {...field} placeholder="https://api.enterprise.exemplo.com" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="enterpriseApiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API key do Enterprise</FormLabel>
              <FormControl>
                <Input {...field} type="password" placeholder="(secreto)" autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={importMutation.isPending}>
          {importMutation.isPending ? 'Iniciando…' : 'Importar do Enterprise'}
        </Button>
      </form>
    </Form>
  );
}
