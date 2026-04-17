<template>
  <div class="col-12 pt-0">
    <div>
      <label class="label-title font-16">{{ $t('title.warmupAccountBase') }}</label>
      <v-card class="background-card col-12">
        <div class="row">
          <div class="col-12">
            <label class="label-title font-12">{{ $t('title.account') }}</label>
            <v-autocomplete
              v-model="currentWarmup.accountId"
              item-color="#EBE9E8"
              :elevation="0"
              class="c-autocomplete form-control mo-select"
              :placeholder="$t('input.searchAccount')"
              :no-data-text="$t('create.notRegister')"
              :items="accounts"
              item-text="name"
              item-value="id"
              :multiple="false"
              :outlined="false"
              cache-items
              filled
              solo
              @change="selectAccount"
            />
          </div>

          <div class="col-12 mb-3">
            <label class="label-title font-12">{{ $t('title.pool') }}</label>
            <v-autocomplete
              class="c-autocomplete form-control mo-select"
              :placeholder="
                currentWarmup.accountId && pools.length ? $t('input.searchPool') : $t('input.warmupSelectAccountFirst')
              "
              :no-data-text="$t('create.notRegister')"
              :items="pools"
              item-text="senderEmail"
              :return-object="true"
              :multiple="false"
              :outlined="false"
              :disabled="!pools.length"
              cache-items
              filled
              solo
              @change="selectPool"
            />
          </div>
          <div class="col-12 mb-3">
            <label class="label-title font-12">{{ $t('title.description') }}</label>
            <InputDefault
              data-cy="description"
              :v-model="currentWarmup.description"
              :placeholder="`${$t('input.senderName')}`"
              @updateInput="updateInput"
              :keyInput="'description'"
            />
          </div>

          <div class="col-12 mb-3">
            <v-checkbox
              v-model="isInternalWarmup"
              class="c-checkbox m-0 p-0"
              :label="`${$t('input.isInternalWarmup')}`"
            ></v-checkbox>
          </div>
        </div>
      </v-card>
    </div>
    <div>
      <label class="label-title font-16">{{ $t('title.warmupAccountTarget') }}</label>
      <v-card class="background-card">
        <div class="col-12 mb-3">
          <label class="label-title font-12">{{ $t('title.account') }}</label>
          <v-autocomplete
            @change="selectTargetAccount"
            v-model="currentWarmup.targetAccountId"
            item-color="#EBE9E8"
            :elevation="0"
            class="c-autocomplete form-control mo-select"
            :placeholder="$t('input.searchAccount')"
            :no-data-text="$t('create.notRegister')"
            :items="accounts"
            item-text="name"
            item-value="id"
            :multiple="false"
            :outlined="false"
            cache-items
            filled
            solo
          />
        </div>
        <div class="col-12 mb-3">
          <label class="label-title font-12">{{ $t('title.segment') }}</label>
          <v-autocomplete
            class="c-autocomplete form-control mo-select"
            :placeholder="
              currentWarmup.targetAccountId && segments.length
                ? $t('input.searchSegment')
                : $t('input.warmupSelectAccountFirst')
            "
            :no-data-text="$t('create.notRegister')"
            :items="segments"
            item-text="name"
            :return-object="true"
            :multiple="false"
            :outlined="false"
            :disabled="!segments.length"
            cache-items
            filled
            solo
            @change="selectSegment"
          />
        </div>
      </v-card>
    </div>

    <div>
      <label class="label-title font-16">{{ $t('title.warmupTarget') }}</label>
      <v-card class="background-card col-12">
        <div class="mb-3">
          <label class="label-title font-12">{{ $t('title.warmupTargetDaily') }}</label>
          <select
            data-cy="automation-message-ippool"
            class="form-control mo-select border-color"
            @change="selectTarget($event)"
          >
            <option value="">{{ $t('input.select') }}</option>
            <option v-for="day in Object.entries(warmupLimits)" :value="day" :key="`target-id-${day[0]}`">
              {{ $t('input.warmupTargetDaily', { limit: formatNumber(day[1]) }) }}
            </option>
          </select>

          <apexChart id="chart" height="345" type="line" :options.sync="chartOptions" :series.sync="series"></apexChart>
        </div>
      </v-card>
    </div>

    <div class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="$router.push('/warmups')"
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="currentWarmup.id ? $t('button.edit') : $t('button.create')"
        @click="buttonSave"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import ToastService from '@/services/toast.service';
import WarmupService from '../services/warmup.service';
import PoolService from '@/modules/pools/services/pool.service';
import { WarmupDto } from '../dtos/warmup.dto';
import { PoolDto } from '@/modules/pools/dtos/pool.dto';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import AccountService from '@/modules/accounts/services/account.service';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import VueApexCharts from 'vue-apexcharts';
import { ApexOptions } from 'apexcharts';
import { SegmentDto } from '@/modules/segment/dtos/segment.dto';
import TagService from '@/modules/tags/services/tag.service';

