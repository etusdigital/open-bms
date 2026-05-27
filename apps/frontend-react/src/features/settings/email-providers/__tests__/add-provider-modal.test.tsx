// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddProviderModal } from '../add-provider-modal';

describe('AddProviderModal', () => {
  it('renders only exposed provider types (SendGrid today)', () => {
    render(<AddProviderModal open onOpenChange={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByTestId('provider-type-sendgrid')).toBeInTheDocument();
    expect(screen.queryByTestId('provider-type-mailersend')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provider-type-sparkpost')).not.toBeInTheDocument();
  });

  it('clicking a type triggers onSelect with the type name', () => {
    const onSelect = vi.fn();
    render(<AddProviderModal open onOpenChange={vi.fn()} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('provider-type-sendgrid'));
    expect(onSelect).toHaveBeenCalledWith('sendgrid');
  });
});
