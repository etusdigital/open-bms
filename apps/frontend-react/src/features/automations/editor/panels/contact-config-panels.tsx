import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SearchableApiSelect, type SelectOption } from '@/features/segments/builder/searchable-api-select';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type {
  TagNodeData,
  UpdateCustomFieldNodeData,
  ContactTransferNodeData,
  RemoveAutomationNodeData,
} from '../types';

// ---------------------------------------------------------------------------
// Shared hooks
// ---------------------------------------------------------------------------

function useTags(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery<{ results: Array<{ id: number; name: string; title?: string }> }>({
    queryKey: ['tags', 'select', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/tags', {
        params: { type: 'tag', page: 1, itemsPerPage: 40, ...(search && { title: search }) },
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

function useCustomFields() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery<{ results: Array<{ id: number; title: string; type: string }> }>({
    queryKey: ['custom-fields', 'select', { accountId }],
    queryFn: async () => {
      const { data } = await apiClient.get('/custom-fields', {
        params: { page: 1, itemsPerPage: 100 },
      });
      return data;
    },
    enabled: auth.status === 'authenticated',
  });
}

function useAccounts() {
  const auth = useAppStore((s) => s.auth);
  return useQuery<Array<{ id: number; name: string; accountConfigs?: Array<{ name: string; value: string }> }>>({
    queryKey: ['accounts', 'select-all'],
    queryFn: async () => {
      const { data } = await apiClient.get('/accounts');
      return Array.isArray(data) ? data : (data.results ?? []);
    },
    enabled: auth.status === 'authenticated',
  });
}

function useAccountTags(accountId: number) {
  return useQuery<{ results: Array<{ id: number; name: string }> }>({
    queryKey: ['tags', 'account-select', { accountId }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/tags', {
        params: { status: 'active', type: 'tag', page: 1, itemsPerPage: 40 },
        headers: { 'Account-Id': String(accountId) },
        signal,
      });
      return data;
    },
    enabled: accountId > 0,
  });
}

function useAutomationsList(search: string) {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;
  return useQuery<{ results: Array<{ id: number; name: string; title: string }> }>({
    queryKey: ['automations', 'select', { accountId, search }],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get('/automations', {
        params: { type: 'email', page: 1, itemsPerPage: 10, ...(search && { title: search }) },
        signal,
      });
      return data;
    },
    placeholderData: keepPreviousData,
    enabled: auth.status === 'authenticated',
  });
}

// ---------------------------------------------------------------------------
// Tag Config (shared by addTag and removeTag)
// ---------------------------------------------------------------------------

