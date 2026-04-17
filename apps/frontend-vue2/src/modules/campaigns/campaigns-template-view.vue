<template>
  <div class="view-campaign-template">
    <div class="edit-title campaign-title">
      <router-link to="/campaigns" class="clickable-breadcrumb">
        <span class="material-symbols-rounded font-16">chevron_left</span>
        <span class="title-crumb">{{ $t('title.campaignList') }}</span>
      </router-link>
      <div class="edit-title">
        <h2 class="c-title">{{ $t('button.newCampaign') }}</h2>
      </div>
    </div>
    <div class="info-segment info-segment-inactive w-100 mt-5" v-if="remainingCampaigns > 0">
      <p class="mb-0 d-flex align-items-center info-segment-p-inactive">
        <span class="material-symbols-rounded font-24 mr-3"> info </span>
        <template>
          {{ $t('warning.remainingCampaigns', { total: remainingCampaigns }) }}
        </template>
      </p>
    </div>
    <label class="name label-title font-16 mt-5">{{ $t('title.details') }}</label>
    <v-card class="background-card d-flex div-column gap-10 card-name-description w-100">
      <label class="name label-title font-16 mb-0">
        {{ $t('title.currentConfig') }}
        <span class="label-title-span">{{ currentRule }} </span>
      </label>
      <div class="div-row gap-10">
        <div class="div-column-utm">
          <InputDefault
            :name="`${$t('title.name')}`"
            data-cy="campaign-new-name"
            id="campaign-new-name"
            :modelValue="newCampaign.title"
            :placeholder="`${$t('input.campaignNameType')}`"
            @updateInput="updateInput"
            :keyInput="'title'"
            :max="`${currentAccount.isInternal ? '' : maxLength}`"
            class="mb-0"
          />
          <span v-if="isNotAvailable.title" class="label-sub-title text-error">
            {{ $t('alert.nameExist', { product: $t('title.campaign') }) }}
          </span>
        </div>
        <div class="div-column-utm">
          <div class="div-row align-items-center gap-5 mb-1">
            <span class="text-600 font-12 ds-gray-color">{{ $t('title.utmCampaign') }}</span>
            <span
              v-tooltip.right="$t('title.utmCampaignDescription')"
              class="material-symbols-rounded unfilled-icon font-12 ds-gray-color"
            >
              help
            </span>
          </div>
          <InputDefault
            data-cy="campaign-new-utmCampaign"
            id="campaign-new-utmCampaign"
            :modelValue="newCampaign.name"
            :placeholder="`${$t('input.campaignUtmCampaignType')}`"
            @updateInput="updateInput"
            :keyInput="'name'"
            :max="`${maxLength}`"
            class="mb-0"
          />
          <span v-if="isNotAvailable.name" class="label-sub-title text-error">
            {{ $t('alert.utmCampaignExist', { product: $t('title.campaign') }) }}
          </span>
        </div>
      </div>
      <InputDefault
        data-cy="campaign-new-description"
        autofocus
        max="255"
        :name="`${$t('create.description')}`"
        :modelValue="newCampaign.description"
        :placeholder="`${$t('input.campaignDescription')}`"
        :keyInput="'description'"
        @updateInput="updateInput"
      />
    </v-card>
    <div class="w-100 d-flex justify-content-between">
      <label class="name label-title font-16">{{ $t('create.content') }}</label>
      <div>
        <v-switch
          inset
          :label="`${$t('title.externalMessages')}`"
          class="ml-1 mt-0 pt-0 active-switch switch-label-color"
          v-model="externalMessages"
        ></v-switch>
      </div>
    </div>
    <ContentStep
      v-if="
        !externalMessages ||
        (externalMessages && newCampaign.campaignMessage.length && newCampaign.campaignMessage[0].id)
      "
      :campaignType="newCampaign.type"
      :messageType="newCampaign.messageType"
      :messages="newCampaign.campaignMessage"
      @addMessage="addMessage"
      @changeMessageStep="changeMessageStep"
      @removeCardMessage="removeCardMessage"
    ></ContentStep>
    <v-card
      v-if="externalMessages"
      class="background-card d-flex div-column gap-10 card-name-description w-100 mb-3 mt-3"
    >
      <div class="div-row gap-10 align-items-end w-100">
        <div class="div-column align-self-end w-20">
          <span class="text-600 font-12 mb-1 ds-gray-color">{{ $t('input.language') }}</span>
          <select class="form-control mo-select ds-gray-color" v-model="filters.language" @change="searchMessages()">
            <option value="" disabled>{{ $t('title.selectList') }}</option>
            <option v-for="item in languages" :value="item.language" :key="item.language">
              {{ item.language }}
            </option>
          </select>
        </div>
        <div class="div-column align-self-end">
          <span class="text-600 font-12 mb-1 ds-gray-color">{{ $t('input.product') }}</span>
          <v-menu
            ref="menu"
            v-model="showProducts"
            class="product-menu"
            :close-on-content-click="false"
            transition="scale-y-transition"
            width="283"
          >
            <template v-slot:activator="{ on }">
              <button
                v-tooltip.top="filters.language === '' ? $t('input.selectLanguageFirst') : ''"
                class="menu-products ds-gray-color"
                v-on="on"
                @click="focusInput"
                :disabled="filters.language === ''"
              >
                <span class="font-12 product-value">{{ getProductDisplayText() }}</span>
                <span class="ds-gray-color material-symbols-rounded">arrow_drop_down</span>
              </button>
            </template>
            <v-card class="product-card">
              <div class="search-bar-select">
                <input
                  id="products-search"
                  class="search-input"
                  type="text"
                  v-model="productValue"
                  :placeholder="`${$t('input.search')}`"
                  @input="debouncedSearchProduct($event.target.value)"
                />
                <span
                  class="material-symbols-rounded font-20 cursor-pointer"
                  :class="{ 'ds-blue-color': showProducts === true }"
                >
                  search
                </span>
              </div>
              <div v-if="isLoadingProducts" class="load-icon py-3">
                <span class="d-flex material-symbols-rounded ds-blue-color rotate-icon">progress_activity</span>
              </div>
              <div v-else class="product-list">
                <div class="checkbox-message pl-2" :key="`product-modal-filter-${i}`" v-for="(product, i) in products">
                  <label
                    class="label-filters"
                    :for="`product-options-${product.product}`"
                    :key="`product-labels-${i}`"
                    @click="selectProduct(product.product)"
                  >
                    {{ product.display || product.product }}
                  </label>
                </div>
              </div>
            </v-card>
          </v-menu>
        </div>
      </div>
    </v-card>
    <div v-if="externalMessages" class="w-100">
      <div class="mb-3 card-wrapper w-100">
        <DataLoader
          v-for="n in 10"
          :key="`loader-${n}`"
          :isLoading="isLoadingPreviewMessages"
          :type="'image'"
          class="card-item border-16"
        />
        <div
          v-for="message in previewMessages"
          :key="message.id"
          class="card-item"
          :class="{ 'd-none': isLoadingPreviewMessages }"
        >
          <CampaignRuleContentCard :message="message" @createdTemplateMessage="createdTemplateMessage">
          </CampaignRuleContentCard>
        </div>
      </div>
      <div
        v-if="previewMessages.length > 0"
        class="d-flex w-100 text-center pagination pt-5 align-items-center justify-content-center"
      >
        <v-pagination
          class="c-pagination"
          v-model="pagination.page"
          :length="pagination.totalPages"
          :total-visible="10"
          @input="handlePagination"
        ></v-pagination>
      </div>
    </div>
    <RevisionStep
      :newCampaign="newCampaign"
      :tags="tags"
      @selectTag="() => {}"
      :isCampaignRule="false"
      :isTemplateCampaign="true"
    ></RevisionStep>
    <div class="footer-buttons mt-7">
      <button class="draft-button" type="button" @click="nextRule()">
        {{ $t('button.skipRule') }}
      </button>
      <ButtonDefault
        :name="$t('button.save')"
        type="button"
        @click="saveButton"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
      ></ButtonDefault>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import CampaignService from '@/services/campaign.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { CampaignsDto } from './dtos/campaigns.dto';
