<template>
  <div class="col-12">
    <label class="email-performance-title label-color mb-4">{{ $t('title.emailReputation') }}</label>

    <v-card class="v-card-bms mb-6">
      <label class="font-title font-weight-bold ds-gray-color">{{ $t('datatable.verifiyReputationEmail') }}</label>
      <p class="font-14">{{ $t('datatable.copyEmailPostMaster') }}</p>
      <div class="div-row gap-15 align-items-center my-4">
        <input class="input-bms" type="text" :value="postmasterEmail" />
        <button class="button-secondary" @click="copyToClipboard">
          {{ $t('button.copy') }}
        </button>
      </div>

      <i18n path="chart.postmasterTutorial" tag="p" class="mb-0" for="chart.postmasterTutorialLink">
        <a :href="postmasterTutorialUrl" target="_blank">
          {{ $t('chart.postmasterTutorialLink') }}
        </a>
      </i18n>
    </v-card>

    <div v-if="isConfigured" class="div-row gap-15 justify-content-between align-items-center">
      <select
        data-cy="campaign-time-schedule"
        class="selects-postmaster font-12 text-400"
        v-model="selectedDomain"
        @change="getDomainData($event.target.value)"
      >
        <option class="font-12 text-400 option-select" v-for="domain in selectOptions" :key="domain">
          {{ domain }}
        </option>
      </select>
      <select
        data-cy="campaign-time-schedule"
        class="selects-postmaster font-12 text-400"
        v-model="selectedTypeFilter"
        @change="updateAllChart($event.target.value)"
      >
        <option
          class="font-12 text-400 option-select"
          v-for="filter in typeFilters"
          :value="filter.value"
          :key="filter.value"
        >
          {{ filter.name }}
        </option>
      </select>
      <v-menu
        ref="menu"
        v-model="dateMenu"
        class="date-menu d-none"
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
            <div class="calendar-date">
              <span class="material-symbols-rounded calendar-icon" :class="[dateMenu ? 'calendar-icon-active' : '']">
                calendar_month
              </span>
              <span class="date-range">{{ dateRangeText || $t('button.selectDate') }}</span>
            </div>
            <div>
              <span
                class="material-symbols-rounded icon-up"
                :class="{ 'icon-dropdown ds-blue-color': dateMenu === true }"
                small
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
            :max="dateToVuetifyString(new Date())"
            @input="changeDatePicker($event)"
          />
          <div class="date-filters">
            <v-btn class="date-period" @click="selectDateFilter(0)">{{ $t('input.today') }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(1)">{{ $t('input.yesterday') }}</v-btn>
            <v-btn class="date-period" @click="selectDateFilter(7)">
              {{ $t('input.dateRange', { days: '7' }) }}
            </v-btn>
            <v-btn class="date-period" @click="selectDateFilter(15)">
              {{ $t('input.dateRange', { days: '15' }) }}
            </v-btn>
            <v-btn class="date-period" @click="selectDateFilter(30)">
              {{ $t('input.dateRange', { days: '30' }) }}
            </v-btn>
            <v-btn class="date-period" @click="selectDateFilter('lastMonth')">{{ $t('input.lastMonth') }}</v-btn>
          </div>
          <div class="clear-date" v-if="selectedDates.length">
            <button class="clear-fields" :disabled="isDateRange === false" @click="clearDate()" type="button">
              {{ $t('button.clear') }}
            </button>
          </div>
        </v-card>
      </v-menu>
    </div>

    <div v-if="noData" class="v-card-bms no-data-card div-column align-items-center">
      <img src="@/assets/no-data-chart.svg" />
      <span class="font-16 text-600">{{ $t('chart.showNoData') }}</span>
      <span class="font-14 text-400 no-data-label">
        {{ $t('chart.noDataPeriod') }}
        <br />
        {{ $t('chart.selectNewPeriod') }}
      </span>
      <span class="font-14 text-400"></span>
    </div>

    <div v-if="isConfigured && !noData">
      <label class="mb-0 ds-gray-color text-600 font-16">{{ getChartTitle(selectedTypeFilter) }}</label>
      <div class="v-card-bms mb-6">
        <apexChart height="350" :type="chartDrawType" :options="chartAll" :series="seriesAll" @click="showStatistics">
        </apexChart>
      </div>

      <div class="container-info mt-6" v-if="selectedSeriesData && selectedTypeFilter === 'ip'">
        <table class="div-column">
          <thead>
            <tr>
              <th class="text-600 font-14 ds-gray-color">
                {{ $t('chart.ipsReputation', { reputation: $t('chart.' + filteredIps[0].reputation) }) }}
                {{ dateFormated | formatDate }}
              </th>
            </tr>
          </thead>
          <tbody class="div-column">
            <tr v-for="(ip, index) in filteredIps" :key="index" class="reaction-table-cells">
              <td class="info-text-bms">{{ ip.ip }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-alert" v-if="!clickedInChart && selectedTypeFilter === 'ip'">
        <p>{{ $t('chart.pointDataIp') }}</p>
      </div>

      <div class="container-spam-info" v-if="selectedSeriesDataLoop && selectedTypeFilter === 'loop'">
        <table class="w-100">
          <thead>
            <tr>
              <th class="text-600 font-14 ds-gray-color">
                {{ $t('chart.flagIdentifiers') }} {{ dateFormatedLoop | formatDate }}
              </th>
              <th class="text-600 font-14 ds-gray-color">{{ $t('input.rateSpam') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="reaction-table-cells" v-for="(item, index) in filteredSpamFeed" :key="index">
              <td class="text-400 font-12 ds-gray-color">{{ item.id }}</td>
              <td class="text-400 font-12 ds-gray-color">{{ item.spamRatio }}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-alert" v-if="!clickedInChart && selectedTypeFilter === 'loop'">
        <p>{{ $t('chart.clickPointData') }}</p>
      </div>

      <v-data-table
        v-if="selectedTypeFilter === 'auth'"
        :headers="headers"
        :items="tableData"
        hide-default-footer
        class="c-table table-auth"
        :calculate-widths="true"
        :items-per-page="-1"
      >
        <template v-slot:[`item.date`]="{ item }">
          <span class="date-table-item font-12">{{ item.date | formatDate }}</span>
        </template>
        <template v-slot:[`item.dkimRatio`]="{ item }">
          <span class="font-12">{{ item.dkimRatio }}%</span>
        </template>
        <template v-slot:[`item.spfRatio`]="{ item }">
          <span class="font-12">{{ item.spfRatio }}%</span>
        </template>
        <template v-slot:[`item.dmarcRatio`]="{ item }">
          <span class="font-12">{{ item.dmarcRatio }}%</span>
        </template>
        <template v-slot:no-data>
          <p :value="true" color="error" class="no-data" icon="warning">{{ $t('datatable.noData') }}</p>
        </template>
      </v-data-table>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import PostmasterService from '../../../services/postmaster.service';
import VueApexCharts from 'vue-apexcharts';
import { PostmasterDateDto, PostmasterDto } from '../dtos/postmaster.dto';
import { ApexOptions } from 'apexcharts';
import ToastService from '@/services/toast.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { mapState } from 'vuex';
import { setMenuTop } from '@/util/objects';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: {
    VueApexCharts,
  },
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class EmailPostMaster extends Vue {
  private readonly postmasterService = new PostmasterService();
  private readonly toastService = new ToastService();
  public postmasterEmail = process.env.VUE_APP_POSTMASTER_EMAIL || '';
  public postmasterTutorialUrl =
    process.env.VUE_APP_POSTMASTER_TUTORIAL_URL || 'https://support.google.com/mail/answer/9981691';
  public tableData!: PostmasterDateDto[];
  public selectedDates: any = [];
  public selectOptions: any = [];
  public postmasterData: PostmasterDto[] = [];
  public currentAccountTimezone!: string;
  public userLanguage!: string;

  dateMenu = false;
  dateRangeText = '';
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  isDateRange = false;
  isConfigured = false;
  noData = false;
  filteredIps: any = [];
  filteredSpamFeed: any = [];
  selectedTypeFilter = 'ip';
  selectedDomain = '';
  chartDrawType = 'line';
  typeFilters: any = [
    { name: this.$t('input.reputationIp'), value: 'ip' },
    { name: this.$t('input.rateSpam'), value: 'spam' },
    { name: this.$t('input.reputationDomain'), value: 'domain' },
    { name: this.$t('input.feedbackLoop'), value: 'loop' },
    { name: this.$t('input.authentication'), value: 'auth' },
  ];

  headers: any = [
    { text: this.$t('datatable.date'), value: 'date', sortable: true },
    { text: this.$t('chart.rateSucess') + ' DKIM', value: 'dkimRatio', sortable: true, align: 'start' },
    { text: this.$t('chart.rateSucess') + ' SPF', value: 'spfRatio', sortable: true, align: 'start' },
    { text: this.$t('chart.rateSucess') + ' DMARC', value: 'dmarcRatio', sortable: true, align: 'start' },
  ];

  seriesAll: ApexAxisChartSeries = [];
  chartAll: ApexOptions = {
    chart: {
      id: 'postmasterChart',
    },
  };

  selectedSeriesData: any = null;
  selectedSeriesDataLoop: any = null;
  dateFormated!: Date;
  dateFormatedLoop!: Date;
  clickedInChart = false;

  chartOptionsIp: ApexOptions = {
    chart: {
      id: 'chartPostmasterIp',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      height: 350,
      stacked: true,
      type: 'bar',
    },
    xaxis: {
      categories: [],
      labels: {
        formatter: (value: string) => {
          return Vue.filter('formatDate')(value, { day: '2-digit', month: '2-digit' });
        },
      },
    },
    yaxis: {
      max: 100,

      labels: {
        formatter(value: number) {
          return value + '%';
        },
      },
    },
    colors: ['#F03232', '#FF9654', '#FFC500', '#0FB75C'],
    dataLabels: {
      formatter(value: number) {
        return value + '%';
      },
    },
  };

  chartOptionsSpam: ApexOptions = {
    chart: {
      id: 'chartPostmasterSpam',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      height: 350,
      stacked: false,
      type: 'line',
    },
    xaxis: {
      categories: [],
      labels: {
        formatter: (value: string) => {
          return Vue.filter('formatDate')(value, { day: '2-digit', month: '2-digit' });
        },
      },
    },
    yaxis: {
      max: 5,
      min: 0,

      labels: {
        formatter(value: number) {
          return value + '%';
        },
      },
    },
    colors: ['#F03232'],
  };

  chartOptionsDomain: ApexOptions = {
    chart: {
      id: 'chartPostmasterDomain',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      height: 350,
      stacked: false,
      type: 'line',
    },
    xaxis: {
      categories: [],
      labels: {
        formatter: (value: string) => {
          return Vue.filter('formatDate')(value, { day: '2-digit', month: '2-digit' });
        },
      },
    },
    yaxis: {
      min: 0,
      max: 3,
      tickAmount: 1,
      labels: {
        formatter: (value: number) => {
          const mappingValues: any = {
            0: `${this.$t('chart.bad')}`,
            1: `${this.$t('chart.low')}`,
            2: `${this.$t('chart.medium')}`,
            3: `${this.$t('chart.high')}`,
          };
          return mappingValues[value];
        },
      },
    },

    colors: ['#0FB75C'],
  };

  chartOptionsFeedbackLoop: ApexOptions = {
    chart: {
      id: 'chartPostmasterIdentifiers',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      height: 350,
      stacked: false,
    },
    xaxis: {
      categories: [],
      labels: {
        formatter: (value: string) => {
          return Vue.filter('formatDate')(value, { day: '2-digit', month: '2-digit' });
        },
      },
    },
    yaxis: {
      min: 0,
      labels: {
        formatter(value: number) {
          return `${value}`;
        },
      },
    },
    tooltip: {
      y: {
        formatter(value: number, { seriesIndex }: any) {
          if (seriesIndex === 0) {
            return value + '%';
          }

          return `${value}`;
        },
      },
    },
    colors: ['#F03232', '#7B61FF'],
  };

  chartOptionsAuth: ApexOptions = {
    chart: {
      id: 'chartPostmasterAuth',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      height: 350,
      stacked: false,
      type: 'line',
    },
    colors: ['#00CEFC', '#50358A', '#FF9654'],
    xaxis: {
      categories: [] as string[],
    },
    yaxis: {
      max: 100,
      min: 0,
      labels: {
        formatter(value: number) {
          return value + '%';
        },
      },
    },
  };

  async beforeMount() {
    this.selectDateFilter(7);
  }

  getChartTitle(chartType: string) {
    const typeObject = this.typeFilters.find((type: any) => type.value === chartType);
    return typeObject ? typeObject.name : undefined;
  }

  async getDomainData(domain: string) {
    const selectedDomainData = this.postmasterData.find((value: any) => value.domain === domain);
    if (!selectedDomainData) {
      return false;
    }

    this.selectedDomain = selectedDomainData.domain;
    this.tableData = selectedDomainData.dates.map((item) => {
      const sortedDate = new Date(item.date);
      sortedDate.setMinutes(sortedDate.getMinutes() + sortedDate.getTimezoneOffset());

      return {
        ...item,
        date: sortedDate,
      };
    });

    this.noData = this.tableData.every((arr: any) => arr.length === 0);

    this.updateAllChart(this.selectedTypeFilter);
  }

  async getPostmasterData() {
    const { data } = await this.postmasterService.getPostmasterValues({
      filters: {
        startDate: this.startDate,
        endDate: this.endDate,
      },
    });

    this.postmasterData = data;
    if (this.postmasterData.length) {
      this.isConfigured = true;
      this.selectOptions = this.postmasterData.map((value: any) => value.domain);

      if (!this.selectedDomain) {
        this.selectedDomain = this.postmasterData[0].domain;
      }
    }

    await this.getDomainData(this.selectedDomain);
  }

  async clearDate() {
    this.selectedDates = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.isDateRange = false;
    this.dateRangeText = '';
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
    await this.getPostmasterData();

    this.updateAllChart(this.selectedTypeFilter);
  }

  dateToVuetifyString(date: Date): string {
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

  getDomainReputation(domainReputation: string) {
    switch (domainReputation) {
      case 'bad':
        return 0;
      case 'low':
        return 1;
      case 'medium':
        return 2;
      case 'high':
        return 3;
      default:
        return 0;
    }
  }

  async updateAllChart(dataType: string) {
    if (!this.tableData || !Array.isArray(this.tableData) || this.tableData.length === 0) {
      console.error(this.$t('chart.invalidData'));
      return;
    }

    this.seriesAll = [];
    this.chartAll = {};

    const ipsTest: any = { bad: [], low: [], medium: [], high: [] };
    const spamRatioData: any = [];
    const seriesDomain: any = {
      name: this.$t('chart.domainReputation'),
      data: [],
    };
    const feedbackLoopSpamRatioData: any = [];
    const feedbackLoopSpamIndentifiersData: any = [];
    const dKim = {
      name: this.$t('chart.rateSucess') + ' DKIM',
      value: 'dkim',
      type: 'line',
      data: [] as any,
    };
    const spf = {
      name: this.$t('chart.rateSucess') + ' SPF',
      value: 'spf',
      type: 'line',
      data: [] as any,
    };
    const dmarc = {
      name: this.$t('chart.rateSucess') + ' DMARC',
      value: 'dmarc',
      type: 'line',
      data: [] as any,
    };

    this.tableData.sort((a, b) => {
      return a.date.getTime() - b.date.getTime();
    });

    this.tableData.forEach((data) => {
      const ipReputation: any = {
        bad: 0,
        low: 0,
        medium: 0,
        high: 0,
      };

      for (const ip of data.ips) {
        ipReputation[ip.reputation.toLowerCase()]++;
      }

      ipsTest.bad.push({
        date: data.date.getTime(),
        value: Math.round((ipReputation.bad / data.ips.length) * 100),
      });
      ipsTest.low.push({
        date: data.date.getTime(),
        value: Math.round((ipReputation.low / data.ips.length) * 100),
      });
      ipsTest.medium.push({
        date: data.date.getTime(),
        value: Math.round((ipReputation.medium / data.ips.length) * 100),
      });
      ipsTest.high.push({
        date: data.date.getTime(),
        value: Math.round((ipReputation.high / data.ips.length) * 100),
      });

      spamRatioData.push({
        date: data.date.getTime(),
        value: data.spamRatio,
      });

      seriesDomain.data.push({ x: data.date.getTime(), y: this.getDomainReputation(data.domainReputation) });

      feedbackLoopSpamRatioData.push({
        date: data.date.getTime(),
        value: data.spamRatio,
      });

      feedbackLoopSpamIndentifiersData.push({
        date: data.date.getTime(),
        value: data.spamLoops ? data.spamLoops.length : 0,
      });

      dKim.data.push({ x: data.date.getTime(), y: data.dkimRatio });
      spf.data.push({ x: data.date.getTime(), y: data.spfRatio });
      dmarc.data.push({ x: data.date.getTime(), y: data.dmarcRatio });
    });

    let seriesAll: ApexAxisChartSeries = [];
    let chartAll: ApexOptions = {};

    this.clickedInChart = false;

    this.chartDrawType = 'line';

    switch (dataType) {
      case 'ip':
        const series: any = {};
        Object.keys(ipsTest).forEach((key: any) => {
          if (key !== 'date') {
            series[key] = {
              name: this.$t(`chart.${key}`) as string,
              data: ipsTest[key].map((ip: any) => {
                return {
                  x: ip.date,
                  y: ip.value,
                };
              }),
            };
          }
        });
        seriesAll = [series.bad, series.low, series.medium, series.high];
        chartAll = this.chartOptionsIp;

        this.chartDrawType = 'bar';
        break;

      case 'spam':
        const spamSeries = {
          name: this.$t('chart.spamVolume') as string,
          data: spamRatioData.map((item: any) => {
            return {
              x: item.date,
              y: parseFloat(item.value).toFixed(2),
            };
          }),
        };
        seriesAll = [spamSeries];
        chartAll = this.chartOptionsSpam;
        break;

      case 'domain':
        seriesAll = [seriesDomain];
        chartAll = this.chartOptionsDomain;

        break;

      case 'loop':
        const feedbackLoopSeries = {
          spamRatio: {
            name: this.$t('chart.spamVolume') as string,
            type: 'line',
            data: feedbackLoopSpamRatioData.map((item: any) => ({
              x: item.date,
              y: parseFloat(item.value).toFixed(2),
            })),
          },

          spamLoops: {
            name: this.$t('chart.numberIdentifiers') as string,
            type: 'column',
            data: feedbackLoopSpamIndentifiersData.map((item: any) => ({
              x: item.date,
              y: item.value,
            })),
          },
        };

        seriesAll = [feedbackLoopSeries.spamRatio, feedbackLoopSeries.spamLoops];
        chartAll = this.chartOptionsFeedbackLoop;
        break;

      case 'auth':
        seriesAll = [dKim, spf, dmarc];

        chartAll = {
          ...this.chartOptionsAuth,
          xaxis: {
            ...this.chartOptionsAuth.xaxis,
            labels: {
              formatter: (value: string) => {
                return Vue.filter('formatDate')(value, { day: '2-digit', month: '2-digit' });
              },
            },
          },
        };
        break;

      default:
        break;
    }

    this.seriesAll = seriesAll;
    this.chartAll = chartAll;
  }

  showStatistics(event: any, chartContext: any, config: any, data: any) {
    if (this.selectedTypeFilter === 'ip' && config.seriesIndex >= 0 && config.dataPointIndex >= 0) {
      this.clickedInChart = true;

      this.selectedSeriesData = this.tableData[config.dataPointIndex];

      const reputationOrder = ['bad', 'low', 'medium', 'high'];
      this.filteredIps = this.selectedSeriesData.ips.filter((ip: any) => {
        return ip.reputation === reputationOrder[config.seriesIndex];
      });

      this.dateFormated = this.selectedSeriesData.date;
      return;
    }

    if (this.selectedTypeFilter === 'loop' && config.dataPointIndex >= 0) {
      this.clickedInChart = true;
      this.selectedSeriesDataLoop = this.tableData[config.dataPointIndex];

      this.dateFormatedLoop = this.selectedSeriesDataLoop.date;
      if (!this.tableData[config.dataPointIndex].spamLoops) {
        this.filteredSpamFeed = [];
        return;
      }

      this.filteredSpamFeed = this.tableData[config.dataPointIndex].spamLoops.map((filteredItem: any) => ({
        id: filteredItem.id,
        spamRatio: filteredItem.spamRatio * 100,
      }));
    }
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.postmasterEmail);
    this.toastService.show({
      type: 'success',
      text: this.$t('toast.copiedToClipboard') as string,
    });
  }

  @Watch('dateMenu')
  onMenuChange(value: boolean) {
    if (value) {
      this.$nextTick(() => {
        setTimeout(() => {
          const activator = this.$el.querySelector('.date-button') as HTMLElement;
          if (activator) {
            setMenuTop(activator);
          }
        }, 0);
      });
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.type-postmaster {
  font-size: 16px;
  font-weight: 600;
  line-height: 21px;
  letter-spacing: 0.05em;
  text-align: left;
  color: #5c5c5c;
}
.text-alert {
  display: flex;
  justify-content: center;
}
.text-alert p {
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
  letter-spacing: 0em;
  color: #5c5c5c;
}
.arrow-down {
  position: absolute;
  top: 21px;
  right: 8px;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 999;
}

.arrow-down-type {
  position: absolute;
  top: 33px;
  right: 22px;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 999;
}

.arrow-down-type i {
  font-size: 18px;
  color: #5c5c5c;
}

.arrow-down i {
  font-size: 18px;
  color: #5c5c5c;
}

#chart {
  border-radius: 16px;
}
.label-bms {
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.05em;
  color: #5c5c5c;
  width: 100%;
  text-wrap: nowrap;
}

.label-spam {
  text-align: end;
}

.label-loop {
  text-align: start;
}
.info-text-bms {
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
}
.border-bottom-bms {
  margin-top: 16px;
  margin-bottom: 16px;
  width: 100%;
  border: 1px solid #d9d9d9;
}
.container-info {
  width: 347px;
  height: auto;
  padding: 20px;
  border-radius: 16px;
  gap: 16px;
  background-color: #fff;
  box-shadow: 0px 1px 3px 0px #0000001a;
}

.container-spam-info {
  width: 600px;
  height: auto;
  padding: 20px;
  border-radius: 16px;
  border: 0.5px;
  gap: 16px;
  background-color: #fff;
  border: 0.5px solid #d9d9d9;
  box-shadow: 0px 1px 3px 0px #0000001a;
}
.email-performance-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 31px;
  letter-spacing: 0.05em;
  text-align: left;
  color: #5c5c5c;
  margin-top: -24px;
  display: flex;
  flex-direction: column;
}
.v-card-bms {
  padding: 20px;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
  margin-top: 24px;
  border-radius: 16px;
  background: #fff;
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.1),
    0px 1px 2px 0px rgba(0, 0, 0, 0.06) !important;
}
.input-bms {
  height: 36px;
  width: 100%;
  align-items: center;
  align-self: stretch;
  border-radius: 8px;
  background-color: #f5f5f5;
  padding-left: 12px;
  outline: none;
}

.input-bms:focus {
  outline: 1px solid $ds-blue;
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

.date-picker {
  border-bottom: 1px solid $ds-gray-100;
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
  text-transform: none;
  font-size: 12px;
  background-color: #ffffff !important;
}

.clear-fields:disabled {
  color: $ds-gray-300 !important;
}

.clear-fields:hover {
  text-decoration: underline;
}

::v-deep .v-date-picker-table {
  height: 232px;
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

.menu-filters-item__hasfilters {
  font-weight: bold;
}

.icon-up {
  color: $ds-gray;
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

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}

.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.filters-card {
  border-radius: 8px;
}

.filters-label {
  color: $ds-blue;
}

.close-button {
  background-color: #ffffff !important;
  color: $ds-gray !important;
  box-shadow: none;
  outline: none !important;
}

.list-groups {
  border-bottom: 1px solid $ds-gray-100;
}

.table-auth {
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.1),
    0px 1px 2px 0px rgba(0, 0, 0, 0.06);
  border-radius: 16px;
}

.identifier-table {
  width: 100%;
}

.date-table-item {
  text-wrap: nowrap;
}

.reaction-table-cells {
  border-top: 1px solid #d9d9d9;
}

.selects-postmaster {
  outline: none !important;
  height: 36px;
  width: 100%;
  background-color: #ffffff;
  border-radius: 8px;
  display: flex;
  border: 1px solid #d9d9d9;
  padding: 0px 10px 0px 10px;
  align-items: center;
  appearance: none;
  background-image: url('../../../assets/select-icon.svg');
  background-repeat: no-repeat;
  background-position: right 0.7rem top 50%;
  background-size: 0.65rem auto;
}

.no-data-card {
  height: 305px;
  justify-content: center;
  color: #a6a6a6;
  gap: 5px !important;
}

.no-data-label {
  text-align: center;
}
.selects-postmaster:active {
  border: 1px solid $ds-blue;
}

td {
  height: 50px;
}
th {
  height: 35px;
}
th {
  vertical-align: top;
}
::v-deep.apexcharts-legend-marker {
  border-radius: 12px !important;
}
</style>
