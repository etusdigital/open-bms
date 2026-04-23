<template>
  <div class="col-12 pt-0">
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="default-filters">
        <div class="default-filters__search-input">
          <InputDefault
            :modelValue="name"
            :placeholder="`${$t('input.searchWarmup')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>
        </div>

        <select
          class="form-control mo-select outline-select text-600 select-warmup-status"
          v-model="selectedStatus"
          @change="filterByStatus($event.target.value)"
        >
          <option value="">{{ $t('input.select') }}</option>
          <option
            class="font-12"
            v-for="status in statusOptions"
            :value="status.value"
            :key="'eventstatustype-' + status.value"
          >
            {{ status.name }}
          </option>
        </select>
      </div>
    </form>
    <div>
      <DataLoader :isLoading="isLoadingWarmups" :type="'table-tbody,table-tbody'" class="pt-4" />
      <div :class="isLoadingWarmups ? 'd-none mt-4' : 'mt-4'">
        <v-data-table
          :headers="headers"
          :items="warmups"
          :page.sync="pagination.page"
          :items-per-page="pagination.itemsPerPage"
          hide-default-footer
          class="c-table mt-2"
          :calculate-widths="true"
          :no-data-text="`${$t('datatable.noData')}`"
          :loading="isLoadingWarmups"
          :server-items-length="pagination.totalItems"
          :options.sync="options"
        >
          <template v-slot:[`item.progress`]="{ item }">
            <div class="td-item percentage-number mb-1 tabular-nums" :class="[`warmup-status-${item.status}`]">
              <div class="flex font-12">{{ item.progress }}%</div>
              <span class="material-symbols-rounded prepend-icon align-end"> rocket_launch </span>
            </div>
            <v-progress-linear :value="item.progress" height="4" :color="item.statusColor" rounded />
            <div class="font-10 text-center">
              {{ $t(`datatable.warmupProgressDays`, { days: item.daysPast }) }}
            </div>
          </template>

          <template v-slot:[`item.status`]="{ item }">
            <span class="status-chip" :class="[`status-${item.status}`]">
              {{ $t(`datatable.warmupStatus${item.status}`) }}
            </span>
          </template>

          <template v-slot:[`item.sender`]="{ item }">
            <router-link :to="`warmups/${item.id}`" class="table-item-click font-title" cursor="pointer">
              {{ item.sender }}
            </router-link>
            <p class="m-0 mt-1 text--secondary font-12" v-if="item.description">
              {{ item.description }}
            </p>
          </template>

          <template v-slot:[`item.account.name`]="{ item }">
            <span class="font-title">
              {{ item.account.name }}
            </span>
          </template>

          <template v-slot:[`item.targetAccount.name`]="{ item }">
            <span class="font-title">
              {{ item.targetAccount.name }}
            </span>
          </template>

          <template v-slot:[`item.createdAt`]="{ item }">
            <span class="font-title">
              {{ item.createdAt | formatDate }}
            </span>
          </template>

          <template v-if="$store.getters.can('infra:manage')" v-slot:[`item.actions`]="{ item }">
            <div class="td-item text-end">
              <button
                @click="confirmDelete(item)"
                :title="`${$t('button.exclude')}`"
                class="cursor-pointer button-trash"
                v-tooltip.top="$t('button.delete')"
              >
                <span class="material-symbols-rounded ds-light-gray-color">delete</span>
              </button>
            </div>
          </template>

          <template v-slot:no-data>
            <p :value="true" color="error" class="no-data" icon="warning">{{ $t('datatable.noData') }}</p>
          </template>
        </v-data-table>
      </div>

      <div class="text-center pagination pt-5 align-items-center justify-space-between">
        <div class="div-row gap-5 align-items-center">
          <span class="d-flex text-400 font-14 text-nowrap align-items-center">{{ $t('input.itemsPerPage') }}</span>
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
          v-if="warmups.length > 0"
          class="c-pagination"
          v-model="pagination.page"
          :length="pagination.totalPages"
          :total-visible="10"
          @input="handlePagination"
        ></v-pagination>
        <span class="font-14 text-400 text-nowrap"
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
    </div>
  </div>
</template>

<script lang="ts">
import { Pagination } from '@/models/pagination';
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { WarmupDto } from '../dtos/warmup.dto';
import WarmupService from '../services/warmup.service';
import DataTable from '@/components/data-table/DataTable.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { areObjectsEqual, getItemsPerPage, setItemsPerPage } from '../../../util/objects';

@Component({
  components: {
    DataTable,
    DataLoader,
    ButtonDefault,
    InputDefault,
  },
  filters: {},
})
export default class WarmupList extends Vue {
  private readonly warmupService = new WarmupService();
  private readonly loadingService = new LoadingService();
  private readonly modalService = new ModalService();

