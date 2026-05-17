import { z } from 'zod';
import { optionalString } from '@/lib/zod-primitives';

export const senderFormSchema = z.object({
  sendingLimit: optionalString(20),
  senderReplyTo: z.string().email('validation.invalidEmail').or(z.literal('')).default(''),
});

export type SenderFormValues = z.infer<typeof senderFormSchema>;
