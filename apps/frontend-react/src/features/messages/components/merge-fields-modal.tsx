import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useCustomFieldsAll } from '@/features/custom-fields/use-custom-fields';

interface MergeFieldsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert?: (tag: string) => void;
}

type TabKey = 'contact' | 'customFields' | 'date' | 'message' | 'others';

interface MergeField {
  name: string;
  type: string;
  tag: string;
}

const CONTACT_FIELDS: MergeField[] = [
  { name: 'firstName', type: 'text', tag: '%FIRSTNAME%' },
  { name: 'lastName', type: 'text', tag: '%LASTNAME%' },
  { name: 'fullName', type: 'text', tag: '%FULLNAME%' },
  { name: 'email', type: 'email', tag: '%EMAIL%' },
  { name: 'hashedEmail', type: 'text', tag: '%HASHEDEMAIL%' },
  { name: 'id', type: 'number', tag: '%ID%' },
  { name: 'uuid', type: 'text', tag: '%UUID%' },
  { name: 'phone', type: 'phone', tag: '%PHONE%' },
  { name: 'city', type: 'text', tag: '%CITY%' },
  { name: 'region', type: 'text', tag: '%REGION%' },
  { name: 'country', type: 'text', tag: '%COUNTRY%' },
  { name: 'link', type: 'url', tag: '%LINK%' },
];

const DATE_FIELDS: MergeField[] = [
  { name: 'dateToday', type: 'date', tag: '%DATETODAY%' },
  { name: 'dateTomorrow', type: 'date', tag: '%DATETOMORROW%' },
  { name: 'dayWeekToday', type: 'text', tag: '%DAYWEEKTODAY%' },
  { name: 'dayWeekTomorrow', type: 'text', tag: '%DAYWEEKTOMORROW%' },
  { name: 'monthToday', type: 'text', tag: '%MONTHTODAY%' },
  { name: 'monthNext', type: 'text', tag: '%MONTHNEXT%' },
  { name: 'hourNow', type: 'time', tag: '%HOURNOW%' },
  { name: 'hourNextHour', type: 'time', tag: '%HOURNEXTHOUR%' },
  { name: 'hourNext8Hours', type: 'time', tag: '%HOURNEXT8HOURS%' },
  { name: 'hourNext16Hours', type: 'time', tag: '%HOURNEXT16HOURS%' },
  { name: 'hourNext23Hours', type: 'time', tag: '%HOURNEXT23HOURS%' },
];

const MESSAGE_FIELDS: MergeField[] = [
  { name: 'messageId', type: 'number', tag: '%MESSAGE_ID%' },
  { name: 'messageName', type: 'text', tag: '%MESSAGE_NAME%' },
];

const OTHER_FIELDS: MergeField[] = [
  { name: 'random4', type: 'text', tag: '%RANDOM4%' },
  { name: 'random8', type: 'text', tag: '%RANDOM8%' },
  { name: 'random12', type: 'text', tag: '%RANDOM12%' },
];

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'contact', labelKey: 'messages.mergeTabContact' },
  { key: 'customFields', labelKey: 'messages.mergeTabCustomFields' },
  { key: 'date', labelKey: 'messages.mergeTabDate' },
  { key: 'message', labelKey: 'messages.mergeTabMessage' },
  { key: 'others', labelKey: 'messages.mergeTabOthers' },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={handleCopy}
      aria-label={t('messages.mergeCopyField')}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function InsertButton({ tag, onInsert }: { tag: string; onInsert: (tag: string) => void }) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() => onInsert(tag)}
      aria-label={t('messages.mergeInsertField')}
    >
      {t('messages.mergeInsert')}
    </Button>
  );
}

function TruncatedCell({ text, className }: { text: string; className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('block truncate', className)}>{text}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs break-all">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FieldsTable({ fields, onInsert }: { fields: MergeField[]; onInsert?: (tag: string) => void }) {
  const { t } = useTranslation();

  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[30%]">{t('messages.mergeFieldName')}</TableHead>
          <TableHead className="w-[12%]">{t('messages.mergeFieldType')}</TableHead>
          <TableHead className="w-[38%]">{t('messages.mergeFieldTag')}</TableHead>
          <TableHead className="w-[20%]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field) => (
          <TableRow key={field.tag}>
            <TableCell className="max-w-0 font-medium">
              <TruncatedCell text={field.name} />
            </TableCell>
            <TableCell className="text-muted-foreground">{field.type}</TableCell>
            <TableCell className="max-w-0">
              <TruncatedCell text={field.tag} className="font-mono text-xs" />
            </TableCell>
            <TableCell className="text-right">
              {onInsert ? <InsertButton tag={field.tag} onInsert={onInsert} /> : <CopyButton text={field.tag} />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CustomFieldsTab({ onInsert }: { onInsert?: (tag: string) => void }) {
  const { t } = useTranslation();
  const { data: customFields, isLoading } = useCustomFieldsAll();

  const fields: MergeField[] = useMemo(
    () =>
      (customFields ?? []).map((cf) => ({
        name: cf.title,
        type: 'text',
        tag: `%${cf.name.toUpperCase()}%`,
      })),
    [customFields],
  );

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-6 text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (fields.length === 0) {
    return <div className="text-muted-foreground py-6 text-center text-sm">{t('messages.mergeCustomFieldsEmpty')}</div>;
  }

  return <FieldsTable fields={fields} onInsert={onInsert} />;
}

export function MergeFieldsModal({ open, onOpenChange, onInsert }: MergeFieldsModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('contact');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'contact':
        return <FieldsTable fields={CONTACT_FIELDS} onInsert={onInsert} />;
      case 'customFields':
        return <CustomFieldsTab onInsert={onInsert} />;
      case 'date':
        return <FieldsTable fields={DATE_FIELDS} onInsert={onInsert} />;
      case 'message':
        return <FieldsTable fields={MESSAGE_FIELDS} onInsert={onInsert} />;
      case 'others':
        return <FieldsTable fields={OTHER_FIELDS} onInsert={onInsert} />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('messages.mergeFieldsTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('messages.mergeFieldsTitle')}</DialogDescription>
        </DialogHeader>

        {/* Tab buttons */}
        <div className="flex gap-1 border-b">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                '-mb-px border-b-2',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.labelKey as never)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="max-h-[400px] overflow-y-auto">{renderTabContent()}</div>
      </DialogContent>
    </Dialog>
  );
}
