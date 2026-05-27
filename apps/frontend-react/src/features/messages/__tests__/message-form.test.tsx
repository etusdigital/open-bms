import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import MessageForm from '../message-form';
import type { Sender } from '@/features/senders/types';

// Mock react-email-editor since Unlayer can't load in jsdom
vi.mock('react-email-editor', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onReady }: { onReady?: () => void }) => {
    if (onReady) setTimeout(onReady, 0);
    return <div data-testid="email-editor">Email Editor Mock</div>;
  }),
}));

vi.mock('../use-messages', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    useSendersForSelect: vi.fn().mockReturnValue({
      data: [
        {
          id: 1,
          senderEmail: 'sender@test.com',
          senderName: 'Sender Name',
          senderReplyTo: 'reply@test.com',
          isDefault: true,
        },
      ] as Sender[],
      isLoading: false,
      isSuccess: true,
    }),
    useSendTestEmail: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    }),
    useSendTestMobilePush: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    }),
    useLabelsAll: vi.fn().mockReturnValue({
      data: [
        { id: 1, name: 'VIP' },
        { id: 2, name: 'Newsletter' },
      ],
      isLoading: false,
    }),
    useTemplatesForSelect: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
    }),
    validateMessageName: vi.fn().mockResolvedValue(true),
  };
});

const mockOnSubmit = vi.fn();
const mockOnTypeChange = vi.fn();

function renderForm(props?: {
  messageType?: 'email' | 'sms' | 'web-push' | 'mobile-push' | 'whatsapp';
  defaultValues?: Record<string, unknown>;
  messageStatus?: 'draft' | 'send_approval' | 'sent_approval' | 'approved' | 'rejected';
  messageId?: number;
  isPending?: boolean;
  campaignInUse?: boolean;
}) {
  return renderWithRouter(
    <MessageForm
      messageType={props?.messageType ?? 'email'}
      onSubmit={mockOnSubmit}
      isPending={props?.isPending ?? false}
      defaultValues={props?.defaultValues}
      messageStatus={props?.messageStatus}
      messageId={props?.messageId}
      onTypeChange={mockOnTypeChange}
      campaignInUse={props?.campaignInUse}
    />,
  );
}

