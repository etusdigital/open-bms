jest.mock('axios');
jest.mock('@/store', () => ({
  __esModule: true,
  default: { commit: jest.fn(), state: {} },
}));

import axios from 'axios';
import store from '@/store';
import * as authService from './auth.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedStore = store as unknown as { commit: jest.Mock };

function resetModuleState() {
  (authService as any).__resetForTests();
}

describe('auth.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStore.commit.mockReset();
    resetModuleState();
  });

  describe('login', () => {
    it('stores access token in memory and commits user to store', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: {
          accessToken: 'jwt.xyz',
          expiresIn: 3600,
          user: { id: 1, email: 'a@b.com', name: 'A', picture: null, providerId: 'local|1' },
        },
      });

      await authService.login('a@b.com', 'password1');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringMatching(/auth\/login$/),
        { email: 'a@b.com', password: 'password1' },
        expect.objectContaining({ withCredentials: true }),
      );
      expect(mockedStore.commit).toHaveBeenCalledWith('setUser', expect.objectContaining({ email: 'a@b.com' }));
      expect(authService.isAuthenticated()).toBe(true);
      expect(authService.getCurrentAccessToken()).toBe('jwt.xyz');
    });

    it('propagates error and does not set token on failure', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue({ response: { status: 401 } });
      await expect(authService.login('a@b.com', 'wrong')).rejects.toBeDefined();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('refresh', () => {
    it('replaces access token with new value', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({ data: { accessToken: 'new-jwt', expiresIn: 3600 } });
      const token = await authService.refresh();
      expect(token).toBe('new-jwt');
      expect(authService.getCurrentAccessToken()).toBe('new-jwt');
    });

    it('returns null and clears state when refresh fails', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue({ response: { status: 401 } });
      const token = await authService.refresh();
      expect(token).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('de-duplicates concurrent refresh calls via in-flight promise', async () => {
      let resolveInner!: (v: any) => void;
      mockedAxios.post = jest.fn(
        () =>
          new Promise((resolve) => {
            resolveInner = resolve;
          }),
      ) as any;

      const a = authService.refresh();
      const b = authService.refresh();
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);

      resolveInner({ data: { accessToken: 'single-jwt', expiresIn: 3600 } });
      const [ra, rb] = await Promise.all([a, b]);
      expect(ra).toBe('single-jwt');
      expect(rb).toBe('single-jwt');
    });
  });

  describe('logout', () => {
    it('calls backend, clears token, and resets store', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({ data: {} });
      // seed some token first
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          accessToken: 'seed',
          expiresIn: 3600,
          user: { id: 1, email: 'a@b.com', name: 'A', picture: null, providerId: 'local|1' },
        },
      });
      await authService.login('a@b.com', 'password1');
      expect(authService.isAuthenticated()).toBe(true);

      await authService.logout();

      expect(mockedStore.commit).toHaveBeenCalledWith('setUser', {});
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('still clears local state when backend logout call fails', async () => {
      mockedAxios.post = jest.fn().mockRejectedValue(new Error('net'));
      await authService.logout();
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('returns cached token when not near expiry', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: {
          accessToken: 'fresh',
          expiresIn: 3600,
          user: { id: 1, email: 'a@b.com', name: 'A', picture: null, providerId: 'local|1' },
        },
      });
      await authService.login('a@b.com', 'password1');
      const token = await authService.getAccessToken();
      expect(token).toBe('fresh');
    });
  });
});
