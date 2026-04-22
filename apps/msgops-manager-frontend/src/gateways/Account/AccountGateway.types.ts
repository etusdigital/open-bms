import { Account } from '../../entities/Account';
import { BmsHttpParams, BmsHttpResponse } from '../_common/Bms';

export interface AccountGateway {
  getAll(params?: BmsHttpParams): Promise<BmsHttpResponse<Account[]>>;
  getById(id: number): Promise<Account>;
}
