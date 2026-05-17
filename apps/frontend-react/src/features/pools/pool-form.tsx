import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import {
  poolFormSchema,
  POOL_NAME_MAX,
  POOL_DESCRIPTION_MAX,
  type PoolFormValues,
} from './pool-schema';
import type { SendGridPool } from './types';

interface PoolFormProps {
  defaultValues?: PoolFormValues;
  onSubmit: (data: PoolFormValues) => void;
  isPending: boolean;
  sendGridPools?: SendGridPool[];
  sendGridPoolsLoading?: boolean;
}

export function PoolForm({ defaultValues, onSubmit, isPending, sendGridPools, sendGridPoolsLoading }: PoolFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<PoolFormValues>({
    resolver: zodResolver(poolFormSchema) as never,
    defaultValues: defaultValues ?? {
      name: '',
      description: '',
      poolName: '',
      isDefault: false,
      ip: '',
      dailyLimit: '0',
      sendingLimit: '0',
    },
  });

  const nameLength = form.watch('name')?.length ?? 0;
  const descriptionLength = form.watch('description')?.length ?? 0;

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-sm font-medium">{t('pools.basicInfo')}</h3>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t('pools.name')}</FormLabel>
                    <span className="text-muted-foreground text-xs">
                      {t('validation.charCount', { count: nameLength, max: POOL_NAME_MAX })}
                    </span>
                  </div>
                  <FormControl>
                    <Input {...field} maxLength={POOL_NAME_MAX} />
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
                  <div className="flex items-center justify-between">
                    <FormLabel>{t('pools.description')}</FormLabel>
                    <span className="text-muted-foreground text-xs">
                      {t('validation.charCount', {
                        count: descriptionLength,
                        max: POOL_DESCRIPTION_MAX,
                      })}
                    </span>
                  </div>
                  <FormControl>
                    <Textarea rows={3} {...field} maxLength={POOL_DESCRIPTION_MAX} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Pool Configuration Section */}
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-sm font-medium">{t('pools.poolConfig')}</h3>

            {!sendGridPoolsLoading && (sendGridPools?.length ?? 0) === 0 ? (
              // Free/Essentials SendGrid plans don't expose dedicated IP pools.
              // We hide the dropdown entirely and tell the user that sends
              // will use SendGrid's shared IPs by default — same effect as
              // omitting `ip_pool_name` in the mail/send payload.
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-xs font-medium">{t('pools.noSendgridPoolsTitle')}</p>
                <p className="text-muted-foreground mt-1 text-xs">{t('pools.noSendgridPoolsHelp')}</p>
              </div>
            ) : (
              <FormField
                control={form.control}
                name="poolName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pools.poolName')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={sendGridPoolsLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('pools.selectPool')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sendGridPools?.map((pool) => (
                          <SelectItem key={pool.name} value={pool.name}>
                            {pool.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dailyLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pools.dailyLimit')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" />
                    </FormControl>
                    <FormDescription>{t('pools.limitHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sendingLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pools.sendingLimit')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" />
                    </FormControl>
                    <FormDescription>{t('pools.limitHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}
