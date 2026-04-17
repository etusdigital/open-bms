import ApiService from '@/services/api.service';
import { CustomFieldsDto } from '../dtos/customFieldsdto';

export default class CustomFieldsService {
  private api = new ApiService();

  async getCustomFields(filters?: any) {
    const api = await this.api.getApi();

    let params = null;

    if (filters) {
      params = { ...filters };
    }

    return await api.get(`custom-fields`, { params });
  }

  async getCustomFieldById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`custom-fields/${id}`);
  }

  async createCustomField(customFieldDto: CustomFieldsDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`custom-fields`, customFieldDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateCustomField(id: number, customFieldDto: CustomFieldsDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`custom-fields/${id}`, customFieldDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteCustomField(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`custom-fields/${id}`);
  }
}