  pagination = new Pagination();
  warmups: Array<WarmupDto> = new Array<WarmupDto>();
  idWarmup: any;
  isLoadingWarmups = false;
  totalWarmupData = 0;
  options: any = {
    page: 1,
    sortBy: ['createdAt'],
    sortDesc: [false],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  order = '';
  dataTable: any = {};
  name: string | (string | null)[] = '';
  selectedStatus: string | (string | null)[] = '';
  statusOptions = [
    { name: this.$t('datatable.warmupStatusnotStarted'), value: 'notStarted' },
    { name: this.$t('datatable.warmupStatusrunning'), value: 'running' },
    { name: this.$t('datatable.warmupStatustransferring'), value: 'transferring' },
    { name: this.$t('datatable.warmupStatusfinished'), value: 'finished' },
    { name: this.$t('datatable.warmupStatusdeactivated'), value: 'deactivated' },
  ];

  headers = [
    { text: this.$t('datatable.sender'), value: 'sender', sortable: true, width: '25%' },
    { text: this.$t('datatable.account'), value: 'account.name', sortable: false, width: '10%' },
    { text: this.$t('datatable.targetAccount'), value: 'targetAccount.name', sortable: false, width: '10%' },
    { text: this.$t('datatable.status'), value: 'status', sortable: true, width: '10%' },
    { text: this.$t('datatable.warmupProgress'), value: 'progress', sortable: false, width: '20%' },
    { text: this.$t('datatable.startedAt'), value: 'createdAt', sortable: true, width: '15%' },
    { text: '', value: 'actions', sortable: false, width: '2%' },
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

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('warmups');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getValuesUrl();
    await this.getWarmups();
  }

  async getWarmups() {
    if (this.isLoadingWarmups) {
      return;
    }

    this.isLoadingWarmups = true;
    this.loadingService.show();

    try {
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      const result = await this.warmupService.getWarmups({ ...this.$route.query, ...this.pagination, name: this.name });
      this.warmups = result.data.results.map((warmup: WarmupDto) => {
        const progress = Math.round((Number(warmup.currentSend) / Number(warmup.target)) * 100);
        const currentDate = new Date();
        const startedAt = new Date(warmup.createdAt as string);
        const diffDate = currentDate.getTime() - startedAt.getTime();
        const daysPast = Math.round(diffDate / (24 * 60 * 60 * 1000));

        const statusColor = {
          notStarted: '#D9D9D9',
          running: '#7B61FF',
          transferring: '#7B61FF',
          finished: '#0FB75C',
          deactivated: '#D9D9D9',
        };

        return {
          ...warmup,
          progress,
          statusColor: statusColor[warmup.status || 'notStarted'],
          daysPast,
        };
      });

      this.totalWarmupData = result.data.totalItems;

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
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoadingWarmups = false;
      this.loadingService.hide();
    }
  }

  handlePagination() {
    this.setValuesUrl();
  }

  async deleteWarmup() {
    await this.warmupService.deleteWarmup(this.idWarmup);
    await this.getWarmups();
  }

  confirmDelete(warmup: WarmupDto) {
    this.idWarmup = warmup.id;
    this.modalService.confirm({
      title: this.$t('modal.deleteMessage') as string,
      text: `${this.$t('modal.confirmWarmup')}`,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.deleteWarmup,
    });
  }

  filterByTitle() {
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  updateInput(event: string) {
    this.name = event;
  }

  setValuesUrl() {
    if (
      this.pagination.page === 1 &&
      this.name === '' &&
      this.$route.query.name === undefined &&
      this.selectedStatus === '' &&
      this.$route.query.status === undefined &&
      ((this.$route.query.order === undefined && this.pagination.order === 'DESC') ||
        this.pagination.order === this.$route.query.order) &&
      ((this.$route.query.sortBy === undefined && this.pagination.sortBy === 'createdAt') ||
        this.pagination.sortBy === this.$route.query.sortBy) &&
      (this.$route.query.page === undefined || this.pagination.page === Number(this.$route.query.page))
    ) {
      return;
    }
    const query = {
      itemsPerPage: this.pagination.itemsPerPage,
      page: this.pagination.page,
      name: this.name,
      status: this.selectedStatus,
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
      this.pagination.sortBy = this.$route.query.sortBy?.toString() || 'createdAt';
      this.pagination.order = this.$route.query.order?.toString() || 'ASC';
      this.name = this.$route.query.name;
      this.selectedStatus = this.$route.query.status || 'running';
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

    this.options = { ...this.options, page: 1, sortBy: ['createdAt'], sortDesc: [true] };
    this.pagination = { ...this.pagination, page: 1, sortBy: 'createdAt', order: 'DESC' };
    this.name = '';
  }

  handleOptions(options: any) {
    this.options = { ...this.options, ...options };
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    setItemsPerPage('warmups', items);
    this.getWarmups();
  }

  filterByStatus(status: string) {
    this.selectedStatus = status;
    this.setValuesUrl();
  }

  @Watch('options')
  async onChangeOptions() {
    if (this.isLoadingWarmups) {
      return;
    }

    const { sortBy, sortDesc, page, itemsPerPage } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      itemsPerPage,
      sortBy: sortBy[0] || 'createdAt',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
    };

    this.setValuesUrl();

    await this.getWarmups();
  }

  @Watch('$route')
  async changePagination() {
    this.getValuesUrl();
    await this.getWarmups();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

::v-deep .c-table {
  margin-top: 28px;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.06),
    0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
}

.status-notStarted,
.status-deactivated {
  color: $ds-gray-400;
  background: $ds-gray-100;
}

.status-running,
.status-transferring {
  color: $ds-purple;
  background: $ds-light-purple;
}

.status-finished {
  color: $ds-green;
  background: $ds-light-green;
}

.warmup-status-notStarted,
.warmup-status-deactivated {
  color: $ds-gray-400;
}

.warmup-status-running,
.warmup-status-transferring {
  color: $ds-purple;
}

.warmup-status-finished {
  color: $ds-green;
}

.percentage-number {
  display: flex;
  justify-content: space-between;
  line-height: 130%;
}

.select-warmup-status {
  width: 120px;
}
</style>
