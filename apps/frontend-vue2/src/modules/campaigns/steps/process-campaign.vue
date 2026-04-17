<template>
  <div class="view-campaign-revision-step w-100">
    <div class="edit-title campaign-title">
      <router-link to="/campaigns" class="clickable-breadcrumb">
        <span class="material-symbols-rounded ds-blue-color font-20">chevron_left</span>
        <span>{{ $t('title.campaignList') }}</span>
      </router-link>
    </div>
    <div class="card-title-status">
      <h5 class="text-info-revision campaign-title-progress mt-1 align-title-status">
        {{ newCampaign.title }}
      </h5>
      <div aria-label="sending" v-if="newCampaign.status === statusCampaignEnum.Sending">
        <template>
          <div class="progress-container">
            <div class="progress-text">{{ $t(`datatable.sending`) }}: {{ newCampaign.sentPercentage || 0 }}%</div>
            <span class="progress-bar" :style="{ width: (newCampaign.sentPercentage || 0) + '%' }"></span>
          </div>
        </template>
      </div>
      <span v-else class="status-chip ml-2" :class="[`status-${pipeStatusCampaign(newCampaign.status)}`]">
        {{ $t(`datatable.${pipeStatusCampaign(newCampaign.status)}`) }}
      </span>
    </div>
    <v-row
      v-if="
        newCampaign.status !== statusCampaignEnum.Sending || newCampaign.status !== statusCampaignEnum.SendingTestAb
      "
      class="mt-2 mb-1"
    >
      <v-col class="pr-2">
        <v-card>
          <label class="statistics-label d-flex mt-0">
            <span class="material-symbols-rounded mr-2"> email </span>
            {{ $t('datatable.total') }}
          </label>
          <h4 v-if="!statistics" class="loading-dot-flashing d-block"></h4>
          <h4 class="text-info-revision total-color" v-else>
            {{
              (newCampaign.messageType === campaignMessageType.EMAIL ? statistics.delivered : statistics.sent) |
                formatNumber
            }}
          </h4>
        </v-card>
      </v-col>
      <v-col v-if="newCampaign.messageType === campaignMessageType.EMAIL" class="pl-2 pr-2">
        <v-card>
          <label class="statistics-label d-flex mt-0">
            <span class="material-symbols-rounded mr-2"> drafts </span>
            {{ $t('datatable.open') }}s
          </label>
          <div v-if="!statistics" class="loading-dot-flashing d-block"></div>
          <h4 class="text-info-revision open-color" v-else>
            {{ statistics.open | formatNumber }}
            <span v-if="statistics.delivered">
              ({{ ((statistics.open / statistics.delivered) * 100 || 0).toFixed(2) }}%)
            </span>
          </h4>
        </v-card>
      </v-col>
      <v-col
        v-if="[campaignMessageType.WEBPUSH, campaignMessageType.MOBILEPUSH].includes(newCampaign.messageType)"
        class="pl-2 pr-2"
      >
        <v-card>
          <label class="statistics-label d-flex mt-0">
            <span class="material-symbols-rounded mr-2"> email </span>
            {{ $t('datatable.delivered') }}
          </label>
          <div v-if="!statistics" class="loading-dot-flashing d-block"></div>
          <h4 class="text-info-revision delivered-color" v-else>
            {{ statistics.delivered | formatNumber }}
            <span v-if="statistics.delivered">
              ({{ ((statistics.delivered / statistics.sent) * 100 || 0).toFixed(2) }}%)
            </span>
          </h4>
        </v-card>
      </v-col>
      <v-col class="pl-2 pr-2">
        <v-card>
          <label class="statistics-label d-flex mt-0 click-color">
            <span class="material-symbols-rounded mr-2"> web_traffic </span>
            {{ $t('datatable.click') }}s
          </label>
          <div v-if="!statistics" class="loading-dot-flashing d-block"></div>
          <h4 class="text-info-revision click-color" v-else>
            {{ statistics.click | formatNumber }}
            <span v-if="statistics.delivered">
              ({{ ((statistics.click / statistics.delivered) * 100 || 0).toFixed(2) }}%)
            </span>
          </h4>
        </v-card>
      </v-col>
      <v-col
        class="pl-2 pr-2"
        v-if="![campaignMessageType.WEBPUSH, campaignMessageType.MOBILEPUSH].includes(newCampaign.messageType)"
      >
        <v-card>
          <label class="statistics-label d-flex mt-0 unsubscribe-color">
            <span class="material-symbols-rounded mr-2"> unsubscribe </span>
            {{ $t('datatable.unsubscribe') }}s
          </label>
          <div v-if="!statistics" class="loading-dot-flashing d-block"></div>
          <h4 class="text-info-revision unsubscribe-color" v-else>
            {{ statistics.unsubscribe | formatNumber }}
            <span v-if="statistics.delivered">
              ({{ ((statistics.unsubscribe / statistics.delivered) * 100 || 0).toFixed(2) }}%)
            </span>
          </h4>
        </v-card>
      </v-col>
      <v-col
        class="pl-2 pr-2"
        v-if="![campaignMessageType.WEBPUSH, campaignMessageType.MOBILEPUSH].includes(newCampaign.messageType)"
      >
        <v-card>
          <label class="statistics-label d-flex mt-0 bounce-color">
            <img src="@/assets/bounce-icon.svg" class="bounce-icon mr-2" alt="Bounce" />
            Bounce
          </label>
          <div v-if="!statistics" class="loading-dot-flashing d-block"></div>
          <h4 class="text-info-revision bounce-color" v-else>
            {{ statistics.bounce | formatNumber }}
            <span v-if="statistics.delivered">
              ({{ ((statistics.bounce / statistics.delivered) * 100 || 0).toFixed(2) }}%)
            </span>
          </h4>
        </v-card>
      </v-col>
      <v-col v-if="newCampaign.messageType === campaignMessageType.WEBPUSH" class="pl-2 pr-2">
        <v-card>
          <label class="statistics-label d-flex mt-0">
            <span class="material-symbols-rounded mr-2"> drafts </span>
            {{ $t('title.close') }}
          </label>
          <div v-if="!statistics" class="loading-dot-flashing d-block"></div>
          <h4 class="text-info-revision" v-else>
            {{ statistics.close | formatNumber }}
            <span v-if="statistics.delivered">
              ({{ ((statistics.close / statistics.delivered) * 100 || 0).toFixed(2) }}%)
            </span>
          </h4>
        </v-card>
      </v-col>
    </v-row>
    <v-col md="12" class="p-0" v-if="newCampaign.type === campaignsType.TESTAB">
      <h5 class="title-campaign">{{ $t('title.settings') }}</h5>
      <v-card>
        <v-row no-gutters v-if="newCampaign.type === 'testAB'">
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
                {{ newCampaign.testabScheduleTo | formatDate }}
                {{ $t('datatable.startAt') }}
                {{ newCampaign.testabScheduleTo | formatTime }}
                {{ $t('datatable.finishTime') }}
                {{ newDateSendAfterTest | formatTime }}
                ({{ $t('datatable.timeDuration', { time: getTimeName(newCampaign.spreadSending) }) }})
              </p>
            </div>
          </v-col>

          <v-col md="auto" class="separator-bms mt-5 campaign-height-bms" v-if="newCampaign.testabSentAfterTest">
            <div class="div-column gap-5 margins-bms">
              <label class="subject-content">{{ $t('datatable.scheduleSendWinnerMessage') }}</label>
              <p>
                {{ newCampaign.scheduleTo | formatDate }}
                {{ $t('datatable.startAt') }}
                {{ newCampaign.scheduleTo | formatTime }}
                {{ $t('datatable.finishTime') }}
                {{ newDateSendAfter | formatTime }}
                ({{ $t('datatable.timeDuration', { time: getTimeName(newCampaign.spreadSending) }) }})
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
          <v-col md="auto" class="mr-5 campaign-height-bms">
            <div class="div-column gap-5">
              <label class="subject-content">{{ $t('datatable.testSchedule') }}</label>
              <p>
                {{ $t('title.day') }}
                {{ newCampaign.scheduleTo | formatDate }}
                {{ $t('datatable.startAt') }}
                {{ newCampaign.scheduleTo | formatTime }}
                {{ $t('datatable.finishTime') }}
                {{ newDateSendAfter | formatTime }}
                ({{ $t('datatable.timeDuration', { time: getTimeName(newCampaign.spreadSending) }) }})
              </p>
            </div>
          </v-col>
        </v-row>
      </v-card>
    </v-col>

    <section
      class="messages-winner-section my-auto mt-5"
      v-if="newCampaign.type === campaignsType.TESTAB && newCampaign.status !== statusCampaignEnum.SendingTestAb"
    >
      <h5 class="mb-2 title-campaign">{{ $t('title.messageWinner') }}</h5>
      <MessageCardComponentEnd
        :message="winnerMessage"
        :campaign="newCampaign"
        :sent="newCampaign.status == statusCampaignEnum.Completed"
        :winner="true"
        cardType="winner"
        :type="newCampaign.testabCriteria"
        :messageType="newCampaign.messageType"
        :messages="newCampaign.campaignMessage"
        :showViewMessage="true"
        :sending="newCampaign.status == statusCampaignEnum.Sending"
        :percentSent="newCampaign.sentPercentage || 0"
      />
    </section>

    <div class="d-flex justify-space-between align-center ml-0 mt-1"></div>

    <h5 class="mb-2 title-campaign">
      {{ pageTitle[newCampaign.type] }}:
      <span v-if="newCampaign.type === campaignsType.TESTAB && newCampaign.status !== statusCampaignEnum.SendingTestAb">
        {{ $t('button.completed') }}
      </span>
    </h5>
    <div class="d-flex justify-space-between">
      <section class="messages-section">
        <MessageCardComponentEnd
          v-for="(currentMessage, indexMessage) in newCampaign.campaignMessage"
          :key="indexMessage"
          :message="currentMessage"
          :index="indexMessage"
          :indexEnd="newCampaign.campaignMessage.length - 1"
          :percentSent="(newCampaign.testabAudiencePercent / newCampaign.campaignMessage.length).toFixed(1)"
          :type="newCampaign.testabCriteria"
          :campaign="newCampaign"
          :messages="newCampaign.campaignMessage"
          cardType="default"
          :winner="
            winnerMessage &&
            winnerMessage.id === currentMessage.id &&
            [statusCampaignEnum.Sending, statusCampaignEnum.Completed].includes(newCampaign.status)
          "
          :messageType="newCampaign.messageType"
          :showViewMessage="true"
        />
      </section>
    </div>
    <h5 class="title-campaign">{{ $t('datatable.audience') }}</h5>
    <v-card class="audience-card">
      <div class="tags">
        <div class="container-selected ml-4" v-for="(card, index) in newCampaign.steps" :key="`card-${index}`">
          <section class="section">
            <template v-if="newCampaign.steps.length > 1 && (index || index == newCampaign.steps.length - 1)">
              <div class="step-conditional">
                <LineComponent :type="'horizontal'" />
                <SelectConditionalComponent
                  :indexCard="index"
                  :items="selectConditionalValues"
                  color="select-orange"
                  :conditionalName="'conditionalCard'"
                  :value="getValueConditionalCard(card)"
                  :disabled="true"
                />
                <LineComponent :type="'horizontal'" />
              </div>
            </template>
          </section>

          <div class="container-conditional-tags">
            <div class="cards-segment d-flex mb-6 pr-5">
              <section
                class="section"
                v-for="(step, indexStep) in card"
                :key="`tags-step-${indexStep}`"
                :style="step.type === 'conditionalCard' ? 'display: none' : ''"
              >
                <template v-if="step.type !== 'conditionalCard'">
                  <div
                    v-if="!sendToAll"
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
                      class="enabled"
                      :desactive="true"
                      :status="(process = true)"
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
                      :color="'select-orange'"
                    />
                  </div>
                  <v-radio-group v-show="sendToAll" v-model="sendToAll">
                    <v-radio :value="true" :disabled="true">
                      <template v-slot:label>
                        <div>{{ $t('create.campaignSendToAll') }}</div>
                      </template>
                    </v-radio>
                  </v-radio-group>
                </template>
              </section>
            </div>
          </div>
        </div>
      </div>
    </v-card>
    <div class="d-flex align-items-center justify-content-between mt-7">
      <button class="btn-back" @click="buttonBack()">
        {{ $t('button.return') }}
      </button>
      <router-view></router-view>
      <button
        class="btn-stop"
        v-if="[statusCampaignEnum.Sending, statusCampaignEnum.SendingTestAb].includes(newCampaign.status)"
        @click="confirmStopCampaign"
      >
        {{ $t('modal.stopCampaign') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import ApiService from '@/services/api.service';
import SelectConditionalComponent from '@/components/conditional-steps/SelectConditionalComponent.vue';
import StepsComponent from '@/components/conditional-steps/StepsComponent.vue';
import AddStepComponent from '@/components/conditional-steps/AddStepComponent.vue';
import LineComponent from '@/components/conditional-steps/LineComponent.vue';
import MessageCardComponentEnd from '../components/MessageCardComponentEnd.vue';
import { CampaignsType, StatusCampaignEnum, CampaignMessageType } from '../enums/campaign.enum';
import DashboardService from '../../dashboard/services/dashboard.service';
import ToastService from '@/services/toast.service';
import ModalService from '@/services/modal.service';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { CampaignsDto } from '../dtos/campaigns.dto';
import { formatDateTz } from '@/util/date';
import { mapState } from 'vuex';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: {
    AddStepComponent,
    LineComponent,
    MessageCardComponentEnd,
    SelectConditionalComponent,
    StepsComponent,
    DataLoader,
  },
  computed: {
    ...mapState(['currentAccountTimezone']),
  },
  props: ['newCampaign', 'tags', 'contactsTotal'],
})
export default class ProcessCampaign extends Vue {
  @Prop() readonly newCampaign!: CampaignsDto;
  @Prop() public contactsTotal!: any;
  public currentAccountTimezone!: string;
  private readonly dashboardService = new DashboardService();
  private api = new ApiService();
  private campaignsType = CampaignsType;
  private statusCampaignEnum = StatusCampaignEnum;
  private campaignMessageType = CampaignMessageType;
  private readonly toastService = new ToastService();
  private readonly modalService = new ModalService();

