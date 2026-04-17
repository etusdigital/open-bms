<template>
  <div class="view-campaign-audience-step mt-2 w-100">
    <label
      class="title-label"
      v-if="
        [campaignMessageType.MOBILEPUSH, campaignMessageType.WEBPUSH, campaignMessageType.SMS].includes(
          newCampaign.messageType
        )
      "
    >
      {{ $t('sidebar.contacts') }}
    </label>
    <v-card
      v-if="
        [campaignMessageType.MOBILEPUSH, campaignMessageType.WEBPUSH, campaignMessageType.SMS].includes(
          newCampaign.messageType
        )
      "
    >
      <div class="swith-send-to-all mt-0">
        <label class="title-card">
          {{ $t('create.informationSend') }}
        </label>
        <v-radio-group v-model="sendToAll" @change="confirmSwitch">
          <v-radio :value="true">
            <template v-slot:label>
              <div class="option-label" :class="!sendToAll ? 'inactive-option-label' : 'active-option-label'">
                {{ $t('create.campaignSendToAll') }}
              </div>
            </template>
          </v-radio>
          <v-radio :value="false">
            <template v-slot:label>
              <div class="option-label" :class="sendToAll ? 'inactive-option-label' : 'active-option-label'">
                {{ $t('create.campaignSendToAllTags') }}
              </div>
            </template>
          </v-radio>
        </v-radio-group>
      </div>
    </v-card>
    <div v-if="newCampaign.sendToAll === false">
      <div class="d-flex justify-content-between align-items-end">
        <label class="title-label mt-6">{{ $t('sidebar.tags') }}</label>
        <v-switch
          v-if="isSuperAdmin || isMasterRetentionUser"
          v-model="runSegment"
          center-affix
          inset
          :label="`${$t('input.runSegment')}`"
          class="ml-1 mt-0 pt-0 active-switch switch-label-color"
          @click="runSegmentStatus()"
        ></v-switch>
      </div>

      <div class="container-selected" v-for="(card, index) in steps" :key="`card-${index}`">
        <template v-if="steps.length > 1 && (index || index == steps.length - 1)">
          <LineComponent :type="'horizontal'" />
          <SelectConditionalComponent
            :indexCard="index"
            @updateStep="updateCard"
            :items="selectConditionalValues"
            :conditionalName="'conditionalCard'"
            :value="getValueConditionalCard(card)"
          />
          <LineComponent :type="'horizontal'" />
        </template>

        <v-card>
          <div class="actions-card">
            <button
              class="mr-3 button-copy"
              type="button"
              @click="copyCard(index, card)"
              v-tooltip.bottom="$t('button.duplicate')"
            >
              <span class="material-symbols-rounded font-24 duplicate-icon"> layers </span>
              <!-- <img src="@/assets/copy-icon-full.svg" /> -->
            </button>
            <button
              @click="removeCard(index)"
              type="button"
              class="button-trash"
              v-tooltip.bottom="$t('button.delete')"
            >
              <!-- <img src="@/assets/trash-full.svg" /> -->
              <span class="material-symbols-rounded font-24 delete-icon">delete</span>
            </button>
          </div>
          <div class="cards-segment d-flex">
            <section v-for="(step, indexStep) in card" :key="step.index" class="d-flex section">
              <template v-if="step.type !== 'conditionalCard'">
                <div class="step" :class="{ 'first-step': indexStep == 0 || (index > 0 && indexStep == 1) }">
                  <div
                    class="vertical-line"
                    :class="[
                      indexStep <= index ? 'first-vertical-line' : '',
                      index > 0 ? 'not-first-card' : '',
                      step.isCardCopy ? 'copy-line' : '',
                    ]"
                  ></div>
                  <StepsComponent
                    :step="step"
                    :indexStep="indexStep"
                    :indexCard="index"
                    :tags="tags"
                    :color="'select-orange'"
                    :selectConditionalValues="selectConditionalValues"
                    @removeStep="removeStep"
                    @updateStep="updateStep"
                  />
                </div>
              </template>
            </section>
            <AddStepComponent @addStep="addStep" :index="index" :stepsTypes="stepsTypes" style="margin-left: 1px" />
          </div>
        </v-card>
      </div>

      <div class="text-center">
        <div v-if="steps.length">
          <LineComponent :type="'horizontal'" />
        </div>
        <v-btn
          class="v-btn-icon style-button"
          :color="'#0FB75C'"
          small
          dark
          fab
          @click="addCard()"
          style="margin-left: 2px"
        >
          <span class="material-symbols-rounded"> add </span>
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import SelectConditionalComponent from '@/components/conditional-steps/SelectConditionalComponent.vue';
import StepsComponent from '@/components/conditional-steps/StepsComponent.vue';
import AddStepComponent from '@/components/conditional-steps/AddStepComponent.vue';
import LineComponent from '@/components/conditional-steps/LineComponent.vue';
import { StepTypes } from '@/interfaces/step-conditional.interfaces';
import { CampaignMessageType } from '../enums/campaign.enum';
import { mapState } from 'vuex';

