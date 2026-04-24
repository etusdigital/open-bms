<template>
  <div class="col-12 pt-0">
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="default-filters">
        <div class="default-filters__search-input">
          <InputDefault
            :modelValue="title"
            :placeholder="`${$t('input.searchSegment')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            :isLoading="isLoadingSegments"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>

          <select
            class="form-control mo-select border-color advanced-select bms-select"
            v-model="selectedStatusFilter"
            @change="getSegments"
          >
            <option
              class="option__desc option-select"
              v-for="status in statusOptions"
              :key="status.name"
              :value="status.name"
            >
              {{ status.value }}
            </option>
          </select>

          <div class="customize-metrics-menu" v-tooltip.bottom="`${$t(`button.table-personalization`)}`">
            <button type="button" @click="showCustomizeMetrics">
              <span class="material-symbols-rounded font-16">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="24px"
                  viewBox="0 -960 960 960"
                  width="24px"
                  fill="#5f6368"
                >
                  <path
                    d="M240-160q-33 0-56.5-23.5T160-240q0-33 23.5-56.5T240-320q33 0 56.5 23.5T320-240q0 33-23.5 56.5T240-160Zm0-240q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm0-240q-33 0-56.5-23.5T160-720q0-33 23.5-56.5T240-800q33 0 56.5 23.5T320-720q0 33-23.5 56.5T240-640Zm240 0q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Zm240 0q-33 0-56.5-23.5T640-720q0-33 23.5-56.5T720-800q33 0 56.5 23.5T800-720q0 33-23.5 56.5T720-640ZM480-400q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm40 240v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q8 9 12.5 20t4.5 22q0 11-4 22.5T863-380L643-160H520Zm300-263-37-37 37 37ZM580-220h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19Z"
                  />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </div>
    </form>
    <div v-if="segments.length > 0">
      <div class="mt-7">
        <DataLoader :isLoading="isLoadingSegments" :type="'table-tbody, table-tbody'" class="mt-4" />
        <div :class="isLoadingSegments ? 'd-none' : ''">
          <v-data-table
            v-if="segments.length > 0"
            :headers.sync="headers"
            :items="segments"
            :page.sync="pagination.page"
            :items-per-page="pagination.itemsPerPage"
            hide-default-footer
            class="c-table"
            :item-class="rowClasses"
            :calculate-widths="true"
            :no-data-text="`${$t('datatable.noCampaign')}`"
            :loading="isLoadingSegments"
            :server-items-length="pagination.totalItems"
            :options.sync="options"
          >
            <template v-slot:[`header.lastCount`]="{ header }">
              <span>{{ header.text }}</span>
              <span
                class="material-symbols-rounded ds-blue-color ml-1 font-20 v-align-text-bottom"
                v-tooltip.bottom="{ content: $t(`datatable.segments-tooltip`), html: true }"
              >
                info
              </span>
            </template>

            <template v-slot:[`item.name`]="{ item }">
              <div class="td-item">
                <router-link
                  :to="{ name: 'edit-segments', params: { segment_id: item.id } }"
                  :title="`${$t('create.viewInfo')}`"
                  class="cursor-pointer font-12 font-title-semibold"
                  style="white-space: nowrap"
                >
                  {{ item.name }}
                </router-link>

                <p class="m-0 mt-1 text--secondary font-12" v-if="item.description">
                  {{ item.description }}
                </p>
              </div>
            </template>

            <template v-slot:[`item.status`]="{ item }">
              <div class="td-item text-center">
                <span class="status-chip status-inactive font-10" v-if="item.status === 'inactive'">
                  {{ $t('datatable.inactive') }}
                </span>
                <span class="status-chip status-active font-10" v-else>
                  {{ $t('datatable.active') }}
                </span>
              </div>
            </template>

            <template v-slot:[`item.updatedAt`]="{ item }">
              <div class="td-item tabular-nums datetime-wrapper font-12">
                {{ item.updatedAt | formatDateTime }}
              </div>
            </template>

            <template v-slot:[`item.lastRunDate`]="{ item }">
              <div class="td-item tabular-nums datetime-wrapper font-12">
                {{ item.lastRunDate | formatDateTime }}
              </div>
            </template>

            <template v-slot:[`item.lastCount`]="{ item }">
              <div class="td-item tabular-nums font-12">
                {{ item.lastCount | formatNumber }}
                <br />
              </div>
            </template>

            <template v-slot:[`item.lastCountEmail`]="{ item }">
              <div class="td-item tabular-nums font-12 two-line-cell">
                <span class="main-value text-end">
                  {{ item.lastCountEmail | formatNumber }}
                </span>
                <span class="percentage"> {{ item.lastCountEmailPercentage }}% </span>
              </div>
            </template>

            <template v-slot:[`item.lastCountWebPush`]="{ item }">
              <div class="td-item tabular-nums font-12 two-line-cell">
                <span class="main-value text-end">
                  {{ item.lastCountWebPush | formatNumber }}
                </span>
                <span class="percentage"> {{ item.lastCountWebPushPercentage }}% </span>
              </div>
            </template>

            <template v-slot:[`item.lastCountMobilePush`]="{ item }">
              <div class="td-item tabular-nums font-12 two-line-cell">
                <span class="main-value text-end">
                  {{ item.lastCountMobilePush | formatNumber }}
                </span>
                <span class="percentage"> {{ item.lastCountMobilePushPercentage }}% </span>
              </div>
            </template>

            <template v-slot:[`item.lastCountPhone`]="{ item }">
              <div class="td-item tabular-nums font-12 two-line-cell">
                <span class="main-value text-end">
                  {{ item.lastCountPhone | formatNumber }}
                </span>
                <span class="percentage"> {{ item.lastCountPhonePercentage }}% </span>
              </div>
            </template>

            <template v-slot:[`item.lastCountWhatsapp`]="{ item }">
              <div class="td-item tabular-nums font-12 two-line-cell">
                <span class="main-value text-end">
                  {{ item.lastCountWhatsapp | formatNumber }}
                </span>
                <span class="percentage"> {{ item.lastCountWhatsappPercentage }}% </span>
              </div>
            </template>

            <template v-slot:[`item.actions-option`]="{ item }">
              <div class="action-row">
                <button v-if="item.isProcessing">
                  <v-progress-circular
                    indeterminate
                    color="#7B61FF"
                    :size="24"
                    v-tooltip.bottom="$t('datatable.segment-isProcessing')"
                  ></v-progress-circular>
                </button>
                <button @click="confirmRunSegment(item)" v-else>
                  <span
                    class="material-symbols-rounded ds-green-color"
                    v-tooltip.bottom="$t('datatable.segmentRun')"
                    v-if="item.hasFinishedProcessing"
                  >
                    check_circle
                  </span>
                  <span class="material-symbols-rounded ds-gray-color" v-tooltip.bottom="$t('modal.runSegment')" v-else>
                    play_circle
                  </span>
                </button>
                <button @click="showReachabilityModal(item)">
                  <span
                    class="material-symbols-rounded ds-gray-color"
                    v-tooltip.bottom="$t('modal.reachabilityByChannel')"
                  >
                    search_insights
                  </span>
                </button>
                <div class="outside-circle" :id="'action-button' + item.id" @click="showActions(item, $event.target)">
                  <div class="inside-circle"></div>
                  <div class="inside-circle"></div>
                  <div class="inside-circle"></div>
                </div>
              </div>
            </template>
          </v-data-table>
          <div v-if="segments.length === 0 && !isLoadingSegments" class="container-no-results">
            <img src="@/assets/campaign_fill.svg" width="80" height="80" />
            <p class="font-16 font-title-style">{{ $t('datatable.noSegments') }}</p>
            <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
          </div>
        </div>
      </div>

      <div v-if="segments.length > 0" class="text-center pagination pt-5 align-items-center justify-space-between">
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
          v-if="segments.length > 0"
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
    <div v-if="segments.length === 0 && !isLoadingSegments" class="container-no-results">
      <span class="material-symbols-rounded icon-style"> track_changes </span>
      <p class="font-16 font-title-style">{{ $t('datatable.noSegments') }}</p>
      <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
    </div>

    <div id="segments-item-menu" class="drop-down">
      <button type="button" @click="doCopy()" class="copy-button">
        <span class="material-symbols-rounded ds-gray-color">content_copy</span>
        <p class="font-title">{{ $t('button.duplicate') }}</p>
      </button>
      <button type="button" @click="confirmDelete()" class="trash-button">
        <span class="material-symbols-rounded ds-red-color">delete</span>
        <p class="font-title">{{ $t('button.delete') }}</p>
      </button>
    </div>

    <div>
      <v-dialog v-model="showModalCustomizeMetrics" width="500">
        <v-card class="dialog-customize-metrics">
          <div class="modal-header">
            {{ $t('modal.displayCustomization') }}
            <button class="d-flex" @click="cancelCustomizeMetrics">
              <span class="material-symbols-rounded buttons-color font-24"> close </span>
            </button>
          </div>
          <div class="modal-subheader">
            {{ $t('modal.reachabilityByChannel') }}
          </div>
          <div
            class="modal-body"
            v-for="(channel, channelIndex) in filteredMessageMetrics"
            :key="`${channelIndex}-channel`"
          >
            <div class="item-modal-customize-metrics" :draggable="true">
              <div class="item-modal-customize-metrics-label">
                <img src="../../../assets/drag_indicator.svg" class="img-item-modal-customize-metrics-label" />
                {{ channel.title }}
              </div>
              <div class="item-modal-customize-metrics-switch">
                <v-switch inset v-model="messageMetrics[channel.key].visible"></v-switch>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <input
              class="cancel-button mr-4"
              text
              @click="cancelCustomizeMetrics"
              type="button"
              :value="`${$t('button.cancel')}`"
            />
            <ButtonDefault
              :name="`${$t('button.save')}`"
              @click="saveCustomizeMetrics"
              class="btn btn-c btn-light btn-light-c float-right"
            />
          </div>
        </v-card>
      </v-dialog>

      <v-dialog v-model="showModalReachability" width="640">
        <v-card class="dialog-customize-metrics">
          <div class="modal-header">
            <span>
              {{ $t('modal.reachabilityByChannel') }}
              <span
                class="material-symbols-rounded ds-blue-color ml-1 font-20 v-align-text-bottom cursor-pointer"
                v-tooltip.bottom="{ content: $t(`datatable.segments-tooltip`), html: true }"
              >
                info
              </span>
            </span>
            <button class="d-flex" @click="showModalReachability = false">
              <span class="material-symbols-rounded buttons-color font-24"> close </span>
            </button>
          </div>
          <div class="modal-body__reachability" v-if="currentSegment">
            <v-card class="info-cards">
              <div class="icon-title">
                <span class="material-symbols-rounded ds-gray-color font-20">group</span>
                <p class="card-title-dashboard m-0 p-0">
                  {{ $t('title.totalOf', { metric: $t('sidebar.contacts') }) }}
                </p>
              </div>
              <div class="number-percentage">
                <p class="number-align m-0 p-0">
                  {{ currentSegment.lastCount | formatNumber }}
                </p>
              </div>
            </v-card>
            <v-card class="info-cards" v-if="accountChannels.hasEmail">
              <div class="icon-title">
                <span class="material-symbols-rounded ds-gray-color font-20">email</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('title.email') }}</p>
              </div>
              <div class="number-percentage">
                <p class="number-align m-0 p-0">
                  {{ currentSegment.lastCountEmail | formatNumber }}
                </p>
                <p class="number-align m-0 p-0 font-14">{{ currentSegment.lastCountEmailPercentage || 0 }}%</p>
              </div>
            </v-card>
            <v-card class="info-cards" v-if="accountChannels.hasWebPush">
              <div class="icon-title">
                <span class="material-symbols-rounded ds-gray-color font-20">computer</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('title.web-push') }}</p>
              </div>
              <div class="number-percentage">
                <p class="number-align m-0 p-0">
                  {{ currentSegment.lastCountWebPush | formatNumber }}
                </p>
                <p class="number-align m-0 p-0 font-14">{{ currentSegment.lastCountWebPushPercentage || 0 }}%</p>
              </div>
            </v-card>
            <v-card class="info-cards" v-if="accountChannels.hasMobilePush">
              <div class="icon-title">
                <span class="material-symbols-rounded ds-gray-color font-20">smartphone</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('title.mobile-push') }}</p>
              </div>
              <div class="number-percentage">
                <p class="number-align m-0 p-0">
                  {{ currentSegment.lastCountMobilePush | formatNumber }}
                </p>
                <p class="number-align m-0 p-0 font-14">{{ currentSegment.lastCountMobilePushPercentage || 0 }}%</p>
              </div>
            </v-card>
            <v-card class="info-cards" v-if="accountChannels.hasSms">
              <div class="icon-title">
                <span class="material-symbols-rounded ds-gray-color font-20">sms</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('title.sms') }}</p>
              </div>
              <div class="number-percentage">
                <p class="number-align m-0 p-0">
                  {{ currentSegment.lastCountPhone | formatNumber }}
                </p>
                <p class="number-align m-0 p-0 font-14">{{ currentSegment.lastCountPhonePercentage || 0 }}%</p>
              </div>
            </v-card>
            <v-card class="info-cards" v-if="accountChannels.hasWhatsapp">
              <div class="icon-title">
                <img class="icon-whatsapp" :src="require('@/assets/whatsapp.svg')" />
                <p class="card-title-dashboard m-0 p-0">{{ $t('title.whatsapp') }}</p>
              </div>
              <div class="number-percentage">
                <p class="number-align m-0 p-0">
                  {{ currentSegment.lastCountWhatsapp | formatNumber }}
                </p>
                <p class="number-align m-0 p-0 font-14">{{ currentSegment.lastCountWhatsappPercentage || 0 }}%</p>
              </div>
            </v-card>
          </div>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<script lang="ts">
