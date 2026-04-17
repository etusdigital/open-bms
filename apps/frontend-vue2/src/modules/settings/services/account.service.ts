import ApiService from '@/services/api.service';
import { AccountConfigDto } from '../dtos/accountConfig.dto';

export default class TagService {
  private api = new ApiService();

  async updateAccount(id: number, accountDto: AccountConfigDto[]) {
    try {
      const api = await this.api.getApi();
      return await api.put(`accounts/providers/${id}`, accountDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }
}
