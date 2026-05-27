import { useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import EmailEditor, { type EditorRef } from 'react-email-editor';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import {
  templateFormSchema,
  TEMPLATE_NAME_MAX,
  TEMPLATE_DESCRIPTION_MAX,
  type TemplateFormValues,
} from './template-schema';

interface TemplateFormProps {
  defaultValues?: TemplateFormValues;
  onSubmit: (data: TemplateFormValues) => void;
  isPending: boolean;
}

export function TemplateForm({ defaultValues, onSubmit, isPending }: TemplateFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;
  const emailEditorRef = useRef<EditorRef>(null);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema) as never,
    defaultValues: defaultValues ?? {
      name: '',
      description: '',
      html_template: '',
      json_template: '',
    },
  });

  const nameLength = form.watch('name')?.length ?? 0;
  const descriptionLength = form.watch('description')?.length ?? 0;

  const handleEditorReady = useCallback(() => {
    if (defaultValues?.json_template) {
      try {
        const design = JSON.parse(defaultValues.json_template);
        emailEditorRef.current?.editor?.loadDesign(design);
      } catch {
        // Invalid JSON — editor starts empty
      }
    }
  }, [defaultValues?.json_template]);

  const handleSubmit = useCallback(
    (formData: TemplateFormValues) => {
      const editor = emailEditorRef.current?.editor;
      if (!editor) {
        onSubmit(formData);
        return;
      }

      editor.exportHtml((data: { design: object; html: string }) => {
        onSubmit({
          ...formData,
          html_template: data.html,
          json_template: JSON.stringify(data.design),
        });
      });
    },
    [onSubmit],
  );

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t('templates.name')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', { count: nameLength, max: TEMPLATE_NAME_MAX })}
                  </span>
                </div>
                <FormControl>
                  <Input {...field} maxLength={TEMPLATE_NAME_MAX} />
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
                  <FormLabel>{t('templates.description')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', {
                      count: descriptionLength,
                      max: TEMPLATE_DESCRIPTION_MAX,
                    })}
                  </span>
                </div>
                <FormControl>
                  <Textarea rows={3} {...field} maxLength={TEMPLATE_DESCRIPTION_MAX} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <label className="text-sm leading-none font-medium">{t('templates.editor')}</label>
            <div className="mt-2 rounded-md border [&_iframe]:!h-[700px]">
              <EmailEditor
                ref={emailEditorRef}
                onReady={handleEditorReady}
                minHeight={700}
                options={{
                  locale: 'pt-BR',
                  appearance: { theme: 'modern_dark' },
                }}
              />
            </div>
          </div>

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
