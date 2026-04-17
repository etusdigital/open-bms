<template>
  <div class="view-campaign-schedule-step mt-2 w-800">
    <div class="v-card-container" v-if="newCampaign.type === campaignsType.TESTAB">
      <label class="title-schedule">{{ $t('datatable.distribution') }}</label>
      <v-card class="v-card-bms">
        <label class="title-label">{{ $t('datatable.winnerCriteria') }}</label>
        <v-radio-group
          v-model="testabCriteria"
          :value="newCampaign.testabCriteria"
          @change="updateInput($event, 'testabCriteria')"
          class="click-radio-button"
        >
          <v-radio value="open">
            <template v-slot:label>
              <div
                class="text-radio-button"
                style="pointer-events: none"
                :class="testabCriteria !== 'open' ? 'inactive-option-label' : 'active-option-label'"
              >
                {{ $t('input.openRate') }}
              </div>
            </template>
          </v-radio>
          <v-radio value="click">
            <template v-slot:label>
              <div
                class="text-radio-button"
                style="pointer-events: none"
                :class="testabCriteria !== 'click' ? 'inactive-option-label' : 'active-option-label'"
              >
                {{ $t('input.clickRate') }}
              </div>
            </template>
          </v-radio>
        </v-radio-group>

        <div class="test-slider">
          <label class="title-label pb-2">{{ $t('create.keyDeterminedTest') }}</label>
          <SliderComponent
            :sliderValue="newCampaign.testabAudiencePercent"
            :dataName="'testabAudiencePercent'"
            :step="5"
            :max="100"
            :min="5"
            :itemCount="newCampaign.campaignMessage.length"
            @updateInput="updateInput"
          />
          <div class="div-row justify-space-between align-items-center mt-2">
            <div class="message-values">
              <div
                v-for="(label, index) in getMessageLabels()"
                :key="index"
                class="div-row align-items-center gap-5 message-info"
              >
                <span :class="getDotClass(label) + ' dot d-flex'"></span>
                <label class="message-percentage mb-0 font-10">{{ label }}</label>
                <label class="font-10 text-600 mb-0"
                  >{{ (newCampaign.testabAudiencePercent / newCampaign.campaignMessage.length).toFixed(1) }}%</label
                >
              </div>
            </div>
            <div class="div-row align-items-center gap-5 message-info">
              <span class="gray-dot dot d-flex"></span>
              <label class="message-percentage mb-0 font-10">{{ $t('input.messageW') }}</label>
              <label class="font-10 text-600 mb-0">{{ 100 - newCampaign.testabAudiencePercent }}%</label>
            </div>
          </div>
        </div>
      </v-card>
    </div>
    <div class="v-card-container">
      <label class="title-schedule">{{ $t('datatable.dispatch') }}</label>
      <v-card class="v-card-bms">
        <label class="title-label">{{ $t('create.informationSend') }}</label>
        <v-radio-group v-model="sendAfterCreate" @change="updateInput(sendAfterCreate, 'sendAfterCreate')">
          <v-radio :value="true">
            <template v-slot:label>
              <div
                class="text-radio-button"
                :class="!sendAfterCreate ? 'inactive-option-label' : 'active-option-label'"
              >
                {{ $t('datatable.sendAfterCreation') }}
              </div>
            </template>
          </v-radio>
          <v-radio :value="false">
            <template v-slot:label>
              <div class="text-radio-button" :class="sendAfterCreate ? 'inactive-option-label' : 'active-option-label'">
                {{ $t('datatable.toScheduled') }}
              </div>
            </template>
          </v-radio>
        </v-radio-group>
        <label v-if="newCampaign.type !== campaignsType.TESTAB && !sendAfterCreate" class="title-label mt-5">
          {{ $t('datatable.dateSendCampaign') }}
        </label>
        <label v-if="newCampaign.type === campaignsType.TESTAB && !sendAfterCreate" class="title-label mt-6">
          {{ $t('datatable.timeSendTestAb') }}
        </label>
        <DateTimeComponent
          v-if="newCampaign.type !== campaignsType.TESTAB && !sendAfterCreate"
          :scheduleTo="newCampaign.scheduleTo"
          :dataName="'scheduleTo'"
          :idSuffix="1"
          @updateInput="updateInput"
          class="flex mt-1"
          :isCampaignRule="isCampaignRule"
        />
        <DateTimeComponent
          v-if="newCampaign.type === campaignsType.TESTAB && !sendAfterCreate"
          :scheduleTo="newCampaign.testabScheduleTo"
          :double="true"
          :scheduleEnd="newCampaign.testabScheduleEnd"
          :dataName="'testabScheduleTo'"
          :dataNameTo="'testabScheduleEnd'"
          :idSuffix="2"
          @updateInput="updateInput"
          class="flex mr-3 mt-1"
          :isCampaignRule="isCampaignRule"
        />
        <v-checkbox
          v-if="newCampaign.type === campaignsType.TESTAB"
          v-model="testabSentAfterTest"
          @change="updateInput(!testabSentAfterTest, 'testabSentAfterTest')"
        >
          <template v-slot:label>
            <div class="text-radio-button">
              {{ $t('datatable.notSendWinnerMessage') }}
            </div>
          </template>
        </v-checkbox>
        <label v-if="newCampaign.type === campaignsType.TESTAB && !testabSentAfterTest" class="title-label mt-5">
          {{ $t('datatable.scheduleSendWInnerCampaign') }}
        </label>
        <DateTimeComponent
          v-if="newCampaign.type === campaignsType.TESTAB && !testabSentAfterTest"
          :scheduleTo="newCampaign.scheduleTo"
          :dataName="'scheduleTo'"
          :idSuffix="3"
          @updateInput="updateInput"
          class="flex"
          :isCampaignRule="isCampaignRule"
        />

        <label class="title-label mt-4">{{ $t('input.sendDistribute') }}</label>
        <div class="mt-1">
          <select
            data-cy="campaign-time-schedule"
            class="select-spreadtime form-control mo-select"
            v-model="spreadSending"
            @change="updateInput($event.target.value, 'spreadSending')"
          >
            <option v-for="time in times" :value="time.value" :key="'timeCampaign-' + time.value">
              {{ time.name }}
            </option>
          </select>
        </div>
      </v-card>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import DateTimeComponent from '../components/DateTimeComponent.vue';
