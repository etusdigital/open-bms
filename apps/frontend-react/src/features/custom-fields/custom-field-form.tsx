import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import {
  customFieldFormSchema,
  CUSTOM_FIELD_TITLE_MAX,
  CUSTOM_FIELD_DESCRIPTION_MAX,
  CUSTOM_FIELD_TYPES,
  type CustomFieldFormValues,
} from './custom-field-schema';

interface CustomFieldFormProps {
  defaultValues?: CustomFieldFormValues;
  onSubmit: (data: CustomFieldFormValues) => void;
  isPending: boolean;
}

export function CustomFieldForm({ defaultValues, onSubmit, isPending }: CustomFieldFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<CustomFieldFormValues>({
    resolver: zodResolver(customFieldFormSchema) as never,
    defaultValues: defaultValues ?? {
      title: '',
      description: '',
      type: undefined as unknown as CustomFieldFormValues['type'],
    },
  });

  const titleLength = form.watch('title')?.length ?? 0;
  const descriptionLength = form.watch('description')?.length ?? 0;

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t('customFields.title')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', { count: titleLength, max: CUSTOM_FIELD_TITLE_MAX })}
                  </span>
                </div>
                <FormControl>
                  <Input {...field} maxLength={CUSTOM_FIELD_TITLE_MAX} />
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
                  <FormLabel>{t('customFields.description')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', {
                      count: descriptionLength,
                      max: CUSTOM_FIELD_DESCRIPTION_MAX,
                    })}
                  </span>
                </div>
                <FormControl>
                  <Textarea rows={3} {...field} maxLength={CUSTOM_FIELD_DESCRIPTION_MAX} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('customFields.type')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('customFields.selectType')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CUSTOM_FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`customFields.type${type.charAt(0).toUpperCase()}${type.slice(1)}` as never)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
