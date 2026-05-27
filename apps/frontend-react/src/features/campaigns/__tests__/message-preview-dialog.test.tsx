// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { createQueryWrapper } from '@/test-utils/create-query-wrapper';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import type { CampaignMessage } from '../types';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
import MessagePreviewDialog from '../steps/message-preview-dialog';

const mockGet = vi.mocked(apiClient.get);

const baseEmailMessage: CampaignMessage = {
  id: 2866,
  title: 'plusdin-cp-weekend-cc-2006',
  type: 'email',
  subject: 'Test subject',
  fromName: 'Test',
  fromMail: 'test@example.com',
  content: '<html><body><a href="https://a.com">A</a><a href="https://b.com">B</a></body></html>',
};

function renderDialog(props: Partial<React.ComponentProps<typeof MessagePreviewDialog>> = {}) {
  const Wrapper = createQueryWrapper();
  return render(
    <Wrapper>
      <MessagePreviewDialog
        messages={[baseEmailMessage]}
        messageType="email"
        initialIndex={0}
        open={true}
        onOpenChange={() => {}}
        {...props}
      />
    </Wrapper>,
  );
}

describe('MessagePreviewDialog — click statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('does NOT fetch click statistics when filterId/filterType are absent', async () => {
    renderDialog();
    // Give it a tick
    await new Promise((r) => setTimeout(r, 20));
    expect(mockGet).not.toHaveBeenCalledWith(expect.stringContaining('click-statistics'), expect.anything());
  });

  it('does NOT render the stats toggle when there are no click stats', () => {
    renderDialog();
    expect(screen.queryByTestId('stats-toggle')).toBeNull();
  });

  it('fetches click statistics when filterId and filterType are provided', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        ...baseEmailMessage,
        clickStats: [
          { key: '0', total: '70' },
          { key: '1', total: '30' },
        ],
      },
    });

    renderDialog({ filterId: 64511, filterType: 'campaign' });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        '/messages/2866/click-statistics',
        expect.objectContaining({
          params: { filterId: 64511, filterType: 'campaign' },
        }),
      );
    });
  });

  it('renders the stats toggle when click stats are loaded', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        ...baseEmailMessage,
        clickStats: [
          { key: '0', total: '70' },
          { key: '1', total: '30' },
        ],
      },
    });

    renderDialog({ filterId: 64511, filterType: 'campaign' });

    await waitFor(() => {
      expect(screen.getByTestId('stats-toggle')).toBeTruthy();
    });
  });

  it('injects badges into the iframe srcDoc when stats are visible', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        ...baseEmailMessage,
        clickStats: [
          { key: '0', total: '70' },
          { key: '1', total: '30' },
        ],
      },
    });

    renderDialog({ filterId: 64511, filterType: 'campaign' });

    await waitFor(() => {
      const iframe = screen.getByTitle('Email preview') as HTMLIFrameElement;
      expect(iframe.srcdoc).toContain('70 cliques (70.0%)');
      expect(iframe.srcdoc).toContain('30 cliques (30.0%)');
    });
  });

  it('removes badges from srcDoc when stats toggle is switched off', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        ...baseEmailMessage,
        clickStats: [
          { key: '0', total: '70' },
          { key: '1', total: '30' },
        ],
      },
    });

    renderDialog({ filterId: 64511, filterType: 'campaign' });

    // Wait for badges to be injected
    await waitFor(() => {
      const iframe = screen.getByTitle('Email preview') as HTMLIFrameElement;
      expect(iframe.srcdoc).toContain('cliques');
    });

    // Toggle stats off
    const toggle = screen.getByTestId('stats-toggle');
    fireEvent.click(toggle);

    // Badges should be gone
    await waitFor(() => {
      const iframe = screen.getByTitle('Email preview') as HTMLIFrameElement;
      expect(iframe.srcdoc).not.toContain('cliques');
    });
  });
});
