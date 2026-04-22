import { Account } from '../../entities/Account';
import { BmsHttpResponse } from '../../gateways/_common/Bms';

export type AccountsState = {
  accounts: BmsHttpResponse<Account[]> | Account[];
  account?: Account;
  loading: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any;
};
