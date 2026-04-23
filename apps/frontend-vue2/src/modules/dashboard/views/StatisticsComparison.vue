<template>
  <div class="col-12">
    <div class="title-route">
      <span class="font-24 text-600 ds-gray-color">{{ $t('title.messageComparing') }}</span>
    </div>
    <div class="div-row gap-10 nav-bar-pages">
      <router-link
        v-for="message in messagesPages"
        :key="`message-${message.title}`"
        :to="message.router"
        :class="[
          message.router === $route.path ? 'active-class' : 'inactive-class',
          'messages-pages text-600 font-14 div-row align-items-center gap-5',
        ]"
      >
        <span
          class="material-symbols-rounded"
          :class="message.router === $route.path ? 'active-class' : 'inactive-class'"
        >
          {{ message.icon }}
        </span>
        {{ message.title }}
      </router-link>
    </div>
    <div class="div-row gap-5 filters-div">
      <v-menu ref="menu" v-model="menu" bottom class="message-menu" :close-on-content-click="false">
        <template v-slot:activator="{ on }">
          <div class="menu-messages message-width ds-gray-color" v-on="on" @click="focusInput">
            <input class="font-12" type="button" :value="`${$t('input.selectMessages')}`" />
            <span class="icon-up material-symbols-rounded">arrow_drop_down</span>
          </div>
        </template>
        <v-card class="message-card">
          <div class="search-bar-select">
            <input
              id="messages-search"
              class="search-input"
              type="text"
              v-model="messageValue"
              :placeholder="`${$t('input.search')}`"
              @input="debounceSearchMessage($event.target.value)"
            />
            <span class="material-symbols-rounded font-20 cursor-pointer" :class="{ 'ds-blue-color': menu === true }">
              search
            </span>
          </div>
          <div class="message-list">
            <div class="checkbox-message pl-2" :key="`message-modal-filter-${i}`" v-for="(message, i) in messages">
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
              @click.prevent="getStatisticsData"
            >
              {{ $t('button.apply') }}
            </button>
          </div>
        </v-card>
      </v-menu>
      <v-menu
        ref="metricMenu"
        v-model="metricMenu"
        bottom
        class="div-column justify-content-center metrics-menu"
        :close-on-content-click="true"
        offset-y
      >
        <template v-slot:activator="{ on }">
          <div
            class="menu-messages metric-width cursor-pointer"
            :class="{ 'date-button-open': metricMenu === true }"
            v-on="on"
          >
            <div class="div-row metric-name gap-10">
              <div v-if="selectedMetric && metricMenu === false" class="d-flex">
                <img v-if="selectedMetric === 'Bounce'" :src="metricIcon" />
                <span class="material-symbols-rounded metric-icon ds-gray-color" v-else>
                  {{ metricIcon }}
                </span>
              </div>
              <span
                class="material-symbols-rounded metric-icon"
                v-else
                :class="{ 'ds-blue-color': metricMenu === true }"
              >
                finance
              </span>
              <span v-if="selectedMetric && metricMenu === false" class="font-12 ds-gray-color text-600">
                {{ selectedMetric }}
              </span>
              <span v-else class="font-12 select-metric">{{ $t('input.selectMetric') }}</span>
            </div>
            <span
              class="icon-up material-symbols-rounded"
              :class="{ 'icon-dropdown ds-blue-color': metricMenu === true }"
              dense
            >
              arrow_drop_down
            </span>
          </div>
        </template>
        <div class="div-column statistics-message" :class="{ 'filters-card-open': metricMenu === true }">
          <div
            v-for="(metric, index) in filteredMetrics"
            :key="`message-statistics-${index}`"
            class="div-row statistics-options gap-10 pl-3"
            @click="selectMetric(metric.type, metric.icon)"
          >
            <img v-if="metric.type === 'bounce'" :src="metric.icon" />
            <span v-else class="metric-icon material-symbols-rounded ds-gray-color">{{ metric.icon }}</span>
            <span class="ds-gray-color metric-label font-12">{{ metric.title }}</span>
          </div>
        </div>
      </v-menu>
      <v-menu
        ref="menu"
        v-model="dateMenu"
        class="date-menu ml-1"
        :close-on-content-click="false"
        bottom
        transition="scale-y-transition"
        offset-y
        width="283"
      >
        <template v-slot:activator="{ activate }">
          <v-btn
            class="date-button"
            :class="{ 'date-button-open': dateMenu === true }"
            v-on="activate"
            @click="dateMenu = true"
          >
            <div class="d-flex align-items-center gap-10">
              <span
                class="metric-icon icon-up material-symbols-rounded"
                :class="{ 'ds-blue-color': dateMenu === true }"
              >
                calendar_month
              </span>
              <span class="date-range">{{ dateRangeText || $t('button.selectDate') }}</span>
            </div>
            <div>
              <span
                class="icon-up material-symbols-rounded"
                :class="{ 'icon-dropdown ds-blue-color': dateMenu === true }"
                dense
              >
                arrow_drop_down
              </span>
            </div>
          </v-btn>
        </template>
        <v-card class="filters-card" :class="{ 'filters-card-open': dateMenu === true }">
          <v-date-picker
            width="280"
            no-title
            v-model="selectedDates"
            range
            class="date-picker"
            :locale="userLanguage"
            :min="dateToVuetifyString(minFilterDate)"
            :max="dateToVuetifyString(new Date())"
            @input="changeDatePicker($event)"
          />
          <div class="date-filters">
            <v-btn class="date-period" @click="selectDateFilter(0)">{{ $t('input.today') }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(1)">{{ $t('input.yesterday') }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(7)">{{ $t('input.dateRange', { days: '7' }) }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(15)">{{ $t('input.dateRange', { days: '15' }) }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(30)">{{ $t('input.dateRange', { days: '30' }) }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter('lastMonth')">{{ $t('input.lastMonth') }}</v-btn>
          </div>
          <div class="clear-date" v-if="selectedDates.length">
            <button
              class="clear-fields text-600 font-10 ds-blue-color"
              :disabled="isDateRange === false"
              @click="clearDate()"
            >
              {{ $t('button.clear') }}
            </button>
          </div>
        </v-card>
      </v-menu>
      <div class="div-row button-switch ml-2">
        <button
          v-tooltip.bottom="$t('input.numeric')"
          class="switch-option switch-option-first font-10"
          :class="{ 'switch-option-active': chartType === 'numeric' }"
          :disabled="metricType === 'ctor'"
          @click="changeChart('numeric')"
        >
          <span class="font-20 material-symbols-rounded">tag</span>
        </button>
        <button
          v-tooltip.bottom="$t('input.percentage')"
          class="switch-option switch-option-last font-10"
          :class="{ 'switch-option-active': chartType === 'percentage' }"
          :disabled="metricType === 'delivered' && hasRequested"
          @click="changeChart('percentage')"
        >
          <span class="font-20 material-symbols-rounded">percent</span>
        </button>
      </div>
    </div>
    <div class="message-chip div-row gap-5">
      <div class="filters-chips gap-5" :class="[isOpen ? 'expand-tags d-flex' : 'closed-tags div-row']">
        <div :class="[isOpen ? 'chip-expand' : 'div-row div-chip-gap']">
          <div class="md-chips filters-chips-color" :key="`chip-${index}`" v-for="(chip, index) in visibleChips">
            <span class="chip-text pr-1 ds-gray-color">{{ chip.title }}</span>
            <span
              class="material-symbols-rounded font-16 ds-gray-color cursor-pointer"
              @click="openMessagePreview(index)"
            >
              visibility
            </span>
            <span
              class="material-symbols-rounded font-16 ds-gray-color cursor-pointer"
              @click="removeMessageChip(chip.id)"
            >
              close
            </span>
          </div>
          <button class="open-chips text-600 font-12" v-on:click="isOpen = !isOpen" v-if="chipItems.length > 3">
            {{ isOpen ? $t('input.showLess') : '+' + `${chipItems.length - 3} ` + $t('input.others') }}
          </button>
        </div>
      </div>
    </div>
    <v-dialog v-model="showMessagePreview">
      <MessagePreview
        :message="selectedMessages"
        :messageIndex="messageIndex"
        @closeMessagePreview="closeMessagePreview"
      />
    </v-dialog>
    <div v-if="hasRequested">
      <div class="div-column mt-2" v-if="metricType !== 'ctor'">
        <span class="text-600 font-16 ds-gray-color mb-2">{{
          $t('title.totalMetric', { metric: selectedMetric })
        }}</span>
        <DataLoader :isLoading="isLoadingData" :type="'image, list-item-two-line, list-item-two-line'" :height="345" />
        <div v-if="!noData && !isLoadingData" class="chart-background mb-5">
          <apexChart
            ref="chart"
            id="generalChart"
            height="345"
            type="bar"
            :options.sync="generalOptions"
            :series.sync="generalSeries"
          ></apexChart>
        </div>
        <div v-else-if="noData && !isLoadingData" class="v-card-bms no-data-card div-column align-items-center">
          <span
            class="material-symbols-rounded no-data-size"
            :class="[noGeneralData ? 'no-metric-color' : 'no-chart-color']"
            >finance</span
          >
          <span class="font-16 text-600">{{ $t('chart.showNoData') }}</span>
          <span class="font-14 text-400 no-data-label">
            {{ noGeneralData ? $t('chart.noDataMetric') : $t('chart.noDataPeriod') }}
            <br />
            {{ noGeneralData ? $t('chart.selectNewMetric') : $t('chart.selectNewPeriod') }}
          </span>
          <span class="font-14 text-400"></span>
        </div>
      </div>
      <div class="div-column mt-6">
        <span class="text-600 font-16 ds-gray-color mb-2">{{ $t('title.dayMetric', { metric: selectedMetric }) }}</span>
        <DataLoader :isLoading="isLoadingData" :type="'image, list-item-two-line, list-item-two-line'" :height="345" />
        <div v-if="!noData && !isLoadingData" class="chart-background">
          <apexChart
            id="dailyChart"
            height="345"
            type="line"
            :options.sync="dailyOptions"
            :series.sync="dailySeries"
          ></apexChart>
        </div>
        <div v-else-if="!isLoadingData && noData" class="v-card-bms no-data-card div-column align-items-center">
          <span
            class="material-symbols-rounded no-data-size"
            :class="[noGeneralData ? 'no-metric-color' : 'no-chart-color']"
            >finance</span
          >
          <span class="font-16 text-600">{{ $t('chart.showNoData') }}</span>
          <span class="font-14 text-400 no-data-label">
            {{ noDailyData ? $t('chart.noDataMetric') : $t('chart.noDataPeriod') }}
            <br />
            {{ noDailyData ? $t('chart.selectNewMetric') : $t('chart.selectNewPeriod') }}
          </span>
          <span class="font-14 text-400"></span>
        </div>
      </div>
    </div>
    <div v-else class="no-message-selected">
      <span v-if="!selectedMessages.length && selectedDates.length" class="text-400 font-16">{{
        $t('chart.selectMessage')
      }}</span>
      <span v-if="selectedDates.length === 0 && selectedMessages.length" class="text-400 font-16">{{
        $t('chart.selectDates')
      }}</span>
      <span v-if="!selectedMessages.length && !selectedDates.length" class="text-400 font-16">{{
        $t('chart.selectMessageDate')
      }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import MessagesService from '@/modules/messages/services/messages.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';
import DashboardService from '../services/dashboard.service';
import VueApexCharts from 'vue-apexcharts';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { getAccountConfig } from '@/store';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { debounce } from '@/util/debounce';
import { areObjectsEqual } from '@/util/objects';
import MessagePreview from '@/components/common/MessagePreview.vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: { VueApexCharts, DataLoader, ButtonDefault, MessagePreview },
  filters: {},
  computed: {
    ...mapState(['currentAccount', 'accountChannels', 'currentAccountTimezone', 'userLanguage']),
  },
})
export default class StatisticsComparison extends Vue {
  private readonly dashboardService = new DashboardService();
  private readonly messagesService = new MessagesService();
  public accountChannels!: any;
  public selectedDates: any = [];
  public selectedMessages: any = [];
  public messages: Array<MessageDto> = new Array<MessageDto>();
  public currentAccountTimezone!: string;
  public userLanguage!: string;

  currentAccount!: AccountDto;
  messagesPages: any = [];
  dateMenu = false;
  dateRangeText = '';
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  isDateRange = false;
  menu = false;
  metricMenu = false;
  messageMetrics = [
    { icon: 'mail', title: this.$t('datatable.deliveredPlural'), type: 'delivered' },
    { icon: 'drafts', title: this.$t('datatable.open'), type: 'open' },
    { icon: 'arrow_selector_tool', title: this.$t('datatable.click'), type: 'click' },
    { icon: 'touch_app', title: 'CTOR', type: 'ctor' },
    { icon: 'unsubscribe', title: this.$t('datatable.unsubscribe'), type: 'unsubscribe' },
    { icon: require('@/assets/bounce-icon.svg'), title: 'Bounce', type: 'bounce' },
    { icon: 'send', title: this.$t('datatable.sent'), type: 'sent' },
    { icon: 'mail_off', title: this.$t('datatable.close'), type: 'close' },
  ];
  metricIcon = '';
  selectedMetric = '';
  messageType = '';
  metricType = '';
  chartType = '';
  isOpen = false;
  isLoadingData = true;
  isDataAvailable = false;
  noData = false;
  showMessagePreview = false;
  noDataPeriod = false;
  noGeneralData = false;
  noDailyData = false;
  briusLogo = require('@/assets/brius-logo-blue.svg');
  accountDefaultDomain = '';
  hasRequested = false;
  messagesStatistics: any = {};
  minFilterDate = new Date();
  generalData = {};
  dailyData = {};
  messagesNames: any = [];
  chipItems: any = [];
  messagesQueryIds: any = [];
  messagesStringIds: any = [];
  maxPercent = false;
  messageValue = '';
  replacementValue = 0;

  generalSeries: any = [{}];
  dailySeries: any = [{}];
  generalOptions: any = {};
  dailyOptions: any = {};
  messageIndex = -1;

  debounceSearchMessage = debounce((value: string) => this.getAllMessages(value), 300);

  numericTextFormat = (value: any) => Vue.filter('formatNumberText')(value);

  numericFormat = (value: any) => Vue.filter('formatNumber')(value);

  tooltipPercentage = (value: any) => Vue.filter('formatNumber')(value) + ' %';

  labelPercentage = (val: any) => val + '%';

  dateFormat = (value: number) => Vue.filter('formatDate')(value, { day: '2-digit', month: '2-digit' });

  initializeGeneralOptions() {
    return {
      chart: {
        id: 'generalChart',
        type: 'bar',
        zoom: {
          enabled: false,
        },
        toolbar: {
          show: false,
        },
      },
      plotOptions: {
        bar: {
          columnWidth: '20%',
          distributed: true,
        },
      },
      dataLabels: {
        enabled: false,
      },
      xaxis: {
        categories: [],
        labels: {
          style: {
            fontSize: '12px',
          },
          title: [],
          tooltip: {
            enabled: false,
          },
        },
      },
      yaxis: {
        min: 0,
        tickAmount: 4,
        title: {
          text: '',
        },
        labels: {
          minWidth: 40,
          maxWidth: 250,
          style: {
            colors: ['#5C5C5C'],
            fontSize: '12px',
          },
        },
      },
      fill: {
        opacity: 1,
      },
      colors: [
        '#00CEFC',
        '#009BE4',
        '#436BBA',
        '#4515AB',
        '#50358A',
        '#4A004F',
        '#8C0758',
        '#C6315C',
        '#F06158',
        '#FF9654',
      ],
      legend: {
        show: false,
      },
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
      },
    };
  }

  initializeDailyOptions() {
    return {
      chart: {
        zoom: {
          enabled: false,
        },
        id: 'dailyChart',
        toolbar: {
          show: false,
        },
        align: 'center',
        type: 'line',
      },
      stroke: {
        width: 4,
      },
      colors: [
        '#00CEFC',
        '#009BE4',
        '#436BBA',
        '#4515AB',
        '#50358A',
        '#4A004F',
        '#8C0758',
        '#C6315C',
        '#F06158',
        '#FF9654',
      ],
      xaxis: {
        categories: [],
        labels: {
          formatter: this.dateFormat,
        },
      },
      legend: {
        show: true,
        showForSingleSeries: true,
      },
      yaxis: {
        min: 0,
        tickAmount: 5,
        title: {
          text: '',
        },
        labels: {
          minWidth: 40,
          maxWidth: 250,
          style: {
            colors: ['#5C5C5C'],
            fontSize: '12px',
          },
        },
      },
      tooltip: {
        x: {
          format: 'dd MMM',
        },
        y: {
          formatter: this.chartType === 'percentage' ? this.tooltipPercentage : this.numericFormat,
        },
      },
    };
  }

  async beforeMount() {
    this.setMessagePages();
    this.minFilterDate.setDate(new Date().getDate() - 90);
    this.accountDefaultDomain = (getAccountConfig(this.currentAccount, 'default_domain') ?? '').replace(
      /^https?:\/\//,
      ''
    );
    if (Object.keys(this.$route.query).length) {
      this.messagesStringIds = this.$route.query.messagesIds as string;
      this.messagesQueryIds = this.messagesStringIds.split(',').map((messageId: string) => parseInt(messageId, 10));
      this.getValuesUrl();
      await this.getAllMessages('', this.messagesQueryIds);
      this.selectedDates = [this.dateToVuetifyString(this.startDate), this.dateToVuetifyString(this.endDate)];
      await this.changeDatePicker(this.selectedDates);
    }
    if (!Object.keys(this.$route.query).length) {
      this.messageType = this.$route.params.type;
      await this.getAllMessages('');
      this.selectMetric('delivered', 'email');
      this.selectDateFilter(7);
      this.chartType = 'numeric';
    }
  }

  get filteredMetrics() {
    if (this.messageType === 'web-push') {
      return this.messageMetrics.filter(
        (metric: any) => !['ctor', 'unsubscribe', 'bounce', 'open'].includes(metric.type)
      );
    }
    if (this.messageType === 'email') {
      return this.messageMetrics.filter((metric: any) => !['sent', 'close'].includes(metric.type));
    }
  }

  get visibleChips() {
    return this.isOpen ? this.chipItems : this.chipItems.slice(0, 3);
  }

  focusInput() {
    setTimeout(() => {
      const searchInput = document.getElementById('messages-search');
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
  }

  openMessagePreview(index: number) {
    this.messageIndex = index;
    this.showMessagePreview = true;
  }

  closeMessagePreview() {
    this.showMessagePreview = false;
  }

  getHrefLink(content: any) {
    try {
      const parsedContent = JSON.parse(content);
      const buttonContent = parsedContent.body.rows[0].columns[0].contents.find(
        (value: any) => value.type === 'button'
      );
      if (
        buttonContent &&
        buttonContent.values &&
        buttonContent.values.href &&
        buttonContent.values.href.values &&
        buttonContent.values.href.values.href
      ) {
        return buttonContent.values.href.values.href;
      } else {
        return this.accountDefaultDomain;
      }
    } catch (error) {
      console.error('Error parsing content JSON:', error);
      return '';
    }
  }

  async getStatisticsForMessages(messageIds: any[]) {
    try {
      const response = await this.dashboardService.getDashboardData(
        this.startDate,
        this.endDate,
        {
          messages: messageIds,
          groupByMessage: true,
        },
        `statistics/${this.messageType === 'email' ? 'email' : 'push'}`
      );
      return response?.data || {};
    } catch (err) {
      console.error(err);
      return {};
    }
  }

  async getStatisticsData() {
    if (!this.selectedDates.length || !this.selectedMessages.length) {
      return;
    }

    if (this.selectedMessages.length) {
      this.hasRequested = true;
    }

    this.isLoadingData = true;
    this.menu = false;

    try {
      const messagesIds = this.selectedMessages.map((value: any) => value.id);
      this.messagesStatistics = await this.getStatisticsForMessages(messagesIds);
      this.generalData = this.messagesStatistics.general || {};
      this.dailyData = this.messagesStatistics.daily || {};

      await this.updateCharts(this.messagesStatistics, this.messagesNames);
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoadingData = false;
    }
  }

  async updateCharts(messagesStatistics: any, messagesNames: any) {
    this.generalOptions = this.initializeGeneralOptions();
    this.dailyOptions = this.initializeDailyOptions();
    this.generalSeries = [{ data: [] as number[] }];
    this.dailySeries = [];
    this.chipItems = [];
    this.chipItems = this.chipItems.concat(this.selectedMessages);
    let hasData = false;

    for (const message of this.selectedMessages) {
      const messageId = message.id;
      const messageStats = messagesStatistics[messageId];
      if (messageStats) {
        const general = messageStats.general;

        let generalValue = this.calculateMetricValue(general, 'general');
        this.noGeneralData = Object.values(general).some((value: any) => value !== 0);

        if (generalValue === 0 || generalValue === null) {
          generalValue = 0;
          this.noData = true;
        } else {
          hasData = true;
        }

        this.generalSeries[0].data.push(generalValue);

        const dailyStats = messageStats.daily;
        const dailyStatsArray = Object.keys(dailyStats).map((date) => ({ date, ...dailyStats[date] }));

        dailyStatsArray.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateA.getTime() - dateB.getTime();
        });

        dailyStatsArray.forEach((stat) => {
          const { date, ...metrics } = stat;
          const statDate = new Date(date.value);
          statDate.setMinutes(statDate.getMinutes() + statDate.getTimezoneOffset());
          Object.assign(stat, { date: statDate, ...metrics });

          let dailyValue = this.calculateMetricValue(metrics, 'daily');
          this.noDailyData = Object.values(metrics).some((value: any) => value !== null);

          if (dailyValue === 0 || dailyValue === null) {
            dailyValue = 0;
            this.noData = true;
          } else {
            hasData = true;
          }

          const seriesIndex = this.dailySeries.findIndex((series: any) => series.name === message.title);
          if (seriesIndex === -1) {
            this.dailySeries.push({
              name: message.title,
              data: [{ x: statDate, y: dailyValue }],
            });
          } else {
            this.dailySeries[seriesIndex].data.push({ x: statDate, y: dailyValue });
          }
        });
      }
    }

    this.generalSeries[0].data = this.replaceZeroValues(this.generalSeries[0].data);
    this.noData = !hasData;

    this.generalOptions = {
      ...this.generalOptions,
      xaxis: {
        ...this.generalOptions.xaxis,
        categories: messagesNames,
      },
      yaxis: {
        ...this.generalOptions.yaxis,
        title: {
          text: this.$t('title.totalOf', { metric: this.selectedMetric }) as string,
        },
        labels: {
          formatter: this.numericTextFormat,
        },
      },
      tooltip: {
        ...this.generalOptions.tooltip,
        custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
          const message = this.selectedMessages[dataPointIndex];
          const color = this.generalOptions.colors[dataPointIndex];
          return `<div style="width: max-content; display: flex; flex-direction: column; gap: 5px; align-items: center">
                  <div style="display: flex; font-size: 12px; background-color: #eceff1; height: 26px; width: -webkit-fill-available; padding: 10px; align-items: center; justify-content: start;">
                    ${this.selectedMetric}
                  </div>
                  <div style="display: flex; flex-direction: row; gap: 8px; align-items: center; padding: 4px 10px 8px 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${color};"></div>
                    <div style="font-size: 12px;">${message.title}: </div>
                    <div style="font-size: 12px; font-weight: 600;">
                      ${
                        series[seriesIndex][dataPointIndex] === this.replacementValue
                          ? 0
                          : Vue.filter('formatNumber')(series[seriesIndex][dataPointIndex])
                      } ${this.chartType === 'percentage' ? '%' : ''}
                    </div>
                  </div>
                </div>`;
        },
      },
    };

    this.dailyOptions = {
      ...this.dailyOptions,
      xaxis: {
        ...this.dailyOptions.xaxis,
        categories: this.dailySeries.map((series: any) => series.data.map((dataPoint: any) => dataPoint.x)),
      },
      yaxis: {
        ...this.dailyOptions.yaxis,
        title: {
          text: this.selectedMetric,
        },
        labels: {
          formatter: this.numericTextFormat,
        },
      },
    };

    if (this.chartType === 'percentage') {
      this.generalOptions = {
        ...this.generalOptions,
        yaxis: {
          max: 100,
          labels: {
            formatter: this.labelPercentage,
          },
        },
      };
    }

    if (this.chartType === 'percentage') {
      this.dailyOptions = {
        ...this.dailyOptions,
        yaxis: {
          max: this.maxPercent ? undefined : 100,
          labels: {
            formatter: this.labelPercentage,
          },
        },
      };
    }
    this.setValuesUrl();
  }

  async changeChart(chartType: string) {
    this.chartType = chartType;
    await this.updateCharts(this.messagesStatistics, this.messagesNames);
  }

  calculateMetricValue(metrics: any, type: string) {
    let value = metrics[this.metricType];
    if (this.metricType === 'delivered' && this.chartType === 'percentage') {
      this.chartType = 'numeric';
    }
    if (this.chartType === 'percentage') {
      value = this.getPercentage(value, metrics['delivered']);
    }
    if (this.metricType === 'ctor' && type === 'daily') {
      this.chartType = 'percentage';
      const open = metrics['open'];
      const click = metrics['click'];
      if (open !== 0 && !Number.isNaN(open) && open !== null && click !== 0 && !Number.isNaN(click) && click !== null) {
        value = this.getPercentage(click, open);
      } else {
        value = 0;
      }
    }
    return value;
  }

  async selectMetric(type: any, icon: any) {
    const metric = this.messageMetrics.find((metrics: any) => metrics.type === type);
    this.selectedMetric = metric?.title as string;
    this.metricIcon = icon;
    this.metricType = type;
    if (this.selectedMessages.length) {
      await this.updateCharts(this.messagesStatistics, this.messagesNames);
    }
  }

  async removeMessageChip(id: number) {
    this.selectedMessages = this.selectedMessages.filter((message: any) => message.id !== id);
    await this.updateCharts(this.messagesStatistics, this.messagesNames);
    if (!this.selectedMessages.length) {
      this.hasRequested = false;
    }
  }

  setMessagePages() {
    this.messagesPages = [
      ...(this.accountChannels.hasEmail
        ? [{ title: this.$t('title.email'), router: '/messages/email/comparison', icon: 'mail' }]
        : []),
      ...(this.accountChannels.hasWebPush
        ? [{ title: this.$t('title.web-push'), router: '/messages/web-push/comparison', icon: 'notifications' }]
        : []),
    ];
  }

  dateToVuetifyString(date?: Date): string {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateString = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    return dateString;
  }

  selectDateFilter(dateRange: string | number): void {
    switch (dateRange) {
      case 'lastMonth':
        this.selectedDates[0] = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
        break;

      case 1:
        this.selectedDates[0] = dayjs().subtract(1, 'day').startOf('day').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().subtract(1, 'day').endOf('day').format('YYYY-MM-DD');
        break;

      default:
        this.selectedDates[0] = dayjs().subtract(Number(dateRange), 'day').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().format('YYYY-MM-DD');
    }

    this.changeDatePicker([this.selectedDates[0], this.selectedDates[1]]);
  }

  async changeDatePicker(e: string[]) {
    if (e.length < 2) {
      return;
    }

    const dates: dayjs.Dayjs[] = e.map((item) => {
      const date = dayjs.utc(item).tz(this.currentAccountTimezone, true);
      return date;
    });

    if (dates[0] > dates[1]) {
      dates.reverse();
    }

    const startDateInTimezone = dates[0].tz(this.currentAccountTimezone);
    const endDateInTimezone = dates[1].tz(this.currentAccountTimezone);

    this.startDate = new Date(startDateInTimezone.format('YYYY-MM-DDTHH:mm:ss'));
    this.endDate = new Date(endDateInTimezone.format('YYYY-MM-DDTHH:mm:ss'));
    this.dateRangeText = `${Vue.filter('formatDate')(dates[0])} - ${Vue.filter('formatDate')(dates[1])}`;
    this.isDateRange = true;
    await this.getStatisticsData();
  }

  async clearDate() {
    this.selectedDates = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.isDateRange = false;
    this.dateRangeText = '';
  }

  async clearMessages() {
    this.selectedMessages = [];
    this.chipItems = [];
    this.hasRequested = false;
    if (this.chipItems.length !== 0) {
      await this.getStatisticsData();
    }
  }

  async getAllMessages(title: string, ids?: number[]) {
    try {
      const result = await this.messagesService.getMessages({
        title,
        itemsPerPage: ids ? ids.length : 20,
        page: 1,
        type: this.messageType === 'web-push' ? 'web-push' : 'email',
        messagesIds: ids,
      });
      const messageResult = result?.data?.results;
      this.messages = messageResult.map((message: any) => {
        return {
          id: message.id,
          title: message.title,
          subject: message.subject,
          preview: message.previewText,
          content: message.content,
          from: `${message.fromName} <${message.fromMail}>`,
          url: message.url,
          type: message.type,
          image: message.image,
          content_json: message.content_json,
        };
      });
    } catch (err) {
      console.error(err);
    }
  }

  getValuesUrl() {
    if (this.$route.params) {
      this.messageType = (this.$route.params.type || 'email') as string;
    }

    if (this.$route.query.messagesIds) {
      this.messagesStringIds = this.$route.query.messagesIds;
      this.selectedMessages = this.messagesStringIds.split(',').map((messageId: string) => {
        return this.messages.find((message: any) => message.id === parseInt(messageId, 10));
      });
    }

    if (this.$route.query.metricType) {
      this.metricType = this.$route.query.metricType as string;
      const selectedMetricInfo = this.messageMetrics.find(
        (metric: any) => metric.type === this.metricType.toLowerCase()
      );
      if (selectedMetricInfo) {
        this.selectedMetric = selectedMetricInfo.title as string;
        this.metricIcon = selectedMetricInfo.icon;
      }
    }

    if (this.$route.query.chartType) {
      this.chartType = (this.$route.query.chartType || 'numeric') as string;
    }

    if (this.$route.query.startDate) {
      const date = new Date(this.$route.query.startDate as string);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      this.startDate = date;
    }

    if (this.$route.query.endDate) {
      const date = new Date(this.$route.query.endDate as string);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      this.endDate = date;
    }
  }

  setValuesUrl() {
    const messagesIds = this.selectedMessages.map((message: any) => message.id).join(',');

    const queryParams = {
      messagesIds: messagesIds || '',
      metricType: this.metricType || '',
      startDate: this.dateToVuetifyString(this.startDate),
      endDate: this.dateToVuetifyString(this.endDate),
      chartType: this.chartType || 'numeric',
    };

    if (areObjectsEqual(this.$route.query, queryParams) === false) {
      this.$router.push({ query: queryParams });
    }

    if (!messagesIds) {
      this.$router.push({ query: {} });
    }
  }

  getPercentage(partialNumber: number, totalNumber: number) {
    if (!partialNumber || partialNumber === 0 || !totalNumber || totalNumber === 0) {
      return 0;
    }

    const percentage = (partialNumber / totalNumber) * 100;

    if (percentage > 100) {
      this.maxPercent = true;
    }
    if (percentage < 100) {
      this.maxPercent = false;
    }
    return parseInt(percentage.toFixed(2), 10);
  }

  replaceZeroValues(series: number[]) {
    const maxNumber = Math.max(...series);
    this.replacementValue = maxNumber * 0.004;
    return series.map((item: any) => (item === 0 ? this.replacementValue : item));
  }

  @Watch('$route.params.type')
  async getMessageType(type: string) {
    this.messageType = type;
    await this.clearMessages();
    await this.selectMetric('delivered', 'email');
    this.selectDateFilter(7);
    await this.getAllMessages('');
  }

  @Watch('$route')
  async checkRoute() {
    if (Object.values(this.$route.query).length) {
      this.getValuesUrl();
      this.selectedDates = [this.dateToVuetifyString(this.startDate), this.dateToVuetifyString(this.endDate)];
      await this.changeDatePicker(this.selectedDates);
    }

    if (!Object.values(this.$route.query).length) {
      this.clearMessages();
      await this.selectMetric('delivered', 'email');
      this.selectDateFilter(7);
      await this.getAllMessages('');
    }
  }

  @Watch('selectedMessages')
  getMessagesNames() {
    this.messagesNames = this.selectedMessages.map((message: any) => message.title);
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
  margin-bottom: 24px;
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.1),
    0px 1px 2px 0px rgba(0, 0, 0, 0.06);
}

