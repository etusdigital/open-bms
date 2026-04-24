<template>
  <div class="col-12 pt-0 div-column">
    <div class="div-row">
      <div class="div-row gap-20">
        <div class="div-row gap-10 align-items-center text-600">
          <button class="material-symbols-rounded font-24" @click="previousWeek">chevron_left</button>
          <span class="font-12">
            {{ currentWeekStart.format('DD/MM/YYYY') }} - {{ currentWeekStart.add(6, 'day').format('DD/MM/YYYY') }}
          </span>
          <button class="material-symbols-rounded font-24" @click="nextWeek">chevron_right</button>
        </div>
      </div>
    </div>
    <DataLoader :isLoading="isLoadingProducts" :type="'table-heading, list-item-two-line'" class="mt-5" />
    <div v-if="!isLoadingProducts" class="div-row w-100 mt-5 product-table border-table border-8 overflow-auto">
      <table class="w-100">
        <thead>
          <tr class="text-600 font-14">
            <th class="px-5 py-4 text-center time-background">
              {{ $t('input.productHour') }}
            </th>
            <th
              v-for="day in weekDays"
              :key="`day-${day.date}`"
              class="px-5 py-4 text-center header-right-radius"
              :class="{ 'today-column-header': isToday(day.date) }"
            >
              <div class="day-header">
                <span>{{ day.title }}</span>
                <span v-if="getProductCountForDay(day.date) > 0" class="product-count-chip">
                  {{ getProductCountForDay(day.date) }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="hour in dayHours" :key="hour.key">
            <td class="px-5 py-4 text-center text-600 font-14 hours-background">
              {{ hour.title }}
            </td>
            <td
              class="p-2 product-background text-center align-content-start"
              :class="{ 'today-column-cell': isToday(days.date) }"
              v-for="days in weekDays"
              :key="`day-${days.date}`"
            >
              <div
                class="div-column gap-5 align-items-center"
                v-if="getCampaignsForDayAndHour(days.date, hour.title).length > 0"
              >
                <div
                  class="div-column border-8 border-table text-start p-2 card-campaign cursor-pointer position-relative"
                  v-for="(campaign, index) in getCampaignsForDayAndHour(days.date, hour.title)"
                  :key="`campaign-${index}`"
                  @mouseenter="setHoveredProduct(campaign, days.date, hour.title, index, $event)"
                  @mouseleave="clearHoveredProduct()"
                >
                  <div
                    class="div-column text-start product-info"
                    @click="selectCampaign(campaign, days.date, hour.title)"
                  >
                    <span class="text-600 font-14" padding-bottom="4px">{{ campaign.title }}</span>
                    <div class="link-container">
                      <span v-if="!Array.isArray(campaign.link)" class="font-12 campaign-link">
                        {{ campaign.link }}
                      </span>

                      <div v-else class="links-expanded-card">
                        <span
                          v-for="(link, linkIndex) in campaign.link"
                          :key="`link-${linkIndex}`"
                          class="font-12 campaign-link individual-link-card"
                        >
                          {{ link }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="
                      isProductHovered(campaign, days.date, hour.title, index) && (campaign.messages || campaign.tags)
                    "
                    class="tags-tooltip"
                  >
                    <div class="tooltip-arrow"></div>
                    <div class="tooltip-content">
                      <div v-if="campaign.messages && campaign.messages.length > 0" class="tooltip-section">
                        <div class="tooltip-title font-12 text-600 mb-2">Mensagens</div>
                        <div class="messages-wrapper">
                          <div
                            v-for="(message, msgIndex) in campaign.messages.slice(0, 4)"
                            :key="`msg-${msgIndex}`"
                            class="status-chip status-message font-10 message-chip"
                          >
                            <div v-if="message.campaign_message_winner" class="winner-trophy">🏆</div>

                            <div class="message-info">
                              <div class="message-name">
                                <span class="message-label">{{ $t('input.messageNameLabel') }}:</span>
                                {{ message.message_name }}
                              </div>
                              <div class="message-subject">
                                <span class="message-label">{{ $t('input.messageSubjectLabel') }}:</span>
                                {{ message.message_subject }}
                              </div>
                              <div class="message-sender">
                                <span class="message-label">{{ $t('input.messageSenderLabel') }}:</span>
                                {{ message.message_sender }}
                              </div>
                              <div class="message-sender-name">
                                <span class="message-label">{{ $t('input.messageSenderNameLabel') }}:</span>
                                {{ message.message_sender_name }}
                              </div>

                              <div v-if="message.campaign_message_statistics" class="message-statistics">
                                <div class="statistics-title">
                                  <span class="message-label">{{ $t('input.statisticsLabel') }}:</span>
                                </div>
                                <div class="statistics-grid">
                                  <div v-if="message.campaign_message_statistics.delivered" class="stat-item">
                                    <span class="stat-label">{{ $t('input.deliveredLabel') }}:</span>
                                    <span class="stat-value">{{ message.campaign_message_statistics.delivered }}</span>
                                  </div>
                                  <div v-if="message.campaign_message_statistics.open" class="stat-item">
                                    <span class="stat-label">{{ $t('input.openLabel') }}:</span>
                                    <span class="stat-value">{{ message.campaign_message_statistics.open }}</span>
                                  </div>
                                  <div v-if="message.campaign_message_statistics.click" class="stat-item">
                                    <span class="stat-label">{{ $t('input.clickLabel') }}:</span>
                                    <span class="stat-value">{{ message.campaign_message_statistics.click }}</span>
                                  </div>
                                  <div v-if="message.campaign_message_statistics.bounce" class="stat-item">
                                    <span class="stat-label">{{ $t('input.bounceLabel') }}:</span>
                                    <span class="stat-value">{{ message.campaign_message_statistics.bounce }}</span>
                                  </div>
                                  <div v-if="message.campaign_message_statistics.unsubscribe" class="stat-item">
                                    <span class="stat-label">{{ $t('input.unsubscribeLabel') }}:</span>
                                    <span class="stat-value">{{
                                      message.campaign_message_statistics.unsubscribe
                                    }}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <span v-if="campaign.messages.length > 4" class="font-10 text-600 more-items">
                            +{{ campaign.messages.length - 4 }} mais
                          </span>
                        </div>
                      </div>

                      <!-- Tags section -->
                      <div v-if="campaign.tags || campaign.sendToAll" class="tooltip-section">
                        <div class="tooltip-title font-12 text-600 mb-2">Tags</div>
                        <div v-if="campaign.sendToAll" class="tags-wrapper">
                          <span class="status-chip status-draft font-10">
                            {{ $t('create.campaignSendToAll') }}
                          </span>
                        </div>
                        <div class="tags-wrapper" v-else-if="campaign.tags">
                          <span
                            v-for="(keyTag, tagIndex) in Object.keys(campaign.tags).slice(0, 6)"
                            :key="`tag-${tagIndex}`"
                            class="status-chip status-draft font-10"
                          >
                            {{ campaign.tags[keyTag].name }}
                          </span>
                          <span v-if="Object.keys(campaign.tags).length > 6" class="font-10 text-600 more-items">
                            +{{ Object.keys(campaign.tags).length - 6 }} mais
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="d-flex pl-1 text-start" v-else>
                <span class="font-12 text-start ds-gray-color">{{ $t('input.noProduct') }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { ProductDto } from '@/modules/products/dtos/product.dto';
import ProductService from '../services/product.service';
import ToastService from '@/services/toast.service';
import dayjs, { Dayjs } from 'dayjs';
import { mapState } from 'vuex';
import 'dayjs/locale/pt-br';

interface DateProduct {
  [hour: string]: {
    products: Array<ProductItem>;
  };
}

interface ProductItem {
  title: string;
  link: string;
  message_name: string;
  tags: any;
}

@Component({
  components: { InputDefault, ButtonDefault, DataLoader },
  computed: {
    ...mapState(['userLanguage', 'currentAccountTimezone']),
  },
})
export default class Product extends Vue {
  private readonly productService = new ProductService();
  private readonly toastService = new ToastService();
  private editingSlot: { date: string; hour: string; productIndex: number } | null = null;
  public userLanguage!: string;
  public currentAccountTimezone!: string;

  currentWeekStart = dayjs().startOf('week').add(1, 'day');
  product: ProductDto = {
    status: 'pending',
  } as ProductDto;

  products: any[] = [];

  dialog = false;
  menu = false;
  selectedProduct: any = [];
  selectedCampaign: any = [];
  filteredProducts: any = [];
  isLoadingProducts = false;
  hoveredProduct: string | null = null;

  beforeMount() {
    this.getProducts({
      date: this.currentWeekStart.format('YYYY-MM-DD'),
      timezone: this.currentAccountTimezone || 'UTC',
    });
  }

  async getProducts(params?: any) {
    if (this.isLoadingProducts) {
      return;
    }

    this.isLoadingProducts = true;
    try {
      params = params || {
        date: this.currentWeekStart.format('YYYY-MM-DD'),
        timezone: this.currentAccountTimezone || 'UTC',
      };
      const response = await this.productService.getProduct(params);
      this.products = response.data.products;
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoadingProducts = false;
    }
  }

  get dayHours() {
    const hours = new Set<string>();

    this.products.forEach((campaign) => {
      Object.values(campaign).forEach((dateData) => {
        if (typeof dateData === 'object' && dateData !== null) {
          Object.keys(dateData).forEach((hour) => hours.add(hour));
        }
      });
    });

    return Array.from(hours)
      .sort()
      .map((hour) => ({
        title: hour,
        key: `time-${hour.replace(':', '')}`,
      }));
  }

  get weekDays() {
    return Array.from({ length: 7 }, (_, i) => {
      const date = this.currentWeekStart.add(i, 'day');
      return {
        title: `${date.locale(this.userLanguage.toLowerCase().replace('-us', '')).format('ddd')}., ${date.format('D')}`,
        day: date.format('dddd').toLowerCase(),
        month: date.format('MMMM'),
        year: date.format('YYYY'),
        date,
      };
    });
  }

  get canGoNext() {
    return true;
    // const twoWeeksAhead = dayjs().startOf('week').add(1, 'day').add(14, 'day');
    // return this.currentWeekStart.isBefore(twoWeeksAhead);
  }

  get selectedProductTitle() {
    return this.selectedProduct?.title || this.$t('input.select');
  }

  getCampaignsForDayAndHour(date: any, hour: string) {
    const dateStr = date.format('YYYY-MM-DD');
    const campaign = this.products.find((c) => {
      const productData = c[dateStr] as DateProduct;
      return productData && productData[hour];
    });

    if (!campaign) {
      return [];
    }
    const dateData = campaign[dateStr] as DateProduct;
    return dateData?.[hour]?.products || [];
  }

  getProductCountForDay(date: any): number {
    const dateStr = date.format('YYYY-MM-DD');
    let totalProducts = 0;

    this.products.forEach((campaign) => {
      const dateData = campaign[dateStr] as DateProduct;
      if (dateData) {
        Object.values(dateData).forEach((hourData) => {
          if (hourData && hourData.products) {
            totalProducts += hourData.products.length;
          }
        });
      }
    });

    return totalProducts;
  }

  isToday(date: any): boolean {
    return date.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
  }

  nextWeek() {
    if (this.canGoNext) {
      this.currentWeekStart = this.currentWeekStart.add(7, 'day');
    }
    const params = {
      date: this.currentWeekStart.format('YYYY-MM-DD'),
      timezone: this.currentAccountTimezone || 'UTC',
    };
    this.getProducts(params);
  }

  previousWeek() {
    this.currentWeekStart = this.currentWeekStart.subtract(7, 'day');
    const params = {
      date: this.currentWeekStart.format('YYYY-MM-DD'),
      timezone: this.currentAccountTimezone || 'UTC',
    };
    this.getProducts(params);
  }

  selectCampaign(campaign: any, date: Dayjs, hour: string) {
    this.selectedCampaign = campaign;
    this.editingSlot = {
      date: date.format('YYYY-MM-DD'),
      hour,
      productIndex: this.getCampaignsForDayAndHour(date, hour).findIndex(
        (index: any) => index.message_name === campaign.message_name
      ),
    };
    this.dialog = true;
    this.selectedProduct = null;
  }

  changeCampaign() {
    if (!this.selectedProduct || !this.editingSlot) {
      return;
    }

    const { date, hour, productIndex } = this.editingSlot;
    const campaignIndex = this.products.findIndex((c) => {
      const productData = c[date] as DateProduct;
      return productData && productData[hour];
    });

    if (campaignIndex !== -1 && productIndex !== -1) {
      const dateData = this.products[campaignIndex][date] as DateProduct;
      dateData[hour].products[productIndex] = this.selectedProduct;
    }

    this.dialog = false;
    this.selectedProduct = null;
    this.editingSlot = null;
  }

  viewMessage(campaign: any) {}

  getProductId(campaign: any, date: any, hour: string, index: number): string {
    const linkString = Array.isArray(campaign.link) ? campaign.link.join('-') : campaign.link;
    const messageString = campaign.messages ? campaign.messages.map((m: any) => m.message_name).join('-') : '';
    return `${messageString}-${date.format('YYYY-MM-DD')}-${hour}-${linkString}-${index}`;
  }

  setHoveredProduct(campaign: any, date: any, hour: string, index: number, event: MouseEvent): void {
    this.hoveredProduct = this.getProductId(campaign, date, hour, index);
    this.$nextTick(() => {
      this.positionTooltip(event);
    });
  }

  clearHoveredProduct(): void {
    this.hoveredProduct = null;
  }

  isProductHovered(campaign: any, date: any, hour: string, index: number): boolean {
    return this.hoveredProduct === this.getProductId(campaign, date, hour, index);
  }

  positionTooltip(event: MouseEvent): void {
    const tooltip = document.querySelector('.tags-tooltip') as HTMLElement;
    if (!tooltip) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - 10;

    const margin = 10;
    if (left < margin) {
      left = margin;
    } else if (left + tooltipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tooltipRect.width - margin;
    }

    if (top < margin) {
      top = rect.bottom + 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    const arrow = tooltip.querySelector('.tooltip-arrow') as HTMLElement;
    if (arrow) {
      const cardCenter = rect.left + rect.width / 2;
      const tooltipLeft = left;
      const arrowPosition = cardCenter - tooltipLeft;

      arrow.style.left = `${Math.max(10, Math.min(arrowPosition, tooltipRect.width - 10))}px`;
      arrow.style.transform = 'translateX(-50%)';

      if (top > rect.bottom) {
        arrow.style.top = '-6px';
        arrow.style.bottom = 'auto';
        arrow.style.borderLeft = '6px solid transparent';
        arrow.style.borderRight = '6px solid transparent';
        arrow.style.borderTop = 'none';
        arrow.style.borderBottom = '6px solid white';
      } else {
        arrow.style.top = 'auto';
        arrow.style.bottom = '-6px';
        arrow.style.borderLeft = '6px solid transparent';
        arrow.style.borderRight = '6px solid transparent';
        arrow.style.borderTop = '6px solid white';
        arrow.style.borderBottom = 'none';
      }
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.status-border {
  border: 1px solid #e4e4e7;
}

.background-pending {
  background-color: #fef9c3;
}

.background-approved {
  background-color: #dcfce7;
}

.approve-button {
  background-color: $ds-blue;
}

.product-table {
  box-shadow:
    0px 4px 6px -4px #0000001a,
    0px 10px 15px -3px #0000001a;
  border-radius: 12px;
  overflow: hidden;
}

.time-background {
  background-color: #e5e7eb;
}

.header-background {
  background: #f4f4f5;
}

.day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.product-count-chip {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.today-column-header {
  background: linear-gradient(135deg, #f0f9ff, #e0f2fe) !important;
  box-shadow:
    inset 0 1px 2px rgba(59, 130, 246, 0.1),
    0 1px 1px rgba(59, 130, 246, 0.05);
  border-left: 2px solid #93c5fd !important;
  border-right: 2px solid #93c5fd !important;
  position: relative;
}

.today-column-cell {
  background: linear-gradient(135deg, #fefefe, #f8fafc) !important;
  box-shadow:
    inset 1px 0 3px rgba(59, 130, 246, 0.06),
    inset -1px 0 3px rgba(59, 130, 246, 0.06);
  border-left: 2px solid #93c5fd !important;
  border-right: 2px solid #93c5fd !important;
  position: relative;
}

.hours-background {
  background-color: #f9fafb;
  width: 90px;
  min-width: 90px;
  height: 100px;
  min-height: 100px;
}

.product-background {
  background-color: $neutral-basic-white;
  width: 160px;
  min-width: 160px;
  height: 400px;
}

.border-table {
  border: 1px solid #d1d5db;
}

.border-8 {
  border-radius: 8px;
}

.card-campaign {
  min-height: 80px;
  height: auto;
  width: 100%;
  transition: height 0.2s ease;
  border-radius: 8px;
  border-color: #9ca3af;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

thead tr th {
  border-bottom: 1px solid #d1d5db;
  border-right: 1px solid #d1d5db;
  &:last-child {
    border-right: none !important;
  }
}

tbody tr td {
  border-bottom: 1px solid #d1d5db;
  border-right: 1px solid #d1d5db;
  &:last-child {
    border-right: none !important;
  }
}

tbody tr:last-child td {
  border-bottom: none !important;
}

thead tr:first-child th:first-child {
  border-top-left-radius: 8px !important;
}

thead tr:first-child th:last-child {
  border-top-right-radius: 8px !important;
}

tbody tr:last-child td:first-child {
  border-bottom-left-radius: 8px;
}

tbody tr:last-child td:last-child {
  border-bottom-right-radius: 8px;
}

.product-dialog {
  background-color: $neutral-basic-white;
}

.save-button {
  background-color: $ds-blue;
  height: 26px;
}

.product-selector {
  border: 1px solid $ds-gray-300;
}

.product-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
}

.search-bar-select {
  border-bottom: 1px solid $ds-gray-300;
  overflow: hidden;
}

.input-height {
  height: 36px !important;
}

.search-input {
  height: 36px !important;
  outline: none;
  color: $ds-gray;
  width: -webkit-fill-available;
}

.product-list {
  max-height: 12em;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background-color: #ffffff;
}

.checkbox-product {
  padding-top: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: row;
  gap: 0.5em;
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

.view-message {
  position: absolute;
  margin-top: 50px;
  z-index: 9;
}

.product-info {
  min-height: 100%;
  height: auto;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

::v-deep .v-dialog {
  box-shadow: none;
  border-radius: 16px !important;
  display: flex;
  justify-content: center;
}

.link-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  margin-top: 4px;
}

.links-expanded-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
}

.individual-link-card {
  margin-bottom: 0 !important;
}

.campaign-link {
  display: block;
  word-break: break-word;
  max-width: 100%;
  line-height: 1.3;
  transition: all 0.2s ease;
  color: #6b7280;
  background: #f8fafc;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  margin-bottom: 2px;
  white-space: normal;
  overflow-wrap: break-word;

  &.expanded {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }
}

.position-relative {
  position: relative;
}

.tags-tooltip {
  position: fixed;
  top: 0;
  left: 0;
  background: white;
  border-radius: 8px;
  z-index: 9999;
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  min-width: 200px;
  max-width: 350px;
  opacity: 0;
  animation: fadeIn 0.2s ease-out forwards;
  pointer-events: none;
}

.tooltip-arrow {
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid white;
}

.tooltip-arrow::before {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-top: 7px solid #e5e7eb;
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tooltip-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tooltip-title {
  color: #374151;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 2px;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  max-width: 100%;
}

.messages-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 100%;
}

.more-items {
  color: #6b7280;
  font-style: italic;
}

.tags-wrapper .more-items {
  margin-left: 4px;
}

.messages-wrapper .more-items {
  margin-top: 2px;
  align-self: flex-start;
}

.mb-2 {
  margin-bottom: 4px;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.status-chip {
  background-color: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 2px 8px;
  white-space: nowrap;
  display: inline-block;
  color: #374151;
  font-weight: 500;
}

.status-draft {
  background-color: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.status-message {
  background-color: #dcfce7;
  border-color: #16a34a;
  color: #15803d;
}

.message-chip {
  display: block;
  width: 100%;
  height: auto;
  padding: 12px 16px;
  line-height: 1.3;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  border-radius: 6px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
  box-sizing: border-box;
  overflow: visible;
  position: relative;
}

.message-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  height: auto;
  justify-content: flex-start;
}

.message-name {
  font-weight: 400;
  color: #15803d;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  line-height: 1.3;
  font-size: 9px;
  max-width: 100%;
  flex-shrink: 0;
}

.message-subject {
  font-weight: 400;
  color: #15803d;
  word-break: break-word;
  overflow-wrap: break-word;
  line-height: 1.3;
  font-size: 9px;
  max-width: 100%;
  flex-shrink: 1;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.message-sender {
  font-weight: 400;
  color: #15803d;
  font-size: 9px;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  line-height: 1.3;
  max-width: 100%;
  opacity: 0.9;
  flex-shrink: 0;
}

.message-sender-name {
  font-weight: 400;
  color: #15803d;
  font-size: 9px;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  line-height: 1.3;
  max-width: 100%;
  opacity: 0.9;
  flex-shrink: 0;
}

.message-label {
  font-weight: 700;
  color: #065f46;
  margin-right: 4px;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.3px;
}

.winner-trophy {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 16px;
  z-index: 10;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-5px);
  }
  60% {
    transform: translateY(-3px);
  }
}

.message-statistics {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #16a34a;
}

.statistics-title {
  margin-bottom: 6px;
}

.statistics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8px;
  line-height: 1.2;
}

.stat-label {
  font-weight: 600;
  color: #065f46;
  opacity: 0.8;
}

.stat-value {
  font-weight: 700;
  color: #15803d;
  background: rgba(22, 163, 74, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
  min-width: 20px;
  text-align: center;
}
</style>
