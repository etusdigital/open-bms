import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { useForm, FormProvider } from 'react-hook-form';
import type { WhatsAppFormValues } from '../message-schema';
import { WhatsAppContentForm } from '../components/whatsapp-content-form';

function FormWrapper({ defaultValues }: { defaultValues?: Partial<WhatsAppFormValues> }) {
  const form = useForm<WhatsAppFormValues>({
    defaultValues: {
      title: '',
      description: '',
      headerType: 'none',
      headerContent: '',
      content: '',
      footer: '',
      whatsappType: 'text',
      callToActionText: '',
      callToActionUrl: '',
      ...defaultValues,
    },
  });
  return (
    <FormProvider {...form}>
      <WhatsAppContentForm />
    </FormProvider>
  );
}

function renderWhatsApp(defaultValues?: Partial<WhatsAppFormValues>) {
  return renderWithRouter(<FormWrapper defaultValues={defaultValues} />);
}

describe('WhatsAppContentForm - Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders preview section', async () => {
    await renderWhatsApp();
    expect(screen.getByText(/pré-visualização/i)).toBeInTheDocument();
  });

  it('shows body text in preview', async () => {
    await renderWhatsApp({ content: 'Hello from WhatsApp!' });
    const previews = screen.getAllByText('Hello from WhatsApp!');
    expect(previews.length).toBeGreaterThanOrEqual(1);
  });

  it('shows header text in preview when headerType is text', async () => {
    await renderWhatsApp({ headerType: 'text', headerContent: 'Important Update' });
    const previews = screen.getAllByText('Important Update');
    expect(previews.length).toBeGreaterThanOrEqual(1);
  });

  it('shows footer in preview', async () => {
    await renderWhatsApp({ footer: 'Powered by Etus' });
    const previews = screen.getAllByText('Powered by Etus');
    expect(previews.length).toBeGreaterThanOrEqual(1);
  });

  it('shows CTA button in preview when whatsappType is call-to-action', async () => {
    await renderWhatsApp({
      whatsappType: 'call-to-action',
      callToActionText: 'Visit Website',
    });
    const previews = screen.getAllByText('Visit Website');
    expect(previews.length).toBeGreaterThanOrEqual(1);
  });

  it('shows WhatsApp chat preview container', async () => {
    await renderWhatsApp();
    expect(screen.getByTestId('whatsapp-preview')).toBeInTheDocument();
  });

  it('shows timestamp in preview', async () => {
    await renderWhatsApp();
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    expect(screen.getByText(timeStr)).toBeInTheDocument();
  });
});
