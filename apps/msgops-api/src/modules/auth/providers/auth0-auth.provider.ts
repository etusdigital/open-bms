import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { ManagementClient } from 'auth0';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { CreateAuthUserInput, IAuthProvider, NormalizedJwtPayload, UpdateAuthUserInput } from './auth.provider.interface';

@Injectable()
export class Auth0AuthProvider implements IAuthProvider {
  private readonly management: ManagementClient;
  private readonly jwks = jwksClient({
    jwksUri: process.env.JWKS_URI || '',
    cache: true,
    cacheMaxEntries: 10,
    cacheMaxAge: 600000,
  });

  constructor() {
    this.management = new ManagementClient({
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
    });
  }

  supportsCredentialLogin(): boolean {
    return false;
  }

  async createUser(input: CreateAuthUserInput): Promise<{ providerId: string }> {
    try {
      const created: any = await this.management.users.create({
        name: input.name,
        email: input.email,
        password: input.password,
        connection: 'Username-Password-Authentication',
        picture: input.picture,
      });
      const providerId = created?.user_id || created?.data?.user_id;
      if (!providerId) {
        throw new HttpException('Auth0 did not return user_id', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return { providerId };
    } catch (e: any) {
      if (e?.statusCode === HttpStatus.CONFLICT) {
        const existing = await this.getUserByEmail(input.email);
        if (existing.length) return { providerId: existing[0].user_id };
      }
      console.error('Auth0 createUser error', e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateUser(providerId: string, patch: UpdateAuthUserInput): Promise<void> {
    const data: any = {};
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.name !== undefined) {
      data.name = patch.name;
      data.nickname = patch.name;
    }
    if (patch.picture !== undefined) data.picture = patch.picture;
    if (Object.keys(data).length === 0) return;
    await this.management.users.update(providerId, data);
  }

  async updatePassword(providerId: string, newPassword: string): Promise<void> {
    await this.management.users.update(providerId, { password: newPassword });
  }

  async deleteUser(providerId: string): Promise<void> {
    await this.management.users.delete(providerId);
  }

  async verifyToken(accessToken: string): Promise<NormalizedJwtPayload> {
    const decoded: any = jwt.decode(accessToken, { complete: true });
    if (!decoded?.header?.kid) {
      throw new UnauthorizedException('Invalid token');
    }

    const signingKey = await this.getSigningKey(decoded.header.kid);
    try {
      const payload = jwt.verify(accessToken, signingKey, {
        audience: process.env.IDP_AUDIENCE,
        issuer: process.env.IDP_ISSUER,
        algorithms: ['RS256'],
      }) as NormalizedJwtPayload;
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async getSigningKey(kid: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.jwks.getSigningKey(kid, (err, key: any) => {
        if (err || !key) {
          reject(err || new Error('Signing key not found'));
          return;
        }
        resolve(key.getPublicKey ? key.getPublicKey() : key.publicKey || key.rsaPublicKey);
      });
    });
  }

  private async getUserByEmail(email: string): Promise<any[]> {
    try {
      const result: any = await this.management.users.listUsersByEmail({ email });
      return Array.isArray(result) ? result : result?.data || [];
    } catch {
      return [];
    }
  }
}
