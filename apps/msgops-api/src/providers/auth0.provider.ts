import { ManagementClient } from 'auth0';
import { HttpException, HttpStatus } from '@nestjs/common';
import { CreateUserDto } from '../modules/users/dtos/create-user.dto';

export class Auth0Provider {
  private webAuth: ManagementClient;

  constructor() {
    this.webAuth = new ManagementClient({
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
    });
  }

  async createNewUser(userDto: CreateUserDto) {
    try {
      return await this.webAuth.users.create({
        name: userDto.name,
        email: userDto.email,
        password: userDto.password,
        connection: 'Username-Password-Authentication',
        picture: userDto.profile,
      });
    } catch (e) {
      console.log('Log - auth0 error', e);
      if (e.statusCode === HttpStatus.CONFLICT) {
        const users = await this.getUserByEmail(userDto.email);
        if (users.length) {
          return users[0];
        }
      }
      throw new HttpException(e.message || e.error_description || 'Erro ao criar usuário no Auth0.', e.statusCode || HttpStatus.BAD_GATEWAY);
    }
  }

  async updateUser(userDto: any) {
    const data: any = {};
    if (userDto.email !== undefined) data.email = userDto.email;
    if (userDto.name !== undefined) {
      data.name = userDto.name;
      data.nickname = userDto.name;
    }
    if (userDto.profile !== undefined) data.picture = userDto.profile;

    if (Object.keys(data).length === 0) return;
    return await this.webAuth.users.update(userDto.provider_id, data);
  }

  async updateUserPassword(providerId: string, newPassword: any) {
    return await this.webAuth.users.update(providerId, { password: newPassword });
  }

  async deleteUser(id: string) {
    return await this.webAuth.users.delete(id);
  }

  async getUsers() {
    return await this.webAuth.users.list();
  }

  async getUserByEmail(email: string) {
    return await this.webAuth.users.listUsersByEmail({ email });
  }
}
