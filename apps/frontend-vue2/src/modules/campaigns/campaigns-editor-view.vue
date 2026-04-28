<template>
  <div class="view-edit-campaign">
    <template v-if="!isNew && newCampaign.status > 1">
      <ProcessCampaign :newCampaign="newCampaign" :tags="tags" :contactsTotal="contactsTotal" />
    </template>
    <template v-else>
      <div class="edit-title campaign-title">
        <router-link to="/campaigns" class="clickable-breadcrumb">
          <span class="material-symbols-rounded font-16">chevron_left</span>
          <span class="title-crumb">{{ $t('title.campaignList') }}</span>
        </router-link>
        <div class="edit-title">
          <h2 class="c-title">{{ definedTitle() }}</h2>
        </div>
      </div>
      <div class="w-100" v-if="canEdit(newCampaign.status)">
        <v-alert outlined type="warning" prominent border="left" icon="mdi-alert-outline">
          {{ alertMessage }}
        </v-alert>
      </div>

      <StepButtonComponent
        :currentStep="currentStepRegister.index"
        :items="stepsRegister"
        @changeStep="changeStepRegister"
      />
      <form class="col-12" @submit.prevent="saveButton">
        <SettingsStep
          v-if="currentStepRegister.name == stepsRegisterType.SETTINGS"
          :newCampaign="newCampaign"
          :disableSimple="disableSimple"
          :isNotAvailable="isNotAvailable"
          @updateInput="updateInput"
          :isCampaignRule="false"
          @selectLabels="selectLabels"
        ></SettingsStep>
        <AudienceStep
          v-if="currentStepRegister.name == stepsRegisterType.AUDIENCE"
          :newCampaign="newCampaign"
          :steps="newCampaign.steps"
          :tags="tags"
          @addStep="addStep"
          @addCard="addCard"
          @removeCard="removeCard"
          @removeStep="removeStep"
          @copyCard="copyCard"
          @updateStep="updateStep"
          @updateCard="updateCard"
          @updateInput="updateInput"
          @selectTag="countContacts"
        ></AudienceStep>
        <ContentStep
          v-if="currentStepRegister.name == stepsRegisterType.CONTENT"
          :campaignType="newCampaign.type"
          :messageType="newCampaign.messageType"
          :messages="newCampaign.campaignMessage"
          @addMessage="addMessage"
          @changeMessageStep="changeMessageStep"
          @removeCardMessage="removeCardMessage"
        ></ContentStep>
        <ScheduleStep
          v-if="currentStepRegister.name == stepsRegisterType.SCHEDULE && newCampaign.type !== 'recurring'"
          :newCampaign="newCampaign"
          @updateInput="updateInput"
          :isCampaignRule="false"
        ></ScheduleStep>
        <RecurringStep
          v-if="currentStepRegister.name == stepsRegisterType.SCHEDULE && newCampaign.type === 'recurring'"
          :newCampaign="newCampaign"
          @updateInput="updateInput"
          @updateObjectInput="updateObjectInput"
          :isCampaignRule="false"
        ></RecurringStep>
        <RevisionStep
          v-if="currentStepRegister.name == stepsRegisterType.REVISION"
          :newCampaign="newCampaign"
          :tags="tags"
          :contactsTotal="contactsTotal"
          @selectTag="countContacts"
          :isCampaignRule="false"
        ></RevisionStep>
        <div class="footer-buttons mt-7">
          <div class="flex">
            <button class="cancel-button" type="button" @click="$router.push('/campaigns')">
              {{ $t('button.cancel') }}
            </button>
          </div>
          <button
            v-if="isNew || (currentStepRegister.index === 4 && newCampaign.status === statusCampaign.Draft)"
            class="draft-button"
            type="button"
            :disabled="isSaving"
            @click="saveDraftCampaign()"
          >
            {{ $t('button.saveDraftCampaign') }}
          </button>
          <ButtonDefault
            :name="
              currentStepRegister.index !== 4
                ? `${$t('button.advance')}`
                : isNew
                ? `${$t('button.create')}`
                : `${$t('button.save')}`
            "
            type="submit"
            class="btn btn-c btn-lg btn-success btn-success-c float-right"
            :disabled="isSaving || canEdit(newCampaign.status)"
          ></ButtonDefault>
        </div>
      </form>
    </template>
  </div>
</template>

