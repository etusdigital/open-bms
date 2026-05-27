// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';
import { renderHook } from '@testing-library/react';
import '@/lib/i18n';
import { useCustomFieldsColumns } from '../custom-fields-columns';
import type { CustomField } from '../types';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: Record<string, unknown>) => (
    <a href={`${to}${params ? `/${(params as Record<string, string>).customFieldId}` : ''}`} {...props}>
      {children as React.ReactNode}
    </a>
  ),
}));

const mockCustomFields: CustomField[] = [
  { id: 1, title: 'Favorite Color', name: 'favorite_color', type: 'text' },
  { id: 2, title: 'Age', name: 'age', type: undefined },
];

function ColumnsTable({
  onDelete,
  canDelete,
  data = mockCustomFields,
}: {
  onDelete: (field: CustomField) => void;
  canDelete: boolean;
  data?: CustomField[];
}) {
  const columns = useCustomFieldsColumns({ onDelete, canDelete });
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

describe('useCustomFieldsColumns', () => {
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns translated column headers', () => {
    const { result } = renderHook(() => useCustomFieldsColumns({ onDelete, canDelete: true }));
    const headers = result.current.map((c) => c.header).filter((h) => typeof h === 'string');

    expect(headers).toContain('Título');
    expect(headers).toContain('Nome');
    expect(headers).toContain('Tipo');
  });

  it('renders title as a link to edit page', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    const link = screen.getByRole('link', { name: 'Favorite Color' });
    expect(link).toHaveAttribute('href', '/customfields/$customFieldId/1');
  });

  it('renders type as a badge when present', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('renders nothing for type when absent', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} data={[mockCustomFields[1]]} />);
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
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

  it('calls onDelete with the custom field when delete button is clicked', () => {
    render(<ColumnsTable onDelete={onDelete} canDelete={true} />);
    const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(mockCustomFields[0]);
  });
});
