import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import MessageFormPage from '../message-form-page';
import type { Message } from '../types';

// Mock react-email-editor since Unlayer can't load in jsdom
vi.mock('react-email-editor', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onReady }: { onReady?: () => void }) => {
    if (onReady) setTimeout(onReady, 0);
    return <div data-testid="email-editor">Email Editor Mock</div>;
  }),
}));

const { mockDuplicateMutate, mockCreateMutate, mockUpdateMutate } = vi.hoisted(() => ({
  mockDuplicateMutate: vi.fn(),
  mockCreateMutate: vi.fn(),
  mockUpdateMutate: vi.fn(),
}));

vi.mock('../use-messages', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    useMessage: vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    }),
    useCreateMessage: vi.fn().mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    }),
    useUpdateMessage: vi.fn().mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    }),
    useDuplicateMessage: vi.fn().mockReturnValue({
      mutate: mockDuplicateMutate,
      isPending: false,
    }),
    usePoolsForSelect: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
    }),
    useSendTestEmail: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    }),
    useSendTestMobilePush: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    }),
    useLabelsAll: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
    }),
    useTemplatesForSelect: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
    }),
  };
});

// cmdk uses scrollIntoView which isn't available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Import the mocked module so we can change return values per-test
const { useMessage } = await import('../use-messages');
const mockedUseMessage = vi.mocked(useMessage);

describe('MessageFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('shows campaign-in-use alert when message is used in a campaign', async () => {
    mockedUseMessage.mockReturnValue({
      data: {
        id: 5,
        title: 'Campaign Email',
        type: 'email',
        campaignInUse: true,
      } as Message,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMessage>);

    await renderWithRouter(<MessageFormPage messageId={5} messageType="email" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/esta mensagem está sendo usada em uma campanha/i)).toBeInTheDocument();
    expect(screen.getByText(/copiar mensagem/i)).toBeInTheDocument();
  });

  it('does not show campaign-in-use alert when not in use', async () => {
    mockedUseMessage.mockReturnValue({
      data: {
        id: 5,
        title: 'Regular Email',
        type: 'email',
        campaignInUse: false,
      } as Message,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMessage>);

    await renderWithRouter(<MessageFormPage messageId={5} messageType="email" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('passes templateUrl to MessageForm in edit mode', async () => {
    mockedUseMessage.mockReturnValue({
      data: {
        id: 10,
        title: 'Email with template',
        type: 'email',
        campaignInUse: false,
        templateUrl: 'https://storage.example.com/templates/messages/10/template.html',
      } as Message,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMessage>);

    await renderWithRouter(<MessageFormPage messageId={10} messageType="email" />);

    // When templateUrl exists on the message, the view-in-browser button should render
    const buttons = screen.getAllByRole('button');
    const viewBtn = buttons.find((btn) => btn.querySelector('.lucide-external-link'));
    expect(viewBtn).toBeInTheDocument();
  });

  it('does not pass templateUrl in create mode', async () => {
    mockedUseMessage.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMessage>);

    await renderWithRouter(<MessageFormPage messageType="email" />);

    const buttons = screen.getAllByRole('button');
    const viewBtn = buttons.find((btn) => btn.querySelector('.lucide-external-link'));
    expect(viewBtn).toBeUndefined();
  });

  it('does not show campaign-in-use alert in create mode', async () => {
    mockedUseMessage.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useMessage>);

    await renderWithRouter(<MessageFormPage messageType="email" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('transactional messages', () => {
    it('renders with the transactional title for transactional-email type', async () => {
      mockedUseMessage.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useMessage>);

      await renderWithRouter(<MessageFormPage messageType="transactional-email" />);

      // The page header backLabel should reference the transactional label
      expect(screen.getByText(/Email Transacional/i)).toBeInTheDocument();
    });

    it('uses /messages/transactional as backTo for transactional-email type', async () => {
      mockedUseMessage.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useMessage>);

      await renderWithRouter(<MessageFormPage messageType="transactional-email" />);

      // The back link should point to the transactional listing page
      const backLink = screen
        .getAllByRole('link')
        .find((link) => link.getAttribute('href') === '/messages/transactional');
      expect(backLink).toBeDefined();
    });

    it('loads an existing transactional message by id and uses correct title', async () => {
      mockedUseMessage.mockReturnValue({
        data: {
          id: 123,
          title: 'Welcome transactional',
          type: 'transactional-email',
          campaignInUse: false,
        } as Message,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useMessage>);

      await renderWithRouter(<MessageFormPage messageId={123} messageType="transactional-email" />);

      // Header still shows transactional label
      expect(screen.getByText(/Email Transacional/i)).toBeInTheDocument();
    });
  });
});
