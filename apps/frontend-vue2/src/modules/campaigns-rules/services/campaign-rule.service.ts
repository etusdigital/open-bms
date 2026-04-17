import ApiService from '@/services/api.service';
import { CampaignConfigDto } from './../dtos/campaign-config.dto';

export default class CampaignRuleService {
  private api = new ApiService();

  async getCampaignsConfigs(params?: any) {
    const api = await this.api.getApi();
    return await api.get(`campaigns-rules/configs`, { params });
  }

  async getCampaignConfigById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`campaigns-rules/configs/${id}`);
  }

  async createCampaignConfig(configDto: CampaignConfigDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`campaigns-rules/configs`, configDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateCampaignConfig(configDto: CampaignConfigDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`campaigns-rules/configs/${configDto.id}`, configDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteCampaignConfig(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`campaigns-rules/configs/${id}`);
  }

  async getCampaignsRules(params?: any) {
    const api = await this.api.getApi();
    return await api.get(`campaigns-rules/rules`, { params });
  }

  async getCampaignRuleById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`campaigns-rules/rules/${id}`);
  }

  async createCampaignRule(configDto: CampaignConfigDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`campaigns-rules/rules`, configDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateCampaignRule(configDto: CampaignConfigDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`campaigns-rules/rules/${configDto.id}`, configDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteCampaignRule(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`campaigns-rules/rules/${id}`);
  }

  async getMessages(params: any) {
    const api = await this.api.getApi();
    return await api.get(`messages/template/emails-labels`, { params });
  }

  async getLanguages() {
    const api = await this.api.getApi();
    return await api.get(`messages/template/languages`);
  }

  async getProducts(params: any) {
    const api = await this.api.getApi();
    return await api.get(`messages/template/products`, { params });
  }

  async getCountries(params: any) {
    const api = await this.api.getApi();
    return await api.get(`messages/template/countries`, { params });
  }

  async createCopyConfig(id: number) {
    const api = await this.api.getApi();
    return await api.post(`campaigns-rules/configs/${id}/copy`);
  }
}