export function TagConfig({
  data,
  onSave,
  onClose,
}: {
  data: TagNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const initialTags = Array.isArray(data.settings) ? data.settings : data.settings ? [data.settings as any] : [];
  const [selectedTags, setSelectedTags] = useState<Array<{ id: number; name: string }>>(initialTags);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: tagsResponse, isLoading } = useTags(debouncedSearch);
  const availableTags = tagsResponse?.results ?? [];

  const options: SelectOption[] = availableTags
    .filter((t) => !selectedTags.some((s) => s.id === t.id))
    .map((tag) => ({ value: String(tag.id), label: tag.name }));

  const handleSearchChange = useCallback((search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const addTag = (tagId: string) => {
    const tag = availableTags.find((t) => String(t.id) === tagId);
    if (!tag || selectedTags.some((s) => s.id === tag.id)) return;
    const updated = [...selectedTags, { id: tag.id, name: tag.name }];
    setSelectedTags(updated);
    onSave(updated as any);
  };

  const removeTag = (id: number) => {
    const updated = selectedTags.filter((t) => t.id !== id);
    setSelectedTags(updated);
    onSave(updated as any);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('automations.editor.contacts.selectTags')}</Label>
        <SearchableApiSelect
          value=""
          onValueChange={addTag}
          options={options}
          isLoading={isLoading}
          onSearchChange={handleSearchChange}
          placeholder={t('automations.editor.contacts.searchTags')}
          className="h-9 w-full text-sm"
          popoverClassName="w-[var(--radix-popover-trigger-width)]"
        />
      </div>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
              {tag.name}
              <button type="button" onClick={() => removeTag(tag.id)} className="hover:text-destructive ml-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Update Custom Field Config
// ---------------------------------------------------------------------------

export function UpdateCustomFieldConfig({
  data,
  onSave,
  onClose,
}: {
  data: UpdateCustomFieldNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: fieldsResponse, isLoading } = useCustomFields();
  const fields = fieldsResponse?.results ?? [];

  const [selectedFieldId, setSelectedFieldId] = useState(
    data.settings.customFieldSelected?.id ? String(data.settings.customFieldSelected.id) : '',
  );
  const [fieldValue, setFieldValue] = useState(data.settings.customFieldValue ?? '');

  const selectedField = fields.find((f) => String(f.id) === selectedFieldId) ?? data.settings.customFieldSelected;

  const fieldOptions: SelectOption[] = fields.map((f) => ({
    value: String(f.id),
    label: f.title,
    description: f.type,
  }));

  const handleFieldSelect = (fieldId: string) => {
    setSelectedFieldId(fieldId);
    const field = fields.find((f) => String(f.id) === fieldId);
    if (field) {
      onSave({
        customFieldValue: fieldValue,
        customFieldSelected: { id: field.id, title: field.title, type: field.type },
      });
    }
  };

  const handleValueChange = (value: string) => {
    setFieldValue(value);
    if (selectedField) {
      onSave({ customFieldValue: value, customFieldSelected: selectedField });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('automations.editor.contacts.customField')}</Label>
        <SearchableApiSelect
          value={selectedFieldId}
          onValueChange={handleFieldSelect}
          options={fieldOptions}
          isLoading={isLoading}
          placeholder={t('automations.editor.contacts.selectField')}
          className="h-9 w-full text-sm"
          popoverClassName="w-[var(--radix-popover-trigger-width)]"
        />
      </div>

      {selectedField && (
        <div className="space-y-2">
          <Label>{t('automations.editor.contacts.fieldValue')}</Label>
          {selectedField.type === 'date' ? (
            <Input type="date" value={fieldValue} onChange={(e) => handleValueChange(e.target.value)} />
          ) : selectedField.type === 'number' ? (
            <Input type="number" value={fieldValue} onChange={(e) => handleValueChange(e.target.value)} />
          ) : (
            <Input
              value={fieldValue}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={t('automations.editor.contacts.enterValue')}
            />
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact Transfer Config (internal only)
// ---------------------------------------------------------------------------

export function ContactTransferConfig({
  data,
  onSave,
  onClose,
}: {
  data: ContactTransferNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState(data.settings.accountId ?? 0);
  const [selectedTagId, setSelectedTagId] = useState(data.settings.tagId ?? 0);
  const { data: tagsResponse, isLoading: loadingTags } = useAccountTags(selectedAccountId);
  const accountTags = tagsResponse?.results ?? [];

  const accountOptions: SelectOption[] = (accounts ?? []).map((a) => ({
    value: String(a.id),
    label: a.name,
  }));

  const tagOptions: SelectOption[] = accountTags.map((t) => ({
    value: String(t.id),
    label: t.name,
  }));

  const handleAccountSelect = (accountId: string) => {
    const account = accounts?.find((a) => String(a.id) === accountId);
    if (!account) return;
    const apiKey = account.accountConfigs?.find((c) => c.name === 'api_key')?.value ?? '';
    setSelectedAccountId(account.id);
    setSelectedTagId(0);
    onSave({ accountId: account.id, accountName: account.name, tagId: 0, tagName: '', apiKey });
  };

  const handleTagSelect = (tagId: string) => {
    const tag = accountTags.find((t) => String(t.id) === tagId);
    if (!tag) return;
    setSelectedTagId(tag.id);
    const account = accounts?.find((a) => a.id === selectedAccountId);
    const apiKey = account?.accountConfigs?.find((c) => c.name === 'api_key')?.value ?? '';
    onSave({
      accountId: selectedAccountId,
      accountName: account?.name ?? '',
      tagId: tag.id,
      tagName: tag.name,
      apiKey,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('automations.editor.contacts.targetAccount')}</Label>
        <SearchableApiSelect
          value={selectedAccountId ? String(selectedAccountId) : ''}
          onValueChange={handleAccountSelect}
          options={accountOptions}
          isLoading={loadingAccounts}
          placeholder={t('automations.editor.contacts.selectAccount')}
          className="h-9 w-full text-sm"
          popoverClassName="w-[var(--radix-popover-trigger-width)]"
        />
      </div>

      {selectedAccountId > 0 && (
        <div className="space-y-2">
          <Label>{t('automations.editor.contacts.targetTag')}</Label>
          <SearchableApiSelect
            value={selectedTagId ? String(selectedTagId) : ''}
            onValueChange={handleTagSelect}
            options={tagOptions}
            isLoading={loadingTags}
            placeholder={t('automations.editor.contacts.selectTag')}
            className="h-9 w-full text-sm"
            popoverClassName="w-[var(--radix-popover-trigger-width)]"
          />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Remove Automation Config (internal only)
// ---------------------------------------------------------------------------

export function RemoveAutomationConfig({
  data,
  onSave,
  onClose,
}: {
  data: RemoveAutomationNodeData;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [automations, setAutomations] = useState(data.settings.automations ?? []);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: response, isLoading } = useAutomationsList(debouncedSearch);
  const available = response?.results ?? [];

  const options: SelectOption[] = available
    .filter((a) => !automations.some((s) => s.id === a.id))
    .map((a) => ({ value: String(a.id), label: a.title || a.name }));

  const handleSearchChange = useCallback((search: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const addAutomation = (automationId: string) => {
    const automation = available.find((a) => String(a.id) === automationId);
    if (!automation || automations.some((a) => a.id === automation.id)) return;
    const updated = [...automations, { id: automation.id, name: automation.name, title: automation.title }];
    setAutomations(updated);
    onSave({ automations: updated });
  };

  const removeAutomation = (id: number) => {
    const updated = automations.filter((a) => a.id !== id);
    setAutomations(updated);
    onSave({ automations: updated });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('automations.editor.contacts.selectAutomations')}</Label>
        <SearchableApiSelect
          value=""
          onValueChange={addAutomation}
          options={options}
          isLoading={isLoading}
          onSearchChange={handleSearchChange}
          placeholder={t('automations.editor.contacts.searchAutomations')}
          className="h-9 w-full text-sm"
          popoverClassName="w-[var(--radix-popover-trigger-width)]"
        />
      </div>

      {automations.length > 0 && (
        <div className="space-y-1.5">
          {automations.map((a) => (
            <div key={a.id} className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
              <p className="flex-1 truncate text-sm">{a.title || a.name}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-7 w-7 shrink-0"
                onClick={() => removeAutomation(a.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  );
}
