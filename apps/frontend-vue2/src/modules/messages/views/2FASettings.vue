<template>
  <div class="div-column gap-20 w-100 cards-container">
    <div class="div-column gap-5 align-items-start">
      <div class="div-row align-items-center">
        <span class="material-symbols-rounded font-16 ds-blue-color cursor-pointer">chevron_left</span>
        <router-link :to="`/messages/2FA/${generalType}`" class="text-600 font-14 cursor-pointer">
          {{ $t('title.messages2FA') }}
        </router-link>
      </div>
      <DataLoader :isLoading="isLoadingData || isLoadingStatistics" :type="'heading'" :noShadow="true" width="350px" />
      <DataLoader
        v-if="!$route.path.includes('new-group')"
        :isLoading="isLoadingData || isLoadingStatistics"
        :type="'text, button'"
        :noShadow="true"
        width="180px"
        :newStyle="`display: flex; flex-direction: row; gap: 15px; align-items: center; margin-top: 20px;`"
      />
      <div class="div-column gap-5">
        <div :class="isLoadingData || isLoadingStatistics ? 'd-none' : ''" class="div-row align-items-center gap-5">
          <span v-if="$route.path.includes('new-group')" class="font-20 text-600 ds-gray-color mb-0 text-nowrap">
            {{ $t('title.group') }}:
          </span>

          <div class="div-row align-items-center gap-5">
            <InputDefault
              v-if="isEditingGroupName || $route.path.includes('new-group')"
              autofocus
              :modelValue="newGroupName"
              :placeholder="`${$t('input.typeGroup')}`"
              :keyInput="'group'"
              @updateInput="updateGroupName"
            />
            <label v-else class="font-16 text-600 ds-gray-color mb-0 text-nowrap">
              {{ groupName }}
            </label>
            <button
              v-if="!isNewGroup && !$route.path.includes('new-group')"
              class="ds-gray-color delete-button"
              @click="changeGroup"
            >
              <span class="material-symbols-rounded font-18 text-600">
                {{ isEditingGroupName ? 'close' : 'edit' }}
              </span>
            </button>
          </div>
        </div>
        <div v-if="hasInvalidGroupName" class="div-row w-100">
          <span class="font-12 text-error">{{ $t('warning.groupNameContainsSpecialCharacters') }}</span>
        </div>
      </div>
    </div>
    <div v-if="!isNewGroup" class="div-row align-items-center justify-content-between">
      <div :class="isLoadingData || isLoadingStatistics ? 'd-none' : ''" class="div-row align-items-center gap-10">
        <span class="font-10 ds-gray-color">
          {{ $t('title.automationStatisticsPeriod') }}
        </span>
        <v-menu
          ref="menu"
          v-model="showDateOptions"
          class="select-menu"
          :close-on-content-click="false"
          bottom
          transition="scale-y-transition"
          offset-y
          width="120"
        >
          <template v-slot:activator="{ on }">
            <button
              class="select-button align-items-center"
              :class="{ 'select-button-open': showDateOptions === true }"
              v-on="on"
              @click="showDateOptions = true"
            >
              <span
                :class="{ 'menu-open': showDateOptions === true }"
                class="div-row align-items-center text-nowrap font-10"
              >
                {{ selectedDateOption.label || $t('input.select') }}
              </span>
              <span
                class="material-symbols-rounded icon-up"
                :class="{ 'icon-dropdown  ds-blue-color': showDateOptions === true }"
              >
                arrow_drop_down
              </span>
            </button>
          </template>
          <v-card width="120" class="select-card" :class="{ 'select-card-open': showDateOptions === true }">
            <div
              class="select-options"
              v-for="(dateOption, index) in dateListOptions"
              :key="`${dateOption.value}-${index}`"
              :value="dateOption.value"
            >
              <div class="option" @click="changeDateOption(dateOption)">
                {{ dateOption.label }}
              </div>
            </div>
          </v-card>
        </v-menu>
      </div>
    </div>
    <div class="d-flex px-5 pb-5 config-container w-100">
      <div
        :class="isLoadingData && !$route.path.includes('new-group') ? 'd-none' : ''"
        class="div-column gap-20 pb-10 align-items-start"
      >
        <span class="font-12 text-600 align-self-start ds-gray-color">{{ $t('sidebar.settings') }}</span>
        <div
          v-for="(config, index) in currentGroupConfigs"
          :key="`card-${index}`"
          class="div-row gap-10 align-items-center message-card"
        >
          <DataLoader :isLoading="isLoadingData || isLoadingStatistics" :type="'card'" class="message-width" />
          <TwoFaCards
            :class="isLoadingData || isLoadingStatistics ? 'd-none' : ''"
            :messages="getAvailableMessages(index)"
            :message="config.message"
            :percentage="config.percentage"
            :index="index"
            :messageType="generalType"
            :messageStatistics="config.message ? messageStatistics[config.message.id] || [] : []"
            @updateInfo="updateInfo"
          />
          <button class="ds-gray-color delete-button" @click="removeCard(index)">
            <span class="material-symbols-rounded font-20">delete</span>
          </button>
        </div>
        <div class="div-row align-items-center add-button-container" @mouseleave="closeAction" @mouseenter="openAction">
          <button class="d-flex align-items-center add-card-button justify-content-center cursor-pointer">
            <span class="material-symbols-rounded font-20">add</span>
          </button>
          <div :class="['div-column gap-10 ds-gray-color actions-container', { show: showActions }]">
            <button
              v-tooltip.top="newGroupName === '' && groupName === '' ? $t('input.fillGroup') : ''"
              :disabled="newGroupName === '' && groupName === ''"
              @click="addNewMessage"
              class="d-flex align-items-center justify-content-center cursor-pointer"
            >
              <span class="font-12 text-600">
                {{ $t('create.createMessage') }}
              </span>
            </button>
            <button
              :class="{ 'disabled-button': !canCreateNewCard }"
              :disabled="!canCreateNewCard"
              @click="addNewCard"
              class="d-flex align-items-center justify-content-center cursor-pointer"
            >
              <span class="font-12 text-600">
                {{ $t('create.addConfiguration') }}
              </span>
            </button>
          </div>
        </div>
      </div>
      <div v-if="generalMessageStatistics && !isNewGroup" class="div-column gap-20 message-width">
        <span class="font-12 text-600 align-self-start ds-gray-color">{{ $t('sidebar.dashboard') }}</span>
        <DataLoader :isLoading="isLoadingData || isLoadingStatistics" :type="'card'" class="message-width" />
        <TwoFAStatistics
          class="card-placement"
          :class="isLoadingData || isLoadingStatistics ? 'd-none' : ''"
          :statistic="generalMessageStatistics"
          :period="selectedDateOption.label"
          v-if="generalMessageStatistics"
        />
      </div>
    </div>
    <div class="div-column align-items-end button-save-position gap-10">
      <div
        v-if="(totalPercentage > 100 || totalPercentage < 100) && currentGroupConfigs.length > 0"
        class="div-row w-100"
      >
        <span class="font-12 text-error">{{ $t('warning.percentageMustEqual100', { current: totalPercentage }) }}</span>
      </div>
      <div class="div-row align-items-center gap-20">
        <button
          class="ds-blue-color font-12 text-uppercase align-items-center justify-content-center text-600"
          @click="returnToMessages"
        >
          {{ $t('button.return') }}
        </button>
        <ButtonDefault
          :disabled="!canSave"
          :name="`${$t('button.save')}`"
          data-cy="button-cancel"
          class="btn btn-c btn-lg button"
          @click="saveMessageConfigs"
        ></ButtonDefault>
      </div>
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
import {
  getTwoFaConfig,
  setTwoFaConfig,
  setTwoFaCurrentGroup,
  clearTwoFaCurrentGroup,
  hasEspecialCharacters,
} from '@/util/objects';
import ModalService from '@/services/modal.service';
import AccountsService from '@/modules/accounts/services/account.service';
import InputDefault from '@/components/input/InputDefault.vue';
import { areObjectsEqual } from '../../../util/objects';
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
    DataLoader,
  },
})
export default class TwoFASettings extends Vue {
  private readonly messagesService = new MessagesService();
  private readonly accountService = new AccountService();
  private readonly accountsService = new AccountsService();
  private readonly toastService = new ToastService();
  private readonly dashboardService = new DashboardService();
  private readonly modalService = new ModalService();

