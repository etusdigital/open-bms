import { maskEmail } from '../../utils/masking/email-masker';

// Reading a raw address is the same disclosure as exporting one, so it answers
// to the same permission — `contacts_view` alone keeps seeing the mask. Roles
// that operate the import (super admin, admin) carry it; support and analyst
// roles do not.
export const RAW_EMAIL_PERMISSION = 'audience:contacts_export';

/**
 * Whether this principal may see stored addresses verbatim.
 *
 * Defaults to NO whenever the context is missing (background jobs, internal
 * calls with no principal): a caller we cannot identify does not get the raw
 * address.
 */
export function canReadRawEmail(permissions: unknown, isSuperAdmin: unknown): boolean {
  if (isSuperAdmin === true) return true;
  return Array.isArray(permissions) && permissions.includes(RAW_EMAIL_PERMISSION);
}

/**
 * The address as a given principal is allowed to see it.
 *
 * Contacts imported from Enterprise arrive with a masked placeholder STORED as
 * their address, so masking on read is not idempotent-looking: `maskEmail()` of
 * a reconciled address renders exactly like the placeholder it replaced, which
 * is why a successful reconciliation used to look like a no-op. Privileged
 * callers therefore get the stored value untouched.
 */
export function presentEmail(email: string | null | undefined, canReadRaw: boolean): string {
  if (!email) return email ?? '';
  return canReadRaw ? email : maskEmail(email);
}
