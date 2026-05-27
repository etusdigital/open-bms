// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { useLabelsColumns } from '../labels-columns';
import type { Label } from '../types';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';

const mockLabel: Label = {
  id: 1,
  name: 'My Label',
  updatedAt: '2026-01-15T10:00:00Z',
};

function ColumnsTable({ labels, canDelete = true }: { labels: Label[]; canDelete?: boolean }) {
  const onDelete = vi.fn();
  const columns = useLabelsColumns({ onDelete, canDelete });
  const table = useReactTable({
    columns,
    data: labels,
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

describe('useLabelsColumns', () => {
  it('returns columns with translated headers', () => {
    const { result } = renderHook(() => useLabelsColumns({ onDelete: vi.fn(), canDelete: true }));
    const headers = result.current.map((c) => (typeof c.header === 'string' ? c.header : c.id)).filter(Boolean);
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders name as link to detail page', async () => {
    await renderWithRouter(<ColumnsTable labels={[mockLabel]} />);
    const link = screen.getByRole('link', { name: 'My Label' });
    expect(link).toHaveAttribute('href', '/labels/1');
  });

  it('renders updatedAt as formatted date', async () => {
    await renderWithRouter(<ColumnsTable labels={[mockLabel]} />);
    // Should show a formatted date, not raw ISO string
    expect(screen.queryByText('2026-01-15T10:00:00Z')).not.toBeInTheDocument();
  });

  it('renders edit link in actions column', async () => {
    await renderWithRouter(<ColumnsTable labels={[mockLabel]} />);
    const editLinks = screen.getAllByRole('link');
    const editLink = editLinks.find((l) => l.getAttribute('href') === '/labels/1');
    expect(editLink).toBeDefined();
  });

  it('renders delete button when canDelete is true', async () => {
    await renderWithRouter(<ColumnsTable labels={[mockLabel]} canDelete />);
    expect(screen.getByText(/excluir/i)).toBeInTheDocument();
  });

  it('hides delete button when canDelete is false', async () => {
    await renderWithRouter(<ColumnsTable labels={[mockLabel]} canDelete={false} />);
    expect(screen.queryByText(/excluir/i)).not.toBeInTheDocument();
  });

  it('renders dash for missing updatedAt', async () => {
    const label: Label = { id: 2, name: 'No Date' };
    await renderWithRouter(<ColumnsTable labels={[label]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
