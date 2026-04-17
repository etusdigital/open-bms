import ApiService from '@/services/api.service';
import { PoolDto } from './../dtos/pool.dto';

export default class PoolService {
  private api = new ApiService();

  async getPools(filters?: any) {
    const api = await this.api.getApi();
    let params = null;
    if (filters) {
      params = { ...filters };
    }
    return await api.get(`pools`, { params });
  }

  async getPoolSendgrid() {
    const api = await this.api.getApi();
    return await api.get(`pools/sendgrid`);
  }

  async getIPsSendgrid(poolName: string) {
    const api = await this.api.getApi();
    return await api.get(`pools/ips/sendgrid/${poolName}`);
  }

  async createPool(poolDto: PoolDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`pools`, poolDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getPoolById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`pools/${id}`);
  }

  async updatePool(id: number, poolDto: PoolDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`pools/${id}`, poolDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deletePool(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`pools/${id}`);
  }
}
