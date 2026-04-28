import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const TRIGGER_TITLE_MAX = 40;
export const TRIGGER_DESCRIPTION_MAX = 255;

/** Shape of a selected message for the trigger campaign form */
export const triggerMessageSchema = z.object({
  id: z.number(),
  title: z.string(),
  subject: z.string().optional().default(''),
  name: z.string().optional().default(''),
  links: z.array(z.string()).optional().default([]),
});

export type TriggerMessage = z.infer<typeof triggerMessageSchema>;

export const triggerCampaignFormSchema = z.object({
  title: requiredString(TRIGGER_TITLE_MAX),
  description: optionalString(TRIGGER_DESCRIPTION_MAX),
  messageType: z.enum(['email', 'sms', 'web-push', 'mobile-push', 'whatsapp']).default('email'),

  // Step 1: Messages (1-10 messages, at least 1 required)
  messages: z.array(triggerMessageSchema).min(1, 'Selecione pelo menos uma mensagem').max(10),

  // Step 2: Who — trigger config
  triggerType: z.enum(['events', 'custom_events']).default('events'),
  eventType: z.string().optional().default('open'),
  customEvent: z.object({ id: z.number(), name: z.string() }).optional(),
  triggerMessageId: z.number().optional(),
  triggerMessageTitle: z.string().optional(),
  frequency: z.enum(['unique', 'multiply-period', 'multiply']).default('unique'),
  timePeriodValue: z.number().optional().default(1),
  timePeriodUnit: z.enum(['days', 'hours', 'minutes']).default('days'),

  // Step 3: When — send timing
  sendTiming: z.enum(['immediate', 'wait']).default('immediate'),
  waitValue: z.number().optional().default(0),
  waitUnit: z.enum(['hours', 'minutes']).default('hours'),
});

export type TriggerCampaignFormValues = z.infer<typeof triggerCampaignFormSchema>;
