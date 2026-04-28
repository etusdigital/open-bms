import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import {
  customEventFormSchema,
  CUSTOM_EVENT_NAME_MAX,
  CUSTOM_EVENT_DESCRIPTION_MAX,
  type CustomEventFormValues,
} from './custom-event-schema';

interface CustomEventFormProps {
  defaultValues?: CustomEventFormValues;
  onSubmit: (data: CustomEventFormValues) => void;
  isPending: boolean;
  isDefault?: boolean;
}

export function CustomEventForm({ defaultValues, onSubmit, isPending, isDefault }: CustomEventFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<CustomEventFormValues>({
    resolver: zodResolver(customEventFormSchema) as never,
    defaultValues: defaultValues ?? { name: '', description: '' },
  });

  const nameLength = form.watch('name')?.length ?? 0;
  const descriptionLength = form.watch('description')?.length ?? 0;

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t('customEvents.name')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', { count: nameLength, max: CUSTOM_EVENT_NAME_MAX })}
                  </span>
                </div>
                <FormControl>
                  <Input {...field} maxLength={CUSTOM_EVENT_NAME_MAX} disabled={isDefault} />
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
                  <FormLabel>{t('customEvents.description')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', {
                      count: descriptionLength,
                      max: CUSTOM_EVENT_DESCRIPTION_MAX,
                    })}
                  </span>
                </div>
                <FormControl>
                  <Textarea rows={3} {...field} maxLength={CUSTOM_EVENT_DESCRIPTION_MAX} disabled={isDefault} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root?.serverError && (
            <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {form.formState.errors.root.serverError.message}
            </div>
          )}

          <Button type="submit" disabled={isPending || isDefault}>
            {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}
