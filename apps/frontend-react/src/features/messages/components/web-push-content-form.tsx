import { useState, useRef, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Globe, Braces, Smile, Settings, Chrome, Info, Trash2 } from 'lucide-react';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { WebPushFormValues } from '../message-schema';
import { PUSH_TITLE_MAX } from '../message-schema';
import { MergeFieldsModal } from './merge-fields-modal';

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function WebPushContentForm() {
  const { t } = useTranslation();
  const form = useFormContext<WebPushFormValues>();
  const subjectLength = form.watch('subject')?.length ?? 0;
  const expiryEnabled = form.watch('expiryPushEnabled') ?? false;

  const subject = form.watch('subject') ?? '';
  const content = form.watch('content') ?? '';
  const url = form.watch('url') ?? '';
  const image = form.watch('image') ?? '';
  const domain = extractDomain(url);

  const [mergeFieldsOpen, setMergeFieldsOpen] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [insertTarget, setInsertTarget] = useState<'subject' | 'content'>('subject');
  const [emojiTarget, setEmojiTarget] = useState<'subject' | 'content'>('subject');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const openMergeFields = (target: 'subject' | 'content') => {
    setInsertTarget(target);
    setMergeFieldsOpen(true);
  };

  const handleInsertField = useCallback(
    (tag: string) => {
      const fieldName = insertTarget;
      const input = insertTarget === 'subject' ? subjectRef.current : contentRef.current;
      const currentValue = form.getValues(fieldName) ?? '';

      if (input) {
        const start = input.selectionStart ?? currentValue.length;
        const end = input.selectionEnd ?? currentValue.length;
        const newValue = currentValue.slice(0, start) + tag + currentValue.slice(end);
        form.setValue(fieldName, newValue, { shouldDirty: true });
        setTimeout(() => {
          input.focus();
          const pos = start + tag.length;
          input.setSelectionRange(pos, pos);
        }, 0);
      } else {
        form.setValue(fieldName, currentValue + tag, { shouldDirty: true });
      }
      setMergeFieldsOpen(false);
    },
    [insertTarget, form],
  );

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const fieldName = emojiTarget;
    const input = emojiTarget === 'subject' ? subjectRef.current : contentRef.current;
    const currentValue = form.getValues(fieldName) ?? '';

    if (input) {
      const start = input.selectionStart ?? currentValue.length;
      const end = input.selectionEnd ?? currentValue.length;
      const newValue = currentValue.slice(0, start) + emojiData.emoji + currentValue.slice(end);
      form.setValue(fieldName, newValue, { shouldDirty: true });
    } else {
      form.setValue(fieldName, currentValue + emojiData.emoji, { shouldDirty: true });
    }
    setEmojiOpen(false);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: Form fields */}
      <div className="space-y-4">
        {/* Title / Subject */}
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>{t('messages.subject')}</FormLabel>
                <span className="text-muted-foreground text-xs">
                  {subjectLength}/{PUSH_TITLE_MAX}
                </span>
              </div>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    {...field}
                    ref={(el) => {
                      field.ref(el);
                      subjectRef.current = el;
                    }}
                    maxLength={PUSH_TITLE_MAX}
                  />
                </FormControl>
                <Popover
                  open={emojiOpen && emojiTarget === 'subject'}
                  onOpenChange={(open) => {
                    setEmojiTarget('subject');
                    setEmojiOpen(open);
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="icon" className="shrink-0">
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
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => openMergeFields('subject')}
                  aria-label={t('messages.mergeFields')}
                >
                  <Braces className="h-4 w-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Content */}
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.content')}</FormLabel>
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
                  <Popover
                    open={emojiOpen && emojiTarget === 'content'}
                    onOpenChange={(open) => {
                      setEmojiTarget('content');
                      setEmojiOpen(open);
                    }}
                  >
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
                    onClick={() => openMergeFields('content')}
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

        {/* Redirect URL */}
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.redirectUrl')}</FormLabel>
              <FormControl>
                <Input {...field} type="url" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Image */}
        <FormField
          control={form.control}
          name="image"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.image')}</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input
                    key={fileInputKey}
                    type="file"
                    accept="image/png, image/jpeg"
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

        {/* Notification Expiration */}
        <FormField
          control={form.control}
          name="expiryPushEnabled"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">{t('messages.notificationExpiration')}</FormLabel>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="text-primary h-3.5 w-3.5 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">{t('messages.mobilePushExpiryTooltip')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </FormItem>
          )}
        />

        {expiryEnabled && (
          <div className="flex items-center gap-3">
            <FormField
              control={form.control}
              name="expiryPushValue"
              render={({ field }) => (
                <FormItem className="w-24">
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expiryPushFilter"
              render={({ field }) => (
                <FormItem className="w-32">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="day">{t('messages.days')}</SelectItem>
                      <SelectItem value="hour">{t('messages.hours')}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Merge Fields Modal (insert mode) */}
        <MergeFieldsModal open={mergeFieldsOpen} onOpenChange={setMergeFieldsOpen} onInsert={handleInsertField} />
      </div>

      {/* Right: Web Push Previews */}
      <div className="space-y-4" data-testid="web-push-preview">
        {/* Windows Desktop Preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('messages.webPushPreviewWindows')}</p>
          <div className="overflow-hidden rounded-lg border bg-[#1f1f1f] p-0 shadow-lg">
            {/* Windows notification body */}
            <div className="flex gap-3 p-3">
              {/* Chrome icon */}
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center">
                <Chrome className="h-8 w-8 text-white/80" />
              </div>

              {/* Notification content */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {subject || t('messages.webPushPreviewTitle')}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-[#aaa]">
                  {content || t('messages.webPushPreviewContent')}
                </p>
                <p className="mt-1 text-[11px] text-[#888]">Google Chrome {domain ? `· ${domain}` : ''}</p>
              </div>

              {/* Thumbnail image */}
              {image && (
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded">
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            {/* Windows notification actions */}
            <div className="flex border-t border-[#333]">
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs text-[#aaa] hover:bg-[#2a2a2a]"
              >
                <Settings className="h-3 w-3" />
                {t('messages.webPushPreviewSiteSettings')}
              </button>
            </div>
          </div>
        </div>

        {/* Android Mobile Preview */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('messages.webPushPreviewAndroid')}</p>
          <div className="border-muted overflow-hidden rounded-xl border-4">
            {/* Phone status bar */}
            <div className="bg-background text-muted-foreground flex items-center justify-between px-4 py-1.5 text-[10px]">
              <span>
                {new Date().getHours().toString().padStart(2, '0')}:
                {new Date().getMinutes().toString().padStart(2, '0')}
              </span>
              <div className="flex items-center gap-1">
                <div className="border-muted-foreground/50 h-2 w-3 rounded-sm border" />
              </div>
            </div>

            {/* Notification card */}
            <div className="bg-muted/40 p-3">
              <div className="bg-background rounded-xl p-3 shadow-sm">
                {/* Header row */}
                <div className="flex items-center gap-2">
                  <Globe className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground text-[10px]">Chrome</span>
                  {domain && (
                    <>
                      <span className="text-muted-foreground text-[10px]">·</span>
                      <span className="text-muted-foreground text-[10px]">{domain}</span>
                    </>
                  )}
                  <span className="text-muted-foreground ml-auto text-[10px]">{t('messages.mobilePushNow')}</span>
                </div>

                {/* Content */}
                <div className="mt-1.5 flex gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{subject || t('messages.webPushPreviewTitle')}</p>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {content || t('messages.webPushPreviewContent')}
                    </p>
                  </div>

                  {/* Thumbnail */}
                  {image && (
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded">
                      <img src={image} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Image banner */}
                {image && (
                  <div className="mt-2 h-32 w-full overflow-hidden rounded">
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Phone home area placeholder */}
            <div className="bg-muted/20 h-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
