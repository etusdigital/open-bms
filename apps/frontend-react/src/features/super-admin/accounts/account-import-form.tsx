import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAccountImport } from './use-account-import';
import { accountImportSchema, type AccountImportFormValues } from './account-import-schema';
import { AccountNameCombobox } from './account-name-combobox';
import { ImportStatusView } from './import-status-view';

export function AccountImportForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const importMutation = useAccountImport();
  // Inline progress: after starting the job we show ImportStatusView here
  // instead of navigating away. The /import-enterprise/$jobId route is kept for
  // deep-link back-compat, but the form flow no longer leaves the page.
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
      toast.success(t('superAdmin.accounts.import.startedToast'));
      setJobId(newJobId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('superAdmin.accounts.import.startErrorToast'));
    }
  };

  const startAnother = () => {
    setJobId(null);
    form.reset();
  };

  if (jobId) {
    return (
      <div className="max-w-xl space-y-6">
        <p className="text-muted-foreground text-sm">{t('superAdmin.accounts.import.runningInfo')}</p>
        <ImportStatusView jobId={jobId} />
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate({ to: '/super-admin/accounts', search: {} as never })}>
            {t('superAdmin.accounts.import.backToAccounts')}
          </Button>
          <Button variant="ghost" onClick={startAnother}>
            {t('superAdmin.accounts.import.startAnother')}
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
              <FormLabel>{t('superAdmin.accounts.import.accountLabel')}</FormLabel>
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
              <FormLabel>{t('superAdmin.accounts.import.baseUrlLabel')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('superAdmin.accounts.import.baseUrlPlaceholder')} />
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
              <FormLabel>{t('superAdmin.accounts.import.apiKeyLabel')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  placeholder={t('superAdmin.accounts.import.apiKeyPlaceholder')}
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={importMutation.isPending}>
          {importMutation.isPending
            ? t('superAdmin.accounts.import.submitting')
            : t('superAdmin.accounts.import.submit')}
        </Button>
      </form>
    </Form>
  );
}
