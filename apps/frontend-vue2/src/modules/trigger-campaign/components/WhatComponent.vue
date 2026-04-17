<template>
  <div class="div-column w-100 background-card mb-0 input-campaign-form gap-10">
    <button class="div-column w-100" @click="toggleModal()">
      <div class="div-row gap-10 justify-content-between align-items-center">
        <div class="div-row gap-10 align-items-center">
          <span
            class="font-28 ds-white-color material-symbols-rounded icon-send-background"
            :class="{
              'is-saved': isCompleted && !hasChanges,
              'is-not-saved': !isCompleted || hasChanges,
            }"
          >
            {{ isCompleted && !hasChanges ? 'check' : 'send' }}
          </span>
          <div class="div-column gap-5 align-items-start">
            <span class="font-18 ds-gray-color text-600">
              {{ $t('title.what') }}
            </span>
            <span class="font-14 ds-light-gray-color">{{ $t('title.selectOrCreate') }}</span>
          </div>
        </div>
        <span class="material-symbols-rounded font-24 ds-gray-color">
          {{ isMainModalOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}
        </span>
      </div>
    </button>
    <div
      v-if="isMainModalOpen || isClosing"
      class="div-column w-100 gap-10 pt-4 expandable-content campaign-what"
      :class="{ expanding: isMainModalOpen, closing: isClosing }"
    >
      <span class="font-16 ds-gray-color text-600">{{ $t('title.messageType') }}</span>
      <div class="div-row gap-15 align-items-center">
        <button
          v-for="messageType in messageTypes"
          v-tooltip.top="!checkAccountSettings(messageType.type) && `${$t(`title.noAccess`)}`"
          :key="messageType.type"
          :class="{
            'selected-new': messageTypeSelected === messageType.type,
            'disabled-not-new': messageTypeSelected !== messageType.type || !checkAccountSettings(messageType.type),
          }"
          class="type-card div-row align-items-center gap-15 message-type-card-width"
          @click="changeMessageType(messageType.type)"
        >
          <img
            v-if="messageType.type === 'whatsapp'"
            :src="messageTypeSelected === 'whatsapp' ? wppBlueIcon : wppIcon"
            alt="messageType.name"
            class="message-icon-whatsapp"
          />
          <span
            v-else
            class="ds-gray-color material-symbols-rounded message-icon"
            :class="{ 'ds-blue-color': messageTypeSelected === messageType.type }"
          >
            {{ messageType.icon }}
          </span>
          <span
            class="font-14 ds-gray-color text-600"
            :class="{ 'ds-blue-color': messageTypeSelected === messageType.type }"
          >
            {{ messageType.name }}
          </span>
        </button>
      </div>
      <span hidden class="font-16 ds-gray-color text-600 mt-2">{{ $t('title.sendAs') }}</span>
      <div hidden class="div-row gap-15 align-items-stretch">
        <button
          v-for="campaignType in campaignTypes"
          :key="campaignType.type"
          class="type-card div-row align-items-center gap-15 cursor-pointer campaign-type-card message-type-not-selected campaign-type-card-width"
          :class="campaignTypeSelected === campaignType.type ? 'selected-new' : ''"
          @click="changeCampaignType(campaignType.type)"
        >
          <img
            :src="campaignTypeSelected === campaignType.type ? campaignType.blueIcon : campaignType.grayIcon"
            alt="campaignType.name"
            class="message-icon-campaign"
            :class="{ 'turn-icon': campaignType.type === 'trigger' }"
          />
          <div class="div-column gap-5 campaign-type-card-text">
            <span
              class="font-14 ds-gray-color text-600"
              :class="{ 'ds-blue-color': campaignTypeSelected === campaignType.type }"
            >
              {{ campaignType.name }}
            </span>
            <span
              class="font-12 ds-gray-color text-400"
              :class="{ 'ds-blue-color': campaignTypeSelected === campaignType.type }"
            >
              {{ campaignType.subtitle }}
            </span>
          </div>
        </button>
      </div>
      <span class="font-16 ds-gray-color text-600 mt-2">{{ $t('create.content') }}</span>
      <div class="select-message div-column gap-10 align-items-start message-content-width">
        <span class="font-14 ds-blue-color text-600">{{ $t('create.message') }}</span>
        <div class="div-row gap-15 align-items-center w-100">
          <v-menu
            ref="menu"
            v-model="showMessages"
            class="message-menu"
            :close-on-content-click="false"
            transition="scale-y-transition"
            width="283"
          >
            <template v-slot:activator="{ on }">
              <button class="menu-messages ds-gray-color" v-on="on" @click="focusInput">
                <span class="font-12">{{ $t('input.selectMessages') }}</span>
                <span class="ds-gray-color material-symbols-rounded">arrow_drop_down</span>
              </button>
            </template>
            <v-card class="message-card">
              <div class="search-bar-select">
                <input
                  id="messages-search"
                  class="search-input"
                  type="text"
                  v-model="messageValue"
                  :placeholder="`${$t('input.search')}`"
                  @input="getMessages($event.target.value)"
                />
                <span
                  class="material-symbols-rounded font-20 cursor-pointer"
                  :class="{ 'ds-blue-color': showMessages === true }"
                >
                  search
                </span>
              </div>
              <div v-if="isLoadingImage" class="load-icon py-3">
                <span class="d-flex material-symbols-rounded ds-blue-color rotate-icon">progress_activity</span>
              </div>
              <div v-else class="message-list">
                <div
                  class="checkbox-message pl-2"
                  :key="`message-modal-filter-${i}`"
                  v-for="(message, i) in localMessages"
                >
                  <input
                    type="checkbox"
                    :key="`search-input-message-${i}`"
                    :id="`message-options-${message.id}`"
                    v-model="selectedMessages"
                    :value="{ ...message }"
                    class="input-filters"
                    :disabled="selectedMessages.length >= 10"
                  />
                  <label
                    class="label-filters"
                    :for="`message-options-${message.id}`"
                    :key="`message-labels-${i}`"
                    :disabled="selectedMessages.length >= 10"
                    >{{ message.title }}</label
                  >
                </div>
              </div>
              <div class="pr-3 pt-3 pb-3 div-row gap-10 message-button">
                <button
                  class="clear-fields text-600 font-10 ds-blue-color"
                  :disabled="!selectedMessages.length"
                  @click.prevent="clearMessages"
                >
                  {{ $t('button.clear') }}
                </button>
                <button
                  class="apply-button text-600"
                  :disabled="!selectedMessages.length"
                  @click.prevent="selectMessages"
                >
                  {{ $t('button.apply') }}
                </button>
              </div>
            </v-card>
          </v-menu>
          <!-- <span class="font-12 ds-light-gray-color">{{ $t('input.or') }}</span>
            <ButtonDefault
              :name="$t('button.createNewMessage')"
              data-cy="button-view-fields"
              class="create-message-button"
              @click="openModalCreateMessage"
            /> -->
        </div>
      </div>
      <div class="div-column gap-15 message-content pt-1 pr-3" v-if="messagesSelected.length > 0">
        <div
          class="div-row gap-10 align-items-center"
          v-for="messageSelected in messagesSelected"
          :key="messageSelected.id"
        >
          <div class="select-message div-column gap-10 message-content-width">
            <div class="div-row gap-10 align-items-center justify-content-between">
              <span class="font-14 ds-blue-color text-600">{{ messageSelected.title }}</span>
              <button
                class="material-symbols-rounded font-20 cursor-pointer ds-gray-color"
                @click="openMessagePreview(messageSelected)"
              >
                visibility
              </button>
            </div>
            <span class="font-12 ds-gray-color text-600" v-if="messageSelected.subject">
              {{ $t('datatable.subject') }}: {{ messageSelected.subject }}
            </span>
            <span class="font-12 ds-gray-color text-400" v-if="messageSelected.fromName">
              {{ $t('datatable.from') }}: {{ messageSelected.fromName }}
            </span>
            <div
              v-if="messageSelected.links.length"
              :class="[expandedLinks[messageSelected.id] ? 'div-column' : 'div-row gap-5']"
            >
              <span class="ds-gray-color font-12 text-600">Link(s):</span>
              <div
                class="div-column font-12"
                :class="[
                  !expandedLinks[messageSelected.id] || messageSelected.links.length === 1 ? 'single-link' : 'w-100',
                ]"
              >
                <a
                  v-for="(links, index) in getVisibleLinks(messageSelected)"
                  :key="'ctaLink' + index"
                  :href="`${links}`"
                  target="_blank"
                  class="ds-blue-color links-decoration no-underline"
                >
                  {{ links }}
                </a>
              </div>
            </div>
            <button
              class="open-links text-600 font-10 mt-1"
              v-on:click="toggleLinks(messageSelected.id)"
              v-if="messageSelected.links.length > 1"
            >
              {{ expandedLinks[messageSelected.id] ? $t('input.showLess') : $t('input.showMore') }}
            </button>
            <div
              class="div-row gap-10 align-items-center statistics-card-container pb-1"
              v-if="messageStatistics[messageSelected.id]"
            >
              <div
                class="div-column gap-10 statistics-card"
                v-for="(value, key) in getFilteredStatistics(messageStatistics[messageSelected.id].general)"
                :key="key"
              >
                <span class="font-12 ds-gray-color text-600 statistic-wrap">{{ `${$t(`datatable.${key}`)}` }}</span>
                <div class="div-row gap-5 align-items-baseline">
                  <span class="font-14 ds-gray-color text-600">{{ value | formatNumber }}</span>
                  <span class="font-12 ds-gray-color text-600" v-if="key !== 'delivered'">
                    {{ getPercentage(value, messageStatistics[messageSelected.id].general.delivered) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button
            v-if="!hasStatistics"
            class="delete-message material-symbols-rounded font-20 ds-gray-color"
            @click="removeMessage(messageSelected.id)"
          >
            delete
          </button>
        </div>
      </div>
      <ButtonDefault
        :name="$t('button.next')"
        data-cy="button-view-fields"
        class="create-message-button next-button mb-1"
        @click="nextStep"
      />
    </div>
    <v-dialog v-model="showMessagePreview">
      <MessagePreview :messageId="localMessageValue" @closeMessagePreview="closeMessagePreview" />
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import MessagePreview from '@/components/common/MessagePreview.vue';
import { extractLinks, setMenuTop } from '@/util/objects';
import ToastService from '@/services/toast.service';
import { getAccountConfig } from '@/store';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { mapState } from 'vuex';
import { CampaignsDto } from '@/modules/campaigns/dtos/campaigns.dto';
import DashboardService from '@/modules/dashboard/services/dashboard.service';
import { formatDateTz } from '@/util/date';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  providers: [],
  components: {
    ButtonDefault,
    MessagePreview,
  },
  props: ['messages', 'isLoadingImage', 'isNew', 'campaign', 'forceOpen'],
  computed: {
    ...mapState(['currentAccount', 'currentAccountTimezone']),
  },
})
export default class WhatComponent extends Vue {
  @Prop() messages!: MessageDto[];
  currentAccountTimezone!: string;
  @Prop() isLoadingImage!: boolean;
  @Prop() isNew!: boolean;
  @Prop() campaign!: CampaignsDto;
  @Prop() forceOpen!: boolean;

