<template>
  <div id="ComponentLogModal">
    <div class="form-group">
      <v-dialog scrollable v-model="showModal" max-width="90%" width="1400">
        <div class="evolution-card div-column gap-20">
          <div class="div-row justify-space-between align-items-center">
            <span class="ds-gray-color text-600 font-20">
              {{ $t('title.segmentStatistics') }}
            </span>
            <div class="div-row align-items-center gap-10">
              <select v-model="selectedDays" class="days-filter">
                <option :value="30">30 {{ $t('input.days') }}</option>
                <option :value="60">60 {{ $t('input.days') }}</option>
                <option :value="90">90 {{ $t('input.days') }}</option>
              </select>
              <button @click="hideModal()">
                <span class="material-symbols-rounded"> close </span>
              </button>
            </div>
          </div>
          <div class="table-wrapper">
            <apexChart
              class="chart-height chart-container"
              id="chart"
              height="345"
              type="line"
              :options.sync="chartOptions"
              :series.sync="series"
            ></apexChart>
          </div>
          <div class="table-wrapper" v-if="showInChart">
            <span class="ds-gray-color text-600 font-20">
              {{ $t('chart.reasonsForEntering') }}
            </span>
            <apexChart
              class="chart-height chart-container"
              id="chartIn"
              height="345"
              type="line"
              :options.sync="chartInOption"
              :series.sync="seriesIn"
            ></apexChart>
          </div>
          <div class="table-wrapper" v-if="showOutChart">
            <span class="ds-gray-color text-600 font-20">
              {{ $t('chart.reasonsForLeaving') }}
            </span>
            <apexChart
              class="chart-height chart-container"
              id="chartOut"
              height="345"
              type="line"
              :options.sync="chartOutOption"
              :series.sync="seriesOut"
            ></apexChart>
          </div>
          <div class="table-wrapper">
            <v-data-table
              class="table-container"
              :headers="headers"
              :items="data"
              :sort-by.sync="sortBy"
              :sort-desc.sync="sortDesc"
            >
              <template v-slot:[`item.date`]="{ item }">
                <div class="td-item tabular-nums">
                  {{ item.date | formatDateTime }}
                </div>
              </template>

              <template v-slot:[`item.status`]="{ item }">
                <div class="td-item">
                  {{ item.status ? $t('datatable.segmentRun') : $t('datatable.segmentError') }}
                </div>
              </template>

              <template v-slot:[`item.duration`]="{ item }">
                <div class="td-item tabular-nums">
                  {{ milisecondsToMinuteSeconds(item.duration) }}
                </div>
              </template>

              <template v-slot:[`item.count`]="{ item }">
                <div class="td-item tabular-nums">
                  {{ item.count | formatNumber }}
                </div>
              </template>

              <template v-slot:[`item.channels.email`]="{ item }">
                <div class="td-item tabular-nums">
                  {{ item.channels.email | formatNumber }}
                </div>
              </template>

              <template v-slot:[`item.channels.mobile_push`]="{ item }">
                <div class="td-item tabular-nums">
                  {{ item.channels.mobile_push | formatNumber }}
                </div>
              </template>

              <template v-slot:[`item.channels.phone`]="{ item }">
                <div class="td-item tabular-nums">
                  {{ item.channels.phone | formatNumber }}
                </div>
              </template>

              <template v-slot:[`item.channels.web_push`]="{ item }">
                <div class="td-item tabular-nums">
                  {{ item.channels.web_push | formatNumber }}
                </div>
              </template>

              <template v-slot:[`item.whatsapp`]="{ item }">
                <div class="td-item tabular-nums">
                  {{ item.channels.whatsapp | formatNumber }}
                </div>
              </template>
            </v-data-table>
          </div>
        </div>
      </v-dialog>
    </div>
  </div>
</template>

<script lang="ts">
import DataTable from '@/components/data-table/DataTable.vue';
import VueApexCharts from 'vue-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import store from '@/store';

@Component({
  components: { DataTable, VueApexCharts },
  props: ['data', 'dialog'],
})
export default class SegmentLogModal extends Vue {
  @Prop() data!: any;
  @Prop() dialog!: boolean;

  showModal = false;
  selectedDays = 30;
  sortBy = ['date'];
  sortDesc = [true];
  headers = [
    { text: this.$t('datatable.date'), value: 'date', sortable: true },
    { text: this.$t('datatable.status'), value: 'status', sortable: true },
    { text: this.$t('datatable.duration'), value: 'duration', sortable: true, align: 'end' },
    { text: this.$t('datatable.total'), value: 'count', sortable: true, align: 'end' },
    { text: this.$t('title.email'), value: 'channels.email', sortable: true, align: 'end' },
    { text: this.$t('title.mobilePush'), value: 'channels.mobile_push', sortable: true, align: 'end' },
    { text: this.$t('title.phone'), value: 'channels.phone', sortable: true, align: 'end' },
    { text: this.$t('title.webPush'), value: 'channels.web_push', sortable: true, align: 'end' },
    { text: this.$t('title.whatsapp'), value: 'channels.whatsapp', sortable: true, align: 'end' },
  ];

