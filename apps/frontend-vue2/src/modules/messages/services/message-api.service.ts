import { GlockAppsTestResultInterface } from '@/modules/messages/interfaces/glock-apps-test-result.interface';
import ApiService from '@/services/api.service';
import { NewTestDto } from '../dtos/new-test.dto';

export default class MessageApiService {
  private api = new ApiService();

  async automationsCreateTests(newTestDto: NewTestDto) {
    try {
      const api = await this.api.getApi();

      return await api.post(`tests/automations/create`, newTestDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getGlockAppsTestResult(arrayGlockAppsResult: Array<GlockAppsTestResultInterface>) {
    try {
      const api = await this.api.getApi();

      return await api.post(`tests/list`, arrayGlockAppsResult);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }
}
