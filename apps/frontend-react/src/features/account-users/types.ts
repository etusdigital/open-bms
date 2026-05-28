// Adapted from features/super-admin/users — keep in sync until shared module is extracted.
// Scoped to a single account: roles are managed as account-level overrides, never global.

export interface AccountUserMembership {
  userId: number;
  accountId: number;
  isMasterUser: boolean;
  // roleOverride comes back as a RoleEntity (joined) on GET /users/:id
  roleOverride?: { id: number; code: string; name: string } | null;
  account?: { id: number; name: string } | null;
}

// Row shape returned by GET /users (listPaginated) — raw user columns.
export interface AccountUser {
  id: number;
  name: string;
  email: string;
  profile?: string;
  providerId?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  // Present on GET /users/:id (detail), not on the list.
  userAccount?: AccountUserMembership[];
}