@Component({
  components: { ButtonDefault, InputDefault, VueApexCharts },
})
export default class WarmupCreateEdit extends Vue {
  private readonly warmupService = new WarmupService();
  private readonly poolService = new PoolService();
  private readonly segmentService = new TagService();
  private readonly toastService = new ToastService();
  private readonly accountService = new AccountService();

  currentWarmup: WarmupDto = {} as WarmupDto;
  isInternalWarmup = false;
  pools: PoolDto[] = [] as PoolDto[];
  segments: SegmentDto[] = [] as SegmentDto[];
  accounts: AccountDto[] = [] as AccountDto[];
  warmupLimits = {
    8: 1000,
    14: 10000,
    16: 20000,
    17: 30000,
    18: 50000,
    19: 70000,
    21: 100000,
    23: 250000,
    24: 350000,
    25: 500000,
  };

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
      width: 2,
      dashArray: [8],
    },
    colors: ['#7B61FF'],
    yaxis: {
      labels: {
        formatter: (value: number) => {
          return Vue.filter('formatNumberText')(value);
        },
      },
    },
    xaxis: {
      type: 'category',
      labels: {},
      tooltip: {
        enabled: false,
      },
    },
    tooltip: {
      x: {
        formatter: (value: number) => {
          return `${this.$t('input.day')} ${value}`;
        },
      },
    },
  };

  series = [
    {
      name: this.$t('input.warmupChartLabel'),
      data: [
        160, 224, 312, 440, 616, 864, 1000, 1688, 2360, 3304, 4632, 6480, 8000, 10000, 15000, 20000, 30000, 50000,
        70000, 85000, 100000, 150000, 250000, 350000, 500000,
      ],
    },
  ];

  async beforeMount() {
    const warmupId = +this.$route.params.warmup_id;
    if (warmupId) {
      this.currentWarmup = (await this.warmupService.getWarmupById(warmupId))?.data;
      this.isInternalWarmup = this.currentWarmup.type === 'internal' ? true : false;
    }

    this.accounts = (await this.accountService.getAccounts())?.data;
  }

  async newWarmup() {
    return await this.warmupService.createWarmup({
      accountId: this.currentWarmup.accountId,
      targetAccountId: this.currentWarmup.targetAccountId,
      targetSegmentId: this.currentWarmup.targetSegmentId,
      sender: this.currentWarmup.sender,
      target: this.currentWarmup.target,
      ippool: this.currentWarmup.ippool,
      replyTo: this.currentWarmup.replyTo,
      description: this.currentWarmup.description,
      type: this.isInternalWarmup ? 'internal' : 'external',
      stage: this.isInternalWarmup ? 1 : null,
    });
  }

  async updateWarmup(id: number) {
    return await this.warmupService.updateWarmup(id, {
      accountId: this.currentWarmup.accountId,
      targetAccountId: this.currentWarmup.targetAccountId,
      targetSegmentId: this.currentWarmup.targetSegmentId,
      sender: this.currentWarmup.sender,
      target: this.currentWarmup.target,
      ippool: this.currentWarmup.ippool,
      replyTo: this.currentWarmup.replyTo,
      description: this.currentWarmup.description,
      type: this.isInternalWarmup ? 'internal' : 'external',
      stage: this.isInternalWarmup ? 1 : null,
    });
  }

  async buttonSave() {
    let response;
    if (this.currentWarmup && this.currentWarmup.id) {
      response = await this.updateWarmup(this.currentWarmup.id);
    } else {
      response = await this.newWarmup();
    }

    if (response && response.data && response.data.id) {
      this.toastService.show({
        type: 'success',
        text: this.$t('modal.warmupSaved') as string,
      });

      this.$router.push(`/warmups`);
    }
  }

  updateInput(event: any, keyInput: keyof WarmupDto) {
    (this.currentWarmup[keyInput] as keyof WarmupDto) = event;
  }

  async selectAccount(id: number) {
    this.pools = (await this.poolService.getPools({ accountId: id }))?.data;
  }

  selectPool(item: PoolDto) {
    this.currentWarmup.ippool = item.poolName;
    this.currentWarmup.sender = item.senderEmail;
    this.currentWarmup.replyTo = item.senderReplyTo;
  }

  selectSegment(item: SegmentDto) {
    this.currentWarmup.targetSegmentId = item.id;
  }

  async selectTargetAccount() {
    this.segments = (
      await this.segmentService.getTags({ type: 'segment', accountId: this.currentWarmup.targetAccountId })
    ).data;
  }

  selectTarget(event: any) {
    const value = event.target.value ? event.target.value.split(',') : [0, 0];
    this.currentWarmup.target = value[1];
    this.chartOptions = {
      ...this.chartOptions,
      annotations: {
        points: [
          {
            x: Number(value[0]),
            y: value[1],
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
  }

  formatNumber(value: number) {
    return Vue.filter('formatNumber')(value);
  }
}
</script>