.inactive-class {
  color: #a6a6a6;
  background-color: #ffffff;

  &:hover {
    background-color: $ds-gray-100;
    span {
      background-color: $ds-gray-100;
    }
  }
}

.active-class {
  color: $ds-blue;
  background-color: #f4f8ff;
}

.messages-pages {
  text-decoration: none;
  letter-spacing: 0.7px;
  padding: 6px 12px;
  border-radius: 12px;
}
.date-button {
  width: 283px;
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

.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}

.icon-up {
  color: $ds-gray;
}

.date-range {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 400;
  text-transform: initial !important;
}
.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}
.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100 !important;
  border-top: 1px solid $ds-blue !important;
  border-right: 1px solid $ds-blue !important;
  border-left: 1px solid $ds-blue !important;
}

.filters-card {
  border-radius: 8px;
}

.message-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
}

.date-filters {
  display: flex;
  flex-direction: column;
  padding-bottom: 10px;
}

.date-period {
  border-bottom: 1px solid $ds-gray-100;
  font-weight: 400;
  font-size: 12px;
  box-shadow: none;
  background-color: #ffffff !important;
  place-content: start;
  text-transform: initial !important;
}

.clear-date {
  display: flex;
  padding: 0px 20px 10px 0px;
  place-content: flex-end;
}

