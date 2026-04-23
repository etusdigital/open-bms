<template>
  <div class="view-trigger-campaign">
    <div class="title-route trigger-title">
      <h2 class="c-title">{{ $t('sidebar.triggerCampaign') }}</h2>
      <button
        v-if="$store.getters.can('campaigns:create') || $store.getters.can('campaigns:create_from_rule')"
        class="v-btn-icon button-create"
        @click="$router.push('/trigger-campaign/new')"
      >
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="add-span">{{ $t('button.create').toString().toUpperCase() }}</span>
      </button>
    </div>
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="search-input-size">
        <InputDefault
          :modelValue="filter.title"
          :placeholder="`${$t('input.search')}`"
          :prependIcon="'search'"
          :keyInput="'title'"
          @click="filterByTitle"
          @updateInput="updateInput"
        />
      </div>
    </form>
    <div class="mt-7">
      <DataLoader :isLoading="isLoadingCampaigns" :type="'table-tbody, table-tbody'" class="mt-4" />
      <div :class="isLoadingCampaigns ? 'd-none' : ''">
        <v-data-table
          v-if="campaigns.length > 0"
          :headers="headers"
          :items="campaigns"
          :page.sync="pagination.page"
          :items-per-page="pagination.itemsPerPage"
          hide-default-footer
          class="c-table"
          :calculate-widths="true"
          :no-data-text="`${$t('datatable.noCampaign')}`"
          :loading="isLoadingCampaigns"
          :server-items-length="pagination.totalItems"
          :options.sync="options"
        >
          <template v-slot:[`item.title`]="{ item }">
            <div class="td-item">
              <router-link
                :to="{ name: 'edit-trigger-campaign', params: { id: item.id } }"
                :title="`${$t('create.viewInfo')}`"
                class="cursor-pointer font-12 font-title-semibold"
                style="white-space: nowrap"
              >
                {{ item.title }}
              </router-link>

              <p class="m-0 mt-1 text--secondary font-12" v-if="item.description">
                {{ item.description }}
              </p>
            </div>
          </template>
          <template v-slot:[`item.type`]="{ item }">
            <div
              v-tooltip.top="
                `${$t(`datatable.${item.type === 'trigger' ? 'simple' : item.type}`)}${
                  item.testabCriteria ? `: ${$t(`datatable.${item.testabCriteria}`)}` : ''
                }`
              "
            >
              <img :src="getCustomIcon('type', item.type)" class="icon-size" />
            </div>
          </template>
          <template v-slot:[`item.messageType`]="{ item }">
            <div class="message-type-icon">
              <div v-tooltip.top="`${$t(`datatable.${item.messageType}`)}`">
                <img
                  v-if="item.messageType === 'whatsapp'"
                  :src="getCustomIcon('message', item.messageType)"
                  class="icon-size size-message"
                />
                <span v-else class="material-symbols-rounded ds-gray-color font-20">
                  {{ getCustomIcon('message', item.messageType) }}
                </span>
              </div>
            </div>
          </template>
          <template v-slot:[`item.updatedAt`]="{ item }">
            <div class="td-item tabular-nums font-12">
              <span> {{ item.updatedAt || item.createdAt | formatDateTime }} </span>
            </div>
          </template>

          <template v-slot:[`item.sentContacts`]="{ item }">
            <div class="td-item tabular-nums font-12">
              {{ item.sentContacts | formatNumber }}
            </div>
          </template>

          <template v-slot:[`item.deliveredRate`]="{ item }">
            <div class="td-item tabular-nums font-12 div-row gap-5 justify-end">
              {{ item.deliveredRate }}
            </div>
          </template>

          <template v-slot:[`item.openRate`]="{ item }">
            <div class="td-item tabular-nums font-12">
              {{ item.openRate }}
            </div>
          </template>

          <template v-slot:[`item.ctr`]="{ item }">
            <div class="td-item tabular-nums font-12">{{ item.ctr }}</div>
          </template>

          <template v-slot:[`item.ctor`]="{ item }">
            <div class="td-item tabular-nums font-12">{{ item.ctor }}</div>
          </template>

          <template v-slot:[`item.unsubscribe`]="{ item }">
            <div class="td-item tabular-nums font-12">
              {{ item.unsubscribe | formatNumber }}
            </div>
          </template>

          <template v-slot:[`item.bounce`]="{ item }">
            <div class="td-item tabular-nums font-12 pr-2">
              {{ item.bounce | formatNumber }}
            </div>
          </template>

          <template v-slot:[`item.actions`]="{ item }">
            <div class="td-item text-end div-row">
              <!-- <button
                @click="doCopy(item)"
                :title="`${$t('button.duplicate')}`"
                class="cursor-pointer mx-2 button-copy"
                v-tooltip.top="$t('button.duplicate')"
              >
                <span class="material-symbols-rounded ds-light-gray-color font-20">content_copy</span>
              </button> -->
              <button
                v-if="$store.getters.can('campaigns:delete')"
                @click="confirmDeleteCampaign(item)"
                :title="`${$t('button.exclude')}`"
                class="cursor-pointer button-trash"
                v-tooltip.top="$t('button.delete')"
              >
                <span class="material-symbols-rounded ds-light-gray-color font-20">delete</span>
              </button>
            </div>
          </template>
        </v-data-table>
        <div v-if="campaigns.length === 0 && !isLoadingCampaigns" class="container-no-results">
          <img src="@/assets/campaign_fill.svg" width="80" height="80" />
          <p class="font-16 font-title-style">{{ $t('datatable.noCampaigns') }}</p>
          <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
        </div>
      </div>
    </div>
    <div v-if="campaigns.length > 0" class="text-center pagination pt-5 align-items-center justify-space-between">
      <div class="div-row gap-5 align-items-center">
        <span class="d-flex text-400 font-12 text-nowrap align-items-center">{{ $t('input.itemsPerPage') }}</span>
        <select
          class="select-items-per-page font-12 text-400"
          @change="setItemsNumber($event.target.value)"
          v-model="pagination.itemsPerPage"
        >
          <option class="font-12 text-400" v-for="item in selectItemsPerPage" :value="item.value" :key="item.value">
            {{ item.text }}
          </option>
        </select>
      </div>
      <v-pagination
        v-if="campaigns.length > 0"
        v-model="pagination.page"
        class="c-pagination"
        :length="pagination.totalPages"
        :total-visible="10"
        @input="handlePagination"
      ></v-pagination>
      <span class="font-12 text-400 text-nowrap">
        {{ $t('datatable.showing') }}
        {{
          $t('datatable.contactsTotal', {
            rangeStart: rangeStart,
            rangeFinal: rangeFinal,
            total: pagination.totalItems,
          })
        }}
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import InputDefault from '@/components/input/InputDefault.vue';
import { Pagination } from '@/models/pagination';
import CampaignService from '@/services/campaign.service';
import { getItemsPerPage, setItemsPerPage } from '@/util/objects';
import ToastService from '@/services/toast.service';
import ApiService from '@/services/api.service';
import { CampaignMessageType, CampaignsType } from '@/modules/campaigns/enums/campaign.enum';
import DataLoader from '@/components/data-loader/DataLoader.vue';

