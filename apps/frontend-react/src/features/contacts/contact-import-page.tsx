import { useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import Papa from 'papaparse';
import { ArrowLeft, Upload, FileSpreadsheet, X, CheckCircle2, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { useImportContacts } from './use-contacts';
import type { ImportColumnMapping, ImportActions } from './types';
import type { Tag } from '@/features/tags/types';
import type { CustomField } from '@/features/custom-fields/types';
import type { RawPaginatedResponse } from '@/types';

const MAX_FILE_SIZE = 50_000_000; // 50 MB
const CHUNK_SIZE = 50_000;
const PREVIEW_ROWS = 4;
const LARGE_FILE_THRESHOLD = 10_000;

const CONTACT_FIELDS = [
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'whatsapp',
  'city',
  'region',
  'country',
  'postal',
  'timezone',
  'ip',
] as const;

const COMMUNICATION_FIELDS = new Set(['email', 'phone', 'whatsapp']);

function getFieldTranslationKey(field: string): string {
  const map: Record<string, string> = {
    fullName: 'contacts.importFullName',
    firstName: 'contacts.firstName',
    lastName: 'contacts.lastName',
    email: 'contacts.email',
    phone: 'contacts.phone',
    whatsapp: 'contacts.channelWhatsapp',
    city: 'contacts.city',
    region: 'contacts.region',
    country: 'contacts.country',
    postal: 'contacts.importPostal',
    timezone: 'contacts.importTimezone',
    ip: 'contacts.importIp',
  };
  return map[field] ?? field;
}

/** Auto-detect if the first row looks like a header */
function detectHeader(firstRow: string[]): boolean {
  const knownFields = new Set([
    'email',
    'firstname',
    'first_name',
    'lastname',
    'last_name',
    'name',
    'fullname',
    'phone',
    'whatsapp',
    'city',
    'region',
    'country',
    'postal',
    'timezone',
    'ip',
  ]);
  const matches = firstRow.filter((col) => knownFields.has(col.replace(/[^a-z0-9]/gi, '').toLowerCase()));
  return matches.length > 0;
}

// ── Hooks for import-specific data ──────────────────────────────

function useImportTags() {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['tags', 'import-list'],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<Tag>>('/tags', {
        params: { type: 'tag', itemsPerPage: 1000 },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
  });
}

function useImportCustomFields() {
  const auth = useAppStore((s) => s.auth);

  return useQuery({
    queryKey: ['custom-fields', 'import-list'],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<RawPaginatedResponse<CustomField>>('/custom-fields', {
        params: { itemsPerPage: 1000 },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
  });
}

// ── Main component ──────────────────────────────────────────────

export function ContactImportPage() {
  const { t } = useTranslation();
  const importMutation = useImportContacts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagsQuery = useImportTags();
  const customFieldsQuery = useImportCustomFields();

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<string[][]>([]);
  const [isHeader, setIsHeader] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Mapping state
  const [columnMappings, setColumnMappings] = useState<ImportColumnMapping>({});

  // Tags state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);

  // Actions state
  const [actions, setActions] = useState<ImportActions>({
    contactUpdate: true,
    startAutomation: false,
  });

  // Derived data
  const dataRows = useMemo(() => (isHeader ? parsedData.slice(1) : parsedData), [parsedData, isHeader]);
  const previewRows = useMemo(
    () => (isHeader ? parsedData.slice(1, 1 + PREVIEW_ROWS) : parsedData.slice(0, PREVIEW_ROWS)),
    [parsedData, isHeader],
  );
  const columnCount = parsedData.length > 0 ? parsedData[0].length : 0;
  const contactCount = dataRows.length;
  const isLargeFile = contactCount > LARGE_FILE_THRESHOLD;

  const customFields = customFieldsQuery.data ?? [];

  // How many columns are mapped (excluding ignore)
  const mappedCount = useMemo(() => {
    return Object.values(columnMappings).filter((m) => m.type !== 'ignore').length;
  }, [columnMappings]);

  const hasCommunicationColumn = useMemo(() => {
    return Object.values(columnMappings).some((m) => m.type === 'contacts' && COMMUNICATION_FIELDS.has(m.value));
  }, [columnMappings]);

  // Check if a field is already mapped in another column
  const isMapped = useCallback(
    (fieldValue: string, currentIndex: number) => {
      if (fieldValue === 'ignore') return false;
      return Object.entries(columnMappings).some(
        ([idx, mapping]) => Number(idx) !== currentIndex && mapping.value === fieldValue,
      );
    },
    [columnMappings],
  );

  // ── File handling ──────────────────────────────────────────────

  const parseFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      const content = e.target?.result as string;
      Papa.parse(content, {
        skipEmptyLines: true,
        complete: (result: { data: string[][] }) => {
          const data = result.data.filter((row) => row.some((cell) => cell.trim() !== ''));
          setParsedData(data);

          if (data.length > 0 && detectHeader(data[0])) {
            setIsHeader(true);
          }
        },
      });
    };
    reader.readAsText(f);
  }, []);

  const handleFileSelect = useCallback(
    (f: File) => {
      if (!f.name.endsWith('.csv') && f.type !== 'text/csv' && f.type !== 'text/plain') {
        toast.error(t('contacts.importErrorCsvOnly'));
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(t('contacts.importErrorFileSize'));
        return;
      }
      setFile(f);
      setColumnMappings({});
      setSelectedTags([]);
      setActions({ contactUpdate: true, startAutomation: false });
      parseFile(f);
    },
    [parseFile, t],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFileSelect(f);
      e.target.value = '';
    },
    [handleFileSelect],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect],
  );

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setColumnMappings({});
    setSelectedTags([]);
    setIsHeader(false);
  }, []);

  // ── Column mapping ─────────────────────────────────────────────

  const handleColumnChange = useCallback((index: number, value: string) => {
    setColumnMappings((prev) => {
      if (value === 'ignore') {
        return { ...prev, [index]: { type: 'ignore' as const, value: 'ignore' } };
      }
      // Check if it's a custom field (prefixed with "cf:")
      if (value.startsWith('cf:')) {
        return { ...prev, [index]: { type: 'customField' as const, value: value.slice(3) } };
      }
      return { ...prev, [index]: { type: 'contacts' as const, value } };
    });
  }, []);

  // ── Tag selection ──────────────────────────────────────────────

  const toggleTag = useCallback((tagName: string) => {
    setSelectedTags((prev) => (prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]));
  }, []);

  // ── Import ─────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (mappedCount === 0) {
      toast.error(t('contacts.importErrorNoColumns'));
      return;
    }
    if (!hasCommunicationColumn) {
      toast.error(t('contacts.importErrorNoCommunication'));
      return;
    }

    // Chunk the data for large files
    for (let i = 0; i < dataRows.length; i += CHUNK_SIZE) {
      const chunk = dataRows.slice(i, i + CHUNK_SIZE);
      await importMutation.mutateAsync({
        contacts: chunk,
        headers: columnMappings,
        tags: selectedTags,
        actions,
      });
    }
  }, [dataRows, columnMappings, selectedTags, actions, mappedCount, hasCommunicationColumn, importMutation, t]);

  // ── Success state ──────────────────────────────────────────────

  if (importMutation.isSuccess && file) {
    return (
      <div className="space-y-6 p-6">
        <Link
          to="/contacts"
          search={{} as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('contacts.pageTitle')}
        </Link>

        <Card className="max-w-2xl">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="text-primary h-16 w-16" />
            <div className="text-center">
              <p className="text-lg font-semibold">{t('contacts.importSuccessMessage', { count: contactCount })}</p>
              <p className="text-muted-foreground mt-1 text-sm">{file.name}</p>
            </div>
            <Button asChild variant="outline">
              <Link to="/contacts" search={{} as never}>
                {t('contacts.importBackToContacts')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          to="/contacts"
          search={{} as never}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('contacts.pageTitle')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t('contacts.importTitle')}</h1>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Upload zone — single block, no nested card */}
        {!file ? (
          <div
            role="button"
            tabIndex={0}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="text-muted-foreground h-10 w-10" />
            <div className="text-center">
              <p className="text-sm font-medium">{t('contacts.importDragDrop')}</p>
              <p className="text-muted-foreground mt-1 text-xs">{t('contacts.importCsvOnly')}</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
          </div>
        ) : (
          <>
            {/* File info bar */}
            <Card>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-primary h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {t('contacts.importContactCount', { count: contactCount })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  aria-label={t('contacts.importRemoveFile')}
                >
                  <X className="h-4 w-4" />
                  {t('contacts.importRemoveFile')}
                </Button>
              </CardContent>
            </Card>

            {/* Header toggle */}
            <div className="flex items-center gap-2">
              <Checkbox id="isHeader" checked={isHeader} onCheckedChange={(checked) => setIsHeader(checked === true)} />
              <Label htmlFor="isHeader" className="text-sm">
                {t('contacts.importFirstRowHeader')}
              </Label>
            </div>

            {/* Column mapping */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('contacts.importMapColumns')}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mapping status */}
                <Alert variant={mappedCount === columnCount ? 'default' : 'destructive'} className="mb-4">
                  <AlertDescription>
                    {mappedCount === columnCount
                      ? t('contacts.importAllMapped')
                      : t('contacts.importPartiallyMapped', {
                          mapped: mappedCount,
                          total: columnCount,
                        })}
                  </AlertDescription>
                </Alert>

                {/* Preview table with mapping dropdowns */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Array.from({ length: columnCount }, (_, i) => (
                          <TableHead key={i} className="min-w-[180px]">
                            <Select
                              value={columnMappings[i]?.value ?? ''}
                              onValueChange={(val) => handleColumnChange(i, val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder={t('contacts.importSelectField')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ignore">{t('contacts.importIgnore')}</SelectItem>
                                <SelectGroup>
                                  <SelectLabel>{t('contacts.importContactInfo')}</SelectLabel>
                                  {CONTACT_FIELDS.map((field) => (
                                    <SelectItem key={field} value={field} disabled={isMapped(field, i)}>
                                      {t(getFieldTranslationKey(field) as never)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                                {customFields.length > 0 && (
                                  <SelectGroup>
                                    <SelectLabel>{t('contacts.importCustomFields')}</SelectLabel>
                                    {customFields.map((cf) => (
                                      <SelectItem
                                        key={`cf:${cf.name}`}
                                        value={`cf:${cf.name}`}
                                        disabled={isMapped(`cf:${cf.name}`, i)}
                                      >
                                        {cf.title || cf.name}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                )}
                              </SelectContent>
                            </Select>
                          </TableHead>
                        ))}
                      </TableRow>
                      {isHeader && parsedData.length > 0 && (
                        <TableRow>
                          {parsedData[0].map((header, i) => (
                            <TableHead key={i} className="text-muted-foreground text-xs font-normal">
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, rowIdx) => (
                        <TableRow key={rowIdx}>
                          {row.map((cell, cellIdx) => (
                            <TableCell key={cellIdx} className="text-xs">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Actions + Tags */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('contacts.importActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tag selection */}
                <div className="space-y-2">
                  <Label className="text-sm">{t('contacts.importSelectTags')}</Label>
                  <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={tagsOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedTags.length > 0
                          ? t('contacts.importTagsSelected', { count: selectedTags.length })
                          : t('contacts.importSelectTags')}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t('common.search')} />
                        <CommandList>
                          <CommandEmpty>{t('common.noResults')}</CommandEmpty>
                          <CommandGroup>
                            {(tagsQuery.data ?? []).map((tag) => (
                              <CommandItem key={tag.id} value={tag.name} onSelect={() => toggleTag(tag.name)}>
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedTags.includes(tag.name) ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                {tag.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                          <button type="button" className="hover:text-destructive ml-1" onClick={() => toggleTag(tag)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action checkboxes */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="contactUpdate"
                      checked={actions.contactUpdate}
                      onCheckedChange={(checked) =>
                        setActions((prev) => ({ ...prev, contactUpdate: checked === true }))
                      }
                    />
                    <Label htmlFor="contactUpdate" className="text-sm">
                      {t('contacts.importUpdateContacts')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="startAutomation"
                      checked={actions.startAutomation}
                      disabled={isLargeFile}
                      onCheckedChange={(checked) =>
                        setActions((prev) => ({ ...prev, startAutomation: checked === true }))
                      }
                    />
                    <Label htmlFor="startAutomation" className="text-sm">
                      {t('contacts.importStartAutomation')}
                      {isLargeFile && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          ({t('contacts.importDisabledLargeFile')})
                        </span>
                      )}
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex items-center gap-3">
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('contacts.importSending')}
                  </>
                ) : (
                  t('contacts.import')
                )}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/contacts" search={{} as never}>
                  {t('common.cancel')}
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
