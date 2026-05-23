// Derived from backend authz.constants.ts ALL_PERMISSION_KEYS
export const ALL_PERMISSIONS = [
  'analytics:dashboard_view',
  'analytics:comparison_view',
  'analytics:dashboard_export',
  'campaigns:view',
  'campaigns:create',
  'campaigns:update',
  'campaigns:delete',
  'automations:view',
  'automations:create',
  'automations:update',
  'automations:delete',
  'messages:view',
  'messages:create',
  'messages:update',
  'messages:delete',
  'audience:contacts_view',
  'audience:contacts_create',
  'audience:contacts_update',
  'audience:segments_view',
  'audience:segments_create',
  'audience:tags_view',
  'audience:tags_create',
  'audience:custom_fields_view',
  'audience:custom_fields_create',
  'audience:contacts_suppress',
  'audience:contacts_import',
  'audience:segments_execute',
  'infra:view',
  'infra:create',
  'infra:update',
  'infra:manage',
  'campaigns:duplicate',
  'account:settings_view',
  'account:settings_update',
  'account:users_view',
  'account:users_invite',
  'account:users_update_roles',
  'account:roles_view',
  'account:api_keys_view',
  'account:api_keys_create',
  'account:api_keys_revoke',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_CODES = ['super_admin', 'admin', 'editor', 'analyst', 'support', 'billing'] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export interface Role {
  id: number;
  code: RoleCode;
  name: string;
}

// Backend User entity (from POST /users/login)
export interface User {
  id: number;
  name: string;
  email: string;
  profile: string;
  providerId: string;
  settings: Record<string, string>;
  globalRoleId?: number;
  status: string;
  globalRole?: Role;
  userAccount?: UserAccountRaw[];
}

// UserAccount as returned by POST /users/login (with full entities)
export interface UserAccountRaw {
  userId: number;
  accountId: number;
  isMasterUser: boolean;
  account: Account;
  roleOverride?: Role | null;
}

// UserAccount as returned by GET /users/me (with role codes instead of entities)
export interface UserAccountMe {
  userId: number;
  accountId: number;
  isMasterUser: boolean;
  account: Account;
  roleOverride: string | null;
  inheritsGlobal: boolean;
}

export interface Account {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  groupId: number;
}

// Backend AccountConfig entity (GET /accounts/configs)
export interface AccountConfig {
  accountId: number;
  name: string;
  description?: string;
  value: string;
  isLoadConfig: boolean;
}

export interface AccountChannels {
  email: boolean;
  sms: boolean;
  webPush: boolean;
  mobilePush: boolean;
  whatsapp: boolean;
}

// Generic paginated API response (normalized shape used by frontend)
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Raw paginated response from the backend API
export interface RawPaginatedResponse<T> {
  results: T[];
  totalItems: number | string;
  page: number | string;
  itemsPerPage: number | string;
}

/** Maps the backend pagination shape to our normalized PaginatedResponse */
export function toPaginatedResponse<T>(raw: RawPaginatedResponse<T>): PaginatedResponse<T> {
  return {
    data: raw.results,
    meta: {
      total: Number(raw.totalItems),
      page: Number(raw.page),
      pageSize: Number(raw.itemsPerPage),
    },
  };
}

// GET /users/me response shape (globalRole is a role CODE string, not a Role object)
export interface MeResponse {
  id: number;
  name: string;
  email: string;
  profile: string;
  providerId: string;
  settings: Record<string, string>;
  status: string;
  globalRole: string;
  effectiveRole: string;
  permissions: string[];
  userAccount: UserAccountMe[];
}
