<template>
  <div class="camapigns-rules-preview-card">
    <div class="message-body div-column">
      <div class="div-row justify-space-between align-items-center mb-3">
        <span class="font-14 text-600 ds-blue-color">
          {{ $t('title.campaignList') }}
        </span>
        <span
          class="material-symbols-rounded ds-gray-color cursor-pointer close-button font-24"
          @click.prevent="closeMessagePreview"
          >close
        </span>
      </div>
      <div class="d-flex gap-10">
        <div class="div-column w-100">
          <span class="text-600 font-12 mb-1 ds-gray-color">{{ $t('sidebar.campaignRules') }}</span>
          <select
            class="form-control mo-select ds-gray-color"
            v-model="newCampaign.ruleId"
            @change="formattedAllowedDays()"
          >
            <option v-for="type in rules" :value="type.value" :key="type.value">
              {{ type.name }}
            </option>
          </select>
        </div>
        <div class="div-column w-100">
          <span class="text-600 font-12 mb-1 ds-gray-color">{{ $t('datatable.date') }}</span>
          <DatePickerCustomFieldComponent
            :step="{}"
            @updateStep="updateStep"
            :minDays="0"
            :maxDays="30"
            :type="'campaign-rule'"
          />
        </div>
      </div>
      <div class="div-column mt-5">
        <label class="font-12 label-title input-font mb-0">{{ $t('title.permittedDays') }}</label>
        <div class="div-row gap-10">
          <div v-for="day in daysOptions" :key="day.value">
            <v-tooltip top>
              <template v-slot:activator="{ on }">
                <button
                  v-on="on"
                  class="font-12 text-400 days-buttons"
                  type="button"
                  :class="{ 'day-button-active': allowedDays.includes(day.value) }"
                >
                  {{ day.title[0] }}
                </button>
              </template>
              <span>{{ day.title }}</span>
            </v-tooltip>
          </div>
        </div>
      </div>
      <ButtonDefault
        :name="`${$t('button.advance')}`"
        @click="nextStep()"
        data-cy="button-view-fields"
        class="btn-edit buttons-specs mt-4"
      />
    </div>
  </div>
</template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import store from '@/store';
import { ActionHandler, mapState } from 'vuex';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import DatePickerCustomFieldComponent from '@/components/conditional-steps/DatePickerCustomFieldComponent.vue';
import CampaignRuleService from '../services/campaign-rule.service';
import { CampaignRuleDto } from '../dtos/campaign-rule.dto';
import { CampaignsType } from '@/modules/campaigns/enums/campaign.enum';
import { CampaignsDto } from '@/modules/campaigns/dtos/campaigns.dto';
import ToastService from '@/services/toast.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: { ButtonDefault, DataLoader, DatePickerCustomFieldComponent },
  props: [],
  computed: {
    ...mapState(['currentAccount', 'currentAccountTimezone']),
  },
})
export default class CampaignRulePreviewModal extends Vue {
  private readonly toastService = new ToastService();
  private readonly campaignRuleService = new CampaignRuleService();
  public currentAccountTimezone!: string;
  newCampaign: any = { date: new Date(), ruleId: 0 };
  rules: any = [];
  allowedDays: number[] = [];

  daysOptions = [
    { title: this.$t('input.sunday') as string, value: 0 },
    { title: this.$t('input.monday') as string, value: 1 },
    { title: this.$t('input.tuesday') as string, value: 2 },
    { title: this.$t('input.wednesday') as string, value: 3 },
    { title: this.$t('input.thursday') as string, value: 4 },
    { title: this.$t('input.friday') as string, value: 5 },
    { title: this.$t('input.saturday') as string, value: 6 },
  ];

  beforeMount() {
    this.searchRules();
  }

  async searchRules() {
    const result = await this.campaignRuleService.getCampaignsRules({ page: 1, itemsPerPage: 100 });
    const rules = result?.data?.results || [];
    this.rules = rules.map((item: any) => {
      return {
        name: item.name,
        value: item.id,
        configs: item.campaignsRulesConfigs,
        weekDays: item.weekDays,
      };
    });
    this.newCampaign.ruleId = this.rules.length ? this.rules[0].value : 0;
    this.formattedAllowedDays();
  }

