<template>
  <div class="col-12">
    <div class="title-route">
      <h2 class="c-title">
        {{ $t('sidebar.messages') }}
      </h2>
      <router-link
        v-if="$store.getters.can('messages:create')"
        class="v-btn-icon button-create"
        :to="{
          path: `${generalType}/new`,
        }"
      >
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="add-span">{{ $t('button.create').toString().toUpperCase() }}</span>
      </router-link>
    </div>
    <div class="div-row gap-10 nav-bar-pages">
      <router-link
        v-for="message in messagesPages"
        :key="message.title"
        :to="message.router"
        :class="[message.router === $route.path ? 'active-class' : 'inactive-class', 'messages-pages text-600 font-14']"
      >
        {{ message.title }}
      </router-link>
    </div>
    <form class="default-filters-messages" @submit.prevent="filterMessageTitle">
      <div class="div-row gap-10 align-items-center message-filters-options">
        <div>
          <InputDefault
            :modelValue="title"
            :placeholder="`${$t('input.search')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterMessageTitle"
            @updateInput="updateInput"
          ></InputDefault>
        </div>
        <select
          data-cy="automation-message-ippool"
          class="pl-1 form-control mo-select"
          v-model="ipPool"
          v-on:change="filterByIpPool($event)"
          v-if="generalType === 'email'"
        >
          <option value="">{{ $t('input.selectSender') }}</option>
          <option v-for="pool in ipPools" v-bind:value="pool.poolName" :key="`poolname-${pool.id}`">
            {{ pool.senderEmail }}
          </option>
        </select>
        <select
          data-cy="automation-message-ippool"
          class="pl-1 form-control mo-select input-text-large"
          v-model="selectedAutomation"
          v-on:change="filterByAutomation($event)"
          v-if="generalType === 'email'"
        >
          <option value="">{{ $t('input.selectAutomations') }}</option>
          <option
            v-for="automation in automationsList"
            v-bind:value="automation.id"
            :key="'filter-automation-' + automation.id"
          >
            {{ automation.title }}
          </option>
        </select>
      </div>
    </form>
    <DataLoader :isLoading="isLoadingMessages" :type="'table-tbody, table-tbody'" class="pt-4" />
    <div :class="isLoadingMessages ? 'd-none' : ''">
      <div class="nopadding-top">
        <v-data-table
          v-if="messages.length > 0"
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
                  path: `/messages/${generalType}/${item.id}`,
                }"
                :title="`${$t('button.edit')}`"
                class="cursor-pointer font-12 font-weight-title"
              >
                {{ item.title }}
              </router-link>
            </div>
            <div class="td-item">
              <span class="subject-message-list font-12"> {{ item.description }} </span>
            </div>
          </template>
          <!-- <template v-slot:[`item.automations`]="{ item }">
            <div class="automation" v-for="(automation, index) in item.automations" :key="`automation-${index}`">
              {{ automation.title }}
            </div>
            <span v-if="item.automations.length === 0"> {{ $t('title.none') }} </span>
          </template> -->
          <template v-slot:[`item.fromName`]="{ item }">
            <div class="td-item font-12">{{ item.fromName }}</div>
            <div class="td-item">
              <span class="subject-message-list font-12">{{ item.fromMail }}</span>
            </div>
          </template>
          <template v-slot:[`item.status`]="{ item }">
            <span class="status-chip font-12" :class="[`status-${statusIcon(item.status)}`]">
              {{ $t(`datatable.wpp${[item.status || 'rejected']}`) }}
            </span>
          </template>
          <template v-slot:[`item.testStats`]="{ item }">
            <div class="test-glockapp" v-if="item.testStats">
              <div class="td-item">GlockApp</div>
              <div class="mt-1 td-item">
                <button @click="goToTest(item)" class="cursor-pointer test-stats test-stats--inbox" title="Inbox">
                  {{ item.testStats.inbox | percent(0, 1) }}
                </button>
                <button @click="goToTest(item)" class="mx-2 cursor-pointer test-stats test-stats--spam" title="Spam">
                  {{ item.testStats.spam | percent(0, 1) }}
                </button>
                <button @click="goToTest(item)" class="cursor-pointer test-stats test-stats--other" title="Outros">
                  {{ item.testStats.other | percent(0, 1) }}
                </button>
              </div>
            </div>
            <div class="td-item" v-if="!item.testStats">
              <button class="cursor-pointer" @click="goToTest(item)">Pendente</button>
            </div>
          </template>
          <template v-slot:[`item.updatedAt`]="{ item }">
            <div class="td-item tabular-nums font-12">
              <span> {{ (item.updatedAt || item.updatedAt) | formatDateTime }} </span>
            </div>
          </template>
          <template v-slot:[`item.whatsappType`]="{ item }">
            <div class="td-item font-title">
              <span> {{ item.whatsappType === 'text' ? $t('title.text') : 'Call to Action' }} </span>
            </div>
          </template>

          <template v-slot:[`item.actions`]="{ item }">
            <div class="td-item text-end">
              <button
                v-if="$store.getters.can('messages:create')"
                @click="doCopy(item)"
                :title="`${$t('button.duplicate')}`"
                class="mx-2 cursor-pointer button-copy"
                v-tooltip.top="$t('button.duplicate')"
              >
                <span class="material-symbols-rounded ds-light-gray-color font-20">content_copy</span>
              </button>
              <button
                v-if="$store.getters.can('messages:delete')"
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
        <div v-else class="container-no-results">
          <img src="@/assets/messages_fill.svg" class="mx-1" alt="automations" />
          <p class="font-16 font-title-style">{{ $t('datatable.noMessageData') }}</p>
          <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
        </div>
      </div>
    </div>
    <div v-if="messages.length > 0" class="text-center pagination pt-5 align-items-center justify-space-between">
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
        @input="handlePagination"
        :total-visible="10"
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
import { StatusDeliverabilityTest } from '@/components/glockapps/enums/status-test.enum';
import { Pagination } from '@/models/pagination';
import LoadingService from '@/services/loading.service';
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { MessageDto } from '../dtos/message.dto';
import MessagesService from '../services/messages.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import store from '@/store';
import { areObjectsEqual, getItemsPerPage, setItemsPerPage } from '../../../util/objects';
import { MessageStatus } from '../enums/message.enum';
import { mapState } from 'vuex';

