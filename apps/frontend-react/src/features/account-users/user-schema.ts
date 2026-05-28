// Adapted from features/super-admin/users — keep in sync until shared module is extracted.
import { z } from 'zod';

// Account-assignable roles: super_admin is intentionally omitted (D4).
export const ACCOUNT_ROLE_CODES = ['admin', 'editor', 'analyst', 'support', 'billing'] as const;
export type AccountRoleCode = (typeof ACCOUNT_ROLE_CODES)[number];

/**
 * Narrows an arbitrary backend role code to a known account-assignable role,
 * returning undefined for anything outside ACCOUNT_ROLE_CODES (e.g. super_admin,
 * or a future role the form can't render) instead of an unsafe cast (F10).
 */
export function toAccountRoleCode(code: string | null | undefined): AccountRoleCode | undefined {
  return (ACCOUNT_ROLE_CODES as readonly string[]).includes(code ?? '') ? (code as AccountRoleCode) : undefined;
}

export const accountUserCreateSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(10),
  roleCode: z.enum(ACCOUNT_ROLE_CODES).default('editor'),
});

export type AccountUserCreateValues = z.infer<typeof accountUserCreateSchema>;

export const accountUserEditSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  roleCode: z.enum(ACCOUNT_ROLE_CODES).default('editor'),
});

export type AccountUserEditValues = z.infer<typeof accountUserEditSchema>;
