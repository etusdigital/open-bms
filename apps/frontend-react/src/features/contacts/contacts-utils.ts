import { formatDateTime, type DateFormatOptions } from '@/lib/datetime';
import type { TFunction } from 'i18next';
import type { Contact, HistoryItem, TriggerCondition } from './types';

export function getContactName(contact: Contact): string {
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : contact.email;
}

export function getStatusInfo(contact: Contact): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (contact.isUnsubscribed) return { label: 'unsubscribed', variant: 'outline' };
  if (contact.hasBounced) return { label: 'bounced', variant: 'destructive' };
  if (contact.isBlocked) return { label: 'blocked', variant: 'outline' };
  if (contact.isActive) return { label: 'active', variant: 'default' };
  return { label: 'inactive', variant: 'outline' };
}

export function getEventTime(item: HistoryItem, options?: DateFormatOptions): string {
  return formatDateTime(item.time ?? item.created_at, options);
}

export function getEventLabel(item: HistoryItem): string {
  if (item.type === 'automation') return item.automation_title ?? 'Automation';
  return item.message_title ?? 'Message';
}

/**
 * Translates the secondary event badge that sits next to the row's type
 * badge. Translation rules differ by row type:
 *
 *   - `automation` rows: the badge value is the lifecycle event
 *     (started/completed/canceled/etc.) OR — for `event === 'step'` rows
 *     — the `properties.stepType` (email/conditional/wait/etc.). Both
 *     have their own translation namespace.
 *   - `message` rows: the badge value is the channel event
 *     (open/click/delivered/etc.).
 *
 * Unknown values fall through to the raw event/stepType string so a
 * producer change can't blank out the badge.
 */
export function formatBadgeEvent(item: HistoryItem, t: TFunction): string {
  const event = item.event ?? '';
  if (!event) return '';

  if (item.type === 'automation' && event === 'step' && item.properties?.stepType) {
    const stepType = String(item.properties.stepType);
    return t([`contacts.stepType_${stepType}`, stepType]);
  }

  if (item.type === 'automation') {
    return t([`contacts.automationEvent_${event}`, event]);
  }

  if (item.type === 'message') {
    return t([`contacts.channelEvent_${event}`, event]);
  }

  return event;
}

/** Translates the channel-type badge (email / whatsapp / web-push / …). */
export function formatBadgeChannel(messageType: string | undefined, t: TFunction): string {
  if (!messageType) return '';
  return t([`contacts.channelType_${messageType}`, messageType]);
}

// Per-field helpers shared by pageview-style and click detail blocks.
// Each returns the `{label, value}` row or null when the row has no data
// — the caller filters out nulls.
//
// Read order is "top-level first, properties second" because the tracker
// SDK populates both inconsistently. CH columns are authoritative when
// present; properties is the fallback (and for utm_source/utm_medium the
// only source, since they're not promoted to top-level columns).
function urlRow(item: HistoryItem, t: TFunction): { label: string; value: string } | null {
  const props = item.properties ?? {};
  const url = item.url || (typeof props.url === 'string' ? props.url : undefined);
  return url ? { label: t('contacts.pageviewUrl'), value: url } : null;
}

function utmRow(item: HistoryItem, t: TFunction): { label: string; value: string } | null {
  const props = item.properties ?? {};
  const utmSource = typeof props.utm_source === 'string' ? props.utm_source : undefined;
  const utmMedium = typeof props.utm_medium === 'string' ? props.utm_medium : undefined;
  const utmCampaign = item.utm_campaign || (typeof props.utm_campaign === 'string' ? props.utm_campaign : undefined);
  const parts = [utmSource, utmMedium, utmCampaign].filter(Boolean) as string[];
  return parts.length ? { label: t('contacts.pageviewUtm'), value: parts.join(' / ') } : null;
}

