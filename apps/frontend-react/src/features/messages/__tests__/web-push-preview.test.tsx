import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { useForm, FormProvider } from 'react-hook-form';
import type { WebPushFormValues } from '../message-schema';
import { WebPushContentForm } from '../components/web-push-content-form';

function FormWrapper({ defaultValues }: { defaultValues?: Partial<WebPushFormValues> }) {
  const form = useForm<WebPushFormValues>({
    defaultValues: {
      title: '',
      description: '',
      subject: '',
      content: '',
      url: '',
      image: '',
      expiryPushEnabled: false,
      expiryPushValue: 1,
      expiryPushFilter: 'day',
      ...defaultValues,
    },
  });
  return (
    <FormProvider {...form}>
      <WebPushContentForm />
    </FormProvider>
  );
}

function renderWebPush(defaultValues?: Partial<WebPushFormValues>) {
  return renderWithRouter(<FormWrapper defaultValues={defaultValues} />);
}

describe('WebPushContentForm - Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders both Windows and Android preview sections', async () => {
    await renderWebPush();
    expect(screen.getByText(/windows/i)).toBeInTheDocument();
    expect(screen.getByText(/android/i)).toBeInTheDocument();
  });

  it('shows subject in both previews when filled', async () => {
    await renderWebPush({ subject: 'Breaking News!' });
    const previews = screen.getAllByText('Breaking News!');
    expect(previews.length).toBe(2);
  });

  it('shows content in both previews when filled', async () => {
    await renderWebPush({ content: 'Check this out now' });
    const previews = screen.getAllByText('Check this out now');
    // 2 in previews + 1 in the form textarea = 3
    expect(previews.length).toBeGreaterThanOrEqual(2);
  });

  it('shows placeholder text when fields are empty', async () => {
    await renderWebPush();
    const placeholders = screen.getAllByText(/título da notificação/i);
    expect(placeholders.length).toBe(2);
  });

  it('renders the web-push-preview test id', async () => {
    await renderWebPush();
    expect(screen.getByTestId('web-push-preview')).toBeInTheDocument();
  });

  it('shows URL domain in both previews when url is provided', async () => {
    await renderWebPush({ url: 'https://example.com/page' });
    const domains = screen.getAllByText(/example\.com/);
    expect(domains.length).toBeGreaterThanOrEqual(2);
  });
});
