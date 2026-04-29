export interface SuperAdminUserAccount {
  userId: number;
  accountId: number;
  isMasterUser: boolean;
  roleOverride: string | null;
  account: { id: number; name: string };
}

export interface SuperAdminUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  providerId: string;
  status: string;
  globalRole?: { id: number; code: string; name: string };
  globalRoleId?: number;
  userAccount?: SuperAdminUserAccount[];
  createdAt: string;
  updatedAt?: string;
}
