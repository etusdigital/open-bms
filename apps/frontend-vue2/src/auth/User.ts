export interface MeResponse {
  id: number;
  email: string;
  name: string;
  picture?: string | null;
  providerId: string;
  roles?: string[];
  permissions?: string[];
  effectiveRole?: string;
  globalRole?: string;
  isSuperAdmin?: boolean;
  canSeeAllAccounts?: boolean;
}

export class User {
  id?: number;
  sub = '';
  name = '';
  nickname = '';
  picture = '';
  email = '';
  emailVerified = true;
  provider?: string;
  providerId?: string;
  roles?: string[];
  permissions?: string[];
  effectiveRole?: string;
  globalRole?: string;
  isSuperAdmin?: boolean;
  canSeeAllAccounts?: boolean;
  [key: string]: unknown;

  constructor(me?: MeResponse | null) {
    if (!me) return;
    this.id = me.id;
    this.email = me.email;
    this.name = me.name;
    this.nickname = me.name;
    this.picture = me.picture || '';
    this.providerId = me.providerId;
    this.sub = me.providerId;
    this.provider = me.providerId?.split('|')[0];
    this.roles = me.roles;
    this.permissions = me.permissions;
    this.effectiveRole = me.effectiveRole;
    this.globalRole = me.globalRole;
    this.isSuperAdmin = me.isSuperAdmin;
    this.canSeeAllAccounts = me.canSeeAllAccounts;
  }
}
