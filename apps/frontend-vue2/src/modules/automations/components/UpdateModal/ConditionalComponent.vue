<template>
  <div v-if="render">
    <div class="group-input w-100">
      <div class="container-selected" v-for="(card, index) in steps" :key="`card-${index}`">
        <div class="container-segment">
          <div class="cards-segment d-flex">
            <section v-for="(step, indexStep) in card" :key="step.index" class="d-flex section">
              <template v-if="step.type !== 'conditionalCard'">
                <div
                  class="vertical-line"
                  :class="[indexStep <= index ? 'first-vertical-line' : '', index > 0 ? 'not-first-card' : '']"
                ></div>
                <div style="position: relative">
                  <StepsComponent
                    :step="step"
                    :indexStep="indexStep"
                    :indexCard="index"
                    :tags="tags"
                    :customFields="customFields"
                    :selectConditionalValues="selectConditionalStepsValues"
                    :type="'automations'"
                    :dontShowFirstLine="false"
                    @removeStep="removeStep"
                    @updateStep="updateStep"
                  />
                </div>
              </template>
            </section>
            <AddStepComponent @addStep="addStep" :index="index" :stepsTypes="stepsTypes" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import SelectConditionalComponent from '@/components/conditional-steps/SelectConditionalComponent.vue';
import AddStepComponent from '@/components/conditional-steps/AddStepComponent.vue';
import LineComponent from '@/components/conditional-steps/LineComponent.vue';
import StepsComponent from '@/components/conditional-steps/StepsComponent.vue';
import { StepTypes } from '@/interfaces/step-conditional.interfaces';
import TagService from '../../../tags/services/tag.service';
import CustomFieldService from '../../../customfields/services/customFields.service';

@Component({
  components: { AddStepComponent, LineComponent, SelectConditionalComponent, StepsComponent },
  props: ['render', 'step', 'localeType'],
})
export default class ConditionalComponent extends Vue {
  @Prop() step!: any;
  @Prop() render!: boolean;
  @Prop() localeType!: string;
  private tagService = new TagService();
  private customFieldService = new CustomFieldService();

  steps: any = [[]];
  tags: any;
  customFields: any;
  selectConditionalStepsValues = [
    { name: 'and', value: (this.$t('datatable.and') as string).toUpperCase() },
    { name: 'or', value: (this.$t('input.or') as string).toUpperCase() },
  ];
  stepsTypes = [
    { title: this.$t('create.interactions'), name: StepTypes.INTERATION },
    { title: this.$t('create.customFields'), name: StepTypes.CUSTOM_FIELD },
    { title: 'Tags', name: StepTypes.TAG },
    { title: this.$t('create.customEvent'), name: StepTypes.CUSTOM_EVENT },
    { title: this.$t('create.contactFields'), name: StepTypes.USER_FIELD },
    { title: this.$t('input.entryAutomation'), name: StepTypes.AUTOMATION },
    { title: this.$t('input.leadData'), name: StepTypes.LEAD_DATA },
  ];

  async beforeMount() {
    this.tags = (await this.tagService.getTags({ type: 'tag' })).data;
    this.customFields = this.parseCustomFields((await this.customFieldService.getCustomFields()).data);
    this.showModal();
  }

  parseCustomFields(customFields: any) {
    return customFields.map((customField: any) => {
      return {
        id: customField.id,
        title: customField.title,
        type: customField.type,
        decimalLength: customField.decimalLength,
      };
    });
  }

  addStep(item: string, index: number) {
    this.steps[`${index}`].push({
      type: item,
    });
    this.updateData();
  }

  removeStep(indexCard: number, indexStep: number) {
    this.steps[indexCard].splice(indexStep, 1);
    this.updateData();
  }

  updateStep(indexCard: number, indexStep: number, key: string, value: string | number) {
    this.steps[indexCard][indexStep][key] = value;
    this.updateData();
  }

  updateCard(key: string, value: string, indexCard: number) {
    if (this.steps[indexCard].length) {
      this.steps[indexCard][0].value = value;
    } else {
      this.steps[indexCard].unshift({
        type: key,
        value,
      });
    }
    this.updateData();
  }

  hideModal() {
    this.$emit('hideModal');
  }
  updateData() {
    this.$emit('updateInfo', this.steps[0]);
  }

  @Watch('render')
  showModal() {
    if (this.render) {
      this.steps = this.step.child && this.step.child.length ? [this.step.child[0].settings] : [[]];
    }

    if (this.localeType === 'trigger') {
      this.steps = [this.step];
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.cards-segment {
  display: flex;
  flex-direction: column;
  overflow-y: hidden !important;

  .section {
    position: relative;
    align-items: center;
    max-height: 224px;
    overflow-y: hidden !important;
  }
}

.first-step {
  margin-top: 1px !important;
}

.step {
  margin-bottom: 15px;
}
.first-vertical-line {
  position: absolute;
  width: 2px;
  height: 100% !important;
  background: $ds-gray-300;
  top: 50px !important;
  left: 16px;
}
.vertical-line {
  z-index: 0;
  position: absolute;
  width: 2px;
  height: calc(100% + 180px);
  background: $ds-gray-300;
  top: 0;
  left: 16px;
}

.not-first-card.first-vertical-line {
  top: 58px !important;
}
.first-step {
  margin-top: 0px !important;
}
::v-deep .v-btn--is-elevated.v-btn--fab {
  box-shadow: none !important;
}
</style>
