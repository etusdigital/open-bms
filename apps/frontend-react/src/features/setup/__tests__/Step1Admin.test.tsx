// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockAdvance = vi.fn();
const mockLogin = vi.fn();

vi.mock('@/features/setup/setup-gateway', () => ({
  setupGateway: {
    advanceStep: (input: unknown) => mockAdvance(input),
  },
}));

vi.mock('@/features/auth/use-auth', () => ({
  login: (email: string, password: string) => mockLogin(email, password),
}));

import { Step1Admin } from '../steps/Step1Admin';

describe('Step1Admin', () => {
  let onComplete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAdvance.mockReset().mockResolvedValue(undefined);
    mockLogin.mockReset().mockResolvedValue({ id: 1, email: 'a@b.c' });
    onComplete = vi.fn();
  });

  function fill(name: string, email: string, password: string, confirm: string) {
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: name } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } });
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: confirm } });
  }

  it('blocks submit when password is shorter than 8 characters', async () => {
    render(<Step1Admin onComplete={onComplete} />);
    fill('Admin User', 'admin@x.com', 'short', 'short');
    fireEvent.click(screen.getByRole('button', { name: /criar e continuar/i }));

    expect(await screen.findByText(/pelo menos 8 caracteres/i)).toBeInTheDocument();
    expect(mockAdvance).not.toHaveBeenCalled();
  });

  it('blocks submit when passwords do not match', async () => {
    render(<Step1Admin onComplete={onComplete} />);
    fill('Admin User', 'admin@x.com', 'password1', 'password2');
    fireEvent.click(screen.getByRole('button', { name: /criar e continuar/i }));

    expect(await screen.findByText(/não conferem/i)).toBeInTheDocument();
    expect(mockAdvance).not.toHaveBeenCalled();
  });

  it('on success: calls advanceStep(1) then auto-logs in then advances', async () => {
    render(<Step1Admin onComplete={onComplete} />);
    fill('Admin User', 'admin@x.com', 'password1', 'password1');
    fireEvent.click(screen.getByRole('button', { name: /criar e continuar/i }));

    await waitFor(() => {
      expect(mockAdvance).toHaveBeenCalledWith({
        step: 1,
        data: { name: 'Admin User', email: 'admin@x.com', password: 'password1' },
      });
    });
    expect(mockLogin).toHaveBeenCalledWith('admin@x.com', 'password1');
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it('still advances when auto-login fails (best-effort)', async () => {
    mockLogin.mockRejectedValueOnce(new Error('cors blocked'));
    render(<Step1Admin onComplete={onComplete} />);
    fill('Admin User', 'admin@x.com', 'password1', 'password1');
    fireEvent.click(screen.getByRole('button', { name: /criar e continuar/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });
});
