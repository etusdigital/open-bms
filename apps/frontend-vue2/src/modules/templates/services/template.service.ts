import { SortDirectionEnum } from './../../../enums/sort-direction.enum';
import ApiService from '@/services/api.service';
import { Pagination } from '@/models/pagination';
import { TemplateDto } from './../dtos/template.dto';

export default class TemplateService {
  private api = new ApiService();

  async createTemplateCopy(id: number) {
    try {
      const api = await this.api.getApi();
      return await api.post(`email-template/${id}/copy`);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getTemplates(filters?: any) {
    const api = await this.api.getApi();
    let params = null;
    if (filters) {
      params = { ...filters };
    }
    return await api.get(`email-template`, { params });
  }

  async createTemplate(templateDto: TemplateDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`email-template`, templateDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getTemplateById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`email-template/${id}`);
  }

  async updateTemplate(id: number, templateDto: TemplateDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`email-template/${id}`, templateDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteTemplate(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`email-template/${id}`);
  }
}
