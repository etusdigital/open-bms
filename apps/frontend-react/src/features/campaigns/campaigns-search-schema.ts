import { listSearchSchema } from '@/hooks/use-list-search-params';
import { z } from 'zod';

export { parseCsvIds, serializeCsvIds } from '@/features/contacts/contacts-search-schema';

export const campaignsSearchSchema = listSearchSchema.extend({
  status: z.string().default('').catch(''),
  types: z.string().default('').catch(''),
  messages: z.string().default('').catch(''),
  tags: z.string().default('').catch(''),
  segments: z.string().default('').catch(''),
  startDate: z.string().default('').catch(''),
  endDate: z.string().default('').catch(''),
});

export type CampaignsSearchParams = z.infer<typeof campaignsSearchSchema>;

/** Parse a CSV string of strings into string[] */
export function parseCsvStrings(csv: string): string[] {
  if (!csv) return [];
  return csv.split(',').filter(Boolean);
}

/** Serialize string[] to CSV string for URL */
export function serializeCsvStrings(values: string[]): string {
  return values.join(',');
}
