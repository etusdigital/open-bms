<template>
  <div class="col-12 pt-0">
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="default-filters">
        <div class="default-filters__search-input">
          <InputDefault
            :modelValue="title"
            :placeholder="`${$t('input.searchCustomFields')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>
        </div>
      </div>
    </form>
    <div v-if="customfields.length > 0">
      <DataLoader :isLoading="isLoadingFields" :type="'table-tbody,table-tbody'" class="mt-4" />
      <DataTable
        :headers="headers"
        :items="customfields"
        :actions="['delete']"
        :pagination="pagination"
        :isLoading="isLoadingFields"
        :pageReference="'customfields'"
        :options="options"
        :rangeStart="rangeStart"
        :rangeFinal="rangeFinal"
        :totalData="pagination.totalItems"
        @delete="confirmDelete"
        @onChangeOptions="handleOptions"
        @handlePagination="handlePagination"
        @getDataRequest="getCustomFields"
      />
    </div>
    <div v-if="customfields.length === 0 && !isLoadingFields" class="container-no-results">
      <img src="@/assets/custom_fields_fill.svg" class="mx-1" alt="automations" />
      <p class="font-16 font-title-style">{{ $t('datatable.noCustomFields') }}</p>
      <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { Pagination } from '@/models/pagination';
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { CustomFieldsDto } from '../dtos/customFieldsdto';
import CustomFieldsService from '../services/customFields.service';
import DataTable from '@/components/data-table/DataTable.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { areObjectsEqual, getItemsPerPage } from '../../../util/objects';

@Component({
  components: {
    DataTable,
    ButtonDefault,
    DataLoader,
    InputDefault,
  },
  filters: {},
})
export default class CustomFields extends Vue {
  private readonly customFieldsService = new CustomFieldsService();
  private readonly loadingService = new LoadingService();
  private readonly modalService = new ModalService();

  pagination = new Pagination();
  customfields: Array<CustomFieldsDto> = new Array<CustomFieldsDto>();
  customFieldId: any;
  isLoadingFields = false;
  isDataLoaded = false;
  options: any = {
    page: 1,
    sortBy: ['title'],
    sortDesc: [false],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  title: string | (string | null)[] = '';

  headers = [
    { text: this.$t('datatable.title'), value: 'title', sortable: true },
    { text: this.$t('datatable.name'), value: 'name', sortable: true, cellClass: 'font-title' },
    { text: this.$t('datatable.order'), value: 'order', sortable: true, width: '10%' },
    { text: '', value: 'actions', sortable: false, width: '5%' },
  ];
  rangeStart = 0;
  rangeFinal = 0;

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('customfields');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getValuesUrl();
    await this.getCustomFields();
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
    };

    if (areObjectsEqual(this.$route.query, query) === false) {
      this.$router.push({ query });
    }
  }

  getValuesUrl() {
    if (this.$route.query.page) {
      this.pagination.page = Number(this.$route.query.page);
      this.pagination.itemsPerPage = Number(this.$route.query.itemsPerPage);
      this.pagination.sortBy = this.$route.query.sortBy?.toString() || '';
      this.pagination.order = this.$route.query.order?.toString() || 'DESC';
      this.title = this.$route.query.title;
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

    this.options = { ...this.options, page: 1, sortBy: ['title'], sortDesc: [false] };
    this.pagination = { ...this.pagination, page: 1, sortBy: 'title', order: 'DESC' };
    this.title = '';
  }

  async getCustomFields() {
    if (this.isLoadingFields) {
      return;
    }
    this.isLoadingFields = true;
    this.loadingService.show();

    try {
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      const result = await this.customFieldsService.getCustomFields({
        title: this.title,
        ...this.$route.query,
        ...this.pagination,
      });
      this.customfields = result?.data?.results;

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
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoadingFields = false;
      this.loadingService.hide();
    }
  }

  handlePagination() {
    this.setValuesUrl();
  }

  async deleteCustomField() {
    await this.customFieldsService.deleteCustomField(this.customFieldId);
    await this.getCustomFields();
  }

  confirmDelete(customfield: CustomFieldsDto) {
    this.customFieldId = customfield.id;
    this.modalService.confirm({
      title: this.$t('modal.deleteFields') as string,
      text: `${this.$t('modal.confirmField', { field: customfield.title })}`,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.deleteCustomField,
    });
  }

  filterByTitle() {
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  updateInput(event: string) {
    this.title = event;
  }

  handleOptions(options: any) {
    this.options = { ...this.options, ...options };
  }

  @Watch('options')
  async onChangeOptions() {
    if (this.isLoadingFields) {
      return;
    }

    const { sortBy, sortDesc, page, itemsPerPage } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      itemsPerPage,
      sortBy: sortBy[0] || 'updatedAt',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
    };

    this.setValuesUrl();

    await this.getCustomFields();
  }

  @Watch('$route')
  async changePagination() {
    if (Object.keys(this.$route.query || {}).length === 0) {
      this.isDataLoaded = false;
      this.pagination = new Pagination();
    }

    this.getValuesUrl();
    await this.getCustomFields();
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
</style>
