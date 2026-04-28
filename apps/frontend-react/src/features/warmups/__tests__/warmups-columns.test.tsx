// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { useWarmupsColumns } from '../warmups-columns';
import type { Warmup } from '../types';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';

const mockWarmup: Warmup = {
  id: 1,
  accountId: 10,
  targetAccountId: 20,
  sender: 'warmup@example.com',
  ippool: 'main-pool',
  target: 10000,
  currentSend: 5000,
  status: 'running',
  type: 'internal',
  description: 'Test warmup',
  createdAt: '2026-01-15T10:00:00Z',
};

function ColumnsTable({ warmups, canDelete = true }: { warmups: Warmup[]; canDelete?: boolean }) {
  const onDelete = vi.fn();
  const columns = useWarmupsColumns({ onDelete, canDelete });
  const table = useReactTable({
    columns,
    data: warmups,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((hg) => (
          <tr key={hg.id}>
            {hg.headers.map((h) => (
              <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

describe('useWarmupsColumns', () => {
  it('returns columns with translated headers', () => {
    const { result } = renderHook(() => useWarmupsColumns({ onDelete: vi.fn(), canDelete: true }));
    const headers = result.current.map((c) => (typeof c.header === 'string' ? c.header : c.id)).filter(Boolean);
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders sender as link to detail page', async () => {
    await renderWithRouter(<ColumnsTable warmups={[mockWarmup]} />);
    const link = screen.getByRole('link', { name: 'warmup@example.com' });
    expect(link).toHaveAttribute('href', '/warmups/1');
  });

  it('renders status badge', async () => {
    await renderWithRouter(<ColumnsTable warmups={[mockWarmup]} />);
    expect(screen.getByText('Aquecendo')).toBeInTheDocument();
  });

  it('renders progress bar with percentage', async () => {
    await renderWithRouter(<ColumnsTable warmups={[mockWarmup]} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders delete button when canDelete is true', async () => {
    await renderWithRouter(<ColumnsTable warmups={[mockWarmup]} canDelete />);
    expect(screen.getByText(/excluir/i)).toBeInTheDocument();
  });

  it('hides delete button when canDelete is false', async () => {
    await renderWithRouter(<ColumnsTable warmups={[mockWarmup]} canDelete={false} />);
    expect(screen.queryByText(/excluir/i)).not.toBeInTheDocument();
  });
});
