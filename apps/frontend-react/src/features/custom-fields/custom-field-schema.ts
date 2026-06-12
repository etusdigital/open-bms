import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const CUSTOM_FIELD_TITLE_MAX = 40;
export const CUSTOM_FIELD_DESCRIPTION_MAX = 255;
export const CUSTOM_FIELD_LABEL_MAX = 255;
export const CUSTOM_FIELD_PLACEHOLDER_MAX = 255;
export const CUSTOM_FIELD_MASK_MAX = 255;

export const CUSTOM_FIELD_TYPES = ['text', 'number', 'date', 'list', 'file'] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

// Per-type setting option sets — values must match what the backend stores.
export const NUMBER_FORMATS = ['integer', 'decimal'] as const;
export const DATE_FORMATS = ['date', 'dateHour', 'timeStamp'] as const;
export const LIST_SELECTION_TYPES = ['single', 'multiple'] as const;
export const LIST_RENDER_TYPES = ['dropdown', 'radio', 'checkbox'] as const;
export const FILE_FORMATS = ['pdf', 'csv', 'img'] as const;
export const ATTRIBUTION_TYPES = ['first', 'last', 'multi'] as const;

const maxLen = (max: number) => z.string().max(max, `validation.maxLength::${max}`);

export const customFieldFormSchema = z.object({
  title: requiredString(CUSTOM_FIELD_TITLE_MAX),
  description: optionalString(CUSTOM_FIELD_DESCRIPTION_MAX),
  type: z.enum(CUSTOM_FIELD_TYPES, {
    message: 'validation.required',
  }),
  // Per-type settings. All optional so a field can be saved with just the
  // basics; the form only surfaces the ones relevant to the selected type.
  label: maxLen(CUSTOM_FIELD_LABEL_MAX).optional(),
  placeholder: maxLen(CUSTOM_FIELD_PLACEHOLDER_MAX).optional(),
  mask: maxLen(CUSTOM_FIELD_MASK_MAX).optional(),
  // number/date/list use `fieldFormat` for their format/selection select.
  fieldFormat: z.string().optional(),
  // list render type (dropdown/radio/checkbox).
  fieldType: z.string().optional(),
  fileFormats: z.array(z.string()).optional(),
  characterLimit: z.coerce.number().min(0).optional(),
  decimalLength: z.coerce.number().min(0).optional(),
  options: z.array(z.string()).optional(),
  attributionType: z.enum(ATTRIBUTION_TYPES).optional(),
});

export type CustomFieldFormValues = z.infer<typeof customFieldFormSchema>;
