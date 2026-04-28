import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/lib/i18n';
import { ProductLinks, ProductTags, MessageChip, MessageStats } from '../products-page';
import type { ProductItem, ProductMessage } from '../types';

// --------------- Fixtures ---------------

function makeProduct(overrides: Partial<ProductItem> = {}): ProductItem {
  return {
    title: 'Test Product',
    link: '',
    messages: [],
    tags: {},
    sendToAll: false,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ProductMessage> = {}): ProductMessage {
  return {
    message_name: 'Welcome Email',
    message_subject: 'Welcome!',
    message_sender: 'no-reply@test.com',
    message_sender_name: 'Test Sender',
    ...overrides,
  };
}

// --------------- ProductLinks ---------------

describe('ProductLinks', () => {
  it('renders single string link', () => {
    render(<ProductLinks link="https://example.com" />);
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('renders multiple links from array', () => {
    render(<ProductLinks link={['https://a.com', 'https://b.com']} />);
    expect(screen.getByText('https://a.com')).toBeInTheDocument();
    expect(screen.getByText('https://b.com')).toBeInTheDocument();
  });

  it('returns null for empty string', () => {
    const { container } = render(<ProductLinks link="" />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for empty array', () => {
    const { container } = render(<ProductLinks link={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

// --------------- ProductTags ---------------

describe('ProductTags', () => {
  it('renders tag names from object-type tags ({ name: "VIP" })', () => {
    const product = makeProduct({
      tags: { '1': { name: 'VIP' }, '2': { name: 'Premium' } },
    });
    render(<ProductTags product={product} />);
    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
  });

  it('renders tag names from primitive-type tags', () => {
    const product = makeProduct({
      tags: { '1': 'simple-tag', '2': 'another' },
    });
    render(<ProductTags product={product} />);
    expect(screen.getByText('simple-tag')).toBeInTheDocument();
    expect(screen.getByText('another')).toBeInTheDocument();
  });

  it('renders sendToAll badge when true', () => {
    const product = makeProduct({ sendToAll: true });
    render(<ProductTags product={product} />);
    expect(screen.getByText('Enviar para todos')).toBeInTheDocument();
  });

  it('returns null when sendToAll=false and tags empty', () => {
    const product = makeProduct({ sendToAll: false, tags: {} });
    const { container } = render(<ProductTags product={product} />);
    expect(container.innerHTML).toBe('');
  });

  it('truncates at 6 tags and shows "+N more"', () => {
    const tags: Record<string, string> = {};
    for (let i = 1; i <= 8; i++) {
      tags[String(i)] = `Tag${i}`;
    }
    const product = makeProduct({ tags });
    render(<ProductTags product={product} />);

    // First 6 visible
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(`Tag${i}`)).toBeInTheDocument();
    }
    // Tags 7 and 8 not visible
    expect(screen.queryByText('Tag7')).not.toBeInTheDocument();
    expect(screen.queryByText('Tag8')).not.toBeInTheDocument();
    // "+2 mais" shown
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
  });
});

// --------------- MessageChip ---------------

describe('MessageChip', () => {
  it('renders message name, subject, sender, sender name', () => {
    const msg = makeMessage();
    render(<MessageChip msg={msg} />);
    expect(screen.getAllByText('Welcome Email').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
    expect(screen.getByText('no-reply@test.com')).toBeInTheDocument();
    expect(screen.getByText('Test Sender')).toBeInTheDocument();
  });

  it('renders trophy emoji when winner is true', () => {
    const msg = makeMessage({ campaign_message_winner: true });
    render(<MessageChip msg={msg} />);
    expect(screen.getByText('🏆')).toBeInTheDocument();
  });

  it('does not render trophy when winner is false', () => {
    const msg = makeMessage({ campaign_message_winner: false });
    render(<MessageChip msg={msg} />);
    expect(screen.queryByText('🏆')).not.toBeInTheDocument();
  });
});

// --------------- MessageStats ---------------

describe('MessageStats', () => {
  it('renders all 5 stat labels with formatted values', () => {
    const stats = {
      delivered: 1000,
      open: 500,
      click: 100,
      bounce: 20,
      unsubscribe: 5,
    };
    render(<MessageStats stats={stats} />);

    // Labels (pt-BR translations)
    expect(screen.getByText('Entregues')).toBeInTheDocument();
    expect(screen.getByText('Aberturas')).toBeInTheDocument();
    expect(screen.getByText('Cliques')).toBeInTheDocument();
    expect(screen.getByText('Bounces')).toBeInTheDocument();
    expect(screen.getByText('Descadastros')).toBeInTheDocument();

    // Values (toLocaleString — format depends on system locale)
    const formatted = (1000).toLocaleString();
    expect(screen.getByText(formatted)).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
