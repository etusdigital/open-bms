export interface Pool {
  id: number;
  name: string;
  description?: string;
  poolName: string;
  ip?: string;
  isDefault?: boolean;
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
