<template>
  <div class="col-12">
    <div class="title-route">
      <h2 class="c-title">{{ $t('sidebar.automations') }}</h2>
      <button v-if="$store.getters.can('automations:create')" class="v-btn-icon button-create" @click="handleMessages">
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="add-span">{{ $t('button.create').toString().toUpperCase() }}</span>
      </button>
    </div>
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="default-filters">
        <div class="default-filters__search-input">
          <InputDefault
            :modelValue="filter.title"
            :placeholder="`${$t('input.search')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>
        </div>
        <multiselect
          class="advanced-select"
          data-cy="status"
          select-label=""
          deselect-label=""
          selected-label=""
          v-model="selectedStatusFilter"
          :searchable="false"
          :options="statusOptions"
          :allow-empty="false"
          track-by="id"
          label="label"
          @input="filterByStatus"
        >
          <template slot="singleLabel" slot-scope="props">
            <span class="option__title">{{ props.option.label }}</span>
          </template>

          <template slot="option" slot-scope="props">
            <div class="option__desc">
              <span class="option__title">{{ props.option.label }}</span>
              <span class="option__small">{{ props.option.relations }}</span>
            </div>
          </template>
          <span
            class="material-symbols-rounded font-24 custom__select"
            slot="caret"
            slot-scope="{ toggle }"
            @mousedown.prevent.stop="toggle"
          >
            keyboard_arrow_down
          </span>
        </multiselect>
      </div>
    </form>

    <DataLoader :isLoading="loadingAutomations" :type="'table-tbody,table-tbody'" class="mt-4" />
    <div :class="loadingAutomations ? 'd-none mt-4' : 'mt-4'">
      <v-data-table
        v-if="automations.length > 0"
        :headers="tableHeaders"
        :items="automations"
        :page.sync="pagination.page"
        :items-per-page="pagination.itemsPerPage"
        hide-default-footer
        class="c-table mt-2"
        :calculate-widths="true"
        :no-data-text="`${$t('datatable.noData')}`"
        :loading="loadingAutomations"
        :server-items-length="pagination.totalItems"
        :options.sync="options"
      >
        <template v-slot:[`item.title`]="{ item }">
          <div class="td-item">
            <router-link
              :to="{ name: 'automation/emails', params: { automation_id: item.id } }"
              :title="`${$t('button.edit')}`"
              class="cursor-pointer font-12"
            >
              {{ item.title }}
            </router-link>
            <p class="m-0 mt-1 text--secondary font-12" v-if="item.description">
              {{ item.description }}
            </p>
          </div>
        </template>
        <template v-slot:[`item.verticalType`]="{ item }" v-if="currentAccount.isInternal">
          <div class="td-item text-start">
            <span class="font-12">
              {{ item.verticalType === 'cc' ? $t('automation.creditCard') : $t('automation.loan') }}
            </span>
          </div>
        </template>
        <template v-slot:[`item.isActive`]="{ item }">
          <div class="td-item text-center">
            <span class="status-chip status-active font-10" v-if="item.isActive === true">
              {{ $t('datatable.active') }}
            </span>
            <span class="status-chip status-inactive font-10" v-else>
              {{ $t('datatable.inactive') }}
            </span>
          </div>
        </template>
        <template v-slot:[`item.updatedAt`]="{ item }">
          <div class="td-item tabular-nums font-12">
            <span> {{ (item.updatedAt || item.createdAt) | formatDateTime }} </span>
          </div>
        </template>
        <template v-slot:[`item.countSteps`]="{ item }">
          <div class="td-item tabular-nums">
            {{ item.countSteps | formatNumber }}
          </div>
        </template>
        <template v-slot:no-data>
          <p :value="true" color="error" class="no-data" icon="warning">{{ $t('datatable.noData') }}</p>
        </template>

        <template v-slot:[`item.actions`]="{ item }">
          <div class="td-item text-end div-row">
            <button
              v-if="$store.getters.can('automations:create')"
              @click="doCopy(item)"
              :title="`${$t('button.duplicate')}`"
              class="cursor-pointer mx-2 button-copy"
              v-tooltip.top="$t('button.duplicate')"
            >
              <span class="material-symbols-rounded ds-light-gray-color font-20">content_copy</span>
            </button>
            <button
              v-if="$store.getters.can('automations:delete')"
              @click="confirmDelete(item)"
              :title="`${$t('button.exclude')}`"
              class="cursor-pointer button-trash"
              v-tooltip.top="$t('button.delete')"
            >
              <span class="material-symbols-rounded ds-light-gray-color font-20">delete</span>
            </button>
          </div>
        </template>
      </v-data-table>
      <div v-if="automations.length === 0 && !loadingAutomations" class="container-no-results">
        <img src="@/assets/automations_fill.svg" class="mx-1" alt="automations" />
        <p class="font-16 font-title-style">{{ $t('datatable.noAutomation') }}</p>
        <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
      </div>
    </div>
    <div v-if="automations.length > 0" class="text-center pagination pt-5 align-items-center justify-space-between">
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
  </div>
