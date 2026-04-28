import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsCell } from '../components/table/stats-cell';

describe('StatsCell', () => {
  it('renders percentage and count', () => {
    render(<StatsCell rate={34.66} count={5554422} color="#0FB75C" />);
    expect(screen.getByText('34.66%')).toBeInTheDocument();
    expect(screen.getByText('5.554.422')).toBeInTheDocument();
  });

  it('renders percentage-only (no count)', () => {
    render(<StatsCell rate={10.89} color="#800080" />);
    expect(screen.getByText('10.89%')).toBeInTheDocument();
  });

  it('applies color to percentage text', () => {
    render(<StatsCell rate={50} count={100} color="#00cefc" />);
    const el = screen.getByText('50.00%');
    expect(el).toHaveStyle({ color: '#00cefc' });
  });

  it('renders progress bar with correct width', () => {
    const { container } = render(<StatsCell rate={75} color="#0FB75C" />);
    const fill = container.querySelector('.rounded-full:not(.bg-muted)');
    expect(fill).toHaveStyle({ width: '75%' });
  });

  it('caps progress bar at 100% for rates > 100', () => {
    const { container } = render(<StatsCell rate={150} color="#0FB75C" />);
    const fill = container.querySelector('.rounded-full:not(.bg-muted)');
    expect(fill).toHaveStyle({ width: '100%' });
  });

  it('renders zero rate correctly', () => {
    render(<StatsCell rate={0} count={0} color="#f06158" />);
    expect(screen.getByText('0.00%')).toBeInTheDocument();
  });

  it('does not crash with undefined count', () => {
    expect(() => {
      render(<StatsCell rate={5} count={undefined} color="#000" />);
    }).not.toThrow();
  });
});
