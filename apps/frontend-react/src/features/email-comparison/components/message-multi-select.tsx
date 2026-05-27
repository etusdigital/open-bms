import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useComparisonMessages } from '../use-comparison-messages';
import type { ComparisonMessageType, SelectedMessage } from '../types';

interface MessageMultiSelectProps {
  messageType: ComparisonMessageType;
  selected: SelectedMessage[];
  onChange: (messages: SelectedMessage[]) => void;
}

const MAX_MESSAGES = 10;

export function MessageMultiSelect({ messageType, selected, onChange }: MessageMultiSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<SelectedMessage[]>([]);

  const query = useComparisonMessages(messageType, search);
  const messages = query.data ?? [];

  const pendingIds = useMemo(() => new Set(pending.map((m) => m.id)), [pending]);

  const handleOpen = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setPending([...selected]);
      }
      setOpen(nextOpen);
      if (!nextOpen) setSearch('');
    },
    [selected],
  );

  const handleToggle = useCallback((id: number, title: string) => {
    setPending((prev) => {
      const exists = prev.find((m) => m.id === id);
      if (exists) return prev.filter((m) => m.id !== id);
      if (prev.length >= MAX_MESSAGES) return prev;
      return [...prev, { id, title }];
    });
  }, []);

  const handleApply = useCallback(() => {
    onChange(pending);
    setOpen(false);
    setSearch('');
  }, [pending, onChange]);

  const handleClear = useCallback(() => {
    setPending([]);
  }, []);

  const triggerLabel =
    selected.length > 0 ? selected.map((m) => m.title).join(', ') : t('emailComparison.selectMessages');

  return (
    <div data-testid="message-selector">
      <Popover open={open} onOpenChange={handleOpen} modal>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[300px] justify-start truncate text-left font-normal">
            <span className="truncate">{triggerLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder={t('emailComparison.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-[250px] overflow-y-auto p-2">
            {messages.map((msg) => (
              <label
                key={msg.id}
                className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <Checkbox
                  checked={pendingIds.has(msg.id)}
                  onCheckedChange={() => handleToggle(msg.id, msg.title)}
                  disabled={!pendingIds.has(msg.id) && pending.length >= MAX_MESSAGES}
                />
                <span className="truncate">{msg.title}</span>
              </label>
            ))}
            {messages.length === 0 && !query.isLoading && (
              <p className="text-muted-foreground py-4 text-center text-sm">{t('emailComparison.noData')}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t p-2">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              {t('emailComparison.clear')}
            </Button>
            <Button size="sm" onClick={handleApply}>
              {t('emailComparison.apply')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
