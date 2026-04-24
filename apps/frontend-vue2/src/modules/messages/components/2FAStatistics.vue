<template>
  <div class="statistics-card div-column gap-10">
    <div class="div-row w-100 justify-content-start">
      <span class="font-14 ds-blue-color text-600">
        {{ period }}
      </span>
    </div>
    <div class="div-column gap-15 w-100">
      <div class="div-column gap-10 w-100">
        <span class="font-14 ds-gray-color text-600">
          {{ $t('title.generateAndSendCode') }}
        </span>
        <div class="statistics-cards">
          <div class="statistic-item">
            <span class="font-12 ds-gray-color text-600 text-nowrap">{{ $t('title.countRequests') }}</span>
            <span class="font-16 text-600">{{ formatNumber(statistic.count_total) }}</span>
          </div>
          <div class="statistic-item">
            <span class="font-12 ds-gray-color text-600 text-nowrap">{{ $t('title.successRequests') }}</span>
            <span class="font-16 text-600 success-color">{{ formatNumber(statistic.count_success) }}</span>
          </div>
          <div class="statistic-item">
            <span class="font-12 ds-gray-color text-600 text-nowrap">{{ $t('title.errorRequests') }}</span>
            <span class="font-16 text-600 error-color">{{ formatNumber(statistic.count_error) }}</span>
          </div>
        </div>
      </div>
      <div class="div-column gap-10 w-100 pb-1">
        <span class="font-14 ds-gray-color text-600">
          {{ $t('title.validateCode') }}
        </span>
        <div class="statistics-cards">
          <div class="statistic-item">
            <span class="font-12 ds-gray-color text-600 text-nowrap">{{ $t('title.countRequests') }}</span>
            <span class="font-16 text-600">{{ formatNumber(getTotal()) }}</span>
          </div>
          <div class="statistic-item">
            <span class="font-12 ds-gray-color text-600 text-nowrap">{{ $t('title.validated2FA') }}</span>
            <span class="font-16 text-600 success-color">{{ formatNumber(statistic.count_verify_validated) }}</span>
          </div>
          <div class="statistic-item">
            <span class="font-12 ds-gray-color text-600 text-nowrap">{{ $t('title.rejected2FA') }}</span>
            <span class="font-16 text-600 error-color">{{ formatNumber(statistic.count_verify_rejected) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import dayjs from 'dayjs';

@Component({
  props: ['statistic', 'period'],
})
export default class TwoFAStatistics extends Vue {
  @Prop() private statistic!: {
    method: string;
    count_total: number;
    count_success: number;
    count_error: number;
    count_verify_validated: number;
    count_verify_rejected: number;
  };
  @Prop() private period!: string;

  formatNumber(value: number) {
    return Vue.filter('formatNumber')(value);
  }

  getTotal() {
    return this.statistic.count_verify_validated + this.statistic.count_verify_rejected;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.statistics-card {
  border-radius: 16px;
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.1),
    0px 1px 2px 0px rgba(0, 0, 0, 0.06);
  background-color: $neutral-basic-white;
  padding: 20px;
  width: 600px;
  align-self: center;
}

.method-badge {
  background-color: #f4f8ff;
  padding: 4px 8px;
  border-radius: 8px;
  color: $ds-blue;
}

.statistics-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  width: 100%;
  overflow-x: auto;
}

.statistic-item {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  border: 1px solid $ds-gray-200;
  gap: 5px;
  text-align: start;
  padding: 10px;
  width: 100%;
  min-width: 175px;
  height: fit-content;
}

.success-color {
  color: #0fb75c;
}

.error-color {
  color: #dc3545;
}
</style>