  private readonly toastService = new ToastService();
  dashboardService = new DashboardService();
  currentAccount!: AccountDto;
  localMessages: MessageDto[] = [];
  messageTypeSelected = 'email';
  campaignTypeSelected = 'trigger';
  messageTypes = [
    { name: this.$t('title.email'), type: 'email', icon: 'email' },
    // { name: this.$t('title.webPush'), type: 'web-push', icon: 'notifications' },
    // { name: this.$t('title.sms'), type: 'sms', icon: 'sms' },
    // {
    //   name: this.$t('title.whatsapp'),
    //   type: 'whatsapp',
    // },
  ];
  wppIcon = require('@/assets/whatsapp.svg');
  wppBlueIcon = require('@/assets/whatsapp-blue.svg');
  sendAsSelected = 'email';
  campaignTypes = [
    {
      name: this.$t('title.CampaignsTypeSimple'),
      subtitle: this.$t('input.regularCampaign'),
      type: 'trigger',
      grayIcon: require('@/assets/campaign_simple.svg'),
      blueIcon: require('@/assets/campaign_simple_active.svg'),
    },
    // {
    //   name: this.$t('title.CampaignsTypeTestAB'),
    //   subtitle: this.$t('input.testCampaign'),
    //   type: 'trigger-ab',
    //   grayIcon: require('@/assets/campaign_test_ab.svg'),
    //   blueIcon: require('@/assets/campaign_test_ab_active.svg'),
    // },
    // {
    //   name: this.$t('title.CampaignsTypeSplit'),
    //   subtitle: this.$t('input.splitCampaign'),
    //   type: 'trigger-split',
    //   grayIcon: require('@/assets/campaign_split.svg'),
    //   blueIcon: require('@/assets/campaign_split_active.svg'),
    // },
  ];
  showMessages = false;
  selectedMessages: MessageDto[] = [];
  messagesSelected: MessageDto[] = [];
  messageValue = '';
  isMainModalOpen = false;
  isClosing = false;
  showMessagePreview = false;
  localMessageValue: any[] = [];
  expandedLinks: { [key: number]: boolean } = {};
  campaignContent: any = {};
  localCampaign!: CampaignsDto;
  isCompleted = false;
  messageStatistics: any = {};
  hasStatistics = false;
  hasChanges = false;
  originalData: any = null;

