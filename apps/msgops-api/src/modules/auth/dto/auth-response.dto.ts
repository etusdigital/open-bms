export interface AuthUserResponse {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  providerId: string;
}

export interface AuthLoginResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUserResponse;
}

export interface AuthRefreshResponse {
  accessToken: string;
  expiresIn: number;
}
