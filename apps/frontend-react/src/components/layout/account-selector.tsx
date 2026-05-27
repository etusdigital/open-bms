import { useEffect, useId, useMemo, useRef, useState, useDeferredValue } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/app-store';
import { useAccountSwitch } from '@/hooks/use-account-switch';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const EMPTY_ACCOUNTS: never[] = [];

export function AccountSelector({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();

  const account = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.account : null));
  const userAccounts = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.userAccounts : EMPTY_ACCOUNTS));

  const { switchAccount } = useAccountSwitch();

  // Global "/" shortcut to open account selector
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return;

      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;

      e.preventDefault();
      setOpen(true);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sortedAccounts = useMemo(
    () =>
      userAccounts.toSorted((a, b) =>
        a.account.name.trim().localeCompare(b.account.name.trim(), undefined, { sensitivity: 'base' }),
      ),
    [userAccounts],
  );

  const filteredAccounts = useMemo(() => {
    if (!deferredSearch) return sortedAccounts;
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const terms = normalize(deferredSearch).split(/\s+/).filter(Boolean);
    return sortedAccounts.filter((ua) => {
      const name = normalize(ua.account.name);
      const id = ua.accountId.toString();
      return terms.every((term) => name.includes(term) || id.includes(term));
    });
  }, [sortedAccounts, deferredSearch]);

  if (!account) return null;

  const trimmedName = account.name.trim();
  const initial = trimmedName.charAt(0).toUpperCase();

  const trigger = (
    <PopoverTrigger asChild>
      {collapsed ? (
        <button
          ref={triggerRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          className="bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80 mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors"
        >
          {initial}
        </button>
      ) : (
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          className="border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent w-full justify-between"
        >
          <span className="truncate text-sm">{trimmedName}</span>
          <div className="ml-1 flex shrink-0 items-center gap-1.5">
            <kbd className="border-border bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] font-medium select-none">
              /
            </kbd>
            <ChevronsUpDown className="h-4 w-4 opacity-60" strokeWidth={1.5} />
          </div>
        </Button>
      )}
    </PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{trimmedName}</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent id={listboxId} className="w-[220px] p-0" align="start" side="right">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t('header.searchAccounts')} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{t('header.noAccountsFound')}</CommandEmpty>
            <CommandGroup>
              {filteredAccounts.map((ua) => (
                <CommandItem
                  key={ua.accountId}
                  value={ua.account.name.trim().toLowerCase()}
                  onSelect={() => {
                    switchAccount(ua);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', account.id === ua.accountId ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{ua.account.name.trim()}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
