import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAccountImport } from './use-account-import';
import { accountImportSchema, type AccountImportFormValues } from './account-import-schema';

export function AccountImportForm() {
  const navigate = useNavigate();
  const importMutation = useAccountImport();

  const form = useForm<AccountImportFormValues>({
    resolver: zodResolver(accountImportSchema) as never,
    defaultValues: { accountName: '', enterpriseBaseUrl: '', enterpriseApiKey: '' },
  });

  const onSubmit = async (values: AccountImportFormValues) => {
    try {
      const { jobId } = await importMutation.mutateAsync({
        accountData: { name: values.accountName },
        enterpriseBaseUrl: values.enterpriseBaseUrl,
        enterpriseApiKey: values.enterpriseApiKey,
      });
      toast.success('Import iniciado');
      navigate({ to: '/super-admin/accounts/import-enterprise/$jobId', params: { jobId } });
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Falha ao iniciar import');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
        <FormField
          control={form.control}
          name="accountName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da conta no OSS</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ex.: Cliente X (importada do Enterprise)" />
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
