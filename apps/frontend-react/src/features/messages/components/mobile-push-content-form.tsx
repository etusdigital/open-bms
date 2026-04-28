import { useState, useRef, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Braces, Bell, Smile, Info, Trash2 } from 'lucide-react';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore } from '@/stores/app-store';
import type { MobilePushFormValues } from '../message-schema';
import { PUSH_TITLE_MAX } from '../message-schema';
import { MergeFieldsModal } from './merge-fields-modal';

export function MobilePushContentForm() {
  const { t } = useTranslation();
  const form = useFormContext<MobilePushFormValues>();
  const subjectLength = form.watch('subject')?.length ?? 0;
  const expiryEnabled = form.watch('expiryPushEnabled') ?? false;
  const soundValue = form.watch('notificationSound') ?? 'default';
  const isCustomSound = soundValue !== 'default';
  const subject = form.watch('subject') ?? '';
  const content = form.watch('content') ?? '';
  const image = form.watch('image') ?? '';

  const accountName = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.account.name : ''));

  const [mergeFieldsOpen, setMergeFieldsOpen] = useState(false);
  const [insertTarget, setInsertTarget] = useState<'subject' | 'content'>('subject');
  const [emojiTarget, setEmojiTarget] = useState<'subject' | 'content'>('subject');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLInputElement | null>(null);

  const openMergeFields = (target: 'subject' | 'content') => {
    setInsertTarget(target);
    setMergeFieldsOpen(true);
  };

  const handleInsertField = useCallback(
    (tag: string) => {
      const fieldName = insertTarget;
      const inputRef = insertTarget === 'subject' ? subjectRef : contentRef;
      const input = inputRef.current;
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
    const inputRef = emojiTarget === 'subject' ? subjectRef : contentRef;
    const input = inputRef.current;
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

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: Form fields */}
      <div className="space-y-4">
        {/* Title / Subject with emoji + merge field picker */}
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

        {/* Content with emoji + merge field picker */}
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.content')}</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    {...field}
                    ref={(el) => {
                      field.ref(el);
                      contentRef.current = el;
                    }}
                  />
                </FormControl>
                <Popover
                  open={emojiOpen && emojiTarget === 'content'}
                  onOpenChange={(open) => {
                    setEmojiTarget('content');
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
                  onClick={() => openMergeFields('content')}
                  aria-label={t('messages.mergeFields')}
                >
                  <Braces className="h-4 w-4" />
                </Button>
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

        {/* Notification Sound */}
        <FormField
          control={form.control}
          name="notificationSound"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-1.5">
                <FormLabel>{t('messages.notificationSound')}</FormLabel>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="text-primary h-3.5 w-3.5 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">{t('messages.mobilePushSoundTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                onValueChange={(val) => {
                  if (val === 'default') {
                    field.onChange('default');
                  } else {
                    field.onChange('');
                  }
                }}
                value={isCustomSound ? 'custom' : 'default'}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="default">{t('messages.soundDefault')}</SelectItem>
                  <SelectItem value="custom">{t('messages.soundCustom')}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isCustomSound && (
          <FormField
            control={form.control}
            name="notificationSound"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('messages.soundName')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('messages.mobilePushSoundPlaceholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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

      {/* Right: Mobile Push Preview */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('messages.mobilePushPreview')}</p>
        <div data-testid="mobile-push-preview" className="border-muted overflow-hidden rounded-xl border-4">
          {/* Phone status bar */}
          <div className="bg-background text-muted-foreground flex items-center justify-between px-4 py-1.5 text-[10px]">
            <span>{timeStr}</span>
            <div className="flex items-center gap-1">
              <div className="border-muted-foreground/50 h-2 w-3 rounded-sm border" />
            </div>
          </div>

          {/* Notification card */}
          <div className="bg-muted/40 p-3">
            <div className="bg-background rounded-xl p-3 shadow-sm">
              <div className="flex gap-2.5">
                {/* App icon */}
                <div className="bg-primary/10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Bell className="text-primary h-4 w-4" />
                </div>

                {/* Notification text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                      {accountName || t('messages.smsPreviewSender')}
                    </p>
                    <span className="text-muted-foreground text-[10px]">{t('messages.mobilePushNow')}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {subject || t('messages.mobilePushPreviewTitle')}
                  </p>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                    {content || t('messages.mobilePushPreviewContent')}
                  </p>
                </div>

                {/* Thumbnail image */}
                {image && (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded">
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Phone home area placeholder */}
          <div className="bg-muted/20 h-24" />
        </div>
      </div>
    </div>
  );
}
