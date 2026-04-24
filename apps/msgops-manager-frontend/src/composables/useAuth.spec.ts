import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('axios', () => {
  const post = vi.fn();
  const get = vi.fn();
  return {
    default: { post, get },
    post,
    get,
    AxiosError: class AxiosError extends Error {},
  };
});

// bootstrapAuth imports the singleton api from AxiosAdapter (dynamic import) so we
// mock the module to reuse the same mocked .get() the tests already control.
vi.mock('../infra/HttpClient/AxiosAdapter', async () => {
  const axios = (await import('axios')).default as any;
  return { api: axios, AxiosAdapter: class {} };
});

import axios from 'axios';

// Import AFTER the mock so the composable picks up the mocked axios module.
import { useAuth, login, logout, refresh, getAccessToken, bootstrapAuth, __resetForTests } from './useAuth';

const mockedPost = (axios as any).post as ReturnType<typeof vi.fn>;
const mockedGet = (axios as any).get as ReturnType<typeof vi.fn>;

describe('useAuth composable', () => {
  beforeEach(() => {
    mockedPost.mockReset();
    mockedGet.mockReset();
    __resetForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the useAuth0 drop-in shape', () => {
    const api = useAuth();
    expect(api).toHaveProperty('isAuthenticated');
    expect(api).toHaveProperty('isLoading');
    expect(api).toHaveProperty('user');
    expect(api).toHaveProperty('loginWithRedirect');
    expect(api).toHaveProperty('logout');
    expect(api).toHaveProperty('getAccessTokenSilently');
  });

  it('login: populates access token and user on success', async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        accessToken: 'jwt.vue3',
        expiresIn: 3600,
        user: { id: 1, email: 'a@b.com', name: 'A', picture: null, providerId: 'local|u1' },
      },
    });
    const user = await login('a@b.com', 'password1');
    expect(user.email).toBe('a@b.com');
    const { isAuthenticated } = useAuth();
    expect(isAuthenticated.value).toBe(true);
    const token = await getAccessToken();
    expect(token).toBe('jwt.vue3');
  });

  it('logout: clears state even when backend logout fails', async () => {
    // seed state
    mockedPost.mockResolvedValueOnce({
      data: {
        accessToken: 'jwt',
        expiresIn: 3600,
        user: { id: 1, email: 'a@b.com', name: 'A', picture: null, providerId: 'local|u1' },
      },
    });
    await login('a@b.com', 'password1');

    mockedPost.mockRejectedValueOnce(new Error('net'));
    await logout();

    const { isAuthenticated, user } = useAuth();
    expect(isAuthenticated.value).toBe(false);
    expect(user.value).toBeNull();
  });

  it('refresh: concurrent calls share a single in-flight request', async () => {
    let resolveInner!: (v: any) => void;
    mockedPost.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInner = resolve;
        }) as any,
    );

    const a = refresh();
    const b = refresh();
    expect(mockedPost).toHaveBeenCalledTimes(1);

    resolveInner({ data: { accessToken: 'shared', expiresIn: 3600 } });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe('shared');
    expect(rb).toBe('shared');
  });

  it('loginWithRedirect: sends browser to /login with redirect query', () => {
    const assignSpy = vi.fn();
    vi.stubGlobal('window', { location: { assign: assignSpy, pathname: '/users' } } as any);
    const { loginWithRedirect } = useAuth();
    loginWithRedirect({ appState: { targetUrl: '/users' } });
    expect(assignSpy).toHaveBeenCalledWith('/login?redirect=%2Fusers');
  });

  it('bootstrapAuth: silently hydrates user when refresh cookie is valid', async () => {
    mockedPost.mockResolvedValueOnce({ data: { accessToken: 'boot-jwt', expiresIn: 3600 } });
    mockedGet.mockResolvedValueOnce({
      data: { id: 7, email: 'a@b.com', name: 'A', picture: null, providerId: 'local|u7' },
    });
    await bootstrapAuth();
    const { user, isAuthenticated } = useAuth();
    expect(isAuthenticated.value).toBe(true);
    expect(user.value?.id).toBe(7);
  });
});
