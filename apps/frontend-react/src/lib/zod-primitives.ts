import { z } from 'zod';

/**
 * A required string field with min(1) and max length validation.
 * Error messages use the i18n `::` separator convention.
 */
export function requiredString(maxLength: number) {
  return z.string().min(1, 'validation.required').max(maxLength, `validation.maxLength::${maxLength}`);
}

/**
 * An optional string field with max length validation, defaults to ''.
 * Error messages use the i18n `::` separator convention.
 */
export function optionalString(maxLength: number) {
  return z.string().max(maxLength, `validation.maxLength::${maxLength}`).optional().default('');
}
