import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const TEMPLATE_NAME_MAX = 40;
export const TEMPLATE_DESCRIPTION_MAX = 255;

export const templateFormSchema = z.object({
  name: requiredString(TEMPLATE_NAME_MAX),
  description: optionalString(TEMPLATE_DESCRIPTION_MAX),
  html_template: z.string().optional().default(''),
  json_template: z.string().optional().default(''),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;
