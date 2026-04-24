<template>
  <div class="view-campaign-settings-step mt-2 w-100">
    <label class="name label-title font-16">{{ $t('title.details') }}</label>
    <v-card class="background-card d-flex div-column gap-10 card-name-description">
      <div class="div-row gap-10">
        <div class="div-column">
          <InputDefault
            :name="`${$t('title.name')}`"
            data-cy="campaign-new-name"
            id="campaign-new-name"
            :modelValue="newCampaign.title"
            :placeholder="`${!isCampaignRule ? $t('input.campaignNameType') : $t('input.campaignConfigNameType')}`"
            @updateInput="updateInput"
            :keyInput="'title'"
            :max="`${currentAccount.isInternal ? '' : maxLength}`"
            class="mb-0"
          />
          <span v-if="isNotAvailable.title" class="label-sub-title text-error">
            {{ $t('alert.nameExist', { product: $t('title.campaign') }) }}
          </span>
        </div>
        <div v-if="currentAccount.isInternal && !isCampaignRule" class="div-column">
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
        :placeholder="`${!isCampaignRule ? $t('input.campaignDescription') : $t('input.campaignConfigDescription')}`"
        :keyInput="'description'"
        @updateInput="updateInput"
      />
      <LabelSelectComponent :labelContent="campaignLabelContent" @selectLabels="selectLabels" />
      <v-switch
        v-if="currentAccount.isInternal && !isCampaignRule"
        v-model="newCampaign.isRateLimit"
        center-affix
        inset
        :label="`${$t('input.userRateLimit')}`"
        class="ml-1 mt-0 pt-0 active-switch switch-label-color"
      ></v-switch>
    </v-card>
    <label class="name label-title font-16">{{ $t('title.channels') }}</label>
    <div class="campaign-cards-wrapper mb-6">
      <div class="campaign-cards campaign-cards-type">
        <button
          type="button"
          class="message-types-div message-types-cards"
          :class="{
            'card-type-desactive': !emailSettings.isActive,
            'message-types-cards-active': newCampaign.messageType === campaignsMessageType.EMAIL,
          }"
          v-tooltip.top="!emailSettings.isActive && `${$t(`title.noAccess`)}`"
          @click="emailSettings.isActive && updateInput(campaignsMessageType.EMAIL, 'messageType')"
        >
          <span
            :class="newCampaign.messageType === campaignsMessageType.EMAIL ? '' : 'card-type-inactive'"
            class="material-symbols-rounded font-36"
          >
            email
          </span>
          <div :class="newCampaign.messageType === campaignsMessageType.EMAIL ? 'card-text' : ''">
            <label class="campaign-cards-title label-title" for="">{{ $t('title.email') }}</label>
          </div>
        </button>

        <button
          type="button"
          v-if="!disableSimple"
          class="message-types-div message-types-cards"
          :class="{
            'card-type-desactive': !pushSettings.isActive,
            'message-types-cards-active': newCampaign.messageType === campaignsMessageType.WEBPUSH,
          }"
          @click="pushSettings.isActive && updateInput(campaignsMessageType.WEBPUSH, 'messageType')"
          v-tooltip.top="!pushSettings.isActive && `${$t(`title.noAccess`)}`"
        >
          <span
            class="material-symbols-rounded font-36"
            :class="newCampaign.messageType === campaignsMessageType.WEBPUSH ? '' : 'card-type-inactive'"
          >
            computer
          </span>
          <div :class="newCampaign.messageType === campaignsMessageType.WEBPUSH ? 'card-text' : ''">
            <label class="campaign-cards-title label-title" for="">{{ $t('title.web-push') }}</label>
          </div>
        </button>
        <button
          type="button"
          v-if="!disableSimple"
          class="message-types-div message-types-cards"
          :class="{
            'card-type-desactive': !mobilePushSettings.isActive,
            'message-types-cards-active': newCampaign.messageType === campaignsMessageType.MOBILEPUSH,
          }"
          @click="mobilePushSettings.isActive && updateInput(campaignsMessageType.MOBILEPUSH, 'messageType')"
          v-tooltip.top="!mobilePushSettings.isActive && `${$t(`title.noAccess`)}`"
        >
          <span
            class="material-symbols-rounded font-36"
            :class="newCampaign.messageType === campaignsMessageType.MOBILEPUSH ? '' : 'card-type-inactive'"
          >
            smartphone
          </span>
          <div :class="newCampaign.messageType === campaignsMessageType.MOBILEPUSH ? 'card-text' : ''">
            <label class="campaign-cards-title label-title" for="">{{ $t('title.mobile-push') }}</label>
          </div>
        </button>
        <button
          type="button"
          v-if="!disableSimple"
          class="message-types-div message-types-cards"
          :class="{
            'card-type-desactive': !smsSettings.isActive,
            'message-types-cards-active': newCampaign.messageType === campaignsMessageType.SMS,
          }"
          @click="smsSettings.isActive && updateInput(campaignsMessageType.SMS, 'messageType')"
          v-tooltip.top="!smsSettings.isActive && `${$t(`title.noAccess`)}`"
        >
          <span
            class="material-symbols-rounded font-36"
            :class="newCampaign.messageType === campaignsMessageType.SMS ? '' : 'card-type-inactive'"
          >
            sms
          </span>
          <div :class="newCampaign.messageType === campaignsMessageType.SMS ? 'card-text' : ''">
            <label class="campaign-cards-title label-title" for="">{{ $t('title.sms') }}</label>
          </div>
        </button>
        <button
          type="button"
          v-if="!disableSimple"
          class="message-types-div message-types-cards"
          :class="{
            'card-type-desactive': !wppSettings.isActive,
            'message-types-cards-active': newCampaign.messageType === campaignsMessageType.WHATSAPP,
          }"
          @click="wppSettings.isActive && updateInput(campaignsMessageType.WHATSAPP, 'messageType')"
          v-tooltip.top="!wppSettings.isActive && `${$t(`title.noAccess`)}`"
        >
          <img
            :src="newCampaign.messageType === campaignsMessageType.WHATSAPP ? wppBlueIcon : wppIcon"
            alt=""
            class="wpp-icon-size"
          />

          <div :class="newCampaign.messageType === campaignsMessageType.WHATSAPP ? 'card-text' : ''">
            <label class="campaign-cards-title label-title" for="">{{ $t('title.whatsapp') }}</label>
          </div>
        </button>
      </div>
    </div>
    <label class="name label-title font-16">{{ $t('title.sendAs') }}</label>
    <div class="campaign-cards-wrapper">
      <div class="campaign-cards">
        <button
          type="button"
          class="message-types-div"
          :class="
            newCampaign.type === campaignsType.SIMPLE
              ? 'card-type-active send-options message-types-cards'
              : 'send-options message-types-cards'
          "
          @click="updateInput(campaignsType.SIMPLE, 'type')"
          v-if="!disableSimple"
        >
          <div class="text-center">
            <img
              class="icon-card"
              :src="
                require(`@/assets/campaign_simple${newCampaign.type === campaignsType.SIMPLE ? '_active' : ''}.svg`)
              "
            />
          </div>
          <div class="select-campaign text-left">
            <div
              class="campaign-cards-title label-title mb-1"
              :class="newCampaign.type === campaignsType.SIMPLE ? 'text-label-active' : 'card-type-inactive'"
            >
              {{ $t('title.regularCampaign') }}
            </div>
            <div class="subtitle-text campaign-cards-subtitle">
              {{ $t('input.regularCampaign') }}
            </div>
          </div>
        </button>
        <button
          type="button"
          class="message-types-div card-type-desactive send-options message-types-cards"
          v-tooltip.top="`${$t(`datatable.tooltipDesactiveSimple`)}`"
          v-else
        >
          <div class="text-center">
            <img
              class="icon-card"
              :src="
                require(`@/assets/campaign_simple${newCampaign.type === campaignsType.SIMPLE ? '_active' : ''}.svg`)
              "
            />
          </div>
          <div class="select-campaign text-left">
            <div
              class="campaign-cards-title label-title mb-1"
              :class="newCampaign.type === campaignsType.SIMPLE ? 'text-label-active' : 'card-type-inactive'"
            >
              {{ $t('title.regularCampaign') }}
            </div>
            <div class="subtitle-text campaign-cards-subtitle">
              {{ $t('input.regularCampaign') }}
            </div>
          </div>
        </button>
        <button
          type="button"
          v-if="newCampaign.messageType === campaignsMessageType.EMAIL"
          class="message-types-div"
          :class="
            newCampaign.type === campaignsType.TESTAB
              ? 'card-type-active send-options message-types-cards'
              : 'send-options message-types-cards'
          "
          @click="updateInput(campaignsType.TESTAB, 'type')"
        >
          <div class="text-center">
            <img
              class="icon-card"
              :src="
                require(`@/assets/campaign_test_ab${newCampaign.type === campaignsType.TESTAB ? '_active' : ''}.svg`)
              "
            />
          </div>
          <div class="select-campaign text-left">
            <div
              class="campaign-cards-title label-title mb-1"
              :class="newCampaign.type === campaignsType.TESTAB ? 'text-label-active' : 'card-type-inactive'"
            >
              {{ $t('title.testCampaign') }}
            </div>
            <div class="subtitle-text campaign-cards-subtitle">
              {{ $t('input.testCampaign') }}
            </div>
          </div>
        </button>
        <button
          type="button"
          v-if="newCampaign.messageType === campaignsMessageType.EMAIL"
          class="message-types-div"
          :class="
            newCampaign.type === campaignsType.SPLIT
              ? 'card-type-active send-options message-types-cards'
              : 'send-options message-types-cards'
          "
          @click="updateInput(campaignsType.SPLIT, 'type')"
        >
          <div class="text-center">
            <img
              class="icon-card"
              :src="require(`@/assets/campaign_split${newCampaign.type === campaignsType.SPLIT ? '_active' : ''}.svg`)"
            />
          </div>
          <div class="select-campaign text-left">
            <div
              class="campaign-cards-title label-title mb-1"
              :class="newCampaign.type === campaignsType.SPLIT ? 'text-label-active' : 'card-type-inactive'"
            >
              {{ $t('title.splitCampaign') }}
            </div>
            <div class="subtitle-text campaign-cards-subtitle">
              {{ $t('input.splitCampaign') }}
            </div>
          </div>
        </button>
        <button
          type="button"
          class="message-types-div"
          :class="
            newCampaign.type === campaignsType.RECURRING
              ? 'card-type-active send-options message-types-cards'
              : 'send-options message-types-cards'
          "
          @click="updateInput(campaignsType.RECURRING, 'type')"
        >
          <div class="text-center">
            <img
              class="icon-card"
              :src="
                require(`@/assets/campaign_recurring${
                  newCampaign.type === campaignsType.RECURRING ? '_active' : ''
                }.svg`)
              "
            />
          </div>
          <div class="select-campaign text-left">
            <div
              class="campaign-cards-title label-title mb-1"
              :class="newCampaign.type === campaignsType.RECURRING ? 'text-label-active' : 'card-type-inactive'"
            >
              {{ $t('title.recurringCampaign') }}
            </div>
            <div class="subtitle-text campaign-cards-subtitle">
              {{ $t('input.recurringCampaign') }}
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import InputDefault from '@/components/input/InputDefault.vue';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { CampaignsType, CampaignMessageType } from '../enums/campaign.enum';
import store, { getAccountConfig } from '@/store';
import { CampaignsDto } from '../dtos/campaigns.dto';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import LabelSelectComponent from '@/modules/labels/components/LabelSelectComponent.vue';
import { LabelDto } from '@/modules/labels/dtos/label.dto';

