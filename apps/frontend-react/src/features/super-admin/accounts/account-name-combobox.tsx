import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSuperAdminAccountsAll } from './use-super-admin-accounts';

interface Props {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
}

// Creatable combobox for the import target account name. Backend
// `createAccountImport` does `findByName(name, { withDeleted: true })`: a name
// matching an existing account REUSES it (imported data is merged in),
// otherwise a new account is created. This combobox exposes both intents in
// one field and signals which one will happen.
export function AccountNameCombobox({ id, value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const { data: accounts, isLoading } = useSuperAdminAccountsAll();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const trimmed = search.trim();

  const filtered = useMemo(() => {
    const list = accounts ?? [];
    if (!trimmed) return list;
    const q = trimmed.toLowerCase();
    return list.filter((a) => a.name.toLowerCase().includes(q));
  }, [accounts, trimmed]);

  // Exact (case-insensitive) match decides whether the typed name is an
  // existing account — mirrors the backend `findByName`.
  const existingMatch = useMemo(
    () => (accounts ?? []).find((a) => a.name.toLowerCase() === value.trim().toLowerCase()) ?? null,
    [accounts, value],
  );
  const showCreate = trimmed.length > 0 && !filtered.some((a) => a.name.toLowerCase() === trimmed.toLowerCase());

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className={cn('truncate', !value && 'text-muted-foreground')}>
              {value || t('superAdmin.accounts.import.comboboxPlaceholder')}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t('superAdmin.accounts.import.comboboxSearchPlaceholder')}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoading ? (
                <div className="space-y-1.5 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full rounded" />
                  ))}
                </div>
              ) : (
                <>
                  {!showCreate && <CommandEmpty>{t('superAdmin.accounts.import.comboboxEmpty')}</CommandEmpty>}
                  {showCreate && (
                    <CommandGroup heading={t('superAdmin.accounts.import.comboboxCreateGroup')}>
                      <CommandItem value={`__create__${trimmed}`} onSelect={() => select(trimmed)}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('superAdmin.accounts.import.comboboxCreate')}{' '}
                        <span className="ml-1 font-medium">“{trimmed}”</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                  {filtered.length > 0 && (
                    <CommandGroup heading={t('superAdmin.accounts.import.comboboxExistingGroup')}>
                      {filtered.map((account) => (
                        <CommandItem key={account.id} value={account.name} onSelect={() => select(account.name)}>
                          <Check className={cn('mr-2 h-4 w-4', value === account.name ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{account.name}</span>
                          {!account.isActive && (
                            <span className="text-muted-foreground ml-2 text-xs">
                              {t('superAdmin.accounts.import.comboboxInactive')}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.trim().length > 0 &&
        (existingMatch ? (
          <p className="text-muted-foreground text-xs">
            {t('superAdmin.accounts.import.hintExisting', { name: existingMatch.name })}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {t('superAdmin.accounts.import.hintNew', { name: value.trim() })}
          </p>
        ))}
    </div>
  );
}
