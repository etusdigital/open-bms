export const GROUP_BY_ITEMS = [
  { value: 'ad_id', labelKey: 'leads.groupBy.ad_id' },
  { value: 'adgroup_id', labelKey: 'leads.groupBy.adgroup_id' },
  { value: 'adset_id', labelKey: 'leads.groupBy.adset_id' },
  { value: 'campaign_id', labelKey: 'leads.groupBy.campaign_id' },
  { value: 'created_at_date', labelKey: 'leads.groupBy.created_at_date' },
  { value: 'direct_to_url', labelKey: 'leads.groupBy.direct_to_url' },
  { value: 'engaged', labelKey: 'leads.groupBy.engaged' },
  { value: 'email_provider', labelKey: 'leads.groupBy.email_provider' },
  { value: 'source_url', labelKey: 'leads.groupBy.source_url' },
  { value: 'tag_name', labelKey: 'leads.groupBy.tag_name' },
  { value: 'utm_campaign', labelKey: 'leads.groupBy.utm_campaign' },
  { value: 'utm_content', labelKey: 'leads.groupBy.utm_content' },
  { value: 'utm_keyword', labelKey: 'leads.groupBy.utm_keyword' },
  { value: 'utm_medium', labelKey: 'leads.groupBy.utm_medium' },
  { value: 'utm_source', labelKey: 'leads.groupBy.utm_source' },
  { value: 'utm_term', labelKey: 'leads.groupBy.utm_term' },
  { value: 'placement', labelKey: 'leads.groupBy.placement' },
] as const;

export type GroupByValue = (typeof GROUP_BY_ITEMS)[number]['value'];

/** O(1) lookup map for GROUP_BY_ITEMS by value */
export const GROUP_BY_MAP = new Map(GROUP_BY_ITEMS.map((item) => [item.value, item]));

export const EMAIL_PROVIDER_OPTIONS = ['Gmail', 'Yahoo', 'Microsoft', 'iCloud', 'Other'] as const;
export const UTM_SOURCE_OPTIONS = [
  'google',
  'facebook',
  'tiktok',
  'pangle',
  'sendgrid',
  'gam',
  'community',
  'plusdin.com.br',
  'push',
] as const;

export interface LeadRow {
  total: number;
  total_unique: string;
  valid: string;
  new: string;
  old: string;
  bounced: string;
  invalid: string;
  automation_entry: string;
  automation_duplicated: string;
  [key: string]: string | number; // dynamic group-by columns
}

export interface LeadsFilters {
  email_provider: string[];
  utm_source: string[];
  utm_campaign: string;
  source_url: string;
}

export const METRIC_COLUMNS = [
  'total',
  'total_unique',
  'valid',
  'new',
  'old',
  'bounced',
  'invalid',
  'automation_entry',
  'automation_duplicated',
] as const;
