import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAppStore } from '@/stores/app-store';
import { getAccessToken, refresh } from '@/features/auth/use-auth';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return /\/auth\/(login|refresh|logout)\b/.test(url);
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken().catch(() => null);
  config.headers = config.headers || {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (!config.headers['Account-Id']) {
    const { auth } = useAppStore.getState();
    if (auth.status === 'authenticated') {
      config.headers['Account-Id'] = auth.account.id;
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (axios.isCancel(error)) return Promise.reject(error);

    const status = error.response?.status;
    const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      const { auth } = useAppStore.getState();
      if (auth.status === 'switching') return Promise.reject(error);

      originalRequest._retry = true;
      const newToken = await refresh();
      if (newToken) {
        originalRequest.headers = originalRequest.headers || {};
        (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }

      useAppStore.getState().resetAuth();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        const returnTo = window.location.pathname + window.location.search;
        window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      }
      return Promise.reject(error);
    }

    if (status && status >= 500) {
      toast.error('Não foi possível processar a requisição');
    }

    return Promise.reject(error);
  },
);
