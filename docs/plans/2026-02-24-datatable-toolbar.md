# DataTable Toolbar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Columns (show/hide) and Formatting (color scale + single-color conditional) toolbar to all report tables, with localStorage persistence per table.

**Architecture:** Extend the existing `ReportTable` component with an optional `tableId` prop that, when provided, renders a `DataTableToolbar` above the table and enables column visibility and conditional cell formatting. State is managed by a `useTableSettings` hook persisted to localStorage.

**Tech Stack:** Next.js 16 App Router, vitest + @testing-library/react, Radix UI (popover, dialog already installed), Tailwind CSS v4, TypeScript.

---

## Test commands

```bash
# Run all tests (from repo root)
pnpm --filter @retention/frontend test

# Run a single test file
pnpm --filter @retention/frontend test -- src/lib/color-utils.test.ts

# Watch mode
pnpm --filter @retention/frontend test:watch
```

---

### Task 1: Shared types

**Files:**

- Create: `apps/frontend/src/components/data-table/types.ts`

**Step 1: Create the types file**

```typescript
// apps/frontend/src/components/data-table/types.ts

export type FormattingOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between';

export type FormattingRule =
  | {
      id: string;
      type: 'color-scale';
      columnKey: string;
      minColor: string;
      midColor: string;
      maxColor: string;
    }
  | {
      id: string;
      type: 'single-color';
      columnKey: string;
      operator: FormattingOperator;
      value1: number;
      value2?: number;
      backgroundColor: string;
      textColor: string;
    };

export interface TableSettings {
  visibleColumns: string[];
  formattingRules: FormattingRule[];
}

export const FORMATTING_PRESETS = {
  heatmap: { minColor: '#dc2626', midColor: '#fbbf24', maxColor: '#16a34a' },
  highIsGood: { minColor: '#ef4444', midColor: '#fbbf24', maxColor: '#22c55e' },
  lowIsGood: { minColor: '#22c55e', midColor: '#fbbf24', maxColor: '#ef4444' },
} as const;
```

**Step 2: Commit**

```bash
git add apps/frontend/src/components/data-table/types.ts
git commit -m "feat: add shared FormattingRule types for datatable toolbar"
```

---

### Task 2: Color utilities

**Files:**

- Create: `apps/frontend/src/lib/color-utils.ts`
- Create: `apps/frontend/src/lib/color-utils.test.ts`

**Step 1: Write the failing tests**

```typescript
// apps/frontend/src/lib/color-utils.test.ts
import { describe, it, expect } from 'vitest';
import { interpolateColor, interpolateThreeColors, isColorDark } from './color-utils';

describe('interpolateColor', () => {
  it('returns start color at t=0', () => {
    expect(interpolateColor('#ff0000', '#00ff00', 0)).toBe('#ff0000');
  });

  it('returns end color at t=1', () => {
    expect(interpolateColor('#ff0000', '#00ff00', 1)).toBe('#00ff00');
  });

  it('returns midpoint color at t=0.5 between black and white', () => {
    expect(interpolateColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('interpolateThreeColors', () => {
  it('returns min color at t=0', () => {
    expect(interpolateThreeColors('#ff0000', '#00ff00', '#0000ff', 0)).toBe('#ff0000');
  });

  it('returns mid color at t=0.5', () => {
    expect(interpolateThreeColors('#ff0000', '#00ff00', '#0000ff', 0.5)).toBe('#00ff00');
  });

  it('returns max color at t=1', () => {
    expect(interpolateThreeColors('#ff0000', '#00ff00', '#0000ff', 1)).toBe('#0000ff');
  });

  it('interpolates correctly for heatmap preset at t=0.5', () => {
    const { minColor, midColor, maxColor } = { minColor: '#dc2626', midColor: '#fbbf24', maxColor: '#16a34a' };
    // At t=0.5 the midColor (#fbbf24) should be returned exactly
    expect(interpolateThreeColors(minColor, midColor, maxColor, 0.5)).toBe(midColor);
  });
});

describe('isColorDark', () => {
  it('returns true for black (#000000)', () => {
    expect(isColorDark('#000000')).toBe(true);
  });

  it('returns false for white (#ffffff)', () => {
    expect(isColorDark('#ffffff')).toBe(false);
  });

  it('returns true for dark red (#dc2626)', () => {
    // luminance ≈ 0.36 — dark
    expect(isColorDark('#dc2626')).toBe(true);
  });

  it('returns false for amber/yellow (#fbbf24)', () => {
    // luminance ≈ 0.79 — light
    expect(isColorDark('#fbbf24')).toBe(false);
  });
});
```

**Step 2: Run tests — verify they FAIL**

```bash
pnpm --filter @retention/frontend test -- src/lib/color-utils.test.ts
```

Expected: `FAIL — color-utils not found`

**Step 3: Implement color-utils.ts**

```typescript
// apps/frontend/src/lib/color-utils.ts

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/**
 * Linearly interpolates between two hex colors.
 * @param t - factor from 0 (color1) to 1 (color2)
 */
export function interpolateColor(color1: string, color2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * Interpolates across three colors using a 0–1 normalized value.
 * [0, 0.5] → min to mid; [0.5, 1] → mid to max.
 */
export function interpolateThreeColors(min: string, mid: string, max: string, t: number): string {
  if (t <= 0.5) return interpolateColor(min, mid, t * 2);
  return interpolateColor(mid, max, (t - 0.5) * 2);
}

/**
 * Returns true if the color is perceptually dark (luminance < 0.5).
 * Use to decide whether to render white or black text on top.
 */
export function isColorDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}
```

**Step 4: Run tests — verify they PASS**

```bash
pnpm --filter @retention/frontend test -- src/lib/color-utils.test.ts
```

Expected: `PASS — 8 tests passed`

**Step 5: Commit**

```bash
git add apps/frontend/src/lib/color-utils.ts apps/frontend/src/lib/color-utils.test.ts
git commit -m "feat: add color interpolation utilities with tests"
```

---

### Task 3: useTableSettings hook

**Files:**

- Create: `apps/frontend/src/hooks/use-table-settings.ts`
- Create: `apps/frontend/src/hooks/use-table-settings.test.ts`

**Step 1: Write the failing tests**