import { debounce } from '@/util/debounce';
import { mapState } from 'vuex';
import store from '@/store';
import TagService from '../tags/services/tag.service';
import { TagDto } from '../tags/dtos/tag.dto';
import RevisionStep from './steps/revision-step.vue';
import ContentStep from './steps/content-step.vue';
import CampaignRuleContentCard from './components/CampaignRuleContentCard.vue';
import CampaignRuleService from '@/modules/campaigns-rules/services/campaign-rule.service';
import { CampaignRecurrenceFrequency, CampaignsType, StatusCampaignEnum } from './enums/campaign.enum';
import ApiService from '@/services/api.service';
import ToastService from '@/services/toast.service';
import { Pagination } from '@/models/pagination';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { setMenuTop } from '@/util/objects';
import { replaceSpecialChars } from '@/util/characters';
import { AccountDto } from '../accounts/dtos/account.dto';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  props: [],
  components: { ButtonDefault, InputDefault, RevisionStep, ContentStep, CampaignRuleContentCard, DataLoader },
  computed: {
    ...mapState(['campaignRulesSchedule', 'currentAccountTimezone', 'currentAccount']),
  },
})
export default class CampaignsTemplateView extends Vue {
  private readonly campaignService = new CampaignService();
  private readonly campaignRuleService = new CampaignRuleService();
  private tagService = new TagService();
  private readonly toastService = new ToastService();
  private api = new ApiService();
  public currentAccountTimezone!: string;
  public currentAccount!: AccountDto;
  pagination = new Pagination();

