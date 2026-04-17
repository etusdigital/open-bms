import ApiService from '@/services/api.service';
import { TagDto } from './../dtos/tag.dto';
import { SegmentDto } from '../../segment/dtos/segment.dto';

export default class TagService {
  private api = new ApiService();

  async getTags(params?: any, accountId?: number) {
    const api = await this.api.getApi();
    const headers = accountId ? { 'Account-Id': accountId } : {};
    return await api.get(`tags`, { params, headers });
  }

  async getTagById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`tags/${id}`);
  }

  async createTag(tagDto: TagDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`tags`, tagDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async createSegment(segmentDto: SegmentDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`tags/segment`, segmentDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async createSegmentCopy(id: number) {
    try {
      const api = await this.api.getApi();
      return await api.post(`tags/segment/${id}/copy`);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateSegment(segmentDto: SegmentDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`tags/segment/${segmentDto.id}`, segmentDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateTag(id: number, tagDto: TagDto) {
    try {
      const api = await this.api.getApi();
      delete tagDto.recurrence;
      delete tagDto.scheduleCloudTaskId;
      delete tagDto.query;
      delete tagDto.steps;
      delete tagDto.segmentInfo;
      delete tagDto.contactsLimit;
      delete tagDto.addBounced;
      delete tagDto.addUnsubscribed;
      delete tagDto.addInvalid;
      return await api.put(`tags/${id}`, tagDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteTag(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`tags/${id}`);
  }

  async runSegment(id: number) {
    const api = await this.api.getApi();
    return await api.get(`tags/segment/run/${id}`);
  }

  async checkProcessing(id: number) {
    const api = await this.api.getApi();
    return await api.get(`tags/segment/check/${id}`);
  }

  async checkAvailableName(titleCreate: string, id?: number) {
    const api = await this.api.getApi();
    const params = { titleCreate, id };
    return await api.get(`tags/validate-name`, { params });
  }
}
