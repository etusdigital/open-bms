import { z } from 'zod';

export const senderFormSchema = z.object({
  senderReplyTo: z.string().email('validation.invalidEmail').or(z.literal('')).default(''),
});

export type SenderFormValues = z.infer<typeof senderFormSchema>;
