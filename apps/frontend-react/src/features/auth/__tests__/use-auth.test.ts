// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import {
  __resetForTests,
  __setAuth0Bridge,
  bootstrapAuth,
  getAccessToken,
  getCurrentAccessTokenSync,
  isAuthenticatedSync,
  login,
  logout,
  refresh,
} from '../use-auth';

// Spy on the entire axios default — login/refresh/logout call axios.post directly,
// not via apiClient, so they bypass the apiClient interceptors.
const post = vi.spyOn(axios, 'post');

describe('use-auth (local mode)', () => {
  let storageSet: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetForTests();
    post.mockReset();
    storageSet = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    storageSet.mockRestore();
  });

  it('login(): persists token in memory and never writes it to localStorage/sessionStorage', async () => {
    post.mockResolvedValueOnce({
      data: {
        accessToken: 'tok-123',
        expiresIn: 3600,
        user: { id: 1, email: 'a@b.c', name: 'A', picture: null, providerId: 'local|x' },
      },
    });

    const user = await login('a@b.c', 'password1');

    expect(user.email).toBe('a@b.c');
    expect(getCurrentAccessTokenSync()).toBe('tok-123');
    expect(isAuthenticatedSync()).toBe(true);

    const writtenValues = storageSet.mock.calls.map((call) => String(call[1]));
    expect(writtenValues.some((v) => v.includes('tok-123'))).toBe(false);
  });

  it('login(): a 401 throws and leaves token state empty', async () => {
    post.mockRejectedValueOnce(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 401, data: { message: 'Invalid credentials' } },
      }),
    );

    await expect(login('a@b.c', 'wrong-password')).rejects.toBeDefined();
    expect(getCurrentAccessTokenSync()).toBeNull();
    expect(isAuthenticatedSync()).toBe(false);
  });

  it('refresh(): de-duplicates concurrent calls (single-flight)', async () => {
    post.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: { accessToken: 'fresh', expiresIn: 3600 } }), 10),
        ),
    );

    const results = await Promise.all([refresh(), refresh(), refresh(), refresh(), refresh()]);

    expect(results).toEqual(['fresh', 'fresh', 'fresh', 'fresh', 'fresh']);
    const refreshCalls = post.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh'),
    );
    expect(refreshCalls.length).toBe(1);
  });

  it('refresh(): a 401 zeroes the token and returns null', async () => {
    post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 401 } });
    const r = await refresh();
    expect(r).toBeNull();
    expect(getCurrentAccessTokenSync()).toBeNull();
  });

  it('getAccessToken(): returns cached token while still valid', async () => {
    post.mockResolvedValueOnce({
      data: {
        accessToken: 'tok-cached',
        expiresIn: 3600,
        user: { id: 1, email: 'a@b.c', name: 'A', picture: null, providerId: 'local|x' },
      },
    });
    await login('a@b.c', 'password1');
    post.mockClear();

    const t1 = await getAccessToken();
    const t2 = await getAccessToken();
    expect(t1).toBe('tok-cached');
    expect(t2).toBe('tok-cached');
    expect(post).not.toHaveBeenCalled();
  });

  it('logout(): clears local state even when the network call fails', async () => {
    post.mockResolvedValueOnce({
      data: {
        accessToken: 'tok-x',
        expiresIn: 3600,
        user: { id: 1, email: 'a@b.c', name: 'A', picture: null, providerId: 'local|x' },
      },
    });
    await login('a@b.c', 'password1');

    post.mockRejectedValueOnce(new Error('Network down'));

    await logout();

    expect(getCurrentAccessTokenSync()).toBeNull();
    expect(isAuthenticatedSync()).toBe(false);
  });

  it('bootstrapAuth(): is idempotent — second call short-circuits', async () => {
    post.mockResolvedValueOnce({ data: { accessToken: 't1', expiresIn: 3600 } });
    const ok1 = await bootstrapAuth();
    expect(ok1).toBe(true);
    post.mockClear();

    const ok2 = await bootstrapAuth();
    expect(ok2).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });

  it('Auth0 bridge: getAccessToken delegates to the registered fetcher', async () => {
    const auth0Fetcher = vi.fn().mockResolvedValue('auth0-tok');
    __setAuth0Bridge({
      fetcher: auth0Fetcher,
      loginWithRedirect: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
      user: { email: 'a@b.c', name: 'A', picture: null, providerId: 'auth0|x' },
    });

    const t = await getAccessToken();
    expect(t).toBe('auth0-tok');
    expect(auth0Fetcher).toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