  getMessages(inputValue: string) {
    this.$emit('getAllMessages', inputValue);
  }

  toggleModal() {
    if (this.isMainModalOpen) {
      this.isClosing = true;
      this.isMainModalOpen = false;

      setTimeout(() => {
        this.isClosing = false;
      }, 300);
    } else {
      this.isMainModalOpen = true;
    }
  }

  changeMessageType(type: string) {
    this.messageTypeSelected = type;
    this.trackChanges();
    this.$emit('changeMessageType', this.messageTypeSelected);
  }

  changeCampaignType(type: string) {
    this.campaignTypeSelected = type;
    this.$emit('changeCampaignType', this.campaignTypeSelected);
  }

  openModalCreateMessage() {
    this.$emit('openModalCreateMessage');
  }

  clearMessages() {
    this.selectedMessages = [];
    this.messagesSelected = [];
  }

  selectMessages() {
    this.showMessages = false;
    this.messagesSelected = this.selectedMessages;
    this.messagesSelected = this.messagesSelected.map((message: MessageDto) => {
      return {
        ...message,
        links: extractLinks(message.content as string),
      };
    });
    this.trackChanges();
    this.$emit('selectMessages', this.messagesSelected);
  }

  removeMessage(id: number) {
    this.messagesSelected = this.messagesSelected.filter((m) => m.id !== id);
    this.selectedMessages = this.messagesSelected;
    this.trackChanges();
  }

