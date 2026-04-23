<template>
  <div class="div-column gap-15 w-100 view-trigger-campaign">
    <div class="div-column gap-5 align-items-start campaign-title pl-0">
      <router-link :to="'/trigger-campaign'" class="clickable-breadcrumb">
        <span class="material-symbols-rounded font-16">chevron_left</span>
        <span class="title-crumb">{{ $t('title.campaignList') }}</span>
      </router-link>
      <DataLoader :isLoading="isLoadingCampaign" :type="'text'" class="title-loader-card" />
      <div class="div-row" :class="isLoadingCampaign ? 'd-none' : ''">
        <h2 class="c-title">{{ isNew ? $t('button.newCampaign') : newCampaign.title }}</h2>
      </div>
    </div>
    <div class="div-column gap-20 w-100">
      <div class="card-container" v-if="!isNew && campaignStatistics">
        <DataLoader
          v-for="i in skeletonCount"
          :isLoading="isLoadingCampaign"
          :type="'image'"
          class="data-loader-card"
          :key="i"
        />
        <div
          class="div-column gap-15 statistics-card"
          :class="isLoadingCampaign ? 'd-none' : ''"
          v-for="(value, key) in getFilteredStatistics(campaignStatistics.general)"
          :key="key"
        >
          <div class="div-row gap-10 align-items-center">
            <img v-if="key === 'bounce'" :src="getIcon(key)" alt="Bounce" />
            <span v-else class="material-symbols-rounded font-20 ds-gray-color">{{ getIcon(key) }}</span>
            <span class="font-14 ds-gray-color text-600 statistic-wrap">{{ `${$t(`datatable.${key}`)}` }}</span>
          </div>
          <div class="div-row gap-5 align-items-baseline" :class="getColor(key)">
            <span class="font-16 text-600">{{ value | formatNumber }}</span>
            <span class="font-14 text-600" v-if="key !== 'delivered'">
              {{ getPercentage(value, campaignStatistics.general.delivered) }}%
            </span>
          </div>
        </div>
      </div>
      <div v-if="isNew" class="div-column gap-10">
        <span class="font-16 ds-gray-color text-600">
          {{ $t('sidebar.settings') }}
        </span>
        <div class="div-row gap-15 background-card mb-0 input-campaign-form w-100">
          <InputDefault
            :name="$t('title.name')"
            :modelValue="newCampaign.title"
            :placeholder="`${$t('input.campaignNameType')}`"
            :max="maxLength"
            :keyInput="'title'"
            :isMaxLength="true"
            class="input-default"
            @updateInput="updateInput"
          />
          <InputDefault
            :name="$t('title.description')"
            :modelValue="newCampaign.description"
            :placeholder="`${$t('input.campaignDescription')}`"
            :max="'40'"
            :keyInput="'description'"
            :isMaxLength="true"
            class="input-default"
            @updateInput="updateInput"
          />
        </div>
      </div>

      <DataLoader
        v-for="i in 3"
        :isLoading="isLoadingCampaign"
        :type="'image'"
        class="data-loader-card div-column gap-15 w-100"
        :key="i"
      />
      <div class="div-column gap-15" :class="isLoadingCampaign ? 'd-none' : ''">
        <WhatComponent
          :campaign="newCampaign"
          :messages="messages"
          :isLoadingImage="isLoadingImage"
          :isNew="isNew"
          :forceOpen="isNew && currentStep === 1"
          @getAllMessages="debounceSearchMessage"
          @nextStep="(info) => fillCampaignContent(info, 'what')"
        />
        <WhoComponent
          :campaign="newCampaign"
          :messages="whoMessages"
          :isNew="isNew"
          :forceOpen="isNew && currentStep === 2"
          @getAllMessages="debounceSearchMessage"
          @nextStep="(info) => fillCampaignContent(info, 'who')"
        />
        <WhenComponent
          :campaign="newCampaign"
          :isNew="isNew"
          :forceOpen="isNew && currentStep === 3"
          @nextStep="(info) => fillCampaignContent(info, 'when')"
        />
      </div>
    </div>
    <ButtonDefault
      :name="isNew ? `${$t('button.create')}` : `${$t('button.saveDraftCampaign')}`"
      type="submit"
      class="btn btn-c btn-lg btn-success btn-success-c float-right justify-content-center save-button"
      :disabled="isSaving"
      @click="createCampaign"
    />
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { CampaignsDto } from '@/modules/campaigns/dtos/campaigns.dto';
import WhatComponent from './components/WhatComponent.vue';
import MessagesService from '@/modules/messages/services/messages.service';
import { debounce } from '@/util/debounce';
import ApiService from '@/services/api.service';
import CampaignsService from '@/services/campaign.service';
import ToastService from '@/services/toast.service';
import WhoComponent from './components/WhoComponent.vue';
import WhenComponent from './components/WhenComponent.vue';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { mapState } from 'vuex';
import { AccountDto } from '../accounts/dtos/account.dto';
import DashboardService from '../dashboard/services/dashboard.service';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { formatDateTz } from '@/util/date';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  providers: [],
  components: {
    ButtonDefault,
    InputDefault,
    WhatComponent,
    WhoComponent,
    WhenComponent,
    DataLoader,
  },
  computed: {
    ...mapState(['currentAccount', 'currentAccountTimezone']),
  },
})
export default class TriggerCampaignCreate extends Vue {
  currentAccountTimezone!: string;
  messagesService = new MessagesService();
  campaignService = new CampaignsService();
  toastService = new ToastService();
  dashboardService = new DashboardService();
  currentAccount!: AccountDto;
  isNew = true;
  newCampaign: CampaignsDto = new CampaignsDto();
  title = '';
  description = '';
  messages: MessageDto[] = [];
  whoMessages: MessageDto[] = [];
  isLoadingImage = false;
  api = new ApiService();
  isSaving = false;
  isNotAvailable = false;
  whatData: any = null;
  whoData: any = null;
  whenData: any = null;
  stepId = 1;
  maxLength!: string;
  campaignStatistics: any = {};
  currentStep = 1;
  isLoadingCampaign = false;

