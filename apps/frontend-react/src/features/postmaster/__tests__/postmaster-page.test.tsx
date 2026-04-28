import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import PostmasterPage from '../postmaster-page';
import type { PostmasterDomain } from '../types';

let mockQueryReturn: Record<string, unknown> = {};

vi.mock('../use-postmaster', () => ({
  usePostmaster: () => mockQueryReturn,
}));

vi.mock('@/components/charts/echarts-base', () => ({
  EChartsBase: ({ height }: { height?: number }) => (
    <div data-testid="echarts-container" style={{ height: height ?? 350 }} />
  ),
}));

function renderPage() {
  return renderWithRouter(<PostmasterPage />);
}

const mockData: PostmasterDomain[] = [
  {
    domain: 'plusdin.com.br',
    dates: [
      {
        date: '2026-03-30',
        time: 1743292800,
        domainReputation: 'high',
        spamRatio: 0.12,
        spfRatio: 98.5,
        dkimRatio: 99.1,
        dmarcRatio: 97.3,
        inboundRatio: 0.95,
        spamLoops: null,
        deliveryErrors: null,
        ips: [
          { ip: '192.168.1.10', reputation: 'high' },
          { ip: '192.168.1.11', reputation: 'medium' },
        ],
      },
    ],
  },
  {
    domain: 'pe.plusdin.com.br',
    dates: [
      {
        date: '2026-03-30',
        time: 1743292800,
        domainReputation: 'medium',
        spamRatio: 0.31,
        spfRatio: 96.2,
        dkimRatio: 97.5,
        dmarcRatio: 95.1,
        inboundRatio: 0.88,
        spamLoops: [{ id: 'campaign-promo', spamRatio: 0.0031 }],
        deliveryErrors: [{ errorType: 'rate_limit', errorClass: 'temporary', errorRatio: 0.02 }],
        ips: [
          { ip: '192.168.1.10', reputation: 'low' },
          { ip: '192.168.1.11', reputation: 'high' },
        ],
      },
    ],
  },
];

const mockDataNoDates: PostmasterDomain[] = [{ domain: 'plusdin.com.br', dates: [] }];

describe('PostmasterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: true, error: null };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Reputação de E-mail')).toBeInTheDocument();
    });

    it('shows loading skeletons', async () => {
      await renderPage();
      const pulsingElements = document.querySelectorAll('.animate-pulse');
      expect(pulsingElements.length).toBeGreaterThan(0);
    });

    it('always shows the info banner even while loading', async () => {
      await renderPage();
      expect(screen.getByDisplayValue('bfp@brius.com.br')).toBeInTheDocument();
    });
  });

  describe('empty state — no domains', () => {
    beforeEach(() => {
      mockQueryReturn = { data: [], isLoading: false, error: null };
    });

    it('shows no domains message', async () => {
      await renderPage();
      expect(screen.getByText('Nenhum domínio encontrado.')).toBeInTheDocument();
    });

    it('does not render domain selector', async () => {
      await renderPage();
      expect(screen.queryByTestId('domain-selector')).not.toBeInTheDocument();
    });
  });

  describe('empty state — domain exists but no dates', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockDataNoDates, isLoading: false, error: null };
    });

    it('shows no data for period message', async () => {
      await renderPage();
      expect(screen.getByText(/Nenhum dado disponível/i)).toBeInTheDocument();
    });

    it('still renders domain selector and filters', async () => {
      await renderPage();
      expect(screen.getByTestId('domain-selector')).toBeInTheDocument();
      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-trigger')).toBeInTheDocument();
    });
  });

  describe('info banner', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockData, isLoading: false, error: null };
    });

    it('renders postmaster email in read-only input', async () => {
      await renderPage();
      const input = screen.getByDisplayValue('bfp@brius.com.br');
      expect(input).toHaveAttribute('readOnly');
    });

    it('renders copy button that copies to clipboard', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

      await renderPage();
      fireEvent.click(screen.getByRole('button', { name: /Copiar/i }));
      expect(mockWriteText).toHaveBeenCalledWith('bfp@brius.com.br');
    });

    it('shows "Copied" feedback after clicking copy', async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
      await renderPage();
      fireEvent.click(screen.getByRole('button', { name: /Copiar/i }));
      expect(screen.getByText('Copiado!')).toBeInTheDocument();
    });

    it('renders help page link with correct href and target', async () => {
      await renderPage();
      const link = screen.getByText('página de ajuda');
      expect(link).toHaveAttribute('href', expect.stringContaining('atlassian.net'));
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders verification instruction text', async () => {
      await renderPage();
      expect(screen.getByText(/Verifique a reputação do seu E-mail/)).toBeInTheDocument();
    });
  });

  describe('with data — domain selector', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockData, isLoading: false, error: null };
    });

    it('auto-selects first domain', async () => {
      await renderPage();
      const selector = screen.getByTestId('domain-selector');
      expect(within(selector).getByText('plusdin.com.br')).toBeInTheDocument();
    });
  });

  describe('with data — chart type selector', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockData, isLoading: false, error: null };
    });

    it('renders chart type selector', async () => {
      await renderPage();
      expect(screen.getByTestId('chart-type-selector')).toBeInTheDocument();
    });

    it('defaults to IP reputation chart type', async () => {
      await renderPage();
      expect(screen.getAllByText('Reputação IP').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('with data — chart rendering', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockData, isLoading: false, error: null };
    });

    it('renders ECharts container', async () => {
      await renderPage();
      expect(screen.getByTestId('echarts-container')).toBeInTheDocument();
    });

    it('shows IP click hint', async () => {
      await renderPage();
      expect(screen.getByText(/Clique em um ponto de dados para exibir/)).toBeInTheDocument();
    });

    it('renders date range picker', async () => {
      await renderPage();
      expect(screen.getByTestId('date-range-trigger')).toBeInTheDocument();
    });
  });

  describe('null/undefined data handling', () => {
    it('handles null data gracefully', async () => {
      mockQueryReturn = { data: null, isLoading: false, error: null };
      await expect(renderPage()).resolves.toBeDefined();
      expect(screen.getByText('Nenhum domínio encontrado.')).toBeInTheDocument();
    });

    it('handles undefined data gracefully', async () => {
      mockQueryReturn = { data: undefined, isLoading: false, error: null };
      await expect(renderPage()).resolves.toBeDefined();
    });
  });
});
