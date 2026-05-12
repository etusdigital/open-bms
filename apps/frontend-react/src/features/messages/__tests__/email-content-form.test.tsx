import { useRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import { authenticateStore } from '@/test-utils/authenticate-store';
import '@/lib/i18n';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { emailFormSchema, type EmailFormValues } from '../message-schema';
import { EmailContentForm } from '../components/email-content-form';
import * as useMessagesModule from '../use-messages';
import type { Pool } from '@/features/pools/types';
import type { EditorRef } from 'react-email-editor';

const mockExportHtml = vi.fn();
const mockLoadDesign = vi.fn();

// Mock react-email-editor since Unlayer can't load in jsdom
vi.mock('react-email-editor', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onReady, ref }: { onReady?: () => void; ref?: any }) => {
    // Expose editor mock through the ref so component handlers can call it
    if (ref && typeof ref === 'object') {
      ref.current = {
        editor: {
          exportHtml: mockExportHtml,
          loadDesign: mockLoadDesign,
        },
      };
    }
    if (onReady) setTimeout(onReady, 0);
    return <div data-testid="email-editor">Email Editor Mock</div>;
  }),
}));

vi.mock('../use-messages', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    usePoolsForSelect: vi.fn().mockReturnValue({
      data: [
        {
          id: 1,
          poolName: 'default-pool',
          senderEmail: 'sender@test.com',
          senderName: 'Sender Name',
          senderReplyTo: 'reply@test.com',
          isDefault: true,
        },
        {
          id: 2,
          poolName: 'secondary-pool',
          senderEmail: 'other@test.com',
          senderName: 'Other Sender',
          senderReplyTo: '',
          isDefault: false,
        },
      ] as Pool[],
      isLoading: false,
      isSuccess: true,
    }),
    useTemplatesForSelect: vi.fn().mockReturnValue({
      data: [
        { id: 1, name: 'Welcome Template', json_template: '{}' },
        { id: 2, name: 'Newsletter Template', json_template: '{}' },
      ],
      isLoading: false,
    }),
  };
});

interface FormWrapperProps {
  templateUrl?: string;
  defaultValues?: Partial<EmailFormValues>;
  onForm?: (form: UseFormReturn<EmailFormValues>) => void;
}

function FormWrapper({ templateUrl, defaultValues, onForm }: FormWrapperProps) {
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      title: 'Test',
      description: '',
      ippool: '',
      fromName: '',
      fromMail: '',
      replyTo: '',
      subject: '',
      previewText: '',
      priority: 'high',
      content: '',
      content_json: '',
      ...defaultValues,
    } as EmailFormValues,
  });
  const editorRef = useRef<EditorRef>(null);
  onForm?.(form);

  return (
    <FormProvider {...form}>
      <EmailContentForm editorRef={editorRef} templateUrl={templateUrl} />
    </FormProvider>
  );
}

function renderEmailContent(props?: FormWrapperProps) {
  return renderWithRouter(<FormWrapper {...props} />);
}