  selectConditionalValues = [
    { name: 'EXCEPT', value: this.$t('title.notInclude') },
    { name: 'UNION', value: this.$t('title.include') },
  ];
  pageTitle = {
    [CampaignsType.SIMPLE]: 'Campanha Regular',
    [CampaignsType.TESTAB]: 'Test A/B',
    [CampaignsType.SPLIT]: 'Campanha Split',
    [CampaignsType.RECURRING]: this.$t('title.CampaignsTypeRecurring'),
  };

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

  statistics: any = false;
  winnerMessage: any = false;
  sendToAll!: boolean;
  newDateSendAfter: any = '';
  newDateSendAfterTest: any = '';
  intervalId: any = null;
  loadingCampaigns = false;

  async beforeMount() {
    if (this.newCampaign.type === CampaignsType.SPLIT) {
      this.newCampaign.campaignMessage.forEach(async (message: any) => {
        message.statistics = {};
      });
    }

    this.sendToAll = this.newCampaign.sendToAll;
    this.winnerMessage = await this.getWinnerMessage();

    this.getSpreadTime();

    this.statistics = await this.getStatistics({ campaigns: [this.newCampaign.id] }, false);
    await this.getStatisticsCampaign();

    if (this.newCampaign.status === StatusCampaignEnum.SendingTestAb) {
      await this.getStatisticsInterval();
      this.getStatististicsRealTime();
    }
  }