  public campaignRulesSchedule!: any;
  newCampaign: CampaignsDto = {} as CampaignsDto;
  tags: TagDto[] = [];
  isNotAvailable = { title: false, name: false };
  remainingCampaigns = 0;
  currentRule = '';
  previewMessages: any = [];
  languages: any = [];
  products: any = [];
  filters = { language: '', product: '' };
  externalMessages = false;
  showProducts = false;
  productValue = '';
  isLoadingProducts = false;
  selectedProduct = '';
  isLoadingPreviewMessages = false;
  maxLength!: number;

  debouncedValidateTitle = debounce(() => this.validateCampaign('title'), 300);
  debouncedValidateName = debounce(() => this.validateCampaign('name'), 300);
  debouncedSearchProduct = debounce((search: string) => this.processProducts(search), 300);

  async beforeMount() {
    this.maxLength = this.currentAccount.isInternal ? 25 : 40;
    await this.processLanguages();
    await this.processStoreData();
  }

  focusInput() {
    setTimeout(() => {
      const searchInput = document.getElementById('products-search');
      if (searchInput) {
        searchInput.focus();
      }
    }, 100);
  }

  async processLanguages() {
    const results = await this.campaignRuleService.getLanguages();
    this.languages = results?.data || [];
  }

  async selectProduct(product: string) {
    this.filters.product = product === 'all' ? '' : product;
    this.showProducts = false;
    await this.searchMessages();
  }

  async processProducts(product?: string) {
    try {
      this.isLoadingProducts = true;
      const results = await this.campaignRuleService.getProducts({
        language: this.filters.language,
        product,
      });
      this.products = [{ product: 'all', display: this.$t('input.anyProduct') }, ...(results?.data || [])];
    } catch (error) {
      console.error('Error processing products:', error);
    } finally {
      this.isLoadingProducts = false;
    }
  }

  async searchMessages() {
    this.pagination.page = 1;
    this.showProducts = false;
    await this.getMessagesClone();
  }

