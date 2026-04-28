export interface Pool {
  id: number;
  name: string;
  description?: string;
  poolName: string;
  ip?: string;
  senderEmail?: string;
  senderName?: string;
  senderReplyTo?: string;
  isDefault?: boolean;
  dailyLimit?: string;
  sendingLimit?: string;
  accountId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SendGridPool {
  name: string;
}

export interface SendGridIp {
  ip: string;
  pools: string[];
}