@Component({
  components: {
    InputDefault,
    LabelSelectComponent,
  },
  props: ['newCampaign', 'disableSimple', 'isNotAvailable', 'isCampaignRule'],
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class SettingsStep extends Vue {
  public campaignsType = CampaignsType;
  public campaignsMessageType = CampaignMessageType;
  public currentAccount!: AccountDto;
  @Prop() newCampaign!: CampaignsDto;
  @Prop() disableSimple!: boolean;
  @Prop() isNotAvailable!: { title: boolean; name: boolean };
  @Prop() isCampaignRule!: boolean;

  isInternal = false;
  emailSettings = {};
  smsSettings = {};
  pushSettings = {};
  wppSettings = {};
  mobilePushSettings = {};
  maxLength!: number;
  wppIcon = require('@/assets/whatsapp.svg');
  wppBlueIcon = require('@/assets/whatsapp-blue.svg');

  get campaignLabelContent() {
    return this.newCampaign.labelContent || [];
  }

  beforeMount() {
    this.maxLength = this.currentAccount.isInternal ? 25 : 40;
    this.emailSettings = JSON.parse(getAccountConfig(this.currentAccount, 'email_settings')) || {};
    this.smsSettings = JSON.parse(getAccountConfig(this.currentAccount, 'sms_settings')) || {};
    this.pushSettings = JSON.parse(getAccountConfig(this.currentAccount, 'webpush_settings')) || {};
    this.wppSettings = JSON.parse(getAccountConfig(this.currentAccount, 'whatsapp_settings')) || {};
    this.mobilePushSettings = JSON.parse(getAccountConfig(this.currentAccount, 'mobilepush_settings')) || {};
    if (!this.currentAccount.isInternal) {
      this.newCampaign.isRateLimit = false;
    }
  }

  updateInput(event: never | string, key: any) {
    this.$emit('updateInput', event, key);
  }

  mounted() {
    (this.$el.querySelector('#campaign-new-name input') as HTMLElement).focus();
  }

  selectLabels(labels: LabelDto[]) {
    this.$emit('selectLabels', labels);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

::v-deep .v-sheet.v-card:not(.v-sheet--outlined) {
  border: 1px solid var(--Cinzas-Gray-300, #d9d9d9);
  background: var(--Outras-cores-White, #fff);
  box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
}

.campaign-cards-wrapper {
  container-type: inline-size;
  container-name: campaign-cards;
}
.campaign-cards {
  display: grid;
  gap: 15px;
  grid-template-columns: repeat(4, 1fr);
}

.campaign-cards-type {
  grid-template-columns: repeat(5, 1fr);
}

@container campaign-cards (max-width: 1100px) {
  .campaign-cards {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}

.campaign-cards-title {
  font-size: 14px !important;
  letter-spacing: 0.07em;
  font-family: Inter;
  font-size: 14px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.07em;
  text-align: left;
  color: #5c5c5c !important;
}

.campaign-cards-subtitle {
  font-size: 12px !important;
  letter-spacing: 0.07em;
  line-height: 130%;
}
.message-types-div {
  display: flex;
  flex-direction: row;
  border-radius: 16px;
  background-color: white;
  border: 1px solid $ds-gray-300;
}
.message-types-cards {
  padding: 20px 16px;
  display: flex;
  flex-direction: row;
  gap: 20px;
  align-items: center;
}
.message-types-cards span {
  font-size: 36px;
}
.message-types-cards-active {
  background-color: #f4f8ff !important;
  border: 1px solid $ds-blue !important;
  color: $ds-blue;
}

.card-type-inactive {
  color: #5c5c5c;
}
.card-text {
  label {
    color: $ds-blue !important;
  }
  p {
    color: $ds-blue !important;
  }
}
.card-type-active {
  background-color: #f4f8ff;
  border: 1px solid $ds-blue;
  color: $ds-blue;
  .subtitle-text {
    color: $ds-blue;
  }
}
.text-label-active {
  color: $ds-blue !important;
}
.card-type-desactive {
  background-color: #e9e9e900;
  border: 2px solid $ds-gray-300;
  opacity: 0.5;
  box-shadow: none !important;
}
.card-type-desactive:hover {
  cursor: auto;
  box-shadow: none;
}
.defaultCard {
  width: 100%;
  padding: 1em;
  margin: 1em 0;
  border-radius: 16px;
  display: flex;
  flex-direction: row;
}
.v-card {
  border-radius: 16px;
}

::v-deep .v-sheet.v-card:not(.v-sheet--outlined) {
  box-shadow: 0px 1px 3px 0px #0000001a !important;
  box-shadow: 0px 1px 2px 0px #0000000f !important;
}
.select-campaign {
  display: flex;
  flex-direction: column;
}
.name {
  display: block;
}
.send-options {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.card-disabled {
  background-color: $ds-gray-100;
  pointer-events: none;
  color: $neutral-gray-700 !important;
  box-shadow: none !important;
  border-radius: 16px;
  border: 0.5px solid $ds-gray-300;
  color: $ds-gray-300 !important;

  label,
  p {
    color: $ds-gray-300 !important;
  }
}

.color-input-error {
  border: 1px solid $ds-red;
}

.text-error {
  color: $ds-red;
}

.text-correct {
  color: #0fb75c;
}

.wpp-icon-size {
  width: 40px;
  height: 40px;
}
.switch-label-color {
  color: #5c5c5c;
  letter-spacing: 0.07em !important;
}
::v-deep.switch-label-color .v-label {
  letter-spacing: 0.07em !important;
}
::v-deep.switch-label-color .v-input__slot {
  margin-bottom: 0px !important;
}

::v-deep .switch-label-color label {
  margin-bottom: 0px !important;
}
::v-deep .switch-label-color .v-input__control {
  margin-bottom: -2px !important;
}

.div-row {
  display: flex;
  width: 100%;
  flex-direction: row;
}

.div-column {
  flex: 1;
  width: 100%;
}
</style>
