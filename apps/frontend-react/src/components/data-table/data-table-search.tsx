import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DEBOUNCE_MS = 300;

interface DataTableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Debounced search input for data tables. Maintains local state for
 * instant keystroke feedback, then debounces URL/state updates.
 */
export function DataTableSearch({ value, onChange, placeholder }: DataTableSearchProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value when external value changes (e.g. browser back/forward)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        startTransition(() => {
          onChange(newValue);
        });
      }, DEBOUNCE_MS);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    setLocalValue('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(() => {
      onChange('');
    });
  }, [onChange]);

  return (
    <div className="relative max-w-sm">
      <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder ?? t('common.search')}
        className="pr-8 pl-9"
      />
      {localValue && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2"
          onClick={handleClear}
          aria-label={t('common.clearSearch')}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
