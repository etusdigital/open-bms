// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/lib/i18n';
import { FirstTimeWizard } from '../first-time-wizard';

describe('FirstTimeWizard', () => {
  beforeEach(() => {
    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders 4 radio options + "Próximo" and "Pular wizard" buttons', () => {
    render(<FirstTimeWizard open onSelect={vi.fn()} onSkip={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Próximo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pular wizard/i })).toBeInTheDocument();
  });

  it('MailerSend is selected by default and clicking "Próximo →" fires onSelect("mailersend")', () => {
    const onSelect = vi.fn();
    render(<FirstTimeWizard open onSelect={onSelect} onSkip={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Próximo/i }));
    expect(onSelect).toHaveBeenCalledWith('mailersend');
  });

  it('changing selection to SparkPost and clicking "Próximo →" fires onSelect("sparkpost")', () => {
    const onSelect = vi.fn();
    render(<FirstTimeWizard open onSelect={onSelect} onSkip={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole('button', { name: /Próximo/i }));
    expect(onSelect).toHaveBeenCalledWith('sparkpost');
  });

  it('clicking "Pular wizard" fires onSkip', () => {
    const onSkip = vi.fn();
    render(<FirstTimeWizard open onSelect={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: /Pular wizard/i }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('does not render when open=false', () => {
    render(<FirstTimeWizard open={false} onSelect={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryByTestId('first-time-wizard')).not.toBeInTheDocument();
  });
});
