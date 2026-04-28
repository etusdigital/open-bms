import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { FormPage } from '@/components/form-page';
import { CustomEventForm } from './custom-event-form';
import { useCustomEvent, useCreateCustomEvent, useUpdateCustomEvent } from './use-custom-events';
import type { CustomEventFormValues } from './custom-event-schema';

interface CustomEventFormPageProps {
  customEventId?: number;
}

export function CustomEventFormPage({ customEventId }: CustomEventFormPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isEditing = customEventId !== undefined;

  const eventQuery = useCustomEvent(isEditing ? customEventId : 0);
  const createMutation = useCreateCustomEvent();
  const updateMutation = useUpdateCustomEvent(customEventId ?? 0);
  const mutation = isEditing ? updateMutation : createMutation;

  const handleSubmit = (data: CustomEventFormValues) => {
    mutation.mutate(data, {
      onSuccess: () => {
        navigate({ to: '/custom-events', search: {} as never });
      },
    });
  };

  if (isEditing && eventQuery.isLoading) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('customEvents.edit')}
          backTo="/custom-events"
          backLabel={t('customEvents.pageTitle')}
        />
        <FormPage.Content>
          <FormPage.LoadingSkeleton />
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  if (isEditing && eventQuery.error) {
    return (
      <FormPage.Root>
        <FormPage.Header
          title={t('customEvents.edit')}
          backTo="/custom-events"
          backLabel={t('customEvents.pageTitle')}
        />
        <FormPage.Content>
          <p className="text-muted-foreground text-sm">{t('common.entityNotFound')}</p>
        </FormPage.Content>
      </FormPage.Root>
    );
  }

  const defaultValues =
    isEditing && eventQuery.data
      ? {
          name: eventQuery.data.name,
          description: eventQuery.data.description ?? '',
        }
      : undefined;

  return (
    <FormPage.Root>
      <FormPage.Header
        title={isEditing ? t('customEvents.edit') : t('customEvents.createEvent')}
        backTo="/custom-events"
        backLabel={t('customEvents.pageTitle')}
      />
      <FormPage.Content>
        <CustomEventForm
          key={eventQuery.data?.id}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={mutation.isPending}
          isDefault={eventQuery.data?.isDefault}
        />
      </FormPage.Content>
    </FormPage.Root>
  );
}