.clear-fields {
  text-transform: uppercase;
  background-color: #ffffff !important;
}

.clear-fields:disabled {
  color: $ds-gray-300 !important;
}
.date-picker {
  border-bottom: 1px solid $ds-gray-100;
}

.message-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  z-index: 999;
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
}

.metric-name {
  align-items: center;
}

.message-width {
  width: 70%;
}

.metric-width {
  width: 30%;
}

.metric-icon {
  font-size: 18px;
}

.message-list {
  max-height: 210px;
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

.input-filters {
  margin: 0 !important;
  cursor: pointer;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 220px;
  display: block;
  overflow: hidden;
  margin: 0 !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
}

.filters-div {
  width: 100%;
}

.statistics-message {
  background-color: #ffffff;
  cursor: pointer;
}

.statistics-options {
  padding: 2px 5px 2px 5px;
  border-top: 1px solid #f5f5f5;
  height: 36px;
  align-items: center;
  &:hover {
    background-color: #f5f5f5;
    &:last-child {
      border-radius: 0px 0px 8px 8px !important;
    }
  }
}

.statistics-options:first-child {
  border-top: none;
}

.select-metric {
  color: #d9d9d9;
}

.filters-chips {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: -webkit-fill-available;
}

.md-chip-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  background: $ds-gray-300;
  border: 1px solid $ds-gray-300;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  text-align: center;
  cursor: default;
}
.filters-chips-color {
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  height: 24px;
  font-size: 10px;
  display: flex;
  font-weight: 600;
  border-radius: 20px;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
  padding-left: 8px;
  gap: 5px;
}
::v-deep .v-chip__content {
  display: flex !important;
  gap: 10px !important;
}

