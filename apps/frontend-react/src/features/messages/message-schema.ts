import { z } from 'zod';
import { requiredString, optionalString } from '@/lib/zod-primitives';

export const MESSAGE_TITLE_MAX = 40;
export const MESSAGE_DESCRIPTION_MAX = 255;
export const MESSAGE_SUBJECT_MAX = 200;
export const MESSAGE_CONTENT_MAX = 5000;
export const MESSAGE_URL_MAX = 500;

const baseFields = {
  title: requiredString(MESSAGE_TITLE_MAX),
  description: optionalString(MESSAGE_DESCRIPTION_MAX),
};

export const smsFormSchema = z.object({
  ...baseFields,
  content: requiredString(MESSAGE_CONTENT_MAX),
});

export const PUSH_TITLE_MAX = 60;

export const webPushFormSchema = z.object({
  ...baseFields,
  subject: requiredString(PUSH_TITLE_MAX),
  content: requiredString(MESSAGE_CONTENT_MAX),
  url: optionalString(MESSAGE_URL_MAX),
  image: z.string().optional().default(''),
  expiryPushEnabled: z.boolean().optional().default(false),
  expiryPushValue: z.coerce.number().optional(),
  expiryPushFilter: z.enum(['day', 'hour']).optional().default('day'),
});

export const mobilePushFormSchema = z.object({
  ...baseFields,
  subject: requiredString(PUSH_TITLE_MAX),
  content: requiredString(MESSAGE_CONTENT_MAX),
  url: optionalString(MESSAGE_URL_MAX),
  image: z.string().optional().default(''),
  notificationSound: z.string().optional().default('default'),
  expiryPushEnabled: z.boolean().optional().default(false),
  expiryPushValue: z.coerce.number().optional(),
  expiryPushFilter: z.enum(['day', 'hour']).optional().default('day'),
});

export const MESSAGE_FROM_NAME_MIN = 4;
export const MESSAGE_SUBJECT_MIN = 3;

export const emailFormSchema = z.object({
  ...baseFields,
  ippool: optionalString(100),
  fromName: z.string().min(MESSAGE_FROM_NAME_MIN, 'validation.required').max(100, 'validation.maxLength::100'),
  fromMail: z.string().min(1, 'validation.required').email('validation.email'),
  replyTo: z
    .string()
    .max(MESSAGE_URL_MAX, `validation.maxLength::${MESSAGE_URL_MAX}`)
    .email('validation.email')
    .optional()
    .or(z.literal('')),
  subject: z
    .string()
    .min(MESSAGE_SUBJECT_MIN, 'validation.required')
    .max(MESSAGE_SUBJECT_MAX, `validation.maxLength::${MESSAGE_SUBJECT_MAX}`),
  previewText: optionalString(MESSAGE_DESCRIPTION_MAX),
  priority: z.enum(['low', 'normal', 'high']).default('high'),
  content: z.string().optional().default(''),
  content_json: z.string().optional().default(''),
});

export const whatsappFormSchema = z
  .object({
    ...baseFields,
    headerType: z.enum(['none', 'text', 'image', 'video']).optional().default('none'),
    headerContent: z.string().optional().default(''),
    content: requiredString(MESSAGE_CONTENT_MAX),
    footer: optionalString(MESSAGE_DESCRIPTION_MAX),
    whatsappType: z.enum(['text', 'call-to-action']).optional().default('text'),
    callToActionText: optionalString(100),
    callToActionUrl: optionalString(MESSAGE_URL_MAX),
  })
  .superRefine((data, ctx) => {
    if (data.headerType === 'text' && data.headerContent && data.headerContent.length > MESSAGE_CONTENT_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: MESSAGE_CONTENT_MAX,
        origin: 'string',
        inclusive: true,
        path: ['headerContent'],
        message: `validation.maxLength::${MESSAGE_CONTENT_MAX}`,
      });
    }
  })
  .transform((data) => {
    if (data.whatsappType !== 'call-to-action') {
      const { callToActionText: _callToActionText, callToActionUrl: _callToActionUrl, ...rest } = data;
      return rest;
    }
    return data;
  });

export type SmsFormValues = z.infer<typeof smsFormSchema>;
export type WebPushFormValues = z.infer<typeof webPushFormSchema>;
export type MobilePushFormValues = z.infer<typeof mobilePushFormSchema>;
export type EmailFormValues = z.infer<typeof emailFormSchema>;
export type WhatsAppFormValues = z.infer<typeof whatsappFormSchema>;

export type MessageFormValues =
  | SmsFormValues
  | WebPushFormValues
  | MobilePushFormValues
  | EmailFormValues
  | WhatsAppFormValues;

export const messageSchemas = {
  sms: smsFormSchema,
  'web-push': webPushFormSchema,
  'mobile-push': mobilePushFormSchema,
  email: emailFormSchema,
  whatsapp: whatsappFormSchema,
} as const;
