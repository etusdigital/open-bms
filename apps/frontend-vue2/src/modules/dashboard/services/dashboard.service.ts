import ApiService from '@/services/api.service';

export default class DashboardService {
  private api = new ApiService();

  async getDashboardData(
    startDate?: Date | string,
    endDate?: Date | string,
    filters?: {
      campaigns?: string[];
      automations?: string[];
      messages?: string[];
      afterTestAb?: boolean;
      tags?: string[];
      segments?: string[];
      senders?: string[];
      subUsers?: string[];
      groupByMessage?: boolean;
      groupByCampaign?: boolean;
      type?: string;
    },
    router = '/statistics/email'
  ) {
    const params = {
      startDate: typeof startDate === 'string' ? startDate : startDate?.toISOString().slice(0, 10),
      endDate: typeof endDate === 'string' ? endDate : endDate?.toISOString().slice(0, 10),
      ...filters,
    };

    const api = await this.api.getApi();
    return await api.get(router, { params });
  }

  async getLeadsData(startDate?: Date, endDate?: Date, groupItems?: string[], search?: string[]) {
    const params = {
      startDate: startDate?.toISOString().slice(0, 10),
      endDate: endDate?.toISOString().slice(0, 10),
      groupItems,
      search,
    };

    const api = await this.api.getApi();
    return await api.get('/statistics/leads', { params });
  }

  async getInsightsData(period?: string) {
    const api = await this.api.getApi();
    return await api.get(`/statistics/insights/${period}`);
  }

  async get2FAStatistics(startDate?: Date, endDate?: Date, method?: string, group?: string[]) {
    const api = await this.api.getApi();
    const params = {
      startDate: startDate?.toISOString().slice(0, 10),
      endDate: endDate?.toISOString().slice(0, 10),
      method,
      group,
    };

    return await api.get(`/verify/statistics`, {
      params,
    });
  }
}
