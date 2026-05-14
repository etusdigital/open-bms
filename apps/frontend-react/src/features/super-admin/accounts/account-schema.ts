import { z } from 'zod';

export const superAdminCreateAccountSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional().default(''),
  isInternal: z.boolean().default(false),
  isActive: z.boolean().default(true),
  defaultDomain: z.string().max(500).optional().default(''),
  accountConfigs: z
    .array(
      z.object({
        name: z.string(),
        value: z.any(),
      }),
    )
    .optional()
    .default([]),
});

export type SuperAdminCreateAccountValues = z.infer<typeof superAdminCreateAccountSchema>;

export const channelsSchema = z.object({
  email: z.boolean().default(false),
  sms: z.boolean().default(false),
  webPush: z.boolean().default(false),
  mobilePush: z.boolean().default(false),
  whatsapp: z.boolean().default(false),
});

export type ChannelsValues = z.infer<typeof channelsSchema>;

export const superAdminEditAccountSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional().default(''),
  isInternal: z.boolean().default(false),
  channels: channelsSchema,
});

export type SuperAdminEditAccountValues = z.infer<typeof superAdminEditAccountSchema>;
