import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { PoolForm } from './pool-form';
import { usePool, useCreatePool, useUpdatePool, useSendGridPools } from './use-pools';
import type { PoolFormValues } from './pool-schema';

interface PoolFormPageProps {
  poolId?: number;
}

export function PoolFormPage({ poolId }: PoolFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = poolId !== undefined;

  const poolQuery = usePool(isEditing ? poolId : 0);
  const createMutation = useCreatePool();
  const updateMutation = useUpdatePool(poolId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;
  const sendGridPoolsQuery = useSendGridPools();

  const handleSubmit = (data: PoolFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/pools', search: {} as never });
      },
    });
  };

  if (isEditing && poolQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('pools.edit')} backTo="/pools" backLabel={t('pools.pageTitle')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && poolQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('pools.edit')} backTo="/pools" backLabel={t('pools.pageTitle')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && poolQuery.data
      ? {
          name: poolQuery.data.name,
          description: poolQuery.data.description ?? '',
          poolName: poolQuery.data.poolName,
          senderEmail: poolQuery.data.senderEmail ?? '',
          senderName: poolQuery.data.senderName ?? '',
          senderReplyTo: poolQuery.data.senderReplyTo ?? '',
          isDefault: poolQuery.data.isDefault ?? false,
          ip: poolQuery.data.ip ?? '',
          dailyLimit: poolQuery.data.dailyLimit ?? '0',
          sendingLimit: poolQuery.data.sendingLimit ?? '0',
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('pools.edit') : t('pools.createPool')}
        backTo="/pools"
        backLabel={t('pools.pageTitle')}
      />
      <FormPage.Content>
        <PoolForm
          key={poolQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
          sendGridPools={sendGridPoolsQuery.data}
          sendGridPoolsLoading={sendGridPoolsQuery.isLoading}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
