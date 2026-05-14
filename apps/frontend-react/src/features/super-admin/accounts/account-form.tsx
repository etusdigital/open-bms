import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import {
  superAdminCreateAccountSchema,
  superAdminEditAccountSchema,
  type SuperAdminCreateAccountValues,
  type SuperAdminEditAccountValues,
} from './account-schema';
import { CHANNEL_KEYS } from './account-channels';

interface AccountFormCreateProps {
  mode: 'create';
  onSubmit: (data: SuperAdminCreateAccountValues) => void;
  isPending: boolean;
}

interface AccountFormEditProps {
  mode: 'edit';
  defaultValues: SuperAdminEditAccountValues;
  onSubmit: (data: SuperAdminEditAccountValues) => void;
  isPending: boolean;
}

type AccountFormProps = AccountFormCreateProps | AccountFormEditProps;

export function SuperAdminAccountForm(props: AccountFormProps) {
  const { t } = useTranslation();

  if (props.mode === 'edit') {
    return <EditForm {...props} />;
  }
  return <CreateForm {...props} />;
}

function CreateForm({
  onSubmit,
  isPending,
}: AccountFormCreateProps) {
  const { t } = useTranslation();

  const form = useForm<SuperAdminCreateAccountValues>({
    resolver: zodResolver(superAdminCreateAccountSchema) as never,
    defaultValues: {
      name: '',
      description: '',
      isInternal: false,
      isActive: true,
      defaultDomain: '',
      accountConfigs: [],
    },
  });

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.accounts.name')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={255} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.accounts.description')}</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} maxLength={500} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultDomain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.accounts.defaultDomain')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://example.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isInternal"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <FormLabel>{t('superAdmin.accounts.isInternal')}</FormLabel>
                  <FormDescription>{t('superAdmin.accounts.isInternalHelp')}</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <FormLabel>{t('superAdmin.accounts.status')}</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {form.formState.errors.root?.serverError && (
            <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {form.formState.errors.root.serverError.message}
            </div>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}

function EditForm({
  defaultValues,
  onSubmit,
  isPending,
}: AccountFormEditProps) {
  const { t } = useTranslation();

  const form = useForm<SuperAdminEditAccountValues>({
    resolver: zodResolver(superAdminEditAccountSchema) as never,
    defaultValues,
  });

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.accounts.name')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={255} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.accounts.description')}</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} maxLength={500} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isInternal"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <FormLabel>{t('superAdmin.accounts.isInternal')}</FormLabel>
                  <FormDescription>{t('superAdmin.accounts.isInternalHelp')}</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <section className="rounded-lg border p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">{t('superAdmin.accounts.channels.title')}</h3>
              <p className="text-muted-foreground text-xs">{t('superAdmin.accounts.channels.help')}</p>
            </div>
            <div className="space-y-2">
              {CHANNEL_KEYS.map((key) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`channels.${key}` as const}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <FormLabel className="font-normal">
                        {t(`superAdmin.accounts.channels.${key}`)}
                      </FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label={t(`superAdmin.accounts.channels.${key}`)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </section>

          {form.formState.errors.root?.serverError && (
            <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {form.formState.errors.root.serverError.message}
            </div>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>
        </form>
      </Form>
    </>
  );
}
