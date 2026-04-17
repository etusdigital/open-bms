export type AccountConfig = {
  accountId?: number;
  name?: string;
  description?: string;
  value?: object | string;
};

export type Account = {
  id: number;
  name?: string;
  description?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  accountConfigs?: AccountConfig[];
};

export type CreateAccount = Omit<Account, 'id' | 'createdAt'> & {
  createSendgridAccount?: boolean;
  linkBranding?: string;
  defaultDomain?: string;
  unsubscribeRedirectUrl?: string;
  sendgridIps?: string[];
  sendgridUser?: string;
};

export type EditAccount = Pick<Account, 'name' | 'description'> & { id: number };

export type SendgridDns = {
  [key: string]: {
    valid: boolean;
    type: string;
    host: string;
    data: string;
  };
};
