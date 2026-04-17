<template>
  <div class="step mt-3">
    <div class="condicional-div">
      <template v-if="(indexStep > 1 || (indexStep && indexCard == 0)) && !dontShowConditional">
        <SelectConditionalComponent
          @updateStep="updateStep"
          :class="status === true ? 'mt-6 mb-0' : ''"
          :color="'select-purple'"
          :items="selectConditionalValues"
          :conditionalName="'conditional'"
          :value="step.conditional || selectConditionalValues[0].name"
          :disabled="disabled"
          style="margin-bottom: -16px"
        />
      </template>
    </div>
    <div
      class="view-new-step ml-4"
      :class="[(indexCard == 0 && indexStep > 0) || (indexCard > 0 && indexStep > 1) ? 'mt-6' : '']"
    >
      <LineComponent
        v-if="!dontShowFirstLine"
        :type="'vertical'"
        :style="
          step.type === 'tag' && step.tag_info && step.tag_info.length > 5
            ? 'display: flex; align-items: flex-start; margin-top: 48px;'
            : 'height: 40px'
        "
      />

      <AddAutomationComponent
        v-if="step.type == 'automation_state'"
        @removeStep="removeStep"
        @updateStep="updateStep"
        :step="step"
        :type="type"
      />
      <AddInterationComponent
        v-if="step.type == 'interation'"
        @removeStep="removeStep"
        @updateStep="updateStep"
        :step="step"
        :type="type"
      />
      <AddCustomFieldsComponent
        v-if="step.type == 'custom_field'"
        :customFields="customFields"
        @removeStep="removeStep"
        @updateStep="updateStep"
        :step="step"
        :type="type"
      />
      <AddTagComponent
        v-if="step.type == 'tag'"
        :tags="tags"
        :color="color"
        @removeStep="removeStep"
        @updateStep="updateStep"
        :step="step"
        style="margin-bottom: -3px"
        :disabled="disabled"
        :desactive="desactive"
      />
      <AddUserFieldsComponent
        v-if="step.type == 'user_field'"
        @removeStep="removeStep"
        @updateStep="updateStep"
        :step="step"
        :type="type"
      />
      <AddLeadComponent v-if="step.type == 'lead'" @removeStep="removeStep" @updateStep="updateStep" :step="step" />
      <AutomationEntryComponent
        v-if="step.type == 'automation'"
        :step="step"
        @updateStep="updateStep"
        @removeStep="removeStep"
        :selectedConditional="step.conditional_user_field"
      />
      <AddCustomEventComponent
        v-if="step.type == 'custom_event'"
        :step="step"
        :noFirstElement="(indexCard == 0 && indexStep > 0) || (indexCard > 0 && indexStep > 1)"
        @updateStep="updateStep"
        @removeStep="removeStep"
        :type="type"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import AddCustomFieldsComponent from './AddCustomFieldsComponent.vue';
import AddInterationComponent from './AddInterationComponent.vue';
import AddCustomEventComponent from './AddCustomEventComponent.vue';
import LineComponent from './LineComponent.vue';
import SelectConditionalComponent from './SelectConditionalComponent.vue';
import AddAutomationComponent from './AddAutomationComponent.vue';
import AddTagComponent from './AddTagComponent.vue';
import AddUserFieldsComponent from './AddUserFieldsComponent.vue';
import AutomationEntryComponent from './addUserFieldsFilters/AutomationEntry.vue';
import AddLeadComponent from './AddLeadComponent.vue';

@Component({
  components: {
    AddCustomFieldsComponent,
    AddInterationComponent,
    AddTagComponent,
    AddUserFieldsComponent,
    LineComponent,
    SelectConditionalComponent,
    AutomationEntryComponent,
    AddCustomEventComponent,
    AddAutomationComponent,
    AddLeadComponent,
  },
  props: [
    'indexCard',
    'indexStep',
    'step',
    'tags',
    'customFields',
    'selectConditionalValues',
    'type',
    'dontShowFirstLine',
    'dontShowConditional',
    'disabled',
    'desactive',
    'color',
    'status',
  ],
})
export default class StepsComponent extends Vue {
  @Prop() disabled!: boolean;
  @Prop() desactive!: boolean;
  @Prop() indexCard!: number;
  @Prop() indexStep!: number;
  @Prop() step!: any;
  @Prop() tags!: any;
  @Prop() customFields!: any;
  @Prop() selectConditionalValues!: any;
  @Prop() type!: string;
  @Prop() dontShowFirstLine!: boolean;
  @Prop() dontShowConditional!: boolean;
  @Prop() color!: string;
  @Prop() status!: boolean;

  removeStep() {
    this.$emit('removeStep', this.$props.indexCard, this.$props.indexStep);
  }
  updateStep(key: string, value: string | number) {
    this.$emit('updateStep', this.$props.indexCard, this.$props.indexStep, key, value);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.step {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.condicional-div {
  display: flex;
  justify-content: flex-start;
  width: 100%;
}

.view-new-step {
  display: flex;
}
.line {
  width: 2rem;
  height: 0px;
  border: 0.1px solid #000;
  margin-top: 51px;
}
.group-input {
  margin-top: auto;
}
</style>
