<template>
  <div class="view-campaign-revision-step mt-2 w-100">
    <h5 v-if="!isTemplateCampaign" class="title-campaign">{{ $t('button.general') }}</h5>
    <v-card v-if="!isTemplateCampaign">
      <div class="name">
        <label class="label-title-campaign">{{ $t('title.name') }}</label>
        <h6 class="text-info-revision">{{ newCampaign.title }}</h6>
        <label v-if="currentAccount.isInternal" class="label-title-campaign mt-1">{{ $t('title.utmCampaign') }}</label>
        <h6 v-if="currentAccount.isInternal" class="text-info-revision">{{ newCampaign.name }}</h6>
        <label class="label-title-desc-campaign mt-1">{{ $t('create.description') }}</label>
        <h6 class="text-description">{{ newCampaign.description }}</h6>
      </div>
    </v-card>

    <h5 class="title-campaign" :class="[isTemplateCampaign ? 'mt-0' : '']">{{ $t('datatable.audience') }}</h5>
    <v-card>
      <div class="tags">
        <v-radio-group v-if="newCampaign.sendToAll" v-model="newCampaign.sendToAll">
          <v-radio :value="true">
            <template v-slot:label>
              <div>{{ $t('create.campaignSendToAll') }}</div>
            </template>
          </v-radio>
        </v-radio-group>
        <fieldset v-else>
          <div class="container-selected" v-for="(card, index) in newCampaign.steps" :key="`card-${index}`">
            <template v-if="newCampaign.steps.length > 1 && (index || index == newCampaign.steps.length - 1)">
              <LineComponent :type="'horizontal'" />
              <SelectConditionalComponent
                :indexCard="index"
                :items="selectConditionalValues"
                :conditionalName="'conditionalCard'"
                :value="getValueConditionalCard(card)"
                :disabled="true"
              />
              <LineComponent :type="'horizontal'" />
            </template>
            <div class="cards-segment d-flex mb-5 pl-3 pr-5">
              <section v-for="(step, indexStep) in card" :key="step.index" class="d-flex section">
                <template v-if="step.type !== 'conditionalCard'">
                  <div
                    class="step"
                    :class="
                      indexStep === 0 || (indexStep === 1 && card[indexStep - 1].type === 'conditionalCard')
                        ? 'first-step'
                        : ''
                    "
                  >
                    <div
                      v-if="
                        indexStep > 0 && card[indexStep - 1]
                          ? (card.length > 1 && card[indexStep - 1].type !== 'conditionalCard') ||
                            (card.length > 2 && card[indexStep - 1].type === 'conditionalCard')
                          : card.length > 1
                      "
                      class="vertical-line"
                      :class="[
                        indexStep === 0 ? 'first-vertical-line' : '',
                        index > 0 ? 'not-first-card' : '',
                        !card[indexStep + 1] ? 'last-vertical-line' : '',
                        indexStep === 1 && card[indexStep - 1].type === 'conditionalCard'
                          ? 'first-line-after-conditinal'
                          : '',
                      ]"
                    ></div>
                    <StepsComponent
                      :step="step"
                      :indexStep="indexStep"
                      :indexCard="index"
                      :tags="tags"
                      :dontShowFirstLine="
                        card[indexStep - 1]
                          ? card.length < 2 || (card.length < 3 && card[indexStep - 1].type === 'conditionalCard')
                          : card.length < 2
                      "
                      :selectConditionalValues="selectConditionalValues"
                      :disabled="true"
                      class="pb-1"
                    />
                  </div>
                </template>
              </section>
            </div>
          </div>
        </fieldset>
      </div>
    </v-card>

    <h5 v-if="!isCampaignRule && !isTemplateCampaign" class="title-campaign">{{ $t('create.content') }}</h5>
    <span class="alert-bms" v-if="isInvalidTestAbMessages() && !isCampaignRule && !isTemplateCampaign">
      <span class="material-symbols-rounded font-24"> info </span> {{ $t('datatable.needOneMessageTestAb') }}</span
    >
    <div v-if="!isCampaignRule && !isTemplateCampaign" class="d-flex flex-wrap">
      <v-card class="mx-1 mt-2 messages-card" v-for="(message, index) in newCampaign.campaignMessage" :key="message.id">
        <div class="actions-card actions-card-icons text-end">
          <button
            v-tooltip.top="$t('button.viewMessage')"
            @click="openMessagePreview(index)"
            class="button-align icons-hover mr-2"
            type="button"
          >
            <span class="material-symbols-rounded font-24">visibility</span>
          </button>
        </div>
        <h6 class="title-content mb-4">
          {{ $t('datatable.message') }} {{ alphabetCode(index + 1) }}: {{ message.title }}
        </h6>
        <div v-if="newCampaign.messageType === campaignMessageType.WEBPUSH">
          <p class="subject-content">{{ $t('datatable.subject') }}: {{ message.subject }}</p>
          <p>{{ $t('create.content') }}: {{ message.content }}</p>
        </div>
        <div v-else-if="newCampaign.messageType === campaignMessageType.SMS">
          <p class="subject-content">{{ $t('datatable.sender') }}: {{ currentAccount.name }}</p>
          <p class="desc-content">{{ $t('create.content') }}: {{ message.content }}</p>
        </div>
        <div v-else-if="newCampaign.messageType === campaignMessageType.WHATSAPP">
          <p class="subject-content">{{ $t('datatable.sender') }}: {{ currentAccount.name }}</p>
          <p class="desc-content">{{ $t('create.content') }}: {{ getMessageContent(message.content).body }}</p>
        </div>
        <div v-else-if="newCampaign.messageType === campaignMessageType.MOBILEPUSH">
          <p class="subject-content">{{ $t('datatable.sender') }}: {{ message.subject }}</p>
          <p class="desc-content">{{ $t('create.content') }}: {{ message.content }}</p>
        </div>
        <div v-else>
          <p class="subject-content">{{ $t('create.subject') }}: {{ message.subject }}</p>
          <p class="desc-content">{{ $t('datatable.sender') }}: {{ message.fromName }} {{ message.fromMail }}</p>
        </div>
      </v-card>
    </div>
    <div class="d-flex justify-space-between align-center ml-0 mt-1"></div>
    <v-col md="12" class="p-0" v-if="newCampaign.type === campaignsType.TESTAB">
      <h5 class="title-campaign">{{ $t('title.settings') }}</h5>
      <v-card>
        <v-row no-gutters>
          <v-col md="auto" class="mr-5 campaign-height-bms">
            <div class="div-column gap-5">
              <label class="subject-content">{{ $t('datatable.winnerCriteria') }}</label>
              <p v-if="newCampaign.testabCriteria === 'open'">{{ $t('input.openRate') }}</p>
              <p v-if="newCampaign.testabCriteria === 'click'">{{ $t('input.clickRate') }}</p>
            </div>
          </v-col>

          <v-col md="6" class="separator-bms campaign-height-bms">
            <div class="div-column margins-bms">
              <label class="subject-content">{{ $t('create.testSample') }}</label>
              <div class="div-row">
                <v-col
                  v-for="(message, index) in newCampaign.campaignMessage"
                  :key="`revision-message${index}`"
                  md="auto"
                >
                  <label v-if="newCampaign.campaignMessage.length >= 1" class="message-title-testab">
                    {{ $t('datatable.message') }} {{ alphabetCode(index + 1) }}:
                    <b>{{ (newCampaign.testabAudiencePercent / newCampaign.campaignMessage.length).toFixed(1) }}%</b>
                  </label>
                </v-col>

                <v-col md="auto">
                  <label v-if="newCampaign.campaignMessage.length >= 1" class="message-title-testab">
                    {{ $t('title.messageWinner') }}: <b>{{ 100 - newCampaign.testabAudiencePercent }}%</b>
                  </label>
                </v-col>
              </div>
            </div>
          </v-col>
        </v-row>
        <v-row no-gutters>
          <v-col class="mr-5 mt-5 campaign-height-bms" md="auto">
            <div class="div-column gap-5">
              <label class="subject-content">{{ $t('datatable.testSchedule') }}</label>
              <p>
                {{ $t('title.day') }}
                {{ getFormattedDate(newCampaign.testabScheduleTo) }}
                {{ $t('datatable.startAt') }}
                {{ newCampaign.testabScheduleTo | formatTime }}
              </p>
            </div>
          </v-col>

          <v-col md="auto" class="separator-bms mt-5 campaign-height-bms" v-if="newCampaign.testabSentAfterTest">
            <div class="div-column gap-5 margins-bms">
              <label class="subject-content">{{ $t('datatable.scheduleSendWinnerMessage') }}</label>
              <p>
                {{ $t('title.day') }}
                {{ getFormattedDate(newCampaign.scheduleTo) }}
                {{ $t('datatable.startAt') }}
                {{ newCampaign.scheduleTo | formatTime }}
              </p>
            </div>
          </v-col>
        </v-row>
      </v-card>
    </v-col>
    <v-col md="12" class="p-0" v-else>
      <h5 class="title-campaign">{{ $t('title.settings') }}</h5>
      <v-card>
        <v-row no-gutters>
          <v-col md="auto" class="mr-5">
            <div class="div-column gap-5">
              <label class="subject-content">{{ $t('datatable.sendCampaign') }}</label>
              <p>
                {{ $t('title.day') }}
                {{ getFormattedDate(newCampaign.scheduleTo) }}
                {{ $t('datatable.startAt') }}
                {{ newCampaign.scheduleTo | formatTime }}
              </p>

              <label class="subject-content">{{ $t('input.sendDistribute') }}</label>
              <p class="mb-0">{{ getTimeName(newCampaign.spreadSending) }}</p>
            </div>
          </v-col>
        </v-row>
      </v-card>
    </v-col>

    <v-dialog v-model="showMessagePreview">
      <MessagePreview
        :message="newCampaign.campaignMessage"
        :type="newCampaign.type"
        :messageIndex="messageIndex"
        @closeMessagePreview="closeMessagePreview"
      />
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import SelectConditionalComponent from '@/components/conditional-steps/SelectConditionalComponent.vue';
import StepsComponent from '@/components/conditional-steps/StepsComponent.vue';
import AddStepComponent from '@/components/conditional-steps/AddStepComponent.vue';
import LineComponent from '@/components/conditional-steps/LineComponent.vue';
import ModalService from '@/services/modal.service';
import { CampaignsType, CampaignMessageType, CampaignRecurrenceFrequency } from '../enums/campaign.enum';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import MessagePreview from '@/components/common/MessagePreview.vue';
import { CampaignsDto } from '../dtos/campaigns.dto';

