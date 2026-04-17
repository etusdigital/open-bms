import { User } from '../../entities/User';
import { BriusHttpParams, BriusHttpResponse } from '../_common/Brius';

export interface UserGateway {
  getAll(params?: BriusHttpParams): Promise<BriusHttpResponse<User[]>>;
  getById(id: number): Promise<User>;
}
