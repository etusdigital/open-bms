import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const CUSTOM_EVENT_NAME_MAX = 40;
export const CUSTOM_EVENT_DESCRIPTION_MAX = 500;

export const customEventFormSchema = z.object({
  name: requiredString(CUSTOM_EVENT_NAME_MAX),
  description: optionalString(CUSTOM_EVENT_DESCRIPTION_MAX),
});

export type CustomEventFormValues = z.infer<typeof customEventFormSchema>;
