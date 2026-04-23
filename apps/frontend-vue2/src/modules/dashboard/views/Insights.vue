<template>
  <div class="col-12">
    <div class="title-route">
      <h2 class="c-title">{{ $t('sidebar.insights') }}</h2>
    </div>
    <div class="d-flex mb-4 menu-container">
      <v-menu ref="filterMenu" v-model="filterMenu" bottom :close-on-content-click="true" offset-y>
        <template v-slot:activator="{ on }">
          <div
            class="period-items cursor-pointer gap-15 w-100"
            :class="{ 'period-button-open': filterMenu === true }"
            v-on="on"
          >
            <div class="div-row period-name gap-10">
              <span v-if="selectedFilter && filterMenu === false" class="font-12 ds-gray-color text-600">
                {{ selectedFilter.label }}
              </span>
              <span v-else class="font-12 select-metric">{{ $t('input.selectPeriod') }}</span>
            </div>
            <span
              class="ds-gray-color material-symbols-rounded"
              :class="{ 'icon-dropdown ds-blue-color': filterMenu === true }"
              dense
            >
              arrow_drop_down
            </span>
          </div>
        </template>
        <div class="div-column cursor-pointer period-div" :class="{ 'filters-card-open': filterMenu === true }">
          <div
            v-for="(filter, index) in filterOptions"
            :key="`period-${index}`"
            class="div-row period-options px-3"
            @click="selectFilter(filter)"
          >
            <span class="ds-gray-color period-label font-12">{{ filter.label }}</span>
          </div>
        </div>
      </v-menu>
    </div>
    <div class="charts-grid w-100">
      <div v-for="metric in metrics" :key="metric.name" class="chart-container div-column w-100">
        <span class="text-600 font-16 ds-gray-color">{{ metric.name }}</span>
        <DataLoader :isLoading="isLoadingData" :type="'image, list-item-two-line'" />
        <div class="chart-background" v-if="!isLoadingData && metricsValues.length">
          <apexChart
            :key="`chart-${metric.value}`"
            ref="chart"
            id="chart"
            :height="350"
            :width="'100%'"
            type="line"
            :options="chartOptions[metric.value]"
            :series="chartSeries[metric.value]"
          ></apexChart>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import DashboardService from '../services/dashboard.service';
import VueApexCharts from 'vue-apexcharts';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { mapState } from 'vuex';
dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: { VueApexCharts, DataLoader },
  computed: {
    ...mapState(['currentAccountTimezone']),
  },
})
export default class Insights extends Vue {
  private readonly dashboardService = new DashboardService();
  public currentAccountTimezone!: string;

