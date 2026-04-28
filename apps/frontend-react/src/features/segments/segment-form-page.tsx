import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { SegmentForm } from './segment-form';
import { useSegment, useCreateSegment, useUpdateSegment } from './use-segments';
import type { SegmentFormValues } from './segment-schema';

interface SegmentFormPageProps {
  segmentId?: number;
}

export function SegmentFormPage({ segmentId }: SegmentFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = segmentId !== undefined;

  const segmentQuery = useSegment(isEditing ? segmentId : 0);
  const createMutation = useCreateSegment();
  const updateMutation = useUpdateSegment(segmentId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: SegmentFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/segments', search: {} as never });
      },
    });
  };

  if (isEditing && segmentQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('segments.edit')} backTo="/segments" backLabel={t('segments.pageTitle')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && segmentQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('segments.edit')} backTo="/segments" backLabel={t('segments.pageTitle')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && segmentQuery.data
      ? {
          name: segmentQuery.data.name,
          description: segmentQuery.data.description ?? '',
          contactsLimit: segmentQuery.data.contactsLimit ?? null,
          recurrence: segmentQuery.data.recurrence ?? 24,
          addBounced: segmentQuery.data.addBounced ?? false,
          addUnsubscribed: segmentQuery.data.addUnsubscribed ?? false,
          addInvalid: segmentQuery.data.addInvalid ?? false,
          isRealTimeSegment: segmentQuery.data.isRealTimeSegment ?? false,
          isClickhouseSegment: segmentQuery.data.isClickhouseSegment ?? false,
          steps: segmentQuery.data.steps ?? '[]',
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('segments.edit') : t('segments.createSegment')}
        backTo="/segments"
        backLabel={t('segments.pageTitle')}
      />
      <FormPage.Content className="max-w-full">
        <SegmentForm
          key={segmentQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
          segment={segmentQuery.data}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
