import ApiService from '@/services/api.service';
import { AxiosInstance } from 'axios';
import { Pagination } from '@/models/pagination';
import { CampaignsFiltersDto } from '@/modules/campaigns/dtos/campaings-filters.dto';
import { CampaignsDto } from '@/modules/campaigns/dtos/campaigns.dto';

export default class CampaignService {
  private api = new ApiService();

  async getCampaigns({
    pagination,
    filters,
    title,
    type,
    isTrigger,
  }: {
    pagination?: Pagination;
    title?: string;
    filters?: CampaignsFiltersDto;
    type?: string;
    isTrigger?: boolean;
  }) {
    try {
      const api = await this.api.getApi();
      let params = {
        ...filters,
        title,
        type,
        isTrigger,
        startDate: filters?.startDate?.toISOString().slice(0, 10),
        endDate: filters?.endDate?.toISOString().slice(0, 10),
      };

      if (pagination) {
        delete pagination.totalItems;
        delete pagination.totalPages;
        params = { ...pagination, ...params };
      }

      return await api.get(`campaigns`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async duplicateCampaign(id: number) {
    try {
      const api = await this.api.getApi();
      return await api.post(`campaigns/duplicate/${id}`);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getCampaignById(campaignId: number) {
    try {
      const api = await this.api.getApi();

      return (await api.get(`campaigns/${campaignId}`)).data;
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateCampaignById(campaignId: number, campaignObj: any) {
    try {
      const api = await this.api.getApi();

      return (await api.put(`campaigns/${campaignId}`, campaignObj)).data;
    } catch (err) {
      console.error(err);
    }
  }

  async getTriggers() {
    try {
      const api: AxiosInstance = await this.api.getApi();

      return await api.get('triggers');
    } catch (err) {
      console.error(err);
    }
  }

  async checkAvailableName(titleCreate: string, id?: number, type: 'name' | 'title' = 'name') {
    const api = await this.api.getApi();
    const params = { titleCreate, id, type };
    return await api.get(`campaigns/validate-name`, { params });
  }

  async countValidContacts(campaignDto: CampaignsDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`campaigns/count-contacts`, campaignDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }
}