</template>

<script lang="ts">
import AutomationService from '../services/automations.service';
import { Pagination } from '@/models/pagination';
import ModalService from '@/services/modal.service';
import { SortDirectionEnum } from '@/enums/sort-direction.enum';

import Multiselect from 'vue-multiselect';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { AutomationDto } from '../dtos/automation.dto';
import { AutomationsFiltersDto } from '../dtos/automations-filters.dto';
import LoadingService from '@/services/loading.service';
import ToastService from '@/services/toast.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { areObjectsEqual, getItemsPerPage, setItemsPerPage } from '../../../util/objects';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';

@Component({
  components: { Multiselect, ButtonDefault, InputDefault, DataLoader },
  filters: {},
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class Automations extends Vue {
  public currentAccount!: AccountDto;
  private readonly automationService = new AutomationService();
  private readonly modalService = new ModalService();
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();

  automations: AutomationDto[] = [];

  pagination = new Pagination();

  statusOptions: any = [];
  orderOptions: any = [];
  searchOptions: AutomationDto[] = [];

  selectedStatusFilter = {};

  options: any = {
    page: 1,
    sortBy: ['updatedAt'],
    sortDesc: [true],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };

  filter: any = {
    title: '',
    isActive: 'true',
  };

  searchLoadingOptions = false;
  automationId: any;
  loadingAutomations = false;
  itemsNumber = 10;
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  rangeStart = 0;
  rangeFinal = 0;
  isInitialLoad = true;

  get tableHeaders() {
    return [
      { text: this.$t('datatable.title'), value: 'title', sortable: true, width: '70%' },
      {
        ...(this.currentAccount?.isInternal
          ? {
              text: this.$t('input.lastVerticalType'),
              value: 'verticalType',
              sortable: true,
              width: '10%',
            }
          : {}),
      },
      { text: this.$t('datatable.status'), value: 'isActive', sortable: false, width: '5%', align: 'center' },
      { text: this.$t('datatable.lastEdition'), value: 'updatedAt', sortable: true, width: '15%' },
      { text: '', value: 'actions', sortable: false, class: 'col-2', width: '5%' },
    ];
  }

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('automations');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getFilterOptions();
    this.getValuesUrl();
    this.searchOptions = this.automations;
    await this.loadAutomations();
    this.isInitialLoad = false;
  }

  async loadAutomations(params?: Pagination) {
    if (this.loadingAutomations) {
      return;
    }

    this.loadingAutomations = true;
    this.loadingService.show();

    if (params) {
      this.pagination = {
        page: params.page,
        itemsPerPage: params.itemsPerPage,
        sortBy: params.sortBy,
        order: params.order,
      };
    }

    try {
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      const result = await this.automationService.getAutomations(this.pagination, this.filter);
      this.automations = result?.data?.results;
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
      if (this.pagination.sortBy !== 'updatedAt') {
        this.setValuesUrl();
      }
    } catch (error) {
      throw error;
    } finally {
      this.loadingAutomations = false;
      this.loadingService.hide();
    }
  }

  confirmSwitch(automation: AutomationDto) {
    this.modalService.confirm({
      title: this.$t('create.activateAutomation') as string,
      text: `${this.$t('create.confirmActivation', {
        action: automation.isActive ? this.$t('create.activate') : this.$t('create.disable'),
        name: automation.title,
      })}`,
      confirmLabel: `${
        automation.isActive
          ? (this.$t('create.activate') as string).toUpperCase()
          : (this.$t('create.disable') as string).toUpperCase()
      }`,
      cancelLabel: this.$t('button.cancel') as string,
      cancelFunction: () => (automation.isActive = !automation.isActive),
      confirmFunction: () => this.patchAutomation(automation),
      isConfirm: automation.isActive ? true : false,
    });
  }

  confirmDelete(automation: AutomationDto) {
    this.automationId = automation.id;
    this.modalService.confirm({
      title: this.$t('modal.deleteAutomation') as string,
      text: `${this.$t('modal.confirmAutomation', { automation: automation.title })}`,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.deleteAutomation,
    });
  }

  async deleteAutomation() {
    await this.automationService.deleteAutomation(this.automationId);
    await this.loadAutomations();
  }

  async patchAutomation(automation: AutomationDto) {
    await this.automationService.patchAutomation({
      id: automation.id,
      isActive: automation.isActive,
    });
    this.submit();
  }

  async doCopy(automation: AutomationDto) {
    if (automation.id) {
      this.loadingService.show();

      const response = await this.automationService.createAutomationCopy(automation.id);
      this.loadingService.hide();

      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('modal.automationDuplicated') as string,
          leftBorder: false,
        });
        this.$router.push(`/automations/emails/${response.data.id}`);
      }
    }
  }

  submit() {
    this.$emit('submit', true);
  }

  newMessage() {
    this.$router.push('/messages/email');
  }

  handleMessages() {
    this.$router.push('/automations/emails/new');
  }

  getFilterOptions() {
    this.statusOptions = this.automationService.getFilterStatusOptions();

    this.selectedStatusFilter = this.statusOptions[0];
    this.filter.type = 'email';
  }

  filterByStatus(query: { id: number; label: string; value: any }) {
    this.filter.isActive = query.value;
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  filterByTitle() {
    this.pagination.page = 1;
    this.loadAutomations();
  }

  updateInput(event: string, key: keyof AutomationsFiltersDto) {
    this.filter[key] = event;
  }

  orderAutomations(query: { id: number; label: string; value: any; order: SortDirectionEnum }) {
    this.pagination.sortBy = query.value;
    this.pagination.order = query.order;
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  handlePagination() {
    this.setValuesUrl();
  }

  setValuesUrl() {
    if (
      this.pagination.page === 1 &&
      this.filter.title === '' &&
      ((this.$route.query.order === undefined && this.pagination.order === 'ASC') ||
        this.pagination.order === this.$route.query.order) &&
      ((this.$route.query.sortBy === undefined && this.pagination.sortBy === 'updatedAt') ||
        this.pagination.sortBy === this.$route.query.sortBy) &&
      ((this.$route.query.isActive === undefined && this.filter.isActive === 'true') ||
        this.filter.isActive === this.$route.query.isActive) &&
      (this.$route.query.page === undefined || this.pagination.page === Number(this.$route.query.page))
    ) {
      return;
    }

    const query = {
      itemsPerPage: this.pagination.itemsPerPage,
      page: this.pagination.page,
      title: this.filter.title,
      isActive: this.filter.isActive,
      sortBy: this.pagination.sortBy || 'updatedAt',
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
      this.filter.title = this.$route.query.title?.toString();
      this.filter.isActive = this.$route.query.isActive;
      this.pagination.sortBy = this.$route.query.sortBy?.toString() || '';
      this.pagination.order = this.$route.query.order?.toString() || 'DESC';
      this.selectedStatusFilter = this.statusOptions.find((option: any) => option.value === this.$route.query.isActive);
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

    this.options = { ...this.options, page: 1, sortBy: ['updatedAt'], sortDesc: [true] };
    this.pagination = { ...this.pagination, page: 1, sortBy: 'updatedAt', order: 'DESC' };
    this.filter.title = '';
    this.filter.type = 'email';
    this.filter.isActive = 'true';
    this.selectedStatusFilter = this.statusOptions[0];
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    setItemsPerPage('automations', items);
    this.loadAutomations();
  }

  @Watch('options')
  async onChangeOptions(newVal: any, oldVal: any) {
    if (this.loadingAutomations || this.isInitialLoad) {
      return;
    }

    if (!oldVal || areObjectsEqual(newVal, oldVal)) {
      return;
    }

    const { sortBy, sortDesc, page, itemsPerPage, totalPages } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      itemsPerPage,
      sortBy: sortBy[0] || '',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
      totalPages,
    };

    this.setValuesUrl();
    await this.loadAutomations();
  }

  @Watch('$route')
  async changePagination() {
    this.getValuesUrl();
    await this.loadAutomations();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';
::v-deep.view-automations {
  width: 100%;
}

::v-deep.multiselect {
  min-height: 36px;
}

::v-deep .v-text-field__slot {
  max-height: 33px !important;
}

::v-deep .c-table {
  margin-top: 28px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
}

::v-deep .multiselect__single {
  font-size: 14px !important;
  font-style: normal;
}

.div-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 75px;
  height: 50px;
}
.size-img {
  width: 20px;
  height: 20px;
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
</style>
