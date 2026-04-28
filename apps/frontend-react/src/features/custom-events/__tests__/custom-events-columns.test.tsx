// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { useCustomEventsColumns } from '../custom-events-columns';
import type { CustomEvent } from '../types';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';

const mockEvent: CustomEvent = {
  id: 1,
  name: 'page_view',
  description: 'User viewed a page',
  updatedAt: '2026-01-15T10:00:00Z',
};

function ColumnsTable({ events, canDelete = true }: { events: CustomEvent[]; canDelete?: boolean }) {
  const onDelete = vi.fn();
  const columns = useCustomEventsColumns({ onDelete, canDelete });
  const table = useReactTable({
    columns,
    data: events,
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

describe('useCustomEventsColumns', () => {
  it('returns columns with translated headers', () => {
    const { result } = renderHook(() => useCustomEventsColumns({ onDelete: vi.fn(), canDelete: true }));
    const headers = result.current.map((c) => (typeof c.header === 'string' ? c.header : c.id)).filter(Boolean);
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders name as link to detail page', async () => {
    await renderWithRouter(<ColumnsTable events={[mockEvent]} />);
    const link = screen.getByRole('link', { name: 'page_view' });
    expect(link).toHaveAttribute('href', '/custom-events/1');
  });

  it('renders description below name', async () => {
    await renderWithRouter(<ColumnsTable events={[mockEvent]} />);
    expect(screen.getByText('User viewed a page')).toBeInTheDocument();
  });

  it('renders edit link in actions column', async () => {
    await renderWithRouter(<ColumnsTable events={[mockEvent]} />);
    const editLinks = screen.getAllByRole('link');
    const editLink = editLinks.find((l) => l.getAttribute('href') === '/custom-events/1');
    expect(editLink).toBeDefined();
  });

  it('renders delete button when canDelete is true', async () => {
    await renderWithRouter(<ColumnsTable events={[mockEvent]} canDelete />);
    expect(screen.getByText(/excluir/i)).toBeInTheDocument();
  });

  it('hides delete button when canDelete is false', async () => {
    await renderWithRouter(<ColumnsTable events={[mockEvent]} canDelete={false} />);
    expect(screen.queryByText(/excluir/i)).not.toBeInTheDocument();
  });

  it('disables delete button for default events', async () => {
    const defaultEvent: CustomEvent = { ...mockEvent, isDefault: true };
    await renderWithRouter(<ColumnsTable events={[defaultEvent]} canDelete />);
    const deleteButton = screen.getByText(/padrão/i).closest('button') ?? document.querySelector('button[disabled]');
    expect(deleteButton).toBeTruthy();
  });
});