  debouncedValidateName = debounce(() => this.validateCampaignName(), 300);
  debounceSearchMessage = debounce((value: string) => this.getAllMessages(value), 300);

  get skeletonCount() {
    const general = this.campaignStatistics?.general || {};
    return Object.keys(this.getFilteredStatistics(general)).length || 5;
  }

  async beforeMount() {
    this.maxLength = this.currentAccount.isInternal ? '25' : '40';
    if (this.$route.params.id) {
      this.isNew = false;
      this.isLoadingCampaign = true;
      await this.getCampaign();
      this.getCampaignStatistics(this.$route.params.id);
      this.currentStep = 0;
    }
    this.getAllMessages('');
  }

  updateInput(event: never, key: never) {
    this.newCampaign[key] = event;
    if (key === 'title') {
      this.debouncedValidateName();
    }
  }

  async getAllMessages(title: string) {
    try {
      this.isLoadingImage = true;
      const result = await this.messagesService.getMessages({
        title,
        itemsPerPage: 20,
        page: 1,
        type: 'email',
      });
      const messageResult = result?.data?.results;
      this.messages = messageResult.map((message: any) => {
        return {
          id: message.id,
          title: message.title,
          subject: message.subject,
          preview: message.previewText,
          name: message.name,
          from: message.fromName,
          type: message.type,
          content: message.content,
        };
      });
      this.whoMessages = [
        {
          id: 0,
          name: 'any-message',
          title: this.$t('input.anyMessage') as string,
        },
        ...this.messages,
      ];
    } catch (err) {
      console.error(err);
    }
    this.isLoadingImage = false;
  }

  fillCampaignContent(info: any, componentName?: string) {
    if (componentName === 'what') {
      this.whatData = info;
      this.newCampaign.type = info.campaignType;
      this.newCampaign.messageType = info.messageType;

      if (this.isNew) {
        this.currentStep = 2;
      }
    } else if (componentName === 'who') {
      this.whoData = info;

      if (this.isNew) {
        this.currentStep = 3;
      }
    } else if (componentName === 'when') {
      this.whenData = info;
    }
  }

  buildCampaignSteps() {
    if (!this.isNew && this.newCampaign.steps) {
      return this.updateExistingCampaignSteps();
    }
    return this.buildNewCampaignSteps();
  }

