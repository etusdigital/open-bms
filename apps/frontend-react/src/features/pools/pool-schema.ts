import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const POOL_NAME_MAX = 40;
export const POOL_DESCRIPTION_MAX = 255;

export const poolFormSchema = z.object({
  name: requiredString(POOL_NAME_MAX),
  description: optionalString(POOL_DESCRIPTION_MAX),
  // poolName is optional: SendGrid Free/Essentials accounts have no
  // dedicated IP pools, so the dropdown will be empty and the user
  // can still save a sender pool that uses SendGrid's shared IPs.
  // The send-email worker already handles `ippool` being empty —
  // it just omits `ip_pool_name` from the SendGrid mail payload,
  // which makes SendGrid fall back to the account's default IPs.
  poolName: optionalString(100),
  isDefault: z.boolean().default(false),
  ip: optionalString(1000),
});

export type PoolFormValues = z.infer<typeof poolFormSchema>;
