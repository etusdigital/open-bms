<template>
  <div class="d-flex" v-if="render">
    <div class="container">
      <div class="item">
        <v-autocomplete
          v-model="customFieldSelected"
          class="form-control mo-select"
          item-text="title"
          return-object
          solo
          cache-items
          :label="`${$t('input.select')}`"
          :no-data-text="`${$t('datatable.noData')}`"
          :items="customFields"
          @input="updateData"
        >
        </v-autocomplete>
      </div>
      <div class="item">
        <div v-if="customFieldSelected.type === 'date'">
          <DatePickerCustomFieldComponent :step="step" @updateInfo="updateData" />
        </div>
        <div v-else-if="customFieldSelected.type === 'number'">
          <input
            ref="inputNumber"
            autofocus
            type="text"
            class="form-control w-176 value-input"
            @input="formatDecimal()"
            :value="customFieldValue"
            :disabled="customFieldSelected.id === 0"
          />
        </div>
        <div v-else>
          <input
            ref="inputText"
            autofocus
            type="text"
            class="form-control w-176 value-input"
            :value="customFieldValue"
            :disabled="customFieldSelected.id === 0"
            @input="formatText()"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import CustomFieldsService from '@/modules/customfields/services/customFields.service';
import DatePickerCustomFieldComponent from '@/components/conditional-steps/DatePickerCustomFieldComponent.vue';

@Component({
  components: {
    DatePickerCustomFieldComponent,
  },
  props: ['render', 'step'],
})
export default class CustomFieldComponent extends Vue {
  private readonly customFieldsServices = new CustomFieldsService();

  @Prop() step!: any;
  @Prop() render!: boolean;

  customFieldValue = '';
  customFieldSelected: any = '';
  customFields: any = [];

  async listCustomField() {
    const customFields = await this.customFieldsServices.getCustomFields({ page: 1 });
    this.customFields = (customFields?.data || []).map((customField: any) => {
      return {
        id: customField.id,
        title: customField.title,
        type: customField.type,
        decimalLength: customField.decimalLength,
      };
    });
  }
  beforeMount() {
    this.listCustomField();
    this.showModal();
  }
  hideModal() {
    this.$emit('hideModal');
  }
  updateData(event?: any) {
    if (event) {
      this.$emit('updateInfo', {
        customFieldValue: event.customFieldValue,
        customFieldSelected: this.customFieldSelected,
      });
      return;
    }
    this.$emit('updateInfo', {
      customFieldValue: this.customFieldValue,
      customFieldSelected: this.customFieldSelected,
    });
  }
  formatText() {
    const input = this.$refs.inputText as HTMLInputElement;
    this.customFieldValue = input.value;
    this.updateData();
  }
  formatDecimal() {
    const input = this.$refs.inputNumber as HTMLInputElement;
    const decimalLength = this.customFieldSelected.decimalLength;
    let value = input.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    if (parts.length > 1) {
      value = parts[0] + '.' + parts[1].substring(0, decimalLength);
    } else {
      value = parts[0];
    }
    input.value = value;
    this.customFieldValue = value;
    this.updateData();
  }
  @Watch('render')
  showModal() {
    if (this.render) {
      this.customFieldValue = this.step?.settings?.customFieldValue || '';
      this.customFieldSelected = this.step?.settings?.customFieldSelected || '';
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.container {
  width: 100%;
  display: flex;
}

.item {
  width: 50%;
  padding: 5px;
  // box-sizing: border-box;
  display: flex;
  align-items: center;
}
</style>