  isLoadingData = false;
  noData = false;
  filterMenu = false;
  selectedFilter = {
    label: '',
    value: '',
  };
  metricSeries: any[] = [];
  metricsValues: any[] = [];
  filterOptions = [
    {
      label: this.$t('input.todayYesterday') as string,
      value: 'last48',
    },
    {
      label: this.$t('input.last7Days') as string,
      value: 'last7',
    },
  ];
  metricOptions = {
    chart: {
      zoom: {
        enabled: false,
      },
      type: 'chart',
      toolbar: {
        show: false,
      },
      align: 'center',
      width: '100%',
      height: '100%',
      redrawOnWindowResize: true,
      animations: {
        enabled: true,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'straight',
      width: 2,
    },
    markers: {
      size: 4,
      fillOpacity: 1,
      strokeWidth: 0,
      hover: {
        size: undefined,
        sizeOffset: 1,
      },
    },
    xaxis: {
      type: 'category',
      categories: [] as string[],
      labels: {
        hideOverlappingLabels: false,
        trim: false,
        style: {
          fontSize: '10px',
        },
        rotate: 0,
      },
      axisBorder: {
        show: true,
      },
      axisTicks: {
        show: true,
      },
      tickAmount: 23,
      tickPlacement: 'on',
      tooltip: {
        enabled: false,
      },
    },
    yaxis: {
      min: 0,
      tickAmount: 5,
      labels: {},
    },
    colors: [] as string[],
    tooltip: {
      marker: {
        show: false,
      },
      x: {
        show: false,
      },
      y: {
        show: true,
      },
    },
    legend: {
      offsetY: 8,
      itemMargin: {
        vertical: 2,
      },
    },
  };
  metrics = [
    {
      name: this.$t('datatable.delivered') as string,
      value: 'delivered',
      colors: ['#8ec5ff', '#51a2ff', '#2b7fff', '#155dfc', '#1447e6', '#193cb8', '#1c398e'],
    },
    {
      name: this.$t('title.open') as string,
      value: 'open',
      colors: ['#7bf1a8', '#05df72', '#00c951', '#00a63e', '#008236', '#016630', '#0d542b'],
    },
    {
      name: this.$t('title.click') as string,
      value: 'click',
      colors: ['#53eafd', '#00d3f2', '#00b8db', '#0092b8', '#007595', '#005f78', '#104e64'],
    },
    {
      name: this.$t('datatable.unsubscribe') as string,
      value: 'unsubscribe',
      colors: ['#ffa2a2', '#ff6467', '#fb2c36', '#e7000b', '#c10007', '#9f0712', '#82181a'],
    },
    {
      name: 'Bounce',
      value: 'bounce',
      colors: ['#ffb86a', '#ff8904', '#ff6900', '#f54a00', '#ca3500', '#9f2d00', '#7e2a0c'],
    },
  ];

  get chartOptions() {
    return this.metrics.reduce(
      (acc, metric) => {
        if (!this.metricsValues?.length || this.isLoadingData) {
          acc[metric.value] = this.metricOptions;
        } else {
          const values = this.metricsValues.flatMap((day) => Object.values(day[metric.value] || {}));
          const maxValue = Math.max(...values.map((value) => value as number));
          const yaxisMax = this.getNiceScale(maxValue);

          acc[metric.value] = {
            ...this.metricOptions,
            xaxis: {
              ...this.metricOptions.xaxis,
              categories: Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')),
              labels: {
                ...this.metricOptions.xaxis.labels,
                formatter: (value: string) => `${value}H`,
              },
            },
            yaxis: {
              ...this.metricOptions.yaxis,
              max: yaxisMax,
              tickAmount: 5,
              labels: {
                formatter: (value: number) => {
                  const roundedValue = Math.round(value / 5) * 5;
                  if (roundedValue >= 1000000) {
                    return `${roundedValue / 1000000}M`;
                  }
                  if (roundedValue >= 1000) {
                    return `${roundedValue / 1000}K`;
                  }
                  return roundedValue.toString();
                },
              },
            },
            // colors: metric.colors,
            tooltip: {
              x: { show: false },
              y: {
                show: true,
                formatter: (value: number) => Vue.filter('formatNumber')(value),
                title: {
                  formatter: (seriesName: string, opts: any) => {
                    const hour = opts.dataPointIndex.toString().padStart(2, '0');
                    return `${seriesName} - ${hour}H:`;
                  },
                },
              },
            },
          };
        }
        return acc;
      },
      {} as Record<string, any>
    );
  }

  get chartSeries() {
    return this.metrics.reduce(
      (acc, metric) => {
        if (!this.metricsValues?.length || this.isLoadingData) {
          acc[metric.value] = [];
        } else {
          acc[metric.value] = this.metricsValues.map((day) => ({
            name: dayjs(day.date).format('DD/MM/YYYY'),
            data: Array.from({ length: 24 }, (_, i) => {
              const hour = i.toString().padStart(2, '0');
              return (day[metric.value as keyof typeof day] as Record<string, number>)?.[hour] || 0;
            }),
          }));
        }
        return acc;
      },
      {} as Record<string, any>
    );
  }

  get hasMetricsData(): boolean {
    return this.metricsValues.length >= 2;
  }

  async beforeMount() {
    this.getValuesUrl();
    await this.getInsightsData();
  }

  getNiceScale(maxValue: number) {
    const magnitude = Math.floor(Math.log10(maxValue));
    const base = Math.pow(10, magnitude);
    const step = base / 2;
    const niceMax = Math.ceil(maxValue / step) * step;
    return Math.ceil(niceMax / 5) * 5;
  }

  async selectFilter(filter: any) {
    this.selectedFilter = filter;
    this.filterMenu = false;
    await this.getInsightsData();
  }

  async getInsightsData() {
    this.isLoadingData = true;
    const response = await this.dashboardService.getInsightsData(this.selectedFilter.value);
    this.metricsValues = response.data;
    this.metricsValues = this.metricsValues.filter(Boolean).sort((a, b) => {
      const dateA = dayjs(a.date);
      const dateB = dayjs(b.date);
      return dateA.isBefore(dateB) ? -1 : 1;
    });
    this.setValuesUrl();
    this.isLoadingData = false;
  }

  getValuesUrl() {
    if (this.$route.query.filter) {
      this.selectedFilter = this.filterOptions.find((option) => option.value === this.$route.query.filter) as any;
    } else {
      this.selectedFilter = this.filterOptions[0];
    }
  }

  setValuesUrl() {
    if (this.$route.query.filter !== this.selectedFilter.value) {
      this.$router.push({
        query: {
          filter: this.selectedFilter.value,
        },
      });
    }
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.menu-container {
  width: 200px;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  width: 100%;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr !important;
  }
}

.chart-container {
  gap: 10px;
  min-width: 0;
  width: 100%;
}

.chart-background {
  border-radius: 16px;
  background-color: #ffffff;
  padding: 10px 10px 5px 10px;
  box-shadow: 0px 1px 3px 0px #0000001a;
  box-shadow: 0px 1px 2px 0px #0000000f;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.no-data-card {
  height: 305px;
  justify-content: center;
  color: #a6a6a6;
  gap: 5px !important;
}

.period-items {
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

.period-name {
  align-items: center;
}

.select-metric {
  color: #d9d9d9;
}

.period-div {
  background-color: #ffffff;
}

.period-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100 !important;
  border-top: 1px solid $ds-blue !important;
  border-right: 1px solid $ds-blue !important;
  border-left: 1px solid $ds-blue !important;
}

.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.period-options {
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

.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
