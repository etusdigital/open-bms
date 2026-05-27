import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const TAG_NAME_MAX = 40;
export const TAG_DESCRIPTION_MAX = 500;

export const tagFormSchema = z.object({
  name: requiredString(TAG_NAME_MAX),
  description: optionalString(TAG_DESCRIPTION_MAX),
});

export type TagFormValues = z.infer<typeof tagFormSchema>;
