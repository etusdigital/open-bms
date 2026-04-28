import { z } from 'zod';

export { parseCsvIds, serializeCsvIds } from '@/features/contacts/contacts-search-schema';

export const statisticsSearchSchema = z.object({
  channel: z.enum(['email', 'web-push']).default('email').catch('email'),
  startDate: z.string().default('').catch(''),
  endDate: z.string().default('').catch(''),
  displayMode: z.enum(['numeric', 'percentage']).default('numeric').catch('numeric'),
  showPerUser: z.boolean().default(false).catch(false),
  sortBy: z.string().default('date').catch('date'),
  sortDesc: z.boolean().default(true).catch(true),
  campaigns: z.string().default('').catch(''),
  automations: z.string().default('').catch(''),
  messages: z.string().default('').catch(''),
  tags: z.string().default('').catch(''),
  segments: z.string().default('').catch(''),
  senders: z.string().default('').catch(''),
  subUsers: z.string().default('').catch(''),
});

export type StatisticsSearchParams = z.infer<typeof statisticsSearchSchema>;
