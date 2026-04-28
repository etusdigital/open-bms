// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { usePoolsColumns } from '../pools-columns';
import type { Pool } from '../types';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';

const mockPool: Pool = {
  id: 1,
  name: 'Main Pool',
  description: 'Primary sending pool',
  poolName: 'main-pool',
  senderName: 'Test Sender',
  senderEmail: 'test@example.com',
  isDefault: false,
  updatedAt: '2026-01-15T10:00:00Z',
};

function ColumnsTable({ pools, canDelete = true }: { pools: Pool[]; canDelete?: boolean }) {
  const onDelete = vi.fn();
  const columns = usePoolsColumns({ onDelete, canDelete });
  const table = useReactTable({
    columns,
    data: pools,
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

describe('usePoolsColumns', () => {
  it('returns columns with translated headers', () => {
    const { result } = renderHook(() => usePoolsColumns({ onDelete: vi.fn(), canDelete: true }));
    const headers = result.current.map((c) => (typeof c.header === 'string' ? c.header : c.id)).filter(Boolean);
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders name as link to detail page', async () => {
    await renderWithRouter(<ColumnsTable pools={[mockPool]} />);
    const link = screen.getByRole('link', { name: 'Main Pool' });
    expect(link).toHaveAttribute('href', '/pools/1');
  });

  it('renders sender info', async () => {
    await renderWithRouter(<ColumnsTable pools={[mockPool]} />);
    expect(screen.getByText('Test Sender - test@example.com')).toBeInTheDocument();
  });

  it('renders pool name in monospace', async () => {
    await renderWithRouter(<ColumnsTable pools={[mockPool]} />);
    expect(screen.getByText('main-pool')).toBeInTheDocument();
  });

  it('renders default badge for default pools', async () => {
    const defaultPool: Pool = { ...mockPool, isDefault: true };
    await renderWithRouter(<ColumnsTable pools={[defaultPool]} />);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders delete button when canDelete is true', async () => {
    await renderWithRouter(<ColumnsTable pools={[mockPool]} canDelete />);
    expect(screen.getByText(/excluir/i)).toBeInTheDocument();
  });

  it('hides delete button when canDelete is false', async () => {
    await renderWithRouter(<ColumnsTable pools={[mockPool]} canDelete={false} />);
    expect(screen.queryByText(/excluir/i)).not.toBeInTheDocument();
  });
});
