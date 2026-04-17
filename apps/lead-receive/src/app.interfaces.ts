export interface LeadMessage {
  contact: Contact;
  tagName: string | string[];
  removeTag?: string | string[];
  apiKey: string;
  startedAt?: number;
  app?: string;
  user_agent?: string;
}

export interface Contact {
  email: string;
  firstName: string;
  emailProvider?: string;
  accountId?: number;
  lastName?: string;
  hashedEmail?: string;
  phone?: string;
  isUnsubscribed?: boolean;
  isValid?: boolean;
  hasBounced?: boolean;
  customFields?: ContactCustomField[] | Record<string, string>;
  devices?: ContactDevice[];
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
  ip?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  name?: string;
}

export interface ContactCustomField {
  contactId: number;
  customFieldId: number;
  value: string;
}

export enum DeviceType {
  EMAIL = 'email',
  PHONE = 'phone',
  WEBPUSH = 'web-push',
  MOBILEPUSH = 'mobile-push',
}

export interface ContactDevice {
  id?: number;
  accountId: number;
  contactId: number;
  type: DeviceType;
  token: string;
  isUnsubscribed: boolean;
  ip?: string;
  os?: string;
  browser?: string;
  resolution?: string;
  subscriptionUrl?: string;
  latestVisitedUrl?: string;
  lastSession?: Date;
  lastSent?: Date;
  lastView?: Date;
  lastClick?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface QuizMakerPayload {
  name: string;
  email: string;
  original_email: string;
  app: string;
  hashed_email: string;
  referer: string;
  query_string: string;
  questions: {
    question: string;
    answer: string;
    quiz_name?: string;
    answer_id?: number;
    answer_image?: string;
    answer_value?: string;
    answer_value_key?: string;
    step_statement?: string;
    answer_type?: boolean;
    nx_step?: number;
    step_id?: number;
    question_key?: string;
  }[];
  direct_to: string;
  fbp: string;
  etsclientid: string;
  gid: string;
  aff_id: string;
  krux_id: string;
  sub_id: string;
  fbclid: string;
  gclid: string;
  taboola_external_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  campaign_id: string;
  ad_id: string;
  adset_id: string;
  origem_cadastro: string;
  source_url: string;
  form_fields: {
    id: string;
    name: string;
    value: string;
  }[];
  td_client_id: string;
  td_ssc_id: string;
  td_global_id: string;
  apiKey: string;
  tagName: string;
  contact?: Contact;
  version?: string;
  user_agent?: string;
}

export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}
