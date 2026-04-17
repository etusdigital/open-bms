<template>
  <div class="view-lead-fields-step d-flex">
    <div class="group-input mt-auto">
      <div class="d-flex justify-space-between">
        <label class="block">{{ $t('title.field') }}</label>
      </div>
      <div>
        <v-menu
          ref="menu"
          v-model="showLeadField"
          class="select-menu"
          :close-on-content-click="false"
          bottom
          transition="scale-y-transition"
          offset-y
          width="283"
        >
          <template v-slot:activator="{ on }">
            <v-btn
              class="select-button"
              :class="{ 'select-button-open': showLeadField === true }"
              v-on="on"
              @click="showLeadField = true"
            >
              <div class="menu" v-on="on">
                <p :class="{ 'menu-open': showLeadField === true }" style="display: flex; flex-direction: row">
                  {{ selectedLeadFiled || $t('input.select') }}
                </p>
              </div>
              <div>
                <span
                  class="material-symbols-rounded icon-up"
                  :class="{ 'icon-dropdown  ds-blue-color': showLeadField === true }"
                >
                  arrow_drop_down
                </span>
              </div>
            </v-btn>
          </template>
          <v-card width="283" class="select-card" :class="{ 'select-card-open': showLeadField === true }">
            <div
              class="select-options"
              v-for="(leadField, index) in listLeadFields"
              :value="leadField.name"
              :key="leadField.name"
            >
              <div
                class="option"
                @click="changeLeadField(index)"
                :class="!listLeadFields[index + 1] ? 'last-item' : ''"
              >
                {{ leadField.value }}
              </div>
            </div>
          </v-card>
        </v-menu>
      </div>
    </div>
    <LineComponent :type="'vertical'" />

    <div class="group-input mt-auto">
      <div class="d-flex justify-space-between">
        <label class="block">
          {{ $t('title.filter') }}
        </label>
      </div>
      <LeadSelectField
        :step="step"
        @updateStep="updateStep"
        :selectedConditional="step.conditional_lead_field"
        :listFields="listFields"
        :selectedKey="leadFieldKey"
      />
    </div>
    <div class="div-trash ml-2">
      <button class="ml-auto button-trash" @click="removeStep" type="button">
        <span class="material-symbols-rounded ds-light-gray-color icon-active">delete</span>
      </button>
    </div>
  </div>
</template>

<script script lang="ts">
import { LeadFieldsTypes } from '@/interfaces/step-conditional.interfaces';
import { Component, Vue } from 'vue-property-decorator';
import LineComponent from './LineComponent.vue';
import LeadSelectField from './addLeadFields/LeadSelectField.vue';

@Component({
  components: {
    LineComponent,
    LeadSelectField,
  },
  props: ['step'],
})
export default class AddLeadComponent extends Vue {
  public leadField = LeadFieldsTypes;
  leadFieldKey = '';
  showLeadField = false;
  selectedLeadFiled: any = '';
  listFields: any = [];

  listLeadFields = [
    { name: LeadFieldsTypes.CAMPAIGN_ID, value: this.$t('input.campaign_id') },
    { name: LeadFieldsTypes.ENGAGED, value: this.$t('input.engaged') },
    { name: LeadFieldsTypes.LEAD_SOURCE, value: this.$t('input.lead_source') },
    { name: LeadFieldsTypes.SOURCE, value: this.$t('input.source') },
    { name: LeadFieldsTypes.STATUS, value: this.$t('input.status') },
    { name: LeadFieldsTypes.UTM_CAMPAIGN, value: this.$t('input.utm_campaign') },
  ];

  conditionalLeadFields = [
    { name: 'true', value: this.$t('input.yes') },
    { name: 'false', value: this.$t('input.no') },
  ];

