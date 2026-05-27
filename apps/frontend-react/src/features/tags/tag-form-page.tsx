import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { TagForm } from './tag-form';
import { useTag, useCreateTag, useUpdateTag } from './use-tags';
import type { TagFormValues } from './tag-schema';

interface TagFormPageProps {
  tagId?: number;
}

export function TagFormPage({ tagId }: TagFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = tagId !== undefined;

  const tagQuery = useTag(isEditing ? tagId : 0);
  const createMutation = useCreateTag();
  const updateMutation = useUpdateTag(tagId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: TagFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/tags', search: {} as never });
      },
    });
  };

  if (isEditing && tagQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('tags.edit')} backTo="/tags" backLabel={t('tags.title')} />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && tagQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header title={t('tags.edit')} backTo="/tags" backLabel={t('tags.title')} />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && tagQuery.data ? { name: tagQuery.data.name, description: tagQuery.data.description ?? '' } : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('tags.edit') : t('tags.createTag')}
        backTo="/tags"
        backLabel={t('tags.title')}
      />
      <FormPage.Content>
        <TagForm defaultValues={defaultValues} onSubmit={handleSubmit} isPending={mutation.isPending} />
      </FormPage.Content>
    </FormPage.Root>
  );
}