<script lang="ts">
import { AxiosError } from 'axios';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import LoadingService from '@/services/loading.service';
import {
  CampaignsType,
  StatusCampaignEnum,
  CampaignRecurrenceFrequency,
} from '@/modules/campaigns/enums/campaign.enum';
import ApiService from '@/services/api.service';
import ToastService from '@/services/toast.service';
import ModalService from '@/services/modal.service';
import CampaignService from '@/services/campaign.service';
import { TagDto } from '@/modules/tags/dtos/tag.dto';
import ButtonDefault from '@/components/button/ButtonDefault.vue';

import StepButtonComponent from '@/components/step-button/StepButtonComponent.vue';
import TagService from '../tags/services/tag.service';
import { StepsRegisterType, CampaignMessageType } from './enums/campaign.enum';
import { CampaignsDto } from './dtos/campaigns.dto';

import SettingsStep from './steps/settings-step.vue';
import AudienceStep from './steps/audience-step.vue';
import RevisionStep from './steps/revision-step.vue';
import ContentStep from './steps/content-step.vue';
import ScheduleStep from './steps/schedule-step.vue';
import RecurringStep from './steps/recurring-step.vue';
import ProcessCampaign from './steps/process-campaign.vue';
import { mapState } from 'vuex';
import { getAccountConfig } from '@/store';
import { debounce } from '@/util/debounce';
import { AccountDto } from '../accounts/dtos/account.dto';
import { LabelDto } from '@/modules/labels/dtos/label.dto';
import { replaceSpecialChars } from '@/util/characters';
import { LabelContentDto } from '@/modules/labels/dtos/labelContent.dto';