.expand-tags {
  margin-top: 8px;
  transition:
    width 2s ease-out,
    height 2s ease-out;
  margin-bottom: 10px;
}

.closed-tags {
  margin-top: 8px;
  margin-bottom: 10px;
  max-height: 24px;
}

.chip-expand {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-text {
  white-space: nowrap;
  max-width: 250px;
  text-overflow: ellipsis;
  overflow: hidden;
}

.open-chips {
  outline: none;
  white-space: nowrap;
  color: $ds-blue;
  padding-left: 8px;
  cursor: pointer !important;

  &:hover {
    color: $ds-blue-dark;
  }
}

.div-chip-gap {
  gap: 8px;
}

.chart-background {
  border-radius: 16px;
  background-color: #ffffff;
  padding: 15px 20px 5px 20px;
  box-shadow: 0px 1px 3px 0px #0000001a;
  box-shadow: 0px 1px 2px 0px #0000000f;
}

.no-data-card {
  height: 305px;
  justify-content: center;
  color: #a6a6a6;
  gap: 5px !important;
}

.v-card-bms {
  padding: 20px;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
  border-radius: 16px;
  background: #fff;
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.1),
    0px 1px 2px 0px rgba(0, 0, 0, 0.06) !important;
}

.no-data-label {
  text-align: center;
}

