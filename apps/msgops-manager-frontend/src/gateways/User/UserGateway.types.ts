import { User } from '../../entities/User';
import { BmsHttpParams, BmsHttpResponse } from '../_common/Bms';

export interface UserGateway {
  getAll(params?: BmsHttpParams): Promise<BmsHttpResponse<User[]>>;
  getById(id: number): Promise<User>;
}
