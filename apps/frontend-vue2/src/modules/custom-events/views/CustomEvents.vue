<template>
  <div class="col-12 pt-0">
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="default-filters">
        <div class="default-filters__search-input">
          <InputDefault
            :modelValue="title"
            :placeholder="`${$t('input.searchCustomEvent')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>
        </div>
      </div>
    </form>
    <DataLoader :isLoading="isLoadingCustomEvents" :type="'table-tbody,table-tbody'" class="mt-4" />
    <div :class="isLoadingCustomEvents ? 'd-none mt-4' : 'mt-4'">
      <v-data-table
        v-if="customEvents.length > 0"
        :headers="headers"
        :items="customEvents"
        :page.sync="pagination.page"
        :items-per-page="pagination.itemsPerPage"
        hide-default-footer
        class="c-table mt-2"
        :calculate-widths="true"
        :no-data-text="`${$t('datatable.noData')}`"
        :loading="isLoadingCustomEvents"
        :server-items-length="pagination.totalItems"
        :options.sync="options"
      >
        <template v-slot:[`item.name`]="{ item }">
          <div class="td-item">
            <router-link
              :to="{ name: 'edit-custom-events', params: { custom_event_id: item.id } }"
              :title="`${$t('button.edit')}`"
              class="cursor-pointer font-12"
            >
              {{ item.name }}
            </router-link>
            <p class="m-0 mt-1 text--secondary font-12" v-if="item.description">
              {{ item.description }}
            </p>
          </div>
        </template>

        <template v-slot:[`item.updatedAt`]="{ item }">
          <div class="td-item">
            <p class="m-0 mt-1 text--secondary font-12">
              {{ item.updatedAt || item.createdAt | formatDateTime }}
            </p>
          </div>
        </template>

        <template v-slot:[`item.statistics.total`]="{ item }">
          <div class="td-item">
            <div class="d-flex align-items-center justify-content-end">
              <apexChart
                v-if="item.statistics.total > 0"
                :id="`chart-${item.id}`"
                height="30"
                width="150"
                type="area"
                :options.sync="item.chartOptions"
                :series.sync="item.chartSeries"
              ></apexChart>

              <span class="ml-2">{{ item.statistics.total }}</span>
            </div>
          </div>
        </template>

        <template v-slot:[`item.statistics.unique`]="{ item }">
          <div class="td-item">
            <div class="d-flex align-items-center justify-content-end">
              <apexChart
                v-if="item.statistics.unique > 0"
                :id="`chart-${item.id}`"
                height="30"
                width="150"
                type="area"
                :options.sync="item.chartOptions"
                :series.sync="item.chartSeriesUnique"
              ></apexChart>

              <span class="ml-2">{{ item.statistics.unique }}</span>
            </div>
          </div>
        </template>

        <template v-slot:[`item.statistics.last_occurrence`]="{ item }">
          <div class="td-item" :title="item.statistics.last_occurrence | formatDateTime">
            {{ timeAgo(item.statistics.last_occurrence) }}
          </div>
        </template>

        <template v-slot:[`item.actions`]="{ item }">
          <div class="td-item text-end div-row gap-5">
            <router-link
              :to="{ name: 'events-logs', params: { custom_event_id: item.id } }"
              class="cursor-pointer button-trash"
              v-tooltip.top="$t('button.history')"
            >
              <span class="material-symbols-rounded ds-light-gray-color font-20 unfilled-icon">overview</span>
            </router-link>
            <button
              v-if="$store.getters.can('infra:manage')"
              @click="confirmDelete(item)"
              class="cursor-pointer button-trash"
              :disabled="item.isDefault"
              v-tooltip.top="item.isDefault ? $t('button.deleteDefaultEvent') : $t('button.delete')"
            >
              <span class="material-symbols-rounded ds-light-gray-color font-20">delete</span>
            </button>
          </div>
        </template>
      </v-data-table>
    </div>
    <div v-if="customEvents.length > 0" class="text-center pagination pt-5 align-items-center justify-space-between">
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
        class="c-pagination"
        v-model="pagination.page"
        :length="pagination.totalPages"
        :total-visible="10"
        @input="handlePagination"
      ></v-pagination>
      <span class="font-12 text-400 text-nowrap"
        >{{ $t('datatable.showing') }}
        {{
          $t('datatable.contactsTotal', {
            rangeStart: rangeStart,
            rangeFinal: rangeFinal,
            total: pagination.totalItems,
          })
        }}</span
      >
    </div>

    <div v-if="customEvents.length === 0 && !isLoadingCustomEvents" class="container-no-results">
      <span class="material-symbols-rounded icon-style"> news </span>
      <p class="font-16 font-title-style">{{ $t('datatable.noCustomEvent') }}</p>
      <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { Pagination } from '@/models/pagination';
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { CustomEventDto } from '../dtos/custom-event.dto';
import CustomEventService from '../services/custom-event.service';
import DataTable from '@/components/data-table/DataTable.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { areObjectsEqual, getItemsPerPage, setItemsPerPage } from '../../../util/objects';
import ApexCharts from 'vue-apexcharts';
import { mapState } from 'vuex';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';
import 'dayjs/locale/en';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

