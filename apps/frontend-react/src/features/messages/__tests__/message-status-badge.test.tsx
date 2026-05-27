import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { MessageStatusBadge } from '../components/message-status-badge';
import type { MessageStatus } from '../types';

function renderBadge(status: MessageStatus) {
  return renderWithRouter(<MessageStatusBadge status={status} />);
}

describe('MessageStatusBadge', () => {
  it('renders draft status with correct label', async () => {
    await renderBadge('draft');
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('renders send_approval status with correct label', async () => {
    await renderBadge('send_approval');
    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
  });

  it('renders sent_approval status with correct label', async () => {
    await renderBadge('sent_approval');
    expect(screen.getByText('Aprovação enviada')).toBeInTheDocument();
  });

  it('renders approved status with correct label', async () => {
    await renderBadge('approved');
    expect(screen.getByText('Aprovada')).toBeInTheDocument();
  });

  it('renders rejected status with correct label', async () => {
    await renderBadge('rejected');
    expect(screen.getByText('Rejeitada')).toBeInTheDocument();
  });

  it('applies custom className', async () => {
    await renderWithRouter(<MessageStatusBadge status="draft" className="my-custom" />);
    const badge = screen.getByText('Rascunho');
    expect(badge.className).toContain('my-custom');
  });
});
