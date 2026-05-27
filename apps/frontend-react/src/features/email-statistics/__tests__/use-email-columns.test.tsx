import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@/lib/i18n';
import type { StatisticsTableRow } from '../types';
import { useEmailColumns } from '../components/table/use-email-columns';

// Helper to render a column cell
function renderCell(
  columns: ReturnType<typeof useEmailColumns>,
  accessorKey: string,
  row: Partial<StatisticsTableRow>,
) {
  const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === accessorKey);
  if (!col || !col.cell) throw new Error(`Column ${accessorKey} not found`);
  const cellContext = { row: { original: row } } as Parameters<Exclude<typeof col.cell, string>>[0];
  return render(<>{typeof col.cell === 'function' ? col.cell(cellContext) : col.cell}</>);
}

// Wrapper to use the hook
function getColumns() {
  let cols: ReturnType<typeof useEmailColumns> = [];
  function TestHook() {
    cols = useEmailColumns('America/Sao_Paulo');
    return null;
  }
  render(<TestHook />);
  return cols;
}

describe('useEmailColumns cells with null/undefined values', () => {
  it('does not crash when delivered is null', () => {
    const cols = getColumns();
    expect(() => {
      renderCell(cols, 'delivered', { delivered: null as unknown as number });
    }).not.toThrow();
  });

  it('does not crash when delivered is undefined', () => {
    const cols = getColumns();
    expect(() => {
      renderCell(cols, 'delivered', { delivered: undefined as unknown as number });
    }).not.toThrow();
  });

  it('does not crash when percentage fields are null', () => {
    const cols = getColumns();
    expect(() => {
      renderCell(cols, 'percentageOpen', {
        percentageOpen: null as unknown as number,
        open: null as unknown as number,
      });
    }).not.toThrow();
  });

  it('renders 0 for null delivered', () => {
    const cols = getColumns();
    const { container } = renderCell(cols, 'delivered', { delivered: null as unknown as number });
    expect(container.textContent).toBe('0');
  });

  it('renders valid delivered count', () => {
    const cols = getColumns();
    const { container } = renderCell(cols, 'delivered', { delivered: 16026370 });
    expect(container.textContent).toBe('16.026.370');
  });
});