@Component({
  components: { ButtonDefault, InputDefault, DataLoader },
  filters: {},
  computed: {
    ...mapState(['accountChannels']),
  },
})
export default class Messages extends Vue {
  private readonly messagesService = new MessagesService();
  private readonly loadingService = new LoadingService();
  private readonly modalService = new ModalService();
  public accountChannels!: any;

  statusTest = StatusDeliverabilityTest;

  pagination = new Pagination();
  title = '';
  ipPool = '';
  automationsList = [];
  selectedAutomation = '';
  messages: Array<MessageDto> = new Array<MessageDto>();
  headers: any = [];
  idMessage: any;
  isLoadingMessages = false;
  totalMessages = 0;
  options: any = {
    page: 1,
    sortBy: ['updatedAt'],
    sortDesc: [true],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  type = 'email';
  generalType = '';
  ipPools: any = [];
  messagesPages: any = [];
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
    this.messagesPages = [
      ...(this.accountChannels.hasEmail ? [{ title: this.$t('title.email'), router: '/messages/email' }] : []),
      ...(this.accountChannels.hasWebPush ? [{ title: this.$t('title.web-push'), router: '/messages/web-push' }] : []),
      ...(this.accountChannels.hasMobilePush
        ? [{ title: this.$t('title.mobile-push'), router: '/messages/mobile-push' }]
        : []),
      ...(this.accountChannels.hasSms ? [{ title: this.$t('title.sms'), router: '/messages/sms' }] : []),
      ...(this.accountChannels.hasWhatsapp ? [{ title: this.$t('title.whatsapp'), router: '/messages/whatsapp' }] : []),
    ];
    this.generalType = this.$route.path.replace('/messages/', '').replace('/', '');
    const storedItemsPerPage = getItemsPerPage('messages');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getValuesUrl();
    await this.getAutomationsMessages();
    await this.getAutomationsList();
    await this.getPools();
  }

