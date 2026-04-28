import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, GripVertical, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GROUP_BY_ITEMS, GROUP_BY_MAP, type GroupByValue } from '../types';

interface GroupingSelectProps {
  selected: GroupByValue[];
  onChange: (items: GroupByValue[]) => void;
}

export function GroupingSelect({ selected, onChange }: GroupingSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<GroupByValue[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleOpen = (next: boolean) => {
    if (next) {
      setPending([...selected]);
    }
    setOpen(next);
  };

  const toggleItem = (value: GroupByValue) => {
    setPending((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const handleApply = () => {
    onChange(pending);
    setOpen(false);
  };

  const handleClear = () => {
    setPending([]);
  };

  const removeItem = (value: GroupByValue) => {
    onChange(selected.filter((v) => v !== value));
  };

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragOverItem.current = index;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const updated = [...selected];
    const [removed] = updated.splice(dragItem.current, 1);
    updated.splice(dragOverItem.current, 0, removed);
    onChange(updated);

    dragItem.current = null;
    dragOverItem.current = null;
  }, [selected, onChange]);

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-[220px] justify-between">
            <span className="text-muted-foreground truncate">{t('leads.selectGroupItems')}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <div className="max-h-[300px] overflow-y-auto p-2">
            {GROUP_BY_ITEMS.map((item) => (
              <label
                key={item.value}
                className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
              >
                <Checkbox checked={pending.includes(item.value)} onCheckedChange={() => toggleItem(item.value)} />
                {t(item.labelKey)}
              </label>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 border-t p-2">
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={pending.length === 0}>
              {t('leads.clear')}
            </Button>
            <Button size="sm" onClick={handleApply} disabled={pending.length === 0}>
              {t('leads.apply')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((value, index) => {
            const item = GROUP_BY_MAP.get(value);
            if (!item) return null;
            return (
              <Badge
                key={value}
                variant="secondary"
                className="cursor-grab gap-1 pr-1 active:cursor-grabbing"
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
              >
                <GripVertical className="text-muted-foreground h-3 w-3" />
                <span>{t(item.labelKey)}</span>
                <button
                  type="button"
                  className="hover:bg-muted ml-0.5 rounded-sm p-0.5"
                  onClick={() => removeItem(value)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
