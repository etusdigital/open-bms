import { z } from 'zod';
import { format } from 'date-fns';

export const leadsSearchSchema = z.object({
  groupItems: z.string().default('').catch(''),
  startDate: z
    .string()
    .default(() => format(new Date(), 'yyyy-MM-dd'))
    .catch(''),
  endDate: z
    .string()
    .default(() => format(new Date(), 'yyyy-MM-dd'))
    .catch(''),
  search: z.string().default('').catch(''),
  page: z.number().int().positive().default(1).catch(1),
  pageSize: z.number().int().positive().default(10).catch(10),
});

export type LeadsSearchParams = z.infer<typeof leadsSearchSchema>;
