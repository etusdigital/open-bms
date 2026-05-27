import { listSearchSchema } from '@/hooks/use-list-search-params';
import { z } from 'zod';

export const contactStatusOptions = ['all', 'active', 'unsubscribed', 'bounced', 'blocked'] as const;

export type ContactStatusFilter = (typeof contactStatusOptions)[number];

export const contactsSearchSchema = listSearchSchema.extend({
  tags: z.string().default('').catch(''),
  segments: z.string().default('').catch(''),
  status: z.enum(contactStatusOptions).default('all').catch('all'),
  startDate: z.string().default('').catch(''),
  endDate: z.string().default('').catch(''),
});

export type ContactsSearchParams = z.infer<typeof contactsSearchSchema>;

/** Parse a CSV string of IDs into number[] */
export function parseCsvIds(csv: string): number[] {
  if (!csv) return [];
  return csv
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

/** Serialize number[] to CSV string for URL */
export function serializeCsvIds(ids: number[]): string {
  return ids.join(',');
}