  chartOptions: ApexOptions = {
    chart: {
      id: 'chartSegmentLog',
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
    yaxis: [
      {
        labels: {
          formatter(value: number) {
            return value === null ? '0' : value.toLocaleString();
          },
        },
        title: {
          text: this.$t('datatable.total').toString(),
        },
      },
      {
        opposite: true,
        labels: {
          formatter(value: number) {
            return value === null ? '0' : value.toLocaleString();
          },
        },
        title: {
          text: this.$t('title.insertDelete').toString(),
        },
      },
    ],
  };

  chartInOption: ApexOptions = {
    chart: {
      id: 'chartContactLogIn',
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
    colors: ['#00CEFC', '#50358A'],
    xaxis: {
      categories: [] as string[],
    },
    yaxis: [
      {
        labels: {
          formatter(value: number) {
            return value === null ? '0' : value.toLocaleString();
          },
        },
        title: {
          text: this.$t('datatable.total').toString(),
        },
      },
    ],
  };

  chartOutOption: ApexOptions = {
    chart: {
      id: 'chartContactLog',
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
    colors: ['#00CEFC', '#50358A', '#FF9654', '#FFDC00', '#009E60'],
    xaxis: {
      categories: [] as string[],
    },
    yaxis: [
      {
        labels: {
          formatter(value: number) {
            return value === null ? '0' : value.toLocaleString();
          },
        },
        title: {
          text: this.$t('datatable.total').toString(),
        },
      },
    ],
  };
  showInChart = false;
  showOutChart = false;

  series: any[] = [];
  seriesIn: any[] = [];
  seriesOut: any[] = [];
  totalPerDayIn: number[] = [];
  totalPerDayOut: number[] = [];

  hideModal() {
    this.$emit('hideModal', false);
  }

  beforeMount() {
    this.showModal = this.dialog;
  }

  fillChartOptions() {
    const allFiltered = this.getLatestEntriesPerDate(this.data);
    const filteredData = allFiltered.slice(-this.selectedDays);

    const dates = filteredData.map((item: any) => {
      const date = new Date(item.date);
      return date.toLocaleDateString(store.state.userLanguage, {
        day: 'numeric',
        month: 'short',
      });
    });

    this.chartOptions = {
      ...this.chartOptions,
      xaxis: {
        categories: dates,
      },
    };

    const totalSeries = {
      name: this.$t('datatable.total'),
      data: filteredData.map((item: any) => Number(item.count)),
    };

    const insertData = filteredData.map((item: any) => item.insert || 0);
    const deleteData = filteredData.map((item: any) => item.delete || 0);

    const inInfo: { byBought: any[]; byReengaged: any[] } = {
      byBought: [],
      byReengaged: [],
    };
    const outInfo: { byBounce: any[]; byUnsub: any[]; byTag: any[]; byInvalid: any[]; byEngagement: any[] } = {
      byBounce: [],
      byUnsub: [],
      byTag: [],
      byInvalid: [],
      byEngagement: [],
    };
    for (const item of filteredData) {
      if (item.inInfo) {
        this.showInChart = true;
      }
      if (item.outInfo) {
        this.showOutChart = true;
      }
      inInfo.byBought.push(item.inInfo?.bought || 0);
      inInfo.byReengaged.push(item.inInfo?.reengaged || 0);
      this.totalPerDayIn.push(item?.insert || 0);

      outInfo.byBounce.push(item.outInfo?.bounce_qtd || 0);
      outInfo.byUnsub.push(item.outInfo?.unsub_qtd || 0);
      outInfo.byTag.push(item.outInfo?.in_tag_qtd || 0);
      outInfo.byInvalid.push(item.outInfo?.invalid_qtd || 0);
      outInfo.byEngagement.push(item.outInfo?.engagement_qtd || 0);
      this.totalPerDayOut.push(item?.delete || 0);
    }

    if (this.showInChart) {
      this.seriesIn = (Object.keys(inInfo) as Array<keyof typeof inInfo>).map((key) => {
        return {
          name: this.$t(`chart.${key}`),
          data: inInfo[key],
        };
      });
      this.chartInOption = {
        ...this.chartInOption,
        xaxis: {
          categories: dates,
        },
        tooltip: {
          y: {
            formatter: (value: number, { dataPointIndex }) => {
              const total = this.totalPerDayIn[dataPointIndex] || 0;
              const percent = total > 0 && value ? ((value / total) * 100).toFixed(2) : '0.00';
              return `${value || 0} (${percent}%)`;
            },
          },
        },
      };
    }

    if (this.showOutChart) {
      this.seriesOut = (Object.keys(outInfo) as Array<keyof typeof outInfo>).map((key) => {
        return {
          name: this.$t(`chart.${key}`),
          data: outInfo[key],
        };
      });
      this.chartOutOption = {
        ...this.chartOutOption,
        xaxis: {
          categories: dates,
        },
        tooltip: {
          y: {
            formatter: (value: number, { dataPointIndex }) => {
              const total = this.totalPerDayOut[dataPointIndex] || 0;
              const percent = total > 0 && value ? ((value / total) * 100).toFixed(2) : '0.00';
              return `${value || 0} (${percent}%)`;
            },
          },
        },
      };
    }

    this.series = [
      totalSeries,
      {
        name: this.$t('title.insert'),
        data: insertData,
        yAxisIndex: 1,
      },
      {
        name: this.$t('title.delete'),
        data: deleteData,
        yAxisIndex: 1,
      },
    ];
  }

  getLatestEntriesPerDate(data: any[]): any[] {
    const dateMap = new Map<string, any>();

    data.forEach((item) => {
      const dateOnly = item.date.split('T')[0];
      const currentEntry = dateMap.get(dateOnly);

      if (!currentEntry || new Date(item.date) > new Date(currentEntry.date)) {
        let newObject = item;
        if (currentEntry && item.status) {
          newObject = {
            ...currentEntry,
            count: item.count,
            delete: currentEntry.delete + item.delete,
            insert: currentEntry.insert + item.insert,
            ...(currentEntry.inInfo && item.inInfo
              ? {
                  inInfo: {
                    bought: (currentEntry.inInfo.bought || 0) + (item.inInfo.bought || 0),
                    reengaged: (currentEntry.inInfo.reengaged || 0) + (item.inInfo.reengaged || 0),
                  },
                }
              : item.inInfo
                ? { inInfo: item.inInfo }
                : {}),
            ...(currentEntry.outInfo && item.outInfo
              ? {
                  outInfo: {
                    open_qtd: (currentEntry.outInfo.open_qtd || 0) + (item.outInfo.open_qtd || 0),
                    click_qtd: (currentEntry.outInfo.click_qtd || 0) + (item.outInfo.click_qtd || 0),
                    unsub_qtd: (currentEntry.outInfo.unsub_qtd || 0) + (item.outInfo.unsub_qtd || 0),
                    bounce_qtd: (currentEntry.outInfo.bounce_qtd || 0) + (item.outInfo.bounce_qtd || 0),
                    in_tag_qtd: (currentEntry.outInfo.in_tag_qtd || 0) + (item.outInfo.in_tag_qtd || 0),
                    invalid_qtd: (currentEntry.outInfo.invalid_qtd || 0) + (item.outInfo.invalid_qtd || 0),
                    engagement_qtd: (currentEntry.outInfo.engagement_qtd || 0) + (item.outInfo.engagement_qtd || 0),
                  },
                }
              : item.outInfo
                ? { outInfo: item.outInfo }
                : {}),
          };
        }
        dateMap.set(dateOnly, newObject);
      }
    });

    return Array.from(dateMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  milisecondsToMinuteSeconds(miliseconds: number): string {
    if (!miliseconds) {
      return '';
    }
    const minutes = Math.floor(miliseconds / 60000);
    const seconds = ((miliseconds % 60000) / 1000).toFixed(0);
    return minutes + ':' + (seconds.length < 2 ? '0' : '') + seconds;
  }

  @Watch('dialog')
  propsChanged() {
    this.showModal = this.dialog;
  }

  @Watch('showModal')
  dialogChanged() {
    this.$emit('hideModal', this.showModal);
  }

  @Watch('data')
  dataChanged() {
    this.fillChartOptions();
  }

  @Watch('selectedDays')
  selectedDaysChanged() {
    this.fillChartOptions();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

::v-deep .v-data-table__wrapper > table > thead > tr > th {
  font-size: 14px !important;
  padding: 10px !important;
}

#ComponentLogModal {
  width: 100%;
}

.days-filter {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background-color: white;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;

  &:hover {
    border-color: #9ca3af;
  }

  &:focus {
    border-color: #6366f1;
  }
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

.evolution-card {
  width: 100%;
  height: 100%;
  background-color: $neutral-basic-white;
  border-radius: 16px;
  padding: 20px;
}

.chart-height {
  height: 380px;
}

@media only screen and (max-width: 1023px) {
  .table-wrapper {
    overflow-x: auto;
    overflow-y: hidden;
  }
}

@media only screen and (min-width: 1024px) {
  .table-wrapper {
    overflow: hidden;
  }
}

.chart-container {
  min-width: 850px;
}

.table-container {
  min-width: 1200px;
}

::v-deep .v-dialog {
  border-radius: 16px !important;
  display: flex;
  justify-content: center;
}
</style>
