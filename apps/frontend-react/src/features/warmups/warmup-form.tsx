import { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { SearchableApiSelect } from '@/features/segments/builder/searchable-api-select';
import { warmupFormSchema, WARMUP_DESCRIPTION_MAX, type WarmupFormValues } from './warmup-schema';
import { TARGET_OPTIONS } from './constants';
import { useAccountsList } from './use-accounts-list';
import { usePoolsByAccount } from './use-pools-by-account';
import { useSegmentsByAccount } from './use-segments-by-account';
import { WarmupPreviewChart } from './components/warmup-preview-chart';
import type { UseFormReturn } from 'react-hook-form';

interface WarmupFormProps {
  defaultValues?: WarmupFormValues;
  onSubmit: (data: WarmupFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
}

/** Description field with character counter — isolated to avoid re-rendering the parent on every keystroke */
function DescriptionField({ control }: { control: UseFormReturn<WarmupFormValues>['control'] }) {
  const { t } = useTranslation();
  const descriptionLength = useWatch({ control, name: 'description' })?.length ?? 0;

  return (
    <FormField
      control={control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel>{t('warmups.description')}</FormLabel>
            <span className="text-muted-foreground text-xs">
              {descriptionLength}/{WARMUP_DESCRIPTION_MAX}
            </span>
          </div>
          <FormControl>
            <Textarea rows={3} {...field} maxLength={WARMUP_DESCRIPTION_MAX} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Account config card — isolates watches for accountId and type */
function AccountConfigCard({ form, isEditing }: { form: UseFormReturn<WarmupFormValues>; isEditing: boolean }) {
  const { t } = useTranslation();
  const accountOptions = useAccountsList();

  const watchedAccountId = useWatch({ control: form.control, name: 'accountId' });
  const watchedType = useWatch({ control: form.control, name: 'type' });
  const { data: pools } = usePoolsByAccount(watchedAccountId);
  const [selectedPoolId, setSelectedPoolId] = useState('');

  const handleAccountChange = (val: string) => {
    form.setValue('accountId', Number(val), { shouldDirty: true });
    // Reset pool-related fields when account changes (only in create mode)
    if (!isEditing) {
      form.setValue('sender', '');
      form.setValue('ippool', '');
      form.setValue('replyTo', '');
      setSelectedPoolId('');
    }
  };

  const handlePoolSelect = (poolId: string) => {
    const pool = pools?.find((p) => String(p.id) === poolId);
    if (pool) {
      setSelectedPoolId(poolId);
      form.setValue('sender', pool.senderEmail, { shouldDirty: true });
      form.setValue('ippool', pool.poolName, { shouldDirty: true });
      form.setValue('replyTo', pool.senderReplyTo ?? '', { shouldDirty: true });
    }
  };

  const handleInternalChange = (checked: boolean) => {
    if (checked) {
      form.setValue('type', 'internal', { shouldDirty: true });
      form.setValue('stage', 1, { shouldDirty: true });
    } else {
      form.setValue('type', 'external', { shouldDirty: true });
      form.setValue('stage', null, { shouldDirty: true });
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h3 className="text-muted-foreground text-sm font-medium">{t('warmups.accountConfig')}</h3>

        <FormField
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('warmups.account')}</FormLabel>
              <FormControl>
                <SearchableApiSelect
                  value={field.value ? String(field.value) : ''}
                  onValueChange={handleAccountChange}
                  options={accountOptions}
                  placeholder={t('warmups.searchAccount')}
                  className="w-full"
                  popoverClassName="w-[var(--radix-popover-trigger-width)]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>{t('warmups.pool')}</FormLabel>
          <Select
            value={selectedPoolId}
            onValueChange={handlePoolSelect}
            disabled={!watchedAccountId || watchedAccountId === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={watchedAccountId > 0 ? t('warmups.searchPool') : t('warmups.selectAccountFirst')}
              />
            </SelectTrigger>
            <SelectContent>
              {(pools ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.senderEmail}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>

        <DescriptionField control={form.control} />

        <div className="flex items-center gap-2">
          <Checkbox id="isInternal" checked={watchedType === 'internal'} onCheckedChange={handleInternalChange} />
          <label htmlFor="isInternal" className="cursor-pointer text-sm">
            {t('warmups.isInternalWarmup')}
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

/** Execution account card — isolates watch for targetAccountId */
function ExecutionAccountCard({ form }: { form: UseFormReturn<WarmupFormValues> }) {
  const { t } = useTranslation();
  const accountOptions = useAccountsList();

  const watchedTargetAccountId = useWatch({ control: form.control, name: 'targetAccountId' });
  const watchedTargetSegmentId = useWatch({ control: form.control, name: 'targetSegmentId' });

  const { data: segments } = useSegmentsByAccount(watchedTargetAccountId);

  const segmentOptions = useMemo(
    () => (segments ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [segments],
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h3 className="text-muted-foreground text-sm font-medium">{t('warmups.executionAccount')}</h3>

        <FormField
          control={form.control}
          name="targetAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('warmups.targetAccount')}</FormLabel>
              <FormControl>
                <SearchableApiSelect
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(val) => field.onChange(Number(val))}
                  options={accountOptions}
                  placeholder={t('warmups.searchAccount')}
                  className="w-full"
                  popoverClassName="w-[var(--radix-popover-trigger-width)]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>{t('warmups.segment')}</FormLabel>
          <SearchableApiSelect
            value={watchedTargetSegmentId ? String(watchedTargetSegmentId) : ''}
            onValueChange={(val) => form.setValue('targetSegmentId', Number(val), { shouldDirty: true })}
            options={segmentOptions}
            placeholder={watchedTargetAccountId > 0 ? t('warmups.searchSegment') : t('warmups.selectAccountFirst')}
            disabled={!watchedTargetAccountId || watchedTargetAccountId === 0}
            className="w-full"
            popoverClassName="w-[var(--radix-popover-trigger-width)]"
          />
        </FormItem>
      </CardContent>
    </Card>
  );
}

/** Target config card — isolates watch for target */
function TargetConfigCard({ form }: { form: UseFormReturn<WarmupFormValues> }) {
  const { t } = useTranslation();
  const watchedTarget = useWatch({ control: form.control, name: 'target' });

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h3 className="text-muted-foreground text-sm font-medium">{t('warmups.targetConfig')}</h3>

        <FormField
          control={form.control}
          name="target"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('warmups.dailyTarget')}</FormLabel>
              <Select
                value={field.value ? String(field.value) : ''}
                onValueChange={(val) => field.onChange(Number(val))}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('warmups.selectTarget')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TARGET_OPTIONS.map((opt) => (
                    <SelectItem key={opt.target} value={String(opt.target)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <WarmupPreviewChart selectedTarget={watchedTarget || null} />
      </CardContent>
    </Card>
  );
}

export function WarmupForm({ defaultValues, onSubmit, onCancel, isPending }: WarmupFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<WarmupFormValues>({
    resolver: zodResolver(warmupFormSchema) as never,
    defaultValues: defaultValues ?? {
      accountId: 0,
      targetAccountId: 0,
      sender: '',
      ippool: '',
      replyTo: '',
      target: 0,
      type: 'external',
      stage: null,
      description: '',
    },
  });

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <AccountConfigCard form={form} isEditing={isEditing} />
          <ExecutionAccountCard form={form} />
          <TargetConfigCard form={form} />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