@Component({
  components: {
    AddStepComponent,
    LineComponent,
    SelectConditionalComponent,
    StepsComponent,
    MessagePreview,
  },
  props: ['newCampaign', 'tags', 'contactsTotal', 'selectTag', 'message', 'isCampaignRule', 'isTemplateCampaign'],
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class RevisionStep extends Vue {
  @Prop() public newCampaign!: CampaignsDto;
  @Prop() public tags!: [any];
  @Prop() public contactsTotal!: any;
  @Prop() public selectTag!: string;
  @Prop() public isCampaignRule!: boolean;
  @Prop() public isTemplateCampaign!: boolean;

  private readonly modalService = new ModalService();
  public currentAccount!: AccountDto;
  public campaignsType = CampaignsType;
  public campaignMessageType = CampaignMessageType;
  public campaignRecurrenceFrequency = CampaignRecurrenceFrequency;
  selectConditionalValues = [
    { name: 'EXCEPT', value: this.$t('title.notInclude') },
    { name: 'UNION', value: this.$t('title.include') },
  ];
  messagePreview: any = [];
  messageType!: CampaignMessageType;
  imageData = '';
  showMessagePreview = false;
  messageIndex = -1;
  times = [
    { value: 10, name: '10 ' + this.$t('title.minute') + 's' },
    { value: 30, name: '30 ' + this.$t('title.minute') + 's' },
    { value: 60, name: '60 ' + this.$t('title.minute') + 's' },
    { value: 90, name: '1 ' + this.$t('title.hour') + ' 30 ' + this.$t('title.minute') + 's' },
    { value: 120, name: '2 ' + this.$t('title.hour') + 's' },
    { value: 150, name: '2 ' + this.$t('title.hour') + 's' + ' 30 ' + this.$t('title.minute') + 's' },
    { value: 180, name: '3 ' + this.$t('title.hour') + 's' },
    { value: 240, name: '4 ' + this.$t('title.hour') + 's' },
    { value: 300, name: '5 ' + this.$t('title.hour') + 's' },
    { value: 360, name: '6 ' + this.$t('title.hour') + 's' },
    { value: 420, name: '7 ' + this.$t('title.hour') + 's' },
    { value: 480, name: '8 ' + this.$t('title.hour') + 's' },
    { value: 540, name: '9 ' + this.$t('title.hour') + 's' },
    { value: 600, name: '10 ' + this.$t('title.hour') + 's' },
    { value: 660, name: '11 ' + this.$t('title.hour') + 's' },
    { value: 720, name: '12 ' + this.$t('title.hour') + 's' },
    { value: 1060, name: '18 ' + this.$t('title.hour') + 's' },
    { value: 1440, name: '24 ' + this.$t('title.hour') + 's' },
    { value: 0, name: this.$t('title.noInterval') },
  ];

  beforeMount() {
    this.messageType = this.newCampaign.messageType;
  }

  openMessagePreview(index: number) {
    this.messageIndex = index;
    this.showMessagePreview = true;
  }

  closeMessagePreview() {
    this.showMessagePreview = false;
  }

  isInvalidTestAbMessages() {
    return (
      this.newCampaign.type === CampaignsType.TESTAB &&
      this.newCampaign.campaignMessage.filter((obj: any) => obj.id !== undefined).length < 2
    );
  }

  calculateTimeFromSlider(value: number): number {
    let calculatedValue = value;
    const multiply = (value - 180) / 30;
    switch (true) {
      case value >= 210 && value < 480:
        calculatedValue = value + 30 * multiply;
        break;
      case value === 480:
        calculatedValue = 1080;
        break;
      case value === 510:
        calculatedValue = 1440;
        break;
      default:
        calculatedValue = value;
        break;
    }

    return calculatedValue;
  }

  alphabetCode(path: number) {
    return String.fromCharCode(path + 64);
  }

  parseSpreadValue(value: number) {
    value = this.calculateTimeFromSlider(value);

    const hours = Math.floor(value / 60);
    if (value % 60 !== 0) {
      const minutes = value % 60;
      return hours ? `${hours}h${minutes}m` : `${minutes}m`;
    }
    return `${hours}h`;
  }

  getValueConditionalCard(card: any) {
    if (card.length && card[0].type === 'conditionalCard') {
      return card[0].value;
    }
    return 'UNION';
  }

  get campaignConfigs() {
    const frequencyNumbers = {
      day: 1,
      week: 2,
      month: 3,
    };

    const daysNumbers = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const frequencyKey = (Object.keys(frequencyNumbers) as (keyof typeof frequencyNumbers)[]).find(
      (key) => frequencyNumbers[key] === this.newCampaign.recurrenceSettings.frequency
    );

    return {
      ...this.newCampaign.recurrenceSettings,
      frequencyName: this.newCampaign.recurrenceSettings.frequency
        ? this.$t(
            `input.${
              this.newCampaign.recurrenceSettings.interval > 1
                ? frequencyKey?.toString() + 's'
                : frequencyKey?.toString()
            }`
          )
        : '',
      weekDays: this.newCampaign.recurrenceSettings.weekDays?.map((day: number) =>
        this.$t(`input.${Object.keys(daysNumbers)[day]}`)
      ),
    };
  }

  getTimeName(value: number) {
    const timeObj = this.times.find((time) => time.value === Number(value));
    return timeObj ? timeObj.name : 'Valor não encontrado';
  }

  getMessageContent(content: string) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }

  getFormattedDate(date: string) {
    return !this.isCampaignRule ? Vue.filter('formatDate')(date) : this.$t('input.selectedDay');
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.div-icon {
  position: absolute;
  margin-top: 20px;
  margin-left: -525px;
  height: 27px;
  width: 27px;
  border-radius: 14px;
  background-color: $ds-blue;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-send {
  font-size: 15px;
}
.align-center {
  display: flex;
  align-items: center;
  margin-left: 8px;
}
.preview-windows {
  box-shadow: 0px 1px 2px rgb(0 0 0 / 6%), 0px 1px 3px rgb(0 0 0 / 10%);
  display: flex;
  flex-direction: row;
  height: fit-content;
}
.preview-android {
  border-radius: 10px;
}
.preview-message-bms {
  width: 556px !important;
  height: auto !important;
  padding: 20px !important;
  border-radius: 16px !important;
  gap: 16px !important;
  box-shadow: 0px 4px 6px 0px #0000001a !important;
  box-shadow: 0px 2px 4px 0px #0000000f !important;
}
.chrome-icon {
  height: 15px;
  width: 18px;
}
.message-android {
  color: #6b6b6b !important;
  font-size: 10px;
  font-weight: 200;
}
.icon-preview-windows {
  max-width: 150px;
  height: auto;
}
::v-deep .v-dialog {
  width: fit-content !important;
  border-radius: 16px;
  box-shadow: none;
}
.icon-preview-android {
  height: 75px;
  width: 80px;
}
.text-color {
  padding: 2px;
  margin: 0px !important;
  font-size: 12px;
  width: 250px;
  font-weight: 600;
}
.text-color-content {
  margin: 0px !important;
  padding: 2px;
  font-size: 12px;
  height: 30px;
  overflow: hidden;
}
.link-color {
  color: #c0c0c0 !important;
  height: 20px !important;
}

.chrome-title {
  height: 20px !important;
  align-self: flex-end;
}
.align-title {
  text-align: center;
  font-weight: 600;
}

.button-align {
  align-items: center;
}
.title-message {
  position: absolute;
  margin-top: -22px;
  margin-left: 8px;
  font-weight: 600;
  font-size: 14px;
  line-height: 18.2px;
  color: #0057f4;
  z-index: 1 !important;
}
.title-message-empty {
  font-size: 14px;
  font-weight: 600;
  line-height: 18.2px;
  margin-left: 8px;
  color: #0057f4;
}
.content-text-message {
  margin-top: 10px;
  margin-left: 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 15.6px;
  color: #5c5c5c;
}

.content-subtext-message {
  margin-top: -12px;
  margin-left: 8px;
  font-size: 10px;
  font-weight: 400;
  line-height: 13px;
  color: #5c5c5c;
}
.message-form {
  display: flex;
  flex-direction: row;
}
.message-space-between {
  display: flex;
  flex-direction: row;
  gap: 50px;
}
.gap-between {
  gap: 5px;
}
.align-title-android {
  padding-top: 20px;
  align-items: self-start;
}
.modal-preview {
  border-radius: 16px;
  width: 556px;
  height: auto;
  padding: 20px;
}
.message-content-android {
  max-width: 300px;
  max-height: 400px;
}

.preview-wpp .wpp-column ::placeholder {
  opacity: 1 !important;
  color: #6b6b6b !important;
}
.preview-wpp .wpp-column .message-form ::placeholder {
  opacity: 1 !important;
  color: #6b6b6b !important;
}

.wpp-column {
  width: 100%;
  background-color: $ds-gray-100;
  border-radius: 16px;
}
.preview-wpp {
  width: 100%;
  display: flex;
  flex-direction: row;
  border: $ds-gray-100 3px solid;
  border-radius: 16px;
  margin-top: 15px;
}

.wpp-header {
  width: 100%;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.wpp-wrapper {
  background-color: $ds-gray-100;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
  padding-bottom: 10px;
}
.text-color-content-wpp {
  margin: 0px !important;
  font-size: 16px;
  overflow: hidden;
  color: #282828;
  max-width: 100%;
  line-height: 1.25;
}
.wpp-text {
  background-color: white;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-shadow: 0px 8px 12px rgba(0, 0, 0, 0.05);
  border-radius: 0px 8px 8px 8px;
  max-width: 60%;
  margin: 20px 0 0 12px;
  padding: 8px 0 0 12px;
}
.time {
  color: #8c8c8c;
  font-size: 11px;
  align-self: flex-end;
  margin-right: 4px;
}
.wpp-link {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0px 8px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: center;
  align-items: center;
  max-width: 60%;
  margin: 2px 0 130px 12px;
  padding: 7px 0;
}
.text-link {
  color: #35b7f1;
  font-size: 14px;
  padding: 1px 0;
  margin-bottom: 0 !important;
  max-width: 60%;
}
::v-deep .v-text-field__details {
  display: none;
}

::v-deep .theme--light.v-btn.v-btn--disabled.v-btn--has-bg {
  background-color: #d0c9f8 !important;
}
.campaign-height-bms {
  height: 36px !important;
}
.actions-card {
  position: absolute;
  top: 0%;
  margin-top: 10px;
  display: inline;
  margin-right: 0px;
  right: 0%;
  margin-right: 10px;
}

.actions-card-icons {
  font-size: 18.75px;
  color: #a6a6a6;
}
.icons-hover:hover {
  color: #858585;
}

.icon-card-size {
  font-size: 20px !important;
}

.message-title-testab {
  margin-left: -14px;
  color: #5c5c5c;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 15.6px;
}
.separator-bms {
  border-left: 1px solid #d9d9d9;
}
.div-row {
  margin-top: -13.3px;
}
.margins-bms {
  margin-left: 20px;
}
.title-campaign {
  font-size: 16px;
  font-weight: 600;
  line-height: 21px;
  letter-spacing: 0.05em;
  text-align: left;
  color: #5c5c5c;
  margin-bottom: 0px;
}

.label-title-campaign {
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
}

.label-title-desc-campaign {
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
}
.text-description {
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
}

.title-content {
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0em;
  text-align: left;
  padding-right: 25px;
  color: #5c5c5c;
}
.subject-content {
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
  margin-bottom: 4px !important;
}
.desc-content {
  font-size: 10px;
  font-weight: 400;
  line-height: 13px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
  margin-bottom: 0px;
}

.alert-bms {
  display: flex;
  width: 100%;
  padding: 8px 16px 8px 16px;
  border-radius: 16px;
  gap: 16px;
  border: 1px solid #ffc500;
  font-size: 14px;
  font-weight: 400;
  line-height: 18px;
  letter-spacing: 0em;
  text-align: left;
  color: #ffc500;
  align-items: center;
  background-color: #fffdef;
  margin-bottom: 8px;
}

.view-campaign-revision-step {
  h5 {
    margin-top: 1.5em;
  }
}
.card-schedule {
  max-height: 160px;
  min-height: 65px;
}
.text-info-revision {
  font-size: 16px;
  font-weight: 600;
  line-height: 21px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
  margin-bottom: 20px;
}
.v-btn--disabled {
  background-color: none !important;
}

.v-card {
  width: 100%;
  padding: 1em;
  margin-top: 0.5em;
  border-radius: 16px;
}

.messages-card {
  max-width: 49%;
}

.text-recurrence {
  text-transform: lowercase;
}
.container-selected {
  height: fit-content;
}

.container-conditional-tags {
  border: $ds-gray-300 2px solid !important;
  border-radius: 16px;
}

.cards-segment {
  display: flex;
  flex-direction: column;
  overflow-y: hidden;
  padding-bottom: 24px;

  .section {
    position: relative;
    display: flex;
    align-items: center;
  }
}
.first-step {
  margin-top: 10px !important;
}

.step {
  margin-bottom: 12px;
  border: $ds-blue 1px;
}

.first-vertical-line {
  position: absolute;
  width: 2px;
  height: 122px !important;
  background: $ds-gray-300;
  top: 60px !important;
  left: 16px;
}

.first-line-after-conditinal {
  position: absolute;
  width: 2px;
  height: 64px !important;
  background: $ds-gray-300;
  top: 67px !important;
  left: 16px;
}
.last-vertical-line {
  height: 68px !important;
}
.vertical-line {
  z-index: 0;
  position: absolute;
  width: 2px;
  height: 132px;
  background: $ds-gray-300;
  top: 26px;
  left: 16px;
}

::v-deep .v-application p {
  margin-bottom: 0px;
}

::v-deep .v-input__slot {
  min-height: 36px !important;
}

fieldset {
  border: none !important;
}
</style>
