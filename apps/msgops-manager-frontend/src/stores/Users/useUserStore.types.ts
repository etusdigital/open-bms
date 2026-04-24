import { BmsHttpResponse } from '../../gateways/_common/Bms';
import { User } from '../../entities/User';

export type UsersState = {
  users: BmsHttpResponse<User[]>;
  user?: User;
  userEdit?: User;
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
  roles: string[];
  effectiveRole: string;
  globalRole: string;
  permissions: string[];
  isSuperAdmin: boolean;
  canSeeAllAccounts: boolean;
};
