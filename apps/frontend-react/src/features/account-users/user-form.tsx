// Adapted from features/super-admin/users — keep in sync until shared module is extracted.
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import {
  accountUserCreateSchema,
  accountUserEditSchema,
  ACCOUNT_ROLE_CODES,
  type AccountUserCreateValues,
  type AccountUserEditValues,
} from './user-schema';

interface UserFormCreateProps {
  mode: 'create';
  onSubmit: (data: AccountUserCreateValues) => void;
  isPending: boolean;
}

interface UserFormEditProps {
  mode: 'edit';
  defaultValues: AccountUserEditValues;
  onSubmit: (data: AccountUserEditValues) => void;
  isPending: boolean;
}

type UserFormProps = UserFormCreateProps | UserFormEditProps;

export function AccountUserForm(props: UserFormProps) {
  if (props.mode === 'edit') {
    return <EditForm {...props} />;
  }
  return <CreateForm {...props} />;
}

// super_admin is intentionally absent from ACCOUNT_ROLE_CODES — the dropdown can never
// offer it (AC-5), and the backend rejects it as a defense-in-depth (AC-6).
function RoleSelect({ field }: { field: { value: string; onChange: (v: string) => void } }) {
  const { t } = useTranslation();
  return (
    <FormItem>
      <FormLabel>{t('account.users.form.roleLabel')}</FormLabel>
      <Select onValueChange={field.onChange} value={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {ACCOUNT_ROLE_CODES.map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormDescription>{t('account.users.form.roleHelp')}</FormDescription>
      <FormMessage />
    </FormItem>
  );
}

function CreateForm({ onSubmit, isPending }: UserFormCreateProps) {
  const { t } = useTranslation();

  const form = useForm<AccountUserCreateValues>({
    resolver: zodResolver(accountUserCreateSchema) as never,
    defaultValues: { name: '', email: '', password: '', roleCode: 'editor' },
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
                <FormLabel>{t('account.users.columns.name')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={255} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('account.users.columns.email')}</FormLabel>
                <FormControl>
                  <Input {...field} type="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('account.users.form.passwordLabel')}</FormLabel>
                <FormControl>
                  <Input {...field} type="password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField control={form.control} name="roleCode" render={({ field }) => <RoleSelect field={field} />} />

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}

function EditForm({ defaultValues, onSubmit, isPending }: UserFormEditProps) {
  const { t } = useTranslation();

  const form = useForm<AccountUserEditValues>({
    resolver: zodResolver(accountUserEditSchema) as never,
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
                <FormLabel>{t('account.users.columns.name')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={255} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('account.users.columns.email')}</FormLabel>
                <FormControl>
                  <Input {...field} type="email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField control={form.control} name="roleCode" render={({ field }) => <RoleSelect field={field} />} />

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>
        </form>
      </Form>
    </>
  );
}
