<template>
  <div class="col-12 div-column gap-20">
    <div class="title-route mb-0">
      <h2 class="c-title">
        {{ $t('title.messages2FA') }}
      </h2>
      <button class="v-btn-icon button-create cursor-pointer" @click="add2FAMessage">
        <v-icon class="v-icon-plus" dense> mdi-plus </v-icon>
        <span class="add-span">{{ $t('button.create').toString().toUpperCase() }}</span>
      </button>
    </div>
    <div class="div-row gap-10 nav-bar-pages mb-0">
      <router-link
        v-for="message in messagesPages"
        :key="message.title"
        :to="message.router"
        :class="[message.router === $route.path ? 'active-class' : 'inactive-class', 'messages-pages text-600 font-14']"
      >
        {{ message.title }}
      </router-link>
    </div>
    <div class="div-column gap-20">
      <DataLoader :isLoading="isLoadingGroups" :type="'table-tbody'" class="w-100" />
      <TwoFATable
        :class="isLoadingGroups ? 'd-none' : ''"
        :generalType="generalType"
        :configsTable="configsTable"
        :pagination="pagination"
        :options="options"
        :rangeStart="rangeStart"
        :rangeFinal="rangeFinal"
        :totalData="pagination.totalItems"
        :noData="noData"
        @getDataRequest="load2FASettings"
        @getGroupSettings="loadGroupConfigs"
        @handlePagination="handlePagination"
        @setItemsNumber="setItemsNumber"
        @onChangeOptions="handleOptionsChange"
        @deleteGroup="shouldDeleteGroup"
      />
    </div>
  </div>
</template>
<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';
import MessagesService from '../services/messages.service';
import TwoFaCards from '../components/2FACards.vue';
import { MessageDto } from '../dtos/message.dto';
import AccountService from '@/modules/settings/services/account.service';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import ToastService from '@/services/toast.service';
import { getAccountConfig } from '@/store';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import TwoFAStatistics from '../components/2FAStatistics.vue';
import DashboardService from '@/modules/dashboard/services/dashboard.service';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import ModalService from '@/services/modal.service';
import AccountsService from '@/modules/accounts/services/account.service';
import InputDefault from '@/components/input/InputDefault.vue';
import TwoFATable from '../components/2FATable.vue';
import { Pagination } from '@/models/pagination';
import DataLoader from '@/components/data-loader/DataLoader.vue';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  filters: {},
  computed: {
    ...mapState(['accountChannels', 'currentAccount', 'currentAccountTimezone']),
  },
  components: {
    TwoFaCards,
    ButtonDefault,
    TwoFAStatistics,
    InputDefault,
    TwoFATable,
    DataLoader,
  },
})
export default class TwoFAMessages extends Vue {
  private readonly messagesService = new MessagesService();
  private readonly accountService = new AccountService();
  private readonly accountsService = new AccountsService();
  private readonly toastService = new ToastService();
  private readonly dashboardService = new DashboardService();
  private readonly modalService = new ModalService();

