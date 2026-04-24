import axios from 'axios';
import store from '@/store';

const baseURL = process.env.VUE_APP_API_URL;
if (!baseURL) {
  // eslint-disable-next-line no-console
  console.error(
    'VUE_APP_API_URL is not defined. Create apps/frontend-vue2/.env with VUE_APP_API_URL=http://localhost:5001/ and restart the dev server.'
  );
}

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: number;
    email: string;
    name: string;
    picture: string | null;
    providerId: string;
  };
}

let accessToken: string | null = null;
let tokenExpiresAt = 0;
let refreshInflight: Promise<string | null> | null = null;

function setTokens(token: string | null, expiresIn: number): void {
  accessToken = token;
  tokenExpiresAt = token ? Date.now() + expiresIn * 1000 : 0;
}

export async function login(email: string, password: string): Promise<void> {
  const { data } = await axios.post<LoginResponse>(
    `${baseURL}auth/login`,
    { email, password },
    { withCredentials: true }
  );
  setTokens(data.accessToken, data.expiresIn);
  store.commit('setUser', data.user);
}

export async function logout(): Promise<void> {
  try {
    await axios.post(`${baseURL}auth/logout`, null, { withCredentials: true });
  } catch {
    // ignore — logout is best-effort
  } finally {
    setTokens(null, 0);
    store.commit('setUser', {});
    store.commit('setAuthReady', false);
    store.commit('setLoadAuth0', false);
    store.commit('setPermissions', []);
    store.commit('setEffectiveRole', '');
    store.commit('setGlobalRole', '');
    store.commit('setSuperAdmin', false);
  }
}

export async function refresh(): Promise<string | null> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const { data } = await axios.post<{ accessToken: string; expiresIn: number }>(`${baseURL}auth/refresh`, null, {
        withCredentials: true,
      });
      setTokens(data.accessToken, data.expiresIn);
      return data.accessToken;
    } catch {
      setTokens(null, 0);
      return null;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiresAt - 30000) {
    return accessToken;
  }
  return refresh();
}

export function isAuthenticated(): boolean {
  return !!accessToken && Date.now() < tokenExpiresAt;
}

export function getCurrentAccessToken(): string | null {
  return accessToken;
}

// Test-only: resets module-level token/expiry/in-flight state so specs can start clean.
// Not imported by application code.
export function __resetForTests(): void {
  accessToken = null;
  tokenExpiresAt = 0;
  refreshInflight = null;
}

export default class AuthService {
  public async getUser() {
    return store.state.currentUser || null;
  }

  public async getAccessToken(): Promise<string | null> {
    return getAccessToken();
  }

  public async getisAuthenticated(): Promise<boolean> {
    const token = await getAccessToken();
    return !!token;
  }

  public async login(email?: string, password?: string): Promise<string | null> {
    if (email && password) {
      await login(email, password);
    }
    return getAccessToken();
  }

  public async logout(): Promise<void> {
    await logout();
  }
}