  async getMessagesClone() {
    try {
      this.isLoadingPreviewMessages = true;
      const result = (
        await this.campaignRuleService.getMessages({
          ...this.pagination,
          product: this.filters.product,
          language: this.filters.language,
        })
      ).data;
      this.previewMessages = result.results;

      this.pagination = {
        ...this.pagination,
        itemsPerPage: parseInt(result?.itemsPerPage, 10),
        page: parseInt(result?.page, 10),
        totalPages: Math.ceil(result?.totalItems / result?.itemsPerPage),
      };
    } catch (error) {
      console.error('Error getting messages:', error);
    } finally {
      this.isLoadingPreviewMessages = false;
    }
  }

  async handlePagination() {
    await this.getMessagesClone();
  }

  getProductDisplayText() {
    if (this.filters.product === '') {
      return this.$t('input.selectProduct');
    }
    const selectedProduct = this.products.find((p: any) => p.product === this.filters.product);
    return selectedProduct?.display || this.filters.product;
  }

  async processStoreData() {
    try {
      const { configs, date } = this.campaignRulesSchedule;
      const currentCampaign = configs.shift();
      store.commit('setCampaignRulesSchedule', {
        date,
        configs: this.campaignRulesSchedule.configs,
      });

      this.remainingCampaigns = configs.length || 0;
      currentCampaign.scheduleTo = this.parseTimeToDateTime(date, currentCampaign.scheduleTo);
      currentCampaign.testabScheduleTo = this.parseTimeToDateTime(date, currentCampaign.testabScheduleTo);
      currentCampaign.testabScheduleEnd = this.parseTimeToDateTime(date, currentCampaign.testabScheduleEnd);
      this.currentRule = currentCampaign.title || '';
      this.newCampaign = { ...currentCampaign, id: undefined, name: undefined, description: '', title: '' };
      if (currentCampaign.type === CampaignsType.TESTAB) {
        this.addMessage();
      }
      if (currentCampaign.type === CampaignsType.RECURRING) {
        currentCampaign.recurrenceSettings.date = currentCampaign.scheduleTo;
      }
      await this.getTags();
    } catch (e) {
      this.$router.push('/campaigns');
    }
  }

  createdTemplateMessage(createdMessage: any) {
    if ([CampaignsType.TESTAB, CampaignsType.SPLIT].includes(this.newCampaign.type)) {
      if (this.newCampaign.campaignMessage.length && this.newCampaign.campaignMessage[0].id) {
        this.newCampaign.campaignMessage.push(createdMessage);
      } else {
        this.newCampaign.campaignMessage = [createdMessage];
      }
    } else {
      this.newCampaign.campaignMessage = [createdMessage];
    }
  }

  parseTimeToDateTime(date: string, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const formattedDate = dayjs(date).set('hours', hours).set('minutes', minutes);
    const formattedDateVerify = dayjs(date).startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const formattedDateTimezone = dayjs
      .tz(formattedDate, this.currentAccountTimezone)
      .startOf('day')
      .format('YYYY-MM-DD HH:mm:ss');

    if (formattedDateTimezone > formattedDateVerify) {
      return formattedDate.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
    }

    if (formattedDateTimezone < formattedDateVerify) {
      return formattedDate.add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
    }

    return formattedDate.format('YYYY-MM-DD HH:mm:ss');
  }

  closeMessagePreview() {
    this.$emit('closeMessagePreview');
  }

  updateInput(event: never, key: never) {
    this.newCampaign[key] = event;
    if (key === 'title') {
      this.newCampaign.name = replaceSpecialChars(this.newCampaign.title).substring(0, this.maxLength);
      this.debouncedValidateTitle();
      this.debouncedValidateName();
    }
    if (key === 'name') {
      this.debouncedValidateName();
    }
  }

  async getTags() {
    try {
      this.tags = (await this.tagService.getTags({})).data;
    } catch (e) {
      throw e;
    }
  }

  async nextRule() {
    await this.processStoreData();
  }

  async validateCampaign(key: 'title' | 'name') {
    try {
      const value = this.newCampaign[key];

      if (value === undefined || value.length < 3) {
        return;
      }

      const { data } = await this.campaignService.checkAvailableName(value, this.newCampaign.id, key);

      if (!data || data.length === 0) {
        this.isNotAvailable[key] = false;
      } else {
        this.isNotAvailable[key] = true;
      }
    } catch (error) {
      console.error('Error checking campaign:', error);
      return false;
    }
  }

