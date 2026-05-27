export interface Filters {
  contact: string;
  after: string;
  before: string;
  accounts: string[];
  events: string[];
  providers: string[];
  campaigns: string[];
  automations: string[];
}

export const EMPTY_FILTERS: Filters = {
  contact: '',
  after: '',
  before: '',
  accounts: [],
  events: [],
  providers: [],
  campaigns: [],
  automations: [],
};

export function parseQ(q: string): Filters {
  const f: Filters = {
    contact: '',
    after: '',
    before: '',
    accounts: [],
    events: [],
    providers: [],
    campaigns: [],
    automations: [],
  };
  const trimmed = q.trim();
  if (!trimmed) return f;
  for (const part of trimmed.split(/\s+/)) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const key = part.slice(0, colon);
    const value = part.slice(colon + 1);
    if (!value) continue;
    switch (key) {
      case 'contact':
        f.contact = value;
        break;
      case 'after':
        f.after = value;
        break;
      case 'before':
        f.before = value;
        break;
      case 'account':
        f.accounts.push(value);
        break;
      case 'event':
        f.events.push(value);
        break;
      case 'provider':
        f.providers.push(value);
        break;
      case 'campaign':
        f.campaigns.push(value);
        break;
      case 'automation':
        f.automations.push(value);
        break;
    }
  }
  return f;
}

export function serializeQ(f: Filters): string {
  const parts: string[] = [];
  if (f.contact) parts.push(`contact:${f.contact}`);
  if (f.after) parts.push(`after:${f.after}`);
  if (f.before) parts.push(`before:${f.before}`);
  for (const v of f.accounts) parts.push(`account:${v}`);
  for (const v of f.events) parts.push(`event:${v}`);
  for (const v of f.providers) parts.push(`provider:${v}`);
  for (const v of f.campaigns) parts.push(`campaign:${v}`);
  for (const v of f.automations) parts.push(`automation:${v}`);
  return parts.join(' ');
}

export const EVENT_OPTIONS = [
  'processed',
  'delivered',
  'open',
  'click',
  'bounce',
  'dropped',
  'deferred',
  'spam',
  'unsubscribe',
  'blocked',
];

export const PROVIDER_OPTIONS = ['sendgrid', 'mailersend', 'resend', 'sparkpost', 'ses', 'mandrill'];
