import { computed, reactive, readonly } from 'vue';
import axios, { AxiosError } from 'axios';

const baseURL: string = import.meta.env.VITE_API_MSGOPS;

interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  providerId: string;
}

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

const state = reactive<{ user: AuthUser | null; isAuthenticated: boolean; isLoading: boolean }>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
});

let accessToken: string | null = null;
let tokenExpiresAt = 0;
let refreshInflight: Promise<string | null> | null = null;
let initialized = false;

function setTokens(token: string | null, expiresIn: number): void {
  accessToken = token;
  tokenExpiresAt = token ? Date.now() + expiresIn * 1000 : 0;
  state.isAuthenticated = !!token;
  if (!token) state.user = null;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  state.isLoading = true;
  try {
    const { data } = await axios.post<LoginResponse>(`${baseURL}/auth/login`, { email, password }, { withCredentials: true });
    setTokens(data.accessToken, data.expiresIn);
    state.user = data.user;
    initialized = true;
    return data.user;
  } finally {
    state.isLoading = false;
  }
}

export async function logout(): Promise<void> {
  try {
    await axios.post(`${baseURL}/auth/logout`, null, { withCredentials: true });
  } catch {
    // ignore
  } finally {
    setTokens(null, 0);
    state.user = null;
    initialized = true;
  }
}

export async function refresh(): Promise<string | null> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const { data } = await axios.post<RefreshResponse>(`${baseURL}/auth/refresh`, null, { withCredentials: true });
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
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) return accessToken;
  return refresh();
}

export async function bootstrapAuth(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const token = await refresh();
  if (!token) return;
  try {
    const { data } = await axios.get<AuthUser>(`${baseURL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    });
    state.user = data;
  } catch (err) {
    if ((err as AxiosError).response?.status === 401) {
      setTokens(null, 0);
    }
  }
}

interface LoginWithRedirectOptions {
  appState?: { targetUrl?: string };
}

export function useAuth() {
  return {
    isAuthenticated: computed(() => state.isAuthenticated),
    isLoading: computed(() => state.isLoading),
    user: computed(() => state.user),
    login,
    logout,
    refresh,
    getAccessToken,
    getAccessTokenSilently: getAccessToken,
    loginWithRedirect: (options?: LoginWithRedirectOptions) => {
      const target = options?.appState?.targetUrl;
      if (typeof window !== 'undefined') {
        const search = target ? `?redirect=${encodeURIComponent(target)}` : '';
        window.location.assign(`/login${search}`);
      }
    },
    bootstrap: bootstrapAuth,
    state: readonly(state),
  };
}

export type UseAuthReturn = ReturnType<typeof useAuth>;

// Test-only: resets all module-level state. Not imported by application code.
export function __resetForTests(): void {
  accessToken = null;
  tokenExpiresAt = 0;
  refreshInflight = null;
  initialized = false;
  state.user = null;
  state.isAuthenticated = false;
  state.isLoading = false;
}
