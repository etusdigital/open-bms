<template>
  <div class="d-flex">
    <SelectConditionalComponent
      @updateStep="updateStep"
      :color="'select-light-purple'"
      :items="conditionalLeadFields"
      :conditionalName="'conditional_lead_field'"
      :value="step.conditional_lead_field || '='"
      :hidden="selectedKey == leadField.ENGAGED"
    />

    <LineComponent :type="'vertical'" :hidden="selectedKey == leadField.ENGAGED" />

    <div>
      <v-menu
        v-if="listFields.length"
        ref="menu"
        v-model="showLead"
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
            :class="{ 'select-button-open': showLead === true }"
            v-on="on"
            @click="showLead = true"
          >
            <div class="menu" v-on="on">
              <p :class="{ 'menu-open': showLead === true }" style="display: flex; flex-direction: row">
                {{ selectedItemValue || $t('input.select') }}
              </p>
            </div>
            <div>
              <span
                class="material-symbols-rounded icon-up"
                :class="{ 'icon-dropdown  ds-blue-color': showLead === true }"
                >arrow_drop_down</span
              >
            </div>
          </v-btn>
        </template>
        <v-card width="283" class="select-card" :class="{ 'select-card-open': showLead === true }">
          <div class="select-options" v-for="(field, index) in listFields" :value="field.name" :key="field.name">
            <div class="option" @click="changeField(index)" :class="!listFields[index + 1] ? 'last-item' : ''">
              {{ field.value }}
            </div>
          </div>
        </v-card>
      </v-menu>
      <input
        v-else
        type="text"
        class="form-control w-176 value-input"
        @input="updateStep('lead_field_value', $event.target.value)"
        :value="selectedItemValue"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator';
import SelectConditionalComponent from '../SelectConditionalComponent.vue';
import LineComponent from '../LineComponent.vue';
import { LeadFieldsTypes } from '@/interfaces/step-conditional.interfaces';

@Component({
  components: { SelectConditionalComponent, LineComponent },
  props: ['step', 'listFields', 'selectedKey'],
})
export default class LeadSelectField extends Vue {
  public leadField = LeadFieldsTypes;
  public listFields!: Array<{ [key: string]: string }>;
  leadFieldKey = '';
  selectedItem = '';
  showLead = false;
  selectedItemValue: any = '';

  conditionalLeadFields = [
    { name: '=', value: 'Igual' },
    { name: '!=', value: 'Diferente' },
  ];

  beforeMount() {
    const step = this.$props.step;
    this.selectedItem = step?.lead_field_value || '';
    this.selectedItemValue =
      this.listFields.find((x: any) => x.name.toLowerCase() === this.selectedItem.toLowerCase())?.value ||
      this.selectedItem;
  }

  updateStep(key: string, value: string) {
    this.$emit('updateStep', key, value);
  }

  changeField(index: number) {
    this.showLead = false;
    this.selectedItemValue = this.listFields[index].value;
    this.selectedItem = this.listFields[index].name;
    this.updateStep('lead_field_value', this.selectedItem);
  }

  @Watch('listFields')
  async checkValues() {
    this.selectedItemValue = '';
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep.v-btn:not(.v-btn--round).v-size--default {
  width: 300px;
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
  width: 300px;
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
</style>
