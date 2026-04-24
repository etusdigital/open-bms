import { AccountConfig } from '../Account';

export type UserStettings = { language: string };

export type Accounts = {
  accountId: number;
  isMasterUser: boolean;
};

export type UserAccountBase = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: null;
  customFields: UserCustomFields[];
  accountConfigs: AccountConfig[];
};

export type UserCustomFields = {
  id: number;
  accountId?: number;
  title?: string;
  name?: string;
  description?: string;
  order?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UserAccount = {
  userId: 29;
  accountId: 1;
  isMasterUser: false;
  account: UserAccountBase;
};

export type User = {
  id: number;
  name?: string;
  email?: string;
  profile: string;
  providerId: string;
  settings: UserStettings;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
  userAccount: UserAccount[];
};

export type LoginUser = {
  name: string;
  email: string;
  picture: string;
};

export type CreateUser = Pick<User, 'name' | 'email'> & { accounts?: Accounts[] | unknown; password?: string };
export type EditUser = { id: number; name?: string; email?: string; accounts: Accounts[] | unknown };
