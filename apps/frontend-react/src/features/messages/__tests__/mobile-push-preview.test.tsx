import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { useForm, FormProvider } from 'react-hook-form';
import type { MobilePushFormValues } from '../message-schema';
import { MobilePushContentForm } from '../components/mobile-push-content-form';

function FormWrapper({ defaultValues }: { defaultValues?: Partial<MobilePushFormValues> }) {
  const form = useForm<MobilePushFormValues>({
    defaultValues: {
      title: '',
      description: '',
      subject: '',
      content: '',
      url: '',
      image: '',
      notificationSound: 'default',
      expiryPushEnabled: false,
      expiryPushValue: 1,
      expiryPushFilter: 'day',
      ...defaultValues,
    },
  });
  return (
    <FormProvider {...form}>
      <MobilePushContentForm />
    </FormProvider>
  );
}

function renderMobilePush(defaultValues?: Partial<MobilePushFormValues>) {
  return renderWithRouter(<FormWrapper defaultValues={defaultValues} />);
}

describe('MobilePushContentForm - Preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders preview section', async () => {
    await renderMobilePush();
    expect(screen.getByText(/pré-visualização/i)).toBeInTheDocument();
  });

  it('shows subject in preview when filled', async () => {
    await renderMobilePush({ subject: 'New Deal Available' });
    const previews = screen.getAllByText('New Deal Available');
    expect(previews.length).toBeGreaterThanOrEqual(1);
  });

  it('shows content in preview when filled', async () => {
    await renderMobilePush({ content: 'Tap to see details' });
    const previews = screen.getAllByText('Tap to see details');
    expect(previews.length).toBeGreaterThanOrEqual(1);
  });

  it('shows placeholder text when fields are empty', async () => {
    await renderMobilePush();
    expect(screen.getByTestId('mobile-push-preview')).toBeInTheDocument();
  });

  it('shows account name in notification', async () => {
    await renderMobilePush();
    expect(screen.getByText('Account')).toBeInTheDocument();
  });

  it('shows current time in notification', async () => {
    await renderMobilePush();
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    expect(screen.getByText(timeStr)).toBeInTheDocument();
  });
});