  focusInput() {
    setTimeout(() => {
      const searchInput = document.getElementById('messages-search');
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
  }

  openMessagePreview(message: MessageDto) {
    this.showMessagePreview = true;
    this.localMessageValue = [message.id];
  }

  closeMessagePreview() {
    this.showMessagePreview = false;
  }

  nextStep() {
    if (this.messagesSelected.length === 0) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.cantSaveWhat') as string,
      });
      return;
    }
    this.campaignContent = {
      messages: this.messagesSelected,
      campaignType: this.campaignTypeSelected,
      messageType: this.messageTypeSelected,
    };
    this.$emit('nextStep', this.campaignContent);
    this.toggleModal();
    this.isCompleted = true;
    this.hasChanges = false;
    this.updateOriginalData();
  }

  toggleLinks(messageId: number) {
    this.$set(this.expandedLinks, messageId, !this.expandedLinks[messageId]);
  }

  getVisibleLinks(message: any) {
    if (!message.links || message.links.length <= 1) {
      return message.links;
    }
    return this.expandedLinks[message.id] ? message.links : message.links.slice(0, 1);
  }

  checkAccountSettings(card: any) {
    const settingsName = `${card.replace('-', '')}_settings`;
    const settingsCheck = JSON.parse(getAccountConfig(this.currentAccount, settingsName)) || {};
    return settingsCheck.isActive;
  }

  getMessagesFromSteps(steps: any): any[] {
    const messages: any[] = [];

    const traverseStep = (step: any) => {
      if (!step) {
        return;
      }

      if (step.type === 'email' && step.settings) {
        messages.push(step.settings);
      } else if (step.type === 'randomMessage' && step.settings?.messages) {
        step.settings.messages.forEach((message: any) => {
          messages.push(message);
        });
      }

      if (step.child && Array.isArray(step.child)) {
        step.child.forEach(traverseStep);
      }
    };

    traverseStep(steps);
    return messages;
  }

  async getMessageStatistics(messages: any[]) {
    try {
      const messagesIds = messages.map((message: any) => message.id);
      const tz = this.currentAccountTimezone || 'UTC';
      const startDate = formatDateTz(this.localCampaign?.createdAt || new Date(), tz);
      const endDate = dayjs().tz(tz).format('YYYY-MM-DD');

      const statisticsMessage = await this.dashboardService.getDashboardData(
        startDate,
        endDate,
        { messages: messagesIds, groupByMessage: true },
        `/statistics/email`
      );
      this.messageStatistics = statisticsMessage?.data;

      if (Object.keys(this.messageStatistics).length > 0) {
        this.hasStatistics = true;
      }
    } catch (err) {
      console.error('Error fetching message statistics:', err);
      this.messageStatistics = {};
      this.hasStatistics = false;
    }
  }

  getPercentage(partialNumber: number, totalNumber: number) {
    if (!partialNumber || partialNumber === 0) {
      return 0;
    }
    if (!totalNumber || totalNumber === 0) {
      return 0;
    }
    const value = (partialNumber / totalNumber) * 100;
    return value.toFixed(2);
  }

  getFilteredStatistics(generalStats: any) {
    if (!generalStats) {
      return {};
    }

    const filtered = { ...generalStats };
    delete filtered.sent;
    delete filtered.unique_opens;
    delete filtered.unique_clicks;
    delete filtered.close;

    return filtered;
  }

  trackChanges() {
    if (!this.isNew && this.originalData) {
      const currentData = {
        messageType: this.messageTypeSelected,
        campaignType: this.campaignTypeSelected,
        messagesSelected: this.messagesSelected.map((m) => m.id).sort(),
      };

      const originalMessageIds = this.originalData.messagesSelected?.map((m: any) => m.id).sort() || [];
      const currentMessageIds = currentData.messagesSelected;

      this.hasChanges =
        currentData.messageType !== this.originalData.messageType ||
        currentData.campaignType !== this.originalData.campaignType ||
        JSON.stringify(originalMessageIds) !== JSON.stringify(currentMessageIds);
    }
  }

  updateOriginalData() {
    this.originalData = {
      messageType: this.messageTypeSelected,
      campaignType: this.campaignTypeSelected,
      messagesSelected: [...this.messagesSelected],
    };
  }

  @Watch('messages')
  checkMessages(newVal: any[]) {
    this.localMessages = newVal;
  }

  @Watch('forceOpen', { immediate: true })
  onForceOpenChange(newVal: boolean) {
    if (newVal && !this.isMainModalOpen) {
      this.isMainModalOpen = true;
    }
  }

  @Watch('showMessages')
  onMenuChange(value: boolean) {
    if (value) {
      this.$nextTick(() => {
        setTimeout(() => {
          const activator = this.$el.querySelector('.menu-messages') as HTMLElement;
          if (activator) {
            setMenuTop(activator, -36);
          }
        }, 0);
      });
    }
  }

  @Watch('campaign')
  async onCampaignChange(newVal: any) {
    this.localCampaign = newVal;
    if (this.localCampaign) {
      this.messageTypeSelected = this.localCampaign.messageType;
      this.campaignTypeSelected = this.localCampaign.type;

      const messages = this.getMessagesFromSteps(this.localCampaign.steps);
      this.messagesSelected = messages;
      this.selectedMessages = messages;

      if (messages.length > 0) {
        this.isCompleted = true;
      }

      if (!this.isNew) {
        this.updateOriginalData();
        this.hasChanges = false;
      }

      await this.getMessageStatistics(messages);
    }
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.campaign-what {
  border-top: 1px solid $ds-gray-200;
}

.input-campaign-form {
  padding: 20px;
}
.icon-send-background {
  border-radius: 50%;
  padding: 10px;
  place-content: center;
  text-align: center;
}

.is-not-saved {
  background-color: $ds-blue;
}

.is-saved {
  background-color: $ds-green;
}

.type-card {
  border-radius: 16px;
  padding: 20px 15px;
  border: 1px solid $ds-gray-300;
  background-color: white;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
  }
}

