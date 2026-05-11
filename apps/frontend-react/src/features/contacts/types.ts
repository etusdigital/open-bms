export type ContactStatus = 'active' | 'inactive' | 'bounced' | 'unsubscribed' | 'blocked';

export interface ContactTag {
  id: number;
  name: string;
  title?: string;
  type?: 'tag' | 'segment';
}

export interface CustomFieldValue {
  customFieldId: number;
  title: string;
  value: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Import types ──────────────────────────────────────────────────

export interface ImportColumnMapping {
  [columnIndex: number]: { type: 'contacts' | 'customField' | 'ignore'; value: string };
}

export interface ImportActions {
  contactUpdate: boolean;
  startAutomation: boolean;
}

export interface ImportPayload {
  contacts: string[][];
  headers: ImportColumnMapping;
  tags: string[];
  actions: ImportActions;
}

export interface Contact {
  id: number;
  uuid?: string;
  name?: string;
  email: string;
  emailProvider?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;

  // Status
  isActive: boolean;
  isUnsubscribed?: boolean;
  isValid?: boolean;
  hasBounced?: boolean;
  isBlocked?: boolean;

  // Channels
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebPush?: boolean;
  hasMobilePush?: boolean;
  hasWhatsapp?: boolean;

  // Engagement dates (email)
  lastSent?: string;
  lastOpen?: string;
  lastClick?: string;

  // Engagement dates (per-channel)
  webPushLastSent?: string;
  webPushLastOpen?: string;
  webPushLastClick?: string;
  smsLastSent?: string;
  smsLastClick?: string;
  whatsappLastSent?: string;
  whatsappLastOpen?: string;
  whatsappLastClick?: string;
  mobPushLastSent?: string;
  mobPushLastOpen?: string;
  mobPushLastClick?: string;

  // Metadata
  customFields?: CustomFieldValue[];
  contactTag?: ContactTag[];
  score?: number;

  // Location
  city?: string;
  region?: string;
  country?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface ContactDashboard {
  total: number;
  subscribedToday: number;
  active: number;
  providers: Record<string, number>;
}

export interface SuppressedContact {
  id: number;
  email: string;
  unsubscribedAt?: string;
  blockedAt?: string;
  isBlocked?: boolean;
}

export interface HistoryItem {
  type: 'automation' | 'message' | 'custom_event';
  time?: string;
  created_at?: string;
  event?: string;
  automation_title?: string;
  automation_id?: number;
  message_title?: string;
  message_id?: number;
  message_type?: 'email' | 'web-push' | 'mobile-push' | 'sms' | 'whatsapp';
  event_id?: number;
  status?: string;
}