import ModalService from '@/services/modal.service';
import { areObjectsEqual } from '@/util/objects';
import { StatusCampaignEnum } from '@/modules/campaigns/enums/campaign.enum';
import DashboardService from '../dashboard/services/dashboard.service';
import { formatDateTz } from '@/util/date';
import { mapState } from 'vuex';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  providers: [],
  components: {
    InputDefault,
    DataLoader,
  },
  computed: {
    ...mapState(['currentAccountTimezone']),
  },
})
export default class TriggerCampaignList extends Vue {
  currentAccountTimezone!: string;
  private readonly campaignService = new CampaignService();
  private readonly toastService = new ToastService();
  private readonly apiService = new ApiService();
  private readonly modalService = new ModalService();
  private readonly dashboardService = new DashboardService();
  public userLanguage!: string;
  pagination = new Pagination();
  campaigns: any[] = [];
  isLoadingCampaigns = false;
  hasPageLoaded = false;
  currentEditingCampaign: any;
  options: any = {
    page: 1,
    sortBy: ['scheduleTo'],
    sortDesc: [true],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  itemsNumber = 10;
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  rangeStart = 0;
  rangeFinal = 0;
  isDataLoaded = false;
  filter: any = {
    title: '',
  };
  headers: any = [
    {
      text: this.$t('datatable.name'),
      value: 'title',
      sortable: true,
      width: '20%',
      class: 'font-title-header',
    },
    { text: this.$t('datatable.message'), value: 'messageType', sortable: true, width: '5%', align: 'center' },
    { text: this.$t('datatable.lastEdition'), value: 'updatedAt', sortable: true, width: '10%' },
    { text: this.$t('datatable.sended'), value: 'sentContacts', sortable: true, align: 'end', width: '10%' },
    { text: this.$t('datatable.delivered'), value: 'deliveredRate', sortable: true, align: 'end', width: '10%' },
    { text: this.$t('datatable.openRate'), value: 'openRate', sortable: true, align: 'end', width: '10%' },
    { text: 'CTR', value: 'ctr', sortable: true, align: 'end', width: '10%' },
    { text: 'CTOR', value: 'ctor', sortable: true, align: 'end', width: '10%' },
    { text: this.$t('datatable.unsubscribe'), value: 'unsubscribe', sortable: true, align: 'end', width: '10%' },
    { text: this.$t('datatable.bounce'), value: 'bounce', sortable: true, align: 'end', width: '10%' },
    { text: '', value: 'actions', sortable: false, width: '5%', cellClass: 'action', align: 'end' },
  ];

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('triggerCampaigns');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getValuesUrl();
    await this.getCampaigns();
    this.hasPageLoaded = true;
  }

