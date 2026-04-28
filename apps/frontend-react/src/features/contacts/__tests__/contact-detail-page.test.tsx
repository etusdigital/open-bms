// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { ContactDetailPage } from '../contact-detail-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockUpdateMutate = vi.fn();
const mockNavigate = vi.fn();

let mockContactQueryReturn: Record<string, unknown> = {};
let mockHistoryReturn: Record<string, unknown> = {};

vi.mock('../use-contacts', () => ({
  useContact: () => mockContactQueryReturn,
  useUpdateContact: () => ({ mutate: mockUpdateMutate, isPending: false }),
  useContactHistory: () => mockHistoryReturn,
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useBlocker: vi.fn().mockReturnValue({ status: 'idle' }),
  };
});

// ── Helpers ────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

async function renderPage(contactUuid = 'abc-uuid-123') {
  return renderWithRouter(
    <QueryClientProvider client={queryClient}>
      <ContactDetailPage contactUuid={contactUuid} />
    </QueryClientProvider>,
  );
}

const fullContact = {
  id: 5,
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+5511999999999',
  isActive: true,
  hasEmail: true,
  hasPhone: true,
  hasWebPush: false,
  hasMobilePush: false,
  hasWhatsapp: false,
  city: 'São Paulo',
  region: 'SP',
  country: 'Brazil',
  createdAt: '2026-01-15T10:00:00Z',
};

// ── Tests ──────────────────────────────────────────────────────────

describe('ContactDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHistoryReturn = {
      data: undefined,
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    };
    mockContactQueryReturn = {
      data: fullContact,
      isLoading: false,
      error: null,
    };
  });

  describe('loading state', () => {
    it('shows loading skeleton while fetching', async () => {
      mockContactQueryReturn = {
        data: undefined,
        isLoading: true,
        error: null,
      };
      await renderPage();
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('error state', () => {
    it('shows error message when contact fails to load', async () => {
      mockContactQueryReturn = {
        data: undefined,
        isLoading: false,
        error: new Error('Not found'),
      };
      await renderPage();
      expect(screen.getByText(/não foi encontrado/i)).toBeInTheDocument();
    });
  });

  describe('contact info', () => {
    it('renders contact name', async () => {
      await renderPage();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders contact email', async () => {
      await renderPage();
      expect(screen.getAllByText('john@example.com').length).toBeGreaterThanOrEqual(1);
    });

    it('renders contact status badge', async () => {
      await renderPage();
      const badges = screen.getAllByText(/ativo/i);
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders unsubscribed status badge', async () => {
      mockContactQueryReturn = {
        data: { ...fullContact, isActive: false, isUnsubscribed: true },
        isLoading: false,
        error: null,
      };
      await renderPage();
      const badges = screen.getAllByText(/descadastrado/i);
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders blocked status badge', async () => {
      mockContactQueryReturn = {
        data: { ...fullContact, isActive: false, isBlocked: true },
        isLoading: false,
        error: null,
      };
      await renderPage();
      const badges = screen.getAllByText(/bloqueado/i);
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders bounced status badge', async () => {
      mockContactQueryReturn = {
        data: { ...fullContact, isActive: false, hasBounced: true },
        isLoading: false,
        error: null,
      };
      await renderPage();
      const badges = screen.getAllByText(/bounced/i);
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders back link to contacts list', async () => {
      await renderPage();
      const backLink = screen.getByRole('link', { name: /contatos/i });
      expect(backLink).toBeInTheDocument();
    });
  });

  describe('contact details card', () => {
    it('renders phone number', async () => {
      await renderPage();
      expect(screen.getByText('+5511999999999')).toBeInTheDocument();
    });

    it('renders location', async () => {
      await renderPage();
      expect(screen.getByText(/são paulo/i)).toBeInTheDocument();
    });

    it('shows edit button', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    });
  });

  describe('channel information', () => {
    it('renders channel section header', async () => {
      await renderPage();
      const channelHeaders = screen.getAllByText(/canais/i);
      expect(channelHeaders.length).toBeGreaterThanOrEqual(1);
    });
  });
});
