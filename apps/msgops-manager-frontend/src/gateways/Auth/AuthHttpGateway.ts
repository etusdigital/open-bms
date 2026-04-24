import axios from 'axios';

const baseURL: string = import.meta.env.VITE_API_MSGOPS;

export interface AuthLoginPayload {
  email: string;
  password: string;
}

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

export class AuthHttpGateway {
  async login(payload: AuthLoginPayload): Promise<AuthLoginResponse> {
    const { data } = await axios.post<AuthLoginResponse>(`${baseURL}/auth/login`, payload, { withCredentials: true });
    return data;
  }

  async refresh(): Promise<AuthRefreshResponse> {
    const { data } = await axios.post<AuthRefreshResponse>(`${baseURL}/auth/refresh`, null, { withCredentials: true });
    return data;
  }

  async logout(): Promise<void> {
    await axios.post(`${baseURL}/auth/logout`, null, { withCredentials: true });
  }
}

export const authHttpGateway = new AuthHttpGateway();