  public accountChannels!: any;
  public messageConfigs: Record<string, Record<string, any[]>> = {};
  public originalMessageConfigs: Record<string, Record<string, any[]>> = {};
  public currentAccountTimezone!: string;

  closeTimeout: any = null;
  unregisterGuard: any = null;
  groupName = '';
  newGroupName = '';
  currentAccount!: AccountDto;
  messages: MessageDto[] = [];
  isLoadingSearch = false;
  messageId!: number;
  accountConfig: any = {};
  messageStatistics: any = {};
  generalMessageStatistics: any = null;
  isLoadingStatistics = false;
  showDateOptions = false;
  selectedDateOption: any = {};
  startDate = new Date();
  endDate = new Date();
  showActions = false;
  dateListOptions = [
    {
      label: this.$t('input.today'),
      value: 'today',
    },
    {
      label: this.$t('input.yesterday'),
      value: 'yesterday',
    },
    {
      label: this.$t('input.last7Days'),
      value: 'last7Days',
    },
    {
      label: this.$t('input.last30Days'),
      value: 'last30Days',
    },
  ];
  groupsConfigs: string[] = [];
  isEditingGroupName = false;
  isLoadingData = false;
  isNavigatingToCreateMessage = false;
  isDataLoaded = false;
  originalAccountConfig: any = {};
  isReturningFromMessageCreate = false;
  isSavingAndNavigating = false;