describe('MessageForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({
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

  describe('4-block layout', () => {
    it('renders Details card with title, description and label selector', async () => {
      await renderForm();
      expect(screen.getByText('Detalhes')).toBeInTheDocument();
      expect(screen.getByLabelText(/título/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
      expect(screen.getByText(/selecionar labels/i)).toBeInTheDocument();
    });

    it('renders Message Type Selector with 5 type cards', async () => {
      await renderForm();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('SMS')).toBeInTheDocument();
      expect(screen.getByText('Web Push')).toBeInTheDocument();
      expect(screen.getByText('Mobile Push')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    it('renders Content card with email-specific fields and editor', async () => {
      await renderForm({ messageType: 'email' });
      expect(screen.getByText('Conteúdo')).toBeInTheDocument();
      expect(screen.getByLabelText(/assunto/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/nome do remetente/i)).toBeInTheDocument();
      expect(screen.getByTestId('email-editor')).toBeInTheDocument();
    });

    it('renders Test Send card for email type', async () => {
      await renderForm({ messageType: 'email' });
      expect(screen.getByText('Envio de teste')).toBeInTheDocument();
      expect(screen.getByLabelText(/email do destinatário/i)).toBeInTheDocument();
    });

    it('renders SMS content for SMS type (no test send)', async () => {
      await renderForm({ messageType: 'sms' });
      expect(screen.getByPlaceholderText(/digite aqui/i)).toBeInTheDocument();
      expect(screen.queryByText('Envio de teste')).not.toBeInTheDocument();
    });
  });

  describe('type selector', () => {
    it('calls onTypeChange when different type is selected', async () => {
      await renderForm({ messageType: 'email' });
      fireEvent.click(screen.getByText('SMS'));
      expect(mockOnTypeChange).toHaveBeenCalledWith('sms');
    });

    it('disables type selector in edit mode', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Existing', description: '', content: 'Text' },
      });
      // All type buttons should be disabled in edit mode
      const smsButton = screen.getByText('SMS').closest('button');
      expect(smsButton).toBeDisabled();
    });
  });

  describe('common fields', () => {
    it('shows character counter for title', async () => {
      await renderForm();
      expect(screen.getByText('0/40')).toBeInTheDocument();
    });

    it('renders create button for new messages', async () => {
      await renderForm();
      expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
    });

    it('shows save button when editing', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Existing', description: '', content: 'Text' },
      });
      expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
    });

    it('shows loading state when pending', async () => {
      await renderForm({ isPending: true });
      expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled();
    });
  });

  describe('validation', () => {
    it('shows required error when title is empty on submit', async () => {
      await renderForm({ messageType: 'sms' });

      const createButton = screen.getByRole('button', { name: /criar/i });
      fireEvent.click(createButton);

      const errors = await screen.findAllByText(/este campo é obrigatório/i);
      expect(errors.length).toBeGreaterThan(0);
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('SMS no-link confirmation', () => {
    it('shows confirmation dialog when submitting SMS without a URL', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Test SMS', description: '', content: 'Hello without link' },
      });

      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mensagem sem link/i })).toBeInTheDocument();
      });
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('submits after confirming no-link dialog', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Test SMS', description: '', content: 'Hello without link' },
      });

      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /mensagem sem link/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('skips confirmation when SMS contains a URL', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: {
          title: 'Test SMS',
          description: '',
          content: 'Visit https://example.com now',
        },
      });

      fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
      expect(screen.queryByRole('heading', { name: /mensagem sem link/i })).not.toBeInTheDocument();
    });
  });

  describe('edit mode', () => {
    it('pre-fills form with default values', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Existing SMS', description: 'Desc', content: 'Hello' },
      });
      expect(screen.getByLabelText(/título/i)).toHaveValue('Existing SMS');
    });
  });

  describe('message status', () => {
    it('shows status badge when editing with a status', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Existing', description: '', content: 'Text' },
        messageStatus: 'approved',
      });
      expect(screen.getByText('Aprovada')).toBeInTheDocument();
    });

    it('does not show status badge in create mode', async () => {
      await renderForm({ messageType: 'sms' });
      expect(screen.queryByText('Rascunho')).not.toBeInTheDocument();
    });

    it('allows editing when status is draft', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Existing', description: '', content: 'Text' },
        messageStatus: 'draft',
      });
      expect(screen.getByText('Rascunho')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /salvar/i })).not.toBeDisabled();
    });

    it('allows editing non-whatsapp messages regardless of status', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Existing', description: '', content: 'Text' },
        messageStatus: 'approved',
      });
      expect(screen.getByRole('button', { name: /salvar/i })).not.toBeDisabled();
    });

    it('allows editing email with no status', async () => {
      await renderForm({
        messageType: 'email',
        defaultValues: { title: 'My Email', description: '', content: '' },
      });
      expect(screen.getByRole('button', { name: /salvar/i })).not.toBeDisabled();
    });

    it('blocks editing when campaignInUse is true', async () => {
      await renderForm({
        messageType: 'email',
        defaultValues: { title: 'Campaign Email', description: '', content: '' },
        campaignInUse: true,
      });
      expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    });

    it('blocks editing whatsapp when status is not draft', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Approved', description: '', content: 'Hello' },
        messageStatus: 'approved',
      });
      expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    });

    it('allows editing whatsapp in draft status', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Draft', description: '', content: 'Hello' },
        messageStatus: 'draft',
      });
      expect(screen.getByRole('button', { name: /salvar/i })).not.toBeDisabled();
    });

    it('blocks editing whatsapp when campaignInUse even if draft', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Campaign', description: '', content: 'Hello' },
        messageStatus: 'draft',
        campaignInUse: true,
      });
      expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
    });
  });

  describe('whatsapp approval status alert', () => {
    it('shows draft warning alert when editing whatsapp in draft status', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Test', description: '', content: 'Hello' },
        messageStatus: 'draft',
      });
      expect(screen.getByText(/ainda não foi enviada para aprovação/i)).toBeInTheDocument();
    });

    it('shows info alert when whatsapp is awaiting approval', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Test', description: '', content: 'Hello' },
        messageStatus: 'sent_approval',
      });
      expect(screen.getByText(/aguardando aprovação/i)).toBeInTheDocument();
    });

    it('shows success alert when whatsapp is approved', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Test', description: '', content: 'Hello' },
        messageStatus: 'approved',
      });
      expect(screen.getByText(/foi aprovada pelo WhatsApp/i)).toBeInTheDocument();
    });

    it('shows error alert when whatsapp is rejected', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Test', description: '', content: 'Hello' },
        messageStatus: 'rejected',
      });
      expect(screen.getByText(/não foi aprovada pelo WhatsApp/i)).toBeInTheDocument();
    });

    it('does not show whatsapp alert for non-whatsapp types', async () => {
      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'SMS Test', description: '', content: 'Hello' },
        messageStatus: 'draft',
      });
      expect(screen.queryByText(/aprovação do WhatsApp/i)).not.toBeInTheDocument();
    });

    it('does not show whatsapp alert in create mode', async () => {
      await renderForm({ messageType: 'whatsapp' });
      expect(screen.queryByText(/aprovação do WhatsApp/i)).not.toBeInTheDocument();
    });
  });

  describe('whatsapp approval button', () => {
    it('shows "criar e enviar para aprovação" button for new whatsapp messages', async () => {
      await renderForm({ messageType: 'whatsapp' });
      expect(screen.getByRole('button', { name: /criar e enviar para aprovação/i })).toBeInTheDocument();
    });

    it('shows "enviar para aprovação" button when editing whatsapp draft', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Test', description: '', content: 'Hello' },
        messageStatus: 'draft',
      });
      expect(screen.getByRole('button', { name: /enviar para aprovação/i })).toBeInTheDocument();
    });

    it('does not show approval button for non-whatsapp types', async () => {
      await renderForm({ messageType: 'sms' });
      expect(screen.queryByRole('button', { name: /aprovação/i })).not.toBeInTheDocument();
    });

    it('disables approval button when form is read-only', async () => {
      await renderForm({
        messageType: 'whatsapp',
        defaultValues: { title: 'WA Test', description: '', content: 'Hello' },
        messageStatus: 'approved',
      });
      const approvalButtons = screen.queryAllByRole('button', { name: /aprovação/i });
      approvalButtons.forEach((btn) => expect(btn).toBeDisabled());
    });
  });

  describe('name availability check', () => {
    it('shows error when name is already taken', async () => {
      const { validateMessageName: mockValidate } = await import('../use-messages');
      vi.mocked(mockValidate).mockResolvedValue(false);

      await renderForm({ messageType: 'sms' });
      const titleInput = screen.getByLabelText(/título/i);
      fireEvent.change(titleInput, { target: { value: 'Duplicate Name' } });

      await waitFor(() => {
        expect(screen.getByText(/já existe uma mensagem/i)).toBeInTheDocument();
      });
    });

    it('does not show error when name is available', async () => {
      const { validateMessageName: mockValidate } = await import('../use-messages');
      vi.mocked(mockValidate).mockResolvedValue(true);

      await renderForm({ messageType: 'sms' });
      const titleInput = screen.getByLabelText(/título/i);
      fireEvent.change(titleInput, { target: { value: 'Unique Name' } });

      await waitFor(() => {
        expect(mockValidate).toHaveBeenCalled();
      });
      expect(screen.queryByText(/já existe uma mensagem/i)).not.toBeInTheDocument();
    });

    it('skips check in edit mode when title is unchanged', async () => {
      const { validateMessageName: mockValidate } = await import('../use-messages');
      vi.mocked(mockValidate).mockClear();

      await renderForm({
        messageType: 'sms',
        defaultValues: { title: 'Existing SMS', description: '', content: '' },
      });

      // Title is pre-filled — no validation should fire
      await new Promise((r) => setTimeout(r, 600));
      expect(mockValidate).not.toHaveBeenCalled();
    });
  });
});