.no-message-selected {
  height: 400px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #a6a6a6;
}

.message-preview {
  padding: 15px;
  background-color: #ffffff;
  border-radius: 16px;
}

.message-content {
  place-self: center;
  border-radius: 16px;
  border: 1px solid $ds-gray-300;
  overflow-y: scroll;
  box-shadow: 0px 1px 3px 0px #0000001a;
  box-shadow: 0px 1px 2px 0px #0000000f;
  height: 400px;
}

.message-info {
  border-radius: 16px;
  padding: 15px;
  background-color: #f5f5f5;
  box-shadow: 0px 1px 3px 0px #0000001a;
  box-shadow: 0px 1px 2px 0px #0000000f;
  text-overflow: ellipsis;
}

.mesage-name::first-letter {
  text-transform: capitalize;
}

.close-modal {
  justify-content: space-between;
}

.close-icon {
  border-radius: 50%;
  padding: 2px;
  &:hover {
    background-color: #f5f5f5;
  }
}

.buttons-specs {
  display: flex;
  align-items: center;
  text-align: center;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  box-shadow: none;
  font-weight: 700;
  font-size: 10px;
  max-height: 26px !important;
  padding: 15px !important;
  place-self: self-end;
  width: fit-content;
}

.btn-edit {
  color: $ds-blue !important;
  background-color: #ffffff !important;
  border: 1px solid $ds-blue;
  padding: 14px !important;
}

