import { Pagination } from '@/models/pagination';
import ApiService from '@/services/api.service';
import store from '@/store';
import { ContactsFiltersDto } from '../dto/contacts-filter.dto';
import { ContactsHeadersDto } from '../dto/contacts-headers.dto';
import { ContactsImportDto } from '../dto/contacts-import.dto';
import { ContactsDto } from '../dto/contacts.dto';
import { SuppressedsFiltersDto } from '../dto/suppresseds-filter.dto';

export default class ContactsService {
  private api = new ApiService();

  async getContactsKeys() {
    if (store.state.customFields.length !== 0) {
      return store.state.customFields;
    }

    try {
      const api = await this.api.getApi();

      const response = await api.get(`custom-fields`);
      store.commit('setCustomFields', response);

      return response;
    } catch (error) {
      console.log(error);
    }
  }

  async getContacts({
    pagination,
    filters,
    countOnly,
  }: {
    pagination?: Pagination;
    filters?: ContactsFiltersDto;
    countOnly?: boolean;
  }) {
    try {
      const api = await this.api.getApi();
      let params = {
        ...filters,
        countOnly,
        startDate: filters?.startDate?.toISOString().slice(0, 10),
        endDate: filters?.endDate?.toISOString().slice(0, 10),
      };

      if (pagination) {
        delete pagination.totalItems;
        delete pagination.totalPages;
        params = { ...pagination, ...params };
      }

      return await api.get(`contacts`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async getSuppressedContacts({
    pagination,
    filters,
    countOnly,
    blockedOnly,
  }: {
    pagination?: Pagination;
    filters?: SuppressedsFiltersDto;
    blockedOnly?: boolean;
    countOnly?: boolean;
  }) {
    try {
      const api = await this.api.getApi();
      let params = {
        ...filters,
        blockedOnly,
        countOnly,
        startDate: filters?.startDate?.toISOString().slice(0, 10),
        endDate: filters?.endDate?.toISOString().slice(0, 10),
      };

      if (pagination) {
        delete pagination.totalItems;
        delete pagination.totalPages;
        params = { ...pagination, ...params };
      }

      return await api.get(`contacts/suppressed`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async getContactById(id: number) {
    const api = await this.api.getApi();
    return await api.get(`contacts/${id}`);
  }

  async updateContact(contactDto: any) {
    try {
      const api = await this.api.getApi();
      return await api.put(`contact`, contactDto);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getTags() {
    const api = await this.api.getApi();
    return await api.get(`tags`);
  }

  async getContactsTotal() {
    const api = await this.api.getApi();
    return await api.get(`contacts/count`);
  }

  async exportContacts({
    pagination,
    filters,
    exportId,
    exportTotal,
  }: {
    pagination?: Pagination;
    filters?: ContactsFiltersDto;
    exportId: string;
    exportTotal: number;
  }) {
    try {
      const api = await this.api.getApi();
      let params = {
        ...filters,
        startDate: filters?.startDate?.toISOString().slice(0, 10),
        endDate: filters?.endDate?.toISOString().slice(0, 10),
        exportId,
        exportTotal,
      };

      if (pagination) {
        params = { ...pagination, ...params };
      }

      // Add responseType blob to handle as file
      const response = await api.get(`contacts/export-stream`, {
        params,
        responseType: 'blob',
      });

      // Create temporary URL for the blob
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);

      // Create temporary <a> element to force download
      const link = document.createElement('a');
      link.href = url;
      link.download = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
      link.style.display = 'none';

      // Add to DOM, click and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean temporary URL
      window.URL.revokeObjectURL(url);

      return response;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async exportInit({ pagination, filters }: { pagination?: Pagination; filters?: ContactsFiltersDto }) {
    let params = {
      ...filters,
      startDate: filters?.startDate?.toISOString().slice(0, 10),
      endDate: filters?.endDate?.toISOString().slice(0, 10),
    };

    if (pagination) {
      params = { ...pagination, ...params };
    }

    try {
      const api = await this.api.getApi();
      return await api.get(`contacts/export-init`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async getDashboardData() {
    const api = await this.api.getApi();
    return await api.get(`contacts/dashboard`);
  }

  async importContacts(params: {
    contacts: ContactsImportDto[];
    headers: ContactsHeadersDto[];
    tags: number[];
    actions: string[];
  }) {
    try {
      const api = await this.api.getApi();
      return await api.post(`contacts/import`, params);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async updateTag(params: { contacts: number[]; tags: number[]; action: string }) {
    try {
      const api = await this.api.getApi();
      return await api.post(`contacts/tags`, params);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async bulkUnsubscribe(params: { emails: string[]; allAccounts: boolean; block: boolean }) {
    try {
      const api = await this.api.getApi();
      return await api.post(`contacts/bulk-unsubscribe`, params);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async unsubscribe(
    { pagination, filters }: { pagination?: Pagination; filters?: ContactsFiltersDto },
    countOnly = false
  ) {
    let params = {
      ...filters,
      startDate: filters?.startDate?.toISOString().slice(0, 10),
      endDate: filters?.endDate?.toISOString().slice(0, 10),
    };

    if (pagination) {
      params = { ...pagination, ...params };
    }

    try {
      const api = await this.api.getApi();
      if (countOnly) {
        return await api.get(`contacts/count-unsubscribe`, { params });
      }
      return await api.post(`contacts/unsubscribe`, params);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getExportStatus(exportId: string) {
    try {
      const api = await this.api.getApi();
      return await api.get(`contacts/export-status/${exportId}`);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  }

  async getContactHistory(
    id: number,
    { pagination, filters }: { pagination?: Pagination; filters?: ContactsFiltersDto }
  ) {
    try {
      const api = await this.api.getApi();
      let params = {
        ...filters,
        startDate: filters?.startDate?.toISOString().slice(0, 10),
        endDate: filters?.endDate?.toISOString().slice(0, 10),
      };

      if (pagination) {
        params = { ...pagination, ...params };
      }

      return await api.get(`contacts/history/${id}`, { params });
    } catch (err) {
      console.error(err);
    }
  }

  async updateContactCustomField(params: {
    accountId: number;
    contactId: number;
    customFieldId: number;
    value: string | number;
    oldValue: string | number;
  }) {
    try {
      const api = await this.api.getApi();
      return await api.put(`contacts/custom-fields/edit`, params);
    } catch (err) {
      console.error(err);
    }
  }
}