  get isNewGroup() {
    if (!this.isDataLoaded) {
      return false;
    }

    if (this.$route.path.includes('new-group')) {
      return true;
    }

    const originalExistingGroups = Object.keys(this.originalAccountConfig?.[this.generalType] || {});
    return !originalExistingGroups.includes(this.groupName || this.newGroupName);
  }

  get canCreateNewCard() {
    return (this.currentGroupConfigs || []).length < this.messages.length && this.messages.length > 1;
  }

  get generalType() {
    const pathParts = this.$route.path.replace('/messages/2FA/', '').split('/');
    return pathParts[0];
  }

  get cleanType() {
    return this.generalType.replace('/new', '');
  }

  get totalPercentage() {
    return (this.currentGroupConfigs || []).reduce((sum, config) => sum + (Number(config.percentage) || 0), 0);
  }

  get currentGroupConfigs() {
    return this.messageConfigs[this.generalType]?.[this.groupName] || [];
  }

  get hasConfigsChanged() {
    const configsHaveChanged = JSON.stringify(this.messageConfigs) !== JSON.stringify(this.originalMessageConfigs);
    const groupNameHasChanged = this.groupName !== this.newGroupName;
    const isNewGroupWithChanges =
      this.isNewGroup &&
      (this.newGroupName !== '' || (this.currentGroupConfigs && this.currentGroupConfigs.length > 0));

    return configsHaveChanged || groupNameHasChanged || isNewGroupWithChanges;
  }

  get hasInvalidGroupName() {
    return this.newGroupName && !hasEspecialCharacters(this.newGroupName.replace(/-/g, ''));
  }

  get canSave() {
    if (!this.hasConfigsChanged) {
      return false;
    }

    if (this.hasInvalidGroupName) {
      return false;
    }

    if (this.isNewGroup) {
      return this.newGroupName !== '';
    }

    if (this.groupName !== this.newGroupName) {
      return this.newGroupName !== '';
    }

    if ((this.currentGroupConfigs || []).length > 0) {
      return (
        this.totalPercentage === 100 &&
        (this.currentGroupConfigs || []).every((config: any) => config.message && config.percentage > 0)
      );
    }

    return true;
  }

