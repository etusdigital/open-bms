import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const SEGMENT_NAME_MAX = 40;
export const SEGMENT_DESCRIPTION_MAX = 500;

export const segmentFormSchema = z.object({
  name: requiredString(SEGMENT_NAME_MAX),
  description: optionalString(SEGMENT_DESCRIPTION_MAX),
  contactsLimit: z.number().min(0).nullable().optional().default(null),
  recurrence: z.number().min(0).optional().default(24),
  addBounced: z.boolean().default(false),
  addUnsubscribed: z.boolean().default(false),
  addInvalid: z.boolean().default(false),
  isRealTimeSegment: z.boolean().default(false),
  isClickhouseSegment: z.boolean().default(false),
  steps: z.any().optional().default([]),
});

export type SegmentFormValues = z.infer<typeof segmentFormSchema>;
