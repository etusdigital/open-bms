import { formatDateTime, type DateFormatOptions } from '@/lib/datetime';
import type { Contact, HistoryItem } from './types';

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

export function getEventTime(item: HistoryItem, options?: DateFormatOptions): string {
  return formatDateTime(item.time ?? item.created_at, options);
}

export function getEventLabel(item: HistoryItem): string {
  if (item.type === 'automation') return item.automation_title ?? 'Automation';
  return item.message_title ?? 'Message';
}