  async beforeMount() {
    this.isLoadingData = true;

    this.selectedDateOption = this.dateListOptions[0];
    await this.getMessages();
    await this.load2FASettings();
    this.isDataLoaded = true;

    if (this.$route.path.includes('new-group')) {
      this.groupName = '';
      this.newGroupName = '';
      this.isEditingGroupName = true;

      const storedConfigs = getTwoFaConfig(this.cleanType, null);

      if (storedConfigs && Object.keys(storedConfigs).length > 0) {
        const storedGroupName = Object.keys(storedConfigs)[0];
        this.newGroupName = storedGroupName;
        this.groupName = storedGroupName;

        this.messageConfigs = {
          [this.generalType]: {
            [storedGroupName]: storedConfigs[storedGroupName] || [],
          },
        };
        this.originalMessageConfigs = { [this.generalType]: { [storedGroupName]: [] } };
      } else {
        this.messageConfigs = { [this.generalType]: { '': [] } };
        this.originalMessageConfigs = { [this.generalType]: { '': [] } };
      }

      clearTwoFaCurrentGroup();
    } else if (this.$route.params.group) {
      this.getValuesUrl();
      await this.loadGroupConfigs(this.groupName);

      if (this.isNewGroup) {
        this.isEditingGroupName = true;
      }
    }

    if (this.selectedDateOption && this.selectedDateOption.value && !this.isNewGroup) {
      this.changeDateOption(this.selectedDateOption);
    }

    this.isLoadingData = false;
  }

  async getMessages() {
    this.isLoadingSearch = true;
    try {
      const response: any = await this.messagesService.getMessages({
        page: 1,
        itemsPerPage: 100,
        type: `2FA-${this.generalType}`,
      });

      this.messages = response.data?.results.map((item: any) => {
        return {
          id: item.id,
          title: item.title,
          subject: item.subject,
          fromName: item.fromName,
          name: item.name,
          url: item.url,
        };
      });
    } catch (err) {
      this.isLoadingSearch = false;
      throw err;
    } finally {
      this.isLoadingSearch = false;
    }
  }

  async load2FASettings() {
    try {
      try {
        const accountResponse = await this.accountsService.getAccount(this.currentAccount.id || 0);
        if (accountResponse.data) {
          this.$store.commit('setCurrentAccount', accountResponse.data);
        }
      } catch (err) {
        console.error('Error refreshing account data:', err);
      }

      this.accountConfig = JSON.parse(getAccountConfig(this.currentAccount, '2fa_settings') || '{}') || {};
      this.originalAccountConfig = JSON.parse(JSON.stringify(this.accountConfig));

      this.groupsConfigs = Object.keys(this.accountConfig[this.cleanType] || {});

      const storedConfigs = getTwoFaConfig(this.cleanType, null);

      if (storedConfigs && Object.keys(storedConfigs).length > 0) {
        if (!this.accountConfig[this.cleanType]) {
          this.accountConfig[this.cleanType] = {};
        }

        Object.keys(storedConfigs).forEach((groupName) => {
          if (!this.accountConfig[this.cleanType][groupName]) {
            this.accountConfig[this.cleanType][groupName] = [];
          }

          storedConfigs[groupName].forEach((newConfig: any) => {
            const existingIndex = this.accountConfig[this.cleanType][groupName].findIndex(
              (existing: any) => existing.message && existing.message.id === newConfig.message.id
            );

            if (existingIndex === -1) {
              this.accountConfig[this.cleanType][groupName].push(newConfig);
            } else {
              this.accountConfig[this.cleanType][groupName][existingIndex] = newConfig;
            }
          });
        });

        this.groupsConfigs = Object.keys(this.accountConfig[this.cleanType] || {});

        if (!this.$route.path.includes('new-group')) {
          setTwoFaConfig(this.cleanType, {});
        }
      }
    } catch (err) {
      this.messageConfigs = {};
      this.originalMessageConfigs = {};
    }
  }

