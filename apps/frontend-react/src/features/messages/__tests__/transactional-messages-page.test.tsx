// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import type { Message } from '../types';

const { mockDeleteMutate, mockDuplicateMutate } = vi.hoisted(() => ({
  mockDeleteMutate: vi.fn(),
  mockDuplicateMutate: vi.fn(),
}));

vi.mock('../use-messages', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    useMessagesList: vi.fn().mockReturnValue({
      data: {
        data: [
          {
            id: 101,
            title: 'Welcome Transactional',
            type: 'transactional-email',
            fromName: 'Support',
            fromMail: 'support@test.com',
            subject: 'Welcome!',
            updatedAt: '2026-03-10T12:00:00Z',
          },
          {
            id: 102,
            title: 'OTP Transactional SMS',
            type: 'transactional-sms',
            updatedAt: '2026-03-11T12:00:00Z',
          },
        ] as Message[],
        meta: { total: 2 },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    }),
    useDeleteMessage: vi.fn().mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    }),
    useDuplicateMessage: vi.fn().mockReturnValue({
      mutate: mockDuplicateMutate,
      isPending: false,
    }),
  };
});

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

import TransactionalMessagesPage from '../transactional-messages-page';

const baseSearchParams = {
  page: 1,
  pageSize: 10,
  search: '',
  sort: '',
  order: 'asc' as const,
};

describe('TransactionalMessagesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore({ permissions: ['messages:view', 'messages:create', 'messages:delete'] });
  });

  it('renders the transactional header title', async () => {
    await renderWithRouter(<TransactionalMessagesPage searchParams={baseSearchParams} />);
    expect(screen.getByText(/Transacional/i)).toBeInTheDocument();
  });

  it('calls useMessagesList with the TRANSACTIONAL_TYPES array', async () => {
    const useMessages = await import('../use-messages');
    const spy = vi.mocked(useMessages.useMessagesList);

    await renderWithRouter(<TransactionalMessagesPage searchParams={baseSearchParams} />);

    expect(spy).toHaveBeenCalled();
    const [, messageTypeArg] = spy.mock.calls[0];
    expect(Array.isArray(messageTypeArg)).toBe(true);
    expect(messageTypeArg).toEqual(
      expect.arrayContaining([
        'transactional-email',
        'transactional-sms',
        'transactional-web-push',
        'transactional-mobile-push',
        'transactional-whatsapp',
      ]),
    );
  });

  it('renders a row for each message', async () => {
    await renderWithRouter(<TransactionalMessagesPage searchParams={baseSearchParams} />);
    expect(screen.getByText('Welcome Transactional')).toBeInTheDocument();
    expect(screen.getByText('OTP Transactional SMS')).toBeInTheDocument();
  });

  it('row edit link points to /messages/transactional/{canal}/{id}', async () => {
    await renderWithRouter(<TransactionalMessagesPage searchParams={baseSearchParams} />);
    const links = screen.getAllByRole('link');
    const emailLink = links.find((l) => l.getAttribute('href') === '/messages/transactional/email/101');
    const smsLink = links.find((l) => l.getAttribute('href') === '/messages/transactional/sms/102');
    expect(emailLink).toBeDefined();
    expect(smsLink).toBeDefined();
  });

  it('create button navigates to /messages/transactional/email/create', async () => {
    await renderWithRouter(<TransactionalMessagesPage searchParams={baseSearchParams} />);
    const createLink = screen
      .getAllByRole('link')
      .find((l) => l.getAttribute('href') === '/messages/transactional/email/create');
    expect(createLink).toBeDefined();
  });
});
