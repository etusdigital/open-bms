import { useCallback, useEffect, useState, useRef, useMemo, type RefObject } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Smile, Download, Upload, ClipboardCopy, ExternalLink, Braces, Info, ChevronDown } from 'lucide-react';
import EmailEditor, { type EditorRef } from 'react-email-editor';
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore, selectIsSuperAdmin } from '@/stores/app-store';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePoolsForSelect, useTemplatesForSelect } from '../use-messages';
import type { Pool } from '@/features/pools/types';
import type { EmailFormValues } from '../message-schema';
import { MESSAGE_SUBJECT_MAX } from '../message-schema';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchableApiSelect } from '@/features/segments/builder/searchable-api-select';
import { MergeFieldsModal } from './merge-fields-modal';
import { ConditionalEmailModal } from './conditional-email-modal';
import { GenerateLinksModal } from './generate-links-modal';
import { InboxPreview } from './inbox-preview';

const EMPTY_POOLS: Pool[] = [];

interface EmailContentFormProps {
  editorRef: RefObject<EditorRef | null>;
  designJson?: string;
  templateUrl?: string;
}

export function EmailContentForm({ editorRef, designJson, templateUrl }: EmailContentFormProps) {
  const { t } = useTranslation();
  const form = useFormContext<EmailFormValues>();
  const poolsQuery = usePoolsForSelect();
  const pools = poolsQuery.data ?? EMPTY_POOLS;
  const templatesQuery = useTemplatesForSelect();
  const templates = templatesQuery.data ?? [];
  const isSuperAdmin = useAppStore(selectIsSuperAdmin);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const templateOptions = templates.map((tpl) => ({
    value: String(tpl.id),
    label: tpl.name,
  }));

  const [subjectEmojiOpen, setSubjectEmojiOpen] = useState(false);
  const [previewEmojiOpen, setPreviewEmojiOpen] = useState(false);
  const [mergeFieldsOpen, setMergeFieldsOpen] = useState(false);
  const [mergeFieldsInsertOpen, setMergeFieldsInsertOpen] = useState(false);
  const [mergeInsertTarget, setMergeInsertTarget] = useState<'subject' | 'previewText'>('subject');
  const [conditionalOpen, setConditionalOpen] = useState(false);
  const [generateLinksOpen, setGenerateLinksOpen] = useState(false);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLInputElement | null>(null);

  const senderName = form.watch('fromName') ?? '';
  const subject = form.watch('subject') ?? '';
  const previewText = form.watch('previewText') ?? '';

  const handleEditorReady = useCallback(() => {
    if (designJson) {
      try {
        const design = JSON.parse(designJson);
        editorRef.current?.editor?.loadDesign(design);
      } catch {
        // Invalid JSON — editor starts empty
      }
    }
  }, [designJson, editorRef]);

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find((t) => t.id === Number(templateId));
    if (template?.json_template) {
      try {
        const design = JSON.parse(template.json_template);
        editorRef.current?.editor?.loadDesign(design);
      } catch {
        // Invalid JSON — ignore
      }
    }
  };

  const applyPoolDefaults = useCallback(
    (pool: Pool, opts: { preserveUserEdits?: boolean } = {}) => {
      const { preserveUserEdits = false } = opts;
      const { dirtyFields } = form.formState;
      const setOpts = preserveUserEdits ? { shouldDirty: false } : undefined;

      form.setValue('ippool', pool.poolName, setOpts);

      if (!preserveUserEdits || !dirtyFields.fromName) {
        form.setValue('fromName', pool.senderName ?? '', setOpts);
      }
      if (!preserveUserEdits || !dirtyFields.fromMail) {
        form.setValue('fromMail', pool.senderEmail ?? '', setOpts);
      }
      if (!preserveUserEdits || !dirtyFields.replyTo) {
        form.setValue('replyTo', pool.senderReplyTo ?? '', setOpts);
      }
    },
    [form],
  );

  const handlePoolChange = (poolId: string) => {
    const pool = pools.find((p) => String(p.id) === poolId);
    if (pool) applyPoolDefaults(pool, { preserveUserEdits: false });
  };

  // Resolve the current pool id from the poolName stored in form
  const ippoolValue = form.watch('ippool');
  const fromMailValue = form.watch('fromMail');
  const currentPoolId = useMemo(() => {
    // Match by poolName + senderEmail to handle pools with same poolName
    const match =
      pools.find((p) => p.poolName === ippoolValue && p.senderEmail === fromMailValue) ??
      pools.find((p) => p.poolName === ippoolValue);
    return match ? String(match.id) : undefined;
  }, [pools, ippoolValue, fromMailValue]);

  // Programmatic sync: when ippool is already set (edit / duplicate / deep-link)
  // and pools resolve, fill sender fields without clobbering user edits.
  useEffect(() => {
    if (!currentPoolId) return;
    const pool = pools.find((p) => String(p.id) === currentPoolId);
    if (!pool) return;
    applyPoolDefaults(pool, { preserveUserEdits: true });
  }, [currentPoolId, pools, applyPoolDefaults]);

  const insertEmoji = (
    emoji: EmojiClickData,
    fieldName: 'subject' | 'previewText',
    inputRef: React.RefObject<HTMLInputElement | null>,
    setOpen: (open: boolean) => void,
  ) => {
    const input = inputRef.current;
    const currentValue = form.getValues(fieldName) ?? '';
    if (input) {
      const start = input.selectionStart ?? currentValue.length;
      const end = input.selectionEnd ?? currentValue.length;
      const newValue = currentValue.slice(0, start) + emoji.emoji + currentValue.slice(end);
      form.setValue(fieldName, newValue, { shouldDirty: true });
      setTimeout(() => {
        input.focus();
        const pos = start + emoji.emoji.length;
        input.setSelectionRange(pos, pos);
      }, 0);
    } else {
      form.setValue(fieldName, currentValue + emoji.emoji, { shouldDirty: true });
    }
    setOpen(false);
  };

  const openMergeFieldsInsert = (target: 'subject' | 'previewText') => {
    setMergeInsertTarget(target);
    setMergeFieldsInsertOpen(true);
  };

  const handleInsertField = useCallback(
    (tag: string) => {
      const inputRef = mergeInsertTarget === 'subject' ? subjectRef : previewRef;
      const input = inputRef.current;
      const currentValue = form.getValues(mergeInsertTarget) ?? '';

      if (input) {
        const start = input.selectionStart ?? currentValue.length;
        const end = input.selectionEnd ?? currentValue.length;
        const newValue = currentValue.slice(0, start) + tag + currentValue.slice(end);
        form.setValue(mergeInsertTarget, newValue, { shouldDirty: true });
        setTimeout(() => {
          input.focus();
          const pos = start + tag.length;
          input.setSelectionRange(pos, pos);
        }, 0);
      } else {
        form.setValue(mergeInsertTarget, currentValue + tag, { shouldDirty: true });
      }
      setMergeFieldsInsertOpen(false);
    },
    [mergeInsertTarget, form],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportContent = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let text = event.target?.result as string;
        // Remove BOM markers
        text = text.replace(/^\uFEFF/, '');
        let parsed = JSON.parse(text);
        // Handle double-encoded JSON
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        editorRef.current?.editor?.loadDesign(parsed);
        toast.success(t('messages.importSuccess'));
      } catch {
        toast.error(t('messages.importError'));
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = '';
  };

  const handleExportContent = () => {
    const editor = editorRef.current?.editor;
    if (!editor) return;
    editor.exportHtml((data: { design: object }) => {
      const blob = new Blob([JSON.stringify(data.design, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'email-content.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('messages.exportSuccess'));
    });
  };

  const handleCopyHtml = () => {
    const editor = editorRef.current?.editor;
    if (!editor) return;
    editor.exportHtml((data: { html: string }) => {
      navigator.clipboard.writeText(data.html).then(
        () => toast.success(t('messages.copyHtmlSuccess')),
        () => toast.error(t('messages.copyHtmlError')),
      );
    });
  };

  const handleViewInBrowser = () => {
    if (templateUrl) {
      window.open(templateUrl, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top section: sender/subject/preview fields + inbox preview side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: form fields */}
        <div className="space-y-4">
          {/* Pool selector — optional. When chosen, prefills the sender fields below. */}
          {pools.length > 0 && (
            <FormField
              control={form.control}
              name="ippool"
              render={({ field: _field }) => (
                <FormItem>
                  <FormLabel>{t('messages.senderAddress')}</FormLabel>
                  <Select onValueChange={handlePoolChange} value={currentPoolId}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('messages.selectSender')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pools.map((pool) => (
                        <SelectItem key={pool.id} value={String(pool.id)}>
                          {pool.senderEmail}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Sender Name + Sender Email side by side */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fromName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('messages.senderName')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fromMail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('messages.senderEmail')}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Reply-To (optional) */}
          <FormField
            control={form.control}
            name="replyTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('messages.replyTo')}</FormLabel>
                <FormControl>
                  <Input type="email" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Subject with emoji picker + merge fields */}
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('messages.subject')}</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        subjectRef.current = el;
                      }}
                      maxLength={MESSAGE_SUBJECT_MAX}
                      className="pr-[4.5rem]"
                    />
                  </FormControl>
                  <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5">
                    <Popover open={subjectEmojiOpen} onOpenChange={setSubjectEmojiOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground h-7 w-7"
                        >
                          <Smile className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" side="right" align="start">
                        <EmojiPicker
                          onEmojiClick={(emoji) => insertEmoji(emoji, 'subject', subjectRef, setSubjectEmojiOpen)}
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
                      className="text-muted-foreground hover:text-foreground h-7 w-7"
                      onClick={() => openMergeFieldsInsert('subject')}
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

          {/* Preview Text with emoji picker + merge fields */}
          <FormField
            control={form.control}
            name="previewText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('messages.previewText')}</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        previewRef.current = el;
                      }}
                      className="pr-[4.5rem]"
                    />
                  </FormControl>
                  <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5">
                    <Popover open={previewEmojiOpen} onOpenChange={setPreviewEmojiOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground h-7 w-7"
                        >
                          <Smile className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" side="right" align="start">
                        <EmojiPicker
                          onEmojiClick={(emoji) => insertEmoji(emoji, 'previewText', previewRef, setPreviewEmojiOpen)}
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
                      className="text-muted-foreground hover:text-foreground h-7 w-7"
                      onClick={() => openMergeFieldsInsert('previewText')}
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
        </div>

        {/* Right: inbox preview (aligned with sender/subject/preview fields) */}
        <div>
          <InboxPreview senderName={senderName} subject={subject} previewText={previewText} />
        </div>
      </div>

      {/* Content Config — full width below */}
      <div className="space-y-2">
        <label className="text-sm leading-none font-medium">{t('messages.contentConfig')}</label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="default" size="sm" onClick={() => setMergeFieldsOpen(true)}>
            {t('messages.viewFields')}
          </Button>
          <Button type="button" variant="default" size="sm" onClick={() => setConditionalOpen(true)}>
            {t('messages.conditionalEmail')}
          </Button>
          <Button type="button" variant="default" size="sm" onClick={() => setGenerateLinksOpen(true)}>
            {t('messages.generateLinks')}
          </Button>
          <SearchableApiSelect
            value={selectedTemplateId}
            onValueChange={(id) => {
              setSelectedTemplateId(id);
              handleTemplateChange(id);
            }}
            options={templateOptions}
            isLoading={templatesQuery.isLoading}
            placeholder={t('messages.selectTemplate')}
            className="w-[280px]"
          />
        </div>
      </div>

      {/* Unlayer Email Editor — full width */}
      <div>
        <label className="text-sm leading-none font-medium">{t('templates.editor')}</label>
        <div className="mt-2 rounded-md border [&_iframe]:!h-[700px]">
          <EmailEditor
            ref={editorRef}
            onReady={handleEditorReady}
            minHeight={700}
            options={{
              locale: 'pt-BR',
              appearance: { theme: 'modern_dark' },
            }}
          />
        </div>
      </div>

      {/* Custom HTML textarea (SuperAdmin only) */}
      {isSuperAdmin && (
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('messages.customHtml')}</FormLabel>
              <FormControl>
                <Textarea rows={10} {...field} className="font-mono text-xs" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="import-file-input"
          onChange={handleFileSelected}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" onClick={handleImportContent}>
                <Upload className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('messages.importContent')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" onClick={handleExportContent}>
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('messages.exportContent')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" onClick={handleCopyHtml}>
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('messages.copyHtml')}</TooltipContent>
          </Tooltip>
          {templateUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="outline" size="icon" onClick={handleViewInBrowser}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('messages.viewInBrowser')}</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>

      {/* Unsubscribe Template Instructions */}
      <Collapsible className="border-primary/30 bg-primary/5 rounded-lg border">
        <CollapsibleTrigger className="hover:bg-primary/10 flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left transition-colors [&[data-state=open]]:rounded-b-none [&[data-state=open]>svg.chevron]:rotate-180">
          <Info className="text-primary h-4 w-4 shrink-0" />
          <span className="text-primary flex-1 text-sm font-semibold">{t('messages.unsubscribeTemplateTitle')}</span>
          <ChevronDown className="chevron text-primary h-4 w-4 shrink-0 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pt-2 pb-4">
            <code className="text-foreground/80 block text-sm">{t('messages.unsubscribeTemplateCode')}</code>
            <p className="mt-3 text-sm font-semibold">{t('messages.unsubscribeWarningTitle')}</p>
            <ul className="text-foreground/80 mt-1 list-disc space-y-0.5 pl-5 text-sm">
              <li>{t('messages.unsubscribeWarning1')}</li>
              <li>{t('messages.unsubscribeWarning2')}</li>
              <li>{t('messages.unsubscribeWarning3')}</li>
              <li>{t('messages.unsubscribeWarning4')}</li>
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Modals */}
      <MergeFieldsModal open={mergeFieldsOpen} onOpenChange={setMergeFieldsOpen} />
      <MergeFieldsModal
        open={mergeFieldsInsertOpen}
        onOpenChange={setMergeFieldsInsertOpen}
        onInsert={handleInsertField}
      />
      <ConditionalEmailModal open={conditionalOpen} onOpenChange={setConditionalOpen} />
      <GenerateLinksModal open={generateLinksOpen} onOpenChange={setGenerateLinksOpen} />
    </div>
  );
}
