import { useMemo, useState } from 'react';
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

// Combobox "creatable" para o nome da conta destino do import. O backend
// (`createAccountImport`) faz `findByName(name, { withDeleted: true })`: se o
// nome bate numa conta existente ele REUSA essa conta (os dados importados são
// mesclados nela); se não bate, cria uma conta nova. Esse combobox expõe as
// duas intenções num campo só — escolher da lista (mesclar) ou digitar um nome
// novo (criar) — e avisa qual das duas vai acontecer.
export function AccountNameCombobox({ id, value, onChange, disabled }: Props) {
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

  // Match exato (case-insensitive) determina se o nome digitado já é uma conta
  // existente — espelha o `findByName` do backend.
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
              {value || 'Selecione uma conta existente ou digite um nome novo'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar ou criar conta…" value={search} onValueChange={setSearch} />
            <CommandList>
              {isLoading ? (
                <div className="space-y-1.5 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-full rounded" />
                  ))}
                </div>
              ) : (
                <>
                  {!showCreate && <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>}
                  {showCreate && (
                    <CommandGroup heading="Criar">
                      <CommandItem value={`__create__${trimmed}`} onSelect={() => select(trimmed)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Criar nova conta: <span className="ml-1 font-medium">“{trimmed}”</span>
                      </CommandItem>
                    </CommandGroup>
                  )}
                  {filtered.length > 0 && (
                    <CommandGroup heading="Contas existentes">
                      {filtered.map((account) => (
                        <CommandItem key={account.id} value={account.name} onSelect={() => select(account.name)}>
                          <Check className={cn('mr-2 h-4 w-4', value === account.name ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{account.name}</span>
                          {!account.isActive && <span className="text-muted-foreground ml-2 text-xs">(inativa)</span>}
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
            A importação será feita <span className="font-medium">na conta existente</span> “{existingMatch.name}” — os
            dados do Enterprise serão mesclados nela.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Uma <span className="font-medium">nova conta</span> “{value.trim()}” será criada para receber o import.
          </p>
        ))}
    </div>
  );
}