  getTime(campaignObject: any) {
    const timeStr =
      campaignObject.type === CampaignsType.TESTAB ? campaignObject.testabScheduleTo : campaignObject.scheduleTo;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const formattedDate = dayjs(this.newCampaign.date).set('hours', hours).set('minutes', minutes);
    const formattedDateVerify = dayjs(this.newCampaign.date).startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const formattedDateTimezone = dayjs
      .tz(formattedDate, this.currentAccountTimezone)
      .startOf('day')
      .format('YYYY-MM-DD HH:mm:ss');

    if (formattedDateTimezone > formattedDateVerify) {
      formattedDate.subtract(1, 'day');
    }

    if (formattedDateTimezone < formattedDateVerify) {
      formattedDate.add(1, 'day');
    }

    const formattedDateTimezoneFinal = dayjs.tz(formattedDate, this.currentAccountTimezone).format('HH:mm');
    const [hoursFinal, minutesFinal] = formattedDateTimezoneFinal.split(':').map(Number);
    return hoursFinal * 60 + minutesFinal;
  }

  nextStep() {
    const rule = this.rules.find((item: any) => item.value === this.newCampaign.ruleId);
    const weekDay = new Date(this.newCampaign.date).getDay();
    if (!this.allowedDays.includes(weekDay)) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.dateNotAllowed') as string,
      });
      return;
    }
    if (rule) {
      const configsRules = rule.configs
        .map((item: any) => item.campaignConfig.configs)
        .sort((a: CampaignsDto, b: CampaignsDto) => {
          return this.getTime(a) - this.getTime(b);
        });
      store.commit('setCampaignRulesSchedule', {
        date: this.newCampaign.date,
        configs: configsRules,
      });
      this.$router.push('/campaigns/new-template');
    }
  }

  formattedAllowedDays() {
    const rule = this.rules.find((item: any) => item.value === this.newCampaign.ruleId);
    this.allowedDays = rule?.weekDays || [];
  }

  closeMessagePreview() {
    this.$emit('closeMessagePreview');
  }

  updateStep(key: string, value: string) {
    this.newCampaign.date = `${value} 12:00`;
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

::v-deep .v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  -webkit-box-shadow: none;
  box-shadow: none;
  border: 1px solid #ced4da;
}
::v-deep.v-select.v-select--chips .v-select__selections {
  min-height: 34px !important;
  height: 35px;
}
::v-deep .v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot:focus {
  border: 1px $ds-blue solid !important;
}
.value-input:focus {
  outline: none !important;
  box-shadow: none !important;
  border: 1px $ds-blue solid !important;
}
.mo-input {
  border-radius: 8px;
  min-width: 176px;
  width: fit-content !important;
  height: max-content !important;
  font-size: 12px !important;
  height: 36px !important;
}
::v-deep .v-label {
  font-size: 12px !important;
}
::v-deep.v-btn:not(.v-btn--round).v-size--default {
  min-width: 176px;
  width: max-content;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
  min-width: 176px;
  width: max-content;
}

.camapigns-rules-preview-card {
  border-radius: 16px;
  background-color: $neutral-basic-white;
  display: flex;
  align-content: center;
  justify-content: center;
  padding: 20px;
  width: 700px;
  height: fit-content;
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

.btn-edit {
  color: #ffffff !important;
  background-color: $ds-blue !important;
  border: 1px solid $ds-blue;
  padding: 14px !important;
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

.message-body {
  width: -webkit-fill-available;
}

.day-button-active {
  color: $neutral-basic-white !important;
  background-color: $ds-blue !important;
}
.days-buttons {
  color: #a6a6a6;
  background-color: #eaeaea;
  border-radius: 50%;
  width: 25px;
  height: 25px;
}
</style>
