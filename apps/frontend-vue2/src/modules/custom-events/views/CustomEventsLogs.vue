<template>
  <div class="col-12 pt-0">
    <h2 class="label-title label-color mb-0 align-self-end font-16">
      {{ $t('title.eventName') }}: {{ customEvent.name }}
    </h2>
    <DataLoader :isLoading="isLoading" :type="'table-tbody,table-tbody'" class="mt-4" />
    <div :class="isLoading ? 'd-none mt-4' : 'mt-4'">
      <v-data-table
        v-if="customEventLogs.length > 0"
        :headers="headers"
        :items="customEventLogs"
        :page.sync="pagination.page"
        :items-per-page="pagination.itemsPerPage"
        class="c-table mt-2"
        hide-default-footer
        :calculate-widths="true"
        :no-data-text="`${$t('datatable.noData')}`"
        :loading="isLoading"
      >
        <template v-slot:[`item.time`]="{ item }">
          <div class="td-item">
            <p class="m-0 mt-1 text--secondary font-12">
              {{ item.time | formatDateTime }}
            </p>
          </div>
        </template>

        <template v-slot:[`item.properties`]="{ item }">
          <div class="td-item">
            <p class="m-0 mt-1 text--secondary font-12">
              <span v-for="(value, key) in item.properties" :key="key" class="property-item">
                {{ key }}: {{ value }}
              </span>
            </p>
          </div>
        </template>

        <template v-slot:[`item.location`]="{ item }">
          <div class="td-item">
            <p class="m-0 mt-1 text--secondary font-12">{{ item.city }}, {{ item.region }}, {{ item.country }}</p>
          </div>
        </template>

        <template v-slot:[`item.actions`]="{ item }">
          <div class="td-item text-end div-row gap-5">
            <button
              @click="openEventDetails(item)"
              class="cursor-pointer button-trash"
              v-tooltip.top="$t('button.eventDetails')"
            >
              <span class="material-symbols-rounded ds-light-gray-color font-20 unfilled-icon">quick_reference</span>
            </button>
          </div>
        </template>
      </v-data-table>

      <div
        v-if="customEventLogs.length > 0"
        class="text-center pagination pt-5 align-items-center justify-space-between"
      >
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

      <div v-if="customEventLogs.length === 0 && !isLoading" class="container-no-results">
        <img src="@/assets/custom_fields_fill.svg" class="mx-1" alt="automations" />
        <p class="font-16 font-title-style">{{ $t('datatable.noCustomFields') }}</p>
        <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
      </div>
    </div>

    <div v-if="eventDetails">
      <v-dialog v-model="eventDetails" max-width="800">
        <div class="div-column gap-20 w-100 card-style">
          <div class="div-row gap-5 w-100 ds-gray-color justify-content-between">
            <span class="font-16 font-12 text-600">{{ $t('title.eventDetails') }}</span>
            <button class="d-flex align-items-center justify-content-center" @click="eventDetails = false">
              <span class="font-24 material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="div-column gap-15 w-100 ds-gray-color">
            <div class="div-row gap-15 w-100">
              <div class="div-column gap-5 w-100">
                <span class="font-12 text-600">{{ $t('datatable.date') }}</span>
                <span class="font-12 px-3 py-2 input-style">{{ eventDetailsItem.time | formatDateTime }}</span>
              </div>
              <div class="div-column gap-5 w-100">
                <span class="font-12 text-600">{{ $t('title.eventName') }}</span>
                <span class="font-12 px-3 py-2 input-style">{{ eventDetailsItem.event }}</span>
              </div>
              <div class="div-column gap-5 w-100">
                <span class="font-12 text-600">{{ $t('title.location') }}</span>
                <span class="font-12 px-3 py-2 input-style">
                  {{ eventDetailsItem.city }}, {{ eventDetailsItem.region }}, {{ eventDetailsItem.country }}
                </span>
              </div>
            </div>
            <div class="div-row gap-15 w-100">
              <div class="div-column gap-5 w-100">
                <span class="font-12 text-600">{{ $t('title.userIp') }}</span>
                <span class="font-12 px-3 py-2 input-style">{{ eventDetailsItem.ip }}</span>
              </div>
              <div class="div-column gap-5 w-100">
                <span class="font-12 text-600">{{ $t('title.operationalSystem') }}</span>
                <span class="font-12 px-3 py-2 input-style">
                  {{ eventDetailsItem.os }} ({{ eventDetailsItem.osVersion }})
                </span>
              </div>
              <div class="div-column gap-5 w-100">
                <span class="font-12 text-600">{{ $t('title.device') }}</span>
                <span class="font-12 px-3 py-2 input-style">{{ eventDetailsItem.browser }}</span>
              </div>
            </div>
            <div class="div-column gap-5 w-100">
              <span class="font-12 text-600">{{ $t('datatable.url') }}</span>
              <span class="font-12 px-3 py-2 input-style">{{ eventDetailsItem.url }}</span>
            </div>
            <div class="div-column gap-5 w-100">
              <span class="font-12 text-600">{{ $t('title.userAgent') }}</span>
              <span class="font-12 px-3 py-2 input-style">{{ eventDetailsItem.userAgent }}</span>
            </div>
            <div class="div-column gap-5 w-100">
              <span class="font-12 text-600">{{ $t('datatable.parameters') }}</span>
              <div class="div-column gap-20 input-style px-5 py-5">
                <div v-for="(value, key) in eventDetailsItem.properties" :key="key" class="div-column">
                  <div class="outlined-input">
                    <label for="myInput">{{ key }}</label>
                    <input type="text" id="myInput" :value="value" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </v-dialog>
    </div>
  </div>
