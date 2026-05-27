import { describe, it, expect } from 'vitest';
import { mapContact, mapContacts } from '../contact-mapper';

describe('mapContact', () => {
  it('maps snake_case API fields to camelCase', () => {
    const raw = {
      id: 1,
      uuid: 'abc-123',
      email: 'john@example.com',
      email_provider: 'Gmail',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+5511999',
      is_active: true,
      is_unsubscribed: false,
      is_valid: true,
      has_bounced: false,
      is_blocked: false,
      has_email: true,
      has_phone: true,
      has_web_push: false,
      has_mobile_push: false,
      has_whatsapp: true,
      last_sent: '2026-01-01T00:00:00Z',
      last_open: '2026-01-02T00:00:00Z',
      last_click: '2026-01-03T00:00:00Z',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-06-01T00:00:00Z',
      city: 'São Paulo',
      region: 'SP',
      country: 'Brazil',
      score: 85,
    };

    const contact = mapContact(raw);

    expect(contact.id).toBe(1);
    expect(contact.uuid).toBe('abc-123');
    expect(contact.email).toBe('john@example.com');
    expect(contact.emailProvider).toBe('Gmail');
    expect(contact.firstName).toBe('John');
    expect(contact.lastName).toBe('Doe');
    expect(contact.phone).toBe('+5511999');
    expect(contact.isActive).toBe(true);
    expect(contact.isUnsubscribed).toBe(false);
    expect(contact.isValid).toBe(true);
    expect(contact.hasBounced).toBe(false);
    expect(contact.isBlocked).toBe(false);
    expect(contact.hasEmail).toBe(true);
    expect(contact.hasPhone).toBe(true);
    expect(contact.hasWebPush).toBe(false);
    expect(contact.hasMobilePush).toBe(false);
    expect(contact.hasWhatsapp).toBe(true);
    expect(contact.lastSent).toBe('2026-01-01T00:00:00Z');
    expect(contact.lastOpen).toBe('2026-01-02T00:00:00Z');
    expect(contact.lastClick).toBe('2026-01-03T00:00:00Z');
    expect(contact.createdAt).toBe('2025-01-01T00:00:00Z');
    expect(contact.updatedAt).toBe('2025-06-01T00:00:00Z');
    expect(contact.city).toBe('São Paulo');
    expect(contact.region).toBe('SP');
    expect(contact.country).toBe('Brazil');
    expect(contact.score).toBe(85);
  });

  it('also accepts camelCase fields (backward compat)', () => {
    const raw = {
      id: 2,
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      isActive: true,
      isValid: true,
      hasEmail: true,
      createdAt: '2025-01-01T00:00:00Z',
    };

    const contact = mapContact(raw);
    expect(contact.firstName).toBe('Jane');
    expect(contact.isActive).toBe(true);
    expect(contact.hasEmail).toBe(true);
    expect(contact.createdAt).toBe('2025-01-01T00:00:00Z');
  });

  it('falls back to contact_id when id is missing', () => {
    const raw = { contact_id: 99, email: 'test@test.com' };
    expect(mapContact(raw).id).toBe(99);
  });

  it('defaults boolean fields to safe values when missing', () => {
    const raw = { id: 1, email: 'test@test.com' };
    const contact = mapContact(raw);

    expect(contact.isActive).toBe(false);
    expect(contact.isUnsubscribed).toBe(false);
    expect(contact.isValid).toBe(true); // defaults to true
    expect(contact.hasBounced).toBe(false);
    expect(contact.isBlocked).toBe(false);
    expect(contact.hasEmail).toBe(false);
  });

  it('defaults email to empty string when missing', () => {
    const raw = { id: 1 };
    expect(mapContact(raw).email).toBe('');
  });

  it('maps per-channel engagement dates', () => {
    const raw = {
      id: 1,
      email: 'test@test.com',
      whatsapp_last_sent: '2026-01-01T00:00:00Z',
      sms_last_click: '2026-01-02T00:00:00Z',
      web_push_last_open: '2026-01-03T00:00:00Z',
    };

    const contact = mapContact(raw);
    expect(contact.whatsappLastSent).toBe('2026-01-01T00:00:00Z');
    expect(contact.smsLastClick).toBe('2026-01-02T00:00:00Z');
    expect(contact.webPushLastOpen).toBe('2026-01-03T00:00:00Z');
  });

  describe('tags mapping', () => {
    it('maps tags from object keyed by ID (API format)', () => {
      const raw = {
        id: 1,
        email: 'test@test.com',
        tags: {
          '953': { id: 953, name: 'vip', type: 'tag' },
          '954': { id: 954, name: 'active-buyer', type: 'tag' },
        },
      };

      const contact = mapContact(raw);
      expect(contact.contactTag).toHaveLength(2);
      expect(contact.contactTag![0]).toEqual({
        id: 953,
        name: 'vip',
        title: undefined,
        type: 'tag',
      });
      expect(contact.contactTag![1]).toEqual({
        id: 954,
        name: 'active-buyer',
        title: undefined,
        type: 'tag',
      });
    });

    it('maps tags from array format', () => {
      const raw = {
        id: 1,
        email: 'test@test.com',
        tags: [
          { id: 1, name: 'tag-a', type: 'tag' },
          { id: 2, name: 'tag-b', type: 'segment' },
        ],
      };

      const contact = mapContact(raw);
      expect(contact.contactTag).toHaveLength(2);
      expect(contact.contactTag![0].name).toBe('tag-a');
      expect(contact.contactTag![1].type).toBe('segment');
    });

    it('maps string tags', () => {
      const raw = {
        id: 1,
        email: 'test@test.com',
        tags: ['vip', 'premium'],
      };

      const contact = mapContact(raw);
      expect(contact.contactTag).toHaveLength(2);
      expect(contact.contactTag![0]).toEqual({ id: 0, name: 'vip' });
    });

    it('returns undefined for null/missing tags', () => {
      expect(mapContact({ id: 1, email: 'a@b.com', tags: null }).contactTag).toBeUndefined();
      expect(mapContact({ id: 1, email: 'a@b.com' }).contactTag).toBeUndefined();
    });

    it('falls back to contact_tag or contactTag fields', () => {
      const raw = { id: 1, email: 'a@b.com', contact_tag: [{ id: 1, name: 'x' }] };
      expect(mapContact(raw).contactTag).toHaveLength(1);

      const raw2 = { id: 1, email: 'a@b.com', contactTag: [{ id: 2, name: 'y' }] };
      expect(mapContact(raw2).contactTag).toHaveLength(1);
    });

    it('uses title as fallback when name is missing', () => {
      const raw = {
        id: 1,
        email: 'a@b.com',
        tags: [{ id: 1, title: 'My Tag' }],
      };
      expect(mapContact(raw).contactTag![0].name).toBe('My Tag');
    });
  });
});

describe('mapContacts', () => {
  it('maps an array of raw contacts', () => {
    const raw = [
      { id: 1, email: 'a@b.com', first_name: 'Alice' },
      { id: 2, email: 'c@d.com', first_name: 'Bob' },
    ];
    const contacts = mapContacts(raw);
    expect(contacts).toHaveLength(2);
    expect(contacts[0].firstName).toBe('Alice');
    expect(contacts[1].firstName).toBe('Bob');
  });

  it('handles empty array', () => {
    expect(mapContacts([])).toEqual([]);
  });
});
