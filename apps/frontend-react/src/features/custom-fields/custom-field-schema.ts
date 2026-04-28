import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const CUSTOM_FIELD_TITLE_MAX = 40;
export const CUSTOM_FIELD_DESCRIPTION_MAX = 255;

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'list', 'file'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const customFieldFormSchema = z.object({
  title: requiredString(CUSTOM_FIELD_TITLE_MAX),
  description: optionalString(CUSTOM_FIELD_DESCRIPTION_MAX),
  type: z.enum(CUSTOM_FIELD_TYPES, {
    message: 'validation.required',
  }),
});

export type CustomFieldFormValues = z.infer<typeof customFieldFormSchema>;
