import { LoginUser, User } from '../../entities/User';

export interface LoginGateway {
  loginApi(user: LoginUser): Promise<User>;
}
