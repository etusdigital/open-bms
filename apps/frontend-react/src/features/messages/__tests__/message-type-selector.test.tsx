import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { MessageTypeSelector } from '../components/message-type-selector';

const mockOnChange = vi.fn();

function renderSelector(props?: { value?: string; disabled?: boolean }) {
  return renderWithRouter(
    <MessageTypeSelector
      value={(props?.value ?? 'email') as 'email' | 'sms' | 'web-push' | 'mobile-push' | 'whatsapp'}
      onChange={mockOnChange}
      disabled={props?.disabled}
    />,
  );
}

describe('MessageTypeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all channels enabled
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

  it('renders 5 message type cards', async () => {
    await renderSelector();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText('Web Push')).toBeInTheDocument();
    expect(screen.getByText('Mobile Push')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
  });

  it('highlights the selected type', async () => {
    await renderSelector({ value: 'sms' });
    const smsCard = screen.getByText('SMS').closest('button');
    expect(smsCard).toHaveAttribute('data-selected', 'true');
  });

  it('fires onChange when clicking a different type', async () => {
    await renderSelector({ value: 'email' });
    fireEvent.click(screen.getByText('SMS'));
    expect(mockOnChange).toHaveBeenCalledWith('sms');
  });

  it('does not fire onChange when clicking the already selected type', async () => {
    await renderSelector({ value: 'email' });
    fireEvent.click(screen.getByText('Email'));
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('disables all cards when disabled prop is true', async () => {
    await renderSelector({ disabled: true });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  describe('account channel restrictions', () => {
    it('disables SMS card when account has no SMS config', async () => {
      authenticateStore({ accountConfigs: [] }); // No channel configs
      await renderSelector();
      const smsButton = screen.getByText('SMS').closest('button');
      expect(smsButton).toBeDisabled();
    });

    it('disables WhatsApp card when account has no WhatsApp config', async () => {
      authenticateStore({ accountConfigs: [] });
      await renderSelector();
      const waButton = screen.getByText('WhatsApp').closest('button');
      expect(waButton).toBeDisabled();
    });

    it('disables email when email_settings config is missing', async () => {
      authenticateStore({ accountConfigs: [] });
      await renderSelector();
      const emailButton = screen.getByText('Email').closest('button');
      expect(emailButton).toBeDisabled();
    });

    it('enables email when email_settings has isActive true', async () => {
      authenticateStore({
        accountConfigs: [
          {
            accountId: 10,
            name: 'email_settings',
            value: '{"isActive": true}',
            isLoadConfig: false,
          },
        ],
      });
      await renderSelector();
      const emailButton = screen.getByText('Email').closest('button');
      expect(emailButton).not.toBeDisabled();
    });

    it('does not fire onChange when clicking a disabled channel', async () => {
      authenticateStore({ accountConfigs: [] });
      await renderSelector({ value: 'email' });
      fireEvent.click(screen.getByText('SMS'));
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('enables only configured channels', async () => {
      authenticateStore({
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
      await renderSelector();

      const emailButton = screen.getByText('Email').closest('button');
      const smsButton = screen.getByText('SMS').closest('button');
      const webPushButton = screen.getByText('Web Push').closest('button');
      const mobilePushButton = screen.getByText('Mobile Push').closest('button');
      const whatsappButton = screen.getByText('WhatsApp').closest('button');

      expect(emailButton).not.toBeDisabled();
      expect(smsButton).not.toBeDisabled();
      expect(webPushButton).toBeDisabled();
      expect(mobilePushButton).toBeDisabled();
      expect(whatsappButton).toBeDisabled();
    });
  });
});
