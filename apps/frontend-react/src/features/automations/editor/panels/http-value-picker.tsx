/**
 * Value picker for HTTP request headers/body.
 * 4 categories: Custom (freeform), Contact fields, Automation fields, Custom fields.
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import type { HttpKeyValueItem } from '../types';

type PickerValue = HttpKeyValueItem['value'];

// ---------------------------------------------------------------------------
// Contact fields
// ---------------------------------------------------------------------------

const CONTACT_FIELDS: Array<{ id: string; labelKey: string }> = [
  { id: 'contact.id', labelKey: 'ID' },
  { id: 'contact.email', labelKey: 'automations.editor.http.fields.email' },
  { id: 'contact.firstName', labelKey: 'automations.editor.http.fields.firstName' },
  { id: 'contact.lastName', labelKey: 'automations.editor.http.fields.lastName' },
  { id: 'contact.phone', labelKey: 'automations.editor.http.fields.phone' },
  { id: 'contact.city', labelKey: 'automations.editor.http.fields.city' },
  { id: 'contact.region', labelKey: 'automations.editor.http.fields.region' },
  { id: 'contact.country', labelKey: 'automations.editor.http.fields.country' },
  { id: 'contact.ip', labelKey: 'IP' },
  { id: 'contact.timezone', labelKey: 'automations.editor.http.fields.timezone' },
  { id: 'contact.isUnsubscribed', labelKey: 'automations.editor.http.fields.unsubscribed' },
  { id: 'contact.hasBounced', labelKey: 'automations.editor.http.fields.bounced' },
  { id: 'contact.last_sent', labelKey: 'automations.editor.http.fields.lastSent' },
  { id: 'contact.last_open', labelKey: 'automations.editor.http.fields.lastOpen' },
  { id: 'contact.last_click', labelKey: 'automations.editor.http.fields.lastClick' },
  { id: 'contact.last_automation', labelKey: 'automations.editor.http.fields.lastAutomation' },
  { id: 'contact.has_email', labelKey: 'automations.editor.http.fields.hasEmail' },
  { id: 'contact.has_phone', labelKey: 'automations.editor.http.fields.hasPhone' },
  { id: 'contact.has_web_push', labelKey: 'automations.editor.http.fields.hasWebPush' },
  { id: 'contact.has_mobile_push', labelKey: 'automations.editor.http.fields.hasMobilePush' },
  { id: 'contact', labelKey: 'automations.editor.http.fields.contactAll' },
];

const AUTOMATION_FIELDS: Array<{ id: string; labelKey: string }> = [
  { id: 'automation.id', labelKey: 'ID' },
  { id: 'automation.name', labelKey: 'automations.editor.http.fields.name' },
  { id: 'automation.createdAt', labelKey: 'automations.editor.http.fields.createdAt' },
  { id: 'automation.updatedAt', labelKey: 'automations.editor.http.fields.updatedAt' },
  { id: 'step.id', labelKey: 'automations.editor.http.fields.stepId' },
];

// ---------------------------------------------------------------------------
// Custom fields hook
// ---------------------------------------------------------------------------

function useCustomFields() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery({
    queryKey: ['builder-custom-fields', accountId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ results: Array<{ id: number; title: string }> }>('/custom-fields', {
        params: { itemsPerPage: 200 },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HttpValuePickerProps {
  value: PickerValue | null;
  onChange: (value: PickerValue) => void;
}

export function HttpValuePicker({ value, onChange }: HttpValuePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState(value?.type === 'custom' ? value.id : '');
  const [cfSearch, setCfSearch] = useState('');
  const { data: customFields = [] } = useCustomFields();

  const filteredCF = useMemo(
    () =>
      cfSearch ? customFields.filter((f) => f.title.toLowerCase().includes(cfSearch.toLowerCase())) : customFields,
    [customFields, cfSearch],
  );

  const displayLabel = value?.description || value?.id || t('common.select');

  const selectField = (id: string, description: string) => {
    onChange({ id, description, type: 'replace' });
    setOpen(false);
  };

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      onChange({ id: customInput.trim(), description: customInput.trim(), type: 'custom' });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          className="w-[200px] justify-between truncate text-xs font-normal"
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <ScrollArea className="h-[300px]">
          <div className="space-y-1 p-2">
            {/* Custom value */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-semibold">
                {t('automations.editor.http.custom')}
                <ChevronsUpDown className="h-3 w-3" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex gap-1 px-2 py-1">
                  <Input
                    className="h-7 flex-1 text-xs"
                    placeholder={t('automations.editor.http.customPlaceholder')}
                    value={customInput}
                    onChange={(e) => {
                      setCustomInput(e.target.value);
                    }}
                    onBlur={handleCustomSubmit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCustomSubmit();
                        setOpen(false);
                      }
                    }}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Contact fields */}
            <Collapsible>
              <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-semibold">
                {t('automations.editor.http.contactInfo')}
                <ChevronsUpDown className="h-3 w-3" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {CONTACT_FIELDS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cn(
                      'hover:bg-accent w-full rounded px-3 py-1 text-left text-xs',
                      value?.id === f.id && 'bg-accent',
                    )}
                    onClick={() =>
                      selectField(
                        f.id,
                        `${t('automations.editor.http.contactPrefix')} ${f.labelKey.startsWith('automations.') ? t(f.labelKey as never) : f.labelKey}`,
                      )
                    }
                  >
                    {f.labelKey.startsWith('automations.') ? t(f.labelKey as never) : f.labelKey}
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Automation fields */}
            <Collapsible>
              <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-semibold">
                {t('automations.editor.http.automationFields')}
                <ChevronsUpDown className="h-3 w-3" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {AUTOMATION_FIELDS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cn(
                      'hover:bg-accent w-full rounded px-3 py-1 text-left text-xs',
                      value?.id === f.id && 'bg-accent',
                    )}
                    onClick={() =>
                      selectField(
                        f.id,
                        `${t('automations.editor.http.automationPrefix')} ${f.labelKey.startsWith('automations.') ? t(f.labelKey as never) : f.labelKey}`,
                      )
                    }
                  >
                    {f.labelKey.startsWith('automations.') ? t(f.labelKey as never) : f.labelKey}
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Custom fields */}
            <Collapsible>
              <CollapsibleTrigger className="hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-semibold">
                {t('automations.editor.http.customFields')}
                <ChevronsUpDown className="h-3 w-3" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-2 py-1">
                  <Input
                    className="mb-1 h-7 text-xs"
                    placeholder={t('common.search')}
                    value={cfSearch}
                    onChange={(e) => setCfSearch(e.target.value)}
                  />
                </div>
                {filteredCF.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cn(
                      'hover:bg-accent w-full rounded px-3 py-1 text-left text-xs',
                      value?.id === `contact.customFields[${f.id}]` && 'bg-accent',
                    )}
                    onClick={() =>
                      selectField(
                        `contact.customFields[${f.id}]`,
                        `${t('automations.editor.http.customFieldsPrefix')} ${f.title}`,
                      )
                    }
                  >
                    {f.title}
                  </button>
                ))}
                {filteredCF.length === 0 && (
                  <p className="text-muted-foreground px-3 py-2 text-xs">{t('common.noResults')}</p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