```typescript
// apps/frontend/src/hooks/use-table-settings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSettings } from './use-table-settings';

describe('useTableSettings', () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage.get(key) ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => storage.set(key, value));
    vi.clearAllMocks();
  });

  it('defaults to all columns visible when localStorage is empty', () => {
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a', 'col-b', 'col-c']));
    expect(result.current.visibleColumns).toEqual(new Set(['col-a', 'col-b', 'col-c']));
  });

  it('loads visibleColumns from localStorage', () => {
    storage.set('table-settings-tbl', JSON.stringify({ visibleColumns: ['col-a'], formattingRules: [] }));
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a', 'col-b']));
    expect(result.current.visibleColumns).toEqual(new Set(['col-a']));
  });

  it('toggleColumn hides a visible column', () => {
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a', 'col-b']));
    act(() => {
      result.current.toggleColumn('col-b');
    });
    expect(result.current.visibleColumns.has('col-b')).toBe(false);
  });

  it('toggleColumn shows a hidden column', () => {
    storage.set('table-settings-tbl', JSON.stringify({ visibleColumns: ['col-a'], formattingRules: [] }));
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a', 'col-b']));
    act(() => {
      result.current.toggleColumn('col-b');
    });
    expect(result.current.visibleColumns.has('col-b')).toBe(true);
  });

  it('toggleColumn ignores alwaysVisible columns', () => {
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a', 'col-b'], ['col-a']));
    act(() => {
      result.current.toggleColumn('col-a');
    });
    expect(result.current.visibleColumns.has('col-a')).toBe(true);
  });

  it('always includes alwaysVisible columns even when localStorage omits them', () => {
    storage.set('table-settings-tbl', JSON.stringify({ visibleColumns: [], formattingRules: [] }));
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a', 'col-b'], ['col-a']));
    expect(result.current.visibleColumns.has('col-a')).toBe(true);
  });

  it('addFormattingRule adds a rule', () => {
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a']));
    const rule = {
      id: 'r1',
      type: 'color-scale' as const,
      columnKey: 'col-a',
      minColor: '#ff0000',
      midColor: '#ffff00',
      maxColor: '#00ff00',
    };
    act(() => {
      result.current.addFormattingRule(rule);
    });
    expect(result.current.formattingRules).toHaveLength(1);
    expect(result.current.formattingRules[0]).toEqual(rule);
  });

  it('removeFormattingRule removes a rule by id', () => {
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a']));
    const rule = {
      id: 'r1',
      type: 'color-scale' as const,
      columnKey: 'col-a',
      minColor: '#ff0000',
      midColor: '#ffff00',
      maxColor: '#00ff00',
    };
    act(() => {
      result.current.addFormattingRule(rule);
    });
    act(() => {
      result.current.removeFormattingRule('r1');
    });
    expect(result.current.formattingRules).toHaveLength(0);
  });

  it('setFormattingRules replaces all rules', () => {
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a']));
    const rules = [
      {
        id: 'r1',
        type: 'color-scale' as const,
        columnKey: 'col-a',
        minColor: '#ff0000',
        midColor: '#ffff00',
        maxColor: '#00ff00',
      },
      {
        id: 'r2',
        type: 'color-scale' as const,
        columnKey: 'col-a',
        minColor: '#ff0000',
        midColor: '#ffff00',
        maxColor: '#00ff00',
      },
    ];
    act(() => {
      result.current.setFormattingRules(rules);
    });
    expect(result.current.formattingRules).toHaveLength(2);
  });

  it('persists settings to localStorage after toggle', () => {
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a', 'col-b']));
    act(() => {
      result.current.toggleColumn('col-b');
    });
    const stored = JSON.parse(storage.get('table-settings-tbl')!);
    expect(stored.visibleColumns).not.toContain('col-b');
  });

  it('persists formattingRules to localStorage after add', () => {
    const { result } = renderHook(() => useTableSettings('tbl', ['col-a']));
    const rule = {
      id: 'r1',
      type: 'color-scale' as const,
      columnKey: 'col-a',
      minColor: '#ff0000',
      midColor: '#ffff00',
      maxColor: '#00ff00',
    };
    act(() => {
      result.current.addFormattingRule(rule);
    });
    const stored = JSON.parse(storage.get('table-settings-tbl')!);
    expect(stored.formattingRules).toHaveLength(1);
  });
});
```

**Step 2: Run tests — verify they FAIL**

```bash
pnpm --filter @retention/frontend test -- src/hooks/use-table-settings.test.ts
```

Expected: `FAIL — useTableSettings not found`

**Step 3: Implement use-table-settings.ts**

```typescript
// apps/frontend/src/hooks/use-table-settings.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FormattingRule, TableSettings } from '@/components/data-table/types';

function getKey(tableId: string): string {
  return `table-settings-${tableId}`;
}

function loadFromStorage(tableId: string, allColumnKeys: string[], alwaysVisibleKeys: string[]): TableSettings {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(getKey(tableId)) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TableSettings>;
      const visible = new Set(parsed.visibleColumns ?? allColumnKeys);
      for (const key of alwaysVisibleKeys) visible.add(key);
      return {
        visibleColumns: Array.from(visible),
        formattingRules: parsed.formattingRules ?? [],
      };
    }
  } catch {
    // ignore
  }
  return { visibleColumns: allColumnKeys, formattingRules: [] };
}

export function useTableSettings(tableId: string, allColumnKeys: string[], alwaysVisibleKeys: string[] = []) {
  const [settings, setSettings] = useState<TableSettings>(() =>
    loadFromStorage(tableId, allColumnKeys, alwaysVisibleKeys),
  );

  useEffect(() => {
    try {
      localStorage.setItem(getKey(tableId), JSON.stringify(settings));
    } catch {
      // ignore storage errors (e.g., private browsing quota)
    }
  }, [tableId, settings]);

  const toggleColumn = useCallback(
    (key: string) => {
      if (alwaysVisibleKeys.includes(key)) return;
      setSettings((prev) => {
        const visible = new Set(prev.visibleColumns);
        if (visible.has(key)) visible.delete(key);
        else visible.add(key);
        return { ...prev, visibleColumns: Array.from(visible) };
      });
    },
    [alwaysVisibleKeys],
  );

  const setFormattingRules = useCallback((rules: FormattingRule[]) => {
    setSettings((prev) => ({ ...prev, formattingRules: rules }));
  }, []);

  const addFormattingRule = useCallback((rule: FormattingRule) => {
    setSettings((prev) => ({
      ...prev,
      formattingRules: [...prev.formattingRules, rule],
    }));
  }, []);

  const removeFormattingRule = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      formattingRules: prev.formattingRules.filter((r) => r.id !== id),
    }));
  }, []);

  return {
    visibleColumns: new Set(settings.visibleColumns),
    formattingRules: settings.formattingRules,
    toggleColumn,
    setFormattingRules,
    addFormattingRule,
    removeFormattingRule,
  };
}
```

**Step 4: Run tests — verify they PASS**

```bash
pnpm --filter @retention/frontend test -- src/hooks/use-table-settings.test.ts
```

Expected: `PASS — 11 tests passed`

**Step 5: Commit**

```bash
git add apps/frontend/src/hooks/use-table-settings.ts apps/frontend/src/hooks/use-table-settings.test.ts
git commit -m "feat: add useTableSettings hook with localStorage persistence"
```

---

### Task 4: ColumnsPopover component

**Files:**

- Create: `apps/frontend/src/components/data-table/columns-popover.tsx`
- Create: `apps/frontend/src/components/data-table/columns-popover.test.tsx`

**Step 1: Write the failing tests**

