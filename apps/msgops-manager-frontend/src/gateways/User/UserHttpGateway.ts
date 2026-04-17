import { CreateUser, EditUser, User } from '../../entities/User';
import { HttpClient, axiosAdapter } from '../../infra/HttpClient';
import {
  BriusHttpParams,
  BriusHttpResponse,
  briusHttpParamsDefault,
  getBriusHttpParamsToString,
} from '../_common/Brius';
import { UserGateway } from './UserGateway.types';

export class UserHttpGateway implements UserGateway {
  constructor(readonly httpClient: HttpClient, readonly baseUrl: string) {}

  async getAll(params: BriusHttpParams): Promise<BriusHttpResponse<User[]>> {
    const mergedParams = { ...briusHttpParamsDefault, ...params };
    return this.httpClient.get<BriusHttpResponse<User[]>>(
      `${this.baseUrl}/users?${getBriusHttpParamsToString(mergedParams)}`,
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
}

export const userHttpGateway = new UserHttpGateway(axiosAdapter, import.meta.env.VITE_API_MSGOPS);
