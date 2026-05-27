// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';
import { renderHook } from '@testing-library/react';
import '@/lib/i18n';
import { useTagsColumns } from '../tags-columns';
import type { Tag } from '../types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: Record<string, unknown>) => (
    <a href={`${to}${params ? `/${(params as Record<string, string>).tagId}` : ''}`} {...props}>
      {children as React.ReactNode}
    </a>
  ),
}));

const mockTags: Tag[] = [
  { id: 1, name: 'VIP Customers', type: 'manual', countContacts: 1500 },
  { id: 2, name: 'Newsletter', type: undefined, countContacts: undefined },
];

function ColumnsTable({
  onDelete,
  canDelete,
  data = mockTags,
}: {
  onDelete: (tag: Tag) => void;
  canDelete: boolean;
  data?: Tag[];
}) {
  const columns = useTagsColumns({ onDelete, canDelete });
  const table = useReactTable({
    columns,
    data,
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

describe('useTagsColumns', () => {
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns translated column headers', () => {
    const { result } = renderHook(() => useTagsColumns({ onDelete, canDelete: true }));
    const headers = result.current.map((c) => c.header).filter((h) => typeof h === 'string');

    expect(headers).toContain('Nome');
    expect(headers).toContain('Tipo');
    expect(headers).toContain('Contatos');
  });

  it('renders tag name as a link to edit page', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    const link = screen.getByRole('link', { name: 'VIP Customers' });
    expect(link).toHaveAttribute('href', '/tags/$tagId/1');
  });

  it('renders type as a badge when present', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    expect(screen.getByText('manual')).toBeInTheDocument();
  });

  it('renders nothing for type when absent', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} data={[mockTags[1]]} />);
    // "Newsletter" row has no type badge
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('formats contact count with locale', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    // 1500 formatted — accept either "1,500" or "1.500" depending on locale
    const cell = screen.getByText(Number(1500).toLocaleString());
    expect(cell).toBeInTheDocument();
  });

  it('shows dash for missing contact count', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} data={[mockTags[1]]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders edit button for each row', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    const editButtons = screen.getAllByRole('link', { name: /editar/i });
    expect(editButtons).toHaveLength(2);
  });

  it('renders delete button when canDelete is true', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
    expect(deleteButtons).toHaveLength(2);
  });

  it('hides delete button when canDelete is false', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={false} />);
    expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument();
  });

  it('calls onDelete with the tag when delete button is clicked', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(mockTags[0]);
  });
});
