import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const CAMPAIGN_TITLE_MAX = 40;
export const CAMPAIGN_TITLE_MAX_INTERNAL = 25;
export const CAMPAIGN_DESCRIPTION_MAX = 255;

const audienceStepItemSchema = z.object({
  type: z.enum(['tag', 'conditional', 'conditionalCard']),
  tag_id: z.array(z.number()).optional(),
  value: z.enum(['UNION', 'EXCEPT']).optional(),
  isCardCopy: z.boolean().optional(),
  conditional_tag: z.enum(['in', 'not in']).optional(),
  conditional: z.enum(['UNION', 'EXCEPT']).optional(),
  tag_info: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        count: z.number().optional(),
        type: z.string().optional(),
      }),
    )
    .optional(),
});

const campaignMessageSchema = z
  .object({
    id: z.number().optional(),
    title: z.string().optional(),
    subject: z.string().optional(),
    fromName: z.string().optional(),
    fromMail: z.string().optional(),
    content: z.string().optional(),
    messageId: z.number().optional(),
  })
  .passthrough();

const recurrenceSettingsSchema = z.object({
  date: z.string().optional().default(''),
  interval: z.number().min(1).optional().default(1),
  frequency: z.number().nullable().optional().default(null),
  weekDays: z.array(z.number()).optional().default([]),
  hasExpiration: z.boolean().optional().default(false),
  untilDate: z.string().nullable().optional().default(null),
  untilSend: z.number().nullable().optional().default(null),
});

export const campaignFormSchema = z
  .object({
    title: requiredString(CAMPAIGN_TITLE_MAX),
    name: z.string().optional().default(''),
    description: optionalString(CAMPAIGN_DESCRIPTION_MAX),
    type: z.enum(['simple', 'testAB', 'split', 'recurring']).default('simple'),
    // No default: the form picks the default channel from the account's active
    // channels (firstActiveChannel). A hardcoded default would reintroduce the
    // EVO-1410 bug of selecting a disabled 'email' channel.
    messageType: z.enum(['email', 'sms', 'web-push', 'mobile-push', 'whatsapp']),
    sendToAll: z.boolean().default(false),
    sendAfterCreate: z.boolean().default(false),
    runSegment: z.boolean().default(false),
    isRateLimit: z.boolean().default(true),
    scheduleTo: z.string().optional().default(''),
    spreadSending: z.number().optional().default(60),
    steps: z.array(z.array(audienceStepItemSchema)).optional().default([]),
    campaignMessage: z.array(campaignMessageSchema).optional().default([]),
    labels: z
      .array(z.object({ id: z.number(), name: z.string() }))
      .optional()
      .default([]),
    labelContent: z
      .array(z.object({ id: z.number(), name: z.string() }))
      .optional()
      .default([]),
    recurrenceSettings: recurrenceSettingsSchema.optional().default({
      date: '',
      interval: 1,
      frequency: null,
      weekDays: [],
      hasExpiration: false,
      untilDate: null,
      untilSend: null,
    }),
    testabScheduleTo: z.string().optional().default(''),
    testabScheduleEnd: z.string().optional().default(''),
    testabAudiencePercent: z.number().min(5).max(100).optional().default(10),
    testabCriteria: z.enum(['open', 'click']).optional().default('open'),
    testabSentAfterTest: z.boolean().optional().default(true),
    confirmSaveDuplicate: z.boolean().optional().default(false),
    status: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    // Recurring campaigns require frequency
    if (data.type === 'recurring') {
      if (!data.recurrenceSettings?.frequency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'campaigns.recurrenceFrequencyRequired',
          path: ['recurrenceSettings', 'frequency'],
        });
      }
      // Weekly requires at least one weekDay
      if (
        data.recurrenceSettings?.frequency === 2 &&
        (!data.recurrenceSettings.weekDays || data.recurrenceSettings.weekDays.length === 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'campaigns.weekDaysRequired',
          path: ['recurrenceSettings', 'weekDays'],
        });
      }
    }

    // TestAB/Split require at least 2 messages
    if ((data.type === 'testAB' || data.type === 'split') && data.campaignMessage) {
      const validMessages = data.campaignMessage.filter((m) => m.id || m.messageId);
      if (validMessages.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'campaigns.minTwoMessages',
          path: ['campaignMessage'],
        });
      }
    }
  });

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
