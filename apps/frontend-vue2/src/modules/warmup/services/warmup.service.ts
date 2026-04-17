import ApiService from '@/services/api.service';
import { WarmupDto } from './../dtos/warmup.dto';

export default class WarmupService {
  private api = new ApiService();

  async getWarmups(filters?: any) {
    const api = await this.api.getApi();
    let params = null;
    if (filters) {
      params = { ...filters };
    }

    return await api.get(`warmups`, { params });
  }

  async createWarmup(warmupDto: WarmupDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`warmups`, warmupDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getWarmupById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`warmups/${id}`);
  }

  async updateWarmup(id: number, warmupDto: WarmupDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`warmups/${id}`, warmupDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteWarmup(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`warmups/${id}`);
  }

  async getSendgridIps() {
    const api = await this.api.getApi();
    return await api.get(`pools/sendgrid/ips`);
  }

  async getStatistics(startDate: Date | string, endDate: Date | string, warmup: WarmupDto) {
    const params = {
      startDate: typeof startDate === 'string' ? startDate : startDate.toISOString().slice(0, 10),
      endDate: typeof endDate === 'string' ? endDate : endDate.toISOString().slice(0, 10),
      campaigns: [warmup.campaignId],
      type: 'email',
    };

    const api = await this.api.getApi();
    api.defaults.headers['Account-Id'] = warmup.targetAccountId;
    return await api.get('/statistics/email', { params });
  }
}
