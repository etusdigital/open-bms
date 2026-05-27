import type { Contact, ContactTag } from './types';

/**
 * Maps a snake_case contact object from the API to our camelCase Contact type.
 * The contacts API returns snake_case fields unlike most other endpoints.
 */

export function mapContact(raw: any): Contact {
  return {
    id: raw.id ?? raw.contact_id,
    uuid: raw.uuid,
    email: raw.email ?? '',
    emailProvider: raw.email_provider ?? raw.emailProvider,
    firstName: raw.first_name ?? raw.firstName,
    lastName: raw.last_name ?? raw.lastName,
    phone: raw.phone,

    // Status
    isActive: raw.is_active ?? raw.isActive ?? false,
    isUnsubscribed: raw.is_unsubscribed ?? raw.isUnsubscribed ?? false,
    isValid: raw.is_valid ?? raw.isValid ?? true,
    hasBounced: raw.has_bounced ?? raw.hasBounced ?? false,
    isBlocked: raw.is_blocked ?? raw.isBlocked ?? false,

    // Channels
    hasEmail: raw.has_email ?? raw.hasEmail ?? false,
    hasPhone: raw.has_phone ?? raw.hasPhone ?? false,
    hasWebPush: raw.has_web_push ?? raw.hasWebPush ?? false,
    hasMobilePush: raw.has_mobile_push ?? raw.hasMobilePush ?? false,
    hasWhatsapp: raw.has_whatsapp ?? raw.hasWhatsapp ?? false,

    // Engagement dates (email)
    lastSent: raw.last_sent ?? raw.lastSent,
    lastOpen: raw.last_open ?? raw.lastOpen,
    lastClick: raw.last_click ?? raw.lastClick,

    // Engagement dates (per-channel)
    webPushLastSent: raw.web_push_last_sent ?? raw.webPushLastSent,
    webPushLastOpen: raw.web_push_last_open ?? raw.webPushLastOpen,
    webPushLastClick: raw.web_push_last_click ?? raw.webPushLastClick,
    smsLastSent: raw.sms_last_sent ?? raw.smsLastSent,
    smsLastClick: raw.sms_last_click ?? raw.smsLastClick,
    whatsappLastSent: raw.whatsapp_last_sent ?? raw.whatsappLastSent,
    whatsappLastOpen: raw.whatsapp_last_open ?? raw.whatsappLastOpen,
    whatsappLastClick: raw.whatsapp_last_click ?? raw.whatsappLastClick,
    mobPushLastSent: raw.mob_push_last_sent ?? raw.mobPushLastSent,
    mobPushLastOpen: raw.mob_push_last_open ?? raw.mobPushLastOpen,
    mobPushLastClick: raw.mob_push_last_click ?? raw.mobPushLastClick,

    // Metadata
    customFields: raw.custom_fields ?? raw.customFields,
    contactTag: mapTags(raw.tags ?? raw.contact_tag ?? raw.contactTag),
    score: raw.score,

    // Location
    city: raw.city,
    region: raw.region,
    country: raw.country,

    createdAt: raw.created_at ?? raw.createdAt,
    updatedAt: raw.updated_at ?? raw.updatedAt,
  };
}

function mapTags(tags: unknown): ContactTag[] | undefined {
  if (!tags) return undefined;

  // API returns tags as an object keyed by ID: { "953": { id, name, ... }, "954": { ... } }
  // Convert to array first
  let tagList: unknown[];
  if (Array.isArray(tags)) {
    tagList = tags;
  } else if (typeof tags === 'object') {
    tagList = Object.values(tags);
  } else {
    return undefined;
  }

  return tagList.map((t: any) => {
    if (typeof t === 'string') return { id: 0, name: t };
    return {
      id: t.id,
      name: t.name ?? t.title ?? '',
      title: t.title,
      type: t.type,
    };
  });
}

/**
 * Maps an array of raw contacts from the API.
 */

export function mapContacts(rawList: any[]): Contact[] {
  return rawList.map(mapContact);
}
