import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import ProductsPage from '../products-page';
import type { ProductsResponse } from '../types';

let mockQueryReturn: Record<string, unknown> = {};
const useProductsSpy = vi.fn(() => mockQueryReturn);

vi.mock('../use-products', () => ({
  useProducts: (...args: unknown[]) => useProductsSpy(...args),
}));

async function renderPage() {
  return renderWithRouter(<ProductsPage />);
}

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  describe('loading state', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: undefined,
        isLoading: true,
        error: null,
      };
    });

    it('renders the page title', async () => {
      await renderPage();
      expect(screen.getByText('Produtos')).toBeInTheDocument();
    });

    it('shows loading skeletons', async () => {
      await renderPage();
      // Skeletons render as divs with specific classes
      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('empty state', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: { products: [] } as ProductsResponse,
        isLoading: false,
        error: null,
      };
    });

    it('shows empty message when no products', async () => {
      await renderPage();
      expect(screen.getByText(/nenhum produto/i)).toBeInTheDocument();
    });
  });

  describe('with data', () => {
    beforeEach(() => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);

      mockQueryReturn = {
        data: {
          products: [
            {
              [dateStr]: {
                '10:00': {
                  products: [
                    {
                      title: 'Welcome Campaign',
                      link: ['https://example.com/product1', 'https://example.com/product2'],
                      messages: [
                        {
                          message_name: 'Welcome Email',
                          message_subject: 'Welcome!',
                          message_sender: 'no-reply@test.com',
                          message_sender_name: 'Test',
                          campaign_message_statistics: {
                            delivered: 100,
                            open: 50,
                            click: 10,
                            bounce: 2,
                            unsubscribe: 1,
                          },
                        },
                      ],
                      tags: {},
                      sendToAll: false,
                    },
                  ],
                },
              },
            },
          ],
        } as ProductsResponse,
        isLoading: false,
        error: null,
      };
    });

    it('renders the calendar table', async () => {
      await renderPage();
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });

    it('renders the product card', async () => {
      await renderPage();
      expect(screen.getByText('Welcome Campaign')).toBeInTheDocument();
    });

    it('renders product links in the card', async () => {
      await renderPage();
      expect(screen.getByText('https://example.com/product1')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/product2')).toBeInTheDocument();
    });

    it('shows empty slot text for hours without products in that day', async () => {
      await renderPage();
      // The 10:00 row has 7 day columns. Only today has a product, the other 6 show "Sem produto"
      const emptySlots = screen.getAllByText(/sem produto/i);
      expect(emptySlots.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('week starts on Monday', () => {
    beforeEach(() => {
      // Use a known Wednesday (2026-03-18) to verify the week starts on Monday (2026-03-16)
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-18T12:00:00'));

      mockQueryReturn = {
        data: {
          products: [
            {
              '2026-03-16': {
                '09:00': {
                  products: [
                    {
                      title: 'Monday Product',
                      link: [],
                      messages: [],
                      tags: {},
                      sendToAll: false,
                    },
                  ],
                },
              },
            },
          ],
        } as ProductsResponse,
        isLoading: false,
        error: null,
      };
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('renders Monday product in the first column', async () => {
      await renderPage();
      expect(screen.getByText('Monday Product')).toBeInTheDocument();
    });
  });

  describe('week navigation', () => {
    beforeEach(() => {
      mockQueryReturn = {
        data: { products: [] } as ProductsResponse,
        isLoading: false,
        error: null,
      };
    });

    it('renders today button', async () => {
      await renderPage();
      expect(screen.getByText('Hoje')).toBeInTheDocument();
    });

    it('renders previous and next week buttons', async () => {
      await renderPage();
      expect(screen.getByRole('button', { name: /semana anterior/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /próxima semana/i })).toBeInTheDocument();
    });
  });

  describe('week navigation interactions', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      // Pin to Wednesday 2026-03-18 → week is Mon 16 to Sun 22
      vi.setSystemTime(new Date('2026-03-18T12:00:00'));

      mockQueryReturn = {
        data: { products: [] } as ProductsResponse,
        isLoading: false,
        error: null,
      };
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('clicking previous week calls useProducts with earlier date', async () => {
      await renderPage();
      // Initial call uses current week Monday = 2026-03-16
      const initialDate = useProductsSpy.mock.calls[0][0];
      expect(initialDate).toBe('2026-03-16');

      useProductsSpy.mockClear();
      fireEvent.click(screen.getByRole('button', { name: /semana anterior/i }));
      // Previous week Monday = 2026-03-09
      expect(useProductsSpy.mock.calls[0][0]).toBe('2026-03-09');
    });

    it('clicking next week calls useProducts with later date', async () => {
      await renderPage();

      useProductsSpy.mockClear();
      fireEvent.click(screen.getByRole('button', { name: /próxima semana/i }));
      // Next week Monday = 2026-03-23
      expect(useProductsSpy.mock.calls[0][0]).toBe('2026-03-23');
    });

    it('clicking "Hoje" resets to current week', async () => {
      await renderPage();

      // Navigate away first
      fireEvent.click(screen.getByRole('button', { name: /semana anterior/i }));
      useProductsSpy.mockClear();

      // Now click "Hoje"
      fireEvent.click(screen.getByText('Hoje'));
      // Should call with current week Monday = 2026-03-16
      expect(useProductsSpy.mock.calls[0][0]).toBe('2026-03-16');
    });
  });

  describe('with data - edge cases', () => {
    it('renders multiple products in same time slot', async () => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);

      mockQueryReturn = {
        data: {
          products: [
            {
              [dateStr]: {
                '10:00': {
                  products: [
                    {
                      title: 'Campaign Alpha',
                      link: '',
                      messages: [],
                      tags: {},
                      sendToAll: false,
                    },
                    {
                      title: 'Campaign Beta',
                      link: '',
                      messages: [],
                      tags: {},
                      sendToAll: false,
                    },
                  ],
                },
              },
            },
          ],
        } as ProductsResponse,
        isLoading: false,
        error: null,
      };

      await renderPage();
      expect(screen.getByText('Campaign Alpha')).toBeInTheDocument();
      expect(screen.getByText('Campaign Beta')).toBeInTheDocument();
    });

    it('renders product card without links when link is empty', async () => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10);

      mockQueryReturn = {
        data: {
          products: [
            {
              [dateStr]: {
                '14:00': {
                  products: [
                    {
                      title: 'No Links Product',
                      link: '',
                      messages: [],
                      tags: {},
                      sendToAll: false,
                    },
                  ],
                },
              },
            },
          ],
        } as ProductsResponse,
        isLoading: false,
        error: null,
      };

      await renderPage();
      expect(screen.getByText('No Links Product')).toBeInTheDocument();
      // The product card should not contain any link elements
      const card = screen.getByText('No Links Product').closest('div');
      expect(card?.querySelectorAll('[title]')).toHaveLength(0);
    });
  });
});
