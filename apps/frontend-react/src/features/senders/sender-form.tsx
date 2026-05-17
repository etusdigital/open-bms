import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { senderFormSchema, type SenderFormValues } from './sender-schema';

interface SenderFormProps {
  senderName: string;
  senderEmail: string;
  defaultValues: SenderFormValues;
  onSubmit: (data: SenderFormValues) => void;
  isPending: boolean;
}

export function SenderForm({ senderName, senderEmail, defaultValues, onSubmit, isPending }: SenderFormProps) {
  const { t } = useTranslation();

  const form = useForm<SenderFormValues>({
    resolver: zodResolver(senderFormSchema) as never,
    defaultValues,
  });

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Identity Section (read-only — owned by SendGrid) */}
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-sm font-medium">{t('senders.basicInfo')}</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem>
                <FormLabel>{t('senders.senderName')}</FormLabel>
                <FormControl>
                  <Input value={senderName} disabled readOnly />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>{t('senders.senderEmail')}</FormLabel>
                <FormControl>
                  <Input value={senderEmail} disabled readOnly />
                </FormControl>
              </FormItem>
            </div>
          </div>

          {/* Editable Section */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="senderReplyTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('senders.senderReplyTo')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="reply@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sendingLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('senders.sendingLimit')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" />
                    </FormControl>
                    <FormDescription>{t('senders.limitHelp')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : t('common.save')}
          </Button>
        </form>
      </Form>
    </>
  );
}
