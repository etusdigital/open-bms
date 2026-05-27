import { useSyncExternalStore } from 'react';
import axios from 'axios';
import { useAppStore } from '@/stores/app-store';
import { queryClient } from '@/lib/query-client';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export interface AuthUserPayload {
  /**
   * Local DB row id. Optional because in Auth0 mode the SDK doesn't expose
   * it — only the IdP `sub` (mapped to `providerId`). Becomes defined after
   * `useAuthInit` hydrates the Zustand store from `/users/me`. Consumers
   * that need a stable numeric id must read from `useAppStore`.
   */
  id?: number;
  email: string;
  name: string;
  picture: string | null;
  providerId: string;
}

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUserPayload;
}

interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

let accessToken: string | null = null;
let tokenExpiresAt = 0;
let refreshInflight: Promise<string | null> | null = null;
let initialized = false;
let pendingUser: AuthUserPayload | null = null;
const subscribers = new Set<() => void>();
let revision = 0;

function emit() {
  revision++;
  for (const fn of subscribers) fn();
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function getSnapshot() {
  return revision;
}

// Auth0 mode bridge: when running with VITE_AUTH_PROVIDER=auth0, the SDK owns
// access tokens, login, and the user identity. The Auth0 router bridge keeps
// these mirrors fresh so consumers of `useAuth()` see consistent state.
let auth0TokenFetcher: (() => Promise<string>) | null = null;
let auth0LoginWithRedirect: ((options?: { appState?: { returnTo?: string } }) => void) | null = null;
let auth0Logout: (() => void) | null = null;
let auth0IsAuthenticated = false;
let auth0IsLoading = true;
let auth0User: AuthUserPayload | null = null;

/**
 * Single entry point used by the Auth0 router bridge to mirror SDK state +
 * handlers into this shim. Handlers (fetcher/loginWithRedirect/logout) are
 * stable across renders so passing them every call is cheap; reactive state
 * (isAuthenticated/isLoading/user) is what actually changes between calls.
 *
 * Always emits — there's no scenario where the bridge should install handlers
 * without also publishing state, and we don't want a window where
 * `__isAuth0Mode()` returns true but reactive state is stale.
 */
export function __setAuth0Bridge(bridge: {
  fetcher: () => Promise<string>;
  loginWithRedirect: (options?: { appState?: { returnTo?: string } }) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUserPayload | null;
}): void {
  auth0TokenFetcher = bridge.fetcher;
  auth0LoginWithRedirect = bridge.loginWithRedirect;
  auth0Logout = bridge.logout;
  auth0IsAuthenticated = bridge.isAuthenticated;
  auth0IsLoading = bridge.isLoading;
  auth0User = bridge.user;
  emit();
}

export function __isAuth0Mode(): boolean {
  return auth0TokenFetcher !== null;
}

function setTokens(token: string | null, expiresInSeconds: number): void {
  accessToken = token;
  tokenExpiresAt = token ? Date.now() + expiresInSeconds * 1000 : 0;
  if (!token) pendingUser = null;
  emit();
}

export async function login(email: string, password: string): Promise<AuthUserPayload> {
  const { data } = await axios.post<LoginResponse>(
    `${baseURL}/auth/login`,
    { email, password },
    { withCredentials: true },
  );
  pendingUser = data.user;
  initialized = true;
  // Force re-fetch of any cached user/permission data — equivalent to the
  // Vue 2 `setSessionStarted(false→true)` pattern. Without this, switching
  // between users in the same browser tab keeps stale permission data.
  queryClient.invalidateQueries({ queryKey: ['users-me'] });
  queryClient.invalidateQueries({ queryKey: ['accounts-configs'] });
  // setTokens emits — that's the single render trigger for this transaction.
  setTokens(data.accessToken, data.expiresIn);
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    if (auth0Logout) {
      auth0Logout();
    } else {
      await axios.post(`${baseURL}/auth/logout`, null, { withCredentials: true });
    }
  } catch {
    // Idempotent — clear local state regardless of network outcome
  } finally {
    setTokens(null, 0);
    initialized = true;
    useAppStore.getState().resetAuth();
  }
}

export async function refresh(): Promise<string | null> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const { data } = await axios.post<RefreshResponse>(`${baseURL}/auth/refresh`, null, {
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
  if (auth0TokenFetcher) {
    try {
      return await auth0TokenFetcher();
    } catch {
      return null;
    }
  }
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) return accessToken;
  return refresh();
}

export const getAccessTokenSilently = getAccessToken;

export async function bootstrapAuth(): Promise<boolean> {
  if (initialized) return !!accessToken;
  initialized = true;
  if (auth0TokenFetcher) {
    emit();
    return true;
  }
  const token = await refresh();
  emit();
  return !!token;
}

export function loginWithRedirect(options?: { appState?: { returnTo?: string } }): void {
  if (auth0LoginWithRedirect) {
    auth0LoginWithRedirect(options);
    return;
  }
  if (typeof window === 'undefined') return;
  const target = options?.appState?.returnTo;
  const search = target ? `?returnTo=${encodeURIComponent(target)}` : '';
  window.location.assign(`/login${search}`);
}

export function isAuthenticatedSync(): boolean {
  return !!accessToken && Date.now() < tokenExpiresAt;
}

export function getCurrentAccessTokenSync(): string | null {
  return accessToken;
}

export function __resetForTests(): void {
  accessToken = null;
  tokenExpiresAt = 0;
  refreshInflight = null;
  initialized = false;
  pendingUser = null;
  auth0TokenFetcher = null;
  auth0LoginWithRedirect = null;
  auth0Logout = null;
  auth0IsAuthenticated = false;
  auth0IsLoading = true;
  auth0User = null;
  emit();
}

/**
 * Reactive view over the imperative auth module.
 *
 * Sources of truth:
 *   - module: token presence/expiry, pending user (set by login/refresh)
 *   - Zustand store (`useAppStore`): hydrated user from /users/me with
 *     permissions/roles — populated by `useAuthInit`
 *
 * `isAuthenticated` flips to true as soon as the module has a valid token,
 * even before /users/me hydration finishes — that's intentional, so the
 * authenticated route layout can mount and trigger `useAuthInit`.
 */
export function useAuth() {
  // Subscribe to module mutations (login/logout/refresh/setTokens).
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const storeUser = useAppStore((s) => (s.auth.status === 'authenticated' ? s.auth.user : null));

  const auth0Mode = __isAuth0Mode();
  const tokenValid = !!accessToken && Date.now() < tokenExpiresAt;
  const isAuthenticated = auth0Mode ? auth0IsAuthenticated : tokenValid;
  const isLoading = auth0Mode ? auth0IsLoading : !initialized;

  // Prefer hydrated store user (richer); fall back to module/SDK user.
  const fallbackUser = auth0Mode ? auth0User : pendingUser;
  const user = (storeUser as AuthUserPayload | null) ?? fallbackUser;

  // Functions are module-scoped — references are already stable across
  // renders, no useCallback needed.
  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    refresh,
    getAccessToken,
    getAccessTokenSilently,
    loginWithRedirect,
  };
}