  public accountChannels!: any;
  public messageConfigs: Record<string, Record<string, any[]>> = {};
  public originalMessageConfigs: Record<string, Record<string, any[]>> = {};
  closeTimeout: any = null;
  unregisterGuard: any = null;
  groupName = '';
  newGroupName = '';
  currentAccount!: AccountDto;
  currentAccountTimezone!: string;
  messagesPages: any = [];
  messages: MessageDto[] = [];
  accountConfig: any = {};
  generalMessageStatistics: any = null;
  isLoadingGroups = false;
  startDate = new Date();
  endDate = new Date();
  showActions = false;
  pagination = new Pagination();
  options: any = {
    page: 1,
    sortBy: ['groupName'],
    sortDesc: [false],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  rangeStart = 0;
  rangeFinal = 0;
  dateListOptions = [
    {
      label: this.$t('input.today'),
      value: '0',
    },
    {
      label: this.$t('input.yesterday'),
      value: 'yesterday',
    },
    {
      label: this.$t('input.last7Days'),
      value: '7',
    },
    {
      label: this.$t('input.last30Days'),
      value: '30',
    },
  ];
  configsTable: any[] = [];
  groupsConfigs: string[] = [];
  isEditingGroupName = false;
  isInitialLoad = true;
  lastOptionsState: any = null;
  noData = false;

  get generalType() {
    const path = this.$route.path.replace('/messages/2FA/', '').replace('/', '');
    return path.replace('/new', '');
  }

  async beforeMount() {
    this.isLoadingGroups = true;
    this.messagesPages = [
      ...(this.accountChannels.hasEmail ? [{ title: this.$t('title.email'), router: '/messages/2FA/email' }] : []),
      ...(this.accountChannels.hasSms ? [{ title: this.$t('title.sms'), router: '/messages/2FA/sms' }] : []),
      ...(this.accountChannels.hasWhatsapp
        ? [{ title: this.$t('title.whatsapp'), router: '/messages/2FA/whatsapp' }]
        : []),
    ];
    await this.load2FASettings();
    await this.getGroupsValues();
    this.lastOptionsState = { ...this.options };
    this.isInitialLoad = false;
  }

  async load2FASettings() {
    try {
      const accountResponse = await this.accountsService.getAccount(this.currentAccount.id || 0);
      if (accountResponse.data) {
        this.$store.commit('setCurrentAccount', accountResponse.data);
      }
    } catch (err) {
      console.error('Error refreshing account data:', err);
    }

    this.accountConfig = JSON.parse(getAccountConfig(this.currentAccount, '2fa_settings') || '{}') || {};
  }

  loadGroupConfigs(groupName: string) {
    this.$router.push(`/messages/2FA/${this.generalType}/${groupName}`);
  }

  async getGroupsValues() {
    try {
      const allGroupsConfigs = Object.keys(this.accountConfig[this.generalType] || {});

      this.pagination.totalItems = allGroupsConfigs.length;
      this.pagination.totalPages = Math.ceil(this.pagination.totalItems / this.pagination.itemsPerPage);

      this.rangeStart =
        this.pagination.totalItems > 0 ? (this.pagination.page - 1) * this.pagination.itemsPerPage + 1 : 0;
      this.rangeFinal = Math.min(this.pagination.page * this.pagination.itemsPerPage, this.pagination.totalItems);

      const startIndex = (this.pagination.page - 1) * this.pagination.itemsPerPage;
      const endIndex = startIndex + this.pagination.itemsPerPage;
      this.groupsConfigs = allGroupsConfigs.slice(startIndex, endIndex);

      if (this.groupsConfigs.length > 0) {
        try {
          const response = await this.dashboardService.get2FAStatistics(
            this.startDate,
            this.endDate,
            this.generalType,
            this.groupsConfigs
          );

          if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const methodFilter = this.generalType.toUpperCase();
            const filteredData = response.data.filter((item: any) => item.method === methodFilter);

            const groupStats: Record<string, any> = {};
            filteredData.forEach((item: any) => {
              const group = item.group;
              if (!groupStats[group]) {
                groupStats[group] = {
                  groupName: group,
                  count_total: 0,
                  count_success: 0,
                  count_error: 0,
                  count_verify_validated: 0,
                  count_verify_rejected: 0,
                };
              }
              groupStats[group].count_total += item.count_total || 0;
              groupStats[group].count_success += item.count_success || 0;
              groupStats[group].count_error += item.count_error || 0;
              groupStats[group].count_verify_validated += item.count_verify_validated || 0;
              groupStats[group].count_verify_rejected += item.count_verify_rejected || 0;
            });

            this.configsTable = Object.values(groupStats);

            this.generalMessageStatistics = Object.values(groupStats).reduce(
              (total: any, current: any) => ({
                count_total: total.count_total + (current.count_total || 0),
                count_success: total.count_success + (current.count_success || 0),
                count_error: total.count_error + (current.count_error || 0),
                count_verify_validated: total.count_verify_validated + (current.count_verify_validated || 0),
                count_verify_rejected: total.count_verify_rejected + (current.count_verify_rejected || 0),
              }),
              {
                count_total: 0,
                count_success: 0,
                count_error: 0,
                count_verify_validated: 0,
                count_verify_rejected: 0,
              }
            );
          } else {
            this.configsTable = this.groupsConfigs.map((groupName) => ({
              groupName,
              count_total: 0,
              count_success: 0,
              count_error: 0,
              count_verify_validated: 0,
              count_verify_rejected: 0,
            }));
            this.generalMessageStatistics = null;
          }
        } catch (apiError) {
          console.error('Error fetching 2FA statistics from API:', apiError);

          this.configsTable = this.groupsConfigs.map((groupName) => ({
            groupName,
            count_total: 0,
            count_success: 0,
            count_error: 0,
            count_verify_validated: 0,
            count_verify_rejected: 0,
          }));
          this.generalMessageStatistics = null;
        }
      } else {
        this.configsTable = [];
        this.generalMessageStatistics = null;
        this.noData = true;
      }
    } catch (err) {
      console.error('Error fetching general statistics:', err);
      this.configsTable = [];
      this.generalMessageStatistics = null;
      this.rangeStart = 0;
      this.rangeFinal = 0;
    } finally {
      this.isLoadingGroups = false;
    }
  }

