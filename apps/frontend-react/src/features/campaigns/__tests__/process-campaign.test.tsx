// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import ProcessCampaign from '../process-campaign';
import type { Campaign } from '../types';
import { CampaignStatus } from '../types';

vi.mock('../use-campaigns', () => ({
  useCampaignStatistics: () => ({ data: [{ id: 1, sentContacts: 500, sentPercentage: 50 }] }),
  useCampaignStatisticsTestAB: () => ({
    data: {
      10: { open: 30, click: 12, delivered: 200, total: 200 },
      20: { open: 20, click: 8, delivered: 180, total: 180 },
    },
  }),
  useStopCampaign: () => ({ mutate: vi.fn(), isPending: false }),
  // Dashboard endpoint returns aggregate stats for the top cards
  useCampaignDashboardStats: () => ({
    data: {
      delivered: 1000,
      open: 250,
      click: 100,
      unsubscribe: 5,
      bounce: 20,
      blocked: 0,
      sent: 1200,
      close: 0,
      unique_opens: 200,
      unique_clicks: 80,
    },
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function baseCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    title: 'Test Campaign',
    type: 'simple',
    messageType: 'email',
    status: CampaignStatus.Sending,
    sendToAll: false,
    scheduleTo: '2026-03-25T10:00:00.000Z',
    spreadSending: 60,
    campaignMessage: [
      {
        id: 10,
        title: 'Message A',
        subject: 'Subject A',
        fromName: 'Sender',
        fromMail: 'sender@test.com',
      },
    ],
    steps: [[{ type: 'tag', conditional_tag: 'in', tag_id: [1], tag_info: [{ id: 1, name: 'Tag A' }] }]],
    ...overrides,
  } as Campaign;
}

function renderProcess(campaign: Campaign) {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <ProcessCampaign campaign={campaign} />
    </QueryClientProvider>,
  );
}

describe('ProcessCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders status badge but not a duplicate title heading', async () => {
    await renderProcess(baseCampaign());
    expect(screen.getByTestId('process-campaign')).toBeInTheDocument();
    // Status badge should be present (there may be multiple "Enviando" badges — one for status, one per message)
    expect(screen.getAllByText(/enviando/i).length).toBeGreaterThanOrEqual(1);
    // Title should NOT be rendered inside ProcessCampaign — FormPage.Header handles it
    const heading = screen.queryByRole('heading', { name: 'Test Campaign' });
    expect(heading).not.toBeInTheDocument();
  });

  describe('Etapa 9: settings section', () => {
    it('shows schedule info for regular campaign', async () => {
      await renderProcess(
        baseCampaign({
          type: 'simple',
          scheduleTo: '2026-03-25T10:00:00.000Z',
          spreadSending: 60,
        }),
      );

      expect(screen.getByTestId('process-settings')).toBeInTheDocument();
      // Should show the schedule date
      expect(screen.getByText(/25\/03\/2026/)).toBeInTheDocument();
    });

    it('shows testAB config for testAB campaign', async () => {
      await renderProcess(
        baseCampaign({
          type: 'testAB',
          status: CampaignStatus.SendingTestAb,
          testabCriteria: 'open',
          testabAudiencePercent: 10,
          testabScheduleTo: '2026-03-25T10:00:00.000Z',
          testabScheduleEnd: '2026-03-25T10:30:00.000Z',
          testabSentAfterTest: true,
          spreadSending: 30,
          campaignMessage: [
            { id: 10, title: 'Msg A' },
            { id: 20, title: 'Msg B' },
          ],
        }),
      );

      const settingsSection = screen.getByTestId('process-settings');
      expect(settingsSection).toBeInTheDocument();
      // Should show winner criteria inside settings
      expect(within(settingsSection).getByText(/abertura/i)).toBeInTheDocument();
      // Should show test sample percentages (10% / 2 messages = 5.0% each)
      expect(settingsSection.textContent).toContain('5.0%');
    });
  });

  describe('Etapa 11: enriched message cards', () => {
    it('shows message title, subject and statistics for each message', async () => {
      await renderProcess(
        baseCampaign({
          status: CampaignStatus.Completed,
          campaignMessage: [
            {
              id: 10,
              title: 'Message A',
              subject: 'Subject A',
              fromName: 'Sender',
              fromMail: 'sender@test.com',
              statistics: { delivered: 100, openRate: 25, clickRate: 10, ctrOrRate: 40 },
            },
          ],
        }),
      );

      const messagesSection = screen.getByTestId('process-messages');
      expect(messagesSection).toBeInTheDocument();
      expect(within(messagesSection).getByText(/Message A/)).toBeInTheDocument();
      expect(within(messagesSection).getByText(/Subject A/)).toBeInTheDocument();
      // Should show statistics
      expect(messagesSection.textContent).toContain('25');
      expect(messagesSection.textContent).toContain('10');
    });

    it('shows "Enviada" badge only for testAB/split completed campaigns', async () => {
      // Simple campaigns should NOT show per-message "Enviada" badge
      await renderProcess(
        baseCampaign({
          status: CampaignStatus.Completed,
          campaignMessage: [{ id: 10, title: 'Msg', statistics: { delivered: 100, openRate: 25, clickRate: 10 } }],
        }),
      );
      const messagesSection = screen.getByTestId('process-messages');
      expect(messagesSection.textContent).not.toContain('Enviada');
    });

    it('shows "Enviada" badge for testAB completed message cards', async () => {
      await renderProcess(
        baseCampaign({
          type: 'testAB',
          status: CampaignStatus.Completed,
          testabCriteria: 'open',
          testabAudiencePercent: 20,
          campaignMessage: [
            {
              id: 10,
              title: 'Msg A',
              winner: true,
              statistics: { delivered: 100, openRate: 25, clickRate: 10 },
            },
            {
              id: 20,
              title: 'Msg B',
              winner: false,
              statistics: { delivered: 100, openRate: 15, clickRate: 8 },
            },
          ],
        }),
      );
      const messagesSection = screen.getByTestId('process-messages');
      expect(messagesSection.textContent).toContain('Enviada');
    });

    it('shows sample percentage for TestAB messages', async () => {
      await renderProcess(
        baseCampaign({
          type: 'testAB',
          status: CampaignStatus.SendingTestAb,
          testabAudiencePercent: 20,
          testabCriteria: 'open',
          campaignMessage: [
            { id: 10, title: 'Msg A', statistics: { delivered: 50, openRate: 20, clickRate: 5 } },
            { id: 20, title: 'Msg B', statistics: { delivered: 50, openRate: 15, clickRate: 8 } },
          ],
        }),
      );

      const messagesSection = screen.getByTestId('process-messages');
      // 20% / 2 messages = 10% each
      expect(messagesSection.textContent).toContain('10.0%');
    });
  });

  describe('Etapa 15: bug fixes', () => {
    it('shows description when provided but no title heading', async () => {
      await renderProcess(baseCampaign({ description: 'Campaign description' }));
      expect(screen.getByText('Campaign description')).toBeInTheDocument();
      // No h2 title — FormPage.Header renders it
      expect(screen.queryByRole('heading', { name: 'Test Campaign' })).not.toBeInTheDocument();
    });

    it('uses Redis stats shape for progress bar (sentContacts/sentPercentage)', async () => {
      await renderProcess(
        baseCampaign({
          status: CampaignStatus.Sending,
          sentPercentage: 50,
        }),
      );
      // Progress bar should show percentage from campaign data
      expect(screen.getByTestId('campaign-progress')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('Etapa 16: dashboard statistics cards', () => {
    it('shows statistics cards for email campaigns (Total, Aberturas, Cliques, Insc. canceladas, Bounce)', async () => {
      await renderProcess(baseCampaign({ messageType: 'email' }));

      const statsGrid = screen.getByTestId('campaign-statistics');
      expect(statsGrid).toBeInTheDocument();
      // Should show Total (delivered), Aberturas (open), Cliques (click), Insc. canceladas, Bounce
      const text = statsGrid.textContent ?? '';
      expect(text).toContain('Total');
      expect(text).toContain('250'); // open count
      expect(text).toContain('100'); // click count
      expect(text).toContain('Bounce');
      expect(text).toContain('25.00%'); // open rate = 250/1000
    });

    it('shows statistics cards for web-push (Total=sent, Entregue, Cliques, Close)', async () => {
      await renderProcess(baseCampaign({ messageType: 'web-push' }));

      const statsGrid = screen.getByTestId('campaign-statistics');
      expect(statsGrid).toBeInTheDocument();
      const text = statsGrid.textContent ?? '';
      // For web-push: Total uses sent (1200), not delivered
      expect(text).toContain('1,200'); // sent formatted
      expect(text).toContain('Close');
      // Should NOT show Bounce or unsubscribes
      expect(text).not.toContain('Bounce');
    });

    it('does not show unsubscribe and bounce for sms campaigns', async () => {
      await renderProcess(baseCampaign({ messageType: 'sms' }));

      const statsGrid = screen.getByTestId('campaign-statistics');
      const text = statsGrid.textContent ?? '';
      expect(text).not.toContain('Bounce');
      // Should show Total, Aberturas, Cliques (3 cards)
      expect(text).toContain('Total');
    });
  });

  describe('Etapa 17: TestAB per-message stats overlay', () => {
    it('overlays testAB real-time stats onto message cards', async () => {
      await renderProcess(
        baseCampaign({
          type: 'testAB',
          status: CampaignStatus.SendingTestAb,
          testabAudiencePercent: 20,
          testabCriteria: 'open',
          campaignMessage: [
            { id: 10, title: 'Msg A' },
            { id: 20, title: 'Msg B' },
          ],
        }),
      );

      const messagesSection = screen.getByTestId('process-messages');
      const text = messagesSection.textContent ?? '';
      // TestAB stats mock: msg 10 has open=30, click=12, delivered=200
      // msg 10: open 30/200 = 15%, click 12/200 = 6%
      // msg 20: open 20/180 = 11.1%, click 8/180 = 4.4%
      expect(text).toContain('15%'); // msg A open rate
      expect(text).toContain('11.1%'); // msg B open rate
      expect(text).toContain('6%'); // msg A click rate
    });
  });

  describe('Etapa 18: message card enrichment', () => {
    it('shows "Mais Estatísticas" link for each message', async () => {
      await renderProcess(
        baseCampaign({
          messageType: 'email',
          campaignMessage: [{ id: 10, title: 'Msg A', subject: 'Subject A' }],
        }),
      );

      const link = screen.getByTestId('more-stats-link-0');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/messages/email/statistics?messages=10');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('shows preview eye button for each message', async () => {
      await renderProcess(
        baseCampaign({
          campaignMessage: [{ id: 10, title: 'Msg A' }],
        }),
      );

      expect(screen.getByTestId('preview-btn-0')).toBeInTheDocument();
    });

    it('shows extracted links from message HTML content', async () => {
      await renderProcess(
        baseCampaign({
          campaignMessage: [
            {
              id: 10,
              title: 'Msg A',
              content:
                '<html><body><a href="https://example.com">Link</a><a href="[unsubscribe_link]">Unsub</a></body></html>',
            },
          ],
        }),
      );

      const messagesSection = screen.getByTestId('process-messages');
      expect(messagesSection.textContent).toContain('https://example.com');
      // Should not show unsubscribe link
      expect(messagesSection.textContent).not.toContain('[unsubscribe_link]');
    });
  });

  describe('Etapa 19: winner section + color coding', () => {
    it('shows winner section for completed testAB campaign', async () => {
      await renderProcess(
        baseCampaign({
          type: 'testAB',
          status: CampaignStatus.Completed,
          testabCriteria: 'open',
          testabAudiencePercent: 20,
          campaignMessage: [
            {
              id: 10,
              title: 'Msg A',
              winner: true,
              statistics: { delivered: 100, openRate: 25, clickRate: 10, ctrOrRate: 40 },
            },
            {
              id: 20,
              title: 'Msg B',
              winner: false,
              statistics: { delivered: 100, openRate: 15, clickRate: 8, ctrOrRate: 53 },
            },
          ],
        }),
      );

      // Winner section should be visible
      const winnerSection = screen.getByTestId('winner-section');
      expect(winnerSection).toBeInTheDocument();
      expect(winnerSection.textContent).toContain('Msg A');
    });

    it('does NOT show winner section when status is SendingTestAb', async () => {
      await renderProcess(
        baseCampaign({
          type: 'testAB',
          status: CampaignStatus.SendingTestAb,
          testabCriteria: 'open',
          testabAudiencePercent: 20,
          campaignMessage: [
            { id: 10, title: 'Msg A', statistics: { delivered: 50, openRate: 20, clickRate: 5 } },
            { id: 20, title: 'Msg B', statistics: { delivered: 50, openRate: 15, clickRate: 8 } },
          ],
        }),
      );

      expect(screen.queryByTestId('winner-section')).not.toBeInTheDocument();
    });

    it('applies green border to winner card and red stat to loser criterion', async () => {
      await renderProcess(
        baseCampaign({
          type: 'testAB',
          status: CampaignStatus.Completed,
          testabCriteria: 'open',
          testabAudiencePercent: 20,
          campaignMessage: [
            {
              id: 10,
              title: 'Msg A',
              winner: true,
              statistics: { delivered: 100, openRate: 25, clickRate: 10, ctrOrRate: 40 },
            },
            {
              id: 20,
              title: 'Msg B',
              winner: false,
              statistics: { delivered: 100, openRate: 15, clickRate: 8, ctrOrRate: 53 },
            },
          ],
        }),
      );

      const messagesSection = screen.getByTestId('process-messages');
      // Winner card should have green border
      const cards = messagesSection.querySelectorAll('[data-testid^="message-card-"]');
      expect(cards[0]?.className).toContain('border-green-500');
      // Loser card should have red stat on the criterion (open)
      const loserCard = cards[1];
      expect(loserCard?.querySelector('[data-stat-loss="true"]')).toBeInTheDocument();
    });
  });

  describe('Etapa 20: section labels + split stats', () => {
    it('shows "Campanha Split:" label for split campaigns', async () => {
      await renderProcess(
        baseCampaign({
          type: 'split',
          status: CampaignStatus.Sending,
          testabAudiencePercent: 100,
          campaignMessage: [
            { id: 10, title: 'Msg A', statistics: { open: '80', click: '35', delivered: '500' } },
            { id: 20, title: 'Msg B', statistics: { open: '65', click: '42', delivered: '500' } },
            { id: 30, title: 'Msg C', statistics: { open: '90', click: '28', delivered: '500' } },
          ],
        }),
      );

      const messagesSection = screen.getByTestId('process-messages');
      const text = messagesSection.textContent ?? '';
      expect(text).toContain('Campanha Split:');
      // 3 messages, each gets 33.3% sample
      expect(text).toContain('33.3%');
      // Stats should be normalized from raw counts: 80/500 = 16%
      expect(text).toContain('16%');
    });

    it('shows "Campanha Recorrente:" label for recurring campaigns', async () => {
      await renderProcess(
        baseCampaign({
          type: 'recurring',
          status: CampaignStatus.Sending,
          campaignMessage: [
            {
              id: 10,
              title: 'Msg A',
              statistics: { open: '340', click: '120', delivered: '1500' },
            },
          ],
        }),
      );

      const messagesSection = screen.getByTestId('process-messages');
      expect(messagesSection.textContent).toContain('Campanha Recorrente:');
    });

    it('normalizes raw count statistics for simple campaigns', async () => {
      await renderProcess(
        baseCampaign({
          type: 'simple',
          status: CampaignStatus.Completed,
          campaignMessage: [
            {
              id: 10,
              title: 'Msg A',
              statistics: { open: '250', click: '100', delivered: '1000', bounce: '20' },
            },
          ],
        }),
      );

      const messagesSection = screen.getByTestId('process-messages');
      const text = messagesSection.textContent ?? '';
      // 250/1000 = 25%
      expect(text).toContain('25%');
      // 100/1000 = 10%
      expect(text).toContain('10%');
    });
  });

  describe('Etapa 10: audience section', () => {
    it('handles steps as JSON string from API (does not crash)', async () => {
      // API sometimes returns steps as a JSON string instead of array
      await renderProcess(
        baseCampaign({
          sendToAll: false,
          steps: '[[{"type":"tag","conditional_tag":"in","tag_id":[1],"tag_info":[{"id":1,"name":"Tag B"}]}]]' as any,
        }),
      );

      expect(screen.getByTestId('process-audience')).toBeInTheDocument();
      expect(screen.getByText('Tag B')).toBeInTheDocument();
    });

    it('shows audience tags for campaigns with segments', async () => {
      await renderProcess(
        baseCampaign({
          sendToAll: false,
          steps: [
            [
              {
                type: 'tag',
                conditional_tag: 'in',
                tag_id: [1],
                tag_info: [{ id: 1, name: 'Tag A' }],
              },
            ],
          ],
        }),
      );

      expect(screen.getByTestId('process-audience')).toBeInTheDocument();
      expect(screen.getByText('Tag A')).toBeInTheDocument();
    });

    it('shows "send to all" when sendToAll is true', async () => {
      await renderProcess(baseCampaign({ sendToAll: true, steps: [] }));

      expect(screen.getByTestId('process-audience')).toBeInTheDocument();
    });
  });
});
