<template>
  <div class="col-12">
    <div class="title-route">
      <h2 class="c-title">{{ $t('sidebar.transactional') }}</h2>
      <button
        v-if="$store.getters.can('automations:create')"
        class="v-btn-icon button-create"
        @click="addTransactionalMessage"
      >
        <v-icon class="v-icon-plus" dense> mdi-plus </v-icon>
        <span class="add-span">{{ $t('button.create').toString().toUpperCase() }}</span>
      </button>
    </div>
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="default-filters">
        <div class="default-filters__search-input">
          <InputDefault
            :modelValue="title"
            :placeholder="`${$t('input.search')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>
        </div>
      </div>
    </form>
    <div v-if="messages.length > 0" class="pt-5">
      <DataLoader :isLoading="isLoadingMessages" :type="'table-tbody, table-tbody'" class="pt-4" />
      <div :class="isLoadingMessages ? 'd-none' : ''">
        <div class="nopadding-top">
          <v-data-table
            hide-default-footer
            class="c-table"
            :headers="headers"
            :items="messages"
            :items-per-page="pagination.itemsPerPage"
            :calculate-widths="true"
            :no-data-text="`${$t('datatable.noMessage')}`"
            :loading="isLoadingMessages"
            :server-items-length="totalMessages"
            :options.sync="options"
          >
            <template v-slot:[`item.title`]="{ item }">
              <div class="td-item">
                <router-link
                  :to="{
                    path: `/messages/${item.type}/${item.id}`,
                  }"
                  :title="`${$t('button.edit')}`"
                  class="cursor-pointer font-12 text-600"
                >
                  {{ item.title }}
                </router-link>
              </div>
              <div class="td-item">
                <span class="subject-message-list font-12"> {{ item.description }} </span>
              </div>
            </template>
            <template v-slot:[`item.type`]="{ item }">
              <div
                class="d-flex justify-content-start icon-div pt-1"
                :data-tooltip="`${$t(`title.${mapIconType(item.type)}`)}`"
                data-tooltip-location="top"
              >
                <img
                  v-if="item.type === 'transactional-whatsapp'"
                  :src="getCustomIcon(item.type)"
                  class="icon-type d-flex"
                />
                <span v-else class="material-symbols-rounded ds-gray-color d-flex">{{ getCustomIcon(item.type) }}</span>
              </div>
            </template>

            <template v-slot:[`item.updatedAt`]="{ item }">
              <div class="td-item tabular-nums font-title">
                <span> {{ (item.updatedAt || item.updatedAt) | formatDateTime }} </span>
              </div>
            </template>

            <template v-slot:[`item.statistics`]="{ item }">
              <div class="td-item" v-if="item.type.includes('email') || item.type.includes('push')">
                <button class="button-statistics font-12 text-600" @click="viewStatistics(item.id, item.type)">
                  {{ $t('create.statistics') }}
                </button>
              </div>
            </template>

            <template v-slot:[`item.actions`]="{ item }">
              <div class="td-item text-end">
                <button
                  v-if="$store.getters.can('automations:create')"
                  @click="doCopy(item)"
                  :title="`${$t('button.duplicate')}`"
                  class="mx-2 cursor-pointer button-copy"
                  :data-tooltip="$t('button.duplicate')"
                  data-tooltip-location="top"
                >
                  <img class="icon-size" src="@/assets/content_copy.svg" />
                </button>
                <button
                  v-if="$store.getters.can('automations:delete')"
                  @click="confirmDelete(item)"
                  :title="`${$t('button.exclude')}`"
                  class="cursor-pointer button-trash"
                  :data-tooltip="$t('button.delete')"
                  data-tooltip-location="top"
                >
                  <img class="icon-size" src="@/assets/trash-full.svg" />
                </button>
              </div>
            </template>

            <template v-slot:no-data>
              <p :value="true" color="error" class="no-data" icon="warning">{{ $t('datatable.noData') }}</p>
            </template>
          </v-data-table>
        </div>
      </div>
    </div>
    <div v-if="messages.length === 0 && !isLoadingMessages" class="container-no-results">
      <img src="@/assets/transactional_fill.svg" class="mx-1" alt="automations" />
      <p class="font-16 font-title-style">{{ $t('datatable.noTransactional') }}</p>
      <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
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
        v-if="messages.length > 0"
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
import { Pagination } from '@/models/pagination';
import LoadingService from '@/services/loading.service';
import Multiselect from 'vue-multiselect';
import { Component, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { areObjectsEqual, getItemsPerPage, setItemsPerPage } from '../../../util/objects';
import MessagesService from '@/modules/messages/services/messages.service';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import ModalService from '@/services/modal.service';

@Component({
  components: { Multiselect, ButtonDefault, InputDefault, DataLoader },
  filters: {},
  computed: {},
})
export default class Transactional extends Vue {
  private readonly messagesService = new MessagesService();
  private readonly loadingService = new LoadingService();
  private readonly modalService = new ModalService();

  pagination = new Pagination();

  showAddNewAutomation = false;
  messages: Array<MessageDto> = new Array<MessageDto>();

  headers: any = [
    { text: this.$t('datatable.title'), value: 'title', sortable: true },
    { text: this.$t('datatable.type'), value: 'type', sortable: true, align: 'start', width: '5%' },
    { text: this.$t('datatable.lastEdition'), value: 'updatedAt', sortable: true, width: '19%' },
    { text: '', value: 'statistics', sortable: false, width: '10%' },
    { text: '', value: 'actions', sortable: false, width: '5%' },
  ];
  idMessage!: number;

  selectedStatusFilter = {};
  selectedOrderFilter = {};
  options: any = {
    page: 1,
    sortBy: ['name'],
    sortDesc: [],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  title = '';
  itemsNumber = 10;
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  rangeStart = 0;
  rangeFinal = 0;
  totalMessages = 0;
  isLoadingMessages = false;
  iconTypes = [
    { name: 'email', type: 'transactional-email' },
    { name: 'push', type: 'transactional-web-push' },
    { name: 'mobile-push', type: 'transactional-mobile-push' },
    { name: 'sms', type: 'transactional-sms' },
    { name: 'whatsapp', type: 'transactional-whatsapp' },
  ];

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('transactional');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getValuesUrl();
    await this.getMessages();
  }

  async getMessages() {
    if (this.isLoadingMessages) {
      return;
    }

    this.isLoadingMessages = true;
    this.loadingService.show();

    try {
      const result = await this.messagesService.getMessages({
        title: this.title,
        type: this.iconTypes.map((item: any) => item.type),
        ...this.$route.query,
        ...this.pagination,
      });
      this.messages = result?.data?.results;
      this.totalMessages = result?.data?.totalItems;
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;

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
      this.isLoadingMessages = false;
      this.loadingService.hide();
    }
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    setItemsPerPage('transactional', items);
    this.getMessages();
  }

  addTransactionalMessage() {
    this.$router.push('/messages/email/new?type=transactional');
  }

  newMessage() {
    this.$router.push('/messages/email?type=automation');
  }

  handleMessages() {
    this.$router.push('/messages/email?type=automation');
  }

  async filterByTitle() {
    this.isLoadingMessages = false;
    this.pagination = { ...this.pagination, page: 1 };
    this.setValuesUrl();
    await this.getMessages();
  }

  updateInput(event: string) {
    this.title = event;
  }

  handlePagination() {
    this.setValuesUrl();
  }

  setValuesUrl() {
    if (
      this.pagination.page === 1 &&
      this.title === '' &&
      this.$route.query.title === undefined &&
      ((this.$route.query.order === undefined && this.pagination.order === 'DESC') ||
        this.pagination.order === this.$route.query.order) &&
      ((this.$route.query.sortBy === undefined && this.pagination.sortBy === 'updatedAt') ||
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
      this.title = this.$route.query.title?.toString();
      this.pagination.sortBy = this.$route.query.sortBy?.toString() || '';
      this.pagination.order = this.$route.query.order?.toString() || 'DESC';
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
    this.title = '';
  }

  async deleteMessage() {
    await this.messagesService.deleteMessage(this.idMessage);
    await this.getMessages();
  }

  confirmDelete(message: MessageDto) {
    this.idMessage = message.id as number;
    this.modalService.confirm({
      title: this.$t('modal.deleteMessage') as string,
      text: `${this.$t('modal.confirmMessage', { message: message.title })}`,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.deleteMessage,
    });
  }

  async doCopy(message: MessageDto) {
    if (message.id) {
      this.loadingService.show();
      const response = await this.messagesService.createMessageCopy(message.id);
      this.loadingService.hide();

      if (response && response.data && response.data.id) {
        this.$router.push(`/messages/${response.data.type}/${response.data.id}`);
      }
    }
  }

  getCustomIcon(value: string) {
    if (value === 'transactional-email') {
      return 'mail';
    }
    if (value === 'transactional-web-push') {
      return 'computer';
    }
    if (value === 'transactional-mobile-push') {
      return 'smartphone';
    }
    if (value === 'transactional-sms') {
      return 'sms';
    }
    if (value === 'transactional-whatsapp') {
      return require('@/assets/whatsapp.svg');
    }
  }

  mapIconType(value: any) {
    const matchedIcon = this.iconTypes.find((icon) => icon.type === value);
    return matchedIcon?.name;
  }

  viewStatistics(id: number, type: string) {
    this.$router.push(`/messages/${type}/statistics?messages=${id}`);
  }

  @Watch('options')
  async onChangeOptions() {
    if (this.isLoadingMessages) {
      return;
    }

    const { sortBy, sortDesc, page, itemsPerPage, totalPages } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      itemsPerPage,
      totalPages,
      sortBy: sortBy[0] || 'updatedAt',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
    };
    this.setValuesUrl();
    await this.getMessages();
  }

  @Watch('$route')
  async reloadMessages() {
    this.getMessages();
    this.getValuesUrl();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/automations.scss';
@import '@/assets/styles/bs-layout.scss';

.automation {
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
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
.pagination {
  place-content: center;
}

.icon-div {
  max-width: 20px;
}

::v-deep.c-table {
  margin-top: 16px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
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
    align-content: center;
  }

  .td-item {
    display: flex;
    align-items: center;
    height: 100%;
  }

  .automation {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  th.text-start {
    white-space: nowrap;
  }

  td.text-start {
    vertical-align: top;
  }

  .sucess--text {
    color: $ds-blue;
  }
}

.type-tooltip {
  text-transform: capitalize;
}

.button-statistics {
  background-color: $neutral-basic-white;
  color: $ds-blue;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid $ds-blue;
  text-transform: uppercase;
}
</style>
