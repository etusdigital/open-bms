import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Type, Hash, Calendar, List, FileText, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { CustomFieldSettings } from './custom-field-settings';
import {
  customFieldFormSchema,
  CUSTOM_FIELD_TITLE_MAX,
  CUSTOM_FIELD_DESCRIPTION_MAX,
  CUSTOM_FIELD_TYPES,
  type CustomFieldType,
  type CustomFieldFormValues,
} from './custom-field-schema';

interface CustomFieldFormProps {
  defaultValues?: CustomFieldFormValues;
  onSubmit: (data: CustomFieldFormValues) => void;
  isPending: boolean;
}

const TYPE_ICONS: Record<CustomFieldType, LucideIcon> = {
  text: Type,
  number: Hash,
  date: Calendar,
  list: List,
  file: FileText,
};

// Per-type settings to clear when the user switches type (mirrors the source
// project): keep title/description/attributionType, reset everything else.
const TYPE_SPECIFIC_FIELDS = [
  'label',
  'placeholder',
  'mask',
  'fieldFormat',
  'fieldType',
  'fileFormats',
  'characterLimit',
  'decimalLength',
  'options',
] as const;

export function CustomFieldForm({ defaultValues, onSubmit, isPending }: CustomFieldFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<CustomFieldFormValues>({
    resolver: zodResolver(customFieldFormSchema) as never,
    defaultValues: defaultValues ?? {
      title: '',
      description: '',
      type: undefined as unknown as CustomFieldFormValues['type'],
      attributionType: 'first',
      options: [''],
    },
  });

  const titleLength = form.watch('title')?.length ?? 0;
  const descriptionLength = form.watch('description')?.length ?? 0;
  const selectedType = form.watch('type') as CustomFieldType | undefined;

  const selectType = (type: CustomFieldType) => {
    // Type is immutable once the field exists (it changes how data is stored).
    if (isEditing) return;
    if (type === selectedType) return;
    form.setValue('type', type, { shouldDirty: true, shouldValidate: true });
    for (const key of TYPE_SPECIFIC_FIELDS) {
      form.setValue(key, undefined, { shouldDirty: true });
    }
    // Seed the list with one empty option so the editor isn't blank.
    if (type === 'list') form.setValue('options', ['']);
  };

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('customFields.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          {/* Field type picker */}
          <Card>
            <CardHeader>
              <CardTitle>{t('customFields.fieldTypeSection')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="type"
                render={() => (
                  <FormItem>
                    <div
                      role="radiogroup"
                      aria-label={t('customFields.type')}
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
                    >
                      {CUSTOM_FIELD_TYPES.map((type) => {
                        const Icon = TYPE_ICONS[type];
                        const active = selectedType === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={isEditing}
                            onClick={() => selectType(type)}
                            className={cn(
                              'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                              active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                              isEditing && 'cursor-not-allowed opacity-50',
                            )}
                          >
                            <Icon className={cn('h-7 w-7 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                            <span className={cn('text-sm font-medium', active && 'text-primary')}>
                              {t(`customFields.type${type.charAt(0).toUpperCase()}${type.slice(1)}` as never)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Per-type additional settings */}
          {selectedType && (
            <Card>
              <CardHeader>
                <CardTitle>{t('customFields.additionalSettings')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomFieldSettings type={selectedType} isEditing={isEditing} />
              </CardContent>
            </Card>
          )}

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
