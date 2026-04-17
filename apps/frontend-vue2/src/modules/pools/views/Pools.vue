<template>
  <div class="col-12 pt-0">
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="default-filters">
        <div class="default-filters__search-input">
          <InputDefault
            :modelValue="name"
            :placeholder="`${$t('input.searchPool')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>
        </div>
      </div>
    </form>
    <div>
      <DataLoader :isLoading="isLoadingPools" :type="'table-tbody,table-tbody'" class="pt-4" />
      <DataTable
        :headers="headers"
        :items="pools"
        :actions="$store.getters.can('infra:manage') ? ['delete'] : []"
        :pagination="pagination"
        :isLoading="isLoadingPools"
        :pageReference="'pools'"
        :options="options"
        :rangeStart="rangeStart"
        :rangeFinal="rangeFinal"
        :totalData="pagination.totalItems"
        @delete="confirmDelete"
        @onChangeOptions="handleOptions"
        @handlePagination="handlePagination"
        @getDataRequest="getPools"
      />
    </div>
  </div>
</template>
<script lang="ts">
import { Pagination } from '@/models/pagination';
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { PoolDto } from '../dtos/pool.dto';
import PoolService from '../services/pool.service';
import DataTable from '@/components/data-table/DataTable.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { areObjectsEqual, getItemsPerPage } from '../../../util/objects';

@Component({
  components: {
    DataTable,
    DataLoader,
    ButtonDefault,
    InputDefault,
  },
  filters: {},
})
export default class Pools extends Vue {
  private readonly poolService = new PoolService();
  private readonly loadingService = new LoadingService();
  private readonly modalService = new ModalService();

  pagination = new Pagination();
  pools: Array<PoolDto> = new Array<PoolDto>();
  idPool: any;
  isLoadingPools = false;
  totalPoolData = 0;
  options: any = {
    page: 1,
    sortBy: ['name'],
    sortDesc: [false],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  order = '';
  dataTable: any = {};
  name: string | (string | null)[] = '';

  headers = [
    { text: this.$t('datatable.name'), value: 'name', sortable: true, width: '40%' },
    {
      text: this.$t('datatable.sender'),
      value: 'senderCompost',
      sortable: false,
      width: '25%',
      cellClass: 'font-title',
    },
    { text: this.$t('datatable.poolName'), value: 'poolName', sortable: true, width: '15%', cellClass: 'font-title' },
    {
      text: this.$t('datatable.isPoolDefault'),
      value: 'isDefault',
      sortable: false,
      width: '5%',
      cellClass: 'font-title',
    },
    { text: '', value: 'actions', sortable: false, width: '5%' },
  ];
  rangeStart = 0;
  rangeFinal = 0;

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('pools');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getValuesUrl();
    await this.getPools();
  }

  async getPools() {
    if (this.isLoadingPools) {
      return;
    }
    this.isLoadingPools = true;
    this.loadingService.show();

    try {
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      const result = await this.poolService.getPools({ ...this.$route.query, ...this.pagination, name: this.name });
      this.pools = result?.data?.results;
      this.totalPoolData = result?.data?.totalItems;
      this.pools = this.pools.map((item) => {
        return {
          ...item,
          ips: item.ip ? item.ip.split(',') : '',
          senderCompost:
            item.senderName || item.senderEmail != null ? `${item?.senderName || ''} - ${item?.senderEmail || ''}` : '',
        };
      });

      this.pagination = {
        ...this.pagination,
        itemsPerPage: parseInt(result?.data?.itemsPerPage, 10),
        page: parseInt(result?.data?.page, 10),
        totalPages: Math.ceil(result?.data?.totalItems / result?.data?.itemsPerPage),
      };
      const calculateFinalRange = this.pagination.itemsPerPage + this.rangeStart - 1;
      this.rangeFinal =
        this.pagination.totalItems < calculateFinalRange ? this.pagination.totalItems : calculateFinalRange;
      this.setValuesUrl();
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoadingPools = false;
      this.loadingService.hide();
    }
  }

  handlePagination() {
    this.setValuesUrl();
  }

  async deletePool() {
    await this.poolService.deletePool(this.idPool);
    await this.getPools();
  }

  confirmDelete(pool: PoolDto) {
    this.idPool = pool.id;
    this.modalService.confirm({
      title: this.$t('modal.deleteMessage') as string,
      text: `${this.$t('modal.confirmPool', { pool: pool.name })}`,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.deletePool,
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
      this.$route.query.title === undefined &&
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
      name: this.name,
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
      this.name = this.$route.query.name;
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
    this.name = '';
  }

  handleOptions(options: any) {
    this.options = { ...this.options, ...options };
  }

  @Watch('options')
  async onChangeOptions() {
    if (this.isLoadingPools) {
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

    await this.getPools();
  }

  @Watch('$route')
  async changePagination() {
    this.getValuesUrl();
    await this.getPools();
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

  .icon {
    width: 16px;
    opacity: 0.6;
  }

  .no-data {
    margin: 0;
  }

  td {
    min-height: 52px;
    height: auto !important;
    padding: 16px 32px !important;
  }

  .td-item {
    display: flex;
    align-items: center;
    height: 100%;
  }

  .ips {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
</style>
