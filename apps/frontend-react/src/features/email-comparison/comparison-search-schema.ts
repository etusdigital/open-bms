import { z } from 'zod';

export const comparisonSearchSchema = z.object({
  type: z.enum(['email', 'web-push']).default('email').catch('email'),
  messagesIds: z.string().default('').catch(''),
  metricType: z.string().default('delivered').catch('delivered'),
  displayMode: z.enum(['numeric', 'percentage']).default('numeric').catch('numeric'),
  startDate: z.string().default('').catch(''),
  endDate: z.string().default('').catch(''),
});

export type ComparisonSearchParams = z.infer<typeof comparisonSearchSchema>;