function deviceRow(item: HistoryItem, t: TFunction): { label: string; value: string } | null {
  if (typeof item.is_mobile !== 'boolean') return null;
  return {
    label: t('contacts.pageviewDevice'),
    value: item.is_mobile ? t('contacts.pageviewDeviceMobile') : t('contacts.pageviewDeviceDesktop'),
  };
}

function locationRow(item: HistoryItem, t: TFunction): { label: string; value: string } | null {
  const parts = [item.city, item.region, item.country].filter(Boolean) as string[];
  return parts.length ? { label: t('contacts.pageviewLocation'), value: parts.join(', ') } : null;
}

/**
 * Pageview-style detail rows: URL · UTM · Device · Location.
 * Empty array when none of the fields are present.
 */
export function getPageviewDetails(item: HistoryItem, t: TFunction): { label: string; value: string }[] {
  return [urlRow(item, t), utmRow(item, t), deviceRow(item, t), locationRow(item, t)].filter(
    (row): row is { label: string; value: string } => row !== null,
  );
}

/**
 * Click channel event detail rows: URL (the link the contact clicked) ·
 * Device · Location. UTM is intentionally omitted — link tracking params
 * live in the URL query string for click events, so showing them
 * separately would just be noise.
 */
export function getClickDetails(item: HistoryItem, t: TFunction): { label: string; value: string }[] {
  return [urlRow(item, t), deviceRow(item, t), locationRow(item, t)].filter(
    (row): row is { label: string; value: string } => row !== null,
  );
}

/**
 * Render one entry of an automation trigger's configured filter into a short
 * human-readable string. Used by the contact-history card under
 * `automation-trigger-filtered-out` events to show *why* a contact didn't
 * enter the automation.
 *
 * We don't re-evaluate the condition here — we only describe how it was
 * configured. The producer (`tag-process/automation.handler.ts`) ships the
 * raw structured config; we translate the per-type known shape and fall back
 * to a compact "type: ..." stamp for anything unrecognized so a producer
 * change can't crash the UI.
 */
export function formatTriggerCondition(c: TriggerCondition, t: TFunction): string {
  switch (c.type) {
    case 'user_field': {
      const field = c.user_field_key
        ? t(`contacts.triggerConditionUserField_${c.user_field_key}`, { defaultValue: String(c.user_field_key) })
        : t('contacts.triggerConditionUserFieldGeneric');
      const op = c.conditional_user_field ?? '=';
      return `${field} ${op} ${formatConditionValue(c.user_field_value)}`;
    }
    case 'tag': {
      const ids = Array.isArray(c.tag_id) ? c.tag_id.join(', ') : String(c.tag_id ?? '');
      return t(
        c.conditional_tag === 'not in' ? 'contacts.triggerConditionTagNotIn' : 'contacts.triggerConditionTagIn',
        { ids },
      );
    }
    case 'custom_field': {
      const op = c.conditional_custom_field ?? '=';
      return `${t('contacts.triggerConditionCustomField', { id: c.custom_field_id })} ${op} ${formatConditionValue(c.custom_field_value)}`;
    }
    case 'interation': {
      const event = typeof c.event === 'string' ? c.event : (c.event?.name ?? '');
      return t(
        c.conditional_interation === 'no'
          ? 'contacts.triggerConditionInterationNo'
          : 'contacts.triggerConditionInterationYes',
        { event, time: c.time ?? '' },
      );
    }
    case 'automation': {
      const ids = (c.user_field_automation ?? []).map((a) => a.title ?? `#${a.id}`).join(', ');
      return t('contacts.triggerConditionAutomation', { automations: ids });
    }
    case 'custom_event': {
      const event = typeof c.event === 'string' ? c.event : (c.event?.name ?? '');
      return t('contacts.triggerConditionCustomEvent', { event });
    }
    case 'lead': {
      return t('contacts.triggerConditionLead');
    }
    default:
      return t('contacts.triggerConditionUnknown', { type: (c as { type: string }).type });
  }
}