describe('EmailContentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateStore();
  });

  it('renders sender address selector', async () => {
    await renderEmailContent();
    expect(screen.getByText('Remetente')).toBeInTheDocument();
  });

  it('renders from name field', async () => {
    await renderEmailContent();
    expect(screen.getByLabelText(/nome do remetente/i)).toBeInTheDocument();
  });

  it('renders subject field', async () => {
    await renderEmailContent();
    expect(screen.getByLabelText(/assunto/i)).toBeInTheDocument();
  });

  it('renders preview text field', async () => {
    await renderEmailContent();
    expect(screen.getByLabelText(/pré-visualização/i)).toBeInTheDocument();
  });

  it('renders the Unlayer email editor', async () => {
    await renderEmailContent();
    expect(screen.getByTestId('email-editor')).toBeInTheDocument();
  });

  it('renders Ver Campos button', async () => {
    await renderEmailContent();
    expect(screen.getByText('Ver Campos')).toBeInTheDocument();
  });

  it('renders template selector', async () => {
    await renderEmailContent();
    expect(screen.getByText('Selecionar template')).toBeInTheDocument();
  });

  it('renders inbox preview', async () => {
    await renderEmailContent();
    expect(screen.getByText(/pré-visualização da caixa/i)).toBeInTheDocument();
  });

  it('does not render priority field', async () => {
    await renderEmailContent();
    expect(screen.queryByText(/prioridade/i)).not.toBeInTheDocument();
  });

  it('renders from email and reply-to fields so users without a pool can fill the sender manually', async () => {
    await renderEmailContent();
    expect(screen.getByLabelText(/email do remetente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reply-to/i)).toBeInTheDocument();
  });

  describe('action buttons', () => {
    it('renders import, export, and copy HTML buttons', async () => {
      await renderEmailContent();
      const buttons = screen.getAllByRole('button');
      const importBtn = buttons.find((btn) => btn.querySelector('.lucide-upload'));
      const exportBtn = buttons.find((btn) => btn.querySelector('.lucide-download'));
      const copyBtn = buttons.find((btn) => btn.querySelector('.lucide-clipboard-copy'));
      expect(importBtn).toBeInTheDocument();
      expect(exportBtn).toBeInTheDocument();
      expect(copyBtn).toBeInTheDocument();
    });

    it('does not render view in browser button when no templateUrl', async () => {
      await renderEmailContent();
      const buttons = screen.getAllByRole('button');
      const viewBtn = buttons.find((btn) => btn.querySelector('.lucide-external-link'));
      expect(viewBtn).toBeUndefined();
    });

    it('renders view in browser button when templateUrl is provided', async () => {
      await renderEmailContent({ templateUrl: 'https://storage.example.com/template.html' });
      const buttons = screen.getAllByRole('button');
      const viewBtn = buttons.find((btn) => btn.querySelector('.lucide-external-link'));
      expect(viewBtn).toBeInTheDocument();
    });

    it('import button triggers hidden file input click', async () => {
      await renderEmailContent();
      const fileInput = screen.getByTestId('import-file-input');
      const clickSpy = vi.spyOn(fileInput, 'click');

      const buttons = screen.getAllByRole('button');
      const importBtn = buttons.find((btn) => btn.querySelector('.lucide-upload'))!;
      fireEvent.click(importBtn);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('import loads valid JSON file into editor', async () => {
      await renderEmailContent();
      const fileInput = screen.getByTestId('import-file-input');
      const designJson = JSON.stringify({ body: { rows: [] } });
      const file = new File([designJson], 'design.json', { type: 'application/json' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockLoadDesign).toHaveBeenCalledWith({ body: { rows: [] } });
      });
    });

    it('export calls editor.exportHtml and creates download', async () => {
      mockExportHtml.mockImplementation((cb: (data: { design: object }) => void) => {
        cb({ design: { body: { rows: [] } } });
      });

      await renderEmailContent();

      // Mock URL.createObjectURL and createElement for download
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test');
      const mockRevokeObjectURL = vi.fn();
      URL.createObjectURL = mockCreateObjectURL;
      URL.revokeObjectURL = mockRevokeObjectURL;
      const clickSpy = vi.fn();
      vi.spyOn(document, 'createElement').mockReturnValueOnce({
        href: '',
        download: '',
        click: clickSpy,
      } as unknown as HTMLAnchorElement);

      const buttons = screen.getAllByRole('button');
      const exportBtn = buttons.find((btn) => btn.querySelector('.lucide-download'))!;
      fireEvent.click(exportBtn);

      expect(mockExportHtml).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('copy HTML calls editor.exportHtml and copies to clipboard', async () => {
      mockExportHtml.mockImplementation((cb: (data: { html: string }) => void) => {
        cb({ html: '<h1>Test</h1>' });
      });

      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      await renderEmailContent();

      const buttons = screen.getAllByRole('button');
      const copyBtn = buttons.find((btn) => btn.querySelector('.lucide-clipboard-copy'))!;
      fireEvent.click(copyBtn);

      expect(mockExportHtml).toHaveBeenCalled();
      expect(writeTextMock).toHaveBeenCalledWith('<h1>Test</h1>');
    });

    it('view in browser opens templateUrl in new tab', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      await renderEmailContent({ templateUrl: 'https://storage.example.com/template.html' });

      const buttons = screen.getAllByRole('button');
      const viewBtn = buttons.find((btn) => btn.querySelector('.lucide-external-link'))!;
      fireEvent.click(viewBtn);

      expect(openSpy).toHaveBeenCalledWith('https://storage.example.com/template.html', '_blank');
      openSpy.mockRestore();
    });
  });

  describe('pool selection', () => {
    it('renders pool options from the API', async () => {
      await renderEmailContent();
      expect(screen.getByText('Selecione o remetente')).toBeInTheDocument();
    });
  });

  describe('auto-fill (EVO-1022)', () => {
    it('AC2 — fills sender fields from defaults when mounted with ippool already set (edit flow)', async () => {
      await renderEmailContent({ defaultValues: { ippool: 'default-pool' } });

      await waitFor(() => {
        expect((screen.getByLabelText(/nome do remetente/i) as HTMLInputElement).value).toBe('Sender Name');
      });
      expect((screen.getByLabelText(/email do remetente/i) as HTMLInputElement).value).toBe('sender@test.com');
      expect((screen.getByLabelText(/reply-to/i) as HTMLInputElement).value).toBe('reply@test.com');
    });

    it('AC3 — preserves user-edited fromName when ippool changes programmatically', async () => {
      let formRef: UseFormReturn<EmailFormValues> | null = null;
      await renderEmailContent({
        defaultValues: { ippool: 'default-pool' },
        onForm: (f) => {
          formRef = f;
        },
      });

      await waitFor(() => {
        expect((screen.getByLabelText(/nome do remetente/i) as HTMLInputElement).value).toBe('Sender Name');
      });

      // User overrides fromName manually (marks dirty).
      const fromNameInput = screen.getByLabelText(/nome do remetente/i) as HTMLInputElement;
      await act(async () => {
        fireEvent.input(fromNameInput, { target: { value: 'Marketing Etus' } });
      });
      expect(fromNameInput.value).toBe('Marketing Etus');

      // Programmatic pool change (e.g. deep-link, parent state) — should NOT clobber dirty fromName.
      await act(async () => {
        formRef!.setValue('ippool', 'secondary-pool');
      });

      await waitFor(() => {
        expect((screen.getByLabelText(/email do remetente/i) as HTMLInputElement).value).toBe('other@test.com');
      });
      expect((screen.getByLabelText(/nome do remetente/i) as HTMLInputElement).value).toBe('Marketing Etus');
    });

    it('AC4 — fills sender fields when ippool changes programmatically (deep-link / parent state)', async () => {
      let formRef: UseFormReturn<EmailFormValues> | null = null;
      await renderEmailContent({
        onForm: (f) => {
          formRef = f;
        },
      });

      expect((screen.getByLabelText(/nome do remetente/i) as HTMLInputElement).value).toBe('');

      await act(async () => {
        formRef!.setValue('ippool', 'default-pool');
      });

      await waitFor(() => {
        expect((screen.getByLabelText(/nome do remetente/i) as HTMLInputElement).value).toBe('Sender Name');
      });
      expect((screen.getByLabelText(/email do remetente/i) as HTMLInputElement).value).toBe('sender@test.com');
    });

    it('AC5 — hides the sender selector and skips auto-fill when no pools are available', async () => {
      const mockedHook = vi.mocked(useMessagesModule.usePoolsForSelect);
      const previousImpl = mockedHook.getMockImplementation();
      mockedHook.mockReturnValue({
        data: [],
        isLoading: false,
        isSuccess: true,
      } as ReturnType<typeof useMessagesModule.usePoolsForSelect>);
      try {
        await renderEmailContent();

        expect(screen.queryByText('Remetente')).not.toBeInTheDocument();
        expect((screen.getByLabelText(/nome do remetente/i) as HTMLInputElement).value).toBe('');
      } finally {
        if (previousImpl) mockedHook.mockImplementation(previousImpl);
      }
    });
  });

  describe('content config buttons', () => {
    it('renders Email Condicional button', async () => {
      await renderEmailContent();
      expect(screen.getByText('Email Condicional')).toBeInTheDocument();
    });

    it('renders Gerar Links button', async () => {
      await renderEmailContent();
      expect(screen.getByText('Gerar Links')).toBeInTheDocument();
    });

    it('opens conditional email modal on button click', async () => {
      await renderEmailContent();
      fireEvent.click(screen.getByText('Email Condicional'));
      expect(screen.getByRole('heading', { name: /email condicional/i })).toBeInTheDocument();
    });

    it('opens generate links modal on button click', async () => {
      await renderEmailContent();
      fireEvent.click(screen.getByText('Gerar Links'));
      expect(screen.getByRole('heading', { name: /gerar links/i })).toBeInTheDocument();
    });
  });

  describe('custom HTML textarea', () => {
    it('is hidden for regular users', async () => {
      await renderEmailContent();
      expect(screen.queryByLabelText(/html personalizado/i)).not.toBeInTheDocument();
    });

    it('is visible for super_admin', async () => {
      authenticateStore({ effectiveRole: 'super_admin' });
      await renderEmailContent();
      expect(screen.getByLabelText(/html personalizado/i)).toBeInTheDocument();
    });
  });
});