  addMessage() {
    this.newCampaign.campaignMessage.push({});
  }

  changeMessageStep(index: number, message: any) {
    this.newCampaign.campaignMessage[index] = { ...message };
  }

  removeCardMessage(index: number) {
    this.newCampaign.campaignMessage.splice(index, 1);
  }

  async saveButton() {
    if (!this.isTagValid()) {
      return;
    }

    if (!this.hasValidMessages()) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.emptyMessage') as string,
      });
      return;
    }

    if (!this.isCampaignValid()) {
      return;
    }

    if (!this.checkCampaingDuplicateMessages()) {
      return;
    }

    await this.saveCampaign();
  }

  async saveCampaign() {
    this.newCampaign.status = StatusCampaignEnum.Scheduled;

    try {
      const api = await this.api.getApi();
      await api({
        method: 'POST',
        url: 'campaigns',
        data: this.newCampaign,
      });

      this.toastService.show({
        type: 'success',
        text: this.$t('modal.campaignCreated') as string,
      });

      this.nextRule();
    } catch (e) {
      console.error(e);
    }
  }

  isTagValid() {
    if (this.newCampaign.sendToAll === true) {
      return true;
    }

    if (this.newCampaign.steps.length === 0) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.emptyAudience') as string,
      });
      return false;
    }

    for (let i = 0; i < this.newCampaign.steps.length; i++) {
      const step = this.newCampaign.steps[i][i];
      if (step && step.tag_id && step.tag_id.length >= 1) {
        return true;
      }
    }

    this.toastService.show({
      type: 'error',
      text: this.$t('warning.emptyAudience') as string,
    });
    return false;
  }

  hasValidMessages() {
    if (this.newCampaign.campaignMessage.length === 0) {
      return false;
    }

    if (this.newCampaign.type === CampaignsType.SIMPLE && Object.keys(this.newCampaign.campaignMessage[0]).length > 0) {
      return true;
    }

    if (
      !this.newCampaign.campaignMessage.find((x: any) => Object.keys(x).length < 1) &&
      this.newCampaign.campaignMessage.length > 0
    ) {
      return true;
    }

    return false;
  }

  isCampaignValid() {
    if (this.newCampaign.campaignMessage.length < 1) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.noMessageSimple') as string,
      });
      return false;
    }

    if (
      this.newCampaign.type !== CampaignsType.SIMPLE &&
      this.newCampaign.type !== CampaignsType.RECURRING &&
      this.newCampaign.campaignMessage.length < 2
    ) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.twoMoreMessages') as string,
      });
      return false;
    }

    if (this.newCampaign.type === CampaignsType.RECURRING) {
      if (
        this.newCampaign.recurrenceCount &&
        this.newCampaign.recurrenceCount < 1 &&
        (this.newCampaign.recurrenceSettings.date === null ||
          this.newCampaign.recurrenceSettings.date === undefined ||
          this.newCampaign.recurrenceSettings.date < new Date())
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignDateError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.interval === undefined ||
        this.newCampaign.recurrenceSettings.interval < 1
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignIntervalError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.frequency === null ||
        this.newCampaign.recurrenceSettings.frequency === undefined
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignFrequencyError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.frequency === CampaignRecurrenceFrequency.WEEKLY &&
        (this.newCampaign.recurrenceSettings.weekDays === undefined ||
          this.newCampaign.recurrenceSettings.weekDays.length < 1)
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignWeekdaysError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.frequency === CampaignRecurrenceFrequency.WEEKLY &&
        this.newCampaign.recurrenceSettings.weekDays !== undefined &&
        !this.newCampaign.recurrenceSettings.weekDays.includes(this.newCampaign.recurrenceSettings.date.getDay())
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignWeekdaysInitialDateError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.hasExpiration &&
        this.newCampaign.recurrenceSettings.untilDate !== undefined &&
        this.newCampaign.recurrenceSettings.untilDate !== null &&
        this.newCampaign.recurrenceSettings.untilDate < this.newCampaign.recurrenceSettings.date
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignUntilDateError') as string,
        });
        return false;
      }

      if (
        this.newCampaign.recurrenceSettings.hasExpiration &&
        !this.newCampaign.recurrenceSettings.untilDate &&
        this.newCampaign.recurrenceSettings.untilSend !== undefined &&
        this.newCampaign.recurrenceSettings.untilSend !== null &&
        this.newCampaign.recurrenceSettings.untilSend < 1
      ) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.recurringCampaignUntilSendError') as string,
        });
        return false;
      }
    }

    return true;
  }

  checkCampaingDuplicateMessages() {
    if (this.newCampaign.campaignMessage.some((msg: any) => this.checkDuplicateMessage(msg).length > 1)) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.equalMessage') as string,
      });
      return false;
    }
    return true;
  }

  checkDuplicateMessage(message: any) {
    return this.newCampaign.campaignMessage.filter((x: any) => x.id === message.id);
  }

  @Watch('filters.language')
  async onProductChange() {
    if (this.filters.language) {
      await this.processProducts();
    }
  }

  @Watch('showProducts')
  onMenuChange(value: boolean) {
    if (value) {
      this.$nextTick(() => {
        setTimeout(() => {
          const activator = this.$el.querySelector('.menu-products') as HTMLElement;
          if (activator) {
            setMenuTop(activator, -36);
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

.view-campaign-template {
  padding-top: 1em;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  h2 {
    display: flex;
    width: 100%;
    gap: 2em;
  }
}

.w-20 {
  width: 22%;
}

.close-button {
  display: flex;
  justify-content: center;
  padding: 3px;
  &:hover {
    border-radius: 50%;
    background-color: #f5f5f5;
  }
}

.message-body {
  width: -webkit-fill-available;
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

.draft-button {
  width: 147px;
  height: 36px;
  border-radius: 8px;
  border: 2px solid #0057f4;
  font-size: 12px;
  font-weight: 700;
  line-height: 12px;
  letter-spacing: 0.07em;
  color: #0057f4;
  text-transform: uppercase;
}

.text-error {
  color: $ds-red;
}

.info-segment {
  padding: 8px 15px;
  border-radius: 20px;
}
.info-segment-inactive {
  background-color: #fffdef;
  border: 1px solid #c0970c;
}
.info-segment-p-inactive {
  font-size: 11pt;
  color: #c0970c;
}

.label-title-span {
  color: $ds-blue;
}

.card-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.card-item {
  width: calc(20% - 13px);
  box-sizing: border-box;
}

.border-16 {
  border-radius: 16px;
}

.product-menu {
  display: none;
}

@keyframes rotateRight {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotate-icon {
  animation: rotateRight 2s linear infinite;
}

.load-icon {
  display: flex;
  justify-content: center;
  align-items: center;
}

.menu-products {
  display: flex;
  flex-direction: row;
  padding-right: 12px;
  padding-left: 12px;
  align-items: center;
  justify-content: space-between;
  border: 1px solid $ds-gray-300;
  height: 36px !important;
  border-radius: 8px;
  cursor: pointer;
  background-color: #ffffff;
  width: 283px;
  &:disabled {
    background-color: $ds-gray-100;
  }
}

.product-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
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

.message-list {
  max-height: 150px;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background-color: #ffffff;
}

.checkbox-message {
  padding: 8px;
  border-bottom: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: row;
  &:hover {
    background-color: #f5f5f5;
  }
}

.search-input {
  min-height: 36px !important;
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: -webkit-fill-available;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: block;
  overflow: hidden;
  margin: 0 !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
}

.product-value {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
  width: 283px;
}

.div-row {
  display: flex;
  width: 100%;
  flex-direction: row;
}

.div-column-utm {
  flex: 1;
  width: 100%;
}
</style>
