import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { TestSendSection } from '../components/test-send-section';

const mockMutate = vi.fn();

vi.mock('../use-messages', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    useSendTestEmail: vi.fn().mockReturnValue({
      mutate: (...args: unknown[]) => mockMutate(...args),
      isPending: false,
    }),
    useSendTestMobilePush: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});

const mockGetFormData = vi.fn().mockReturnValue({
  id: 1,
  title: 'Test Message',
  previewText: '',
  ippool: 'default-pool',
  subject: 'Subject',
  replyTo: '',
  priority: 'high',
  content: '<p>Hello</p>',
  fromName: 'Sender',
  fromMail: 'sender@test.com',
});

function renderTestSend() {
  return renderWithRouter(<TestSendSection messageType="email" getFormData={mockGetFormData} />);
}

describe('TestSendSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders recipient name and email fields', async () => {
    await renderTestSend();
    expect(screen.getByLabelText(/nome do destinatário/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email do destinatário/i)).toBeInTheDocument();
  });

  it('renders send test button', async () => {
    await renderTestSend();
    expect(screen.getByRole('button', { name: /enviar teste/i })).toBeInTheDocument();
  });

  it('calls mutate with correct payload on send', async () => {
    await renderTestSend();

    const nameInput = screen.getByLabelText(/nome do destinatário/i);
    const emailInput = screen.getByLabelText(/email do destinatário/i);

    fireEvent.change(nameInput, { target: { value: 'Test User' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const sendButton = screen.getByRole('button', { name: /enviar teste/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          contact: { email: 'test@example.com', firstName: 'Test User' },
          loadContactFromDatabase: true,
        }),
      );
    });
  });

  it('uses live editor HTML from getEmailContent for unsaved messages', async () => {
    // Simulate a brand-new message: form state has no content yet, but the
    // editor resolves the current HTML.
    const getFormData = vi.fn().mockReturnValue({
      id: 0,
      title: 'New Message',
      previewText: '',
      ippool: '',
      subject: 'Subject',
      replyTo: '',
      priority: 'high',
      content: '',
      fromName: 'Sender',
      fromMail: 'sender@test.com',
    });
    const getEmailContent = vi.fn().mockResolvedValue('<p>From editor</p>');

    await renderWithRouter(
      <TestSendSection messageType="email" getFormData={getFormData} getEmailContent={getEmailContent} />,
    );

    fireEvent.change(screen.getByLabelText(/nome do destinatário/i), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText(/email do destinatário/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar teste/i }));

    await waitFor(() => {
      expect(getEmailContent).toHaveBeenCalled();
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({ content: '<p>From editor</p>' }),
        }),
      );
    });
  });

  describe('validation', () => {
    it('shows error when name is empty', async () => {
      await renderTestSend();

      const emailInput = screen.getByLabelText(/email do destinatário/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      fireEvent.click(screen.getByRole('button', { name: /enviar teste/i }));

      expect(screen.getByText(/nome do destinatário é obrigatório/i)).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows error when email is empty', async () => {
      await renderTestSend();

      const nameInput = screen.getByLabelText(/nome do destinatário/i);
      fireEvent.change(nameInput, { target: { value: 'Test' } });

      fireEvent.click(screen.getByRole('button', { name: /enviar teste/i }));

      expect(screen.getByText(/email do destinatário é obrigatório/i)).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows error when email is invalid', async () => {
      await renderTestSend();

      fireEvent.change(screen.getByLabelText(/nome do destinatário/i), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText(/email do destinatário/i), {
        target: { value: 'not-email' },
      });

      fireEvent.click(screen.getByRole('button', { name: /enviar teste/i }));

      expect(screen.getByText(/email do destinatário inválido/i)).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('clears error when user starts typing', async () => {
      await renderTestSend();

      fireEvent.click(screen.getByRole('button', { name: /enviar teste/i }));
      expect(screen.getByText(/nome do destinatário é obrigatório/i)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/nome do destinatário/i), { target: { value: 'T' } });
      expect(screen.queryByText(/nome do destinatário é obrigatório/i)).not.toBeInTheDocument();
    });
  });
});
