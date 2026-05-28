import { ContactEntity } from './contact.entity';

describe('ContactEntity.normalizePhone', () => {
  it('strips Brazilian mask and prepends DDI 55 for 11-digit mobile', () => {
    expect(ContactEntity.normalizePhone('(31) 99574-3631')).toBe('5531995743631');
  });

  it('strips mask and prepends DDI 55 for 10-digit landline (legacy mobile, no leading 9)', () => {
    expect(ContactEntity.normalizePhone('(11) 3000-3000')).toBe('551130003000');
  });

  it('leaves pre-formatted E.164 alone (12+ digits after stripping)', () => {
    expect(ContactEntity.normalizePhone('+5531995743631')).toBe('5531995743631');
  });

  it('strips spaces and dashes from already-DDI input', () => {
    expect(ContactEntity.normalizePhone('+55 31 99574-3631')).toBe('5531995743631');
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(ContactEntity.normalizePhone(null)).toBe('');
    expect(ContactEntity.normalizePhone(undefined)).toBe('');
    expect(ContactEntity.normalizePhone('')).toBe('');
  });

  it('returns empty string when input has no digits (e.g. accidental "n/a")', () => {
    expect(ContactEntity.normalizePhone('n/a')).toBe('');
  });

  it('leaves a foreign number alone when it already includes a country code (12+ digits)', () => {
    // German E.164 — well beyond the 11-digit BR boundary, no auto-prepend
    expect(ContactEntity.normalizePhone('+49 30 12345678')).toBe('493012345678');
  });

  // Known limitation: a US "+1 NPA NXX XXXX" strips to 11 digits and collides
  // with the BR mobile pattern, so the heuristic wrongly prepends 55. Callers
  // routing US numbers should send pre-normalized E.164 without separators or
  // use a dedicated channel; until that's a real need we accept the collision.
  it('documents the US 11-digit collision (heuristic limitation)', () => {
    expect(ContactEntity.normalizePhone('+1 (415) 555-2671')).toBe('5514155552671');
  });
});

describe('ContactEntity.setUserDetails (phone/whatsapp listener)', () => {
  function makeEntity(overrides: Partial<ContactEntity> = {}): ContactEntity {
    const e = new ContactEntity();
    Object.assign(e, overrides);
    return e;
  }

  it('normalizes phone and mirrors it into whatsapp when whatsapp is empty', () => {
    const e = makeEntity({ phone: '(31) 99574-3631' });
    e.setUserDetails();

    expect(e.phone).toBe('5531995743631');
    expect(e.whatsapp).toBe('5531995743631');
    expect(e.hasPhone).toBe(true);
    expect(e.hasWhatsapp).toBe(true);
  });

  it('honors an explicit whatsapp value (different from phone) and normalizes it without auto-DDI', () => {
    // The whatsapp caller is signaling intent — don't override with phone, but
    // do strip mask. Pre-DDI input is expected from callers that split columns.
    const e = makeEntity({ phone: '+5511 91111-1111', whatsapp: '+55 74 99987-9409' });
    e.setUserDetails();

    expect(e.phone).toBe('5511911111111');
    expect(e.whatsapp).toBe('5574999879409');
  });

  it('sets hasPhone/hasWhatsapp to false when phone is cleared', () => {
    const e = makeEntity({ phone: '' });
    e.setUserDetails();

    expect(e.phone).toBe('');
    expect(e.hasPhone).toBe(false);
    expect(e.hasWhatsapp).toBe(false);
  });

  it('leaves phone/whatsapp untouched on partial updates where phone is not loaded', () => {
    // The listener guards on `phone !== undefined` so a partial update that
    // touches only email doesn't clobber a persisted phone with empty string.
    const e = makeEntity({ email: 'a@b.com' });
    e.setUserDetails();

    expect(e.phone).toBeUndefined();
    expect(e.whatsapp).toBeUndefined();
  });
});
