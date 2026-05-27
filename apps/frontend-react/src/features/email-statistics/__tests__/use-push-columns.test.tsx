import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@/lib/i18n';
import type { StatisticsTableRow } from '../types';
import { usePushColumns } from '../components/table/use-push-columns';

function getColumns(isWebPush: boolean) {
  let cols: ReturnType<typeof usePushColumns> = [];
  function TestHook() {
    cols = usePushColumns(isWebPush, 'America/Sao_Paulo');
    return null;
  }
  render(<TestHook />);
  return cols;
}

function renderCell(columns: ReturnType<typeof usePushColumns>, accessorKey: string, row: Partial<StatisticsTableRow>) {
  const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === accessorKey);
  if (!col || !col.cell) throw new Error(`Column ${accessorKey} not found`);
  const cellContext = { row: { original: row } } as Parameters<Exclude<typeof col.cell, string>>[0];
  return render(<>{typeof col.cell === 'function' ? col.cell(cellContext) : col.cell}</>);
}

describe('usePushColumns', () => {
  it('returns 4 columns for non-webpush', () => {
    const cols = getColumns(false);
    expect(cols.length).toBe(4); // date, sent, delivered, click
  });

  it('returns 5 columns for webpush (includes close)', () => {
    const cols = getColumns(true);
    expect(cols.length).toBe(5);
  });

  it('does not crash when sent is null', () => {
    const cols = getColumns(false);
    expect(() => {
      renderCell(cols, 'sent', { sent: null as unknown as number });
    }).not.toThrow();
  });

  it('does not crash when percentage fields are null', () => {
    const cols = getColumns(false);
    expect(() => {
      renderCell(cols, 'percentageDelivered', {
        percentageDelivered: null as unknown as number,
        delivered: null as unknown as number,
      });
    }).not.toThrow();
  });

  it('renders sent value formatted', () => {
    const cols = getColumns(false);
    const { container } = renderCell(cols, 'sent', { sent: 50000 });
    expect(container.textContent).toBe('50.000');
  });
});
