import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { InboxPreview } from '../components/inbox-preview';

function renderPreview(props?: Partial<{ senderName: string; subject: string; previewText: string }>) {
  return renderWithRouter(
    <InboxPreview
      senderName={props?.senderName ?? ''}
      subject={props?.subject ?? ''}
      previewText={props?.previewText ?? ''}
    />,
  );
}

describe('InboxPreview', () => {
  it('renders preview title', async () => {
    await renderPreview();
    expect(screen.getByText(/pré-visualização da caixa/i)).toBeInTheDocument();
  });

  it('shows sender name, subject, and preview text', async () => {
    await renderPreview({
      senderName: 'Acme Corp',
      subject: 'Welcome!',
      previewText: 'You have been invited',
    });
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
    expect(screen.getByText('You have been invited')).toBeInTheDocument();
  });

  it('shows fallback text when fields are empty', async () => {
    await renderPreview();
    // Falls back to i18n keys
    expect(screen.getByText('Nome do Remetente')).toBeInTheDocument();
    expect(screen.getByText('Assunto')).toBeInTheDocument();
  });

  it('renders desktop and mobile toggle buttons', async () => {
    await renderPreview();
    expect(screen.getByLabelText('Desktop')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile')).toBeInTheDocument();
  });

  it('toggles to mobile mode', async () => {
    await renderPreview({ senderName: 'Test', subject: 'Sub', previewText: '' });
    const mobileButton = screen.getByLabelText('Mobile');
    fireEvent.click(mobileButton);
    // In mobile mode, the container has max-w-[320px]
    const container = screen.getByText('Test').closest('.rounded-lg');
    expect(container?.className).toContain('max-w-[320px]');
  });
});
