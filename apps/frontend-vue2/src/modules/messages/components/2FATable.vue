<template>
  <div class="two-fa-table">
    <v-data-table
      :headers="headers"
      :items="configsTable"
      :page.sync="pagination.page"
      :items-per-page="pagination.itemsPerPage"
      hide-default-footer
      class="c-table mt-2"
      :calculate-widths="true"
      :no-data-text="`${$t('datatable.noData')}`"
      :server-items-length="pagination.totalItems"
      :options.sync="localOptions"
      @update:options="handleOptionsChange"
    >
      <template v-slot:[`item.groupName`]="{ item }">
        <div class="td-item cursor-pointer">
          <button @click="getGroupSettings(item.groupName)" class="ds-blue-color font-12 text-left">
            {{ item.groupName }}
          </button>
        </div>
      </template>
      <template v-slot:[`item.count_success`]="{ item }">
        <div class="td-item">
          <span class="font-12 ds-gray-color text-600">{{ formatNumber(item.count_success) }}</span>
        </div>
      </template>
      <template v-slot:[`item.count_error`]="{ item }">
        <div class="td-item">
          <span class="font-12 ds-gray-color text-600">{{ formatNumber(item.count_error) }}</span>
        </div>
      </template>
      <template v-slot:[`item.count_verify_validated`]="{ item }">
        <div class="td-item">
          <span class="font-12 ds-gray-color text-600">{{ formatNumber(item.count_verify_validated) }}</span>
        </div>
      </template>
      <template v-slot:[`item.count_verify_rejected`]="{ item }">
        <div class="td-item">
          <span class="font-12 ds-gray-color text-600">{{ formatNumber(item.count_verify_rejected) }}</span>
        </div>
      </template>
      <template v-slot:[`item.actions`]="{ item }">
        <div class="td-item">
          <button class="delete-button cursor-pointer" @click="deleteGroup(item.groupName)">
            <span class="material-symbols-rounded font-20 cursor-pointer">delete</span>
          </button>
        </div>
      </template>
    </v-data-table>
    <div v-if="!noData" class="text-center pagination pt-5 align-items-center justify-space-between">
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
        v-if="configsTable.length > 0"
        class="c-pagination"
        v-model="pagination.page"
        :length="pagination.totalPages"
        @input="handlePagination"
        :total-visible="10"
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
</template>
<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator';
import { Pagination } from '@/models/pagination';

@Component({
  components: {},
  props: ['generalType', 'configsTable', 'pagination', 'options', 'rangeStart', 'rangeFinal', 'totalData', 'noData'],
})
export default class TwoFATable extends Vue {
  @Prop() private generalType!: string;
  @Prop() private configsTable!: any[];
  @Prop() private pagination!: Pagination;
  @Prop() private options!: any;
  @Prop() private rangeStart!: number;
  @Prop() private rangeFinal!: number;
  @Prop() private totalData!: number;
  @Prop() private noData!: boolean;

  localOptions: any = {};
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  headers = [
    {
      text: this.$t('title.group'),
      value: 'groupName',
      sortable: false,
      align: 'start',
    },
    {
      text: this.$t('title.successRequests'),
      value: 'count_success',
      sortable: false,
      align: 'end',
    },
    {
      text: this.$t('title.errorRequests'),
      value: 'count_error',
      sortable: false,
      align: 'end',
    },
    {
      text: this.$t('title.validated2FA'),
      value: 'count_verify_validated',
      sortable: false,
      align: 'end',
    },
    {
      text: this.$t('title.rejected2FA'),
      value: 'count_verify_rejected',
      sortable: false,
      align: 'end',
    },
    {
      text: '',
      value: 'actions',
      sortable: false,
    },
  ];

  created() {
    this.localOptions = { ...this.options };
  }

  handleOptionsChange() {
    this.$emit('onChangeOptions', this.localOptions);
  }

  formatNumber(value: number) {
    return Vue.filter('formatNumber')(value);
  }

  handlePagination() {
    this.$emit('handlePagination');
  }

  getGroupSettings(groupName: string) {
    this.$emit('getGroupSettings', groupName);
  }

  setItemsNumber(value: string) {
    this.$emit('setItemsNumber', parseInt(value, 10));
  }

  deleteGroup(groupName: string) {
    this.$emit('deleteGroup', groupName);
  }

  @Watch('options', { deep: true })
  onOptionsChanged(newOptions: any) {
    this.localOptions = { ...newOptions };
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.c-table {
  margin-top: 28px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
}

.delete-button {
  background: none;
  border: none;
  outline: none;
  color: #a6a6a6;

  &:hover {
    color: #5c5c5c;
  }
}
</style>
