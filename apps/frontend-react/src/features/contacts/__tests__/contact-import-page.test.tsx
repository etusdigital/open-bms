// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { ContactImportPage } from '../contact-import-page';

// ── Mocks ──────────────────────────────────────────────────────────

const mockMutateAsync = vi.fn().mockResolvedValue({ success: true });
const mockNavigate = vi.fn();

let mockImportReturn: Record<string, unknown> = {};

vi.mock('../use-contacts', () => ({
  useImportContacts: () => mockImportReturn,
}));

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock apiClient for tags and custom fields queries
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: {
        results: [],
        totalItems: 0,
        page: '1',
        itemsPerPage: '1000',
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((_content: string, opts: { complete: (result: { data: string[][] }) => void }) => {
      opts.complete({
        data: [
          ['Email', 'First Name', 'Last Name'],
          ['john@example.com', 'John', 'Doe'],
          ['jane@example.com', 'Jane', 'Smith'],
        ],
      });
    }),
  },
}));

// Mock FileReader so onloadend fires synchronously in jsdom
vi.stubGlobal(
  'FileReader',
  vi.fn(() => {
    const instance = {
      readAsText: vi.fn(),
      result: 'Email,First Name,Last Name\njohn@example.com,John,Doe\njane@example.com,Jane,Smith',
      onloadend: null as ((e: unknown) => void) | null,
    };
    instance.readAsText = vi.fn(() => {
      if (instance.onloadend) {
        instance.onloadend({ target: { result: instance.result } });
      }
    });
    return instance;
  }),
);

// ── Helpers ────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

async function renderPage() {
  const qc = createQueryClient();
  return renderWithRouter(
    <QueryClientProvider client={qc}>
      <ContactImportPage />
    </QueryClientProvider>,
  );
}

function createCsvFile(name = 'contacts.csv') {
  return new File(['Email,First Name,Last Name\njohn@example.com,John,Doe\njane@example.com,Jane,Smith'], name, {
    type: 'text/csv',
  });
}

async function uploadFile() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [createCsvFile()] } });
  await waitFor(() => {
    expect(screen.getByText('contacts.csv')).toBeInTheDocument();
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('ContactImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
    mockImportReturn = {
      mutate: vi.fn(),
      mutateAsync: mockMutateAsync,
      isPending: false,
      isSuccess: false,
    };
  });

  describe('initial state (upload zone)', () => {
    it('renders back link to contacts', async () => {
      await renderPage();
      const backLink = screen.getByRole('link', { name: /contatos/i });
      expect(backLink).toBeInTheDocument();
    });

    it('renders page title', async () => {
      await renderPage();
      expect(screen.getByText(/importar contatos/i)).toBeInTheDocument();
    });

    it('renders upload zone with drag and drop instructions', async () => {
      await renderPage();
      expect(screen.getByText(/arraste e solte/i)).toBeInTheDocument();
    });

    it('renders file input accepting CSV', async () => {
      await renderPage();
      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('accept', '.csv');
    });
  });

  describe('after file upload', () => {
    it('shows file name', async () => {
      await renderPage();
      await uploadFile();
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });

    it('shows column mapping section', async () => {
      await renderPage();
      await uploadFile();
      expect(screen.getByText(/associar campos/i)).toBeInTheDocument();
    });

    it('shows preview rows from CSV', async () => {
      await renderPage();
      await uploadFile();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('shows header row toggle', async () => {
      await renderPage();
      await uploadFile();
      expect(screen.getByText(/primeira linha.*cabeçalho/i)).toBeInTheDocument();
    });

    it('shows action checkboxes', async () => {
      await renderPage();
      await uploadFile();
      expect(screen.getByText(/atualizar contatos/i)).toBeInTheDocument();
      expect(screen.getByText(/iniciar automação/i)).toBeInTheDocument();
    });

    it('shows tag selection', async () => {
      await renderPage();
      await uploadFile();
      expect(screen.getAllByText(/selecionar tags/i).length).toBeGreaterThanOrEqual(1);
    });

    it('shows import button', async () => {
      await renderPage();
      await uploadFile();
      expect(screen.getByRole('button', { name: /importar/i })).toBeInTheDocument();
    });
  });

  describe('remove file', () => {
    it('resets to upload zone when file is removed', async () => {
      await renderPage();
      await uploadFile();

      const removeButton = screen.getByRole('button', { name: /remover/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText(/arraste e solte/i)).toBeInTheDocument();
      });
    });
  });

  describe('sending state', () => {
    it('disables import button while sending', async () => {
      mockImportReturn = {
        ...mockImportReturn,
        isPending: true,
      };
      await renderPage();
      await uploadFile();

      const importBtn = screen.getByRole('button', { name: /importando/i });
      expect(importBtn).toBeDisabled();
    });
  });

  describe('success state', () => {
    it('shows success message when import completes', async () => {
      mockImportReturn = {
        ...mockImportReturn,
        isSuccess: true,
      };
      await renderPage();
      await uploadFile();

      expect(screen.getByText(/importados com sucesso/i)).toBeInTheDocument();
    });
  });
});