  @Watch('generalType')
  initTable() {
    if (['web-push', 'sms', 'mobile-push'].includes(this.generalType)) {
      this.headers = [
        { text: this.$t('datatable.title'), value: 'title', sortable: true },
        { text: this.$t('datatable.lastEdition'), value: 'updatedAt', sortable: true, width: '15%' },
        { text: '', value: 'actions', sortable: false, width: '5%' },
      ];

      return;
    }

    if (this.generalType === 'whatsapp') {
      this.headers = [
        { text: this.$t('datatable.name'), value: 'title', sortable: true, width: '30%' },
        { text: this.$t('datatable.whatsappApproval'), value: 'status', sortable: true, width: '30%' },
        { text: this.$t('datatable.contentType'), value: 'whatsappType', sortable: true, width: '20%' },
        { text: this.$t('datatable.lastEdition'), value: 'updatedAt', sortable: true, width: '15%' },
        { text: '', value: 'actions', sortable: false, width: '5%' },
      ];

      return;
    }

    this.headers = [
      { text: this.$t('datatable.title'), value: 'title', sortable: true, align: 'start' },
      // { text: this.$t('datatable.associatedAutomations'), value: 'automations', sortable: false },
      { text: this.$t('datatable.sender'), value: 'fromName', sortable: true },
      { text: this.$t('datatable.subject'), value: 'subject', sortable: true, cellClass: 'font-title' },
      ...(store.state.hasGlockApp
        ? [{ text: this.$t('datatable.glockappsTest'), value: 'testStats', sortable: false }]
        : []),
      { text: this.$t('datatable.lastEdition'), value: 'updatedAt', sortable: true, width: '15%' },
      { text: '', value: 'actions', sortable: false, width: '5%' },
    ];
  }

  statusIcon(status: MessageStatus): string {
    switch (status) {
      case MessageStatus.DRAFT:
        return 'draft';
      case MessageStatus.SEND_APPROVAL:
        return 'scheduled';
      case MessageStatus.SENT_APPROVAL:
        return 'scheduled';
      case MessageStatus.APPROVED:
        return 'completed';
      case MessageStatus.REJECTED:
        return 'canceled';
      default:
        return 'canceled';
    }
  }

  async getPools() {
    this.ipPools = (await this.messagesService.getPools())?.data;
  }

