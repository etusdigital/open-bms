import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { i18n } from '@/main';
import store from '@/store';
import { getAccessToken, refresh, logout } from '@/services/auth.service';
import ToastService from '@/services/toast.service';
import LoadingService from '@/services/loading.service';

export interface FileUploadDto {
  name: string;
  data: string;
  messageId: number;
  isAutomatedMessage: boolean;
}

export interface GenericUploadDto {
  name: string;
  data: string;
  pathFolderName: string;
  isPublic: boolean;
}

const toastService = new ToastService();
const loadingService = new LoadingService();

const api: AxiosInstance = axios.create({
  baseURL: process.env.VUE_APP_API_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken().catch(() => null);
  config.headers = config.headers || {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const user = store.state.currentUser;
  if (user) {
    config.headers['Current-User'] = JSON.stringify({ name: user.name, email: user.email });
  }
  if (store.state.currentAccount?.id) {
    config.headers['Account-Id'] = store.state.currentAccount.id;
  }
  return config;
});

function handleErrorMessage(response: any) {
  let userErrorMsg = '';
  switch (response?.status) {
    case 403:
      userErrorMsg = i18n.t('warning.dontHavePermission') as string;
      break;
    default:
      userErrorMsg = i18n.t('warning.cannotProcessRequest') as string;
      break;
  }
  if (response?.data?.error) userErrorMsg = response.data.error;
  if (response?.data?.message)
    userErrorMsg = String(response.data.message).replace('Request validation of body failed, because:', '');
  if (response?.status === 406 && response?.data.message)
    userErrorMsg = i18n.t(`automationsErrors.${response.data.message}`) as string;
  loadingService.hide();
  toastService.show({ type: 'error', text: userErrorMsg });
}

api.interceptors.response.use(
  (response) => {
    if (['/users/login', 'accounts/configs'].includes(response.config.url as string)) {
      store.commit('setIsLoadingPageVisible', false);
    }
    return response;
  },
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const isAuthEndpoint =
      original?.url?.includes('auth/refresh') ||
      original?.url?.includes('auth/login') ||
      original?.url?.includes('auth/logout');

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
  }
);

export { api };

export default class ApiService {
  public async getApi(): Promise<AxiosInstance> {
    return api;
  }

  async getImageBase64(image: string) {
    return api.post(`buckets/base64`, { url: image });
  }

  async uploadImages(imagesDto: Array<FileUploadDto>) {
    return api.post(`buckets`, imagesDto);
  }

  async genericUpload(file: GenericUploadDto) {
    return api.post(`buckets/generic-upload`, file);
  }
}
