<template>
  <div class="col-12 pt-0">
    <div>
      <label class="label-title font-16">{{ $t('datatable.sender') }}: {{ currentWarmup.sender }}</label>
    </div>

    <div class="warmup-cards-wrapper">
      <div class="warmup-cards cards-email">
        <div>
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="icon-title">
              <span class="material-symbols-rounded font-16">check_circle</span>
              <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.delivered') }}</p>
            </div>
            <div class="number-percentage">
              <p class="number-color-contacts number-align m-0 p-0">
                {{ statisticsData.general.delivered | formatNumber }}
              </p>
            </div>
          </v-card>
        </div>
        <div>
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="icon-title">
              <span class="material-symbols-rounded font-16">drafts</span>
              <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.open') }}</p>
            </div>
            <div class="number-percentage">
              <p class="number-color-open number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.open, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.open | formatNumber }}</p>
            </div>
          </v-card>
        </div>
        <div>
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <span class="material-symbols-rounded font-16">web_traffic</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.click') }}</p>
              </div>
            </div>
            <div class="number-percentage">
              <p class="number-color-click number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.click, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.click | formatNumber }}</p>
            </div>
          </v-card>
        </div>
        <div>
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <span class="material-symbols-rounded font-16">web_traffic</span>
                <p class="card-title-dashboard m-0 p-0">CTOR</p>
              </div>
            </div>
            <div class="number-percentage">
              <p class="number-color-ctor number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.click, statisticsData.general.open) }}%
              </p>
            </div>
          </v-card>
        </div>
        <div>
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <span class="material-symbols-rounded font-16">unsubscribe</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.unsubscribe') }}</p>
              </div>
            </div>
            <div class="number-percentage">
              <p class="number-color-unsubscribe number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.unsubscribe, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">
                {{ statisticsData.general.unsubscribe | formatNumber }}
              </p>
            </div>
          </v-card>
        </div>
        <div>
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <img src="../../../assets/bounce-icon.svg" />
                <p class="card-title-dashboard m-0 p-0">Bounce</p>
              </div>
            </div>
            <div class="number-percentage">
              <p class="number-color-bounce number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.bounce, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.bounce | formatNumber }}</p>
            </div>
          </v-card>
        </div>
      </div>
    </div>

    <v-card class="my-4 chart-card">
      <div class="d-flex flex align-center mt-2 mb-4">
        <div class="warmup-progress-wrapper">
          <div class="warmup-progress-bar" :style="{ width: `${warmupProgress}%` }">{{ warmupProgress }}%</div>
          <div class="d-flex" v-tooltip.bottom="$t(`datatable.warmupProgressDays`, { days: daysPast })">
            <span class="material-symbols-rounded prepend-icon rocket-icon"> rocket_launch </span>
          </div>
        </div>
        <span class="font-12 ml-2 text-lowercase">{{ daysEnd }} {{ $t('input.days') }}</span>
      </div>
    </v-card>

    <div class="switch-chart">
      <div
        v-tooltip.bottom="$t('input.numeric')"
        class="switch-option switch-option-first"
        :class="{ 'switch-option-active': !isChartPercentage }"
        @click="changeChart(false)"
      >
        <span class="material-symbols-rounded font-20"> tag </span>
      </div>
      <div
        v-tooltip.bottom="$t('input.percentage')"
        class="switch-option switch-option-last"
        :class="{ 'switch-option-active': isChartPercentage }"
        @click="changeChart(true)"
      >
        <span class="material-symbols-rounded font-20"> percent </span>
      </div>
    </div>

    <div class="mt-0 mb-3">
      <DataLoader
        height="400"
        :isLoading="isLoadingData"
        :type="'table-heading, list-item-two-line, list-item-two-line, list-item-two-line, list-item-two-line'"
      />
      <v-card class="chart-card" v-if="!isLoadingData">
        <div>
          <apexChart
            v-show="!isChartPercentage"
            id="chart"
            height="345"
            type="line"
            :options.sync="chartOptions"
            :series.sync="series"
          ></apexChart>
          <apexChart
            v-show="isChartPercentage"
            id="chart"
            height="345"
            type="line"
            :options.sync="chartOptionsPercentage"
            :series.sync="series"
          ></apexChart>
        </div>
      </v-card>
    </div>

    <div>
      <DataLoader :isLoading="isLoadingData" :type="'table-tbody,table-tbody'" />
      <v-data-table
        :headers="headers"
        :items="tableData"
        hide-default-footer
        class="c-table"
        :sort-by.sync="sortBy"
        :sort-desc.sync="sortDesc"
        :itemsPerPage.sync="itemsPerPage"
        :page.sync="currentPage"
        :calculate-widths="true"
        v-if="!isLoadingData"
      >
        <template v-slot:[`header.percentageCtor`]="{ header }">
          <span v-tooltip.bottom="`${$t(`datatable.ctor`)}`">{{ header.text }}</span>
        </template>

        <template v-slot:[`header.percentageUto`]="{ header }">
          <span v-tooltip.bottom="`${$t(`datatable.uto`)}`">{{ header.text }}</span>
        </template>

        <template v-slot:[`item.date`]="{ item }">
          <div class="td-item tabular-nums">
            {{ item.date | formatDate({ year: 'numeric', month: '2-digit', day: '2-digit' }) }}
          </div>
        </template>

        <template v-slot:[`item.delivered`]="{ item }">
          <div class="td-item tabular-nums">
            {{ item.delivered | formatNumber }}
          </div>
        </template>

        <template v-slot:[`item.sent`]="{ item }">
          <div class="td-item tabular-nums">
            {{ item.sent | formatNumber }}
          </div>
        </template>

        <template v-slot:[`item.open`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-open">{{ item.percentageOpen }}%</div>
            <div class="td-item">
              {{ item.open | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageOpen" height="4" color="#0FB75C" rounded />
        </template>

        <template v-slot:[`item.click`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-click">{{ item.percentageClick }}%</div>
            <div class="td-item">
              {{ item.click | formatNumber }}
            </div>
          </div>
          <v-progress-linear v-model="item.percentageClick" height="4" color="#00CEFC" rounded />
        </template>

        <template v-slot:[`item.percentageCtor`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-ctor">{{ item.percentageCtor }}%</div>
          </div>
          <v-progress-linear :value="item.percentageCtor" height="4" color="#7b61ff" rounded />
        </template>

        <template v-slot:[`item.unsubscribe`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unsubscribe">{{ item.percentageUnsubscribe }}%</div>
            <div class="td-item">
              {{ item.unsubscribe | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageUnsubscribe" height="4" color="#F06158" rounded />
        </template>

        <template v-slot:[`item.percentageUto`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unsubscribe">{{ item.percentageUto }}%</div>
          </div>
          <v-progress-linear :value="item.percentageUto" height="4" color="#F06158" rounded />
        </template>

        <template v-slot:[`item.close`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unsubscribe">{{ item.percentageClose }}%</div>
            <div class="td-item">
              {{ item.close | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageClose" height="4" color="#F06158" rounded />
        </template>

        <template v-slot:[`item.bounce`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-bounce">{{ item.percentageBounce }}%</div>
            <div class="td-item">
              {{ item.bounce | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageBounce" height="4" color="#ff9654" rounded />
        </template>

        <template v-slot:no-data>
          <p :value="true" color="error" class="no-data" icon="warning">{{ $t('datatable.noData') }}</p>
        </template>
      </v-data-table>
      <div v-if="tableData.length > itemsPerPage" class="pagination">
        <v-btn :disabled="currentPage == 1" color="primary" @click="changePage('prev')">
          <span class="material-symbols-rounded">navigate_before</span>
        </v-btn>
        <v-btn
          :disabled="currentPage == Math.ceil(tableData.length / itemsPerPage)"
          color="primary"
          @click="changePage('next')"
        >
          <span class="material-symbols-rounded">navigate_next</span>
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import WarmupService from '../services/warmup.service';
import { WarmupDto } from '../dtos/warmup.dto';
import VueApexCharts from 'vue-apexcharts';
import { ApexOptions } from 'apexcharts';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { formatDateTz } from '@/util/date';
import { mapState } from 'vuex';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: { DataLoader, VueApexCharts },
  computed: {
    ...mapState(['currentAccountTimezone']),
  },
})
export default class WarmupStats extends Vue {
  private readonly warmupService = new WarmupService();
  currentAccountTimezone!: string;

  currentWarmup: WarmupDto = {} as WarmupDto;
  statisticsData: any = {};
  startDate: Date | string = new Date();
  endDate: Date | string = new Date();
  isLoadingData = true;
  loadPage = false;
  itemsPerPage = 20;
  currentPage = 1;
  sortBy = ['date'];
  sortDesc = [true];
  tableData: any = [];
  show = false;
  isChartPercentage = false;
  warmupProgress = 0;

  chartOptions: ApexOptions = {
    chart: {
      zoom: {
        enabled: false,
      },
      id: 'chart',
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: 'smooth',
      width: [2, 2],
      dashArray: [4, 0],
    },
    colors: ['#7B61FF', '#0057f4', '#0FB75C', '#00cefc', '#f06158', '#ff9654'],
    yaxis: {
      labels: {
        formatter: (value: any) => {
          return Vue.filter('formatNumberText')(value);
        },
      },
    },
    xaxis: {
      categories: [],
      labels: {},
      tooltip: {
        enabled: false,
      },
    },
  };

  chartOptionsPercentage: ApexOptions = {
    chart: {
      zoom: {
        enabled: false,
      },
      id: 'chart',
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    colors: ['#0FB75C', '#00cefc', '#f06158', '#ff9654'],
    yaxis: {
      min: 0,
      max: 100,
      labels: {
        formatter: (value: any) => {
          return Vue.filter('formatNumberText')(value) + '%';
        },
      },
    },
    xaxis: {
      categories: [],
      labels: {},
      tooltip: {
        enabled: false,
      },
    },
    tooltip: {},
  };

  series: any = [];

  headers = [
    { text: this.$t('datatable.date'), value: 'date', sortable: true, width: '10%' },
    { text: this.$t('datatable.delivered'), value: 'delivered', sortable: true, width: '10%', align: 'end' },
    { text: this.$t('datatable.open'), value: 'open', sortable: true, width: '15%', align: 'start' },
    { text: this.$t('datatable.click'), value: 'click', sortable: true, width: '15%', align: 'start' },
    { text: 'CTOR', value: 'percentageCtor', sortable: true, width: '10%', align: 'start' },
    { text: this.$t('datatable.unsubscribe'), value: 'unsubscribe', sortable: true, width: '15%', align: 'start' },
    { text: 'UTO', value: 'percentageUto', sortable: true, width: '10%', align: 'start' },
    { text: 'Bounce', value: 'bounce', sortable: true, width: '15%', align: 'start' },
  ];

  warmupLimits = [
    160, 224, 312, 440, 616, 864, 1000, 1688, 2360, 3304, 4632, 6480, 8000, 10000, 15000, 20000, 30000, 50000, 70000,
    85000, 100000, 150000, 250000, 350000, 500000,
  ];

  daysPast = 0;
  daysEnd = 0;

  async beforeMount() {
    const warmupId = +this.$route.params.warmup_id;
    if (warmupId) {
      this.currentWarmup = (await this.warmupService.getWarmupById(warmupId))?.data;
      this.startDate = formatDateTz(this.currentWarmup.createdAt as string, this.currentAccountTimezone || 'UTC');

      this.warmupProgress = Math.round(
        (Number(this.currentWarmup.currentSend) / Number(this.currentWarmup.target)) * 100
      );

      const currentDate = new Date();
      const startedAt = new Date(this.currentWarmup.createdAt as string);
      const diffDate = currentDate.getTime() - startedAt.getTime();
      this.daysPast = Math.round(diffDate / (24 * 60 * 60 * 1000));

      this.daysEnd = this.warmupLimits.findIndex((limit) => limit === this.currentWarmup.target) + 1;

      await this.getStatistics();
    }
  }

  changePage(type: string) {
    if (type === 'next' && this.currentPage < Math.ceil(this.tableData.length / this.itemsPerPage)) {
      this.currentPage++;
    } else if (type === 'prev' && this.currentPage > 1) {
      this.currentPage--;
    }
  }

  async getStatistics() {
    this.isLoadingData = true;
    try {
      const response = await this.warmupService.getStatistics(this.startDate, this.endDate, this.currentWarmup);
      this.statisticsData = response?.data || {};

      const sortedByDate = this.statisticsData.daily.sort((a: any, b: any) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });

      this.tableData = sortedByDate.map((item: any) => {
        const date = new Date(item.date);
        const percentageOpen = this.getPercentage(item.open, item.delivered);
        const percentageClick = this.getPercentage(item.click, item.delivered);
        const percentageCtor = this.getPercentage(item.click, item.open);
        const percentageUto = this.getPercentage(item.unsubscribe, item.open);
        const percentageUnsubscribe = this.getPercentage(item.unsubscribe, item.delivered);
        const percentageBounce = this.getPercentage(item.bounce, item.delivered);
        const percentageClose = this.getPercentage(item.close || 0, item.delivered);
        const percentageDelivered = this.getPercentage(item.delivered, item.sent);
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
        return {
          ...item,
          date: date.getTime(),
          percentageOpen,
          percentageClick,
          percentageCtor,
          percentageUto,
          percentageUnsubscribe,
          percentageBounce,
          percentageClose,
          percentageDelivered,
        };
      });

      this.chartOptions = {
        ...this.chartOptions,
        xaxis: {
          ...this.chartOptions.xaxis,
          categories: this.tableData.map((item: any) => item.date),
          labels: {
            formatter: (value: string) => {
              return Vue.filter('formatDate')(value, { day: '2-digit', month: '2-digit' });
            },
          },
        },
        tooltip: {
          custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
            const dataItem = this.tableData[dataPointIndex];
            const targetItem = this.warmupLimits[dataPointIndex];
            return `<div class="custom-tooltip" style="width: max-content">
              <div class="date" style="display: flex; justify-content: center; background: #eceff1; padding: 8px 8px;">
                ${Vue.filter('formatDate')(dataItem.date)}
              </div>
              <div class="data-tooltip" style="padding: 15px 15px;">
                <div class="delivered" style="display: flex; flex-direction: row; align-items: center; width: 250px;">
                  <span class="tooltip-circle" style="background: #7B61FF; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.warmupChartTooltip')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(targetItem)}
                  </p>
                </div>
                <div class="delivered" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: #0057f4; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.delivered')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.delivered)}
                  </p>
                </div>
                <div class="open" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: #0FB75C; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.open')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.open)}
                    (${Vue.filter('formatNumber')(dataItem.percentageOpen)}%)
                  </p>
                </div>
                <div class="click" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: #00cefc; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.click')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.click)}
                    (${Vue.filter('formatNumber')(dataItem.percentageClick)}%)
                  </p>
                </div>
                <div class="unsubscribe" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: #f06158; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.unsubscribe')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.unsubscribe)}
                    (${Vue.filter('formatNumber')(dataItem.percentageUnsubscribe)}%)
                  </p>
                </div>
                <div class="bounce" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: #ff9654; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">Bounce: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.bounce)}
                    (${Vue.filter('formatNumber')(dataItem.percentageBounce)}%)
                  </p>
                </div>
              </div>
            </div>`;
          },
        },
        annotations: {
          points: [
            {
              x: Vue.filter('formatDate')(sortedByDate.slice(-1)[0].date, { day: '2-digit', month: '2-digit' }),
              y: this.currentWarmup.target,
              marker: {
                size: 0,
              },
              image: {
                path: require('@/assets/rocket.svg'),
              },
            },
          ],
        },
      };

      this.chartOptionsPercentage = {
        ...this.chartOptionsPercentage,
        xaxis: {
          ...this.chartOptions.xaxis,
          categories: this.tableData.map((item: any) => item.date),
          labels: {
            formatter: (value: string) => {
              return Vue.filter('formatDate')(value, { day: '2-digit', month: '2-digit' });
            },
          },
        },
        tooltip: {
          custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
            const dataItem = this.tableData[dataPointIndex];
            return `<div class="custom-tooltip" style="width: max-content">
              <div class="date" style="display: flex; justify-content: center; background: #eceff1; padding: 8px 8px;">
                ${Vue.filter('formatDate')(dataItem.date)}
              </div>
              <div class="data-tooltip" style="padding: 15px 15px;">
                <div class="open" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 0px;">
                  <span class="tooltip-circle" style="background: #0FB75C; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.open')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageOpen}% (${Vue.filter('formatNumber')(dataItem.open)})
                  </p>
                </div>
                <div class="click" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: #00cefc; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.click')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageClick}% (${Vue.filter('formatNumber')(dataItem.click)})
                  </p>
                </div>
                <div class="unsubscribe" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: #f06158; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.unsubscribe')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageUnsubscribe}% (${Vue.filter('formatNumber')(dataItem.unsubscribe)})
                  </p>
                </div>
                <div class="bounce" style="display: flex; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: #ff9654; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">Bounce: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageBounce}% (${Vue.filter('formatNumber')(dataItem.bounce)})
                  </p>
                </div>
              </div>
            </div>`;
          },
        },
      };

      this.series = [
        {
          name: this.$t('input.warmupChartLabel') as string,
          data: this.warmupLimits.slice(0, this.daysPast + 1),
        },
        {
          name: this.$t('datatable.delivered') as string,
          data: this.tableData.map((item: any) => item.delivered),
        },
        {
          name: this.$t('datatable.open') as string,
          data: this.tableData.map((item: any) => item.open),
        },
        {
          name: this.$t('datatable.click') as string,
          data: this.tableData.map((item: any) => item.click),
        },
        {
          name: this.$t('datatable.unsubscribe') as string,
          data: this.tableData.map((item: any) => item.unsubscribe),
        },
        {
          name: 'Bounce',
          data: this.tableData.map((item: any) => item.bounce),
        },
      ];

      if (this.loadPage) {
        this.setValuesUrl();
      }
      this.loadPage = true;
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoadingData = false;
    }
  }

  changeChart(isChartPercentage: boolean) {
    this.isChartPercentage = isChartPercentage;
    if (this.isChartPercentage) {
      this.series = [
        {
          name: this.$t('datatable.open') as string,
          data: this.tableData.map((item: any) => item.percentageOpen),
        },
        {
          name: this.$t('datatable.click') as string,
          data: this.tableData.map((item: any) => item.percentageClick),
        },
        {
          name: this.$t('datatable.unsubscribe') as string,
          data: this.tableData.map((item: any) => item.percentageUnsubscribe),
        },
        {
          name: 'Bounce',
          data: this.tableData.map((item: any) => item.percentageBounce),
        },
      ];
    } else {
      this.series = [
        {
          name: this.$t('input.warmupChartLabel'),
          data: this.warmupLimits.slice(0, this.daysPast + 1),
        },
        {
          name: this.$t('datatable.delivered') as string,
          data: this.tableData.map((item: any) => item.delivered),
        },
        {
          name: this.$t('datatable.open') as string,
          data: this.tableData.map((item: any) => item.open),
        },
        {
          name: this.$t('datatable.click') as string,
          data: this.tableData.map((item: any) => item.click),
        },
        {
          name: this.$t('datatable.unsubscribe') as string,
          data: this.tableData.map((item: any) => item.unsubscribe),
        },
        {
          name: 'Bounce',
          data: this.tableData.map((item: any) => item.bounce),
        },
      ];
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

  getValuesUrl() {
    if (this.$route.query.sortBy) {
      this.sortBy = [(this.$route.query.sortBy as string) || 'date'];
    }

    if (this.$route.query.sortDesc) {
      this.sortDesc = this.$route.query.sortDesc ? [this.$route.query.sortDesc === 'true'] : [true];
    }
  }

  @Watch('sortBy')
  @Watch('sortDesc')
  setValuesUrl() {
    this.$router.push(`?sortBy=${this.sortBy}&sortDesc=${this.sortDesc}`);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.warmup-cards-wrapper {
  container-type: inline-size;
  container-name: warmup-cards;
}

.switch-chart {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  margin: 1em 0;
}

.switch-option {
  padding: 8px;
  color: #a6a6a6;
  line-height: 100%;

  &:hover {
    cursor: pointer;
    background: #a6a6a6;
    color: white;
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

.warmup-cards {
  display: grid;
  gap: 1em;
  grid-template-columns: repeat(6, 1fr);
}

.cards-push {
  grid-template-columns: repeat(5, 1fr) !important;
}

@container warmup-cards (max-width: 1200px) {
  .warmup-cards {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}

.card-title-dashboard {
  font-weight: 600;
  font-size: 14px;
}
.c-table {
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  margin-top: 1rem;
}

::v-deep.v-data-table > .v-data-table__wrapper > table > tbody > tr > td {
  padding: $spacing-sm $spacing-sm !important;
}
.pagination {
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  margin-top: 1em;
  justify-content: center;
}
.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
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
.date-range {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 400;
  text-transform: initial !important;
}
::v-deep.v-data-table > .v-data-table__wrapper > table > thead > tr > th.active span,
::v-deep.v-data-table > .v-data-table__wrapper > table > thead > tr > th.active i {
  color: $ds-blue !important;
}

::v-deep.v-data-table > .v-data-table__wrapper > table > thead > tr > th span,
::v-deep.v-data-table > .v-data-table__wrapper > table > thead > tr > th i {
  text-align: start !important;
}

.search-bar {
  display: flex;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-gray-100;
  margin-bottom: 0px !important;
}
.search-input {
  min-height: 36px !important;
  outline: none;
  font-size: 12px;
}
.filters-list {
  max-height: 11rem;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  padding-top: 0.5em;
  padding-bottom: 0.5em;
  overflow: auto;
}

/* width */
::-webkit-scrollbar {
  width: 8px;
}

/* Track */
::-webkit-scrollbar-track {
  border-radius: 10px;
  background: $ds-gray-300;
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: #a6a6a6;
  border-radius: 10px;
}

.item-campaigns {
  color: $ds-gray;
  height: 36px !important;
  border-bottom: 1px solid $ds-gray-100;
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  width: 262px;
}

.v-list-item__title {
  font-weight: 600;
  font-size: 12px !important;
}
::v-deep .v-label .theme--light {
  font-size: 12px !important;
}
.button-percent {
  display: flex;
  flex-direction: row;
  padding: 1em;
}
.close-button {
  background-color: #ffffff !important;
  color: $ds-gray !important;
  box-shadow: none;
  outline: none !important;
}
.filters-card {
  border-radius: 8px;
}

.filters {
  width: 262px;
  display: flex;
  flex-direction: row;
  text-transform: none;
  box-shadow: none;
  place-content: initial;
  font-size: 12px;
  font-weight: 600;
  align-items: center;
  gap: 5px;
}
.filters-text {
  text-decoration: underline;
}
.percentage-number {
  display: flex;
  justify-content: space-between;
}
.number-percentage {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}
.filter-header {
  display: flex;
  flex-direction: row;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
}
.list-groups {
  border-bottom: 1px solid $ds-gray-100;
}
.v-list-item__action {
  margin-right: 0.5em !important;
  margin-left: 0em !important;
}
.card-text {
  justify-content: space-between;
}
.checkbox-filters {
  display: flex;
  flex-direction: row;
  gap: 5px;
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
}
.label-filters-disabled {
  color: $ds-gray-300 !important;
}
.menu-filters {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 9px;

  & > p {
    margin: 0;
    text-transform: none;
    font-weight: normal;

    &.menu-filters__hasfilters {
      font-weight: bold;
    }
  }

  & > svg.menu-filters__hasfilters {
    color: $ds-blue;
  }
}
.clear-fields {
  text-transform: none;
  font-size: 12px;
}
.clear-fields:disabled {
  color: $ds-gray-300;
}
.clear-fields:hover {
  text-decoration: underline;
}
.filters-buttons {
  display: flex;
  flex-direction: row;
  padding: 0.5em;
  margin-top: 10px;
  justify-content: flex-end;
  gap: 25px;
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
  padding-right: 6px;
  gap: 10px;
}
::v-deep .v-chip__content {
  display: flex !important;
  gap: 10px !important;
}
.icon-chips {
  color: $ds-gray-300;
}
.date-select {
  padding-bottom: 1em;
  align-items: center;
  justify-content: left;
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  justify-content: space-between;
}
.date-text {
  width: 283px;
  border-radius: 8px;
  height: 35px;
  display: flex;
  flex-direction: row;
  cursor: pointer;
  box-shadow: none;
  font-weight: 400;
  font-size: 14px;
  border: 1px solid $ds-gray-300;
}
::v-deep.v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  box-shadow: none;
}
.icon-title {
  display: flex;
  gap: 0.5em;
  flex-direction: row;
  align-items: center;
}
.chart-card {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  padding: 15px 20px 5px 20px;
  border-radius: 16px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1) !important;
  width: auto;
  z-index: 0 !important;
}

.info-cards {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  border-radius: 16px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1) !important;
  height: 92px;
  width: auto;
  z-index: 0 !important;
}

::v-deep .v-data-table-header {
  white-space: nowrap !important;
}

.number-align {
  text-align: flex-end;
  font-weight: 600;
  font-size: 20px;
}
.number-cards {
  font-weight: 400;
  font-size: 14px;
}

.number-color-contacts {
  color: $ds-blue;
}

.number-color-open {
  color: $ds-green;
}

.number-color-click {
  color: $ds-light-blue;
}

.number-color-ctor {
  color: $ds-purple;
}

.number-color-unsubscribe {
  color: $ds-red;
}

.number-color-bounce {
  color: $ds-orange;
}
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

  &:hover {
    background-color: $ds-gray-100;
  }
}

.active-class {
  color: $ds-blue;
  background-color: #f4f8ff;
}

.filters-chips {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: -webkit-fill-available;
}

.expand-tags {
  margin-top: -7px;
  transition:
    width 2s ease-out,
    height 2s ease-out;
  margin-bottom: 10px;
}

.closed-tags {
  margin-top: -7px;
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

.filter-selected {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 15px;
  width: 15px;
  border-radius: 50%;
  background: $ds-blue;
  margin-left: 4px;

  p {
    color: white;
    font-size: 10px;
    margin-bottom: 0px !important;
  }
}

.icon-up {
  color: $ds-gray;
}

.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.filters-title {
  color: $ds-gray;
  font-size: 12px !important;
  font-weight: 400;
}

.filters-title:active {
  color: $ds-gray;
}

.menu-filters-item__hasfilters {
  font-weight: bold;
}

.filter-selected-item {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 15px;
  width: 15px;
  border-radius: 50%;
  background: $ds-blue;
  margin-left: 4px;

  p {
    color: white;
    font-size: 10px;
    margin-bottom: 1px !important;
    margin-right: 1px;
  }
}

::v-deep.v-list-group > .v-list-group__header > .v-list-group__header__append-icon .v-icon {
  color: $ds-blue !important;
}

.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}

.calendar-icon-active {
  color: $ds-blue !important;
}

.calendar-icon {
  color: $ds-gray;
  font-size: 18px;
}

.calendar-date {
  display: flex;
  align-items: center;
  gap: 9px;
}

.warmup-progress-wrapper {
  display: flex;
  flex: auto;
  background-color: $ds-gray-200;
  border-radius: 20px;
  height: 12px;
  align-items: center;

  .warmup-progress-bar {
    display: flex;
    background-color: $ds-purple;
    border-radius: 20px;
    font-size: 10px;
    line-height: 13px;
    color: white;
    align-items: center;
    justify-content: center;
  }

  .rocket-icon {
    rotate: 45deg;
    margin-left: 5px;
    color: $ds-purple;
    font-size: 24px;
  }
}
</style>