  async getAutomationsMessages() {
    if (this.isLoadingMessages) {
      return;
    }

    this.isLoadingMessages = true;
    this.loadingService.show();

    try {
      const result = await this.messagesService.getMessages({
        title: this.title,
        ipPool: this.ipPool,
        type: this.generalType === 'email' ? this.type : this.generalType,
        selectedAutomation: Number(this.selectedAutomation),
        withTests: this.generalType === 'email' && store.state.hasGlockApp,
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

  async getAutomationsList() {
    try {
      const result = await this.messagesService.getAutomationList();
      this.automationsList = result?.data;
    } catch (err) {
      console.error(err);
    }
  }

  async filterByIpPool(event: any) {
    this.ipPool = event.target.value;
    this.pagination = { ...this.pagination, page: 1 };
    this.setValuesUrl();
    await this.getAutomationsMessages();
  }

  async filterByAutomation(event: any) {
    this.selectedAutomation = event.target.value;
    this.pagination = { ...this.pagination, page: 1 };
    this.setValuesUrl();
    await this.getAutomationsMessages();
  }

  async filterMessageTitle() {
    this.pagination = { ...this.pagination, page: 1 };
    this.setValuesUrl();
    await this.getAutomationsMessages();
  }

  updateInput(event: string) {
    this.title = event;
  }

  async filterByType() {
    this.ipPool = '';
    this.selectedAutomation = '';
    this.pagination = { ...this.pagination, page: 1 };
    this.setValuesUrl();
    await this.getAutomationsMessages();
  }

  handlePagination() {
    this.setValuesUrl();
  }

  async deleteMessage() {
    await this.messagesService.deleteMessage(this.idMessage);
    await this.getAutomationsMessages();
  }

  confirmDelete(message: MessageDto) {
    this.idMessage = message.id;
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
        this.$router.push(`/messages/${this.generalType || 'email'}/${response.data.id}`);
      }
    }
  }

  goToTest(message: MessageDto) {
    if (message.isTested) {
      this.$router.push(`/messages/email/${message.id}/deliverability-test-result/`);
    } else {
      this.$router.push(`/messages/email/${message.id}/deliverability-test`);
    }
  }

  setValuesUrl() {
    if (
      this.pagination.page === 1 &&
      this.ipPool === '' &&
      this.title === '' &&
      this.$route.query.title === undefined &&
      this.selectedAutomation === '' &&
      ((this.$route.query.order === undefined && this.pagination.order === 'DESC') ||
        this.pagination.order === this.$route.query.order) &&
      ((this.$route.query.sortBy === undefined && this.pagination.sortBy === 'updatedAt') ||
        this.pagination.sortBy === this.$route.query.sortBy) &&
      (this.$route.query.page === undefined || this.pagination.page === Number(this.$route.query.page)) &&
      (this.type === this.$route.query.type ||
        ['email', 'web-push', 'mobile-push', 'sms', 'whatsapp'].includes(this.generalType))
    ) {
      return;
    }

    const query = {
      page: this.pagination.page,
      itemsPerPage: this.pagination.itemsPerPage,
      sortBy: this.pagination.sortBy,
      order: this.pagination.order,
      title: this.title,
      ipPool: this.ipPool,
      type: this.generalType,
      selectedAutomation: this.selectedAutomation,
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
      this.title = this.$route.query.title.toString();
      this.ipPool = this.$route.query.ipPool.toString();
      this.selectedAutomation = this.$route.query.selectedAutomation.toString();
      this.type = this.$route.query.type?.toString();
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
    this.ipPool = '';
    this.selectedAutomation = '';
    this.type = this.$route.query.type?.toString() || 'email';
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    setItemsPerPage('messages', items);
    this.getAutomationsMessages();
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

    await this.getAutomationsMessages();
  }

  @Watch('$route')
  async reloadMessages() {
    if (
      (this.$route.query.type && this.generalType !== this.$route.query.type) ||
      this.type !== this.$route.query.type
    ) {
      this.generalType = this.$route.path.replace('/messages/', '').replace('/', '');
      this.getValuesUrl();
      await this.getAutomationsMessages();
      return;
    }
    this.getValuesUrl();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.default-filters-messages {
  container-type: inline-size;
  container-name: message-filters-options;
}
.input-text-large {
  min-width: 200px;
  max-width: 300px;
  padding-right: 3rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.message-filters-options {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, 1fr);
}

@container message-filters-options (width < 900px) {
  .message-filters-options {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

.pagination {
  place-content: center;
}
.toggle-message-type {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
::v-deep .v-input__slot {
  height: 36px !important;
}

::v-deep .v-text-field__slot {
  height: 36px !important;
}

::v-deep .v-text-field__details {
  min-height: 0px !important;
  height: 0px;
  margin: 0px !important;
  padding: 0px !important;
}

::v-deep .v-messages {
  min-height: 0px !important;
}

.append-img {
  width: 12px;
}

::v-deep .v-input__control {
  height: 36px !important;
}

::v-deep.c-table {
  margin-top: 16px;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
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

.list-inline {
  margin-bottom: 0px;
  padding-left: 0px !important;
}
.messages-options_actions {
  box-sizing: initial;
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
.test-stats--spam {
  background: $neutral-error-red;
}
.test-stats--other {
  background: $neutral-gray-500;
}

.subject-message-list {
  font-size: 0.8rem;
  color: #a0a0a0;
}
.btn-default::before {
  opacity: 0 !important;
}
v-btn-toggle:disabled {
  color: #a6a6a6 !important;
}
.status-draft {
  color: #5c5c5c;
  background: #f5f5f5;
}
.status-scheduled {
  color: #3e87f8;
  background-color: #f4f8ff;
}
.status-completed {
  color: #0fb75c;
  background-color: #f2fff8;
}
.status-canceled {
  color: #f03232;
  background-color: #fff0f0;
}

::v-deep.status-chip {
  max-width: 200px;
}

.nav-bar-pages {
  background-color: #ffffff;
  width: 100%;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 24px;
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
}

.messages-pages {
  text-decoration: none;
  letter-spacing: 0.7px;
  display: flex;
  padding: 6px 12px;
  border-radius: 12px;
}

.inactive-class {
  color: #a6a6a6;
  background-color: #ffffff;
}

.active-class {
  color: $ds-blue;
  background-color: #f4f8ff;
}

.icon-size {
  width: 20px;
  height: 20px;
}

.font-weight-title {
  font-weight: 600;
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
