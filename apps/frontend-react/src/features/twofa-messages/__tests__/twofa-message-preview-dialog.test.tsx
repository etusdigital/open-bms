// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import { TwoFAMessagePreviewDialog } from '../components/twofa-message-preview-dialog';
import '@/lib/i18n';

vi.mock('@/features/messages/use-messages', () => ({
  useMessage: vi.fn(),
}));

import { useMessage } from '@/features/messages/use-messages';
const mockUseMessage = vi.mocked(useMessage);

function renderDialog(props: { messageId: number; channel: 'email' | 'sms' | 'whatsapp'; open: boolean }) {
  const Wrapper = createQueryWrapper();
  return render(
    <Wrapper>
      <TwoFAMessagePreviewDialog {...props} onOpenChange={() => {}} />
    </Wrapper>,
  );
}

describe('TwoFAMessagePreviewDialog', () => {
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      // Suppress Radix UI DialogContent missing Description warning
      if (typeof args[0] === 'string' && args[0].includes('Missing `Description`')) return;
      originalWarn(...args);
    };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  it('shows loading skeleton while fetching', () => {
    mockUseMessage.mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useMessage>);
    renderDialog({ messageId: 1, channel: 'email', open: true });
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders email preview with subject and from fields', () => {
    mockUseMessage.mockReturnValue({
      data: {
        id: 1,
        title: 'OTP Email',
        subject: 'Your code is ready',
        fromName: 'Company',
        fromMail: 'noreply@company.com',
        content: '<h1>Hello</h1>',
      },
      isLoading: false,
    } as ReturnType<typeof useMessage>);

    renderDialog({ messageId: 1, channel: 'email', open: true });
    expect(screen.getByText('OTP Email')).toBeInTheDocument();
    expect(screen.getByText('Your code is ready')).toBeInTheDocument();
    expect(screen.getByText(/Company.*noreply@company.com/)).toBeInTheDocument();
  });

  it('renders sms preview with content', () => {
    mockUseMessage.mockReturnValue({
      data: {
        id: 2,
        title: 'OTP SMS',
        content: 'Your code is 123456',
        url: 'https://example.com',
      },
      isLoading: false,
    } as ReturnType<typeof useMessage>);

    renderDialog({ messageId: 2, channel: 'sms', open: true });
    expect(screen.getByText('OTP SMS')).toBeInTheDocument();
    expect(screen.getByText('Your code is 123456')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('renders whatsapp preview with content and CTA', () => {
    mockUseMessage.mockReturnValue({
      data: {
        id: 3,
        title: 'OTP WhatsApp',
        content: 'Confirm your identity',
        callToActionText: 'Verify Now',
      },
      isLoading: false,
    } as ReturnType<typeof useMessage>);

    renderDialog({ messageId: 3, channel: 'whatsapp', open: true });
    expect(screen.getByText('OTP WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Confirm your identity')).toBeInTheDocument();
    expect(screen.getByText('Verify Now')).toBeInTheDocument();
  });

  it('does not fetch when dialog is closed', () => {
    mockUseMessage.mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof useMessage>);
    renderDialog({ messageId: 1, channel: 'email', open: false });
    expect(mockUseMessage).toHaveBeenCalledWith(0); // messageId=0 when closed
  });
});
