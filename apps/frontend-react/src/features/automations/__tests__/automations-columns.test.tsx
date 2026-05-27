// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { useAutomationsColumns } from '../automations-columns';
import type { Automation } from '../types';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';
import { createElement } from 'react';

const mockAutomation: Automation = {
  id: 1,
  title: 'Welcome Series',
  description: 'Onboarding emails',
  type: 'email',
  isActive: true,
  isRateLimit: false,
  stepId: 10,
  updatedAt: '2026-04-01T10:00:00Z',
};

const mockInactiveAutomation: Automation = {
  id: 2,
  title: 'Re-engagement',
  type: 'email',
  isActive: false,
  isRateLimit: false,
  stepId: 20,
  createdAt: '2026-03-15T08:00:00Z',
};

const mockOnDelete = vi.fn();
const mockOnDuplicate = vi.fn();

function TableRenderer({
  data,
  canDelete = true,
  canCreate = true,
}: {
  data: Automation[];
  canDelete?: boolean;
  canCreate?: boolean;
}) {
  const columns = useAutomationsColumns({
    onDelete: mockOnDelete,
    onDuplicate: mockOnDuplicate,
    canDelete,
    canCreate,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return createElement(
    'table',
    null,
    createElement(
      'tbody',
      null,
      table.getRowModel().rows.map((row) =>
        createElement(
          'tr',
          { key: row.id },
          row
            .getVisibleCells()
            .map((cell) =>
              createElement('td', { key: cell.id }, flexRender(cell.column.columnDef.cell, cell.getContext())),
            ),
        ),
      ),
    ),
  );
}

describe('useAutomationsColumns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({
      permissions: ['automations:view', 'automations:create', 'automations:delete'],
    });
  });

  it('returns 4 columns (title, status, updatedAt, actions)', () => {
    const { result } = renderHook(() =>
      useAutomationsColumns({
        onDelete: mockOnDelete,
        onDuplicate: mockOnDuplicate,
        canDelete: true,
        canCreate: true,
      }),
    );
    expect(result.current).toHaveLength(4);
  });

  describe('title column', () => {
    it('renders title as a link', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation] }));
      const link = screen.getByText('Welcome Series');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining('/automations/1'));
    });

    it('renders description when present', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation] }));
      expect(screen.getByText('Onboarding emails')).toBeInTheDocument();
    });

    it('does not render description when absent', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockInactiveAutomation] }));
      expect(screen.queryByText('Onboarding emails')).not.toBeInTheDocument();
    });
  });

  describe('status column', () => {
    it('shows active badge for active automation', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation] }));
      expect(screen.getByText('Ativa')).toBeInTheDocument();
    });

    it('shows inactive badge for inactive automation', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockInactiveAutomation] }));
      expect(screen.getByText('Inativa')).toBeInTheDocument();
    });
  });

  describe('updatedAt column', () => {
    it('renders formatted updatedAt date', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation] }));
      // Date formatting depends on locale, just check it doesn't show "—"
      expect(screen.queryByText('—')).not.toBeInTheDocument();
    });

    it('renders date with a time component (dd/mm/yyyy hh:MM)', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation] }));
      // EVO-1409: grids must show date + time, not date-only
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument();
    });

    it('falls back to createdAt when updatedAt is missing', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockInactiveAutomation] }));
      expect(screen.queryByText('���')).not.toBeInTheDocument();
    });
  });

  describe('actions column', () => {
    it('shows duplicate button when canCreate is true', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation], canCreate: true }));
      expect(screen.getByRole('button', { name: /duplicar/i })).toBeInTheDocument();
    });

    it('hides duplicate button when canCreate is false', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation], canCreate: false }));
      expect(screen.queryByRole('button', { name: /duplicar/i })).not.toBeInTheDocument();
    });

    it('shows delete button when canDelete is true', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation], canDelete: true }));
      expect(screen.getByRole('button', { name: /excluir/i })).toBeInTheDocument();
    });

    it('hides delete button when canDelete is false', async () => {
      await renderWithRouter(createElement(TableRenderer, { data: [mockAutomation], canDelete: false }));
      expect(screen.queryByRole('button', { name: /excluir/i })).not.toBeInTheDocument();
    });
  });
});
