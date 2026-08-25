import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { CustomFieldForm } from './custom-field-form';
import { useCustomField, useCreateCustomField, useUpdateCustomField } from './use-custom-fields';
import type { CustomFieldFormValues } from './custom-field-schema';

interface CustomFieldFormPageProps {
  customFieldId?: number;
}

export function CustomFieldFormPage({ customFieldId }: CustomFieldFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = customFieldId !== undefined;

  const fieldQuery = useCustomField(isEditing ? customFieldId : 0);
  const createMutation = useCreateCustomField();
  const updateMutation = useUpdateCustomField(customFieldId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: CustomFieldFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/customfields', search: {} as never });
      },
    });
  };

  if (isEditing && fieldQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('customFields.edit')}
          backTo="/customfields"
          backLabel={t('customFields.pageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && fieldQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('customFields.edit')}
          backTo="/customfields"
          backLabel={t('customFields.pageTitle')}
        />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues: CustomFieldFormValues | undefined =
    isEditing && fieldQuery.data
      ? {
          title: fieldQuery.data.title,
          description: fieldQuery.data.description ?? '',
          type: fieldQuery.data.type as CustomFieldFormValues['type'],
          label: fieldQuery.data.label ?? undefined,
          placeholder: fieldQuery.data.placeholder ?? undefined,
          mask: fieldQuery.data.mask ?? undefined,
          fieldFormat: fieldQuery.data.fieldFormat ?? undefined,
          fieldType: fieldQuery.data.fieldType ?? undefined,
          fileFormats: fieldQuery.data.fileFormats ?? undefined,
          characterLimit: fieldQuery.data.characterLimit ?? undefined,
          decimalLength: fieldQuery.data.decimalLength ?? undefined,
          options: fieldQuery.data.options ?? undefined,
          attributionType:
            (fieldQuery.data.attributionType as CustomFieldFormValues['attributionType']) ?? undefined,
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('customFields.edit') : t('customFields.createField')}
        backTo="/customfields"
        backLabel={t('customFields.pageTitle')}
      />
      <FormPage.Content>
        <CustomFieldForm
          key={fieldQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
