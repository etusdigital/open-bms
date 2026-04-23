import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { getAccessToken, refresh, logout } from '../../composables/useAuth';
import type { HttpClient } from './HttpClient.types';
import { useAccountStore, useUserStore } from '../../stores';

const api: AxiosInstance = axios.create({
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken().catch(() => null);
  config.headers = config.headers || {};
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const accountId = useAccountStore().account?.id;
  const user = useUserStore().user;
  if (user) {
    config.headers['Current-User'] = JSON.stringify({ name: user.name, email: user.email });
    if (user.id) config.headers['User-Id'] = user.id;
  }
  if (accountId) config.headers['Account-Id'] = accountId;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const url = original?.url || '';
    const isAuthEndpoint = url.includes('/auth/refresh') || url.includes('/auth/login') || url.includes('/auth/logout');

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const newToken = await refresh();
      if (newToken) {
        return api(original);
      }
      await logout();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      }
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      handleErrorMessage(error.response);
    }
    return Promise.reject(error);
  },
);

function handleErrorMessage(response: any) {
  let message = '';
  if (response?.status === 403) {
    message = 'Você não tem permissão para executar essa operação.';
  } else {
    message = 'Não foi possível processar sua solicitação. Tente novamente mais tarde ou entre em contato';
  }
  if (response?.data?.error) message = response.data.error;
  console.error({ type: 'error', text: message });
}

export class AxiosAdapter implements HttpClient {
  async get<T>(url: string): Promise<T> {
    const response = await api.get<T>(url);
    return response.data;
  }

  async post<T, Y>(url: string, body: T): Promise<Y> {
    const response = await api.post<Y>(url, body);
    return response.data;
  }

  async put<T, Y>(url: string, body: T): Promise<Y> {
    const response = await api.put<Y>(url, body);
    return response.data;
  }

  async delete(url: string): Promise<unknown> {
    const response = await api.delete(url);
    return response.data;
  }
}

export { api };
