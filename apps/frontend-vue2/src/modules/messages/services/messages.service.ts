import { MessageDto } from '../dtos/message.dto';
import ApiService from '@/services/api.service';

export default class MessagesService {
  private api = new ApiService();

  async getMessages(params?: any) {
    try {
      const api = await this.api.getApi();
      return await api.get(`messages`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async getMessageById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`messages/${id}`);
  }

  async getMessageClickStatistics(id: number, filterId?: number, filterType?: 'campaign' | 'automation') {
    const api = await this.api.getApi();
    return await api.get(`messages/${id}/click-statistics`, { params: { filterId, filterType } });
  }

  async createMessage(messageDto: MessageDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`messages`, messageDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateMessage(messageDto: MessageDto) {
    const api = await this.api.getApi();
    return await api.put(`messages/${messageDto.id}`, messageDto);
  }

  async deleteMessage(id?: number) {
    const api = await this.api.getApi();
    return await api.delete(`messages/${id}`);
  }

  async createMessageCopy(id: number) {
    try {
      const api = await this.api.getApi();
      return await api.post(`messages/${id}/copy`);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getPools(params?: any) {
    const api = await this.api.getApi();
    return await api.get(`pools`, { params });
  }

  async getAutomationList() {
    const api = await this.api.getApi();
    return await api.get(`messages/select-message-filter`);
  }

  async checkAvailableName(titleCreate: string, id?: number, type?: string) {
    const api = await this.api.getApi();
    const params = { titleCreate, id, type };
    return await api.get(`messages/validate-name`, { params });
  }

  async finishTest(step: any) {
    try {
      const api = await this.api.getApi();
      return await api.post(`automations/stop-testab`, step);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async improveContent(params: any) {
    const api = await this.api.getApi();
    return await api.post(`messages/template/improve`, params);
  }
}
