<template>
  <div class="div-column w-100 background-card mb-0 gap-10 input-campaign-form">
    <button class="div-column w-100" @click="toggleModal()">
      <div class="div-row gap-10 justify-content-between align-items-center">
        <div class="div-row gap-10 align-items-center">
          <span
            class="font-28 ds-white-color material-symbols-rounded icon-send-background"
            :class="{
              'is-saved': isCompleted && !hasChanges,
              'is-not-saved': !isCompleted || hasChanges,
            }"
          >
            {{ isCompleted && !hasChanges ? 'check' : 'calendar_month' }}
          </span>
          <div class="div-column gap-5 align-items-start">
            <span class="font-18 ds-gray-color text-600">
              {{ $t('title.when') }}
            </span>
            <span class="font-14 ds-light-gray-color">{{ $t('title.defineWhen') }}</span>
          </div>
        </div>
        <span class="material-symbols-rounded font-24 ds-gray-color">
          {{ isMainModalOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}
        </span>
      </div>
    </button>
    <div
      v-if="isMainModalOpen || isClosing"
      class="div-column w-100 gap-5 pt-3 expandable-content campaign-what"
      :class="{ expanding: isMainModalOpen, closing: isClosing }"
    >
      <span class="font-12 ds-gray-color text-600">{{ $t('input.selectEventTypeOptions') }}</span>
      <v-radio-group v-model="sendTimeType" @change="updateType" class="mt-0">
        <v-radio value="afterEvent">
          <template v-slot:label>
            <div
              class="text-radio-button"
              :class="sendTimeType === 'afterEvent' ? 'active-option-label' : 'inactive-option-label'"
            >
              {{ $t('input.sendAfterEvent') }}
            </div>
          </template>
        </v-radio>
        <v-radio value="wait">
          <template v-slot:label>
            <div
              class="text-radio-button"
              :class="sendTimeType === 'wait' ? 'active-option-label' : 'inactive-option-label'"
            >
              {{ $t('input.sendAfterWait') }}
            </div>
          </template>
        </v-radio>
        <WaitComponent
          :render="true"
          :step="{ settings: waitStepData }"
          @updateInfo="updateData"
          class="pt-2"
          v-if="sendTimeType === 'wait'"
        />
      </v-radio-group>
      <ButtonDefault
        :name="$t('button.next')"
        data-cy="button-view-fields"
        class="create-message-button next-button mb-1"
        @click="nextStep"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import WaitComponent from '@/modules/automations/components/UpdateModal/WaitComponent.vue';
import { CampaignsDto } from '@/modules/campaigns/dtos/campaigns.dto';

@Component({
  components: {
    ButtonDefault,
    WaitComponent,
  },
  props: ['campaign', 'isNew', 'forceOpen'],
})
export default class WhenComponent extends Vue {
  @Prop() campaign!: CampaignsDto;
  @Prop() isNew!: boolean;
  @Prop() forceOpen!: boolean;

  isMainModalOpen = false;
  isClosing = false;
  sendTimeType = 'afterEvent';
  timeValue = '';
  timeType = '';
  waitStepData: any = {};
  localCampaign!: CampaignsDto;
  isCompleted = false;
  hasChanges = false;
  originalData: any = null;

  toggleModal() {
    if (this.isMainModalOpen) {
      this.isClosing = true;
      this.isMainModalOpen = false;

      setTimeout(() => {
        this.isClosing = false;
      }, 300);
    } else {
      this.isMainModalOpen = true;
    }
  }

  updateType(value: string) {
    this.sendTimeType = value;
    this.trackChanges();
  }

  updateData(value: any) {
    this.timeValue = value.timer;
    this.timeType = value.timerType;
    this.waitStepData = {
      timer: value.timer,
      timerType: value.timerType,
    };
    this.trackChanges();
  }

  nextStep() {
    let stepPayload: any = {};

    if (this.sendTimeType === 'wait') {
      stepPayload = {
        type: this.sendTimeType,
        settings: {
          timer: this.timeValue,
          timerType: this.timeType,
        },
      };
      this.$emit('nextStep', stepPayload);
    } else {
      this.$emit('nextStep', {
        type: this.sendTimeType,
      });
    }

    this.toggleModal();
    this.isCompleted = true;
    this.hasChanges = false;
    this.updateOriginalData();
  }

  @Watch('campaign')
  onCampaignChange(newVal: any) {
    this.localCampaign = newVal;
    if (this.localCampaign && this.localCampaign.steps) {
      const waitData = this.getWaitDataFromSteps(this.localCampaign.steps);

      if (waitData) {
        this.fillComponentFromWaitData(waitData);
        this.isCompleted = true;
      } else {
        this.sendTimeType = 'afterEvent';
        this.isCompleted = true;
      }

      if (!this.isNew) {
        this.updateOriginalData();
        this.hasChanges = false;
      }
    }
  }

  getWaitDataFromSteps(steps: any): any {
    let waitData = null;

    const traverseStep = (step: any) => {
      if (!step) {
        return;
      }

      if (step.type === 'wait' && step.settings) {
        waitData = {
          timer: step.settings.timer,
          timerType: step.settings.timerType,
        };
        return;
      }

      if (step.child && Array.isArray(step.child)) {
        step.child.forEach(traverseStep);
      }
    };

    traverseStep(steps);
    return waitData;
  }

  fillComponentFromWaitData(waitData: any) {
    this.waitStepData = waitData;
    if (waitData.timer && waitData.timerType) {
      this.sendTimeType = 'wait';
      this.timeValue = waitData.timer;
      this.timeType = waitData.timerType;
    }
  }

  @Watch('sendTimeType')
  onSendTimeTypeChange(newVal: string) {
    if (newVal === 'afterEvent') {
      this.waitStepData = {};
      this.timeValue = '';
      this.timeType = '';
    }
  }

  trackChanges() {
    if (!this.isNew && this.originalData) {
      const currentData = {
        sendTimeType: this.sendTimeType,
        timeValue: this.timeValue,
        timeType: this.timeType,
      };

      this.hasChanges =
        currentData.sendTimeType !== this.originalData.sendTimeType ||
        currentData.timeValue !== this.originalData.timeValue ||
        currentData.timeType !== this.originalData.timeType;
    }
  }

  updateOriginalData() {
    this.originalData = {
      sendTimeType: this.sendTimeType,
      timeValue: this.timeValue,
      timeType: this.timeType,
    };
  }

  @Watch('forceOpen', { immediate: true })
  onForceOpenChange(newVal: boolean) {
    if (newVal && !this.isMainModalOpen) {
      this.isMainModalOpen = true;
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.campaign-what {
  border-top: 1px solid $ds-gray-200;
}

.input-campaign-form {
  padding: 20px;
}

.icon-send-background {
  border-radius: 50%;
  padding: 10px;
  place-content: center;
  text-align: center;
}

.is-not-saved {
  background-color: $ds-blue;
}

.is-saved {
  background-color: $ds-green;
}

.expandable-content {
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
  transform-origin: top;
}

.expanding {
  animation: slideDown 0.3s ease-out;
}

.closing {
  animation: slideUp 0.3s ease-in;
}

@keyframes slideDown {
  0% {
    max-height: 0;
    opacity: 0;
  }
  100% {
    max-height: 1000px;
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  0% {
    max-height: 1000px;
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    max-height: 0;
    opacity: 0;
  }
}

.inactive-option-label {
  color: #5c5c5c;
  font-weight: 400 !important;
}

.active-option-label {
  font-weight: 600;
  color: #0057f4 !important;
}

.text-radio-button {
  font-size: 12px;
  line-height: 15px;
  letter-spacing: 0em;
  text-align: left;
  pointer-events: none !important;
  display: flex;
  justify-content: center;
  align-items: center;
}

.text-radio-button-inactive {
  color: #5c5c5c !important;
}
.text-radio-button-active {
  color: #0057f4 !important;
}
.create-message-button {
  color: $neutral-basic-white !important;
  height: 26px !important;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.1em;
  padding: 0px 12px !important;
  box-shadow: none !important;
  font-size: 10px !important;
  z-index: 10;
}

.next-button {
  place-self: flex-end;
}
::v-deep .v-input--radio-group .v-input__control {
  height: auto !important;
}

::v-deep .v-input--radio-group--column .v-radio:not(:last-child):not(:only-child) {
  margin-bottom: 0px !important;
}

::v-deep .v-label {
  margin-top: 6.5px;
}

::v-deep .v-input--radio-group {
  margin-top: 4px;
  padding: 0;
}

::v-deep .v-input input {
  max-height: 36px !important;
}
</style>