  beforeMount() {
    const step = this.$props.step;
    this.leadFieldKey = step?.lead_field_key || '';
    this.selectedLeadFiled = this.listLeadFields.find((x: any) => x.name === this.leadFieldKey)?.value;
    if (this.leadFieldKey) {
      this.setListFields();
    }
  }
  removeStep() {
    this.$emit('removeStep');
  }
  updateStep(key: string, value: string) {
    this.$emit('updateStep', key, value);
    if (key === 'lead_field_key') {
      this.$emit('updateStep', 'lead_field_value', '');
    }
  }
  changeLeadField(index: number) {
    this.selectedLeadFiled = this.listLeadFields[index].value;
    this.leadFieldKey = this.listLeadFields[index].name;
    this.showLeadField = false;
    this.updateStep('lead_field_key', this.leadFieldKey);
    this.setListFields();
  }

  setListFields() {
    switch (this.leadFieldKey) {
      case LeadFieldsTypes.CAMPAIGN_ID:
      case LeadFieldsTypes.UTM_CAMPAIGN:
        this.listFields = [];
        break;
      case LeadFieldsTypes.ENGAGED:
        this.listFields = [
          { name: '-30', value: this.$t('title.neverEngaged', { days: 30 }) },
          { name: '-15', value: this.$t('title.neverEngaged', { days: 15 }) },
          { name: '-3', value: this.$t('title.neverEngaged', { days: 3 }) },
          { name: '-1', value: this.$t('title.neverEngaged', { days: 1 }) },
          { name: '3', value: this.$t('title.engagedRecently', { days: 3 }) },
          { name: '7', value: this.$t('title.engagedRecently', { days: 7 }) },
          { name: '15', value: this.$t('title.engagedRecently', { days: 15 }) },
          { name: '30', value: this.$t('title.engagedRecently', { days: 30 }) },
          { name: '40', value: this.$t('title.engagedRecently', { days: 40 }) },
        ];
        break;
      case LeadFieldsTypes.SOURCE:
        this.listFields = [
          { name: 'google', value: 'Google' },
          { name: 'facebook', value: 'Facebook' },
          { name: 'tiktok', value: 'Tiktok' },
          { name: 'whatsapp', value: 'Whatsapp' },
        ];
        break;
      case LeadFieldsTypes.STATUS:
        this.listFields = [
          { name: 'old', value: this.$t('title.old') },
          { name: 'new', value: this.$t('title.new') },
        ];
        break;
      case LeadFieldsTypes.LEAD_SOURCE:
        this.listFields = [
          { name: 'quizmaker', value: 'quizmaker' },
          { name: 'api', value: 'api' },
        ];
        break;
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.filter {
  background-color: #d0c9f8 !important;
  color: #ffffff;
  font-weight: 500;
  margin-top: auto;
}

label {
  color: $ds-gray !important;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 0.25rem;
}
.custom-select-date {
  max-height: 38px;
}

.v-select-date {
  max-width: 150px;
}

::v-deep.v-btn:not(.v-btn--round).v-size--default {
  min-width: 176px;
  width: fit-content;
  max-width: 216px;
}
.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.select-card {
  border-radius: 0px 0px 8px 8px !important;
}
.select-options {
  border-bottom: 1px solid $ds-gray-100;
}
.option {
  border-top: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  padding-top: 8px;
  padding-bottom: 8px;
  padding-left: 8px;
  background-color: #ffffff;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  margin: 0px !important;
  cursor: pointer;
  color: $ds-gray;

  &:hover {
    background: $ds-gray-100;
  }
}

.last-item {
  border-radius: 0px 0px 8px 8px !important;
}

.select-button {
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

.select-light-purple-button {
  background-color: #d0c9f8 !important;
  border: 1px solid $ds-purple;

  p {
    color: #000 !important;
  }
}

.select-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.select-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
  width: 176px;
}

.menu {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 9px;

  & > p {
    font-size: 12px;
    margin: 0;
    text-transform: none;
    font-weight: normal;
  }

  & > .menu-open {
    color: $ds-blue;
  }
}

.p-light-purple {
  color: #ffffff !important;
}

.icon-up {
  color: $ds-gray;
}

.icon-up-light-purple {
  color: #000 !important;
}

.div-trash {
  display: flex;
  align-items: flex-end;
}
</style>
