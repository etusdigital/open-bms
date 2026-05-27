import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const LABEL_NAME_MAX = 100;
export const LABEL_DESCRIPTION_MAX = 255;

export const labelFormSchema = z.object({
  name: requiredString(LABEL_NAME_MAX),
  description: optionalString(LABEL_DESCRIPTION_MAX),
});

export type LabelFormValues = z.infer<typeof labelFormSchema>;
