import ApiService from '@/services/api.service';
import { CustomEventDto } from './../dtos/custom-event.dto';

export default class CustomEventService {
  private api = new ApiService();

  async getCustomEvents(params?: any) {
    const api = await this.api.getApi();

    return await api.get(`custom-events`, { params });
  }

  async getCustomEventById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`custom-events/${id}`);
  }

  async createCustomEvent(customEventDtop: CustomEventDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`custom-events`, customEventDtop);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateCustomEvent(id: number, customEventDtop: CustomEventDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`custom-events/${id}`, customEventDtop);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteCustomEvent(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`custom-events/${id}`);
  }

  async getEventsLogs(id: number, params?: any) {
    const api = await this.api.getApi();
    return await api.get(`custom-events/${id}/logs`, { params });
  }
}
