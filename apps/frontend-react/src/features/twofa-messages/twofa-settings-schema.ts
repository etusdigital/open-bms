import { z } from 'zod';

const twoFAMessageRefSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  subject: z.string().nullish(),
  fromName: z.string().nullish(),
  url: z.string().nullish(),
});

const twoFAGroupConfigSchema = z.object({
  message: twoFAMessageRefSchema,
  percentage: z.number().min(0).max(100),
});

// Accepts both current format (array) and legacy format (single object) — normalizes to array
const groupEntrySchema = z
  .union([z.array(twoFAGroupConfigSchema), twoFAMessageRefSchema])
  .transform((val) => (Array.isArray(val) ? val : [{ message: val, percentage: 100 }]));

const channelGroupsSchema = z.record(z.string(), groupEntrySchema).optional().default({});

export const twoFASettingsSchema = z.object({
  email: channelGroupsSchema,
  sms: channelGroupsSchema,
  whatsapp: channelGroupsSchema,
});

export type ParsedTwoFASettings = z.infer<typeof twoFASettingsSchema>;

export const groupNameSchema = z
  .string()
  .min(1, 'Group name is required')
  .max(64)
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/,
    'Group name can only contain letters, numbers, spaces, hyphens, and underscores',
  );

/** Validates that percentages sum to 100 and messages are unique */
export function validateGroupConfigs(configs: { message: { id: number }; percentage: number }[]): {
  valid: boolean;
  error?: string;
  total: number;
} {
  if (configs.length === 0) {
    return { valid: false, error: 'At least one message is required', total: 0 };
  }

  const total = configs.reduce((sum, c) => sum + (c.percentage || 0), 0);
  if (total !== 100) {
    return { valid: false, error: `Percentages must sum to 100% (current: ${total}%)`, total };
  }

  const ids = configs.map((c) => c.message.id);
  if (ids.length !== new Set(ids).size) {
    return { valid: false, error: 'Each message can only appear once per group', total };
  }

  if (configs.some((c) => !c.message.id || c.percentage <= 0)) {
    return { valid: false, error: 'All slots must have a message and percentage > 0', total };
  }

  return { valid: true, total };
}
