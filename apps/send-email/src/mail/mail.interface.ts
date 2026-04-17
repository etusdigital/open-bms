import { Account, Campaign, Contact } from '../interfaces';

export interface Batch {
  account: Account;
  campaign: Campaign;
  contacts: Contact[];
  message: Email;
  page?: number;
  totalPages?: number;
  campaign_id: number;
  campaign_name?: string;
  campaign_test_ab_mode: boolean;
  is_campaign_warmup_mode: boolean;
}

export interface Email {
  id: number;
  title: string;
  name: string;
  fromMail: string;
  fromName: string;
  ippool?: string;
  replyTo?: string;
  previewText?: string;
  subject: string;
  bucketName: string;
  fileName: string;
  content: string;
}

export interface MapVariables {
  [key: string]: string;
}

// Google Pub/Sub Interfaces
export interface SubscriptionMessage {
  message: Message;
  subscription: string;
}

interface Message {
  attributes: Attributes;
  data: string;
  messageId: string;
  message_id: string;
  publishTime: string;
  publish_time: string;
}

interface Attributes {
  key: string;
}
export interface DefaultParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string | number;
  // utm_content: string;
}