@Component({
  components: {
    AddStepComponent,
    LineComponent,
    SelectConditionalComponent,
    StepsComponent,
  },
  props: ['steps', 'tags', 'newCampaign'],
  computed: {
    ...mapState(['isSuperAdmin', 'isMasterRetentionUser']),
  },
})
export default class AudienceStep extends Vue {
  public campaignMessageType = CampaignMessageType;
  public isSuperAdmin!: boolean;
  public isMasterRetentionUser!: boolean;

  selectConditionalValues = [
    { name: 'EXCEPT', value: this.$t('title.notInclude') },
    { name: 'UNION', value: this.$t('title.include') },
  ];
  stepsTypes = [{ title: 'Tags', name: StepTypes.TAG }];
  sendToAll = false;
  runSegment = false;
  // beforeDestroy() {
  //   this.$emit('selectTag');
  // }

  addStep(item: string, index: number) {
    this.$emit('addStep', item, index);
  }
  addCard() {
    this.$emit('addCard');
  }
  removeCard(index: number) {
    this.$emit('removeCard', index);
  }
  removeStep(indexCard: number, indexStep: number) {
    this.$emit('removeStep', indexCard, indexStep);
  }
  copyCard(index: number, card: any) {
    this.$emit('copyCard', index, card);
  }
  updateStep(indexCard: number, indexStep: number, key: string, value: string | number) {
    this.$emit('updateStep', indexCard, indexStep, key, value);
  }
  updateCard(key: string, value: string, indexCard: number) {
    this.$emit('updateCard', key, value, indexCard);
  }
  getValueConditionalCard(card: any) {
    if (card.length && card[0].type === 'conditionalCard') {
      return card[0].value;
    }
    return 'UNION';
  }

  confirmSwitch(event: any) {
    this.$emit('updateInput', this.sendToAll, 'sendToAll');
  }

  runSegmentStatus() {
    this.$emit('updateInput', this.runSegment, 'runSegment');
  }

  mounted() {
    this.sendToAll = this.$props.newCampaign.sendToAll;
    this.runSegment = this.$props.newCampaign.runSegment || false;

    if ((this.$el.querySelector('.v-select__selections input') as HTMLElement) !== null) {
      (this.$el.querySelector('.v-select__selections input') as HTMLElement).focus();
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.container-conditional-tags {
  position: relative;
  background-color: white;
  padding: 1rem;
  border-radius: 20px;
  border-style: groove;
}

.title-label {
  font-size: 16px;
  font-weight: 600;
  line-height: 21px;
  letter-spacing: 0.05em;
  text-align: left;
  color: #5c5c5c;
}

.title-card {
  font-size: 12px !important;
  font-weight: 600 !important;
  line-height: 16px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
  margin-bottom: 1px;
}

.option-label {
  font-size: 12px;
  line-height: 15px;
  letter-spacing: 0em;
  text-align: left;
  margin-top: 6px;
}

.inactive-option-label {
  color: #5c5c5c;
  font-weight: 400;
}

.active-option-label {
  font-weight: 600;
  color: #0057f4;
}
.v-btn-icon {
  height: 33px !important;
  width: 33px !important;
}
.actions-card {
  z-index: 11;
  position: absolute;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  right: 18px;
}
.cards-segment {
  display: flex;
  flex-direction: column;
  overflow-y: hidden;

  .section {
    position: relative;
    align-items: center;
    max-height: 224px;
  }
}
.first-step {
  margin-top: 1px !important;
}
.step {
  margin-bottom: 15px;
}
.v-card {
  width: 100%;
  padding: 20px 20px 20px 20px;
  border-radius: 16px;
}

::v-deep .v-sheet.v-card:not(.v-sheet--outlined) {
  box-shadow: 0px 1px 3px 0px #0000001a;
  box-shadow: 0px 1px 2px 0px #0000000f;
}

::-webkit-scrollbar {
  height: 10px;
}
::-webkit-scrollbar-thumb {
  background-color: #c1c1c1;
  border-radius: 5px;
}
.select-purple {
  width: 120px !important;
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

.copy-line.not-first-card.first-vertical-line {
  top: 72px !important;
}

.duplicate-icon {
  font-size: 20px;
  color: #a6a6a6;
}
.duplicate-icon:hover {
  color: #858585;
}
.delete-icon {
  font-size: 20px;
  color: #a6a6a6;
  margin-bottom: -4px;
}

.delete-icon:hover {
  color: red;
}

label {
  font-size: 16px !important;
  font-weight: 600 !important;
  line-height: 20.8px !important;
}

::v-deep .v-btn--is-elevated.v-btn--fab {
  box-shadow: none !important;
}

::v-deep .v-input__slot {
  min-height: 36px !important;
}

.style-button {
  margin-bottom: 24px;
}
</style>
