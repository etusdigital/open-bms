<template>
  <div class="view-custom-fields-step d-flex">
    <template v-if="type === 'automations'">
      <div class="group-input mt-auto">
        <label class="font-12">{{ $t('title.typeOfFilter') }}</label>
        <SelectConditionalComponent
          @updateStep="updateStep"
          :color="'select-light-purple'"
          :items="filterCustomFields"
          :conditionalName="'filter_custom_field'"
          :value="step.filter_custom_field || 'text'"
        />
      </div>
      <LineComponent :type="'vertical'" />
    </template>
    <div class="group-input mt-auto">
      <div class="d-flex justify-space-between">
        <label class="block font-12">{{ $t('title.field') }}</label>
      </div>
      <div>
        <v-autocomplete
          v-model="selectedFieldItem"
          :items="customFields"
          item-text="title"
          chips
          deletable-chips
          class="mo-input"
          return-object
          :label="`${$t('input.select')}`"
          solo
          :no-data-text="`${$t('datatable.noData')}`"
          cache-items
        >
          <template v-slot:item="{ item }">
            <v-list-item-content @click="updateFields(item)">
              {{ item.title }}
            </v-list-item-content>
          </template>

          <template v-slot:selection="data">
            {{ data.item.title }}
            <span class="mr-2"></span>
          </template>
        </v-autocomplete>
      </div>
    </div>
    <LineComponent :type="'vertical'" />
    <SelectConditionalComponent
      @updateStep="updateStep"
      :color="'select-light-purple'"
      :items="conditionalCustomFields"
      :conditionalName="'conditional_custom_field'"
      :value="step.conditional_custom_field || '='"
      :disabled="selectedFieldItem.id === 0"
    />
    <LineComponent :type="'vertical'" />
    <div class="group-input mt-auto">
      <div class="d-flex justify-space-between">
        <label class="block font-12" v-if="customFilter === 'compare_fields' && type === 'automations'">
          {{ $t('title.field2') }}</label
        >
        <label class="block font-12" v-else> {{ $t('title.value') }}</label>
      </div>
      <div v-if="customFilter === 'compare_fields' && type === 'automations'">
        <div>
          <v-autocomplete
            v-model="selectedFieldItem2"
            :items="customFieldsFilter"
            item-text="title"
            chips
            deletable-chips
            class="mo-input"
            return-object
            :label="`${$t('input.select')}`"
            solo
            :no-data-text="`${$t('datatable.noData')}`"
            cache-items
          >
            <template v-slot:item="{ item }">
              <v-list-item-content
                @click="updateStep('custom_field_value', item.id, item.title, 'custom_field_name_2')"
              >
                {{ item.title }}
              </v-list-item-content>
            </template>

            <template v-slot:selection="data">
              {{ data.item.title }}
              <span class="mr-2"></span>
            </template>
          </v-autocomplete>
        </div>
      </div>
      <div v-else>
        <div v-if="selectedFieldItem.type === 'date'">
          <DatePickerCustomFieldComponent :step="step" @updateStep="updateStep" />
        </div>
        <div v-else-if="selectedFieldItem.type === 'number'">
          <input
            ref="inputNumber"
            autofocus
            type="text"
            class="form-control w-176 value-input"
            @input="formatDecimal()"
            :value="customFieldValue"
            :disabled="selectedFieldItem.id === 0"
          />
        </div>
        <div v-else>
          <input
            autofocus
            type="text"
            class="form-control w-176 value-input"
            @input="updateStep('custom_field_value', $event.target.value)"
            :value="customFieldValue"
            :disabled="selectedFieldItem.id === 0"
          />
        </div>
      </div>
    </div>
    <div class="div-trash ml-2">
      <button class="ml-auto button-trash" @click="removeStep" type="button">
        <span class="material-symbols-rounded ds-light-gray-color icon-active">delete</span>
      </button>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import LineComponent from './LineComponent.vue';
import SelectConditionalComponent from './SelectConditionalComponent.vue';
import { CustomFieldsDto } from '@/modules/customfields/dtos/customFieldsdto';
import DatePickerCustomFieldComponent from './DatePickerCustomFieldComponent.vue';

@Component({
  components: { LineComponent, SelectConditionalComponent, DatePickerCustomFieldComponent },
  props: ['customFields', 'step', 'type'],
})
export default class AddCustomFieldsComponent extends Vue {
  @Prop() customFields!: CustomFieldsDto[];
  @Prop() step!: any;
  @Prop() type!: string;