```tsx
// apps/frontend/src/components/data-table/columns-popover.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnsPopover } from './columns-popover';

const columns = [
  { key: 'col-a', label: 'Column A' },
  { key: 'col-b', label: 'Column B', alwaysVisible: true },
  { key: 'col-c', label: 'Column C' },
];

describe('ColumnsPopover', () => {
  it('renders a Columns button', () => {
    render(
      <ColumnsPopover
        columns={columns}
        visibleColumns={new Set(['col-a', 'col-b', 'col-c'])}
        onToggleColumn={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /columns/i })).toBeInTheDocument();
  });

  it('shows all column labels after opening', () => {
    render(
      <ColumnsPopover
        columns={columns}
        visibleColumns={new Set(['col-a', 'col-b', 'col-c'])}
        onToggleColumn={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /columns/i }));
    expect(screen.getByText('Column A')).toBeInTheDocument();
    expect(screen.getByText('Column B')).toBeInTheDocument();
    expect(screen.getByText('Column C')).toBeInTheDocument();
  });

  it('calls onToggleColumn when a regular column row is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ColumnsPopover
        columns={columns}
        visibleColumns={new Set(['col-a', 'col-b', 'col-c'])}
        onToggleColumn={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /columns/i }));
    fireEvent.click(screen.getByText('Column A'));
    expect(onToggle).toHaveBeenCalledWith('col-a');
  });

  it('does not call onToggleColumn for alwaysVisible columns', () => {
    const onToggle = vi.fn();
    render(
      <ColumnsPopover
        columns={columns}
        visibleColumns={new Set(['col-a', 'col-b', 'col-c'])}
        onToggleColumn={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /columns/i }));
    fireEvent.click(screen.getByText('Column B'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('shows checkbox as checked for visible columns', () => {
    render(<ColumnsPopover columns={columns} visibleColumns={new Set(['col-a'])} onToggleColumn={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /columns/i }));
    const checkboxA = screen.getByTestId('checkbox-col-a');
    const checkboxC = screen.getByTestId('checkbox-col-c');
    expect(checkboxA).toHaveAttribute('data-checked', 'true');
    expect(checkboxC).toHaveAttribute('data-checked', 'false');
  });
});
```

**Step 2: Run tests — verify they FAIL**

```bash
pnpm --filter @retention/frontend test -- src/components/data-table/columns-popover.test.tsx
```

Expected: `FAIL — ColumnsPopover not found`

**Step 3: Implement columns-popover.tsx**

```tsx
// apps/frontend/src/components/data-table/columns-popover.tsx
'use client';

import { useState } from 'react';
import { Columns } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColumnOption {
  key: string;
  label: string;
  alwaysVisible?: boolean;
}

interface ColumnsPopoverProps {
  columns: ColumnOption[];
  visibleColumns: Set<string>;
  onToggleColumn: (key: string) => void;
}

export function ColumnsPopover({ columns, visibleColumns, onToggleColumn }: ColumnsPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="border-border bg-background text-foreground hover:bg-accent inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium shadow-sm transition-colors"
          aria-label="Columns"
        >
          <Columns className="h-3.5 w-3.5" />
          Columns
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <p className="text-muted-foreground mb-2 px-1 text-[10px] font-semibold tracking-wider uppercase">
          Visible Columns
        </p>
        <div className="space-y-0.5">
          {columns.map((col) => {
            const isVisible = visibleColumns.has(col.key);
            const isDisabled = !!col.alwaysVisible;
            return (
              <button
                key={col.key}
                onClick={() => !isDisabled && onToggleColumn(col.key)}
                disabled={isDisabled}
                className={cn(
                  'flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-sm transition-colors',
                  isDisabled ? 'cursor-default opacity-50' : 'hover:bg-accent cursor-pointer',
                )}
              >
                <div
                  data-testid={`checkbox-${col.key}`}
                  data-checked={String(isVisible)}
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                    isVisible ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground',
                  )}
                >
                  {isVisible && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path
                        d="M1 3.5L3.5 6L8 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                {col.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 4: Run tests — verify they PASS**

```bash
pnpm --filter @retention/frontend test -- src/components/data-table/columns-popover.test.tsx
```

Expected: `PASS — 5 tests passed`

**Step 5: Commit**

```bash
git add apps/frontend/src/components/data-table/columns-popover.tsx apps/frontend/src/components/data-table/columns-popover.test.tsx
git commit -m "feat: add ColumnsPopover component with column visibility toggle"
```

---

### Task 5: FormattingModal component

**Files:**

- Create: `apps/frontend/src/components/data-table/formatting-modal.tsx`
- Create: `apps/frontend/src/components/data-table/formatting-modal.test.tsx`

**Step 1: Write the failing tests**

```tsx
// apps/frontend/src/components/data-table/formatting-modal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormattingModal } from './formatting-modal';
import { FORMATTING_PRESETS } from './types';

const numericColumns = [
  { key: 'delivered', label: 'Delivered', isNumeric: true },
  { key: 'open_rate', label: 'Open Rate', isNumeric: true },
];

