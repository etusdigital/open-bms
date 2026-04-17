import ApiService from '@/services/api.service';
import { SortDirectionEnum } from './../../../enums/sort-direction.enum';
import { AutomationsFiltersDto } from './../dtos/automations-filters.dto';
import { AutomationOrderFilterEnum } from '../enums/automation-order-filter.enum';
import { AutomationStatusFilterEnum } from './../enums/automation-status-filter.enum';
import { AutomationPatchDto } from '../dtos/automation-patch.dto';
import { AutomationDto } from './../dtos/automation.dto';
import { Pagination } from '@/models/pagination';
import { TagsSearchDto } from '../dtos/tags-search.dto';
import { i18n } from '@/main';

export default class AutomationsService {
  private api = new ApiService();

  async getAutomations(pagination?: Pagination, filters?: AutomationsFiltersDto) {
    try {
      const api = await this.api.getApi();
      let params = { ...filters };
      if (pagination) {
        params = { ...pagination, ...params };
      }

      return await api.get(`automations`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async getAutomation(id: number) {
    const api = await this.api.getApi();
    return await api.get(`automations/${id}`);
  }

  async getAutomationStatistics(id: number) {
    const api = await this.api.getApi();
    return await api.get(`statistics/automation/${id}`);
  }

  async createAutomation(automationDto: AutomationDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`automations/complete`, automationDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async createFullAutomation(automationDto: AutomationDto) {
    try {
      const api = await this.api.getApi();
      return await api.post(`automations/complete`, automationDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateFullAutomation(automationDto: AutomationDto) {
    try {
      const api = await this.api.getApi();
      return await api.put(`automations/complete`, automationDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async deleteAutomation(id: number) {
    const api = await this.api.getApi();
    return await api.delete(`automations/${id}`);
  }

  async updateAutomation(automationDto: AutomationDto) {
    const api = await this.api.getApi();
    return await api.put(`automations/complete`, automationDto);
  }

  async disassociateAutomation(automationDto: AutomationDto) {
    const api = await this.api.getApi();
    return await api.put(`automations/disassociate/${automationDto.id}`, automationDto);
  }

  async patchAutomation(automationDto: AutomationPatchDto) {
    const api = await this.api.getApi();
    return await api.patch(`automations/${automationDto.id}`, automationDto);
  }

  async createAutomationCopy(id: number) {
    try {
      const api = await this.api.getApi();
      return await api.post(`automations/${id}/copy`);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  getFilterStatusOptions() {
    return [
      { id: 2, label: i18n.t('input.active'), value: AutomationStatusFilterEnum.Active },
      { id: 3, label: i18n.t('input.inactive'), value: AutomationStatusFilterEnum.Inactive },
    ];
  }

  getFilterOrderByOptions() {
    return [
      {
        id: 1,
        label: i18n.t('input.lastTime'),
        value: AutomationOrderFilterEnum.Edited,
        order: SortDirectionEnum.Desc,
      },
      {
        id: 2,
        label: i18n.t('input.oldestCreated'),
        value: AutomationOrderFilterEnum.Created,
        order: SortDirectionEnum.Asc,
      },
      {
        id: 3,
        label: i18n.t('input.newestCreated'),
        value: AutomationOrderFilterEnum.Created,
        order: SortDirectionEnum.Desc,
      },
      {
        id: 4,
        label: i18n.t('input.alphabeticalA'),
        value: AutomationOrderFilterEnum.Alphabetic,
        order: SortDirectionEnum.Asc,
      },
      {
        id: 5,
        label: i18n.t('input.alphabeticalZ'),
        value: AutomationOrderFilterEnum.Alphabetic,
        order: SortDirectionEnum.Desc,
      },
    ];
  }

  async getTags(params?: TagsSearchDto) {
    try {
      const api = await this.api.getApi();

      return await api.get(`tags/`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async getLeadsByAutomationSteps(automationId: number, automationTitle: string, stepId: number) {
    try {
      const api = await this.api.getApi();
      const params = { automationId, automationTitle, stepId };

      return await api.get(`automations/lead-state`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async getAutomationList() {
    const api = await this.api.getApi();
    return await api.get(`messages/select-message-filter`);
  }

  async getAutomationAudits(id: number) {
    const api = await this.api.getApi();
    return await api.get(`audits/${id}`);
  }

  async getStatisticsAutomation(category: string, daysFilter: number, campaign = false) {
    const tzoffset = new Date().getTimezoneOffset() * 60000;
    let startDate: any = new Date(Date.now() - tzoffset);
    let endDate: any = new Date(Date.now() - tzoffset);

    startDate.setDate(startDate.getDate() - daysFilter);
    startDate = startDate.toISOString().slice(0, 10);
    endDate = daysFilter === 1 && !campaign ? startDate : endDate.toISOString().slice(0, 10);

    const params = { category, endDate, startDate };

    const api = await this.api.getApi();
    return await api.get(`automations/message/statistics`, { params });
  }

  async getStatisticsMessage(email: any, webPush: any, mobilePush: any, daysFilter: number, automationId: number) {
    const tzoffset = new Date().getTimezoneOffset() * 60000; // offset in milliseconds
    let startDate: any = new Date(Date.now() - tzoffset);
    let endDate: any = new Date(Date.now() - tzoffset);

    startDate.setDate(startDate.getDate() - daysFilter);
    startDate = startDate.toISOString().slice(0, 10);
    endDate = daysFilter === 1 ? startDate : endDate.toISOString().slice(0, 10);

    const params = { email, webPush, mobilePush, endDate, startDate, automationId };

    const api = await this.api.getApi();
    return await api.get(`statistics/messages`, { params });
  }

  async getPools() {
    const api = await this.api.getApi();
    return await api.get(`pools`);
  }

  async checkAvailableName(titleCreate: string, id?: number) {
    const api = await this.api.getApi();
    const params = { titleCreate, id };
    return await api.get(`automations/validate-name`, { params });
  }

  async httpRequestTest(step: any) {
    try {
      const api = await this.api.getApi();
      return await api.post(`automations/http-request-test`, step);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async activeCampaignLists(step: any) {
    const api = await this.api.getApi();
    return await api.get(`automations/active-campaign-lists`, { params: step });
  }

  async getAutomationGoalsStatistics(automationId: number, startDate: string, endDate: string) {
    const api = await this.api.getApi();
    const params = { automationId, startDate, endDate };
    return await api.get(`automations/target/statistics`, { params });
  }
}