  async loadGroupConfigs(groupName: string) {
    try {
      if (this.accountConfig && this.accountConfig[this.cleanType] && this.accountConfig[this.cleanType][groupName]) {
        this.messageConfigs = {
          [this.cleanType]: {
            [groupName]: this.accountConfig[this.cleanType][groupName],
          },
        };
      } else {
        this.messageConfigs = { [this.cleanType]: { [groupName]: [] } };
      }

      this.originalMessageConfigs = {
        [this.cleanType]: {
          [groupName]:
            this.originalAccountConfig[this.cleanType] && this.originalAccountConfig[this.cleanType][groupName]
              ? JSON.parse(JSON.stringify(this.originalAccountConfig[this.cleanType][groupName]))
              : [],
        },
      };

      this.groupName = groupName;
      this.newGroupName = groupName;
      setTwoFaCurrentGroup(groupName);
    } catch (err) {
      console.error('Error loading group configs:', err);
      this.messageConfigs = {};
      this.originalMessageConfigs = {};
    }
  }

  async getStatisticsForMessages() {
    try {
      if (!this.groupName) {
        this.messageStatistics = {};
        return;
      }

      const messageIds = (this.currentGroupConfigs || []).map((value: any) => value.message.id);

      const response = await this.dashboardService.getDashboardData(
        this.startDate,
        this.endDate,
        {
          messages: messageIds,
          groupByMessage: true,
        },
        `statistics/${this.generalType}`
      );

      this.messageStatistics = {};

      if (response.data) {
        (this.currentGroupConfigs || []).forEach((config: any) => {
          if (config.message && config.message.id) {
            const messageId = config.message.id.toString();
            const messageData = response.data[messageId];

            if (messageData && messageData.general) {
              const general = messageData.general;

              if (this.generalType === 'email') {
                this.messageStatistics[messageId] = [
                  { title: this.$t('datatable.delivered'), total: general.delivered, percentage: 0 },
                  {
                    title: this.$t('datatable.open'),
                    total: general.open,
                    percentage: general.open ? ((general.open / general.delivered) * 100).toFixed(2) : 0,
                  },
                  {
                    title: this.$t('datatable.bounce'),
                    total: general.bounce,
                    percentage: general.bounce ? ((general.bounce / general.delivered) * 100).toFixed(2) : 0,
                  },
                  {
                    title: this.$t('datatable.unsubscribe'),
                    total: general.unsubscribe,
                    percentage: general.unsubscribe ? ((general.unsubscribe / general.delivered) * 100).toFixed(2) : 0,
                  },
                ];
              }

              if (this.generalType === 'sms' || this.generalType === 'whatsapp') {
                this.messageStatistics[messageId] = [
                  { title: this.$t('datatable.delivered'), total: general.delivered, percentage: 0 },
                  { title: this.$t('datatable.sent'), total: general.sent, percentage: 0 },
                ];
              }
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching message statistics:', err);
      this.messageStatistics = {};
    }
  }

  async getGeneralStatistics() {
    try {
      if (!this.groupName) {
        this.generalMessageStatistics = null;
        return;
      }

      const response = await this.dashboardService.get2FAStatistics(this.startDate, this.endDate, this.generalType, [
        this.groupName,
      ]);

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

        const currentGroupStats = groupStats[this.groupName];
        if (currentGroupStats) {
          this.generalMessageStatistics = {
            count_total: currentGroupStats.count_total,
            count_success: currentGroupStats.count_success,
            count_error: currentGroupStats.count_error,
            count_verify_validated: currentGroupStats.count_verify_validated,
            count_verify_rejected: currentGroupStats.count_verify_rejected,
          };
        } else {
          this.generalMessageStatistics = {
            count_total: 0,
            count_success: 0,
            count_error: 0,
            count_verify_validated: 0,
            count_verify_rejected: 0,
          };
        }
      } else {
        this.generalMessageStatistics = {
          count_total: 0,
          count_success: 0,
          count_error: 0,
          count_verify_validated: 0,
          count_verify_rejected: 0,
        };
      }
    } catch (err) {
      console.error('Error fetching general statistics:', err);
      this.generalMessageStatistics = null;
    }
  }

  async changeDateOption(dateOption: any) {
    if (this.isNewGroup) {
      this.selectedDateOption = dateOption;
      this.showDateOptions = false;
      return;
    }

    const accountTimezone = this.currentAccountTimezone;

    switch (dateOption.value) {
      case 'today':
        this.startDate = dayjs().tz(accountTimezone).subtract(0, 'day').startOf('day').toDate();
        this.endDate = dayjs().tz(accountTimezone).startOf('day').toDate();
        break;
      case 'yesterday':
        this.startDate = dayjs().tz(accountTimezone).subtract(1, 'day').startOf('day').toDate();
        this.endDate = dayjs().tz(accountTimezone).subtract(1, 'day').startOf('day').toDate();
        break;
      case 'last7Days':
        this.startDate = dayjs().tz(accountTimezone).subtract(7, 'day').startOf('day').toDate();
        this.endDate = dayjs().tz(accountTimezone).startOf('day').toDate();
        break;
      case 'last30Days':
        this.startDate = dayjs().tz(accountTimezone).subtract(30, 'day').startOf('day').toDate();
        this.endDate = dayjs().tz(accountTimezone).startOf('day').toDate();
        break;
      default:
        this.startDate = dayjs().tz(accountTimezone).subtract(0, 'day').startOf('day').toDate();
        this.endDate = dayjs().tz(accountTimezone).startOf('day').toDate();
    }

    this.selectedDateOption = dateOption;
    this.showDateOptions = false;
    this.isLoadingStatistics = true;
    await this.getStatisticsForMessages();
    await this.getGeneralStatistics();
    this.isLoadingStatistics = false;
    this.setValuesUrl();
  }

  updateGroupName(event: string) {
    this.newGroupName = event;
  }

  updateInfo(event: any) {
    if (!this.messageConfigs[this.generalType]) {
      this.$set(this.messageConfigs, this.generalType, {});
    }
    if (!this.messageConfigs[this.generalType][this.groupName]) {
      this.$set(this.messageConfigs[this.generalType], this.groupName, []);
    }
    const groupConfigs = this.messageConfigs[this.generalType][this.groupName];
    if (event.index >= 0) {
      this.$set(groupConfigs, event.index, {
        message: event.message,
        percentage: event.percentage,
      });
    } else {
      groupConfigs.push({
        message: event.message,
        percentage: event.percentage,
      });
    }
  }

  openAction() {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    this.showActions = true;
  }

  closeAction() {
    this.closeTimeout = setTimeout(() => {
      this.showActions = false;
      this.closeTimeout = null;
    }, 200);
  }

  addNewCard() {
    if (!this.messageConfigs[this.generalType]) {
      this.$set(this.messageConfigs, this.generalType, {});
    }
    if (!this.messageConfigs[this.generalType][this.groupName]) {
      this.$set(this.messageConfigs[this.generalType], this.groupName, []);
    }
    this.messageConfigs[this.generalType][this.groupName].push({
      message: null,
      percentage: 0,
    });
    this.showActions = false;
  }

  addNewMessage() {
    this.isNavigatingToCreateMessage = true;
    const groupNameForMessage = this.isNewGroup ? this.newGroupName : this.groupName;
    setTwoFaCurrentGroup(groupNameForMessage);

    const tempConfigs = {
      [groupNameForMessage]: this.currentGroupConfigs || [],
    };
    setTwoFaConfig(this.cleanType, tempConfigs);

    this.$router.push(`/messages/2FA/${this.cleanType}/new`);
    this.showActions = false;
  }

  removeCard(index: number) {
    this.messageConfigs[this.generalType][this.groupName].splice(index, 1);
  }

  async saveMessageConfigs() {
    if (!this.hasConfigsChanged) {
      return;
    }

    if (this.currentGroupConfigs.length === 0) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.noConfigs') as string,
        leftBorder: false,
      });
      return;
    }

    if (this.newGroupName === '') {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.groupNameIsEmpty') as string,
        leftBorder: false,
      });
      return;
    }

