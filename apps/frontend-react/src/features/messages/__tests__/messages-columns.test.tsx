import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';
import { useMessagesColumns } from '../messages-columns';
import type { Message, MessageType } from '../types';

const defaultOptions = {
  onDelete: vi.fn(),
  onDuplicate: vi.fn(),
  canDelete: true,
  canCreate: true,
};

function TableRenderer({ messageType, data }: { messageType: MessageType; data: Message[] }) {
  const columns = useMessagesColumns({ ...defaultOptions, messageType });
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
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

function renderColumns(messageType: MessageType, data: Message[]) {
  return renderWithRouter(<TableRenderer messageType={messageType} data={data} />);
}

describe('useMessagesColumns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('title column with description', () => {
    it('shows title as a link for all message types', async () => {
      await renderColumns('email', [{ id: 1, title: 'Test Email', type: 'email' }]);
      expect(screen.getByText('Test Email')).toBeInTheDocument();
      expect(screen.getByText('Test Email').closest('a')).toBeTruthy();
    });

    it('shows description below title when present', async () => {
      await renderColumns('sms', [{ id: 1, title: 'SMS Message', type: 'sms', description: 'A short description' }]);
      expect(screen.getByText('SMS Message')).toBeInTheDocument();
      expect(screen.getByText('A short description')).toBeInTheDocument();
    });

    it('does not render description paragraph when absent', async () => {
      await renderColumns('email', [{ id: 1, title: 'No Desc', type: 'email' }]);
      expect(screen.getByText('No Desc')).toBeInTheDocument();
      expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
    });
  });

  describe('email columns', () => {
    it('shows sender and subject columns for email', async () => {
      await renderColumns('email', [
        {
          id: 1,
          title: 'Welcome',
          type: 'email',
          fromName: 'John',
          fromMail: 'john@test.com',
          subject: 'Hello World',
        },
      ]);
      // Headers
      expect(screen.getByText('Remetente')).toBeInTheDocument();
      expect(screen.getByText('Assunto')).toBeInTheDocument();
      // Cell content
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('shows dash when sender info is missing', async () => {
      await renderColumns('email', [{ id: 1, title: 'No Sender', type: 'email' }]);
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show sender/subject columns for SMS', async () => {
      await renderColumns('sms', [{ id: 1, title: 'SMS', type: 'sms' }]);
      expect(screen.queryByText('Remetente')).not.toBeInTheDocument();
      expect(screen.queryByText('Assunto')).not.toBeInTheDocument();
    });
  });

  describe('whatsapp columns', () => {
    it('shows status and content type columns for whatsapp', async () => {
      await renderColumns('whatsapp', [
        {
          id: 1,
          title: 'WA Message',
          type: 'whatsapp',
          status: 'approved',
          whatsappType: 'text',
        },
      ]);
      // Headers
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Tipo de conteúdo')).toBeInTheDocument();
      // Cell content
      expect(screen.getByText('Aprovada')).toBeInTheDocument();
      expect(screen.getByText('Texto')).toBeInTheDocument();
    });

    it('translates call-to-action content type', async () => {
      await renderColumns('whatsapp', [
        {
          id: 1,
          title: 'CTA Message',
          type: 'whatsapp',
          whatsappType: 'call-to-action',
        },
      ]);
      expect(screen.getByText('Call to Action')).toBeInTheDocument();
    });

    it('translates call_to_action (underscore variant) content type', async () => {
      await renderColumns('whatsapp', [
        {
          id: 1,
          title: 'CTA2',
          type: 'whatsapp',
          whatsappType: 'call_to_action',
        },
      ]);
      expect(screen.getByText('Call to Action')).toBeInTheDocument();
    });

    it('shows dash when status is missing', async () => {
      await renderColumns('whatsapp', [{ id: 1, title: 'No Status', type: 'whatsapp' }]);
      // At least one dash for status, one for whatsappType
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });

    it('does not show status/content type columns for email', async () => {
      await renderColumns('email', [{ id: 1, title: 'Email', type: 'email' }]);
      expect(screen.queryByText('Tipo de conteúdo')).not.toBeInTheDocument();
    });
  });

  describe('common columns', () => {
    it('shows updatedAt column for all types', async () => {
      await renderColumns('web-push', [{ id: 1, title: 'Push', type: 'web-push', updatedAt: '2026-03-15T10:00:00Z' }]);
      expect(screen.getByText('Última edição')).toBeInTheDocument();
    });

    it('shows action buttons', async () => {
      await renderColumns('email', [{ id: 1, title: 'Msg', type: 'email' }]);
      // Edit is a Link rendered asChild, duplicate and delete are buttons
      expect(screen.getByText(/editar/i)).toBeInTheDocument();
      expect(screen.getByText(/duplicar/i)).toBeInTheDocument();
      expect(screen.getByText(/excluir/i)).toBeInTheDocument();
    });
  });
});
