<template>
  <div
    v-tooltip.top="getAutomations()"
    class="card-info d-flex text-center"
    :class="[
      step.type,
      { 'cursor-pointer': !['splitPath', 'conditionalTrue', 'conditionalFalse', 'end'].includes(step.type) },
      { 'step-validate-error': stepError },
    ]"
    @click="editCard(step)"
  >
    <span
      v-if="step.type in cardIcons && cardIcons[step.type].isMaterial"
      class="material-symbols-rounded font-24 mr-2"
    >
      {{ cardIcons[step.type].icon }}
    </span>
    <img v-else-if="step.type in cardIcons" class="img-icon" :src="cardIcons[step.type].icon" alt="Icon" />
    <div
      class="justify-center div-column gap-5 align-items-center"
      :class="{ 'remove-automation-description': step.type === 'removeAutomation' }"
    >
      <span
        class="card-text text-600 font-12"
        :class="{ 'text-start': step.type === 'contactTransfer' }"
        v-html="text"
      ></span>
      <p class="mb-0 description font-12" v-html="description"></p>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component({
  props: ['step', 'text', 'description', 'stepError'],
  components: {},
})
export default class AutomationCardInfo extends Vue {
  @Prop() public description!: string;
  @Prop() public text!: string;
  @Prop() public step!: any;
  @Prop() public stepError!: boolean;

  cardIcons: any = {
    trigger: { icon: 'bolt', isMaterial: true },
    wait: { icon: 'watch_later', isMaterial: true },
    end: { icon: 'stop', isMaterial: true },
    addTag: { icon: 'shoppingmode', isMaterial: true },
    removeTag: { icon: 'shoppingmode', isMaterial: true },
    conditionalTime: { icon: 'update', isMaterial: true },
    conditional: { icon: 'alt_route', isMaterial: true },
    split: { icon: 'alt_route', isMaterial: true },
    splitPath: { icon: 'alt_route', isMaterial: true },
    updateCustomField: { icon: 'layers', isMaterial: true },
    contactValidate: { icon: 'verified', isMaterial: true },
    activeCampaign: { icon: require('@/assets/active_campaign.svg'), isMaterial: false },
    httpRequest: { icon: 'language', isMaterial: true },
    contactTransfer: { icon: 'move_up', isMaterial: true },
    removeAutomation: { icon: 'do_not_disturb_on', isMaterial: true },
  };

  getAutomations() {
    const step = this.step.settings[0];
    if (step?.user_field_automation?.length > 3) {
      return step?.user_field_automation
        ?.map((automation: any) => {
          return automation.title;
        })
        .join(', ');
    }
  }

  editCard(step: any) {
    if (['splitPath', 'conditionalTrue', 'conditionalFalse'].includes(step.type)) {
      return;
    }
    this.$emit('editCard', step);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.card-info {
  color: white;
  padding: 10px 15px 10px 10px;
  border-radius: 10px;
  width: auto;
  min-width: 130px;
  max-width: 400px;
  align-items: center;
  gap: 10px;
  transition: 0.5s;
}
.card-info:hover {
  transform: scale(1.1);
}
.description {
  color: white;
  line-height: 1.5em;
}
.trigger {
  background-color: $ds-purple;
}
.wait {
  background-color: $ds-gray;
}
.end {
  background-color: $ds-red;
}
.addTag {
  background-color: #0fb75c;
}
.removeTag {
  background-color: #f06158;
}
.updateCustomField {
  background-color: #076e62;
}
.conditionalTime {
  background-color: #ff9654;
}
.contactValidate {
  background-color: #076e62;
}
.conditional {
  background-color: #4a004f;
}
.split {
  background-color: #ffc500;
}
.splitPath {
  background-color: #ffc500;
}
.conditionalTrue {
  background-color: #0fb75c;
  place-content: center;
}
.conditionalFalse {
  background-color: $ds-red;
  place-content: center;
}
.httpRequest {
  background-color: $ds-purple;
}
.activeCampaign {
  background-color: $ds-blue;
}
.contactTransfer {
  background-color: #0031af;
}
.removeAutomation {
  background-color: #f5802a;
}
.img-icon {
  height: 20px;
  width: 20px;
  filter: invert(100%) sepia(94%) saturate(20%) hue-rotate(245deg) brightness(164%) contrast(100%);
}

.remove-automation-description {
  white-space: pre-line;
  text-align: start;
}
</style>