  customWidth = 176;
  customFieldId = '';
  customFieldValue = '';
  customFieldType = '';
  customFilter = 'text';
  selectedFieldItem: any = {};
  selectedFieldItem2: any = {};
  conditionalCustomFields: any = [{ name: '=', value: this.$t('input.valueIsEqual') }];
  filterCustomFields = [
    { name: 'text', value: this.$t('input.customfields_text') },
    { name: 'compare_fields', value: this.$t('input.customfields_compare') },
  ];

  beforeMount() {
    const step = this.$props.step;
    this.customFieldId = step?.custom_field_id || '';
    this.customFieldType = step.custom_field_type || step.filter_custom_field || '';
    this.selectedFieldItem = {
      id: Number(step?.custom_field_id) || 0,
      title: step?.custom_field_name || '',
      type: step?.custom_field_type || '',
      decimalLength: step?.custom_field_decimal_length || 0,
    };
    this.selectedFieldItem2 = {
      id: Number(step?.custom_field_value) || 0,
      title: step?.custom_field_name_2 || '',
      type: '',
    };
    this.customFieldValue = step?.custom_field_value || '';
    if (this.customFieldType) {
      this.loadConfigs(this.customFieldType);
    }
  }

  mounted() {
    this.makeElementsSameSize();
  }

  makeElementsSameSize() {
    let maxLength = 0;
    this.customFieldsFilter.forEach((value: any) => {
      if (value.title.length > maxLength) {
        maxLength = value.title.length;
      }
    });
    this.customWidth = (maxLength * 280) / 37 + 70;
    if (this.customWidth < 176) {
      this.customWidth = 176;
    }
  }

  removeStep() {
    this.$emit('removeStep');
  }

  updateStep(key: string, value: string, name?: string, key2?: string) {
    this.$emit('updateStep', key, value);
    if (name) {
      this.$emit('updateStep', key2, name);
    }
    if (key === 'filter_custom_field') {
      this.customFilter = value;
    }
  }

  updateFields(item: any) {
    this.updateStep('custom_field_id', item.id);
    this.updateStep('custom_field_name', item.title);
    this.updateStep('custom_field_type', item.type || 'text');
    this.loadConfigs(item.type);
  }

  loadConfigs(type: string) {
    this.conditionalCustomFields = [
      { name: '=', value: this.$t('input.valueIsEqual') },
      { name: '!=', value: this.$t('input.valueIsDifferent') },
    ];
    if (['compare_fields', 'text'].includes(type)) {
      this.conditionalCustomFields = this.conditionalCustomFields.concat([
        { name: 'iLike', value: this.$t('input.valueContains') },
      ]);
    } else {
      this.conditionalCustomFields = this.conditionalCustomFields.concat([
        { name: '>', value: this.$t('input.valueGreater') },
        { name: '>=', value: this.$t('input.valueGreaterOrEqual') },
        { name: '<', value: this.$t('input.valueLess') },
        { name: '<=', value: this.$t('input.valueLessOrEqual') },
      ]);
    }
  }

  get customFieldsFilter() {
    const customFields = this.$props.customFields;
    return customFields.filter((item: any) => item.id !== this.selectedFieldItem.id);
  }

  formatDecimal() {
    const input = this.$refs.inputNumber as HTMLInputElement;
    const decimalLength = this.selectedFieldItem.decimalLength;
    let value = input.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    if (parts.length > 1) {
      value = parts[0] + '.' + parts[1].substring(0, decimalLength);
    } else {
      value = parts[0];
    }
    input.value = value;
    this.updateStep('custom_field_value', value);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.date-text {
  display: flex;
  margin-bottom: -30px;
  width: 167px;
  font-size: 12px;
}

.w-176 {
  width: 176px;
}
label {
  color: $ds-gray !important;
  font-weight: bold;
  font-size: 14px;
}

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
.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.select-card {
  border-radius: 0px 0px 8px 8px !important;
  width: max-content;
}
.select-options {
  border-bottom: 1px solid $ds-gray-100;
}
.option {
  display: flex;
  flex-direction: column;
  border-top: 1px solid $ds-gray-100;
  gap: 0.25em;
  padding: 8px;
  background-color: #ffffff;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-transform: capitalize;
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
  min-width: 283px;
  width: max-content;
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
  min-width: 176px;
  width: max-content;
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

.icon-up {
  color: $ds-gray;
}

.div-trash {
  display: flex;
  align-items: flex-end;
}
</style>