@Component({
  components: {
    DataTable,
    ButtonDefault,
    InputDefault,
    DataLoader,
    ApexCharts,
  },
  filters: {},
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class CustomEvents extends Vue {
  private readonly customEventService = new CustomEventService();
  private readonly loadingService = new LoadingService();
  private readonly modalService = new ModalService();
  public currentAccountTimezone!: string;
  public userLanguage!: string;

  pagination = new Pagination();
  customEvents: Array<CustomEventDto> = new Array<CustomEventDto>();
  idAccount: any;
  options: any = {
    page: 1,
    itemsPerPage: 10,
    sortBy: ['name'],
    sortDesc: [false],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  isLoadingCustomEvents = false;
  title: string | (string | null)[] = '';
  isDefault = false;

  headers = [
    { text: this.$t('datatable.name'), value: 'name', sortable: true, width: '40%' },
    { text: this.$t('datatable.lastEdition'), value: 'updatedAt', sortable: true, width: '15%' },
    {
      text: this.$t('datatable.totalSevenDays'),
      value: 'statistics.total',
      sortable: false,
      width: '10%',
    },
    {
      text: this.$t('datatable.totalUniqueSevenDays'),
      value: 'statistics.unique',
      sortable: false,
      width: '10%',
    },
    { text: this.$t('datatable.lastOccurrence'), value: 'statistics.last_occurrence', sortable: false, width: '15%' },
    { text: '', value: 'actions', sortable: false, width: '5%' },
  ];

  itemsNumber = 10;
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  rangeStart = 0;
  rangeFinal = 0;

  chartOptions = {
    chart: {
      group: 'sparklines',
      type: 'area',
      height: 30,
      width: 150,
      sparkline: {
        enabled: true,
      },
    },
    stroke: {
      curve: 'straight',
      width: 2,
    },
    fill: {
      opacity: 1,
    },
    yaxis: {
      min: 0,
    },
    colors: ['#0057f4'],
    labels: [],
    tooltip: {},
  };
  series = [];
  isInitialLoad = true;

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('custom-events');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getValuesUrl();

    await this.getCustomEvents();
    this.isInitialLoad = false;
  }

  async getCustomEvents() {
    if (this.isLoadingCustomEvents) {
      return;
    }

    this.isLoadingCustomEvents = true;
    this.loadingService.show();

    try {
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      const result = await this.customEventService.getCustomEvents({
        ...this.$route.query,
        ...this.pagination,
        title: this.title,
      });
      this.customEvents = result?.data?.results.map((event: any) => {
        return {
          ...event,
          statistics: {
            ...event.statistics,
            days: event.statistics?.days.sort(
              (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
            ),
            last_occurrence: event.statistics.last_occurrence,
          },
          chartOptions: {
            ...this.chartOptions,
            labels: event.statistics?.days.map((day: any) => {
              const date = dayjs(day.date).tz(this.currentAccountTimezone);
              return `${date.format('DD/MM/YYYY')}`;
            }),
            tooltip: {
              x: {
                show: true,
                formatter: (value: any) => {
                  return dayjs(value).tz(this.currentAccountTimezone).format('DD/MM/YYYY');
                },
              },
            },
          },
          chartSeries: [
            {
              name: '',
              data: event.statistics?.days.map((day: any) => {
                return {
                  x: dayjs(day.date).tz(this.currentAccountTimezone).valueOf(),
                  y: day.events_count,
                };
              }),
            },
          ],
          chartSeriesUnique: [
            {
              name: '',
              data: event.statistics?.days.map((day: any) => {
                return {
                  x: dayjs(day.date).tz(this.currentAccountTimezone).valueOf(),
                  y: day.events_unique,
                };
              }),
            },
          ],
        };
      });

      this.pagination = {
        itemsPerPage: parseInt(result?.data?.itemsPerPage, 10),
        page: parseInt(result?.data?.page, 10),
        totalItems: result?.data?.totalItems,
        sortBy: this.pagination.sortBy || '',
        order: this.pagination.order,
        totalPages: Math.ceil(result?.data?.totalItems / result?.data?.itemsPerPage),
      };
      const calculateFinalRange = this.pagination.itemsPerPage + this.rangeStart - 1;
      this.rangeFinal =
        this.pagination.totalItems < calculateFinalRange ? this.pagination.totalItems : calculateFinalRange;

      if (this.pagination.sortBy !== 'name') {
        this.setValuesUrl();
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoadingCustomEvents = false;
      this.loadingService.hide();
    }
  }

  handlePagination() {
    this.setValuesUrl();
  }

  async deleteCustomEvent() {
    await this.customEventService.deleteCustomEvent(this.idAccount);
    await this.getCustomEvents();
  }

  confirmDelete(customEvents: CustomEventDto) {
    this.idAccount = customEvents.id;
    this.modalService.confirm({
      title: this.$t('modal.deleteMessage') as string,
      text: `${this.$t('modal.confirmCustomEvents', { event: customEvents.name })}`,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.deleteCustomEvent,
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
    if (
      this.pagination.page === 1 &&
      this.title === '' &&
      ((this.$route.query.order === undefined && this.pagination.order === 'ASC') ||
        this.pagination.order === this.$route.query.order) &&
      ((this.$route.query.sortBy === undefined && this.pagination.sortBy === 'name') ||
        this.pagination.sortBy === this.$route.query.sortBy) &&
      (this.$route.query.page === undefined || this.pagination.page === Number(this.$route.query.page))
    ) {
      return;
    }

    const query = {
      itemsPerPage: this.pagination.itemsPerPage,
      page: this.pagination.page,
      title: this.title,
      sortBy: this.pagination.sortBy,
      order: this.pagination.order,
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
      this.title = this.$route.query.title?.toString();

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
    setItemsPerPage('custom-events', items);

    this.getCustomEvents();
  }

  timeAgo(date: string) {
    if (date === null) {
      return this.$t('datatable.never');
    }
    dayjs.locale(this.userLanguage);
    return dayjs(date).tz(this.currentAccountTimezone).fromNow();
  }

  @Watch('options')
  async onChangeOptions(newVal: any, oldVal: any) {
    if (this.isLoadingCustomEvents || this.isInitialLoad) {
      return;
    }

    if (!oldVal || areObjectsEqual(newVal, oldVal)) {
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

    await this.getCustomEvents();
  }

  @Watch('$route')
  async changePagination() {
    this.getValuesUrl();
    await this.getCustomEvents();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

::v-deep .v-text-field__slot {
  max-height: 33px !important;
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

::v-deep.c-table {
  margin-top: 16px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);

  .no-data {
    margin: 0;
  }

  td {
    min-height: 52px;
    height: auto !important;
    padding: 16px 32px !important;
  }

  th.text-start {
    white-space: nowrap;
  }

  .sucess--text {
    color: $ds-blue;
  }
}
.list-inline {
  margin-bottom: 0px;
  padding-left: 0px !important;
}
.messages-options_actions {
  box-sizing: initial;
  padding-bottom: 10px;
}

.messages-options {
  padding-top: 7px;
  display: flex;
}

.list-inline-item {
  font-style: normal;
  font-weight: 600;
  font-size: 12px;
  line-height: 150%;
  color: $neutral-gray-800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  vertical-align: sub;
}
.list-inline-item a,
.list-inline-item span {
  padding: 1.5px 0;
}

.list-inline-item:hover {
  color: #35353ba4;
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
</style>
