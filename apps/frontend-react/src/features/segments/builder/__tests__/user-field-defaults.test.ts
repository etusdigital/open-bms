import { describe, it, expect } from 'vitest';
import { defaultOperatorFor } from '../user-field-step';

/**
 * EVO-1463 — `defaultOperatorFor` keeps the saved `conditional_user_field`
 * in sync with the visual default rendered by each *Field component.
 * Mismatches here mean a step saved without the user touching the operator
 * dropdown reaches the segment-query-builder with `undefined` and crashes
 * with `Cannot read properties of undefined (reading 'toLowerCase')`.
 */
describe('defaultOperatorFor (EVO-1463)', () => {
  it('seeds "=" for date entry fields', () => {
    expect(defaultOperatorFor('created_at_date')).toBe('=');
    expect(defaultOperatorFor('last_automation_date')).toBe('=');
  });

  it('seeds "=" for email_provider', () => {
    expect(defaultOperatorFor('email_provider')).toBe('=');
  });

  it('seeds "=" for last_vertical_type', () => {
    expect(defaultOperatorFor('last_vertical_type')).toBe('=');
  });

  it('seeds "true" for communication_channels (HAS_NOT_HAS_OPERATORS)', () => {
    expect(defaultOperatorFor('communication_channels')).toBe('true');
  });

  it('seeds "true" for is_email_deliverable (YES_NO_OPERATORS)', () => {
    expect(defaultOperatorFor('is_email_deliverable')).toBe('true');
  });

  it('returns null for unknown field keys (no enforced default)', () => {
    expect(defaultOperatorFor('')).toBe(null);
    expect(defaultOperatorFor('something_new')).toBe(null);
  });
});
