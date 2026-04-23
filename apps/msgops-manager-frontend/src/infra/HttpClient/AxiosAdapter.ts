import axios, { AxiosInstance } from 'axios';
import { auth0 } from '../Auth';
import type { HttpClient } from './HttpClient.types';
import { useAccountStore, useUserStore } from '../../stores';

export class AxiosAdapter implements HttpClient {
  private async getApi() {
    const accountStore = useAccountStore().account?.id;
    const userId = useUserStore().user;
    const currentUser = { name: auth0.user?.value?.name, email: auth0.user?.value?.email };
    const accessTokenSilently = await auth0.getAccessTokenSilently();

    const instance: AxiosInstance = axios.create({
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessTokenSilently}`,
        'Current-User': `${JSON.stringify(currentUser)}`,
        'Account-Id': accountStore,
        'User-Id': userId?.id,
        Admin: true,
      },
    });
    this.interceptors(instance);
    return instance;
  }

  interceptors(instance: AxiosInstance) {
    instance.interceptors.request.use(
      (conf) => {
        return conf;
      },
      (error) => {
        return Promise.reject(error);
      },
    );
    instance.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        if (error.response.status !== 401) {
          this.handleErrorMessage(error.response);
        }
        return Promise.reject(error);
      },
    );
  }

  async handleErrorMessage(response: any) {
    let message = '';
    if (response.status === 403) {
      message = 'Você não tem permissão para executar essa operação.';
    } else {
      message = 'Não foi possível processar sua solicitação. Tente novamente mais tarde ou entre em contato';
    }
    if (response?.data?.error) {
      message = response.data.error;
    }
    console.error({
      type: 'error',
      text: message,
    });
  }

  async get<T>(url: string): Promise<T> {
    const axiosInstance = await this.getApi();
    const response = await axiosInstance.get<T>(url);
    return response.data;
  }

  async post<T, Y>(url: string, body: T): Promise<Y> {
    const axiosInstance = await this.getApi();
    const response = await axiosInstance.post<Y>(url, body);
    return response.data;
  }

  async put<T, Y>(url: string, body: T): Promise<Y> {
    const axiosInstance = await this.getApi();
    const response = await axiosInstance.put<Y>(url, body);
    return response.data;
  }

  async delete(url: string): Promise<unknown> {
    const axiosInstance = await this.getApi();
    const response = await axiosInstance.delete(url);
    return response.data;
  }
}
