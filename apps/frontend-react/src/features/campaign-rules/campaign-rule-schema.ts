import { z } from 'zod';
import { requiredString } from '@/lib/zod-primitives';

export const RULE_NAME_MAX = 100;
export const RULE_DESCRIPTION_MAX = 255;

const ruleConfigSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const campaignRuleFormSchema = z.object({
  name: requiredString(RULE_NAME_MAX),
  description: requiredString(RULE_DESCRIPTION_MAX),
  weekDays: z.array(z.number().min(0).max(6)).default([]),
  configs: z.array(ruleConfigSchema).default([]),
});

export type CampaignRuleFormValues = z.infer<typeof campaignRuleFormSchema>;

export const CONFIG_NAME_MAX = 100;
export const CONFIG_DESCRIPTION_MAX = 255;

export const campaignConfigFormSchema = z.object({
  name: requiredString(CONFIG_NAME_MAX),
  description: requiredString(CONFIG_DESCRIPTION_MAX),
  configs: z.record(z.string(), z.unknown()).optional(),
});

export type CampaignConfigFormValues = z.infer<typeof campaignConfigFormSchema>;
