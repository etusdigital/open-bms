import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { labelFormSchema, LABEL_NAME_MAX, LABEL_DESCRIPTION_MAX, type LabelFormValues } from './label-schema';

interface LabelFormProps {
  defaultValues?: LabelFormValues;
  onSubmit: (data: LabelFormValues) => void;
  isPending: boolean;
}

export function LabelForm({ defaultValues, onSubmit, isPending }: LabelFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<LabelFormValues>({
    resolver: zodResolver(labelFormSchema) as never,
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
                  <FormLabel>{t('labels.name')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', { count: nameLength, max: LABEL_NAME_MAX })}
                  </span>
                </div>
                <FormControl>
                  <Input {...field} maxLength={LABEL_NAME_MAX} />
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
                  <FormLabel>{t('labels.description')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', {
                      count: descriptionLength,
                      max: LABEL_DESCRIPTION_MAX,
                    })}
                  </span>
                </div>
                <FormControl>
                  <Textarea rows={3} {...field} maxLength={LABEL_DESCRIPTION_MAX} />
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

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}