function formatConditionValue(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

/**
 * Render the per-step details for an automation step event
 * (`event === 'step'`). One short translated line per known `stepType`,
 * plus a generic stamp for any unrecognized type so producer drift can't
 * break the timeline.
 *
 * Returns `null` when there's nothing useful to render (unknown stepType
 * with no payload, or a stepType that's already self-explanatory through
 * the badge alone, like `end`). The caller renders nothing in that case.
 *
 * For the `conditional` stepType we DO NOT call this for the
 * `properties.conditions` list — the card uses `formatTriggerCondition`
 * directly for that, the same way it renders trigger-filter conditions.
 * This function only returns the *outcome* line ("Took TRUE branch" /
 * "Took FALSE branch"). Keeps the two responsibilities apart.
 */
export function formatStepDetails(props: NonNullable<HistoryItem['properties']>, t: TFunction): string | null {
  const stepType = props.stepType;
  if (!stepType) return null;

  switch (stepType) {
    case 'conditional':
      return t(props.resultLogic ? 'contacts.stepDetailsConditionalTrue' : 'contacts.stepDetailsConditionalFalse');

    case 'addTag':
    case 'removeTag': {
      const names = parseTagNames(props.tags);
      const key = stepType === 'addTag' ? 'contacts.stepDetailsAddTag' : 'contacts.stepDetailsRemoveTag';
      return names.length ? t(key, { names: names.join(', ') }) : t(key, { names: '—' });
    }

    case 'wait': {
      const minutes = Number(props.minutes ?? props.timer ?? 0);
      if (!minutes) return t('contacts.stepDetailsWaitGeneric');
      if (minutes >= 60 && minutes % 60 === 0) {
        return t('contacts.stepDetailsWaitHours', { count: minutes / 60 });
      }
      return t('contacts.stepDetailsWaitMinutes', { count: minutes });
    }

    case 'split': {
      const pct = Number(props.randomPercentage);
      if (!Number.isFinite(pct)) return t('contacts.stepDetailsSplitGeneric');
      return t('contacts.stepDetailsSplit', { percentage: pct });
    }

    case 'randomMessage':
    case 'randomWebPush':
    case 'randomMobilePush':
    case 'testAB': {
      const messageId = Number(props.messageId);
      const messageTitle = typeof props.messageTitle === 'string' ? props.messageTitle : null;
      if (Number.isFinite(messageId) && messageId > 0) {
        return messageTitle
          ? t('contacts.stepDetailsRandomWithTitle', { id: messageId, title: messageTitle })
          : t('contacts.stepDetailsRandom', { id: messageId });
      }
      // Pre-fix events shipped only `randomIndex` (no id). Fall back to the
      // 1-based index so the timeline still renders something useful.
      const idx = Number(props.randomIndex);
      if (Number.isFinite(idx)) return t('contacts.stepDetailsRandomIndex', { index: idx + 1 });
      return t('contacts.stepDetailsRandomGeneric');
    }

    case 'email':
    case 'webPush':
    case 'mobilePush':
    case 'sms':
    case 'whatsapp': {
      const messageId = Number(props.messageId);
      if (!Number.isFinite(messageId) || messageId <= 0) return null;
      const messageTitle = typeof props.messageTitle === 'string' ? props.messageTitle : null;
      return messageTitle
        ? t('contacts.stepDetailsMessageWithTitle', { id: messageId, title: messageTitle })
        : t('contacts.stepDetailsMessage', { id: messageId });
    }

    case 'conditionalTime':
      return t('contacts.stepDetailsConditionalTime');

    case 'end':
      // 'end' is already implied by the surrounding "Completed" lifecycle event.
      // Suppress the redundant subline.
      return null;

    default:
      return t('contacts.stepDetailsUnknown', { stepType });
  }
}

function parseTagNames(tags: unknown): string[] {
  if (typeof tags !== 'string' || !tags) return [];
  try {
    const parsed = JSON.parse(tags) as Array<{ name?: string; title?: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => t?.name ?? t?.title ?? '').filter(Boolean);
  } catch {
    return [];
  }
}