import { CampaignsType, CampaignMessageType } from '../enums/campaign.enum';
import { CampaignsDto } from '../dtos/campaigns.dto';
import SliderComponent from '@/components/slider/SliderComponent.vue';

@Component({
  components: {
    DateTimeComponent,
    SliderComponent,
  },
  props: ['newCampaign', 'isCampaignRule'],
})
export default class ScheduleStep extends Vue {
  @Prop() public newCampaign!: CampaignsDto;
  @Prop() public isCampaignRule!: boolean;

  public campaignsType = CampaignsType;
  public campaignsMessageType = CampaignMessageType;

  sendAfterCreate = false;
  testabCriteria = '';
  spreadSending = 60;
  testabSentAfterTest = true;
  messageTranslation = ['messageA', 'messageB', 'messageC', 'messageD'];
  dotColors = ['light-blue-dot', 'dark-blue-dot', 'cian-dot', 'orange-dot', 'gray-dot'];

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
  spreadingPercent = ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];

  updateInput(event: any, key: any) {
    this.$emit('updateInput', event, key);
  }

  mounted() {
    this.sendAfterCreate = this.newCampaign.sendAfterCreate || false;
    this.testabCriteria = this.newCampaign.testabCriteria;
    this.spreadSending = this.newCampaign.spreadSending;
    this.testabSentAfterTest =
      this.newCampaign.testabSentAfterTest !== undefined ? !this.newCampaign.testabSentAfterTest : false;
  }

  getMessageLabels(): string[] {
    return this.newCampaign.campaignMessage.map((message: any, index: any) =>
      this.$t(`input.${this.messageTranslation[index]}`)
    );
  }

  getDotClass(message: string): string {
    return this.dotColors[this.getMessageLabels().indexOf(message) % this.dotColors.length];
  }
}
</script>

<style scoped lang="scss">
.v-card-container {
  max-width: 600px;
  margin: 0 auto;
}

::v-deep.v-slider__tick:last-child .v-slider__tick-label {
  transform: none !important;
}

.select-spreadtime {
  max-width: 272px;
}
.mt-2 {
  margin-top: 8px;
}
.v-card-bms {
  padding: 20px 20px 20px 20px !important;
}
.template-radiobutton {
  pointer-events: none !important;
}
.title-schedule {
  font-size: 16px;
  font-weight: 600;
  line-height: 21px;
  letter-spacing: 0.05em;
  text-align: left;
  color: #5c5c5c;
}
::v-deep .v-label,
.theme--light label {
  pointer-events: none;
}

::v-deep .v-input--radio-group--column .v-radio:not(:last-child):not(:only-child) {
  margin-bottom: 0px !important;
}

::v-deep .v-label {
  margin-top: 6.5px;
}

::v-deep .v-input--radio-group {
  margin-top: 8px;
}

.inactive-option-label {
  color: #5c5c5c;
  font-weight: 400 !important;
}

.active-option-label {
  font-weight: 600;
  color: #0057f4 !important;
}

.title-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
  margin-bottom: 0px !important;
}

.text-radio-button {
  font-size: 12px;
  line-height: 15px;
  letter-spacing: 0em;
  text-align: left;
  pointer-events: none !important;
}
.text-radio-button-inactive {
  color: #5c5c5c !important;
}
.text-radio-button-active {
  color: #0057f4 !important;
}
.v-card {
  width: 100%;
  padding: 1em;
  margin-top: 0px;
  margin-bottom: 24px;
  border-radius: 16px;
}
.test-slider {
  margin-top: 20px;
}
.w-15 {
  width: 15%;
}
.v-radio-align {
  display: flex !important;
  align-items: center !important;
}
::v-deep .v-input__slot {
  margin-bottom: 0px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.light-blue-dot {
  background-color: #98c7fd;
}

.dark-blue-dot {
  background-color: #3e87f8;
}
.cian-dot {
  background-color: #00cefc;
}
.orange-dot {
  background-color: #ff9654;
}
.gray-dot {
  background-color: #d9d9d9;
}

.message-percentage {
  color: #5c5c5c;
}

.message-values {
  display: grid;
  column-gap: 16px;
  row-gap: 4px;
  grid-template-columns: repeat(2, 1fr);
}

.message-info {
  white-space: nowrap;
}
</style>
