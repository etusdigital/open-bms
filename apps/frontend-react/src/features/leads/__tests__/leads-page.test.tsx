import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import LeadsPage from '../leads-page';
import type { LeadRow } from '../types';

let mockQueryReturn: Record<string, unknown> = {};

vi.mock('../use-leads', () => ({
  useLeads: () => mockQueryReturn,
}));

function renderPage(overrides: Partial<Record<string, unknown>> = {}) {
  return renderWithRouter(
    <LeadsPage
      searchParams={{
        groupItems: 'utm_source,utm_medium',
        startDate: '2026-04-01',
        endDate: '2026-04-08',
        search: '',
        page: 1,
        pageSize: 10,
        ...overrides,
      }}
    />,
  );
}

const mockLeads: LeadRow[] = [
  {
    utm_source: 'facebook',
    utm_medium: 'cpc',
    total: 1756,
    total_unique: '1580 (90.0%)',
    valid: '1535 (87.4%)',
    new: '659 (37.5%)',
    old: '876 (49.9%)',
    bounced: '45 (2.6%)',
    invalid: '45 (2.6%)',
    automation_entry: '1490 (84.9%)',
    automation_duplicated: '90 (5.1%)',
  },
  {
    utm_source: 'google',
    utm_medium: 'cpc',
    total: 559,
    total_unique: '510 (91.2%)',
    valid: '505 (90.3%)',
    new: '246 (44.0%)',
    old: '256 (45.8%)',
    bounced: '8 (1.4%)',
    invalid: '5 (0.9%)',
    automation_entry: '502 (89.8%)',
    automation_duplicated: '8 (1.4%)',
  },
];

describe('LeadsPage', () => {
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
      expect(screen.getByRole('heading', { name: 'Leads' })).toBeInTheDocument();
    });

    it('shows loading skeletons', async () => {
      await renderPage();
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('no group selected', () => {
    beforeEach(() => {
      mockQueryReturn = { data: undefined, isLoading: false, error: null };
    });

    it('shows prompt to select grouping items', async () => {
      await renderPage({ groupItems: '' });
      expect(screen.getByText(/selecione itens de agrupamento para ver/i)).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockQueryReturn = { data: [], isLoading: false, error: null };
    });

    it('shows empty message when no data returned', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum/i)).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    beforeEach(() => {
      mockQueryReturn = { data: mockLeads, isLoading: false, isFetching: false, error: null };
    });

    it('renders lead rows', async () => {
      await renderPage();
      expect(screen.getByText('facebook')).toBeInTheDocument();
      expect(screen.getByText('google')).toBeInTheDocument();
    });

    it('renders dynamic group columns', async () => {
      await renderPage();
      expect(screen.getAllByText('UTM Source').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('UTM Medium').length).toBeGreaterThanOrEqual(1);
    });

    it('renders metric columns', async () => {
      await renderPage();
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('Total Único')).toBeInTheDocument();
      expect(screen.getByText('Válidos')).toBeInTheDocument();
      expect(screen.getByText('Novos')).toBeInTheDocument();
      expect(screen.getByText('Antigos')).toBeInTheDocument();
    });

    it('renders grouping select', async () => {
      await renderPage();
      expect(screen.getByText(/selecione itens de agrupamento/i)).toBeInTheDocument();
    });

    it('renders date range picker', async () => {
      await renderPage();
      expect(screen.getByTestId('date-range-trigger')).toBeInTheDocument();
    });

    it('renders more filters button', async () => {
      await renderPage();
      expect(screen.getByText(/mais filtros/i)).toBeInTheDocument();
    });
  });
});
