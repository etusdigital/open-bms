import { z } from 'zod';
import { optionalString } from '@/lib/zod-primitives';

export const CONTACT_NAME_MAX = 40;
export const CONTACT_EMAIL_MAX = 255;
export const CONTACT_PHONE_MAX = 20;
export const CONTACT_CITY_MAX = 40;
export const CONTACT_REGION_MAX = 40;
export const CONTACT_COUNTRY_MAX = 40;

export const contactEditSchema = z.object({
  firstName: optionalString(CONTACT_NAME_MAX),
  lastName: optionalString(CONTACT_NAME_MAX),
  email: z.string().email('validation.invalidEmail'),
  phone: optionalString(CONTACT_PHONE_MAX),
  city: optionalString(CONTACT_CITY_MAX),
  region: optionalString(CONTACT_REGION_MAX),
  country: optionalString(CONTACT_COUNTRY_MAX),
  isActive: z.boolean().default(true),
});

export type ContactEditValues = z.infer<typeof contactEditSchema>;