</template>

<script lang="ts">
import { mapState } from 'vuex';
import DataTable from '@/components/data-table/DataTable.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import CustomEventService from '../services/custom-event.service';
import { Pagination } from '@/models/pagination';
import { setItemsPerPage, getItemsPerPage } from '@/util/objects';

@Component({
  components: {
    DataTable,
    ButtonDefault,
    InputDefault,
    DataLoader,
  },
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class CustomEventsLogs extends Vue {
  private readonly customEventService = new CustomEventService();
  public currentAccountTimezone!: string;
  public userLanguage!: string;
  public customEvent: any = {};
  public customEventLogs: any = [];

  pagination = new Pagination();
  options: any = {
    page: 1,
    sortBy: ['title'],
    sortDesc: [false],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };

  headers = [
    { text: this.$t('datatable.date'), value: 'time', sortable: true, width: '10%' },
    { text: this.$t('datatable.url'), value: 'url', sortable: true, width: '40%' },
    { text: this.$t('datatable.properties'), value: 'properties', sortable: true, width: '30%' },
    { text: this.$t('datatable.location'), value: 'location', sortable: true, width: '15%' },
    { text: '', value: 'actions', sortable: false, width: '5%' },
  ];

  isLoading = false;
  eventDetails = false;
  eventDetailsItem: any;

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
    const storedItemsPerPage = getItemsPerPage('custom-events-logs');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    await this.getEventsLogs();
  }

  async getEventsLogs() {
    this.isLoading = true;
    const customEvent = await this.customEventService.getCustomEventById(Number(this.$route.params.custom_event_id));
    this.customEvent = customEvent.data;

    const response = await this.customEventService.getEventsLogs(Number(this.$route.params.custom_event_id));

    this.customEventLogs = response.data;
    this.pagination = {
      ...this.pagination,
      totalItems: this.customEventLogs.length,
      totalPages: Math.ceil(this.customEventLogs.length / this.pagination.itemsPerPage),
    };

    this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
    const calculateFinalRange = this.pagination.itemsPerPage + this.rangeStart - 1;
    this.rangeFinal =
      this.pagination.totalItems < calculateFinalRange ? this.pagination.totalItems : calculateFinalRange;
    this.isLoading = false;
  }

  handlePagination(selectedPage: number) {
    this.pagination = {
      ...this.pagination,
      page: selectedPage,
    };

    this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
    const calculateFinalRange = this.pagination.itemsPerPage + this.rangeStart - 1;
    this.rangeFinal =
      this.pagination.totalItems < calculateFinalRange ? this.pagination.totalItems : calculateFinalRange;
  }

  openEventDetails(item: any) {
    this.eventDetails = true;
    this.eventDetailsItem = item;
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    setItemsPerPage('custom-events-logs', items);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.card-style {
  padding: 20px;
  border-radius: 16px;
  background-color: $neutral-basic-white;
  width: 100%;
}

.input-style {
  border-radius: 8px;
  background-color: $ds-gray-100;
  border: none;
}

::v-deep .v-dialog {
  width: 800px !important;
  border-radius: 16px;
  box-shadow: none;
}

::v-deep.c-table {
  margin-top: 16px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);

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
}

.outlined-input {
  position: relative;
  width: 100%;
}

.outlined-input input {
  width: 100%;
  padding: 16px 12px 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 6px;
  outline: none;
}

.outlined-input label {
  position: absolute;
  top: -10px;
  left: 12px;
  background: #f5f5f5;
  padding: 0 6px;
  font-size: 13px;
  color: #666;
}

.property-item:not(:last-child) {
  border-right: 1px solid #ccc;
  padding-right: 10px;
  margin-right: 10px;
}
</style>
