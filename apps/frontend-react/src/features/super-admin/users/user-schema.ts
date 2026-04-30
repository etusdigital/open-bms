import { z } from 'zod';

const ROLE_CODES = ['super_admin', 'admin', 'editor', 'analyst', 'support', 'billing'] as const;

export const superAdminCreateUserSchema = z
  .object({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    password: z.string().min(10),
    globalRoleCode: z.enum(ROLE_CODES).default('editor'),
    accounts: z.array(
      z.object({
        accountId: z
          .number({ message: 'superAdmin.users.errors.selectAccount' })
          .int({ message: 'superAdmin.users.errors.selectAccount' })
          .positive({ message: 'superAdmin.users.errors.selectAccount' }),
        isMasterUser: z.boolean().default(false),
      }),
    ),
  })
  .refine((data) => data.globalRoleCode === 'super_admin' || data.accounts.length > 0, {
    message: 'superAdmin.users.errors.atLeastOneAccount',
    path: ['accounts'],
  });

export type SuperAdminCreateUserValues = z.infer<typeof superAdminCreateUserSchema>;

export const superAdminEditUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  globalRoleCode: z.enum(ROLE_CODES).default('editor'),
});

export type SuperAdminEditUserValues = z.infer<typeof superAdminEditUserSchema>;