describe('FormattingModal', () => {
  it('renders the dialog content when open=true', () => {
    render(
      <FormattingModal
        open={true}
        onClose={vi.fn()}
        numericColumns={numericColumns}
        formattingRules={[]}
        onApply={vi.fn()}
      />,
    );
    expect(screen.getByText('Conditional Formatting')).toBeInTheDocument();
    expect(screen.getByText('Quick Presets')).toBeInTheDocument();
  });

  it('does not render dialog content when open=false', () => {
    render(
      <FormattingModal
        open={false}
        onClose={vi.fn()}
        numericColumns={numericColumns}
        formattingRules={[]}
        onApply={vi.fn()}
      />,
    );
    expect(screen.queryByText('Conditional Formatting')).not.toBeInTheDocument();
  });

  it('clicking Heatmap preset adds a color-scale rule', () => {
    const onApply = vi.fn();
    render(
      <FormattingModal
        open={true}
        onClose={vi.fn()}
        numericColumns={numericColumns}
        formattingRules={[]}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByText('Heatmap'));
    fireEvent.click(screen.getByRole('button', { name: /apply rules/i }));
    expect(onApply).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'color-scale',
          minColor: FORMATTING_PRESETS.heatmap.minColor,
          maxColor: FORMATTING_PRESETS.heatmap.maxColor,
        }),
      ]),
    );
  });

  it('clicking Add Color Scale Rule adds a new rule to the list', () => {
    render(
      <FormattingModal
        open={true}
        onClose={vi.fn()}
        numericColumns={numericColumns}
        formattingRules={[]}
        onApply={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add color scale rule/i }));
    expect(screen.getByText('Min Point Color')).toBeInTheDocument();
    expect(screen.getByText('Max Point Color')).toBeInTheDocument();
  });

  it('clicking Add Single Color Rule adds a single-color rule', () => {
    render(
      <FormattingModal
        open={true}
        onClose={vi.fn()}
        numericColumns={numericColumns}
        formattingRules={[]}
        onApply={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add single color rule/i }));
    expect(screen.getByText('Background Color')).toBeInTheDocument();
    expect(screen.getByText('Text Color')).toBeInTheDocument();
  });

  it('clicking delete removes the rule', () => {
    render(
      <FormattingModal
        open={true}
        onClose={vi.fn()}
        numericColumns={numericColumns}
        formattingRules={[]}
        onApply={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add color scale rule/i }));
    expect(screen.getByText('Min Point Color')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete rule/i }));
    expect(screen.queryByText('Min Point Color')).not.toBeInTheDocument();
  });

  it('Cancel calls onClose without calling onApply', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <FormattingModal
        open={true}
        onClose={onClose}
        numericColumns={numericColumns}
        formattingRules={[]}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('Apply Rules calls onApply with current draft rules and closes', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <FormattingModal
        open={true}
        onClose={onClose}
        numericColumns={numericColumns}
        formattingRules={[]}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /apply rules/i }));
    expect(onApply).toHaveBeenCalledWith([]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows existing rules on open', () => {
    const existingRule = {
      id: 'r1',
      type: 'color-scale' as const,
      columnKey: 'delivered',
      minColor: '#dc2626',
      midColor: '#fbbf24',
      maxColor: '#16a34a',
    };
    render(
      <FormattingModal
        open={true}
        onClose={vi.fn()}
        numericColumns={numericColumns}
        formattingRules={[existingRule]}
        onApply={vi.fn()}
      />,
    );
    expect(screen.getByText('Min Point Color')).toBeInTheDocument();
  });
});
```

**Step 2: Run tests — verify they FAIL**

```bash
pnpm --filter @retention/frontend test -- src/components/data-table/formatting-modal.test.tsx
```

Expected: `FAIL — FormattingModal not found`

**Step 3: Implement formatting-modal.tsx**

```tsx
// apps/frontend/src/components/data-table/formatting-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { PaintBucket, Plus, Trash2, Zap } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FormattingRule, FormattingOperator } from './types';
import { FORMATTING_PRESETS } from './types';
import { interpolateThreeColors } from '@/lib/color-utils';

interface ColumnOption {
  key: string;
  label: string;
}

interface FormattingModalProps {
  open: boolean;
  onClose: () => void;
  numericColumns: ColumnOption[];
  formattingRules: FormattingRule[];
  onApply: (rules: FormattingRule[]) => void;
}

const OPERATOR_LABELS: Record<FormattingOperator, string> = {
  gt: 'Greater than',
  lt: 'Less than',
  gte: 'Greater than or equal',
  lte: 'Less than or equal',
  eq: 'Equal to',
  between: 'Between',
};

function generateId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function GradientPreview({ min, mid, max }: { min: string; mid: string; max: string }) {
  const stops = Array.from({ length: 20 }, (_, i) => interpolateThreeColors(min, mid, max, i / 19));
  return (
    <div className="h-6 w-full rounded" style={{ background: `linear-gradient(to right, ${stops.join(', ')})` }} />
  );
}