  updateExistingCampaignSteps() {
    if (!this.whatData && !this.whoData && !this.whenData) {
      return this.newCampaign.steps;
    }

    const updatedSteps = { ...this.newCampaign.steps };

    if (this.whoData) {
      updatedSteps.settings = this.buildTriggerSettings(this.whoData);
    }

    if (this.whatData) {
      this.newCampaign.type = this.whatData.campaignType;
      this.newCampaign.messageType = this.whatData.messageType;
      updatedSteps.child = this.buildMessageSteps();
    } else if (this.whenData) {
      if (this.whenData.type === 'wait') {
        updatedSteps.child = this.updateWaitStepInExisting(updatedSteps.child);
      } else if (this.whenData.type === 'afterEvent') {
        updatedSteps.child = this.removeWaitStepFromExisting(updatedSteps.child);
      }
    }

    return updatedSteps;
  }

  buildNewCampaignSteps() {
    if (!this.whatData || !this.whoData) {
      return null;
    }

    this.stepId = 3;
    const childSteps = this.buildMessageSteps();

    const triggerStep = {
      id: 1,
      type: 'trigger',
      settings: this.buildTriggerSettings(this.whoData),
      child: childSteps,
    };
    return triggerStep;
  }

  buildTriggerSettings(whoData: any) {
    return {
      id: whoData.id || 0,
      name: whoData.name,
      title: whoData.title,
      type: whoData.type,
      ...(whoData.eventType && { eventType: whoData.eventType }),
      ...(whoData.customEvent && { ...whoData.customEvent }),
      applyFrequency: whoData.applyFrequency,
      timePeriod: whoData.timePeriod,
      typeMultiply: whoData.typeMultiply,
      conditional: whoData.conditional,
    };
  }

  buildMessageSteps() {
    let childSteps;

    if (this.whatData.messages.length > 1) {
      childSteps = [
        {
          id: this.stepId++,
          type: 'randomMessage',
          settings: {
            messages: this.whatData.messages.map((message: any) => this.formatMessageData(message)),
          },
          child: [{ id: 2, type: 'end', settings: {}, child: [] }],
        },
      ];
    } else {
      const message = this.whatData.messages[0];
      childSteps = [
        {
          id: this.stepId++,
          type: 'email',
          settings: this.formatMessageData(message),
          child: [{ id: 2, type: 'end', settings: {}, child: [] }],
        },
      ];
    }

    if (this.whenData && this.whenData.type === 'wait') {
      childSteps = [
        {
          id: this.stepId++,
          type: 'wait',
          settings: this.whenData.settings,
          child: childSteps,
        },
      ];
    }

    return childSteps;
  }

  formatMessageData(message: any) {
    return {
      id: message.id,
      title: message.title,
      subject: message.subject,
      name: message.name,
      links: message.links || [],
    };
  }

  updateWaitStepInExisting(existingChild: any[]) {
    let hasWait = false;
    let lastId = 1;
    const findAndUpdateWaitStep = (steps: any[]): any[] => {
      const stepsMap = steps.map((step) => {
        if (step.id > lastId) {
          lastId = step.id + 1;
        }
        if (step.type === 'wait') {
          hasWait = true;
          return {
            ...step,
            settings: this.whenData.settings,
          };
        } else if (step.child && Array.isArray(step.child)) {
          return {
            ...step,
            child: findAndUpdateWaitStep(step.child),
          };
        }
        return step;
      });
      return stepsMap;
    };

    if (!existingChild) {
      return existingChild;
    }

    const formatedWait = findAndUpdateWaitStep(existingChild);
    if (!hasWait) {
      return [
        {
          id: lastId + 1,
          ...this.whenData,
          child: JSON.parse(JSON.stringify(formatedWait)),
        },
      ];
    }

    return formatedWait;
  }

  removeWaitStepFromExisting(existingChild: any[]) {
    if (!existingChild || !Array.isArray(existingChild)) {
      return existingChild;
    }

    const removeWaitStep = (steps: any[]): any[] => {
      return steps.reduce((acc: any[], step: any) => {
        if (step.type === 'wait') {
          if (step.child && Array.isArray(step.child)) {
            acc.push(...removeWaitStep(step.child));
          }
        } else {
          const processedStep = { ...step };
          if (step.child && Array.isArray(step.child)) {
            processedStep.child = removeWaitStep(step.child);
          }
          acc.push(processedStep);
        }
        return acc;
      }, []);
    };

    return removeWaitStep(existingChild);
  }

