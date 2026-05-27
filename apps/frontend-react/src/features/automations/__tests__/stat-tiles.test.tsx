// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/lib/i18n';

// Mock the editor context
const mockMessageStats: Record<string, Record<string, number | string>> = {};
vi.mock('../editor/editor-context', () => ({
  useEditorActions: () => ({ messageStats: mockMessageStats }),
}));

import { StatTiles } from '../editor/nodes/stat-tiles';

function setStats(messageId: number, stats: Record<string, number | string>) {
  mockMessageStats[String(messageId)] = stats;
}

function clearStats() {
  for (const key of Object.keys(mockMessageStats)) {
    delete mockMessageStats[key];
  }
}

describe('StatTiles', () => {
  beforeEach(() => {
    clearStats();
  });

  it('returns null when no stats exist for messageId', () => {
    const { container } = render(<StatTiles messageId={999} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when delivered is 0 for email channel', () => {
    setStats(1, { delivered: 0, open: 0, unique_open: 0, click: 0 });
    const { container } = render(<StatTiles messageId={1} />);
    expect(container.innerHTML).toBe('');
  });

  describe('email channel (default)', () => {
    beforeEach(() => {
      setStats(100, {
        delivered: 1000,
        open: 400,
        unique_open: 350,
        click: 100,
      });
    });

    it('renders 4 stat boxes', () => {
      render(<StatTiles messageId={100} />);
      const boxes = document.querySelectorAll('.grid > div');
      expect(boxes).toHaveLength(4);
    });

    it('shows delivered count as absolute number', () => {
      render(<StatTiles messageId={100} />);
      // 1,000 or 1.000 depending on locale
      expect(screen.getByText(/1[,.]000/)).toBeInTheDocument();
    });

    it('calculates open percentage correctly', () => {
      render(<StatTiles messageId={100} />);
      // 400/1000 = 40.0%
      expect(screen.getByText('40.0%')).toBeInTheDocument();
    });

    it('calculates unique open percentage correctly', () => {
      render(<StatTiles messageId={100} />);
      // 350/1000 = 35.0%
      expect(screen.getByText('35.0%')).toBeInTheDocument();
    });

    it('calculates click percentage correctly', () => {
      render(<StatTiles messageId={100} />);
      // 100/1000 = 10.0%
      expect(screen.getByText('10.0%')).toBeInTheDocument();
    });
  });

  describe('push channel', () => {
    beforeEach(() => {
      setStats(200, {
        sent: 500,
        delivered: 400,
        click: 80,
        unique_click: 60,
      });
    });

    it('shows sent/delivered/click/uniqueClick for webPush', () => {
      render(<StatTiles messageId={200} channelType="webPush" />);
      const boxes = document.querySelectorAll('.grid > div');
      expect(boxes).toHaveLength(4);
    });

    it('shows sent/delivered/click/uniqueClick for mobilePush', () => {
      render(<StatTiles messageId={200} channelType="mobilePush" />);
      const boxes = document.querySelectorAll('.grid > div');
      expect(boxes).toHaveLength(4);
    });

    it('calculates delivered percentage from sent', () => {
      render(<StatTiles messageId={200} channelType="webPush" />);
      // 400/500 = 80.0%
      expect(screen.getByText('80.0%')).toBeInTheDocument();
    });

    it('returns null when sent and delivered are both 0', () => {
      setStats(201, { sent: 0, delivered: 0, click: 0, unique_click: 0 });
      const { container } = render(<StatTiles messageId={201} channelType="webPush" />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('handles string values from API', () => {
    it('coerces string values to numbers', () => {
      setStats(300, {
        delivered: '2000',
        open: '600',
        unique_open: '500',
        click: '200',
      });
      render(<StatTiles messageId={300} />);
      // 600/2000 = 30.0%
      expect(screen.getByText('30.0%')).toBeInTheDocument();
    });
  });

  describe('pct edge cases', () => {
    it('returns 0.0 when dividend is 0', () => {
      setStats(400, { delivered: 1000, open: 0, unique_open: 0, click: 0 });
      render(<StatTiles messageId={400} />);
      const zeros = screen.getAllByText('0.0%');
      expect(zeros.length).toBe(3); // open, uniqueOpen, click
    });
  });
});
