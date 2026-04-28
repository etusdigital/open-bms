import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const WARMUP_DESCRIPTION_MAX = 255;

export const warmupFormSchema = z.object({
  accountId: z.number().min(1, 'validation.required'),
  targetAccountId: z.number().min(1, 'validation.required'),
  sender: requiredString(255),
  ippool: requiredString(100),
  replyTo: optionalString(255),
  target: z.number().min(1, 'validation.required'),
  targetSegmentId: z.number().optional(),
  type: z.enum(['internal', 'external']).default('internal'),
  stage: z.number().nullable().default(1),
  description: optionalString(WARMUP_DESCRIPTION_MAX),
});

export type WarmupFormValues = z.infer<typeof warmupFormSchema>;