export function FormattingModal({ open, onClose, numericColumns, formattingRules, onApply }: FormattingModalProps) {
  const [draftRules, setDraftRules] = useState<FormattingRule[]>(formattingRules);
  const [presetColumnKey, setPresetColumnKey] = useState(numericColumns[0]?.key ?? '');

  // Sync draft state from props when modal opens
  useEffect(() => {
    if (open) {
      setDraftRules(formattingRules);
      setPresetColumnKey(numericColumns[0]?.key ?? '');
    }
    // intentionally omitting formattingRules/numericColumns to only reset on open event
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function applyPreset(preset: keyof typeof FORMATTING_PRESETS) {
    if (!presetColumnKey) return;
    const colors = FORMATTING_PRESETS[preset];
    const newRule: FormattingRule = {
      id: generateId(),
      type: 'color-scale',
      columnKey: presetColumnKey,
      ...colors,
    };
    setDraftRules((prev) => [
      ...prev.filter((r) => !(r.type === 'color-scale' && r.columnKey === presetColumnKey)),
      newRule,
    ]);
  }

  function addColorScaleRule() {
    const col = numericColumns[0];
    if (!col) return;
    setDraftRules((prev) => [
      ...prev,
      {
        id: generateId(),
        type: 'color-scale',
        columnKey: col.key,
        minColor: '#dc2626',
        midColor: '#fbbf24',
        maxColor: '#16a34a',
      },
    ]);
  }

  function addSingleColorRule() {
    const col = numericColumns[0];
    if (!col) return;
    setDraftRules((prev) => [
      ...prev,
      {
        id: generateId(),
        type: 'single-color',
        columnKey: col.key,
        operator: 'gt' as FormattingOperator,
        value1: 0,
        backgroundColor: '#22c55e',
        textColor: '#ffffff',
      },
    ]);
  }

  function removeRule(id: string) {
    setDraftRules((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRule(id: string, updates: Partial<FormattingRule>) {
    setDraftRules((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...updates } as FormattingRule) : r)));
  }

  function handleApply() {
    onApply(draftRules);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Conditional Formatting"
    >
      <div className="border-border bg-background max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border shadow-xl">
        {/* Header */}
        <div className="border-border flex items-start justify-between border-b px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <PaintBucket className="h-4 w-4" />
              Conditional Formatting
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">Define rules to visualize data patterns</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-muted-foreground hover:bg-accent rounded-md p-1"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Quick Presets */}
          <div className="border-border rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Quick Presets
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={presetColumnKey} onValueChange={setPresetColumnKey}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {numericColumns.map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">→</span>
              <button
                onClick={() => applyPreset('heatmap')}
                className="border-border bg-background hover:bg-accent inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs"
              >
                🎨 Heatmap
              </button>
              <button
                onClick={() => applyPreset('highIsGood')}
                className="border-border bg-background hover:bg-accent inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs"
              >
                📈 High = Good
              </button>
              <button
                onClick={() => applyPreset('lowIsGood')}
                className="border-border bg-background hover:bg-accent inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs"
              >
                📉 Low = Good
              </button>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Select a column and click a preset to apply formatting instantly
            </p>
          </div>

          {/* Rules list */}
          <div className="space-y-3">
            {draftRules.map((rule, i) => (
              <div key={rule.id} className="border-border rounded-lg border p-4">
                {/* Rule header: column + type selectors + delete */}
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="text-muted-foreground">{i + 1}</span>
                    <Select value={rule.columnKey} onValueChange={(v) => updateRule(rule.id, { columnKey: v })}>
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {numericColumns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            {col.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={rule.type}
                      onValueChange={(v) =>
                        updateRule(rule.id, {
                          type: v as 'color-scale' | 'single-color',
                          ...(v === 'color-scale'
                            ? { minColor: '#dc2626', midColor: '#fbbf24', maxColor: '#16a34a' }
                            : {
                                operator: 'gt' as FormattingOperator,
                                value1: 0,
                                backgroundColor: '#22c55e',
                                textColor: '#ffffff',
                              }),
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="color-scale">Color Scale</SelectItem>
                        <SelectItem value="single-color">Single Color</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <button
                    onClick={() => removeRule(rule.id)}
                    aria-label="Delete rule"
                    className="text-muted-foreground hover:bg-accent hover:text-destructive rounded-md p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Color Scale editor */}
                {rule.type === 'color-scale' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs tracking-wider uppercase">Min Point Color</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={rule.minColor}
                            onChange={(e) => updateRule(rule.id, { minColor: e.target.value })}
                            className="border-border h-8 w-8 cursor-pointer rounded border"
                          />
                          <span className="font-mono text-xs">{rule.minColor}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs tracking-wider uppercase">Max Point Color</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={rule.maxColor}
                            onChange={(e) => updateRule(rule.id, { maxColor: e.target.value })}
                            className="border-border h-8 w-8 cursor-pointer rounded border"
                          />
                          <span className="font-mono text-xs">{rule.maxColor}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1 text-xs">Preview Gradient</p>
                      <GradientPreview min={rule.minColor} mid={rule.midColor} max={rule.maxColor} />
                    </div>
                  </div>
                )}

                {/* Single Color editor */}
                {rule.type === 'single-color' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs tracking-wider uppercase">Apply to Range</p>
                        <Select
                          value={rule.operator}
                          onValueChange={(v) => updateRule(rule.id, { operator: v as FormattingOperator })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(OPERATOR_LABELS) as [FormattingOperator, string][]).map(([op, label]) => (
                              <SelectItem key={op} value={op}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs tracking-wider uppercase">Value</p>
                        <input
                          type="number"
                          value={rule.value1}
                          onChange={(e) => updateRule(rule.id, { value1: Number(e.target.value) })}
                          className="border-border bg-background h-8 w-full rounded border px-2 text-xs"
                        />
                        {rule.operator === 'between' && (
                          <input
                            type="number"
                            value={rule.value2 ?? 0}
                            onChange={(e) => updateRule(rule.id, { value2: Number(e.target.value) })}
                            placeholder="Max value"
                            className="border-border bg-background mt-1 h-8 w-full rounded border px-2 text-xs"
                          />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs tracking-wider uppercase">Background Color</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={rule.backgroundColor}
                            onChange={(e) => updateRule(rule.id, { backgroundColor: e.target.value })}
                            className="border-border h-8 w-8 cursor-pointer rounded border"
                          />
                          <span className="font-mono text-xs">{rule.backgroundColor}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1 text-xs tracking-wider uppercase">Text Color</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={rule.textColor}
                            onChange={(e) => updateRule(rule.id, { textColor: e.target.value })}
                            className="border-border h-8 w-8 cursor-pointer rounded border"
                          />
                          <span className="font-mono text-xs">{rule.textColor}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add rule buttons */}
          <div className="flex gap-2">
            <button
              onClick={addColorScaleRule}
              className="border-border text-muted-foreground hover:bg-accent flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Color Scale Rule
            </button>
            <button
              onClick={addSingleColorRule}
              className="border-border text-muted-foreground hover:bg-accent flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Single Color Rule
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-border flex items-center justify-between border-t px-5 py-4">
          <button onClick={onClose} className="text-muted-foreground hover:bg-accent rounded-md px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium"
          >
            <PaintBucket className="h-3.5 w-3.5" />
            Apply Rules
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run tests — verify they PASS**

```bash
pnpm --filter @retention/frontend test -- src/components/data-table/formatting-modal.test.tsx
```

Expected: `PASS — 8 tests passed`

**Step 5: Commit**

```bash
git add apps/frontend/src/components/data-table/formatting-modal.tsx apps/frontend/src/components/data-table/formatting-modal.test.tsx
git commit -m "feat: add FormattingModal with color scale and single-color conditional rules"
```

---

### Task 6: DataTableToolbar component

**Files:**

- Create: `apps/frontend/src/components/data-table/data-table-toolbar.tsx`
- Create: `apps/frontend/src/components/data-table/data-table-toolbar.test.tsx`

**Step 1: Write the failing tests**

```tsx
// apps/frontend/src/components/data-table/data-table-toolbar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTableToolbar } from './data-table-toolbar';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'delivered', label: 'Delivered', isNumeric: true },
];

describe('DataTableToolbar', () => {
  it('renders the Columns button', () => {
    render(
      <DataTableToolbar
        columns={columns}
        visibleColumns={new Set(['name', 'delivered'])}
        formattingRules={[]}
        onToggleColumn={vi.fn()}
        onApplyFormatting={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /columns/i })).toBeInTheDocument();
  });

  it('renders the Formatting button when numeric columns exist', () => {
    render(
      <DataTableToolbar
        columns={columns}
        visibleColumns={new Set(['name', 'delivered'])}
        formattingRules={[]}
        onToggleColumn={vi.fn()}
        onApplyFormatting={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /formatting/i })).toBeInTheDocument();
  });

  it('does not render Formatting button when no numeric columns exist', () => {
    render(
      <DataTableToolbar
        columns={[{ key: 'name', label: 'Name' }]}
        visibleColumns={new Set(['name'])}
        formattingRules={[]}
        onToggleColumn={vi.fn()}
        onApplyFormatting={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /formatting/i })).not.toBeInTheDocument();
  });

  it('clicking Formatting button opens the FormattingModal', () => {
    render(
      <DataTableToolbar
        columns={columns}
        visibleColumns={new Set(['name', 'delivered'])}
        formattingRules={[]}
        onToggleColumn={vi.fn()}
        onApplyFormatting={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /formatting/i }));
    expect(screen.getByText('Conditional Formatting')).toBeInTheDocument();
  });

  it('passes onApplyFormatting to FormattingModal and closes on apply', () => {
    const onApply = vi.fn();
    render(
      <DataTableToolbar
        columns={columns}
        visibleColumns={new Set(['name', 'delivered'])}
        formattingRules={[]}
        onToggleColumn={vi.fn()}
        onApplyFormatting={onApply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /formatting/i }));
    fireEvent.click(screen.getByRole('button', { name: /apply rules/i }));
    expect(onApply).toHaveBeenCalledWith([]);
    // Modal should close
    expect(screen.queryByText('Conditional Formatting')).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests — verify they FAIL**

```bash
pnpm --filter @retention/frontend test -- src/components/data-table/data-table-toolbar.test.tsx
```

Expected: `FAIL — DataTableToolbar not found`

**Step 3: Implement data-table-toolbar.tsx**

```tsx
// apps/frontend/src/components/data-table/data-table-toolbar.tsx
'use client';

import { useState } from 'react';
import { PaintBucket } from 'lucide-react';
import { ColumnsPopover } from './columns-popover';
import { FormattingModal } from './formatting-modal';
import type { FormattingRule } from './types';

interface ColumnOption {
  key: string;
  label: string;
  alwaysVisible?: boolean;
  isNumeric?: boolean;
}

interface DataTableToolbarProps {
  columns: ColumnOption[];
  visibleColumns: Set<string>;
  formattingRules: FormattingRule[];
  onToggleColumn: (key: string) => void;
  onApplyFormatting: (rules: FormattingRule[]) => void;
}

export function DataTableToolbar({
  columns,
  visibleColumns,
  formattingRules,
  onToggleColumn,
  onApplyFormatting,
}: DataTableToolbarProps) {
  const [formattingOpen, setFormattingOpen] = useState(false);
  const numericColumns = columns.filter((c) => c.isNumeric);

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <ColumnsPopover columns={columns} visibleColumns={visibleColumns} onToggleColumn={onToggleColumn} />
        {numericColumns.length > 0 && (
          <button
            onClick={() => setFormattingOpen(true)}
            aria-label="Formatting"
            className="border-border bg-background text-foreground hover:bg-accent inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium shadow-sm transition-colors"
          >
            <PaintBucket className="h-3.5 w-3.5" />
            Formatting
          </button>
        )}
      </div>
      {numericColumns.length > 0 && (
        <FormattingModal
          open={formattingOpen}
          onClose={() => setFormattingOpen(false)}
          numericColumns={numericColumns}
          formattingRules={formattingRules}
          onApply={(rules) => {
            onApplyFormatting(rules);
            setFormattingOpen(false);
          }}
        />
      )}
    </>
  );
}
```

**Step 4: Run tests — verify they PASS**

```bash
pnpm --filter @retention/frontend test -- src/components/data-table/data-table-toolbar.test.tsx
```

Expected: `PASS — 5 tests passed`

**Step 5: Commit**

```bash
git add apps/frontend/src/components/data-table/data-table-toolbar.tsx apps/frontend/src/components/data-table/data-table-toolbar.test.tsx
git commit -m "feat: add DataTableToolbar component composing Columns and Formatting controls"
```

---

### Task 7: Extend ReportTable

**Files:**

- Modify: `apps/frontend/src/features/reports/components/report-table.tsx`
- Create: `apps/frontend/src/features/reports/components/report-table.test.tsx`

**Step 1: Write the failing tests**

```tsx
// apps/frontend/src/features/reports/components/report-table.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportTable } from './report-table';
import type { ColumnDef } from './report-table';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'showing') return `Showing ${params?.from}-${params?.to} of ${params?.total}`;
    return key;
  },
}));

// Mock useTableSettings to control behavior
vi.mock('@/hooks/use-table-settings', () => ({
  useTableSettings: vi.fn((tableId: string, allKeys: string[]) => ({
    visibleColumns: new Set(allKeys),
    formattingRules: [],
    toggleColumn: vi.fn(),
    setFormattingRules: vi.fn(),
    addFormattingRule: vi.fn(),
    removeFormattingRule: vi.fn(),
  })),
}));

interface Row {
  name: string;
  delivered: number;
  bounce_rate: number;
}

const columns: ColumnDef<Row>[] = [
  { key: 'name', header: 'Name', accessor: (r) => r.name, alwaysVisible: true },
  { key: 'delivered', header: 'Delivered', accessor: (r) => r.delivered, align: 'right', isNumeric: true },
  { key: 'bounce_rate', header: 'Bounce Rate', accessor: (r) => r.bounce_rate, align: 'right', isNumeric: true },
];

const data: Row[] = [
  { name: 'Sender A', delivered: 1000, bounce_rate: 2.5 },
  { name: 'Sender B', delivered: 500, bounce_rate: 5.0 },
];

describe('ReportTable', () => {
  describe('without tableId', () => {
    it('renders data without toolbar', () => {
      render(<ReportTable data={data} columns={columns} />);
      expect(screen.getByText('Sender A')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /columns/i })).not.toBeInTheDocument();
    });
  });

  describe('with tableId', () => {
    it('renders the DataTableToolbar', () => {
      render(<ReportTable data={data} columns={columns} tableId="test-table" />);
      expect(screen.getByRole('button', { name: /columns/i })).toBeInTheDocument();
    });

    it('renders the Formatting button for numeric columns', () => {
      render(<ReportTable data={data} columns={columns} tableId="test-table" />);
      expect(screen.getByRole('button', { name: /formatting/i })).toBeInTheDocument();
    });

    it('hides a column when useTableSettings reports it invisible', async () => {
      const { useTableSettings } = await import('@/hooks/use-table-settings');
      vi.mocked(useTableSettings).mockReturnValue({
        visibleColumns: new Set(['name', 'bounce_rate']), // 'delivered' hidden
        formattingRules: [],
        toggleColumn: vi.fn(),
        setFormattingRules: vi.fn(),
        addFormattingRule: vi.fn(),
        removeFormattingRule: vi.fn(),
      });

      render(<ReportTable data={data} columns={columns} tableId="test-table" />);
      expect(screen.queryByText('Delivered')).not.toBeInTheDocument();
      expect(screen.getByText('Bounce Rate')).toBeInTheDocument();
    });

    it('applies color-scale inline style to numeric cells', async () => {
      const { useTableSettings } = await import('@/hooks/use-table-settings');
      vi.mocked(useTableSettings).mockReturnValue({
        visibleColumns: new Set(['name', 'delivered', 'bounce_rate']),
        formattingRules: [
          {
            id: 'r1',
            type: 'color-scale',
            columnKey: 'delivered',
            minColor: '#ff0000',
            midColor: '#ffff00',
            maxColor: '#00ff00',
          },
        ],
        toggleColumn: vi.fn(),
        setFormattingRules: vi.fn(),
        addFormattingRule: vi.fn(),
        removeFormattingRule: vi.fn(),
      });

      const { container } = render(<ReportTable data={data} columns={columns} tableId="test-table" />);

      // Find cells in the 'delivered' column (index 1 in visible columns)
      const rows = container.querySelectorAll('tbody tr');
      const firstRowCells = rows[0].querySelectorAll('td');
      const deliveredCell = firstRowCells[1]; // name=0, delivered=1
      expect(deliveredCell.style.backgroundColor).toBeTruthy();
    });
  });
});
```

**Step 2: Run tests — verify they FAIL**

```bash
pnpm --filter @retention/frontend test -- src/features/reports/components/report-table.test.tsx
```

Expected: `FAIL — various errors about missing tableId prop`

**Step 3: Modify report-table.tsx**

Replace the full file content:

```tsx
// apps/frontend/src/features/reports/components/report-table.tsx
'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { useTableSettings } from '@/hooks/use-table-settings';
import { interpolateThreeColors, isColorDark } from '@/lib/color-utils';
import type { FormattingRule } from '@/components/data-table/types';

export interface ColumnDef<T> {
  key: string;
  header: string;
  accessor: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  format?: (value: string | number) => string;
  className?: string;
  alwaysVisible?: boolean;
  isNumeric?: boolean;
}

interface ReportTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  defaultSortKey?: string;
  defaultSortDir?: SortDirection;
  tableId?: string;
}

type SortDirection = 'asc' | 'desc' | null;

function getCellStyle(rule: FormattingRule, value: number, stats: { min: number; max: number }): React.CSSProperties {
  if (rule.type === 'color-scale') {
    if (stats.max === stats.min) return {};
    const t = (value - stats.min) / (stats.max - stats.min);
    const bg = interpolateThreeColors(rule.minColor, rule.midColor, rule.maxColor, t);
    return { backgroundColor: bg, color: isColorDark(bg) ? '#ffffff' : '#000000' };
  }
  if (rule.type === 'single-color') {
    const { operator, value1, value2 } = rule;
    const matches =
      (operator === 'gt' && value > value1) ||
      (operator === 'lt' && value < value1) ||
      (operator === 'gte' && value >= value1) ||
      (operator === 'lte' && value <= value1) ||
      (operator === 'eq' && value === value1) ||
      (operator === 'between' && value2 !== undefined && value >= value1 && value <= value2);
    if (matches) return { backgroundColor: rule.backgroundColor, color: rule.textColor };
  }
  return {};
}

// Standalone component to safely call useTableSettings only when tableId is provided
function ReportTableWithSettings<T>({
  data,
  columns,
  isLoading,
  pageSize = 20,
  emptyMessage,
  defaultSortKey,
  defaultSortDir,
  tableId,
}: ReportTableProps<T> & { tableId: string }) {
  const t = useTranslations('common');
  const tReports = useTranslations('reports');
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortDir ?? null);
  const [page, setPage] = useState(0);

  const allColumnKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const alwaysVisibleKeys = useMemo(() => columns.filter((c) => c.alwaysVisible).map((c) => c.key), [columns]);

  const { visibleColumns, formattingRules, toggleColumn, setFormattingRules } = useTableSettings(
    tableId,
    allColumnKeys,
    alwaysVisibleKeys,
  );

  const visibleColumnDefs = useMemo(() => columns.filter((c) => visibleColumns.has(c.key)), [columns, visibleColumns]);

  const toolbarColumns = useMemo(
    () =>
      columns.map((c) => ({
        key: c.key,
        label: c.header,
        alwaysVisible: c.alwaysVisible,
        isNumeric: c.isNumeric,
      })),
    [columns],
  );

  // Pre-compute column stats for active color-scale rules
  const columnStats = useMemo(() => {
    const stats = new Map<string, { min: number; max: number }>();
    for (const rule of formattingRules) {
      if (rule.type === 'color-scale') {
        const col = columns.find((c) => c.key === rule.columnKey);
        if (!col) continue;
        const values = data.map((row) => Number(col.accessor(row))).filter(Number.isFinite);
        if (values.length === 0) continue;
        stats.set(rule.columnKey, { min: Math.min(...values), max: Math.max(...values) });
      }
    }
    return stats;
  }, [data, columns, formattingRules]);

  const getColumnCellStyle = (columnKey: string, rawValue: string | number): React.CSSProperties => {
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return {};
    const rule = formattingRules.find((r) => r.columnKey === columnKey);
    if (!rule) return {};
    const stats = columnStats.get(columnKey) ?? { min: 0, max: 0 };
    return getCellStyle(rule, value, stats);
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    return [...data].sort((a, b) => {
      const aVal = col.accessor(a);
      const bVal = col.accessor(b);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  }, [data, sortKey, sortDir, columns]);

  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border-border flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
        <p className="text-muted-foreground text-sm">{emptyMessage ?? tReports('noData')}</p>
      </div>
    );
  }

  return (
    <div>
      <DataTableToolbar
        columns={toolbarColumns}
        visibleColumns={visibleColumns}
        formattingRules={formattingRules}
        onToggleColumn={toggleColumn}
        onApplyFormatting={setFormattingRules}
      />
      <div className="border-border bg-card rounded-xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                {visibleColumnDefs.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'text-muted-foreground hover:text-foreground cursor-pointer px-4 py-3 font-medium transition-colors',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                    )}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-border hover:bg-accent/50 border-b last:border-0">
                  {visibleColumnDefs.map((col) => {
                    const value = col.accessor(row);
                    const formatted = col.format ? col.format(value) : String(value);
                    const cellStyle = getColumnCellStyle(col.key, value);
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.className,
                        )}
                        style={cellStyle}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-border flex items-center justify-between border-t px-4 py-3">
            <span className="text-muted-foreground text-xs">
              {t('showing', {
                from: page * pageSize + 1,
                to: Math.min((page + 1) * pageSize, sortedData.length),
                total: sortedData.length,
              })}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="hover:bg-accent rounded-md p-1 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-muted-foreground px-2 text-xs">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="hover:bg-accent rounded-md p-1 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Plain component (no toolbar) for when tableId is omitted
function ReportTablePlain<T>({
  data,
  columns,
  isLoading,
  pageSize = 20,
  emptyMessage,
  defaultSortKey,
  defaultSortDir,
}: Omit<ReportTableProps<T>, 'tableId'>) {
  const t = useTranslations('common');
  const tReports = useTranslations('reports');
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortDir ?? null);
  const [page, setPage] = useState(0);

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;
    return [...data].sort((a, b) => {
      const aVal = col.accessor(a);
      const bVal = col.accessor(b);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  }, [data, sortKey, sortDir, columns]);

  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir(null);
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="border-border flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed">
        <p className="text-muted-foreground text-sm">{emptyMessage ?? tReports('noData')}</p>
      </div>
    );
  }

  return (
    <div className="border-border bg-card rounded-xl border shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-muted-foreground hover:text-foreground cursor-pointer px-4 py-3 font-medium transition-colors',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                  )}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortKey === col.key ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-border hover:bg-accent/50 border-b last:border-0">
                {columns.map((col) => {
                  const value = col.accessor(row);
                  const formatted = col.format ? col.format(value) : String(value);
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.className,
                      )}
                    >
                      {formatted}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="border-border flex items-center justify-between border-t px-4 py-3">
          <span className="text-muted-foreground text-xs">
            {t('showing', {
              from: page * pageSize + 1,
              to: Math.min((page + 1) * pageSize, sortedData.length),
              total: sortedData.length,
            })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="hover:bg-accent rounded-md p-1 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-muted-foreground px-2 text-xs">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="hover:bg-accent rounded-md p-1 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportTable<T>(props: ReportTableProps<T>) {
  if (props.tableId) {
    return <ReportTableWithSettings {...props} tableId={props.tableId} />;
  }
  return <ReportTablePlain {...props} />;
}
```

**Step 4: Run tests — verify they PASS**

```bash
pnpm --filter @retention/frontend test -- src/features/reports/components/report-table.test.tsx
```

Expected: `PASS — all tests passed`

**Step 5: Run full test suite to check for regressions**

```bash
pnpm --filter @retention/frontend test
```

Expected: `PASS — all existing tests still pass`

**Step 6: Commit**

```bash
git add apps/frontend/src/features/reports/components/report-table.tsx apps/frontend/src/features/reports/components/report-table.test.tsx
git commit -m "feat: extend ReportTable with column visibility and conditional formatting toolbar"
```

---

### Task 8: Add tableId to all report pages

**Files to modify** (one commit each, or one combined commit):

- `apps/frontend/src/features/reports/components/sender-report-page.tsx`
- `apps/frontend/src/features/reports/components/account-report-page.tsx`
- `apps/frontend/src/features/reports/components/provider-report-page.tsx`
- `apps/frontend/src/features/reports/components/ip-report-page.tsx`
- `apps/frontend/src/features/reports/components/volume-report-page.tsx`
- `apps/frontend/src/features/reports/components/pool-report-page.tsx`

> **Note (out of scope):** `event-detail-page.tsx` and `event-breakdown-page.tsx` were found to NOT use the `ReportTable` component — `event-detail-page.tsx` uses a custom hand-rolled table and `event-breakdown-page.tsx` uses `BreakdownPanel` components. They are therefore out of scope for this `tableId` implementation.

For each file, also add `alwaysVisible: true` to identity columns and `isNumeric: true` to numeric columns. This enables the formatting feature to work correctly.

**Step 1: Update sender-report-page.tsx**

Find the `columns` array and add the props:

```typescript
const columns = useMemo<ColumnDef<SenderReport>[]>(
  () => [
    { key: 'sender_email', header: t('sender'), accessor: (row) => row.sender_email, alwaysVisible: true },
    {
      key: 'account_id',
      header: 'Account',
      accessor: (row) => accountNameMap.get(row.account_id) ?? row.account_id,
      alwaysVisible: true,
    },
    {
      key: 'delivered',
      header: 'Delivered',
      accessor: (row) => row.delivered,
      align: 'right',
      format: (v) => formatNumber(Number(v)),
      isNumeric: true,
    },
    {
      key: 'opened',
      header: 'Opened',
      accessor: (row) => row.opened,
      align: 'right',
      format: (v) => formatNumber(Number(v)),
      isNumeric: true,
    },
    {
      key: 'clicked',
      header: 'Clicked',
      accessor: (row) => row.clicked,
      align: 'right',
      format: (v) => formatNumber(Number(v)),
      isNumeric: true,
    },
    {
      key: 'bounced',
      header: 'Bounced',
      accessor: (row) => row.bounced,
      align: 'right',
      format: (v) => formatNumber(Number(v)),
      isNumeric: true,
    },
    {
      key: 'deferred',
      header: 'Deferred',
      accessor: (row) => row.deferred,
      align: 'right',
      format: (v) => formatNumber(Number(v)),
      isNumeric: true,
    },
    {
      key: 'dropped',
      header: 'Dropped',
      accessor: (row) => row.dropped,
      align: 'right',
      format: (v) => formatNumber(Number(v)),
      isNumeric: true,
    },
    {
      key: 'spam_reported',
      header: 'Spam',
      accessor: (row) => row.spam_reported,
      align: 'right',
      format: (v) => formatNumber(Number(v)),
      isNumeric: true,
    },
    {
      key: 'delivery_rate',
      header: 'Delivery Rate',
      accessor: (row) => row.delivery_rate,
      align: 'right',
      format: (v) => `${Number(v).toFixed(2)}%`,
      className: 'font-medium',
      isNumeric: true,
    },
    {
      key: 'bounce_rate',
      header: 'Bounce Rate',
      accessor: (row) => row.bounce_rate,
      align: 'right',
      format: (v) => `${Number(v).toFixed(2)}%`,
      isNumeric: true,
    },
  ],
  [accountNameMap, formatNumber],
);
```

And update the JSX:

```tsx
<ReportTable data={data ?? []} columns={columns} isLoading={isLoading} tableId="sender-report" />
```

**Step 2: Update account-report-page.tsx**

Add `alwaysVisible: true` to `account_id`, `isNumeric: true` to all numeric columns, and `tableId="account-report"`.

**Step 3: Update provider-report-page.tsx**

Add `alwaysVisible: true` to `provider_account`, `isNumeric: true` to numeric columns, and `tableId="provider-report"`.

**Step 4: Update ip-report-page.tsx**

Add `alwaysVisible: true` to `sending_ip` and `sender_email`, `isNumeric: true` to numeric columns, and `tableId="ip-report"`.

**Step 5: Update volume-report-page.tsx**

Add `alwaysVisible: true` to `hour`/`date` time column, `isNumeric: true` to numeric columns, and `tableId="volume-report"`.

**Step 6: Update pool-report-page.tsx**

Add `alwaysVisible: true` to pool identity column, `isNumeric: true` to numeric columns, and `tableId="pool-report"`.

**Step 7: Update event-breakdown-page.tsx**

Read the file first to identify column structure, then add `alwaysVisible`/`isNumeric` as appropriate and `tableId="event-breakdown"`.

**Step 8: Type-check to verify no TypeScript errors**

```bash
pnpm --filter @retention/frontend type-check
```

Expected: `no errors`

**Step 9: Commit**

```bash
git add apps/frontend/src/features/reports/components/
git commit -m "feat: enable datatable toolbar on all report pages with tableId"
```

---

### Task 9: Final verification

**Step 1: Run full test suite**

```bash
pnpm --filter @retention/frontend test
```

Expected: All tests pass.

**Step 2: Build to verify no compilation errors**

```bash
pnpm --filter @retention/frontend build
```

Expected: Build completes without errors.

**Step 3: Commit if anything was fixed**

Only commit if Step 1 or Step 2 revealed issues that needed fixing.

---

## Summary of new files

| File                                               | Purpose                                          |
| -------------------------------------------------- | ------------------------------------------------ |
| `src/components/data-table/types.ts`               | FormattingRule types and FORMATTING_PRESETS      |
| `src/lib/color-utils.ts`                           | Color interpolation + darkness detection         |
| `src/hooks/use-table-settings.ts`                  | localStorage-persisted column + formatting state |
| `src/components/data-table/columns-popover.tsx`    | Column visibility toggle UI                      |
| `src/components/data-table/formatting-modal.tsx`   | Conditional formatting rules editor              |
| `src/components/data-table/data-table-toolbar.tsx` | Toolbar container (Columns + Formatting buttons) |

## Modified files

| File                                               | Change                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/features/reports/components/report-table.tsx` | Add `tableId`, `alwaysVisible`, `isNumeric` support; render toolbar; apply cell styles |
| 7 report pages                                     | Add `tableId` prop + `alwaysVisible`/`isNumeric` on columns                            |