  updateInput(event: any, key: any) {
    this.filter[key] = event;
  }

  filterByTitle() {
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  getValuesUrl() {
    if (this.$route.query.page) {
      this.pagination.page = Number(this.$route.query.page);
      this.pagination.itemsPerPage = Number(this.$route.query.itemsPerPage);
      this.pagination.sortBy = this.$route.query.sortBy?.toString() || 'scheduleTo';
      this.pagination.order = this.$route.query.order?.toString() || 'DESC';
      this.filter.title = this.$route.query.title?.toString() || '';

      if (
        Number(this.options.page) !== Number(this.$route.query.page) ||
        this.options.sortBy[0] !== this.$route.query.sortBy ||
        this.options.sortDesc[0] !== (this.$route.query.order === 'DESC')
      ) {
        this.options = {
          ...this.options,
          sortBy: [this.pagination.sortBy],
          sortDesc: [this.pagination.order === 'DESC'],
          page: Number(this.$route.query.page),
        };
      }

      return;
    }

    this.options = { ...this.options, page: 1, sortBy: ['scheduleTo'], sortDesc: [true] };
    this.pagination = { ...this.pagination, page: 1, sortBy: 'scheduleTo', order: 'DESC' };
    this.filter.title = '';
  }

  setValuesUrl() {
    if (!this.isDataLoaded) {
      return;
    }

    const newQuery = {
      sortBy: this.pagination.sortBy,
      order: this.pagination.order,
      page: this.pagination.page,
      itemsPerPage: this.pagination.itemsPerPage,
      title: this.filter.title,
    };

    if (areObjectsEqual(this.$route.query, newQuery) === false) {
      this.$router.push({ query: newQuery });
    }
  }

  handlePagination() {
    this.setValuesUrl();
    this.getCampaigns();
  }

  async getCampaigns(params?: Pagination) {
    if (this.isLoadingCampaigns) {
      return;
    }

    this.isLoadingCampaigns = true;
    if (params) {
      this.pagination = {
        page: params.page,
        itemsPerPage: params.itemsPerPage,
        totalPages: params.totalPages,
        sortBy: params.sortBy,
        order: params.order,
      };
    }
    try {
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      const result = await this.campaignService.getCampaigns({
        pagination: this.pagination,
        title: this.filter.title,
        isTrigger: true,
      });
      this.campaigns = result?.data?.results || [];

      this.pagination = {
        ...this.pagination,
        itemsPerPage: parseInt(result?.data?.itemsPerPage, 10),
        page: parseInt(result?.data?.page, 10),
        totalItems: result?.data?.totalItems,
        totalPages: Math.ceil(result?.data?.totalItems / result?.data?.itemsPerPage),
      };
      const calculateFinalRange = this.pagination.itemsPerPage + this.rangeStart - 1;
      this.rangeFinal =
        this.pagination.totalItems < calculateFinalRange ? this.pagination.totalItems : calculateFinalRange;
      this.setValuesUrl();
      await this.getMessageStatistics();
      this.isDataLoaded = true;
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoadingCampaigns = false;
    }
  }

  async copyCampaign(item: any) {
    if (!item) {
      return;
    }

    const campaign = item;

    if (campaign.id) {
      const response = await this.campaignService.duplicateCampaign(campaign.id);

      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.campaignDuplicated') as string,
          leftBorder: false,
        });
        this.$router.push(`/campaigns/${response.data.id}`);
      }
    }
  }

  confirmDeleteCampaign(item: any) {
    if (!item) {
      return;
    }

    const campaign = item;
    this.currentEditingCampaign = campaign;
    this.modalService.confirm({
      title: this.$t('modal.deleteCampaign') as string,
      text: `${this.$t('modal.confirmCampaign', { automation: this.currentEditingCampaign.title })}`,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.deleteCampaign,
    });
  }

  async deleteCampaign() {
    try {
      const api = await this.apiService.getApi();
      const response = await api.delete(`campaigns/${this.currentEditingCampaign.id}`);
      const idx = this.campaigns.indexOf(this.currentEditingCampaign);
      this.campaigns.splice(idx, 1);
      if (this.campaigns.length === 0 && response.status === 200) {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.campaignDeleted') as string,
          leftBorder: false,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  getCustomIcon(type: string, value: string) {
    if (type === 'type') {
      return require('@/assets/' + this.switchIconTypeCampaign(value) + '.svg');
    }
    if (type === 'message') {
      return value === 'whatsapp'
        ? require('@/assets/' + this.switchIconMessageTypeCampaign(value) + '.svg')
        : this.switchIconMessageTypeCampaign(value);
    }
  }

  switchIconMessageTypeCampaign(messageType: CampaignMessageType | string): string {
    switch (messageType) {
      case CampaignMessageType.EMAIL:
        return 'mail';
      case CampaignMessageType.WEBPUSH:
        return 'computer';
      case CampaignMessageType.MOBILEPUSH:
        return 'smartphone';
      case CampaignMessageType.SMS:
        return 'sms';
      case CampaignMessageType.WHATSAPP:
        return 'whatsapp';
      default:
        return 'unknown';
    }
  }

  switchIconTypeCampaign(type: CampaignsType | string): string {
    switch (type) {
      case CampaignsType.SIMPLE:
      case CampaignsType.TRIGGER:
        return 'simple';
      case CampaignsType.SPLIT:
        return 'split';
      case CampaignsType.TESTAB:
        return 'testab';
      case CampaignsType.RECURRING:
        return 'recurring';
      default:
        return 'unknown';
    }
  }

  setItemsNumber(items: number) {
    this.options = {
      ...this.options,
      itemsPerPage: Number(items),
      page: 1,
    };
    setItemsPerPage('campaigns', items);
    this.getCampaigns();
    this.getMessageStatistics();
  }

  async getMessageStatistics() {
    const campaignStats = await Promise.all(
      this.campaigns
        .filter((campaign) => campaign.status === StatusCampaignEnum.Completed)
        .map(async (campaign) => {
          if (!campaign?.id) {
            return null;
          }
          const tz = this.currentAccountTimezone || 'UTC';
          const startDate = formatDateTz(campaign.createdAt, tz);
          const endDate = dayjs().tz(tz).format('YYYY-MM-DD');

          const router = '/statistics/email';

          const response = await this.dashboardService.getDashboardData(
            startDate,
            endDate,
            {
              campaigns: [campaign.id.toString()],
              afterTestAb: false,
              type: campaign.messageType,
            },
            router
          );

          return {
            id: campaign.id,
            stats: response.data,
          };
        })
    );

    this.campaigns = this.campaigns.map((campaign) => {
      const stats = campaignStats.find((stat) => stat?.id === campaign.id)?.stats;
      return {
        ...campaign,
        openRate: this.calculateMetrics(stats?.general.open || 0, stats?.general.delivered || 0),
        ctr: this.calculateMetrics(stats?.general.click || 0, stats?.general.delivered || 0),
        ctor: this.calculateMetrics(stats?.general.click || 0, stats?.general.open || 0),
        unsubscribe: stats?.general.unsubscribe || 0,
        bounce: stats?.general.bounce || 0,
        deliveredRate: this.calculateMetrics(stats?.general.delivered || 0, campaign.sentContacts || 0),
      };
    });
  }

  calculateMetrics(clicks: number = 0, opens: number = 0): string {
    if (!opens || !clicks) {
      return '0%';
    }
    const rate = (clicks / opens) * 100;
    return new Intl.NumberFormat(this.userLanguage, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      style: 'percent',
    }).format(rate / 100);
  }

  @Watch('options')
  async onChangeOptions() {
    if (this.hasPageLoaded === false || this.isLoadingCampaigns) {
      return;
    }

    const { sortBy, sortDesc, page } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      sortBy: sortBy[0] || 'scheduleTo',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
    };
    this.setValuesUrl();

    await this.getCampaigns();
  }

  @Watch('$route')
  async changePagination() {
    if (this.hasPageLoaded === false || this.isLoadingCampaigns) {
      this.isDataLoaded = false;
      return;
    }
    if (Object.keys(this.$route.query || {}).length === 0) {
      this.isDataLoaded = false;
    }
    this.getValuesUrl();
    await this.getCampaigns();
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.view-trigger-campaign {
  padding: 15px;
}

.trigger-title {
  margin-top: -23px !important;
}

.break-word {
  word-break: break-word;
}

.font-title-style {
  font-weight: 600;
  line-height: 21px;
  margin-bottom: 5px;
}

.font-subtitle-style {
  line-height: 18px;
  font-weight: 400;
}

.container-no-results {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #ffffff;
  border-radius: 16px;
  width: 100%;
  height: 247px;
  padding: 20px;
}

.c-pagination {
  display: flex;
  width: 100%;
  justify-content: center;
}

::v-deep.c-table {
  margin-top: 16px;
  border-radius: 16px;
  width: 100%;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);

  th.text-start {
    white-space: nowrap;
  }

  .sucess--text {
    color: $ds-blue;
  }
}
</style>
