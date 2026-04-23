<template>
  <div class="col-12">
    <div class="title-route">
      <span class="font-24 text-600 ds-gray-color">{{ $t('title.leads') }}</span>
    </div>
    <div class="div-row gap-5 filters-div align-items-center">
      <v-menu ref="menu" v-model="menu" bottom class="group-items-menu" :close-on-content-click="false">
        <template v-slot:activator="{ on }">
          <div class="menu-group-items group-items-width ds-gray-color" v-on="on">
            <input class="font-12" type="button" :value="`${$t('input.selectGroupItems')}`" />
            <span class="icon-up material-symbols-rounded">arrow_drop_down</span>
          </div>
        </template>
        <v-card class="group-items-card">
          <div class="group-items-list">
            <div
              class="checkbox-group-items pl-2"
              :key="`group-items-modal-filter-${i}`"
              v-for="(item, i) in groupByItems"
            >
              <input
                type="checkbox"
                :key="`search-input-group-items-${i}`"
                :id="`group-items-options-${item.value}`"
                v-model="selectedItems"
                :value="{ ...item }"
                class="input-filters"
              />
              <label
                class="label-filters"
                :for="`group-items-options-${item.value}`"
                :key="`group-items-labels-${i}`"
                >{{ item.name }}</label
              >
            </div>
          </div>
          <div class="pr-3 pt-3 pb-3 div-row gap-10 group-items-button">
            <button
              class="clear-fields text-600 font-10 ds-blue-color"
              :disabled="!selectedItems.length"
              @click.prevent="clearItems"
            >
              {{ $t('button.clear') }}
            </button>
            <button class="apply-button text-600" :disabled="!selectedItems.length" @click.prevent="getStatisticsData">
              {{ $t('button.apply') }}
            </button>
          </div>
        </v-card>
      </v-menu>
      <v-menu
        ref="menu"
        v-model="dateMenu"
        class="date-menu ml-1"
        :close-on-content-click="false"
        bottom
        transition="scale-y-transition"
        offset-y
        width="283"
      >
        <template v-slot:activator="{ activate }">
          <v-btn
            class="date-button"
            :class="{ 'date-button-open': dateMenu === true }"
            v-on="activate"
            @click="dateMenu = true"
          >
            <div class="d-flex align-items-center gap-10">
              <span
                class="metric-icon icon-up material-symbols-rounded"
                :class="{ 'ds-blue-color': dateMenu === true }"
              >
                calendar_month
              </span>
              <span class="date-range">{{ dateRangeText || $t('button.selectDate') }}</span>
            </div>
            <div>
              <span
                class="icon-up material-symbols-rounded"
                :class="{ 'icon-dropdown ds-blue-color': dateMenu === true }"
                dense
              >
                arrow_drop_down
              </span>
            </div>
          </v-btn>
        </template>
        <v-card class="filters-card" :class="{ 'filters-card-open': dateMenu === true }">
          <v-date-picker
            width="280"
            no-title
            v-model="selectedDates"
            range
            class="date-picker"
            :locale="userLanguage"
            :min="dateToVuetifyString(minFilterDate)"
            :max="dateToVuetifyString(new Date())"
            @input="changeDatePicker($event)"
          />
          <div class="date-filters">
            <v-btn class="date-period" @click="selectDateFilter(0)">{{ $t('input.today') }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(1)">{{ $t('input.yesterday') }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(7)">{{ $t('input.dateRange', { days: '7' }) }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(15)">{{ $t('input.dateRange', { days: '15' }) }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(30)">{{ $t('input.dateRange', { days: '30' }) }}</v-btn>
          </div>
          <div class="clear-date" v-if="selectedDates.length">
            <button
              class="clear-fields text-600 font-10 ds-blue-color"
              :disabled="isDateRange === false"
              @click="clearDate()"
            >
              {{ $t('button.clear') }}
            </button>
          </div>
        </v-card>
      </v-menu>
      <v-menu
        ref="menu"
        v-model="filtersMenu"
        class="date-menu"
        :close-on-content-click="false"
        bottom
        transition="scale-y-transition"
        offset-y
        width="283"
        data-menu="filtersMenu-filters"
      >
        <template v-slot:activator="{ on }">
          <v-btn
            id="bms-leads-list-button-advanced-filters"
            class="date-button"
            :class="{ 'date-button-open': filtersMenu === true }"
            v-on="on"
            @click="filtersMenu = true"
          >
            <div class="d-flex align-items-center gap-10">
              <span class="material-symbols-rounded font-16" :class="{ 'ds-blue-color': filtersMenu === true }"
                >filter_list</span
              >
              <span class="font-12 text-400">
                {{ $t('button.moreFilters') }}
              </span>
              <span v-if="filtersSelected" class="filter-selected-item text-600">
                {{ filtersSelected }}
              </span>
            </div>
            <div>
              <span
                class="icon-up material-symbols-rounded"
                :class="{ 'icon-dropdown ds-blue-color': filtersMenu === true }"
                dense
              >
                arrow_drop_down
              </span>
            </div>
          </v-btn>
        </template>
        <v-card width="283" class="filters-card" :class="{ 'filters-card-open': filtersMenu === true }">
          <div class="list-filters">
            <v-list-group
              class="list-groups"
              :value="false"
              append-icon="mdi-chevron-down font-16"
              :class="{ 'filters-card-radius': filtersSelected === 0 }"
            >
              <template v-slot:activator>
                <v-list-item-title
                  :class="selectedProvider.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                  class="div-row align-items-center gap-5 text-600"
                >
                  {{ $t('title.provider') }}
                  <span v-if="selectedProvider.length" class="filter-selected-item text-600">
                    {{ selectedProvider.length }}
                  </span>
                </v-list-item-title>
              </template>
              <v-list-item-content :class="{ 'filters-card-radius': filtersSelected === 0 }">
                <div class="div-column gap-5 filters-list">
                  <div
                    class="div-row gap-5 px-2"
                    :key="`provider-filter-${index}`"
                    v-for="(provider, index) in getGroupByItems('email_provider')"
                  >
                    <input
                      type="checkbox"
                      :key="`search-input-${index}`"
                      :id="`tag-option-${provider}`"
                      :value="provider"
                      v-model="selectedProvider"
                    />
                    <label class="label-filters" :for="`tag-option-${provider}`" :key="`tag-label-${index}`">
                      {{ provider }}
                    </label>
                  </div>
                </div>
              </v-list-item-content>
            </v-list-group>
            <v-list-group
              class="list-groups"
              :value="false"
              append-icon="mdi-chevron-down font-16"
              :class="{ 'filters-card-radius': filtersSelected === 0 }"
            >
              <template v-slot:activator>
                <v-list-item-title
                  :class="selectedSources.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                  class="div-row align-items-center gap-5 text-600"
                >
                  {{ $t('datatable.utm_source') }}
                  <span v-if="selectedSources.length" class="filter-selected-item text-600">
                    {{ selectedSources.length }}
                  </span>
                </v-list-item-title>
              </template>
              <v-list-item-content :class="{ 'filters-card-radius': filtersSelected === 0 }">
                <div class="div-column gap-5 filters-list">
                  <div
                    class="div-row gap-5 px-2"
                    :key="`provider-filter-${index}`"
                    v-for="(utmSource, index) in getGroupByItems('utm_source')"
                  >
                    <input
                      type="checkbox"
                      :key="`search-input-${index}`"
                      :id="`filter-option-${utmSource}`"
                      :value="utmSource"
                      v-model="selectedSources"
                    />
                    <label class="label-filters" :for="`filter-option-${utmSource}`" :key="`tag-label-${index}`">
                      {{ utmSource }}
                    </label>
                  </div>
                </div>
              </v-list-item-content>
            </v-list-group>
            <v-list-group
              class="list-groups"
              :value="false"
              append-icon="mdi-chevron-down font-16"
              :class="{ 'filters-card-radius': filtersSelected === 0 }"
            >
              <template v-slot:activator>
                <v-list-item-title class="div-row align-items-center gap-5 text-600 filters-title">
                  {{ $t('datatable.utm_campaign') }}
                  <span v-if="filterUtmCampaign" class="filter-selected-item text-600"> 1 </span>
                </v-list-item-title>
              </template>
              <v-list-item-content :class="{ 'filters-card-radius': filtersSelected === 0 }">
                <div class="div-row gap-5 px-2 align-items-center filters-list">
                  <span class="material-symbols-rounded font-18 ds-blue-color"> search </span>
                  <input type="text" v-model="filterUtmCampaign" class="input-filters w-100 font-12 ds-gray-color" />
                </div>
              </v-list-item-content>
            </v-list-group>
            <v-list-group
              class="list-groups"
              :value="false"
              append-icon="mdi-chevron-down font-16"
              :class="{ 'filters-card-radius': filtersSelected === 0 }"
            >
              <template v-slot:activator>
                <v-list-item-title class="div-row align-items-center gap-5 text-600 filters-title">
                  {{ $t('datatable.source_url') }}
                  <span v-if="filterUrlSource" class="filter-selected-item text-600"> 1 </span>
                </v-list-item-title>
              </template>
              <v-list-item-content :class="{ 'filters-card-radius': filtersSelected === 0 }">
                <div class="div-row gap-5 px-2 align-items-center filters-list">
                  <span class="material-symbols-rounded font-18 ds-blue-color"> search </span>
                  <input type="text" v-model="filterUrlSource" class="input-filters w-100 font-12 ds-gray-color" />
                </div>
              </v-list-item-content>
            </v-list-group>
          </div>
          <div class="filters-buttons" v-if="filtersSelected !== 0">
            <a class="button-link" @click="clearFilters()"> {{ $t('button.clear') }} </a>
            <ButtonDefault
              :name="`${$t('button.apply')}`"
              data-cy="button-view-fields"
              class="buttons-specs"
              :disabled="filtersSelected === 0"
              @click="applyFilters()"
            />
          </div>
        </v-card>
      </v-menu>
    </div>
    <div class="group-items-chip div-row gap-5">
      <div class="filters-chips gap-5" :class="[isOpen ? 'expand-tags d-flex' : 'closed-tags div-row']">
        <div :class="[isOpen ? 'chip-expand' : 'div-row div-chip-gap']">
          <div
            class="md-chips filters-chips-color"
            :key="`chip-${index}`"
            v-for="(chip, index) in visibleChips"
            draggable="true"
            @dragstart="dragStart($event, chip, index)"
            @dragover="dragOver($event)"
            @dragleave="dragLeave($event)"
            @dragend="dragEnd($event)"
            @drop="drop($event, index)"
          >
            <span class="material-symbols-rounded ds-gray-color cursor-move">drag_indicator</span>
            <span class="chip-text pr-1 ds-gray-color">{{ chip.name }}</span>
            <span class="material-symbols-rounded font-16 ds-gray-color cursor-pointer" @click="removeChip(chip.value)">
              close
            </span>
          </div>
          <button class="open-chips text-600 font-12" v-on:click="isOpen = !isOpen" v-if="chipItems.length > 3">
            {{ isOpen ? $t('input.showLess') : '+' + `${chipItems.length - 3} ` + $t('input.others') }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="hasRequested">
      <div class="div-column mt-2">
        <DataLoader :isLoading="isLoadingData" :type="'image, list-item-two-line, list-item-two-line'" :height="345" />
        <div v-if="!noData && !isLoadingData" class="chart-background div-column">
          <button
            v-if="$store.getters.can('analytics:dashboard_export')"
            class="export-button align-self-end"
            @click="exportData"
            v-tooltip.right="$t(`button.exportData`)"
          >
            <span class="material-symbols-rounded font-24 ds-gray-color cursor-pointer unfilled-icon">
              upload_file
            </span>
          </button>
          <v-data-table
            :headers="headers"
            :items="paginatedStatistics"
            hide-default-footer
            class="c-table"
            :calculate-widths="true"
            :no-data-text="`${$t('datatable.noData')}`"
            :loading="isLoadingData"
            :items-per-page="pagination.itemsPerPage"
          >
            <template v-slot:[`item.created_at_date`]="{ item }">
              <div class="td-item tabular-nums font-12">
                <span> {{ item.created_at_date | formatDate }} </span>
              </div>
            </template>
            <template v-slot:no-data>
              <p :value="true" color="error" class="no-data" icon="warning">{{ $t('datatable.noData') }}</p>
            </template>
          </v-data-table>
        </div>
        <div v-if="statistics.length > 0" class="text-center div-row py-5 align-items-center justify-space-between">
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
    </div>
    <div v-else class="no-items-selected">
      <span v-if="!selectedItems.length" class="text-400 font-16">{{ $t('chart.selectGroupItems') }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import dayjs from 'dayjs';
import { Component, Vue, Watch } from 'vue-property-decorator';
import DashboardService from '../services/dashboard.service';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { areObjectsEqual } from '@/util/objects';
import DataTable from '@/components/data-table/DataTable.vue';
import ToastService from '@/services/toast.service';
import { mapState } from 'vuex';

@Component({
  components: { DataLoader, ButtonDefault, DataTable },
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class Leads extends Vue {
  private readonly dashboardService = new DashboardService();
  private readonly toastService = new ToastService();
  public selectedDates: any = [];
  public selectedItems: any = [];
  public search: any = [];
  public selectedProvider: any = [];
  public selectedSources: any = [];
  public currentAccountTimezone!: string;
  public userLanguage!: string;

  pagination = {
    itemsPerPage: 10,
    totalPages: 1,
    page: 1,
    totalItems: 0,
  };
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  filtersMenu = false;
  dateMenu = false;
  dateRangeText = '';
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  isDateRange = false;
  menu = false;
  isOpen = false;
  isLoadingData = true;
  noData = false;
  hasRequested = false;
  statistics: any = [];
  minFilterDate = new Date();
  chipItems: any = [];
  headers: any = [];
  filterUtmCampaign = '';
  filterUrlSource = '';
  rangeStart = 0;
  rangeFinal = 0;
  groupByItems = [
    { name: this.$t('datatable.ad_id'), value: 'ad_id' },
    { name: this.$t('datatable.adgroup_id'), value: 'adgroup_id' },
    { name: this.$t('datatable.adset_id'), value: 'adset_id' },
    { name: this.$t('datatable.campaign_id'), value: 'campaign_id' },
    { name: this.$t('datatable.date'), value: 'created_at_date' },
    { name: this.$t('datatable.direct_to_url'), value: 'direct_to_url' },
    { name: this.$t('datatable.engaged'), value: 'engaged' },
    {
      name: this.$t('datatable.email_provider'),
      value: 'email_provider',
      options: ['Gmail', 'Yahoo', 'Microsoft', 'iCloud', 'Other'],
    },
    { name: this.$t('datatable.source_url'), value: 'source_url' },
    { name: this.$t('datatable.tag_name'), value: 'tag_name' },
    { name: this.$t('datatable.utm_campaign'), value: 'utm_campaign' },
    { name: this.$t('datatable.utm_content'), value: 'utm_content' },
    { name: this.$t('datatable.utm_keyword'), value: 'utm_keyword' },
    { name: this.$t('datatable.utm_medium'), value: 'utm_medium' },
    {
      name: this.$t('datatable.utm_source'),
      value: 'utm_source',
      options: ['google', 'facebook', 'tiktok', 'pangle', 'sendgrid', 'gam', 'community', 'plusdin.com.br', 'push'],
    },
    { name: this.$t('datatable.utm_term'), value: 'utm_term' },
    { name: this.$t('datatable.placement'), value: 'placement' },
  ];

  get filtersSelected() {
    return (
      this.selectedProvider.length +
      this.selectedSources.length +
      (this.filterUtmCampaign ? 1 : 0) +
      (this.filterUrlSource ? 1 : 0)
    );
  }

  get paginatedStatistics() {
    const start = (this.pagination.page - 1) * this.pagination.itemsPerPage;
    const end = start + this.pagination.itemsPerPage;
    return this.statistics.slice(start, end);
  }

  get visibleChips() {
    return this.isOpen ? this.chipItems : this.chipItems.slice(0, 3);
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    this.pagination.totalPages = Math.ceil(this.statistics.length / this.pagination.itemsPerPage);
    this.calculateRange();
  }

  handlePagination() {
    this.pagination.page = Number(this.pagination.page);
    this.pagination.totalPages = Math.ceil(this.statistics.length / this.pagination.itemsPerPage);
    this.calculateRange();
  }

  calculateRange() {
    this.rangeStart = (this.pagination.page - 1) * this.pagination.itemsPerPage + 1;
    const calculateFinalRange = this.pagination.itemsPerPage + this.rangeStart - 1;
    this.rangeFinal =
      this.pagination.totalItems < calculateFinalRange ? this.pagination.totalItems : calculateFinalRange;
  }

  async beforeMount() {
    this.minFilterDate.setDate(new Date().getDate() - 180);
    if (Object.keys(this.$route.query).length) {
      this.getValuesUrl();
      this.selectedDates = [this.dateToVuetifyString(this.startDate), this.dateToVuetifyString(this.endDate)];
      await this.changeDatePicker(this.selectedDates);
    }
    if (!Object.keys(this.$route.query).length) {
      this.selectDateFilter(0);
    }
  }

  getGroupByItems(type: string) {
    return this.groupByItems.find((item: any) => item.value === type)?.options || [];
  }

  async getStatisticsForItems(groupItems: any[], search: string[]) {
    try {
      const response = await this.dashboardService.getLeadsData(this.startDate, this.endDate, groupItems, search);
      return response?.data || {};
    } catch (err) {
      console.error(err);
      return {};
    }
  }

  async getStatisticsData() {
    if (!this.selectedDates.length || !this.selectedItems.length) {
      return;
    }
    const diffDays = dayjs(this.endDate).diff(this.startDate, 'days');

    if (diffDays > 30) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.maxIntervalLeads') as string,
      });
      return;
    }
    this.hasRequested = true;
    this.isLoadingData = true;
    this.menu = false;

    try {
      const groupItems = this.selectedItems.map((item: any) => item.value);
      this.chipItems = [...this.selectedItems];
      this.statistics = await this.getStatisticsForItems(groupItems, this.search);
      this.pagination.totalItems = this.statistics.length;
      this.pagination.totalPages = Math.ceil(this.statistics.length / this.pagination.itemsPerPage);
      this.calculateRange();
      this.headers = [
        { text: this.$t('datatable.total'), value: 'total', align: 'end', sortable: true },
        { text: this.$t('datatable.totalUnique'), align: 'end', value: 'total_unique', sortable: true },
        { text: this.$t('datatable.isValid'), align: 'end', value: 'valid', sortable: true },
        { text: this.$t('datatable.new'), align: 'end', value: 'new', sortable: true },
        { text: this.$t('datatable.old'), align: 'end', value: 'old', sortable: true },
        { text: this.$t('datatable.bounce'), align: 'end', value: 'bounced', sortable: true },
        { text: this.$t('datatable.invalid'), align: 'end', value: 'invalid', sortable: true },
        {
          text: this.$t('datatable.automationEntry'),
          width: '11%',
          align: 'end',
          value: 'automation_entry',
          sortable: true,
        },
        {
          text: this.$t('datatable.automationDuplicated'),
          width: '11%',
          align: 'end',
          value: 'automation_duplicated',
          sortable: true,
        },
      ];
      let indexItem = 0;
      this.chipItems.forEach((item: any) => {
        this.headers.splice(indexItem, 0, {
          text: this.$t(`datatable.${item.value}`),
          value: `${item.value}`,
          sortable: false,
        });
        indexItem++;
      });
      this.setValuesUrl();
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoadingData = false;
    }
  }

  async removeChip(value: string) {
    this.selectedItems = this.selectedItems.filter((item: any) => item.value !== value);
    await this.getStatisticsData();
    if (!this.selectedItems.length) {
      this.chipItems = [];
      this.setValuesUrl();
      this.hasRequested = false;
    }
  }

  dateToVuetifyString(date?: Date): string {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateString = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    return dateString;
  }

  selectDateFilter(dateRange: string | number): void {
    switch (dateRange) {
      case 'lastMonth':
        this.selectedDates[0] = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
        break;

      case 1:
        this.selectedDates[0] = dayjs().subtract(1, 'day').startOf('day').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().subtract(1, 'day').endOf('day').format('YYYY-MM-DD');
        break;

      default:
        this.selectedDates[0] = dayjs().subtract(Number(dateRange), 'day').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().format('YYYY-MM-DD');
    }

    this.changeDatePicker([this.selectedDates[0], this.selectedDates[1]]);
  }

  async changeDatePicker(e: string[]) {
    if (e.length < 2) {
      return;
    }

    const dates: dayjs.Dayjs[] = e.map((item) => {
      const date = dayjs.utc(item).tz(this.currentAccountTimezone, true);
      return date;
    });

    if (dates[0] > dates[1]) {
      dates.reverse();
    }

    const startDateInTimezone = dates[0].tz(this.currentAccountTimezone);
    const endDateInTimezone = dates[1].tz(this.currentAccountTimezone);

    this.startDate = new Date(startDateInTimezone.format('YYYY-MM-DDTHH:mm:ss'));
    this.endDate = new Date(endDateInTimezone.format('YYYY-MM-DDTHH:mm:ss'));
    this.dateRangeText = `${Vue.filter('formatDate')(dates[0])} - ${Vue.filter('formatDate')(dates[1])}`;
    this.isDateRange = true;
    await this.getStatisticsData();
  }

  async clearDate() {
    this.selectedDates = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.isDateRange = false;
    this.dateRangeText = '';
  }

  async clearItems() {
    this.selectedItems = [];
    this.chipItems = [];
    this.hasRequested = false;
    if (this.chipItems.length !== 0) {
      await this.getStatisticsData();
    }
  }

  getValuesUrl() {
    if (this.$route.query.groupItems) {
      const itemsStringIds = this.$route.query.groupItems as string;
      this.selectedItems = itemsStringIds.split(',').map((itemQuery: string) => {
        return this.groupByItems.find((item: any) => item.value === itemQuery);
      });
    }

    if (this.$route.query.search) {
      const searchString = this.$route.query.search as string;
      this.search = searchString.split(',');

      this.selectedProvider = [];
      this.selectedSources = [];
      this.filterUtmCampaign = '';
      this.filterUrlSource = '';

      this.search.forEach((item: string) => {
        const colonIndex = item.indexOf(':');
        const type = item.slice(0, colonIndex);
        const name = item.slice(colonIndex + 1);
        switch (type) {
          case 'email_provider':
            this.selectedProvider.push(name);
            break;
          case 'utm_source':
            this.selectedSources.push(name);
            break;
          case 'utm_campaign':
            this.filterUtmCampaign = name;
            break;
          case 'source_url':
            this.filterUrlSource = decodeURIComponent(name);
            break;
        }
      });
    }

    if (this.$route.query.startDate) {
      const date = new Date(this.$route.query.startDate as string);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      this.startDate = date;
    }

    if (this.$route.query.endDate) {
      const date = new Date(this.$route.query.endDate as string);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      this.endDate = date;
    }
  }

  setValuesUrl() {
    const groupItems = this.selectedItems.map((items: any) => items.value).join(',');

    const queryParams = {
      groupItems: groupItems || '',
      startDate: this.dateToVuetifyString(this.startDate),
      endDate: this.dateToVuetifyString(this.endDate),
      search: this.search.join(',') || '',
    };

    if (!areObjectsEqual(this.$route.query, queryParams)) {
      const queryString = Object.entries(queryParams)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      window.history.replaceState({}, '', `${window.location.pathname}${queryString ? '?' + queryString : ''}`);
      this.$router.push({ query: queryParams });
    }

    if (!groupItems) {
      this.$router.push({ query: {} });
    }
  }

  exportData() {
    if (!this.statistics.length) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.noContentToExport') as string,
      });
      return;
    }

    try {
      const headers = this.headers.map((h: any) => h.text);

      const rows = this.statistics.map((item: any) => {
        return this.headers
          .map((header: any) => {
            return item[header.value];
          })
          .join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `leads_${dayjs().format('YYYY-MM-DD')}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.toastService.show({
        type: 'success',
        text: this.$t('toast.contentExported') as string,
      });
    } catch (error) {
      console.error('Export failed:', error);
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.errorExportingContent') as string,
      });
    }
  }

  dragStart(event: any, item: any, index: number) {
    event.dataTransfer.setData('text/plain', JSON.stringify({ item, index }));
    event.target.classList.add('drag-ghost');
  }

  dragOver(event: any) {
    event.preventDefault();
    const draggingElement = document.querySelector('.drag-ghost');
    if (draggingElement !== event.target) {
      event.target.closest('.filters-chips-color')?.classList.add('drag-over');
    }
  }

  dragLeave(event: any) {
    event.target.closest('.filters-chips-color')?.classList.remove('drag-over');
  }

  dragEnd(event: any) {
    event.target.classList.remove('drag-ghost');
    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  }

  drop(event: any, newIndex: number) {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    const { item, index } = data;

    document.querySelectorAll('.drag-ghost, .drag-over').forEach((el) => {
      el.classList.remove('drag-ghost', 'drag-over');
    });

    this.chipItems.splice(index, 1);
    this.chipItems.splice(newIndex, 0, item);

    const headerToMove = this.headers.splice(index, 1)[0];
    this.headers.splice(newIndex, 0, headerToMove);

    this.selectedItems = [...this.chipItems];
    this.setValuesUrl();
  }

  async clearFilters() {
    this.selectedProvider = [];
    this.selectedSources = [];
    this.search = [];
    this.filtersMenu = false;
    this.hasRequested = false;
    this.setValuesUrl();
  }

  async applyFilters() {
    this.search = [
      ...this.selectedProvider.map((provider: any) => `email_provider:${provider}`),
      ...this.selectedSources.map((source: any) => `utm_source:${source}`),
      ...(this.filterUtmCampaign ? [`utm_campaign:${this.filterUtmCampaign}`] : []),
      ...(this.filterUrlSource ? [`source_url:${this.filterUrlSource}`] : []),
    ];
    this.setValuesUrl();
    this.filtersMenu = false;
  }

  @Watch('$route')
  async checkRoute(newRoute: any, oldRoute: any) {
    if (JSON.stringify(newRoute.query) !== JSON.stringify(oldRoute.query)) {
      if (Object.values(newRoute.query).length) {
        this.getValuesUrl();
        this.selectedDates = [this.dateToVuetifyString(this.startDate), this.dateToVuetifyString(this.endDate)];
        await this.changeDatePicker(this.selectedDates);
      }

      if (!Object.values(newRoute.query).length) {
        this.clearItems();
        this.selectDateFilter(0);
      }
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.date-button {
  width: 283px;
  border-radius: 8px;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  box-shadow: none;
  overflow: unset !important;
  border-radius: 8px;
}

.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}

.icon-up {
  color: $ds-gray;
}

.date-range {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 400;
  text-transform: initial !important;
}
.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}
.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100 !important;
  border-top: 1px solid $ds-blue !important;
  border-right: 1px solid $ds-blue !important;
  border-left: 1px solid $ds-blue !important;
}

.filters-card {
  border-radius: 8px;
}

.group-items-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
}

.date-filters {
  display: flex;
  flex-direction: column;
  padding-bottom: 10px;
}

.date-period {
  border-bottom: 1px solid $ds-gray-100;
  font-weight: 400;
  font-size: 12px;
  box-shadow: none;
  background-color: #ffffff !important;
  place-content: start;
  text-transform: initial !important;
}

.clear-date {
  display: flex;
  padding: 0px 20px 10px 0px;
  place-content: flex-end;
}

.clear-fields {
  text-transform: uppercase;
  background-color: #ffffff !important;
}

.clear-fields:disabled {
  color: $ds-gray-300 !important;
}
.date-picker {
  border-bottom: 1px solid $ds-gray-100;
}

.menu-group-items {
  display: flex;
  flex-direction: row;
  padding-right: 12px;
  padding-left: 12px;
  align-items: center;
  justify-content: space-between;
  border: 1px solid $ds-gray-300;
  min-height: 36px !important;
  border-radius: 8px;
  cursor: pointer;
  background-color: #ffffff;
}

.group-items-width {
  width: 283px;
}

.group-items-list {
  max-height: 210px;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background-color: #ffffff;
}

.checkbox-group-items {
  padding-top: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  &:hover {
    background-color: #f5f5f5;
  }
}

.input-filters {
  margin: 0 !important;
  cursor: pointer;
  border: none;
  outline: none;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 220px;
  display: block;
  overflow: hidden;
  margin: 0 !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
}

.filters-div {
  width: 100%;
}

.filters-chips {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: -webkit-fill-available;
}

.md-chip-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  background: $ds-gray-300;
  border: 1px solid $ds-gray-300;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  text-align: center;
  cursor: default;
}

.filters-chips-color {
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  height: 24px;
  font-size: 10px;
  display: flex;
  font-weight: 600;
  border-radius: 20px;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
  padding-left: 8px;
  gap: 4px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &[draggable='true'] {
    cursor: grab;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    &:active {
      transform: scale(0.98);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      cursor: grabbing !important;
    }
  }
}

.drag-ghost {
  opacity: 0.5;
  background: #f5f5f5 !important;
  border: 1px dashed $ds-blue !important;
}

.drag-over {
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: -6px;
    top: 50%;
    height: 100%;
    width: 3px;
    background-color: $ds-blue;
    transform: translateY(-50%);
  }
}

.cursor-move {
  cursor: grab;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

::v-deep .v-chip__content {
  display: flex !important;
  gap: 10px !important;
}

.chip-move {
  transition: transform 0.5s ease;
}

.expand-tags {
  margin-top: 8px;
  transition:
    width 2s ease-out,
    height 2s ease-out;
  margin-bottom: 10px;
}

.closed-tags {
  margin-top: 8px;
  margin-bottom: 10px;
  max-height: 24px;
}

.chip-expand {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-text {
  white-space: nowrap;
  max-width: 250px;
  text-overflow: ellipsis;
  overflow: hidden;
}

.open-chips {
  outline: none;
  white-space: nowrap;
  color: $ds-blue;
  padding-left: 8px;
  cursor: pointer !important;

  &:hover {
    color: $ds-blue-dark;
  }
}

.div-chip-gap {
  gap: 8px;
}

.chart-background {
  border-radius: 16px;
  background-color: #ffffff;
  padding: 15px 20px 5px 20px;
  box-shadow: 0px 1px 3px 0px #0000001a;
  box-shadow: 0px 1px 2px 0px #0000000f;
}

.no-data-label {
  text-align: center;
}

.no-items-selected {
  height: 400px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #a6a6a6;
}

.apply-button {
  background-color: $ds-blue;
  border-radius: 8px;
  padding: 12px;
  color: #ffffff;
  font-size: 10px;
  text-transform: uppercase;
  height: 26px;
  align-items: center;
  display: flex;
  &:disabled {
    background-color: #d9d9d9;
    color: #a6a6a6;
  }
}

.group-items-button {
  justify-content: right;
}

.export-button {
  width: fit-content;
  height: 24px;
}

.filter-selected {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 15px;
  width: 15px;
  border-radius: 50%;
  background: $ds-blue;
  color: white;
  font-size: 10px;
}

.filter-selected-item {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 15px;
  width: 15px;
  border-radius: 50%;
  background: $ds-blue;
  color: white;
  font-size: 10px;
  padding-right: 1px;
}

.dropdown-filter {
  margin-right: -2px;
}

.list-groups {
  border-bottom: 1px solid $ds-gray-100;
}

.btn-clear:disabled {
  color: $ds-gray-300 !important;
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300 !important;
}

.filters-title {
  color: $ds-gray;
  font-size: 12px !important;
}

.filters-title:active {
  color: $ds-gray;
}

.filters-list {
  border-top: 1px solid $ds-gray-100;
  overflow-y: scroll;
  padding-top: 8px;
  padding-bottom: 8px;
  overflow: auto;
  background-color: #ffffff;
}

.filters-buttons {
  display: flex;
  flex-direction: center;
  padding: 0.5em;
  margin-top: 10px;
  justify-content: flex-end;
  gap: 15px;
  overflow: hidden;
}

.button-link {
  font-size: 14px;
  justify-content: center;
  color: #0057f4;
  text-decoration: none;
  font-weight: 700;
  text-transform: uppercase;
  margin-top: 4px;
}

.buttons-specs:disabled:hover {
  background-color: inherit !important;
}

.buttons-specs {
  box-shadow: none !important;
  align-items: center;
  text-align: center;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  font-style: normal;
  font-weight: 700;
  width: 73px;
  height: 26px !important;
  font-size: 10px;
  border-radius: 8px !important;
}

.select-items-per-page {
  padding: 5px 10px;
  border: 1px solid $ds-gray-300;
  border-radius: 4px;
  background-color: white;
}

::v-deep .c-pagination {
  .v-pagination__item {
    box-shadow: none;
    border: 1px solid $ds-gray-300;
    background-color: white !important;
    color: $ds-gray;

    &:active {
      background-color: $ds-blue !important;
      color: white;
    }
  }
}

::v-deep.v-btn {
  text-transform: none !important;
}

::v-deep.v-list-group > .v-list-group__header > .v-list-group__header__append-icon .v-icon {
  color: $ds-blue !important;
}

::v-deep .v-dialog {
  border-radius: 16px !important;
}

::v-deep .v-skeleton-loader {
  border-radius: 16px !important;
}

::v-deep.v-date-picker-table {
  height: 232px;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}

::v-deep.filters-card-radius.v-list-group {
  border-radius: 0px 0px 8px 8px !important;
}

::v-deep.filters-card-radius.v-list-item__content {
  border-radius: 0px 0px 8px 8px !important;
}
</style>