  async createCampaign() {
    try {
      const api = await this.api.getApi();
      this.isSaving = true;

      const steps = this.buildCampaignSteps();
      if (!steps) {
        this.toastService.show({
          type: 'error',
          text: this.$t('toast.completeSteps') as string,
        });
        this.isSaving = false;
        return;
      }

      this.newCampaign.steps = steps;
      this.newCampaign.scheduleTo = dayjs().endOf('day').toDate();

      await api({
        method: this.isNew ? 'POST' : 'PUT',
        url: 'campaigns',
        data: this.newCampaign,
      });

      this.$router.push({ name: 'list-trigger-campaign' });
      this.toastService.show({
        type: 'success',
        text: this.isNew ? (this.$t('modal.campaignCreated') as string) : (this.$t('modal.campaignChanged') as string),
      });
    } catch (err) {
      console.error(err);
      this.isSaving = false;
    }
  }

  async validateCampaignName() {
    try {
      if (this.newCampaign.title === undefined || this.newCampaign.title.length < 3) {
        return;
      }

      const { data } = await this.campaignService.checkAvailableName(this.newCampaign.title, this.newCampaign.id);

      if (!data || data.length === 0) {
        this.isNotAvailable = false;
      } else {
        this.isNotAvailable = true;
      }
    } catch (error) {
      console.error('Error checking campaign title:', error);
      return false;
    }
  }

  async getCampaign() {
    try {
      const api = await this.api.getApi();
      const { data } = await api.get(`campaigns/${this.$route.params.id}`);
      this.newCampaign = data;
    } catch (error) {
      console.error('Error getting campaign:', error);
    }
  }

  async getCampaignStatistics(campaignId: string) {
    const tz = this.currentAccountTimezone || 'UTC';
    const startDate = formatDateTz(this.newCampaign?.createdAt || new Date(), tz);
    const endDate = dayjs().tz(tz).format('YYYY-MM-DD');
    try {
      const statisticsCampaign = await this.dashboardService.getDashboardData(
        startDate,
        endDate,
        { campaigns: [campaignId], type: this.newCampaign.messageType },
        `/statistics/email`
      );
      this.campaignStatistics = statisticsCampaign.data;
    } catch (err) {
      console.error('Error fetching campaign statistics:', err);
      this.campaignStatistics = {};
    } finally {
      this.isLoadingCampaign = false;
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

  getIcon(key: string) {
    switch (key) {
      case 'delivered':
        return 'email';
      case 'open':
        return 'drafts';
      case 'click':
        return 'web_traffic';
      case 'bounce':
        return require('@/assets/bounce-icon.svg');
      case 'unsubscribe':
        return 'unsubscribe';
    }
  }

  getColor(key: string) {
    switch (key) {
      case 'delivered':
        return 'ds-blue-color';
      case 'open':
        return 'ds-green-color';
      case 'click':
        return 'ds-cyan-color';
      case 'bounce':
        return 'ds-orange-color';
      case 'unsubscribe':
        return 'ds-red-color';
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.view-trigger-campaign {
  padding: 0px 15px;
}

.campaign-title {
  margin-top: -24px;
  display: flex;
  flex-direction: column;
  padding-left: 1em;
}

.input-campaign-form {
  padding: 20px;
}

.input-default {
  width: 280px;
}

.campaign-what {
  border-bottom: 1px solid $ds-gray-200;
}

.save-button {
  place-self: flex-end;
}

.card-container {
  gap: 15px;
  flex-wrap: wrap;
  justify-content: flex-start;
  display: flex;
}

.statistics-card {
  background-color: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  justify-content: space-between;
  flex-grow: 1;
  flex-basis: calc(20% - 15px);
}

.title-loader-card {
  width: 200px;
  height: fit-content;
}

.data-loader-card {
  flex-basis: calc(20% - 15px);
}

::v-deep .v-skeleton-loader__text {
  margin: 0 !important;
}

::v-deep .v-skeleton-loader {
  border-radius: 16px !important;
}

::v-deep .v-skeleton-loader__image {
  height: 100px !important;
}
</style>
