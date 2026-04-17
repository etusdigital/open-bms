export type PrincipalType = 'user' | 'api_key';

export interface PrincipalContext {
  principalType: PrincipalType;
  principalId: number;
  userId?: number;
  apiKeyId?: number;
  accountId?: number;
  globalRole?: string;
  effectiveRole?: string;
  permissions: string[];
  isSuperAdmin: boolean;
  sub?: string;
}
