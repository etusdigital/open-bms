// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBanner } from '../status-banner';

describe('StatusBanner', () => {
  it('renders nothing when no status', () => {
    const { container } = render(<StatusBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders active banner', () => {
    render(<StatusBanner status="active" />);
    expect(screen.getByText(/active|ativo/i)).toBeInTheDocument();
  });

  it('renders inactive banner', () => {
    render(<StatusBanner status="inactive" />);
    expect(screen.getByText(/inactive|inativo/i)).toBeInTheDocument();
  });

  it('renders processing banner with spinner', () => {
    render(<StatusBanner isProcessing={true} />);
    expect(screen.getByText(/processing|processando/i)).toBeInTheDocument();
  });

  it('processing takes priority over status', () => {
    render(<StatusBanner status="active" isProcessing={true} />);
    expect(screen.getByText(/processing|processando/i)).toBeInTheDocument();
    expect(screen.queryByText(/active|ativo/i)).not.toBeInTheDocument();
  });
});
