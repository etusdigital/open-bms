import { PostmasterFiltersDto } from '@/modules/messages/dtos/postmaster-filters.dto';
import ApiService from '@/services/api.service';

export default class PostmasterService {
  private api = new ApiService();

  async getPostmasterValues({ filters }: { filters?: PostmasterFiltersDto }) {
    const api = await this.api.getApi();
    const params = {
      ...filters,
      startDate: filters?.startDate?.toISOString().slice(0, 10),
      endDate: filters?.endDate?.toISOString().slice(0, 10),
    };
    return await api.get(`/postmaster`, { params });
  }
}