  async getStatisticsInterval() {
    this.intervalId = setInterval(() => {
      this.getStatististicsRealTime();
    }, 15000);
  }

  async getStatististicsRealTime() {
    const api = await this.api.getApi();
    const messages: any = this.newCampaign.campaignMessage;
    const messagesIds = messages.map((message: any) => message.id);
    const { data } = await api.get(`campaigns/statistics-testab`, {
      params: { campaignId: this.newCampaign.id, messagesIds },
    });
    for (const message of this.newCampaign.campaignMessage) {
      if (data.hasOwnProperty(message.id)) {
        message.statistics = data[message.id];
      }
    }
  }

  pipeStatusCampaign(index: any) {
    switch (index) {
      case 0:
        return 'draft';
      case 1:
        return 'scheduled';
      case 2:
        return 'sending';
      case 3:
        return 'paused';
      case 4:
        return 'stopped';
      case 5:
        return 'completed';
      case 6:
        return 'sendingTestAb';
      default:
        return 'unknown';
    }
  }

  alphabetCode(path: number) {
    return String.fromCharCode(path + 64);
  }

  getTimeName(value: number) {
    const timeObj = this.times.find((time) => time.value === Number(value));
    return timeObj ? timeObj.name : 'Valor não encontrado';
  }

  calculateSpreadTime(dateString: any, minutes: any) {
    const date = new Date(dateString);
    const newDate = new Date(date.getTime() + minutes * 60000);

    return newDate.toISOString();
  }

