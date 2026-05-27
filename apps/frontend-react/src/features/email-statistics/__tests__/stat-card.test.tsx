import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/lib/i18n';
import { StatCard } from '../components/cards/stat-card';
import { CheckCircle } from 'lucide-react';

const icon = <CheckCircle data-testid="icon" className="h-3.5 w-3.5" />;

describe('StatCard', () => {
  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(<StatCard icon={icon} title="Delivered" color="#0057f4" isLoading />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders count-only card (no percentage)', () => {
    render(<StatCard icon={icon} title="Delivered" count={16026370} color="#0057f4" />);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('16.026.370')).toBeInTheDocument();
  });

  it('renders percentage + count card', () => {
    render(<StatCard icon={icon} title="Open" percentage={34.66} count={5554422} color="#0FB75C" />);
    expect(screen.getByText('34.66%')).toBeInTheDocument();
    expect(screen.getByText('5.554.422')).toBeInTheDocument();
  });

  it('renders percentage-only card (no count)', () => {
    render(<StatCard icon={icon} title="CTOR" percentage={10.89} color="#800080" />);
    expect(screen.getByText('10.89%')).toBeInTheDocument();
  });

  it('applies metric color to percentage text', () => {
    render(<StatCard icon={icon} title="Open" percentage={34.66} count={100} color="#0FB75C" />);
    const percentageEl = screen.getByText('34.66%');
    expect(percentageEl).toHaveStyle({ color: '#0FB75C' });
  });

  it('applies metric color to count text when count-only (no percentage)', () => {
    render(<StatCard icon={icon} title="Delivered" count={1000} color="#0057f4" />);
    const countEl = screen.getByText('1.000');
    expect(countEl).toHaveStyle({ color: '#0057f4' });
  });

  it('does not crash when count is null', () => {
    expect(() => {
      render(<StatCard icon={icon} title="Test" count={null as unknown as number} color="#000" />);
    }).not.toThrow();
  });

  it('does not crash when percentage is null', () => {
    expect(() => {
      render(<StatCard icon={icon} title="Test" percentage={null as unknown as number} color="#000" />);
    }).not.toThrow();
  });

  it('does not crash when count is undefined', () => {
    expect(() => {
      render(<StatCard icon={icon} title="Test" count={undefined} color="#000" />);
    }).not.toThrow();
  });

  it('renders zero percentage correctly', () => {
    render(<StatCard icon={icon} title="Bounce" percentage={0} count={0} color="#ff9654" />);
    expect(screen.getByText('0.00%')).toBeInTheDocument();
  });
});
