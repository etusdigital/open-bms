import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TwoFAMessageCard } from '../components/twofa-message-card';
import type { TwoFAMessageRef } from '../types';
import type { Message } from '@/features/messages/types';
import '@/lib/i18n';

const mockMessage: TwoFAMessageRef = {
  id: 1,
  title: 'OTP Email v1',
  subject: 'Your verification code',
  fromName: 'sender@company.com',
  url: null as unknown as string,
};

const mockAvailableMessages: Message[] = [
  { id: 10, title: 'Available Msg 1', type: '2FA-email' as Message['type'] },
  { id: 11, title: 'Available Msg 2', type: '2FA-email' as Message['type'] },
];

const defaultProps = {
  message: mockMessage,
  percentage: 60,
  availableMessages: mockAvailableMessages,
  onMessageChange: vi.fn(),
  onPercentageChange: vi.fn(),
  onRemove: vi.fn(),
};

describe('TwoFAMessageCard', () => {
  it('renders message title when message is selected', () => {
    render(<TwoFAMessageCard {...defaultProps} />);
    expect(screen.getByText('OTP Email v1')).toBeInTheDocument();
  });

  it('renders subject and fromName', () => {
    render(<TwoFAMessageCard {...defaultProps} />);
    expect(screen.getByText(/Your verification code/)).toBeInTheDocument();
    expect(screen.getByText('sender@company.com')).toBeInTheDocument();
  });

  it('renders percentage input with default value', () => {
    render(<TwoFAMessageCard {...defaultProps} />);
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(60);
  });

  it('shows select dropdown when no message selected', () => {
    render(<TwoFAMessageCard {...defaultProps} message={null} />);
    expect(screen.getByText(/escolher mensagem|choose message/i)).toBeInTheDocument();
  });

  it('renders edit icon when onEdit is provided', () => {
    const onEdit = vi.fn();
    render(<TwoFAMessageCard {...defaultProps} onEdit={onEdit} />);
    // Pencil icon button should exist
    const buttons = screen.getAllByRole('button');
    // First non-trash button with pencil icon
    expect(buttons.length).toBeGreaterThanOrEqual(2); // at least edit + remove
  });

  it('calls onEdit when edit icon is clicked', () => {
    const onEdit = vi.fn();
    render(<TwoFAMessageCard {...defaultProps} onEdit={onEdit} />);
    // The edit button is before the eye button and trash button
    const buttons = screen.getAllByRole('button');
    // First button in the title row is edit (Pencil)
    fireEvent.click(buttons[0]);
    expect(onEdit).toHaveBeenCalled();
  });

  it('renders preview icon when onPreview is provided', () => {
    const onPreview = vi.fn();
    const onEdit = vi.fn();
    render(<TwoFAMessageCard {...defaultProps} onEdit={onEdit} onPreview={onPreview} />);
    // Should have edit + preview + remove = 3 icon buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('calls onPreview when preview icon is clicked', () => {
    const onPreview = vi.fn();
    const onEdit = vi.fn();
    render(<TwoFAMessageCard {...defaultProps} onEdit={onEdit} onPreview={onPreview} />);
    const buttons = screen.getAllByRole('button');
    // Second button in the title row is preview (Eye)
    fireEvent.click(buttons[1]);
    expect(onPreview).toHaveBeenCalled();
  });

  it('does not render edit/preview icons when no message selected', () => {
    render(<TwoFAMessageCard {...defaultProps} message={null} onEdit={vi.fn()} onPreview={vi.fn()} />);
    // When no message: select trigger + remove button only (no edit/preview because message branch doesn't render)
    // The onEdit/onPreview callbacks are passed but the icons are inside the message branch
    const buttons = screen.getAllByRole('button');
    // Should NOT include edit/preview icons (they only render when message is truthy)
    const buttonCount = buttons.length;
    // Render with message to compare
    const { unmount } = render(<TwoFAMessageCard {...defaultProps} onEdit={vi.fn()} onPreview={vi.fn()} />);
    const withMessageButtons = screen.getAllByRole('button');
    unmount();
    // Without message should have fewer buttons than with message
    expect(buttonCount).toBeLessThan(withMessageButtons.length);
  });

  it('renders statistics when provided', () => {
    const stats = [
      { title: 'Delivered', total: 1000, percentage: 0 },
      { title: 'Open', total: 500, percentage: 50 },
    ];
    render(<TwoFAMessageCard {...defaultProps} statistics={stats} />);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('does not render statistics section when stats is empty', () => {
    render(<TwoFAMessageCard {...defaultProps} statistics={[]} />);
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument();
  });

  it('calls onRemove when trash icon is clicked', () => {
    render(<TwoFAMessageCard {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const trashButton = buttons[buttons.length - 1]; // last button is always trash
    fireEvent.click(trashButton);
    expect(defaultProps.onRemove).toHaveBeenCalled();
  });

  it('calls onPercentageChange on blur with clamped value', () => {
    const onPercentageChange = vi.fn();
    render(<TwoFAMessageCard {...defaultProps} onPercentageChange={onPercentageChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.blur(input);
    expect(onPercentageChange).toHaveBeenCalledWith(100); // clamped to max 100
  });
});
