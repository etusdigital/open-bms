import { BriusHttpResponse } from '../../gateways/_common/Brius';
import { User } from '../../entities/User';

export type UsersState = {
  users: BriusHttpResponse<User[]>;
  user?: User;
  userEdit?: User;
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
  roles: string[];
};
