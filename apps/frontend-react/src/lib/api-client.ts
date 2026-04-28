import axios, { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';

// Module-scoped token cache
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// Mutable ref for the Auth0 token getter (set by AuthBridge component)
let tokenFetcherRef: (() => Promise<string>) | null = null;

export function setTokenFetcher(fn: () => Promise<string>) {
  tokenFetcherRef = fn;
}

async function getToken(): Promise<string> {
  if (!tokenFetcherRef) throw new Error('Token fetcher not initialized');
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) return cachedToken;
  cachedToken = await tokenFetcherRef();
  const payload = JSON.parse(atob(cachedToken.split('.')[1]));
  tokenExpiresAt = payload.exp * 1000;
  return cachedToken;
}

export function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Request interceptor: inject Authorization + Account-Id headers
apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;

  // Only set Account-Id if not explicitly provided by the caller
  if (!config.headers['Account-Id']) {
    const { auth } = useAppStore.getState();
    if (auth.status === 'authenticated') {
      config.headers['Account-Id'] = auth.account.id;
    }
  }

  return config;
});

// Response interceptor: error handling with 401 retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Ignore cancelled requests (from AbortController during account switch)
    if (axios.isCancel(error)) return Promise.reject(error);

    const status = error.response?.status;
    const originalRequest = error.config;

    // 401: try refreshing the token once before giving up
    if (status === 401 && originalRequest && !(originalRequest as any)._retry) {
      const { auth } = useAppStore.getState();
      if (auth.status === 'switching') return Promise.reject(error);
      (originalRequest as any)._retry = true;
      clearTokenCache();

      try {
        const freshToken = await getToken();
        originalRequest.headers.Authorization = `Bearer ${freshToken}`;
        return apiClient(originalRequest);
      } catch {
        // Token refresh failed — session truly expired
        useAppStore.getState().setError('Sessão expirada');
        return Promise.reject(error);
      }
    }

    // 403: don't show a generic toast — let the calling code handle it
    // with the actual error message from the response body

    if (status && status >= 500) {
      toast.error('Não foi possível processar a requisição');
    }

    return Promise.reject(error);
  },
);