import { Pagination } from '@/models/pagination';
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { SegmentDto } from '../dtos/segment.dto';
import TagService from '../../tags/services/tag.service';
import ToastService from '@/services/toast.service';
import DataTable from '@/components/data-table/DataTable.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { areObjectsEqual, getItemsPerPage, setItemsPerPage } from '../../../util/objects';
import Multiselect from 'vue-multiselect';
import { mapState } from 'vuex';
import store from '@/store';

@Component({
  components: {
    DataTable,
    ButtonDefault,
    InputDefault,
    DataLoader,
    Multiselect,
  },
  computed: {
    ...mapState(['accountChannels']),
  },
})
export default class Segments extends Vue {
  private readonly tagService = new TagService();
  private readonly loadingService = new LoadingService();
  private readonly modalService = new ModalService();
  private readonly toastService = new ToastService();
  public readonly accountChannels!: any;

  pagination = new Pagination();
  segments: Array<SegmentDto> = new Array<SegmentDto>();
  options: any = {
    page: 1,
    sortBy: ['name'],
    sortDesc: [false],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  isLoadingSegments = false;
  title: string | (string | null)[] = '';
  segmentId = 0;
  statusOptions = [
    { name: 'active', value: this.$t('input.active') },
    { name: 'inactive', value: this.$t('input.inactive') },
  ];
  selectedStatusFilter = 'active';
  actionsSelectedItem!: SegmentDto;
  interval: any;
  segmentsProcessing = new Set<number>();
  segmentReactiving: any = {};
  isDataLoaded = false;

  headers: any = [];
  itemsNumber = 10;
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  rangeStart = 0;
  rangeFinal = 0;

  showModalCustomizeMetrics = false;
  messageMetricsState: any = {};
  messageMetrics: any = {
    email: {
      title: this.$t('title.email'),
      visible: true,
    },
    'web-push': {
      title: this.$t('title.web-push'),
      visible: true,
    },
    'mobile-push': {
      title: this.$t('title.mobile-push'),
      visible: true,
    },
    sms: {
      title: this.$t('title.sms'),
      visible: true,
    },
    whatsapp: {
      title: this.$t('title.whatsapp'),
      visible: true,
    },
  };
  isSidebarCollapsed = '';
  currentSegment: SegmentDto = {} as SegmentDto;
  showModalReachability = false;

  get filteredMessageMetrics() {
    return Object.keys(this.messageMetrics)
      .filter((key) => {
        switch (key) {
          case 'email':
            return this.accountChannels.hasEmail;
          case 'web-push':
            return this.accountChannels.hasWebPush;
          case 'mobile-push':
            return this.accountChannels.hasMobilePush;
          case 'sms':
            return this.accountChannels.hasSms;
          case 'whatsapp':
            return this.accountChannels.hasWhatsapp;
          default:
            return false;
        }
      })
      .map((key) => ({
        title: this.messageMetrics[key].title,
        visible: this.messageMetrics[key].visible,
        key,
      }));
  }

  async beforeMount() {
    const localStorageFilters = localStorage.getItem('bmsSegmentsHeaders');
    if (localStorageFilters) {
      this.messageMetrics = JSON.parse(localStorageFilters);
    }
    const storedItemsPerPage = getItemsPerPage('segments');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getHeaders();
    this.getValuesUrl();
    await this.getSegments();

    this.$el.addEventListener('click', this.actionButtons);
    window.addEventListener('resize', this.actionButtons);
  }

  beforeDestroy() {
    clearInterval(this.interval);
    this.$el.removeEventListener('click', this.actionButtons);
    window.removeEventListener('resize', this.actionButtons);
  }

  getHeaders() {
    this.headers = [
      { text: this.$t('datatable.name'), value: 'name', sortable: true, width: '300' },
      {
        text: this.$t('datatable.status'),
        value: 'status',
        sortable: false,
        align: 'center',
        class: 'status-header',
        width: '8%',
      },
      { text: this.$t('datatable.lastEdition'), value: 'updatedAt', sortable: true, width: '15%' },
      {
        text: this.$t('datatable.lastRunDate'),
        value: 'lastRunDate',
        sortable: false,
        width: '15%',
        cellClass: 'font-title',
      },
      {
        text: this.$t('datatable.total'),
        value: 'lastCount',
        sortable: true,
        align: 'end',
        width: '5%',
        cellClass: 'font-title',
      },
      ...this.getChannelHeaders(),
      { text: '', value: 'actions-option', sortable: false, width: '96', cellClass: 'action-cell' },
    ];
  }

  getChannelHeaders() {
    const channels = {
      Email: 'email',
      WebPush: 'web-push',
      MobilePush: 'mobile-push',
      Sms: 'sms',
      Whatsapp: 'whatsapp',
    };

    return Object.entries(channels)
      .filter(([key, value]) => this.accountChannels[`has${key}`] && this.messageMetrics[value].visible)
      .map(([key, value]) => ({
        text: this.$t(`title.${value}`),
        value: key === 'Sms' ? 'lastCountPhone' : `lastCount${key}`,
        sortable: true,
        width: '5%',
      }));
  }

  rowClasses(item: SegmentDto) {
    return {
      'row-updated': item.hasFinishedProcessing,
    };
  }

  async getSegments() {
    if (this.isLoadingSegments) {
      return;
    }
    this.isLoadingSegments = true;
    this.loadingService.show();

    try {
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      const result = await this.tagService.getTags({
        ...this.$route.query,
        ...this.pagination,
        title: this.title,
        type: 'segment',
        status: this.selectedStatusFilter,
      });
      this.segments = result?.data?.results;
      this.segments = this.segments.map((item: SegmentDto) => {
        const lastRun = item.segmentInfo?.slice(-1) || [];
        if (item.isProcessing && item.id) {
          this.segmentsProcessing.add(item.id);
        }
        return {
          ...item,
          lastCount: item.lastCount || 0,
          lastCountEmailPercentage: Math.round((100 * item.lastCountEmail) / item.lastCount) || 0,
          lastCountWebPushPercentage: Math.round((100 * item.lastCountWebPush) / item.lastCount) || 0,
          lastCountMobilePushPercentage: Math.round((100 * item.lastCountMobilePush) / item.lastCount) || 0,
          lastCountPhonePercentage: Math.round((100 * item.lastCountPhone) / item.lastCount) || 0,
          lastCountWhatsappPercentage: Math.round((100 * item.lastCountWhatsapp) / item.lastCount) || 0,
          renderStatus: this.$t(`datatable.${item.status}`) as string,
          ...(lastRun[0] && { lastRunDate: new Date(lastRun[0].date) }),
        };
      });

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
      this.isDataLoaded = true;

      if (this.segmentsProcessing.size) {
        this.loadingProcessingSegments();
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoadingSegments = false;
      this.loadingService.hide();
    }
  }

  loadingProcessingSegments() {
    clearInterval(this.interval);
    if (this.segmentsProcessing.size) {
      this.interval = setInterval(async () => {
        await this.checkProcessing();
      }, 1000);
    }
  }

  async checkProcessing() {
    for (const id of this.segmentsProcessing) {
      const { data } = await this.tagService.checkProcessing(id);
      if (!data) {
        const { data: result } = await this.tagService.getTagById(id);

        const lastRun = result.segmentInfo?.slice(-1) || [];
        const index = this.segments.findIndex((segment) => segment.id === id);
        this.segments[index].isProcessing = false;
        this.segments[index].hasFinishedProcessing = true;

        this.segments[index].lastCount = result.lastCount || 0;
        this.segments[index].lastCountEmailPercentage =
          Math.round((100 * result.lastCountEmail) / result.lastCount) || 0;
        this.segments[index].lastCountWebPushPercentage =
          Math.round((100 * result.lastCountWebPush) / result.lastCount) || 0;
        this.segments[index].lastCountMobilePushPercentage =
          Math.round((100 * result.lastCountMobilePush) / result.lastCount) || 0;
        this.segments[index].lastCountPhonePercentage =
          Math.round((100 * result.lastCountPhone) / result.lastCount) || 0;
        this.segments[index].lastCountWhatsappPercentage =
          Math.round((100 * result.lastCountWhatsapp) / result.lastCount) || 0;
        if (lastRun[0].date) {
          this.segments[index].lastRunDate = new Date(lastRun[0].date);
        }
        this.segmentsProcessing.delete(id);
      }
    }
  }

  handlePagination() {
    this.setValuesUrl();
  }

  async doCopy() {
    if (!this.actionsSelectedItem) {
      return;
    }

    const segment = this.actionsSelectedItem;

    if (segment.id) {
      this.loadingService.show();
      const response = await this.tagService.createSegmentCopy(segment.id);
      this.loadingService.hide();
      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('modal.segmentDuplicated') as string,
          leftBorder: false,
        });
        this.$router.push(`/segments/${response.data.id}`);
      }
    }
  }

  async deleteSegment() {
    await this.tagService.deleteTag(this.segmentId);
    await this.getSegments();
  }

  async runSegment() {
    const result = await this.tagService.runSegment(this.segmentId);
    if (result) {
      const index = this.segments.findIndex((segment) => segment.id === this.segmentId);
      this.segments[index].isProcessing = true;
      this.segmentsProcessing.add(this.segmentId);
      this.loadingProcessingSegments();
      this.toastService.show({
        type: result.status === 200 ? 'success' : 'error',
        text:
          result.status === 200
            ? (this.$t('datatable.segmentRun') as string)
            : (this.$t('datatable.segmentError') as string),
      });
    }
  }

  confirmDelete() {
    if (!this.actionsSelectedItem) {
      return;
    }

    const segment = this.actionsSelectedItem;

    this.segmentId = segment.id || 0;
    this.modalService.confirm({
      title: this.$t('modal.deleteSement') as string,
      text: `${this.$t('modal.confirmSegment', { segment: segment.name })}`,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.deleteSegment,
      showClose: true,
    });
  }

  confirmRunSegment(segment: SegmentDto) {
    this.segmentId = segment.id || 0;
    this.modalService.confirm({
      title: this.$t('modal.runSegment') as string,
      text: `${this.$t('modal.confirmRunSegment', { segment: segment.name })}`,
      confirmLabel: this.$t('button.confirm') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.runSegment,
      isConfirm: true,
      showClose: true,
    });
  }

  filterByTitle() {
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  updateInput(event: string) {
    this.title = event;
  }

  setValuesUrl() {
    if (!this.isDataLoaded) {
      return;
    }

    const query = {
      itemsPerPage: this.pagination.itemsPerPage,
      page: this.pagination.page,
      title: this.title,
      sortBy: this.pagination.sortBy,
      order: this.pagination.order,
      status: this.selectedStatusFilter,
    };

    if (areObjectsEqual(this.$route.query, query) === false) {
      this.$router.push({ query });
    }
  }

  getValuesUrl() {
    if (this.$route.query.page) {
      this.pagination.page = Number(this.$route.query.page);
      this.pagination.itemsPerPage = Number(this.$route.query.itemsPerPage);
      this.pagination.sortBy = this.$route.query.sortBy?.toString() || 'name';
      this.pagination.order = this.$route.query.order?.toString() || 'ASC';
      this.title = this.$route.query.title;
      this.selectedStatusFilter = this.$route.query.status?.toString() || 'active';
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

    this.options = { ...this.options, page: 1, sortBy: ['name'], sortDesc: [false] };
    this.pagination = { ...this.pagination, page: 1, sortBy: 'name', order: 'ASC' };
    this.title = '';
  }

  handleOptions(options: any) {
    this.options = { ...this.options, ...options };
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    setItemsPerPage('segments', items);
    this.getSegments();
  }

  showActions(item: any, target: HTMLElement) {
    this.actionsSelectedItem = item;
    const actions = document.querySelector('#segments-item-menu') as HTMLElement;
    target.classList.add('active-more-actions');
    actions.style.visibility = 'visible';

    const rect = target.getBoundingClientRect();
    this.isSidebarCollapsed = localStorage.getItem('bms-sidebar-collapsed') || '';
    const actionsWidth = this.isSidebarCollapsed === 'true' ? 380 : 573;
    actions.style.left = `${rect.left + window.scrollX - actionsWidth}px`;
    actions.style.top = `${rect.top + window.scrollY - 50}px`;
  }

  actionButtons(event: Event) {
    const target = event.target as HTMLElement;
    if (event.type === 'resize' || !target.id.includes('action-button')) {
      const actionsMenu = document.querySelector('#segments-item-menu') as HTMLElement;
      if (actionsMenu) {
        actionsMenu.style.visibility = 'hidden';
      }
    }

    const activeItems = document.querySelectorAll('.active-more-actions');
    if (activeItems.length > 0) {
      for (const activeItem of activeItems) {
        if (activeItem !== target) {
          activeItem.classList.remove('active-more-actions');
        }
      }
    }
  }

  showCustomizeMetrics() {
    this.messageMetricsState = {};
    this.messageMetricsState = structuredClone(this.messageMetrics);
    this.showModalCustomizeMetrics = true;
  }

  cancelCustomizeMetrics() {
    this.messageMetrics = { ...this.messageMetricsState };
    this.messageMetricsState = {};
    this.showModalCustomizeMetrics = false;
  }

  saveCustomizeMetrics() {
    this.messageMetricsState = {};
    this.showModalCustomizeMetrics = false;
    localStorage.setItem('bmsSegmentsHeaders', JSON.stringify(this.messageMetrics));
    this.getHeaders();
  }

  showReachabilityModal(item: SegmentDto) {
    this.currentSegment = item;
    this.showModalReachability = true;
  }

  @Watch('options')
  async onChangeOptions() {
    if (this.isLoadingSegments) {
      return;
    }

    const { sortBy, sortDesc, page, itemsPerPage } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      itemsPerPage,
      sortBy: sortBy[0] || 'name',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
    };

    this.setValuesUrl();

    await this.getSegments();
  }

  @Watch('$route')
  async changePagination() {
    if (Object.keys(this.$route.query || {}).length === 0) {
      this.isDataLoaded = false;
      this.selectedStatusFilter = 'active';
    }
    this.getValuesUrl();
    await this.getSegments();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.bms-select {
  width: 100px !important;
}

.bms-select option {
  border-radius: 0px 0px 8px 8px;
}
::v-deep .v-text-field__slot {
  max-height: 33px !important;
  padding: 0 !important;
}

::v-deep .v-text-field__details {
  min-height: 0px !important;
  height: 0px;
  margin: 0 !important;
  margin-bottom: 0 !important;
}

::v-deep .v-messages {
  min-height: 0px !important;
}

.append-img {
  width: 12px;
}

::v-deep .v-input__control {
  height: 33px;
}

::v-deep .v-data-table-header {
  white-space: nowrap !important;
}

::v-deep.c-table {
  margin-top: 16px;
  border-radius: 16px;
  width: 100%;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  overflow-x: auto;

  th.text-start {
    white-space: nowrap;
  }

  td {
    position: relative;
    vertical-align: middle;
  }

  .sucess--text {
    color: $ds-blue;
  }
}

::v-deep .status-header {
  white-space: nowrap !important;
}

.two-line-cell {
  padding: 0;

  & > .main-value {
    display: block;
    position: relative;
  }

  & > .percentage {
    display: block;
    position: absolute;
    right: 16px;
    top: 50%;
    margin-top: 16px;
    transform: translateY(-50%);
    font-size: 10px;
  }
}

.action-row {
  position: absolute;
  top: 2px;
  right: 0;
  height: 96%;
  width: 96px;
  background-color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.outside-circle {
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  padding-top: 2px;
  padding-bottom: 2px;
}

.active-more-actions {
  background: $ds-blue;
  .inside-circle {
    background: white;
  }
}

.active-more-actions:hover {
  background: $ds-blue !important;
}

.outside-circle:hover {
  cursor: pointer;
  background: #0055f40e;
}

.inside-circle {
  background: $ds-gray-400;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  pointer-events: none;
}

.drop-down {
  z-index: 10;
  position: absolute;
  visibility: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  width: 229px;
  height: fit-content;
  padding: 10px 10px;
  background: white;
  border-radius: 16px;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5);
  top: 0;
  right: 0;
  margin-top: -57px;
  margin-left: -8px;
}

.copy-button {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: clamp(6px, 0.8vw, 10px);
  width: 100%;

  p {
    margin-bottom: 0;
    margin-left: 9px;
    font-size: 16px;
  }
}
.copy-button:hover {
  background: $ds-gray-100;
  transition: all 0.25s;
  border-radius: 6px;
}

.trash-button {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: clamp(6px, 0.8vw, 10px);
  width: 100%;

  p {
    margin-bottom: 0;
    margin-left: 9px;
    color: $ds-red;
    font-size: 16px;
  }
}

.trash-button:hover {
  background: #f0323213;
  transition: all 0.25s;
  border-radius: 6px;
}

.div-trash:hover button img {
  filter: invert(24%) sepia(76%) saturate(2975%) hue-rotate(346deg) brightness(97%) contrast(92%);
}

::v-deep .v-icon.mdi-chevron-down {
  font-size: 18px;
}

::v-deep .v-dialog {
  width: fit-content;
  border-radius: 16px;
}

.green-text {
  color: $ds-blue;
}
.red-text {
  color: $neutral-error-red;
}

.test-stats {
  color: $neutral-basic-white;
  font-weight: bold;
  font-size: 14px;
  border-radius: 4px;
  padding: 4px 8px;
}

.test-stats--inbox {
  background: $ds-blue;
}
.option-select {
  background-color: #ffffff;
  color: #333333;
  border-radius: 0px 0px 8px 8px;
  padding: 5px;
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
  margin-top: 20px;
}

.icon-style {
  font-size: 80px;
  color: #ffb1b4;
}

.customize-metrics-menu {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 0.4em;
  margin-right: 0.5em;
  border: 1px solid #dddddd;
  border-radius: 9px;
  background-color: #ffffff;
  height: 36px;

  &:hover {
    background: #f5f5f5;
  }
}

.v-align-text-bottom {
  vertical-align: text-bottom;
}

.modal-footer {
  display: flex;
  flex-direction: row;
  border: none;
  margin-top: 1rem;
}

.modal-header {
  font-size: 14px;
  font-weight: 500;
  border: none;
  padding: 0;
  margin-bottom: 24px;
}

.modal-subheader {
  font-size: 12px;
  font-weight: 500;
  border: none;
  margin-bottom: 8px;
}

.modal-body {
  font-size: 2em;
  padding: 0em;
  margin-bottom: 0.5em;
}

.dialog-customize-metrics {
  width: 100%;
  border-radius: 10px;
  justify-content: center;
  padding: 20px;
}

.item-modal-customize-metrics {
  font-size: 0.7em;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  border: 1px solid #dddddd;
  border-radius: 10px;
  padding: 0;
}

.item-modal-customize-metrics-label {
  display: flex;
  justify-content: left;
  align-items: center;
  padding-left: 1em;
}

.img-item-modal-customize-metrics-label {
  padding: 0.6em;
}

.item-modal-customize-metrics-switch {
  display: flex;
  justify-content: right;
  align-items: center;
  padding: 0;
}

::v-deep .v-progress-circular__overlay {
  stroke-linecap: round;
}
::v-deep .v-progress-circular__underlay {
  stroke: pink;
}

.icon-title {
  display: flex;
  gap: 0.5em;
  flex-direction: row;
  align-items: center;
}

.card-title-dashboard {
  font-weight: 600;
  font-size: 14px;
}

.modal-body__reachability {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.number-percentage {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  justify-content: flex-end;
}

.number-align {
  text-align: end;
  font-weight: 600;
  font-size: 24px;
  color: $ds-gray;
}

.info-cards {
  display: flex;
  flex-direction: column;
  gap: 25px;
  padding: 20px;
  border-radius: 16px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1) !important;
  height: 107px;
}

.buttons-color {
  color: #a6a6a6;
  &:hover {
    color: $ds-gray;
  }
}

::v-deep.v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  margin-bottom: 0 !important;
}

.default-filters__search-input {
  display: flex;
  gap: 16px;
  flex-direction: row;
  width: auto !important;
}
</style>