@Component({
  name: 'CampaignsEditor',
  providers: [LoadingService],
  components: {
    ButtonDefault,
    StepButtonComponent,
    SettingsStep,
    AudienceStep,
    ContentStep,
    ProcessCampaign,
    RevisionStep,
    ScheduleStep,
    RecurringStep,
  },
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class CampaignsEditor extends Vue {
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();
  private readonly modalService = new ModalService();
  private readonly campaignService = new CampaignService();
  private api = new ApiService();
  private tagService = new TagService();
  public currentAccount!: AccountDto;

  @Prop([Number]) readonly id!: number;

  public stepsRegisterType = StepsRegisterType;

  stepsRegister = [
    { name: StepsRegisterType.SETTINGS, value: this.$t('button.general') },
    { name: StepsRegisterType.AUDIENCE, value: this.$t('datatable.audience') },
    { name: StepsRegisterType.CONTENT, value: this.$t('create.content') },
    { name: StepsRegisterType.SCHEDULE, value: this.$t('sidebar.settings') },
    { name: StepsRegisterType.REVISION, value: this.$t('sidebar.revision') },
  ];
  currentStepRegister = { name: StepsRegisterType.SETTINGS, index: 0 };
  tags: TagDto[] = [];
  statusCampaign: any = StatusCampaignEnum;

  newCampaign: CampaignsDto = {} as CampaignsDto;
  message: any = {};
  isNew = true;
  alertMessage = '';
  loading = false;
  keysPressed: { [key: string]: any } = {};
  disableSimple = false;
  isNotAvailable = { title: false, name: false };
  debouncedValidateTitle = debounce(() => this.validateCampaign('title'), 300);
  debouncedValidateName = debounce(() => this.validateCampaign('name'), 300);

  emailSettings: any = {};
  smsSettings: any = {};
  pushSettings: any = {};
  wppSettings: any = {};
  contactsTotal = null;
  campaignDraft = false;
  isSaving = false;

  async beforeMount() {
    this.emailSettings = JSON.parse(getAccountConfig(this.currentAccount, 'email_settings')) || {};
    this.smsSettings = JSON.parse(getAccountConfig(this.currentAccount, 'sms_settings')) || {};
    this.pushSettings = JSON.parse(getAccountConfig(this.currentAccount, 'webpush_settings')) || {};
    this.wppSettings = JSON.parse(getAccountConfig(this.currentAccount, 'whatsapp_settings')) || {};

    if (this.id) {
      this.isNew = false;
      this.loadingService.show();
      const data = await this.getCampaign(this.id);
      this.newCampaign = this.parseCampaign(data);

      this.loadLabelContent();

      if (!this.newCampaign) {
        this.loadingService.hide();
        this.$router.push({ name: 'news-campaigns' });
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.campaignNotFound') as string,
        });
        return;
      }
      this.alertMessage = `${this.$t('warning.cannotEditCampaignWithStatus') as string} "${this.pipeStatusCampaign(
        this.newCampaign.status
      )}"`;
      this.loadingService.hide();
    } else {
      this.newCampaign = new CampaignsDto();

      switch (true) {
        case this.emailSettings.isActive === true:
          this.newCampaign.messageType = CampaignMessageType.EMAIL;
          break;
        case this.smsSettings.isActive === true:
          this.newCampaign.messageType = CampaignMessageType.SMS;
          break;
        case this.pushSettings.isActive === true:
          this.newCampaign.messageType = CampaignMessageType.WEBPUSH;
          break;
        case this.wppSettings.isActive === true:
          this.newCampaign.messageType = CampaignMessageType.WHATSAPP;
          break;

        default:
          break;
      }

      this.addCard();
      this.addStep('tag', 0);
      this.addMessage();
    }

    await this.getTags();
  }

  mounted() {
    document.addEventListener('keydown', this.captureKeys);
    document.addEventListener('keyup', this.releaseKeys);
  }

  destroyed() {
    document.removeEventListener('keydown', this.captureKeys);
    document.removeEventListener('keyup', this.releaseKeys);
  }

  parseTimeToDateTime(time: string) {
    const [hours, minutes] = time.split(':').map(Number);

    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  }

  async validateCampaign(key: 'title' | 'name') {
    try {
      if (this.newCampaign[key] === undefined || this.newCampaign[key].length < 3) {
        return;
      }

      const { data } = await this.campaignService.checkAvailableName(this.newCampaign[key], this.newCampaign.id, key);

      if (!data || data.length === 0) {
        this.isNotAvailable[key] = false;
      } else {
        this.isNotAvailable[key] = true;
      }
    } catch (error) {
      console.error('Error checking campaign:', key, error);
      return false;
    }
  }

  parseCampaign(campaign: CampaignsDto) {
    if (campaign.type === CampaignsType.RECURRING) {
      const { recurrenceSettings } = campaign;
      campaign.recurrenceSettings = {
        ...campaign.recurrenceSettings,
        date: new Date(recurrenceSettings.date),
        interval: Number(recurrenceSettings.interval),
        hasExpiration: !!recurrenceSettings.hasExpiration,
        untilDate: recurrenceSettings.untilDate ? new Date(recurrenceSettings.untilDate) : null,
        untilSend: recurrenceSettings.untilSend ? Number(recurrenceSettings.untilSend) : null,
        firstSentDate: recurrenceSettings.firstSentDate ? new Date(recurrenceSettings.firstSentDate) : null,
        lastSentDate: recurrenceSettings.lastSentDate ? new Date(recurrenceSettings.lastSentDate) : null,
      };
    }

    campaign.steps = typeof campaign.steps === 'string' ? JSON.parse(campaign.steps) : campaign.steps;

    campaign.campaignMessage = campaign.campaignMessage.map((item: any) => {
      return {
        ...item.message,
        statistics: item.statistics,
        winner: item.winner,
      };
    });

    return campaign;
  }

  hasValidMessages() {
    if (this.newCampaign.campaignMessage.length === 0) {
      return false;
    }

    if (this.newCampaign.type === CampaignsType.SIMPLE && Object.keys(this.newCampaign.campaignMessage[0]).length > 0) {
      return true;
    }

    if (
      !this.newCampaign.campaignMessage.find((x: any) => Object.keys(x).length < 1) &&
      this.newCampaign.campaignMessage.length > 0
    ) {
      return true;
    }

    return false;
  }

  changeStepRegister(key: any, stepRegister: number) {
    this.currentStepRegister = { name: key, index: stepRegister };
  }

  goToPreviousStep() {
    const stepPosition = this.currentStepRegister.index;
    this.changeStepRegister(this.stepsRegister[stepPosition - 1].name, this.currentStepRegister.index - 1);
  }

  isTagValid() {
    if (this.newCampaign.sendToAll === true) {
      return true;
    }

    if (this.newCampaign.steps.length === 0) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.emptyAudience') as string,
      });
      return false;
    }

    for (let i = 0; i < this.newCampaign.steps.length; i++) {
      const step = this.newCampaign.steps[i][i];
      if (step && step.tag_id && step.tag_id.length >= 1) {
        return true;
      }
    }

    this.toastService.show({
      type: 'error',
      text: this.$t('warning.emptyAudience') as string,
    });
    return false;
  }

  async saveButton() {
    const stepPosition = this.currentStepRegister.index;
    if (stepPosition < this.stepsRegister.length - 1) {
      this.changeStepRegister(this.stepsRegister[stepPosition + 1].name, this.currentStepRegister.index + 1);
      return;
    }

    if (!this.isTagValid()) {
      return;
    }

    if (!this.hasValidMessages()) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.emptyMessage') as string,
      });
      return;
    }

    if (!this.isCampaignValid()) {
      return;
    }

    if (!this.checkCampaingDuplicateMessages()) {
      return;
    }

    await this.saveCampaign();
  }

  updateInput(event: never, key: never) {
    this.newCampaign[key] = event;
    if (key === 'title') {
      this.newCampaign.name = replaceSpecialChars(this.newCampaign.title).substring(0, 25);
      this.debouncedValidateTitle();
      this.debouncedValidateName();
    }
    if (key === 'name') {
      this.debouncedValidateName();
    }
  }

  async countContacts() {
    this.contactsTotal = null;
    const isTagValid = this.isTagValid();
    if (this.newCampaign.title === undefined || this.newCampaign.title.length < 3) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.emptyTitle') as string,
      });
      return;
    }
    if (isTagValid) {
      const contacts = (this.contactsTotal = (await this.campaignService.countValidContacts(this.newCampaign)).data);
      this.contactsTotal = contacts.toLocaleString();
      return this.contactsTotal;
    }
  }

  updateObjectInput(event: never, key: never, keyObject: never) {
    if (!this.newCampaign.hasOwnProperty(keyObject) || !this.newCampaign[keyObject]) {
      this.newCampaign[keyObject] = {} as never;
    }
    this.newCampaign[keyObject][key] = event;
  }

  async getCampaign(campaignId: number): Promise<any | null> {
    let campaign: any | null;
    try {
      const api = await this.api.getApi();
      const { data } = await api.get(`campaigns/${campaignId}`);
      campaign = data;
    } catch (e) {
      console.error(e);
      return null;
    }

    return campaign;
  }

  @Watch('newCampaign.messageType')
  checkMessageType(newVal: string, oldVal: string | undefined) {
    if (oldVal === undefined) {
      return;
    }

    if (
      this.newCampaign.messageType !== CampaignMessageType.EMAIL &&
      [CampaignsType.SPLIT, CampaignsType.TESTAB].includes(this.newCampaign.type)
    ) {
      this.newCampaign.type = CampaignsType.SIMPLE;
    }

    if (CampaignMessageType.WEBPUSH === this.newCampaign.messageType) {
      this.newCampaign.spreadSending = 0;
    }

    // reset selected messages
    this.newCampaign.campaignMessage = [{}];
  }

  @Watch('newCampaign.type')
  checkType(newVal: string, oldVal: string | undefined) {
    if (oldVal === undefined) {
      return;
    }

    if (newVal === CampaignsType.SPLIT || newVal === CampaignsType.TESTAB) {
      this.newCampaign.testabScheduleTo = new Date();
      this.newCampaign.scheduleTo = new Date();
      this.newCampaign.testabSentAfterTest = true;
      this.newCampaign.testabAudiencePercent = 10;
      this.newCampaign.testabCriteria = 'open';
    }

    if (newVal === CampaignsType.SIMPLE) {
      this.newCampaign.testabScheduleTo = new Date();
      this.newCampaign.scheduleTo = new Date();
    }
  }

  async getTags() {
    this.loading = true;
    try {
      const status = this.newCampaign.status === this.statusCampaign.Completed ? {} : { status: 'active' };
      this.tags = (await this.tagService.getTags(status)).data;
    } catch (e) {
      throw e;
    } finally {
      this.loading = false;
    }
  }

  isCampaignValid() {
    if (this.newCampaign.campaignMessage.length < 1) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.noMessageSimple') as string,
      });
      return false;
    }

    if (
      this.newCampaign.type !== CampaignsType.SIMPLE &&
      this.newCampaign.type !== CampaignsType.RECURRING &&
      this.newCampaign.campaignMessage.length < 2
    ) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.twoMoreMessages') as string,
      });
      return false;
    }

    if (this.newCampaign.type === CampaignsType.RECURRING) {
      if (
        this.newCampaign.recurrenceCount &&
        this.newCampaign.recurrenceCount < 1 &&
        (this.newCampaign.recurrenceSettings.date === null ||
          this.newCampaign.recurrenceSettings.date === undefined ||
          this.newCampaign.recurrenceSettings.date < new Date())
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignDateError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.interval === undefined ||
        this.newCampaign.recurrenceSettings.interval < 1
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignIntervalError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.frequency === null ||
        this.newCampaign.recurrenceSettings.frequency === undefined
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignFrequencyError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.frequency === CampaignRecurrenceFrequency.WEEKLY &&
        (this.newCampaign.recurrenceSettings.weekDays === undefined ||
          this.newCampaign.recurrenceSettings.weekDays.length < 1)
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignWeekdaysError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.frequency === CampaignRecurrenceFrequency.WEEKLY &&
        this.newCampaign.recurrenceSettings.weekDays !== undefined &&
        !this.newCampaign.recurrenceSettings.weekDays.includes(this.newCampaign.recurrenceSettings.date.getDay())
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignWeekdaysInitialDateError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.hasExpiration &&
        this.newCampaign.recurrenceSettings.untilDate !== undefined &&
        this.newCampaign.recurrenceSettings.untilDate !== null &&
        this.newCampaign.recurrenceSettings.untilDate < this.newCampaign.recurrenceSettings.date
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignUntilDateError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.hasExpiration &&
        !this.newCampaign.recurrenceSettings.untilDate &&
        this.newCampaign.recurrenceSettings.untilSend !== undefined &&
        this.newCampaign.recurrenceSettings.untilSend !== null &&
        this.newCampaign.recurrenceSettings.untilSend < 1
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignUntilSendError') as string,
        });
        return false;
      }
    }

    return true;
  }

  saveDraftCampaign() {
    this.campaignDraft = true;
    this.saveCampaign();
  }

  async saveCampaign() {
    this.newCampaign.status = this.campaignDraft ? StatusCampaignEnum.Draft : StatusCampaignEnum.Scheduled;

    try {
      const api = await this.api.getApi();
      this.isSaving = true;
      await api({
        method: this.isNew ? 'POST' : 'PUT',
        url: 'campaigns',
        data: this.newCampaign,
      });

      this.$router.push({ name: 'news-campaigns' });
      this.toastService.show({
        type: 'success',
        text: this.isNew ? (this.$t('modal.campaignCreated') as string) : (this.$t('modal.campaignChanged') as string),
      });
    } catch (e) {
      const error = e as AxiosError;
      if (error?.response?.data?.statusCode === 409) {
        this.confirmDuplicate(error.response.data.conflict);
      }
      console.error(error);
    } finally {
      this.campaignDraft = false;
      this.isSaving = false;
    }
  }

  extractTime(date: Date) {
    if (!date) {
      return '00:00';
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  stringToDate(date: any): Date {
    const [day, month, year] = date.split('/');
    return new Date(+year, month - 1, +day);
  }

  canEdit(status: number) {
    if (
      !status ||
      status === this.statusCampaign.Pending_Approval ||
      status === this.statusCampaign.Draft ||
      status === this.statusCampaign.Scheduled
    ) {
      return false;
    }
    return true;
  }

  pipeStatusCampaign(campaign: number): string {
    switch (campaign) {
      case StatusCampaignEnum.Sending:
        return 'Enviando...';
      case StatusCampaignEnum.Completed:
        return 'Enviado';
      case StatusCampaignEnum.Stopped:
        return 'Cancelado';
      case StatusCampaignEnum.Paused:
        return 'Parado';
      default:
        return 'Desconhecido';
    }
  }

  addStep(item: string, index: number) {
    this.newCampaign.steps[`${index}`].push({
      type: item,
    });
  }

  addCard() {
    this.newCampaign.steps.push([]);
  }

  addMessage() {
    this.newCampaign.campaignMessage.push({});
    this.checkCampaingMessages();
  }

  checkCampaingMessages() {
    if (this.newCampaign.campaignMessage.length > 1) {
      this.disableSimple = true;
    } else {
      this.disableSimple = false;
    }
  }

  removeCard(index: number) {
    this.newCampaign.steps.splice(index, 1);
  }

  removeStep(indexCard: number, indexStep: number) {
    this.newCampaign.steps[indexCard].splice(indexStep, 1);
  }

  copyCard(index: number, card: any) {
    const cloneCard = JSON.parse(JSON.stringify(card));
    this.newCampaign.steps.splice(index, 0, cloneCard);
    if (this.newCampaign.steps[index].length < 2) {
      this.newCampaign.steps[index + 1][0].isCardCopy = true;
    }
    if (index === 0 && this.newCampaign.steps[index].length > 1) {
      this.newCampaign.steps[index + 1].unshift({
        type: 'conditionalCard',
        value: 'UNION',
      });
    }
  }

  removeCardMessage(index: number) {
    this.newCampaign.campaignMessage.splice(index, 1);
    this.checkCampaingMessages();
  }

  updateStep(indexCard: number, indexStep: number, key: string, value: string | number) {
    this.newCampaign.steps[indexCard][indexStep][key] = value;
  }

  updateCard(key: string, value: string, indexCard: number) {
    if (this.newCampaign.steps[indexCard].length) {
      this.newCampaign.steps[indexCard][0].value = value;
    } else {
      this.newCampaign.steps[indexCard].unshift({
        type: key,
        value,
      });
    }
  }

  checkCampaingDuplicateMessages() {
    if (this.newCampaign.campaignMessage.some((msg: any) => this.checkDuplicateMessage(msg).length > 1)) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.equalMessage') as string,
      });
      return false;
    }
    return true;
  }

  checkDuplicateMessage(message: any) {
    return this.newCampaign.campaignMessage.filter((x: any) => x.id === message.id);
  }

  changeMessageStep(index: number, message: any) {
    this.newCampaign.campaignMessage[index] = { ...message };
  }

  copyEmailID() {
    navigator.clipboard.writeText(`${this.id}`);
  }

  captureKeys(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (event.key === 'Escape') {
      (document.activeElement as HTMLElement).blur();
    }

    if (!/^(?:input|textarea|select)$/i.test(target.tagName)) {
      this.keysPressed[event.key] = true;

      if (this.keysPressed['g'] && event.key === 'n') {
        event.preventDefault();
        this.saveButton();
      }

      if (this.keysPressed['g'] && event.key === 'p') {
        event.preventDefault();
        this.goToPreviousStep();
      }
    }
  }

  releaseKeys(event: KeyboardEvent) {
    setTimeout(() => {
      delete this.keysPressed[event.key];
    }, 500);
  }

  confirmDuplicate(
    conflict: { id: number; schedule_to: string; title: string; tags: { id: number; name: string }[] }[]
  ): void {
    this.toastService.hide();

    let campaignsList = '';
    for (const item of conflict) {
      const date = Vue.filter('formatDateTime')(item.schedule_to);
      const tags = item.tags.map((tag) => tag.name);
      campaignsList += this.$t('modal.campaignDuplicatedDetails', {
        id: item.id,
        title: item.title,
        date,
        tags: tags.join(', '),
      }) as string;
    }

    this.modalService.confirm({
      title: this.$t('modal.campaignDuplicatedTitle') as string,
      text: this.$t('modal.campaignDuplicatedText', { campaignsList }) as string,
      confirmLabel: this.$t('modal.campaignDuplicatedConfirm') as string,
      cancelLabel: this.$t('modal.campaignDuplicatedCancel') as string,
      cancelFunction: this.cancel,
      confirmFunction: this.confirmSave,
      width: 500,
      showClose: true,
      isConfirm: true,
    });
  }

  confirmSave() {
    const newCampaign = this.newCampaign;
    newCampaign.confirmSaveDuplicate = true;
    this.saveCampaign();

    this.$emit('submit', true);
  }

  cancel() {
    this.$emit('cancel', true);
  }

  definedTitle() {
    return this.isNew ? this.$t('button.newCampaign') : this.newCampaign.title || '...';
  }

  selectLabels(labels: LabelDto[]) {
    this.newCampaign.labels = labels;
  }

  loadLabelContent() {
    if (this.newCampaign.labelContent && this.newCampaign.labelContent.length > 0) {
      this.newCampaign.labels = this.newCampaign.labelContent.map((content) => content.label);
    }
  }
}
</script>

<style scoped lang="scss">
.view-edit-campaign {
  padding-top: 1em;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  h2 {
    display: flex;
    width: 100%;
    gap: 2em;

    .campaign-id {
      font-size: 0.7em !important;
      color: gray;
    }
  }
}

.draft-button {
  width: 147px;
  height: 36px;
  border-radius: 8px;
  border: 2px solid #0057f4;
  font-size: 12px;
  font-weight: 700;
  line-height: 12px;
  letter-spacing: 0.07em;
  color: #0057f4;
  text-transform: uppercase;
}
.edit-title {
  display: flex;
  flex-direction: row;
  font-size: 0.7rem !important;
}
.copy-icon {
  height: 19px;
  margin-top: -3px;
}
.campaign-title {
  margin-top: -24px;
  display: flex;
  flex-direction: column;
  padding-left: 1em;
}
</style>
