import { useMemo, useRef, useState, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Smile, Info, Braces } from 'lucide-react';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/stores/app-store';
import { calculateSmsSegments } from '../utils/sms-encoding';
import type { SmsFormValues } from '../message-schema';
import { MergeFieldsModal } from './merge-fields-modal';

export function SmsContentForm() {
  const { t } = useTranslation();
  const form = useFormContext<SmsFormValues>();
  const content = form.watch('content') ?? '';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mergeFieldsOpen, setMergeFieldsOpen] = useState(false);

  const accountName = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.account.name : ''));

  const segmentInfo = useMemo(() => calculateSmsSegments(content), [content]);
  const isUnicode = segmentInfo.encoding === 'unicode';

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const textarea = textareaRef.current;
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
      const textarea = textareaRef.current;
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
  const timeStr = `${t('messages.smsToday')}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: Message input */}
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FormLabel>{t('messages.smsMessage')}</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="text-primary h-3.5 w-3.5 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">
                          {t('messages.smsEncoding', { encoding: isUnicode ? 'Unicode' : 'GSM-7' })}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="text-muted-foreground text-xs">
                  {segmentInfo.charsInCurrentSegment}/{segmentInfo.limit}, SMS {segmentInfo.segments}
                </span>
              </div>
              <FormControl>
                <div className="relative">
                  <Textarea
                    rows={8}
                    {...field}
                    ref={(el) => {
                      field.ref(el);
                      (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                    }}
                    placeholder={t('messages.smsPlaceholder')}
                    className="pr-20"
                  />
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
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isUnicode && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('messages.smsUnicodeWarning', { gsm7Limit: 160, unicodeLimit: 70 })}</span>
          </div>
        )}

        <MergeFieldsModal open={mergeFieldsOpen} onOpenChange={setMergeFieldsOpen} onInsert={handleInsertField} />
      </div>

      {/* Right: SMS Preview */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('messages.smsPreview')}</p>
        <div className="border-muted overflow-hidden rounded-xl border-4">
          {/* Phone header */}
          <div className="bg-background flex items-center gap-3 px-4 py-3">
            <span className="text-muted-foreground text-lg">&lsaquo;</span>
            <span className="text-base font-semibold">{accountName || t('messages.smsPreviewSender')}</span>
          </div>
          {/* Message area */}
          <div className="bg-muted/40 min-h-[160px] p-4">
            <p className="text-muted-foreground mb-3 text-center text-xs">{timeStr}</p>
            <div className="bg-background inline-block max-w-[80%] rounded-t-lg rounded-br-lg px-3 py-2 text-sm break-all shadow-sm">
              {content || <span className="text-muted-foreground">{t('messages.smsPreviewPlaceholder')}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
