import { useCallback } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Mail } from 'lucide-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { useSuperAdminAccountsAll } from '../accounts/use-super-admin-accounts';
import {
  superAdminCreateUserSchema,
  superAdminEditUserSchema,
  type SuperAdminCreateUserValues,
  type SuperAdminEditUserValues,
} from './user-schema';
import { useRequestUserPasswordReset, useRemoveUserAccountMembership } from './use-super-admin-users';
import type { SuperAdminUser, SuperAdminUserAccount } from './types';

const ROLE_CODES = ['super_admin', 'admin', 'editor', 'analyst', 'support', 'billing'] as const;

interface UserFormCreateProps {
  mode: 'create';
  onSubmit: (data: SuperAdminCreateUserValues) => void;
  isPending: boolean;
}

interface UserFormEditProps {
  mode: 'edit';
  userId: number;
  defaultValues: SuperAdminEditUserValues;
  memberships: SuperAdminUserAccount[];
  onSubmit: (data: SuperAdminEditUserValues) => void;
  isPending: boolean;
}

type UserFormProps = UserFormCreateProps | UserFormEditProps;

export function SuperAdminUserForm(props: UserFormProps) {
  if (props.mode === 'edit') {
    return <EditForm {...props} />;
  }
  return <CreateForm {...props} />;
}

function CreateForm({ onSubmit, isPending }: UserFormCreateProps) {
  const { t } = useTranslation();
  const { data: allAccounts = [] } = useSuperAdminAccountsAll();

  const form = useForm<SuperAdminCreateUserValues>({
    resolver: zodResolver(superAdminCreateUserSchema) as never,
    defaultValues: {
      name: '',
      email: '',
      password: '',
      globalRoleCode: 'editor',
      accounts: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'accounts',
  });

  const globalRoleCode = form.watch('globalRoleCode');
  const isSuperAdmin = globalRoleCode === 'super_admin';

  const handleSubmit = (data: SuperAdminCreateUserValues) => {
    if (data.globalRoleCode === 'super_admin') {
      onSubmit({ ...data, accounts: [] });
      return;
    }
    onSubmit(data);
  };

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.users.name')}</FormLabel>
                <FormControl><Input {...field} maxLength={255} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.users.email')}</FormLabel>
                <FormControl><Input {...field} type="email" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.users.password')}</FormLabel>
                <FormControl><Input {...field} type="password" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="globalRoleCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.users.globalRole')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLE_CODES.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isSuperAdmin && (
            <>
              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>{t('superAdmin.users.accountMemberships')}</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ accountId: undefined as unknown as number, isMasterUser: false })}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t('superAdmin.users.addAccountMembership')}
                  </Button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`accounts.${index}.accountId`}
                      render={({ field: f }) => (
                        <FormItem className="flex-1">
                          <Select
                            onValueChange={(v) => f.onChange(Number(v))}
                            value={f.value ? String(f.value) : ''}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t('superAdmin.users.selectAccount')} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {allAccounts.map((a) => (
                                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => remove(index)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                {form.formState.errors.accounts?.root?.message && (
                  <p className="text-destructive text-sm">{form.formState.errors.accounts.root.message}</p>
                )}
              </div>
            </>
          )}

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

function EditForm({ userId, defaultValues, memberships, onSubmit, isPending }: UserFormEditProps) {
  const { t } = useTranslation();
  const removeMembership = useRemoveUserAccountMembership(userId);
  const resetPassword = useRequestUserPasswordReset(userId);

  const form = useForm<SuperAdminEditUserValues>({
    resolver: zodResolver(superAdminEditUserSchema) as never,
    defaultValues,
  });

  const handleRemoveMembership = useCallback(
    (accountId: number) => {
      removeMembership.mutate(accountId);
    },
    [removeMembership],
  );

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
                <FormLabel>{t('superAdmin.users.name')}</FormLabel>
                <FormControl><Input {...field} maxLength={255} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.users.email')}</FormLabel>
                <FormControl><Input {...field} type="email" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="globalRoleCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('superAdmin.users.globalRole')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLE_CODES.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>

          <Separator />

          <div className="space-y-3">
            <FormLabel>{t('superAdmin.users.accountMemberships')}</FormLabel>
            {memberships.length === 0 && (
              <p className="text-muted-foreground text-sm">{t('superAdmin.users.noMemberships')}</p>
            )}
            {memberships.map((m) => (
              <div key={m.accountId} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{m.account.name}</p>
                  {m.roleOverride && (
                    <p className="text-muted-foreground text-xs">{m.roleOverride}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleRemoveMembership(m.accountId)}
                  disabled={removeMembership.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          <div>
            <FormLabel>{t('superAdmin.users.resetPasswordSection')}</FormLabel>
            <p className="text-muted-foreground mb-3 text-sm">{t('superAdmin.users.resetPasswordHelp')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => resetPassword.mutate()}
              disabled={resetPassword.isPending}
            >
              <Mail className="mr-2 h-4 w-4" />
              {resetPassword.isPending ? t('common.loading') : t('superAdmin.users.sendPasswordReset')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
