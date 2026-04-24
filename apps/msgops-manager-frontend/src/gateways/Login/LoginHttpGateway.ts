import { LoginUser, User } from '../../entities/User';
import { HttpClient, axiosAdapter } from '../../infra/HttpClient';
import { LoginGateway } from './LoginGateway.types';

export class LoginHttpGateway implements LoginGateway {
  constructor(
    readonly httpClient: HttpClient,
    readonly baseUrl: string,
  ) {}

  async loginApi(user: LoginUser): Promise<User> {
    return await this.httpClient.post(`${this.baseUrl}/users/login`, user);
  }
}

export const loginHttpGateway = new LoginHttpGateway(axiosAdapter, import.meta.env.VITE_API_MSGOPS);
