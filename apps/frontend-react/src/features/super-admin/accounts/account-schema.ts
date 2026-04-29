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

export const superAdminEditAccountSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional().default(''),
  isInternal: z.boolean().default(false),
});

export type SuperAdminEditAccountValues = z.infer<typeof superAdminEditAccountSchema>;