.message-type-card-width {
  width: 25rem;
}

.campaign-type-card-width {
  width: fit-content;
}

.selected-new {
  background-color: $ds-blue-100 !important;
  border: 1px solid $ds-blue;
}

.disabled-not-new {
  background-color: #f5f5f5;
}

.message-icon {
  font-size: 35px;
}

.message-icon-whatsapp {
  width: 35px;
  height: 35px;
}

.message-icon-campaign {
  width: 50px;
  height: 50px;
}

.turn-icon {
  rotate: 90deg;
}

.campaign-type-card {
  min-height: 105px;
  &:disabled {
    background-color: $ds-gray-100;
  }

  .campaign-type-card-text {
    flex: 1;
    justify-content: center;
    text-align: start;
  }
}

.select-message {
  border: 1px solid $ds-gray-300;
  border-radius: 16px;
  padding: 15px 20px;
}

.message-content {
  max-height: 350px;
  overflow-y: auto;
  width: fit-content;
}

.message-content-width {
  width: 500px;
}

.create-message-button {
  color: $neutral-basic-white !important;
  height: 26px !important;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.1em;
  padding: 0px 12px !important;
  box-shadow: none !important;
  font-size: 10px !important;
}

.next-button {
  place-self: flex-end;
}

.select-card {
  border-radius: 0px 0px 8px 8px !important;
}

