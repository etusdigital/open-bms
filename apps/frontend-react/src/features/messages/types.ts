export type MessageType = 'email' | 'sms' | 'web-push' | 'mobile-push' | 'whatsapp';

export type TransactionalMessageType =
  | 'transactional-email'
  | 'transactional-sms'
  | 'transactional-web-push'
  | 'transactional-mobile-push'
  | 'transactional-whatsapp';

export type AnyMessageType = MessageType | TransactionalMessageType;

/** All transactional message types — used to filter the transactional listing page. */
export const TRANSACTIONAL_TYPES: TransactionalMessageType[] = [
  'transactional-email',
  'transactional-sms',
  'transactional-web-push',
  'transactional-mobile-push',
  'transactional-whatsapp',
];

/** Builds a transactional message type from a base channel (e.g. 'email' → 'transactional-email'). */
export function toTransactionalType(type: MessageType): TransactionalMessageType {
  return `transactional-${type}` as TransactionalMessageType;
}

export type MessageStatus = 'draft' | 'send_approval' | 'sent_approval' | 'approved' | 'rejected';

export type MessagePriority = 'low' | 'normal' | 'high';

export type ExpiryPushFilter = 'day' | 'hour';

export type WhatsAppHeaderType = 'text' | 'image' | 'video';

export interface Message {
  id: number;
  title: string;
  description?: string;
  type: MessageType | MessageType[];
  subject?: string;
  previewText?: string;
  content?: string;
  content_json?: string;
  text?: string;
  fromName?: string;
  fromMail?: string;
  replyTo?: string;
  ippool?: string;
  url?: string;
  image?: string;
  whatsappType?: string;
  templateCategory?: string;
  callToActionText?: string;
  callToActionUrl?: string;
  headerType?: WhatsAppHeaderType;
  headerContent?: string;
  footer?: string;
  notificationSound?: string;
  expiryPushInSeconds?: number;
  expiryPushFilter?: ExpiryPushFilter;
  priority?: MessagePriority;
  isTested?: boolean;
  providerMessageId?: string;
  status?: MessageStatus;
  templateUrl?: string;
  campaignInUse?: boolean;
  labels?: { id: number; name: string }[];
  accountId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  email: 'Email',
  sms: 'SMS',
  'web-push': 'Web Push',
  'mobile-push': 'Mobile Push',
  whatsapp: 'WhatsApp',
};

export const ANY_MESSAGE_TYPE_LABELS: Record<AnyMessageType, string> = {
  ...MESSAGE_TYPE_LABELS,
  'transactional-email': 'Email Transacional',
  'transactional-sms': 'SMS Transacional',
  'transactional-web-push': 'Web Push Transacional',
  'transactional-mobile-push': 'Mobile Push Transacional',
  'transactional-whatsapp': 'WhatsApp Transacional',
};

/** Extracts the base MessageType from an AnyMessageType (e.g. 'transactional-email' → 'email') */
export function baseMessageType(type: AnyMessageType): MessageType {
  if (type.startsWith('transactional-')) return type.replace('transactional-', '') as MessageType;
  return type as MessageType;
}
