export const AUTH_PROVIDER_TOKEN = Symbol('AUTH_PROVIDER');

export interface CreateAuthUserInput {
  email: string;
  name: string;
  password?: string;
  picture?: string;
}

export interface UpdateAuthUserInput {
  email?: string;
  name?: string;
  picture?: string;
}

export interface NormalizedJwtPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthMeta {
  userAgent?: string;
  ip?: string;
}

export interface IAuthProvider {
  createUser(input: CreateAuthUserInput): Promise<{ providerId: string }>;
  updateUser(providerId: string, patch: UpdateAuthUserInput): Promise<void>;
  updatePassword(providerId: string, newPassword: string): Promise<void>;
  deleteUser(providerId: string): Promise<void>;
  verifyToken(accessToken: string): Promise<NormalizedJwtPayload>;
  supportsCredentialLogin(): boolean;

  login?(email: string, password: string, meta?: AuthMeta): Promise<AuthTokens>;
  refresh?(refreshToken: string, meta?: AuthMeta): Promise<AuthTokens>;
  logout?(refreshToken: string): Promise<void>;
}
