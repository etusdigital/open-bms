import { Account } from '../../entities/Account';
import { BriusHttpParams, BriusHttpResponse } from '../_common/Brius';

export interface AccountGateway {
  getAll(params?: BriusHttpParams): Promise<BriusHttpResponse<Account[]>>;
  getById(id: number): Promise<Account>;
}
