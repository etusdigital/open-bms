import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@/lib/i18n';
import type { StatisticsTableRow } from '../types';
import { usePerUserColumns } from '../components/table/use-per-user-columns';

function getColumns() {
  let cols: ReturnType<typeof usePerUserColumns> = [];
  function TestHook() {
    cols = usePerUserColumns('America/Sao_Paulo');
    return null;
  }
  render(<TestHook />);
  return cols;
}

function renderCell(
  columns: ReturnType<typeof usePerUserColumns>,
  accessorKey: string,
  row: Partial<StatisticsTableRow>,
) {
  const col = columns.find((c) => 'accessorKey' in c && c.accessorKey === accessorKey);
  if (!col || !col.cell) throw new Error(`Column ${accessorKey} not found`);
  const cellContext = { row: { original: row } } as Parameters<Exclude<typeof col.cell, string>>[0];
  return render(<>{typeof col.cell === 'function' ? col.cell(cellContext) : col.cell}</>);
}

describe('usePerUserColumns', () => {
  it('returns 7 columns', () => {
    const cols = getColumns();
    expect(cols.length).toBe(7); // date, baseSize, engaged, dau, avgOpen, avgClick, unsubByBase
  });

  it('does not crash when unique_user_delivered is null', () => {
    const cols = getColumns();
    expect(() => {
      renderCell(cols, 'unique_user_delivered', {
        unique_user_delivered: null as unknown as number,
      });
    }).not.toThrow();
  });

  it('does not crash when percentage fields are null', () => {
    const cols = getColumns();
    expect(() => {
      renderCell(cols, 'percentageUserOpen', {
        percentageUserOpen: null as unknown as number,
        unique_user_open: null as unknown as number,
      });
    }).not.toThrow();
  });

  it('renders base size formatted', () => {
    const cols = getColumns();
    const { container } = renderCell(cols, 'unique_user_delivered', {
      unique_user_delivered: 100000,
    });
    expect(container.textContent).toBe('100.000');
  });

  it('has right-aligned metricKey for base size, avgOpenRate, avgClickRate', () => {
    const cols = getColumns();
    const baseSize = cols.find((c) => 'accessorKey' in c && c.accessorKey === 'unique_user_delivered');
    const avgOpen = cols.find((c) => 'accessorKey' in c && c.accessorKey === 'opens_per_contact');
    const avgClick = cols.find((c) => 'accessorKey' in c && c.accessorKey === 'clicks_per_contact');

    expect((baseSize?.meta as Record<string, unknown>)?.align).toBe('right');
    expect((avgOpen?.meta as Record<string, unknown>)?.align).toBe('right');
    expect((avgClick?.meta as Record<string, unknown>)?.align).toBe('right');
  });
});