    if (this.hasInvalidGroupName) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.groupNameContainsSpecialCharacters') as string,
        leftBorder: false,
      });
      return;
    }

    if (this.isNewGroup && this.newGroupName === '') {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.groupNameIsEmpty') as string,
        leftBorder: false,
      });
      return;
    }

    const existingGroups = Object.keys(this.accountConfig[this.generalType] || {});
    if (this.newGroupName && existingGroups.includes(this.newGroupName) && this.newGroupName !== this.groupName) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.groupNameAlreadyExists') as string,
        leftBorder: false,
      });
      return;
    }

    if (
      (this.currentGroupConfigs || []).length > 0 &&
      (this.totalPercentage < 100 ||
        !(this.currentGroupConfigs || []).every((config: any) => config.message && config.percentage > 0))
    ) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.allElementLessThan100', { current: this.totalPercentage }) as string,
        leftBorder: false,
      });
      return;
    }

    try {
      let updatedTypeConfigs = { ...this.accountConfig[this.generalType] };

      if (this.groupName !== this.newGroupName && this.newGroupName) {
        if (updatedTypeConfigs[this.groupName]) {
          updatedTypeConfigs[this.newGroupName] = updatedTypeConfigs[this.groupName];
          delete updatedTypeConfigs[this.groupName];
        }

        if (this.messageConfigs[this.generalType] && this.messageConfigs[this.generalType][this.groupName]) {
          this.messageConfigs[this.generalType][this.newGroupName] =
            this.messageConfigs[this.generalType][this.groupName];
          delete this.messageConfigs[this.generalType][this.groupName];
        }
      }

      updatedTypeConfigs = {
        ...updatedTypeConfigs,
        ...this.messageConfigs[this.generalType],
      };

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

      if (this.groupName !== this.newGroupName && this.newGroupName) {
        this.groupName = this.newGroupName;
        this.isEditingGroupName = false;
      }

      await this.load2FASettings();
      if (this.groupName) {
        await this.loadGroupConfigs(this.groupName);
      }

      this.originalAccountConfig = JSON.parse(
        JSON.stringify({
          ...this.accountConfig,
          [this.generalType]: updatedTypeConfigs,
        })
      );
      this.originalMessageConfigs = JSON.parse(JSON.stringify(this.messageConfigs));

      this.isSavingAndNavigating = true;
    } catch (err) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.notSaved') as string,
        leftBorder: false,
      });
      return;
    }

    this.returnToMessages();
  }

  getAvailableMessages(currentIndex: number) {
    const selectedMessageIds = (this.currentGroupConfigs || [])
      .map((config: any, index: number) => (index !== currentIndex && config.message ? config.message.id : null))
      .filter((id: any) => id !== null);

    return this.messages.filter((message) => !selectedMessageIds.includes(message.id));
  }

  mounted() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    this.unregisterGuard = this.$router.beforeEach(async (to, from, next) => {
      if (this.isNavigatingToCreateMessage) {
        this.isNavigatingToCreateMessage = false;
        next();
        return;
      }

      if (this.isReturningFromMessageCreate) {
        this.isReturningFromMessageCreate = false;
        next();
        return;
      }

      if (this.isSavingAndNavigating) {
        this.isSavingAndNavigating = false;
        next();
        return;
      }

      if (this.hasConfigsChanged) {
        const shouldSave = await this.confirmUnsavedChanges();
        if (shouldSave === 'save') {
          try {
            await this.saveMessageConfigs();
            next();
          } catch (error) {
            next(false);
          }
        } else if (shouldSave === 'discard') {
          next();
        } else {
          next(false);
        }
      } else {
        next();
      }
    });
  }

  beforeDestroy() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.unregisterGuard();
    this.isNavigatingToCreateMessage = false;
  }

  handleBeforeUnload(event: BeforeUnloadEvent) {
    if (this.hasConfigsChanged) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
  }

  confirmUnsavedChanges(): Promise<'save' | 'discard' | 'cancel'> {
    return new Promise((resolve) => {
      this.modalService.confirm({
        title: this.$t('modal.unsavedChanges') as string,
        text: this.$t('modal.unsavedChangesMessage') as string,
        confirmLabel: this.$t('button.save') as string,
        cancelLabel: this.$t('button.discardChanges') as string,
        confirmFunction: () => {
          if (
            (this.currentGroupConfigs || []).length > 0 &&
            (this.totalPercentage !== 100 ||
              !(this.currentGroupConfigs || []).every((config: any) => config.message && config.percentage > 0))
          ) {
            this.toastService.show({
              type: 'error',
              text: this.$t('warning.allElementLessThan100', { current: this.totalPercentage }) as string,
              leftBorder: false,
            });
            return;
          }
          resolve('save');
        },
        cancelFunction: () => resolve('discard'),
        isConfirm: true,
      });
    });
  }

  getValuesUrl() {
    this.groupName = this.$route.params.group as string;
    this.newGroupName = this.groupName;

    if (this.$route.query.period) {
      const foundOption = this.dateListOptions.find((option) => option.value === this.$route.query.period);
      if (foundOption) {
        this.selectedDateOption = foundOption;
      } else {
        this.selectedDateOption = this.dateListOptions[0];
      }
    }
  }

  setValuesUrl() {
    if (!this.selectedDateOption || !this.selectedDateOption.value) {
      return;
    }

    if (this.groupName === this.$route.params.group && this.selectedDateOption.value === this.$route.query.period) {
      return;
    }

    const query = {
      period: this.selectedDateOption.value,
    };

    if (areObjectsEqual(this.$route.query, query) === false) {
      this.$router.push({ query });
    }
  }

  changeGroup() {
    this.isEditingGroupName = !this.isEditingGroupName;
  }

  returnToMessages() {
    this.$router.push(`/messages/2FA/${this.generalType}`);
  }

  created() {
    if (
      this.cleanType &&
      getTwoFaConfig(this.cleanType, null) &&
      Object.keys(getTwoFaConfig(this.cleanType, null)).length > 0
    ) {
      this.isReturningFromMessageCreate = true;
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.cards-container {
  padding: 0px 15px 20px 15px;
}

.nav-bar-pages {
  background-color: #ffffff;
  width: 100%;
  border-radius: 16px;
  padding: 16px;
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.1),
    0px 1px 2px 0px rgba(0, 0, 0, 0.06);
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

.config-container {
  overflow: auto;
  height: 68vh;
  width: fit-content;
  align-items: flex-start;
  align-self: center;
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
  z-index: 1000;
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
    box-shadow:
      0px 1px 3px 0px rgba(0, 0, 0, 0.1),
      0px 1px 2px 0px rgba(0, 0, 0, 0.06);
    width: max-content;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    &:hover {
      transform: scale(1.08);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    &:disabled {
      cursor: not-allowed;
      background-color: #a6a6a6 !important;
      color: #ffffff;
    }
  }
}

@media (max-width: 1490px) {
  .config-container {
    flex-direction: column;
    overflow: auto;
    align-items: center;
  }
}

@media (min-width: 1490px) {
  .config-container {
    flex-direction: row;
    justify-content: space-around;
    overflow-x: hidden;
    overflow-y: auto;
    align-items: flex-start;
    gap: 20px;
  }
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}
</style>
