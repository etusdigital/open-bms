import ApiService from '@/services/api.service';
import { FileUploadDto } from '../dtos/file-upload.dto';

export default class ProfileService {
  private api = new ApiService();

  async getUsers(filters?: any) {
    const api = await this.api.getApi();

    return await api.get(`users`, { ...filters });
  }

  async updateUser(filters?: any) {
    const api = await this.api.getApi();
    return await api.put(`users/${filters.id}`, filters);
  }

  async updateUserPassword(filters?: any) {
    const api = await this.api.getApi();
    return await api.put(`users/update-password/${filters.id}`, filters);
  }

  async getUserById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`users/${id}`);
  }

  async associateAccounts(filters?: any) {
    const api = await this.api.getApi();
    return await api.post(`users/permissions`, { ...filters });
  }

  async createNewUser(userDto: any) {
    const api = await this.api.getApi();
    return await api.post(`users`, { ...userDto });
  }

  async uploadImages(imagesDto: Array<FileUploadDto>) {
    try {
      const api = await this.api.getApi();
      return await api.post(`buckets`, imagesDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }
}
