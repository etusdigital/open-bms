import ApiService from '@/services/api.service';
import { LabelDto } from './../dtos/label.dto';

export default class LabelService {
  private api = new ApiService();

  async getLabels(params?: any) {
    const api = await this.api.getApi();
    return await api.get(`labels`, { params });
  }

  async getLabelById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`labels/${id}`);
  }

  async createLabel(labelDto: LabelDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`labels`, labelDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateLabel(labelDto: LabelDto) {
    try {
      const api = await this.api.getApi();
      return await api.put('labels', labelDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteLabel(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`labels/${id}`);
  }
}