  getSpreadTime() {
    this.newDateSendAfter = this.calculateSpreadTime(this.newCampaign.scheduleTo, this.newCampaign.spreadSending);
    const scheduleTestToTotal = this.calculateSpreadTime(this.newCampaign.testabScheduleTo, 0);
    if (this.newCampaign.testabSentAfterTest) {
      this.newDateSendAfterTest = this.calculateSpreadTime(
        this.newCampaign.testabScheduleTo,
        this.newCampaign.spreadSending
      );
    }
    if (this.newCampaign.testabScheduleTo < this.newCampaign.scheduleTo) {
      this.newDateSendAfterTest = this.newCampaign.scheduleTo;
    }
  }

  parseSpreadValue(value: number) {
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

  async getWinnerMessage() {
    const { testabCriteria } = this.newCampaign;
    let winner: any;
    let statisticsWinner;

    if (this.newCampaign.type === CampaignsType.TESTAB) {
      winner = structuredClone(this.newCampaign.campaignMessage.find((message: any) => message.winner === true));
      if (!winner) {
        for (const message of this.newCampaign.campaignMessage) {
          if (
            !winner ||
            (winner.statistics && winner.statistics[testabCriteria]) <
              (message.statistics && message.statistics[testabCriteria])
          ) {
            winner = JSON.parse(JSON.stringify(message));
          }
        }

        if (winner) {
          statisticsWinner = await this.getStatistics({ messages: [winner.id] }, true);
          winner.statistics = statisticsWinner;
          this.statistics = statisticsWinner;
          return winner;
        }
      }
      if (winner) {
        winner.statistics = {};
        return winner;
      } else {
        return this.newCampaign.campaignMessage[0];
      }
    }

    return this.newCampaign.campaignMessage[0];
  }

  async getStatistics(category: any, afterTestAb: boolean) {
    if (this.loadingCampaigns) {
      return;
    }

    this.loadingCampaigns = true;
    const tz = this.currentAccountTimezone || 'UTC';
    const startDate = formatDateTz(this.newCampaign?.scheduleTo || new Date(), tz);
    const endDate = dayjs().tz(tz).format('YYYY-MM-DD');
    const router = [CampaignMessageType.WEBPUSH, CampaignMessageType.MOBILEPUSH].includes(this.newCampaign.messageType)
      ? '/statistics/push'
      : '/statistics/email';
    const response = await this.dashboardService.getDashboardData(
      startDate,
      endDate,
      {
        ...category,
        campaigns: [this.newCampaign.id],
        afterTestAb,
        type: this.newCampaign.messageType,
      },
      router
    );
    this.loadingCampaigns = false;

    const groupByMessage = category.groupByMessage;

    if (groupByMessage) {
      return response.data || {};
    }

    return response.data?.general || {};
  }

  async getStatisticsCampaign() {
    const api = await this.api.getApi();
    const { data } = await api.get(`campaigns/statistics`, { params: { campaignsIds: [this.newCampaign.id] } });
    data.forEach((campaignStatistic: any) => {
      this.newCampaign.sentContacts = campaignStatistic.sentContacts;
      this.newCampaign.sentPercentage = campaignStatistic.sentPercentage;
    });

    if (this.newCampaign.type === CampaignsType.TESTAB) {
      const statisticsWinner = await this.getStatistics({ messages: [this.winnerMessage.id] }, true);
      this.winnerMessage.statistics = statisticsWinner;
    }

    if (this.newCampaign.type === CampaignsType.SPLIT) {
      const messagesIds = this.newCampaign.campaignMessage.map((message: any) => message.id);
      const statistics = await this.getStatistics({ messages: messagesIds, groupByMessage: true }, false);
      for (const message of this.newCampaign.campaignMessage) {
        if (statistics.hasOwnProperty(message.id)) {
          message.statistics = statistics[message.id]?.general;
        }
      }
    }
  }

  confirmStopCampaign() {
    this.modalService.confirm({
      title: this.$t('modal.stopCampaign') as string,
      text: `${this.$t('modal.confirmStopCampaign', { campaign: this.newCampaign.title })}`,
      confirmLabel: this.$t('button.confirm') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.stopCampaign,
      isConfirm: true,
    });
  }

  async stopCampaign() {
    try {
      const api = await this.api.getApi();
      await api.get(`campaigns/stop/${this.newCampaign.id}`);
      this.newCampaign.status = StatusCampaignEnum.Stopped;
      this.toastService.show({
        type: 'success',
        text: this.$t('toast.stoppedCampaign') as string,
      });
    } catch (e) {
      console.error(e);
    }
  }

  buttonBack() {
    this.$router.back();
  }

  beforeDestroy() {
    if (this.newCampaign.type === CampaignsType.TESTAB) {
      clearInterval(this.intervalId);
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.enabled {
  pointer-events: none;
}

.card-title-status {
  align-items: center !important;
  align-content: center !important;
}
.progress-container {
  display: flex;
  justify-content: center;
  margin-left: 8px;
  align-items: center;
  width: 116px;
  background-color: #f2efff;
  height: 24px;
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  left: 50%;
  transform: translateX(-50%);
}

.progress-bar {
  position: absolute;
  left: 0%;
  background-color: #d0c9f8;
  height: 100%;
  width: 0;
  transition: width 0.5s;
  max-width: 100%;
  z-index: 0;
}

.progress-text {
  color: #7b61ff;
  position: absolute;
  width: 100%;
  text-align: center;
  font-family: Inter;
  font-style: normal;
  font-size: 10px;
  font-weight: 600;
  line-height: 150%;
  letter-spacing: 0.05375rem;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.status-sendingTestAb {
  color: #c0970c;
  background: #fffdef;
}
.card-title-status {
  display: flex;
  align-items: center;
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

.edit-title {
  position: relative;
}
.card-schedule {
  max-height: 160px;
  min-height: 65px;
}
.text-info-revision {
  font-size: 20px;
  font-weight: 600;
  line-height: 26px;
  letter-spacing: 0em;
  text-align: left;
}
.delivered-color {
  color: #0fb75c;
}
.total-color {
  color: #0057f4;
}
.open-color {
  color: #0fb75c;
}

.click-color {
  color: #00cefc;
}

.ctor-color {
  color: #7b61ff;
}
.unsubscribe-color {
  color: #f03232;
}
.bounce-color {
  color: #ff9654;
}
.v-btn--disabled {
  background-color: none !important;
}

.v-card {
  width: 100%;
  padding: 2em;
  margin-top: 0.5em;
  border-radius: 16px;
}

.audience-card {
  padding: 0;
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
  border: $ds-blue 1px;
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

.card-Sending-test {
  height: 210px;
  background-color: white;
}
.messages-section {
  display: flex;
  flex-wrap: wrap;
  z-index: 1;
}
.messages-section::-webkit-scrollbar {
  height: 8px;
}

.winner-section {
  width: 230px;
}
.messages-winner-section {
  width: 580px;
}
.statistics-label {
  color: $ds-gray;
  font-size: 14px;
  font-weight: bold;
  span {
    font-size: 18px;
  }
}
.icon-winner {
  font-size: 50px;
  color: #ffc500;
}
.campaign-title {
  color: $ds-gray;
  margin-top: -24px;
}
.campaign-title-progress {
  font-family: Inter;
  font-size: 24px;
  font-weight: 600;
  line-height: 31px;
  letter-spacing: 0.05em;
  text-align: left;
  color: #5c5c5c;
}
.btn-stop {
  width: auto;
  padding: 12px 24px;
  background-color: $ds-gray-100;
  color: $ds-red;
  border: 2px solid $ds-red;
  border-radius: 8px;
  text-transform: uppercase;
  font-style: normal;
  font-weight: 700;
  font-size: 12px;
  line-height: 100%;
  transition: all 0.2s ease-out;

  &:hover {
    color: #fff;
    background-color: $ds-red;
  }
}
.container-conditional-tags {
  height: fit-content;
}

.cards-segment {
  display: flex;
  flex-direction: column;

  .section {
    position: relative;
    align-items: center;
  }
}
.container-selected {
  position: relative;
  display: flex;
  flex-direction: column;

  .section {
    position: relative;
    align-items: flex-end;
  }
}
.first-step {
  margin-top: 10px !important;
}

.step {
  margin-top: 5px;
}

.step-conditional {
  position: absolute;
  padding-top: 5px;
}

.first-vertical-line {
  z-index: 9999;
  position: absolute;
  width: 2px;
  height: 53px !important;
  background: $ds-gray-300;
  top: 63px !important;
  left: 16px;
}
.last-vertical-line {
  height: 85px !important;
}
.vertical-line {
  z-index: 0;
  position: absolute;
  width: 2px;
  height: 150px;
  background: $ds-gray-300;
  top: 41px;
  left: 16px;
}

::v-deep .v-btn--is-elevated.v-btn--fab {
  box-shadow: none !important;
}

::v-deep .v-input__slot {
  min-height: 36px !important;
}

fieldset {
  border: $ds-gray-300 2px solid !important;
  border-radius: 16px;
  padding-bottom: 24px;
}
</style>
