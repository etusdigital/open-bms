// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { useSegmentsColumns } from '../segments-columns';
import type { Segment } from '../types';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';

const mockSegment: Segment = {
  id: 1,
  name: 'Active Users',
  description: 'Users active in last 30 days',
  type: 'segment',
  status: 'active',
  lastCount: 1500,
  lastCountEmail: 1200,
  lastCountWebPush: 300,
  lastCountMobilePush: 200,
  lastCountPhone: 100,
  lastCountWhatsapp: 50,
  lastRunDate: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-15T10:00:00Z',
};

const defaultVisibility = {
  lastCountEmail: true,
  lastCountWebPush: true,
  lastCountMobilePush: true,
  lastCountPhone: true,
  lastCountWhatsapp: true,
};

function ColumnsTable({
  segments,
  canDelete = true,
  canExecute = true,
}: {
  segments: Segment[];
  canDelete?: boolean;
  canExecute?: boolean;
}) {
  const onDelete = vi.fn();
  const onCopy = vi.fn();
  const onRun = vi.fn();
  const columns = useSegmentsColumns({
    onDelete,
    onCopy,
    onRun,
    canDelete,
    canExecute,
    columnVisibility: defaultVisibility,
    processingIds: new Set(),
  });
  const table = useReactTable({
    columns,
    data: segments,
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

describe('useSegmentsColumns', () => {
  it('returns columns with translated headers', () => {
    const { result } = renderHook(() =>
      useSegmentsColumns({
        onDelete: vi.fn(),
        onCopy: vi.fn(),
        onRun: vi.fn(),
        canDelete: true,
        canExecute: true,
        columnVisibility: defaultVisibility,
        processingIds: new Set(),
      }),
    );
    const headers = result.current.map((c) => (typeof c.header === 'string' ? c.header : c.id)).filter(Boolean);
    expect(headers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders name as link to detail page', async () => {
    await renderWithRouter(<ColumnsTable segments={[mockSegment]} />);
    const link = screen.getByRole('link', { name: 'Active Users' });
    expect(link).toHaveAttribute('href', '/segments/1');
  });

  it('renders status badge', async () => {
    await renderWithRouter(<ColumnsTable segments={[mockSegment]} />);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders lastCount formatted', async () => {
    await renderWithRouter(<ColumnsTable segments={[mockSegment]} />);
    expect(screen.getByText('1,500')).toBeInTheDocument();
  });

  it('renders delete button when canDelete is true', async () => {
    await renderWithRouter(<ColumnsTable segments={[mockSegment]} canDelete />);
    expect(screen.getByText(/excluir/i)).toBeInTheDocument();
  });

  it('hides delete button when canDelete is false', async () => {
    await renderWithRouter(<ColumnsTable segments={[mockSegment]} canDelete={false} />);
    expect(screen.queryByText(/excluir/i)).not.toBeInTheDocument();
  });

  it('renders copy button when canExecute is true', async () => {
    await renderWithRouter(<ColumnsTable segments={[mockSegment]} canExecute />);
    expect(screen.getByText(/copiar/i)).toBeInTheDocument();
  });

  it('renders run button when canExecute is true', async () => {
    await renderWithRouter(<ColumnsTable segments={[mockSegment]} canExecute />);
    expect(screen.getByText(/executar/i)).toBeInTheDocument();
  });

  it('renders channel count columns when all visible', async () => {
    await renderWithRouter(<ColumnsTable segments={[mockSegment]} />);
    // Email count should be rendered (1,200)
    expect(screen.getByText('1,200')).toBeInTheDocument();
    // WhatsApp count (50)
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('hides channel columns when visibility is false', async () => {
    const hiddenVisibility = {
      lastCountEmail: false,
      lastCountWebPush: false,
      lastCountMobilePush: false,
      lastCountPhone: false,
      lastCountWhatsapp: false,
    };

    function HiddenColumnsTable() {
      const onDelete = vi.fn();
      const onCopy = vi.fn();
      const onRun = vi.fn();
      const columns = useSegmentsColumns({
        onDelete,
        onCopy,
        onRun,
        canDelete: true,
        canExecute: true,
        columnVisibility: hiddenVisibility,
        processingIds: new Set(),
      });
      const table = useReactTable({
        columns,
        data: [mockSegment],
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

    await renderWithRouter(<HiddenColumnsTable />);

    // Channel-specific counts should NOT be rendered
    expect(screen.queryByText('1,200')).not.toBeInTheDocument(); // email
    expect(screen.queryByText('50')).not.toBeInTheDocument(); // whatsapp

    // But total count should still show
    expect(screen.getByText('1,500')).toBeInTheDocument();
  });

  it('shows only selected channel columns', async () => {
    const partialVisibility = {
      lastCountEmail: true,
      lastCountWebPush: false,
      lastCountMobilePush: false,
      lastCountPhone: false,
      lastCountWhatsapp: true,
    };

    function PartialColumnsTable() {
      const onDelete = vi.fn();
      const onCopy = vi.fn();
      const onRun = vi.fn();
      const columns = useSegmentsColumns({
        onDelete,
        onCopy,
        onRun,
        canDelete: true,
        canExecute: true,
        columnVisibility: partialVisibility,
        processingIds: new Set(),
      });
      const table = useReactTable({
        columns,
        data: [mockSegment],
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

    await renderWithRouter(<PartialColumnsTable />);

    // Email (1,200) and WhatsApp (50) should be visible
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();

    // Web Push (300), Mobile Push (200), SMS (100) should NOT be visible
    expect(screen.queryByText('300')).not.toBeInTheDocument();
    expect(screen.queryByText('200')).not.toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument();
  });
});