.btn-edit:hover {
  background-color: #ffffff !important;
}

.push-preview {
  border: 1px solid #d9d9d9;
  box-shadow: 0px 1px 3px 0px #0000001a;
  box-shadow: 0px 1px 2px 0px #0000000f;
  border-radius: 8px;
}

.push-preview-android {
  justify-content: space-between;
  padding: 10px 15px 10px 15px;
}

.link-color {
  color: #a6a6a6;
}

.icon-preview {
  height: 102px;
  width: 20%;
}

.message-button {
  justify-content: right;
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

.button-switch {
  height: 36px;
}

.switch-option {
  display: flex;
  justify-content: center;
  align-items: center;
  color: #a6a6a6;
  line-height: 100%;
  width: 36px;

  &:hover {
    cursor: pointer;
    background: #a6a6a6;
    color: white;
  }
  &:disabled {
    cursor: default;
    background: #d9d9d9;
    color: #a6a6a6;
  }
}

.switch-option-first {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  border-top: 1px #a6a6a6 solid;
  border-bottom: 1px #a6a6a6 solid;
  border-left: 1px #a6a6a6 solid;
}

.switch-option-last {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  border-top: 1px #a6a6a6 solid;
  border-bottom: 1px #a6a6a6 solid;
  border-right: 1px #a6a6a6 solid;
}

.switch-option-active {
  background: $ds-blue;
  color: white;
  border-color: $ds-blue;

  &:hover {
    background: $ds-blue;
    color: white;
  }
}
.no-data-size {
  font-size: 75px;
}

.no-metric-color {
  color: #98c7fd;
}

.no-chart-color {
  color: #ffb1b4;
}

::v-deep .v-dialog.v-dialog--active {
  width: fit-content !important;
  border-radius: 16px;
  box-shadow: none;
}

::v-deep .v-skeleton-loader {
  border-radius: 16px !important;
}

::v-deep.v-date-picker-table {
  height: 232px;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}
</style>
