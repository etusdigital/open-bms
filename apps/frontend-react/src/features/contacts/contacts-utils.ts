import type { Contact, HistoryItem } from './types';

/**
 * Format a date string using the account's timezone and user's locale.
 * Falls back to browser locale if not provided.
 */
export function formatDateTz(dateStr?: string, options?: { timezone?: string; locale?: string }): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  const tz = options?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const loc = options?.locale || navigator.language;

  return date.toLocaleDateString(loc, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  });
}

/**
 * Format a date string with date + time using account timezone and locale.
 */
export function formatDateTimeTz(dateStr?: string, options?: { timezone?: string; locale?: string }): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  const tz = options?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const loc = options?.locale || navigator.language;

  return date.toLocaleString(loc, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  });
}

/** Simple date format without timezone (for backward compat) */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

export function getContactName(contact: Contact): string {
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : contact.email;
}

export function getStatusInfo(contact: Contact): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (contact.isUnsubscribed) return { label: 'unsubscribed', variant: 'outline' };
  if (contact.hasBounced) return { label: 'bounced', variant: 'destructive' };
  if (contact.isBlocked) return { label: 'blocked', variant: 'outline' };
  if (contact.isActive) return { label: 'active', variant: 'default' };
  return { label: 'inactive', variant: 'outline' };
}

export function getEventTime(item: HistoryItem): string {
  const raw = item.time ?? item.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleString();
}

export function getEventLabel(item: HistoryItem): string {
  if (item.type === 'automation') return item.automation_title ?? 'Automation';
  if (item.type === 'custom_event') return `Event #${item.event_id}`;
  return item.message_title ?? 'Message';
}
