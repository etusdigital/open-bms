import axios, { AxiosInstance } from 'axios';
import { i18n } from '@/main';
import store from '@/store';
import AuthService from '@/services/auth.service';
import ToastService from '@/services/toast.service';
import LoadingService from '@/services/loading.service';

const auth = new AuthService();

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

export default class ApiService {
  private readonly toastService = new ToastService();
  private readonly loadingService = new LoadingService();

  public async getApi() {
    const usertoken = await auth.getAccessToken();
    const user = await auth.getUser();
    const baseURL = process.env.VUE_APP_API_URL;
    const instance: AxiosInstance = axios.create({
      baseURL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${usertoken}`,
        'Current-User': `${JSON.stringify({ name: user?.name, email: user?.email })}`,
        'Account-Id': store.state.currentAccount?.id || '',
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
      }
    );
    instance.interceptors.response.use(
      (response) => {
        if (['/users/login', 'accounts/configs'].includes(response.config.url as string)) {
          store.commit('setIsLoadingPageVisible', false);
        }
        return response;
      },
      async (error) => {
        if (error.response?.status !== 401) {
          this.handleErrorMessage(error.response);
        }
        return Promise.reject(error);
      }
    );
  }

  async handleErrorMessage(response: any) {
    let userErrorMsg = '';
    switch (response?.status) {
      case 403:
        userErrorMsg = i18n.t('warning.dontHavePermission') as string;
        break;

      default:
        userErrorMsg = i18n.t('warning.cannotProcessRequest') as string;
        break;
    }

    if (response?.data?.error) {
      userErrorMsg = response.data.error;
    }
    if (response?.data?.message) {
      userErrorMsg = response.data.message.replace('Request validation of body failed, because:', '');
    }
    if (response?.status === 406 && response?.data.message) {
      userErrorMsg = i18n.t(`automationsErrors.${response.data.message}`) as string;
    }
    this.loadingService.hide();
    this.toastService.show({
      type: 'error',
      text: userErrorMsg,
    });
  }

  async getImageBase64(image: string) {
    try {
      const api = await this.getApi();

      return await api.post(`buckets/base64`, { url: image });
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async uploadImages(imagesDto: Array<FileUploadDto>) {
    try {
      const api = await this.getApi();
      return await api.post(`buckets`, imagesDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async genericUpload(file: GenericUploadDto) {
    try {
      const api = await this.getApi();
      return await api.post(`buckets/generic-upload`, file);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }
}
