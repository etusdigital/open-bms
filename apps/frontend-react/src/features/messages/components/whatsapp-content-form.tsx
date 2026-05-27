import { useState, useRef, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Check, ExternalLink, Smile, Braces, Trash2 } from 'lucide-react';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { whatsappFormSchema } from '../message-schema';
import type { z } from 'zod';

type WhatsAppFormInput = z.input<typeof whatsappFormSchema>;
import { MergeFieldsModal } from './merge-fields-modal';

interface WhatsAppContentFormProps {
  disabled?: boolean;
}

export function WhatsAppContentForm({ disabled }: WhatsAppContentFormProps) {
  const { t } = useTranslation();
  const form = useFormContext<WhatsAppFormInput>();
  const headerType = form.watch('headerType') ?? 'none';
  const whatsappType = form.watch('whatsappType') ?? 'text';
  const isCallToAction = whatsappType === 'call-to-action';

  const headerContent = form.watch('headerContent') ?? '';
  const content = form.watch('content') ?? '';
  const footer = form.watch('footer') ?? '';
  const callToActionText = form.watch('callToActionText') ?? '';

  const [fileInputKey, setFileInputKey] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mergeFieldsOpen, setMergeFieldsOpen] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const textarea = contentRef.current;
    const currentValue = form.getValues('content') ?? '';

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = currentValue.slice(0, start) + emojiData.emoji + currentValue.slice(end);
      form.setValue('content', newValue, { shouldDirty: true });
    } else {
      form.setValue('content', currentValue + emojiData.emoji, { shouldDirty: true });
    }
    setEmojiOpen(false);
  };

  const handleInsertField = useCallback(
    (tag: string) => {
      const textarea = contentRef.current;
      const currentValue = form.getValues('content') ?? '';

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = currentValue.slice(0, start) + tag + currentValue.slice(end);
        form.setValue('content', newValue, { shouldDirty: true });
        setTimeout(() => {
          textarea.focus();
          const pos = start + tag.length;
          textarea.setSelectionRange(pos, pos);
        }, 0);
      } else {
        form.setValue('content', currentValue + tag, { shouldDirty: true });
      }
      setMergeFieldsOpen(false);
    },
    [form],
  );

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: Form fields */}
      <fieldset disabled={disabled} className="space-y-4">
        {disabled && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
            {t('messages.formDisabledNotDraft')}
          </div>
        )}

        {/* Header Type */}
        <FormField
          control={form.control}
          name="headerType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.headerType')}</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue('headerContent', '', { shouldDirty: true });
                  setFileInputKey((k) => k + 1);
                }}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">{t('messages.headerNone')}</SelectItem>
                  <SelectItem value="text">{t('messages.headerText')}</SelectItem>
                  <SelectItem value="image">{t('messages.headerImage')}</SelectItem>
                  <SelectItem value="video">{t('messages.headerVideo')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Header Content - conditional based on headerType */}
        {headerType === 'text' && (
          <FormField
            control={form.control}
            name="headerContent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('messages.headerContent')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(headerType === 'image' || headerType === 'video') && (
          <FormField
            control={form.control}
            name="headerContent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('messages.chooseFile')}</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Input
                      key={fileInputKey}
                      type="file"
                      accept={headerType === 'image' ? 'image/png, image/jpeg' : 'video/mp4'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => field.onChange(reader.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                    {field.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => {
                          field.onChange('');
                          setFileInputKey((k) => k + 1);
                        }}
                        aria-label={t('common.remove')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Body Text with emoji picker */}
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.bodyText')}</FormLabel>
              <div className="relative">
                <FormControl>
                  <Textarea
                    rows={3}
                    {...field}
                    ref={(el) => {
                      field.ref(el);
                      (contentRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                    }}
                    className="pr-20"
                  />
                </FormControl>
                <div className="absolute top-1 right-1 flex gap-0.5">
                  <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground h-8 w-8"
                      >
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" side="right" align="start">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        width={350}
                        height={400}
                        searchPlaceholder={t('common.search')}
                        previewConfig={{ showPreview: false }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground h-8 w-8"
                    onClick={() => setMergeFieldsOpen(true)}
                    aria-label={t('messages.mergeFields')}
                  >
                    <Braces className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Footer */}
        <FormField
          control={form.control}
          name="footer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.footer')}</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Content Type */}
        <FormField
          control={form.control}
          name="whatsappType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.contentType')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="text">{t('messages.contentTypeText')}</SelectItem>
                  <SelectItem value="call-to-action">{t('messages.contentTypeCallToAction')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Call to Action fields */}
        {isCallToAction && (
          <>
            <FormField
              control={form.control}
              name="callToActionText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('messages.buttonText')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="callToActionUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('messages.buttonUrl')}</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <MergeFieldsModal open={mergeFieldsOpen} onOpenChange={setMergeFieldsOpen} onInsert={handleInsertField} />
      </fieldset>

      {/* Right: WhatsApp Preview */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('messages.whatsappPreview')}</p>
        <div
          data-testid="whatsapp-preview"
          className="overflow-hidden rounded-xl border bg-[#e5ddd5] dark:bg-[#0b141a]"
        >
          {/* WhatsApp header bar */}
          <div className="flex items-center gap-3 bg-[#075e54] px-4 py-2.5 text-white dark:bg-[#1f2c34]">
            <div className="h-8 w-8 rounded-full bg-white/20" />
            <span className="text-sm font-medium">WhatsApp</span>
          </div>

          {/* Chat area */}
          <div className="min-h-[200px] p-4">
            {/* Message bubble */}
            <div className="ml-auto max-w-[85%]">
              <div className="rounded-lg rounded-tr-none bg-[#dcf8c6] p-2.5 shadow-sm dark:bg-[#005c4b]">
                {/* Header */}
                {headerType === 'text' && headerContent && (
                  <p className="mb-1 text-sm font-bold text-gray-900 dark:text-gray-100">{headerContent}</p>
                )}
                {headerType === 'image' && headerContent && (
                  <div className="mb-2 overflow-hidden rounded">
                    <img src={headerContent} alt="" className="h-32 w-full object-cover" />
                  </div>
                )}

                {/* Body */}
                <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                  {content || (
                    <span className="text-gray-500 dark:text-gray-400">{t('messages.whatsappPreviewBody')}</span>
                  )}
                </p>

                {/* Footer */}
                {footer && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{footer}</p>}

                {/* Timestamp + checkmarks */}
                <div className="mt-1 flex items-center justify-end gap-0.5">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">{timeStr}</span>
                  <Check className="h-3 w-3 text-blue-500" />
                  <Check className="-ml-1.5 h-3 w-3 text-blue-500" />
                </div>
              </div>

              {/* CTA Button */}
              {isCallToAction && callToActionText && (
                <div className="mt-1 rounded-lg bg-white px-3 py-2 text-center shadow-sm dark:bg-[#1f2c34]">
                  <span className="inline-flex items-center gap-1 text-sm text-[#075e54] dark:text-[#00a884]">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {callToActionText}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Input area placeholder */}
          <div className="flex items-center gap-2 bg-[#f0f0f0] px-3 py-2 dark:bg-[#1f2c34]">
            <div className="h-8 flex-1 rounded-full bg-white dark:bg-[#2a3942]" />
            <div className="h-8 w-8 rounded-full bg-[#075e54] dark:bg-[#00a884]" />
          </div>
        </div>
      </div>
    </div>
  );
}