.select-options {
  border-bottom: 1px solid $ds-gray-100;
}

.menu-messages {
  display: flex;
  flex-direction: row;
  padding-right: 12px;
  padding-left: 12px;
  align-items: center;
  justify-content: space-between;
  border: 1px solid $ds-gray-300;
  min-height: 36px !important;
  border-radius: 8px;
  cursor: pointer;
  background-color: #ffffff;
  width: 100%;
  &:disabled {
    cursor: not-allowed;
  }
}

.message-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
}
.search-bar-select {
  display: flex;
  background: #ffffff;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
  padding-right: 12px;
  padding-left: 12px;
  overflow: hidden;
  align-items: center;
  &:hover {
    background-color: #f5f5f5;
  }
}

.checkbox-message {
  padding-top: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  &:hover {
    background-color: #f5f5f5;
  }
}
.message-list {
  max-height: 150px;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background-color: #ffffff;
}

.search-input {
  min-height: 37px !important;
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: -webkit-fill-available;
}

.input-filters {
  margin: 0 !important;
  cursor: pointer;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: block;
  overflow: hidden;
  margin: 0 !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
}
.message-button {
  justify-content: right;
}
.clear-fields {
  text-transform: uppercase;
  background-color: #ffffff !important;
}

.clear-fields:disabled {
  color: $ds-gray-300 !important;
}

.apply-button {
  background-color: $ds-blue;
  border-radius: 8px;
  padding: 12px;
  color: #ffffff;
  font-size: 10px;
  text-transform: uppercase;
  height: 26px;
  align-items: center;
  display: flex;
  &:disabled {
    background-color: #d9d9d9;
    color: #a6a6a6;
  }
}

.message-menu {
  display: none;
}

@keyframes rotateRight {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotate-icon {
  animation: rotateRight 2s linear infinite;
}

.load-icon {
  display: flex;
  justify-content: center;
  align-items: center;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
  width: 283px;
}

.expandable-content {
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
  transform-origin: top;
}

.expanding {
  animation: slideDown 0.3s ease-out;
}

.closing {
  animation: slideUp 0.3s ease-in;
}

@keyframes slideDown {
  0% {
    max-height: 0;
    opacity: 0;
  }
  100% {
    max-height: 1000px;
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  0% {
    max-height: 1000px;
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    max-height: 0;
    opacity: 0;
  }
}

.open-links {
  outline: none;
  white-space: nowrap;
  color: $ds-blue;
  text-transform: uppercase;
  display: flex;
  justify-content: center;

  &:hover {
    color: $ds-blue-dark;
  }
}

.statistics-card {
  border-radius: 8px;
  padding: 10px;
  border: 1px solid $ds-gray-300;
  background-color: white;
  min-width: 14rem;
  width: fit-content;
  flex-shrink: 0;
}

.statistics-card-container {
  overflow-x: auto;
}

.statistic-wrap {
  white-space: nowrap;
}

::v-deep .v-dialog {
  width: fit-content !important;
  border-radius: 16px;
  box-shadow: none;
}
</style>
