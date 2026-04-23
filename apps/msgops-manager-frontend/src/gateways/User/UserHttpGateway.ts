import { CreateUser, EditUser, User } from '../../entities/User';
import { HttpClient, axiosAdapter } from '../../infra/HttpClient';
import {
  BmsHttpParams,
  BmsHttpResponse,
  bmsHttpParamsDefault,
  getBmsHttpParamsToString,
} from '../_common/Bms';
import { UserGateway } from './UserGateway.types';

export class UserHttpGateway implements UserGateway {
  constructor(readonly httpClient: HttpClient, readonly baseUrl: string) {}

  async getAll(params: BmsHttpParams): Promise<BmsHttpResponse<User[]>> {
    const mergedParams = { ...bmsHttpParamsDefault, ...params };
    return this.httpClient.get<BmsHttpResponse<User[]>>(
      `${this.baseUrl}/users?${getBmsHttpParamsToString(mergedParams)}`,
    );
  }

  async getById(id: number): Promise<User> {
    return this.httpClient.get<User>(`${this.baseUrl}/users/${id}`);
  }

  async create(user: CreateUser): Promise<User> {
    return this.httpClient.post<CreateUser, User>(`${this.baseUrl}/users`, user);
  }

  async update(user: EditUser): Promise<User> {
    return this.httpClient.put<EditUser, User>(`${this.baseUrl}/users/${user.id}`, user);
  }

  async delete(id: number) {
    // return this.httpClient.delete(`${this.baseUrl}/users/${id}`);
    console.log(id);
  }

  async getMe<T = any>(accountId?: number | string): Promise<T> {
    const query = accountId ? `?accountId=${accountId}` : '';
    return this.httpClient.get<T>(`${this.baseUrl}/users/me${query}`);
  }
}

export const userHttpGateway = new UserHttpGateway(axiosAdapter, import.meta.env.VITE_API_MSGOPS);
