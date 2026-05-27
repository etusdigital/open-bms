// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { useContactsColumns } from '../contacts-columns';
import type { Contact } from '../types';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';
import { TooltipProvider } from '@/components/ui/tooltip';

const mockContact: Contact = {
  id: 1,
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  isActive: true,
  hasEmail: true,
  hasPhone: false,
  hasWebPush: true,
  hasMobilePush: false,
  hasWhatsapp: false,
  createdAt: '2026-01-15T10:00:00Z',
};

function ColumnsTable({ contacts, canDelete = true }: { contacts: Contact[]; canDelete?: boolean }) {
  const onDelete = vi.fn();
  const columns = useContactsColumns({ onDelete, canDelete });
  const table = useReactTable({
    columns,
    data: contacts,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <TooltipProvider>
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
    </TooltipProvider>
  );
}

describe('useContactsColumns', () => {
  it('returns columns with translated headers', () => {
    const { result } = renderHook(() => useContactsColumns({ onDelete: vi.fn(), canDelete: true }));
    const headers = result.current.map((c) => (typeof c.header === 'string' ? c.header : c.id)).filter(Boolean);
    expect(headers.length).toBeGreaterThanOrEqual(3);
  });

  it('renders contact first name as link to detail page', async () => {
    await renderWithRouter(<ColumnsTable contacts={[mockContact]} />);
    const link = screen.getByRole('link', { name: 'John' });
    expect(link).toHaveAttribute('href', '/contacts/1');
  });

  it('renders email', async () => {
    await renderWithRouter(<ColumnsTable contacts={[mockContact]} />);
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('renders status badge for active contact', async () => {
    await renderWithRouter(<ColumnsTable contacts={[mockContact]} />);
    expect(screen.getByText(/ativo|active/i)).toBeInTheDocument();
  });

  it('renders delete button when canDelete is true', async () => {
    await renderWithRouter(<ColumnsTable contacts={[mockContact]} canDelete />);
    expect(screen.getByText(/excluir/i)).toBeInTheDocument();
  });

  it('hides delete button when canDelete is false', async () => {
    await renderWithRouter(<ColumnsTable contacts={[mockContact]} canDelete={false} />);
    expect(screen.queryByText(/excluir/i)).not.toBeInTheDocument();
  });
});
