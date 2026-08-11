import { RAW_EMAIL_PERMISSION, canReadRawEmail, presentEmail } from '../email-visibility.util';

/**
 * Permission boundary of contact addresses. Reading one raw discloses exactly
 * what exporting one does, so it answers to the export permission — plain
 * contacts_view keeps seeing the mask.
 */
describe('canReadRawEmail', () => {
  it('allows a principal holding the export permission', () => {
    expect(canReadRawEmail([RAW_EMAIL_PERMISSION, 'audience:contacts_view'], false)).toBe(true);
  });

  it('allows a super admin regardless of the permission list', () => {
    expect(canReadRawEmail([], true)).toBe(true);
  });

  it('denies a principal that can only view contacts', () => {
    expect(canReadRawEmail(['audience:contacts_view', 'audience:contacts_edit'], false)).toBe(false);
  });

  it('denies when there is no principal context at all', () => {
    // Background jobs and internal calls: a caller we cannot identify does not
    // get the raw address.
    expect(canReadRawEmail(undefined, undefined)).toBe(false);
    expect(canReadRawEmail(null, null)).toBe(false);
  });
});

describe('presentEmail', () => {
  it('returns the stored address untouched to a privileged caller', () => {
    expect(presentEmail('lucassilva@gmail.com', true)).toBe('lucassilva@gmail.com');
  });

  it('masks it for everyone else', () => {
    expect(presentEmail('lucassilva@gmail.com', false)).toBe('lucas***@gmail.com');
  });

  it('leaves an imported placeholder looking the same either way', () => {
    // The mask of a masked value is itself — which is exactly why re-masking on
    // read made a successful reconciliation look like a no-op.
    expect(presentEmail('lucas***@gmail.com', false)).toBe('lucas***@gmail.com');
  });

  it('handles a missing address without emitting "undefined"', () => {
    expect(presentEmail(null, false)).toBe('');
    expect(presentEmail(undefined, true)).toBe('');
  });
});
