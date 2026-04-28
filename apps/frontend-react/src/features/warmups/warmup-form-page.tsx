import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { WarmupForm } from './warmup-form';
import { useWarmup, useCreateWarmup, useUpdateWarmup } from './use-warmups';
import type { WarmupFormValues } from './warmup-schema';

interface WarmupFormPageProps {
  warmupId?: number;
}

export function WarmupFormPage({ warmupId }: WarmupFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = warmupId !== undefined;

  const warmupQuery = useWarmup(isEditing ? warmupId : 0);
  const createMutation = useCreateWarmup();
  const updateMutation = useUpdateWarmup(warmupId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleCancel = () => {
    if (isEditing) {
      navigate({ to: '/warmups/$warmupId', params: { warmupId: String(warmupId) } });
    } else {
      navigate({ to: '/warmups', search: {} as never });
    }
  };

  const handleSubmit = (data: WarmupFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        if (isEditing) {
          navigate({ to: '/warmups/$warmupId', params: { warmupId: String(warmupId) } });
        } else {
          navigate({ to: '/warmups', search: {} as never });
        }
      },
    });
  };

  if (isEditing && warmupQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('warmups.edit')}
          backTo={isEditing ? `/warmups/${warmupId}` : '/warmups'}
          backLabel={t('warmups.pageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && warmupQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('warmups.edit')}
          backTo={isEditing ? `/warmups/${warmupId}` : '/warmups'}
          backLabel={t('warmups.pageTitle')}
        />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && warmupQuery.data
      ? {
          accountId: warmupQuery.data.accountId,
          targetAccountId: warmupQuery.data.targetAccountId,
          sender: warmupQuery.data.sender,
          ippool: warmupQuery.data.ippool,
          replyTo: warmupQuery.data.replyTo ?? '',
          target: warmupQuery.data.target,
          targetSegmentId: warmupQuery.data.targetSegmentId,
          type: warmupQuery.data.type as 'internal' | 'external',
          stage: warmupQuery.data.stage ?? null,
          description: warmupQuery.data.description ?? '',
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('warmups.edit') : t('warmups.createWarmup')}
        backTo={isEditing ? `/warmups/${warmupId}` : '/warmups'}
        backLabel={t('warmups.pageTitle')}
      />
      <FormPage.Content>
        <WarmupForm
          key={warmupQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isPending={mutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
