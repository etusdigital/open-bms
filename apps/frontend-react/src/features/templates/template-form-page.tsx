import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { TemplateForm } from './template-form';
import { useTemplate, useCreateTemplate, useUpdateTemplate } from './use-templates';
import type { TemplateFormValues } from './template-schema';

interface TemplateFormPageProps {
  templateId?: number;
}

export function TemplateFormPage({ templateId }: TemplateFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = templateId !== undefined;

  const templateQuery = useTemplate(isEditing ? templateId : 0);
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate(templateId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: TemplateFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/templates', search: {} as never });
      },
    });
  };

  if (isEditing && templateQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('templates.edit')} backTo="/templates" backLabel={t('templates.pageTitle')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && templateQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('templates.edit')} backTo="/templates" backLabel={t('templates.pageTitle')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && templateQuery.data
      ? {
          name: templateQuery.data.name,
          description: templateQuery.data.description ?? '',
          html_template: templateQuery.data.html_template ?? '',
          json_template: templateQuery.data.json_template ?? '',
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('templates.edit') : t('templates.createTemplate')}
        backTo="/templates"
        backLabel={t('templates.pageTitle')}
      />
      <FormPage.Content className="w-full">
        <TemplateForm
          key={templateQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
