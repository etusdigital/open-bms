import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import MessagesPage from '../messages-page';
import type { PaginatedResponse } from '@/types';
import type { Message } from '../types';

let mockQueryReturn: Record<string, unknown> = {};
const mockDeleteMutate = vi.fn();
const mockDuplicateMutate = vi.fn();

vi.mock('../use-messages', () => ({
  useMessagesList: () => mockQueryReturn,
  useDeleteMessage: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useDuplicateMessage: () => ({ mutate: mockDuplicateMutate, isPending: false }),
  useSendersForSelect: () => ({ data: [], isLoading: false, isSuccess: true }),
  useAutomationsForSelect: () => ({ data: [], isLoading: false }),
  useSyncTemplatesFromMeta: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({ created: 0, updated: 0, skipped: 0, total: 0 }), isPending: false }),
}));

function renderPage(messageType: 'email' | 'sms' | 'web-push' | 'mobile-push' | 'whatsapp' = 'email') {
  return renderWithRouter(
    <MessagesPage
      searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }}
      messageType={messageType}
    />,
  );
}

const mockMessages: PaginatedResponse<Message> = {
  data: [
    {
      id: 1,
      title: 'Welcome Email',
      type: 'email',
      subject: 'Welcome!',
      fromName: 'Sender',
      fromMail: 'no-reply@test.com',
      status: 'draft',
      updatedAt: '2026-03-13T10:00:00Z',
    },
    {
      id: 2,
      title: 'Follow Up',
      type: 'email',
      subject: 'Follow up!',
      fromName: 'Sender',
      fromMail: 'no-reply@test.com',
      status: 'approved',
      updatedAt: '2026-03-12T10:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, lastPage: 1, itemsPerPage: 10 },
};

describe('MessagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({
      permissions: ['messages:view', 'messages:create', 'messages:delete'],
      accountConfigs: [
        { accountId: 10, name: 'email_settings', value: '{"isActive": true}', isLoadConfig: false },
        { accountId: 10, name: 'sms_settings', value: '{"isActive": true}', isLoadConfig: false },
        {
          accountId: 10,
          name: 'webpush_settings',
          value: '{"isActive": true}',
          isLoadConfig: false,
        },
        {
          accountId: 10,
          name: 'mobilepush_settings',
          value: '{"isActive": true}',
          isLoadConfig: false,
        },
        {
          accountId: 10,
          name: 'whatsapp_settings',
          value: '{"isActive": true}',
          isLoadConfig: false,
        },
      ],
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, error: null };
    });

    it('renders the page title', async () => {
      await renderPage('email');
      expect(screen.getByText('Mensagens')).toBeInTheDocument();
    });

    it('renders channel tabs when onTypeChange is provided', async () => {
      await renderWithRouter(
        <MessagesPage
          searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }}
          messageType="email"
          onTypeChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('SMS')).toBeInTheDocument();
    });

    it('shows loading skeletons', async () => {
      await renderPage();
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: { data: [], meta: { total: 0, page: 1, lastPage: 1, itemsPerPage: 10 } },
        isLoading: false,
        error: null,
      };
    });

    it('shows empty message', async () => {
      await renderPage();
      // Portuguese: "Nenhum mensagens encontrado" (using the entityNamePlural)
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockMessages, isLoading: false, isFetching: false, error: null };
    });

    it('renders message titles in the table', async () => {
      await renderPage();
      expect(screen.getByText('Welcome Email')).toBeInTheDocument();
      expect(screen.getByText('Follow Up')).toBeInTheDocument();
    });

    it('shows the create button with permission', async () => {
      await renderPage('email');
      // Portuguese: "Criar mensagem"
      expect(screen.getByText(/criar mensagem/i)).toBeInTheDocument();
    });

    it('hides create button without permission', async () => {
      authenticateStore({ permissions: ['messages:view'] });
      await renderPage();
      expect(screen.queryByText(/criar mensagem/i)).not.toBeInTheDocument();
    });
  });

  describe('delete flow', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: mockMessages,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('opens confirm dialog and triggers delete', async () => {
      await renderPage();

      // Find delete buttons (sr-only text: "Excluir mensagem")
      const deleteButtons = screen.getAllByRole('button', { name: /excluir/i });
      expect(deleteButtons.length).toBeGreaterThan(0);

      fireEvent.click(deleteButtons[0]);

      // Confirm dialog: "Tem certeza..."
      expect(screen.getByText(/tem certeza/i)).toBeInTheDocument();

      // Click confirm button: "Confirmar"
      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      fireEvent.click(confirmButton);

      expect(mockDeleteMutate).toHaveBeenCalledWith(1, expect.any(Object));
    });
  });

  describe('duplicate flow', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: mockMessages,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: vi.fn(),
      };
    });

    it('triggers duplicate on button click', async () => {
      await renderPage();

      // sr-only text: "Duplicar"
      const duplicateButtons = screen.getAllByRole('button', { name: /duplicar/i });
      expect(duplicateButtons.length).toBeGreaterThan(0);

      fireEvent.click(duplicateButtons[0]);

      expect(mockDuplicateMutate).toHaveBeenCalledWith(1);
    });
  });

  describe('channel tabs', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, error: null };
    });

    it('does not show tabs without onTypeChange', async () => {
      await renderPage('email');
      // No tab buttons should be rendered
      expect(screen.queryByRole('button', { name: 'Email' })).not.toBeInTheDocument();
    });

    it('shows only enabled channel tabs', async () => {
      // Only enable email + sms
      authenticateStore({
        permissions: ['messages:view', 'messages:create', 'messages:delete'],
        accountConfigs: [
          {
            accountId: 10,
            name: 'email_settings',
            value: '{"isActive": true}',
            isLoadConfig: false,
          },
          { accountId: 10, name: 'sms_settings', value: '{"isActive": true}', isLoadConfig: false },
        ],
      });

      await renderWithRouter(
        <MessagesPage
          searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }}
          messageType="email"
          onTypeChange={vi.fn()}
        />,
      );

      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('SMS')).toBeInTheDocument();
      expect(screen.queryByText('Web Push')).not.toBeInTheDocument();
      expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument();
    });

    it('calls onTypeChange when a different tab is clicked', async () => {
      const onTypeChange = vi.fn();
      await renderWithRouter(
        <MessagesPage
          searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }}
          messageType="email"
          onTypeChange={onTypeChange}
        />,
      );

      fireEvent.click(screen.getByText('SMS'));
      expect(onTypeChange).toHaveBeenCalledWith('sms');
    });

    it('does not call onTypeChange when clicking the active tab', async () => {
      const onTypeChange = vi.fn();
      await renderWithRouter(
        <MessagesPage
          searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }}
          messageType="email"
          onTypeChange={onTypeChange}
        />,
      );

      fireEvent.click(screen.getByText('Email'));
      expect(onTypeChange).not.toHaveBeenCalled();
    });
  });

  describe('email filters', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, error: null };
    });

    it('shows sender and automation selects for email when callbacks provided', async () => {
      await renderWithRouter(
        <MessagesPage
          searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }}
          messageType="email"
          onTypeChange={vi.fn()}
          onSenderChange={vi.fn()}
          onAutomationChange={vi.fn()}
        />,
      );

      expect(screen.getByText('Todos os remetentes')).toBeInTheDocument();
      expect(screen.getByText('Todas as automações')).toBeInTheDocument();
    });

    it('hides filters for non-email types', async () => {
      await renderWithRouter(
        <MessagesPage
          searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }}
          messageType="sms"
          onTypeChange={vi.fn()}
          onSenderChange={vi.fn()}
          onAutomationChange={vi.fn()}
        />,
      );

      expect(screen.queryByText('Todos os remetentes')).not.toBeInTheDocument();
      expect(screen.queryByText('Todas as automações')).not.toBeInTheDocument();
    });

    it('hides filters when callbacks not provided', async () => {
      await renderWithRouter(
        <MessagesPage
          searchParams={{ page: 1, pageSize: 10, search: '', sort: '', order: 'asc' }}
          messageType="email"
        />,
      );

      expect(screen.queryByText('Todos os remetentes')).not.toBeInTheDocument();
      expect(screen.queryByText('Todas as automações')).not.toBeInTheDocument();
    });
  });
});
