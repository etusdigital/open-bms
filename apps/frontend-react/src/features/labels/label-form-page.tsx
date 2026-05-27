import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { LabelForm } from './label-form';
import { useLabel, useCreateLabel, useUpdateLabel } from './use-labels';
import type { LabelFormValues } from './label-schema';

interface LabelFormPageProps {
  labelId?: number;
}

export function LabelFormPage({ labelId }: LabelFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = labelId !== undefined;

  const labelQuery = useLabel(isEditing ? labelId : 0);
  const createMutation = useCreateLabel();
  const updateMutation = useUpdateLabel(labelId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: LabelFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/labels', search: {} as never });
      },
    });
  };

  if (isEditing && labelQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('labels.edit')} backTo="/labels" backLabel={t('labels.pageTitle')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && labelQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('labels.edit')} backTo="/labels" backLabel={t('labels.pageTitle')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && labelQuery.data
      ? {
          name: labelQuery.data.name,
          description: labelQuery.data.description ?? '',
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('labels.edit') : t('labels.createLabel')}
        backTo="/labels"
        backLabel={t('labels.pageTitle')}
      />
      <FormPage.Content>
        <LabelForm
          key={labelQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
