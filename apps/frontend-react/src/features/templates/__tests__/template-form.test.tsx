import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { TemplateForm } from '../template-form';

// Mock react-email-editor since Unlayer can't load in jsdom
vi.mock('react-email-editor', () => ({
  __esModule: true,
  default: vi.fn().mockImplementation(({ onReady }: { onReady?: () => void }) => {
    // Call onReady after render
    if (onReady) setTimeout(onReady, 0);
    return <div data-testid="email-editor">Email Editor Mock</div>;
  }),
}));

const mockSubmit = vi.fn();

async function renderForm(defaultValues?: Parameters<typeof TemplateForm>[0]['defaultValues']) {
  return renderWithRouter(<TemplateForm defaultValues={defaultValues} onSubmit={mockSubmit} isPending={false} />);
}

describe('TemplateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name and description fields', async () => {
    await renderForm();
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/descrição/i)).toBeInTheDocument();
  });

  it('renders the email editor', async () => {
    await renderForm();
    expect(screen.getByTestId('email-editor')).toBeInTheDocument();
  });

  it('shows create button when no default values', async () => {
    await renderForm();
    expect(screen.getByRole('button', { name: /criar/i })).toBeInTheDocument();
  });

  it('shows save button when editing', async () => {
    await renderForm({ name: 'Test', description: '', html_template: '', json_template: '' });
    expect(screen.getByRole('button', { name: /salvar/i })).toBeInTheDocument();
  });

  it('shows character counter for name', async () => {
    await renderForm();
    expect(screen.getByText('0/40')).toBeInTheDocument();
  });

  it('shows character counter for description', async () => {
    await renderForm();
    expect(screen.getByText('0/255')).toBeInTheDocument();
  });

  it('shows validation error when name is empty', async () => {
    await renderForm();

    const submitButton = screen.getByRole('button', { name: /criar/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/obrigatório/i)).toBeInTheDocument();
    });
  });

  it('disables submit button when isPending', async () => {
    await renderWithRouter(<TemplateForm onSubmit={mockSubmit} isPending={true} />);
    const button = screen.getByRole('button', { name: /carregando/i });
    expect(button).toBeDisabled();
  });
});
