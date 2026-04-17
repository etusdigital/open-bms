import { Account } from '../../entities/Account';
import { BriusHttpResponse } from '../../gateways/_common/Brius';

export type AccountsState = {
  accounts: BriusHttpResponse<Account[]> | Account[];
  account?: Account;
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
};
