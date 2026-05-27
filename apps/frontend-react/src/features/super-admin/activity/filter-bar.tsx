import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type Filters, EVENT_OPTIONS, PROVIDER_OPTIONS } from './q-builder';

interface Props {
  value: Filters;
  onChange: (next: Filters) => void;
}

export function FilterBar({ value, onChange }: Props) {
  const [contactDraft, setContactDraft] = useState(value.contact);

  useEffect(() => {
    setContactDraft(value.contact);
  }, [value.contact]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (contactDraft !== value.contact) onChange({ ...value, contact: contactDraft });
    }, 300);
    return () => clearTimeout(t);
  }, [contactDraft, value, onChange]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-medium">Search</label>
        <div className="relative mt-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={contactDraft}
            onChange={(e) => setContactDraft(e.target.value)}
            placeholder="Recipient email address"
            className="pl-8"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Filters</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <DateChip value={value} onChange={onChange} />
          <TextChip
            label="Account"
            placeholder="id or name (one per line)"
            values={value.accounts}
            onChange={(accounts) => onChange({ ...value, accounts })}
          />
          <MultiSelectChip
            label="Event"
            options={EVENT_OPTIONS}
            values={value.events}
            onChange={(events) => onChange({ ...value, events })}
          />
          <MultiSelectChip
            label="Provider"
            options={PROVIDER_OPTIONS}
            values={value.providers}
            onChange={(providers) => onChange({ ...value, providers })}
          />
          <TextChip
            label="Campaign"
            placeholder="id (one per line)"
            values={value.campaigns}
            onChange={(campaigns) => onChange({ ...value, campaigns })}
          />
          <TextChip
            label="Automation"
            placeholder="id (one per line)"
            values={value.automations}
            onChange={(automations) => onChange({ ...value, automations })}
          />
        </div>
      </div>
    </div>
  );
}

function ChipShell({
  label,
  active,
  summary,
  onClear,
  children,
}: {
  label: string;
  active: boolean;
  summary?: string;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <Popover>
      <div className={`inline-flex items-center rounded-full border ${active ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}`}>
        <PopoverTrigger asChild>
          <button type="button" className="flex items-center gap-1 px-3 py-1 text-xs">
            {!active && <Plus className="h-3 w-3" />}
            <span className="font-medium">{label}</span>
            {active && summary && <span className="text-muted-foreground">: {summary}</span>}
          </button>
        </PopoverTrigger>
        {active && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            className="px-2 py-1 text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <PopoverContent className="w-72 p-3">{children}</PopoverContent>
    </Popover>
  );
}

function DateChip({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const active = !!value.after || !!value.before;
  const summary = active ? `${value.after || '…'} → ${value.before || 'now'}` : undefined;
  return (
    <ChipShell label="Date" active={active} summary={summary} onClear={() => onChange({ ...value, after: '', before: '' })}>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium">After</label>
        <Input
          type="datetime-local"
          value={value.after}
          onChange={(e) => onChange({ ...value, after: e.target.value })}
        />
        <label className="text-xs font-medium">Before</label>
        <Input
          type="datetime-local"
          value={value.before}
          onChange={(e) => onChange({ ...value, before: e.target.value })}
        />
      </div>
    </ChipShell>
  );
}

function MultiSelectChip({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const active = values.length > 0;
  const summary = active ? (values.length <= 2 ? values.join(', ') : `${values.length} selected`) : undefined;
  const toggle = (opt: string) => {
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  };
  return (
    <ChipShell label={label} active={active} summary={summary} onClear={() => onChange([])}>
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={values.includes(opt)} onChange={() => toggle(opt)} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </ChipShell>
  );
}

function TextChip({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState(values.join('\n'));
  useEffect(() => {
    setDraft(values.join('\n'));
  }, [values]);
  const active = values.length > 0;
  const summary = active ? (values.length <= 2 ? values.join(', ') : `${values.length} values`) : undefined;
  const commit = () => {
    const next = draft
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(next);
  };
  return (
    <ChipShell label={label} active={active} summary={summary} onClear={() => onChange([])}>
      <div className="flex flex-col gap-2">
        <textarea
          className="min-h-[80px] w-full rounded border px-2 py-1 text-sm font-mono"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
        />
        <Button type="button" size="sm" onClick={commit}>
          Apply
        </Button>
      </div>
    </ChipShell>
  );
}