  shouldDeleteGroup(groupName: string) {
    this.modalService.confirm({
      title: this.$t('button.delete') as string,
      text: this.$t('description.areYouSureDeleteGroup') as string,
      confirmLabel: this.$t('button.delete') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: () => this.deleteGroup(groupName),
      isConfirm: true,
    });
  }

  async deleteGroup(groupName: string) {
    this.isLoadingGroups = true;
    const updatedTypeConfigs = { ...this.accountConfig[this.generalType] };
    delete updatedTypeConfigs[groupName];

    const updatedValue = {
      ...this.accountConfig,
      [this.generalType]: updatedTypeConfigs,
    };

    await this.accountService.updateAccount(this.currentAccount?.id || 0, [
      {
        account_id: this.currentAccount?.id || 0,
        name: '2fa_settings',
        value: updatedValue,
      },
    ]);

    this.toastService.show({
      type: 'success',
      text: this.$t('toast.configSaved') as string,
      leftBorder: false,
    });

    await this.load2FASettings();
    await this.getGroupsValues();
    this.lastOptionsState = { ...this.options };
    this.isInitialLoad = false;
  }

  add2FAMessage() {
    this.$router.push(`/messages/2FA/${this.generalType}/new-group`);
  }

  handlePagination() {
    this.getGroupsValues();
  }

  setItemsNumber(itemsPerPage: number) {
    this.pagination.itemsPerPage = itemsPerPage;
    this.pagination.page = 1;
    this.getGroupsValues();
  }

  handleOptionsChange(newOptions: any) {
    this.options = { ...newOptions };
  }

  @Watch('$route.path')
  async routeChanged() {
    this.isInitialLoad = true;
    this.isLoadingGroups = true;
    await this.$store.commit('updateCurrentAccount');
    await this.load2FASettings();
    await this.getGroupsValues();
    this.lastOptionsState = { ...this.options };
    this.isInitialLoad = false;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.nav-bar-pages {
  background-color: #ffffff;
  width: 100%;
  border-radius: 16px;
  padding: 16px;
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

.add-card-button {
  background-color: #0fb75c;
  border-radius: 50%;
  padding: 7px;
  color: #ffffff;
  width: fit-content;
  place-self: flex-start;
  z-index: 10;
  transition: all 0.3s ease-in-out;
  transform: rotate(0deg);

  &:hover {
    transform: rotate(90deg);
  }

  span {
    display: flex;
  }
}

.disabled-button {
  background-color: #a6a6a6 !important;
  color: #ffffff;
  cursor: not-allowed;
}

.button-save-position {
  display: flex;
  position: fixed;
  bottom: 65px;
  right: 40px;
}

.text-error {
  color: #dc3545;
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

.select-menu {
  background-color: #ffffff;
  border-radius: 8px;
}

.select-button {
  width: 120px;
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

.select-card {
  border-radius: 0px 0px 8px 8px !important;
}

.option {
  border-top: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 8px;
  background-color: #ffffff;
  font-size: 10px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  margin: 0px !important;
  cursor: pointer;
  color: $ds-gray;

  &:hover {
    background: $ds-gray-100;
  }

  &:last-child {
    border-radius: 0px 0px 8px 8px !important;
  }
}

.select-options {
  border-bottom: 1px solid $ds-gray-100;
}

.select-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.select-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.message-width {
  width: 630px;
}

.card-placement {
  place-self: flex-start;
}

.message-card {
  z-index: 10;
}

.add-button-container {
  position: relative;
  display: flex;
  flex-direction: row;
  align-self: center;
}

.actions-container {
  position: absolute;
  top: 1px;
  left: 50px;
  transform: translateY(-15%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: all 0.3s ease-out;

  &.show {
    transform: translateY(0);
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    cursor: pointer !important;
  }

  button {
    background-color: $neutral-basic-white;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
    width: max-content;
  }
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}
</style>
