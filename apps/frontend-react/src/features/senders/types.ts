export interface Sender {
  id: number;
  senderEmail: string;
  senderName: string;
  senderReplyTo?: string;
  isDefault?: boolean;
  sgVerifiedSenderId?: string;
  removedAtSource?: string;
  accountId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SyncSendersResult {
  created: number;
  updated: number;
  removed: number;
}
