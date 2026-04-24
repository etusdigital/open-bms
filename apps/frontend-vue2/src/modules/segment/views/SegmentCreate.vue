<template>
  <div class="view-new-segment" :class="{ 'col-12': segmentType !== 'segment-base-size' }">
    <div
      v-if="(!segment.isRealTimeSegment || segment.isProcessing) && segmentType !== 'segment-base-size'"
      class="info-segment"
      :class="[`info-segment-${segment.isProcessing ? 'inactive' : segment.status || 'active'}`]"
    >
      <p
        class="mb-0 d-flex align-items-center"
        :class="[`info-segment-p-${segment.isProcessing ? 'inactive' : segment.status || 'active'}`]"
      >
        <v-progress-circular
          indeterminate
          color="#FFC500"
          :size="24"
          class="mr-2"
          v-if="segment.isProcessing"
        ></v-progress-circular>
        <span class="material-symbols-rounded font-24 mr-3" v-else>
          {{ segment.status === 'inactive' ? 'priority_high' : 'info' }}
        </span>
        <template v-if="segment.status === 'inactive'">
          {{ $t('warning.segmentInactive') }}
          <span class="mx-1 info-segment-click" @click="confirmActive">{{ $t('warning.click') }}</span>
          {{ $t('warning.activeSegment') }}
        </template>
        <template v-else-if="segment.isProcessing">
          {{ $t('warning.segmentProcessing') }}
        </template>
        <template v-else>
          {{ $t('warning.segmentActive') }}
        </template>
      </p>
    </div>
    <v-row>
      <v-col cols="12" class="card-title-first pb-2">
        <div class="d-flex justify-space-between">
          <label class="label-title label-color mb-0 align-self-end font-16">{{ $t('title.details') }}</label>
          <div>
            <ButtonDefault
              :name="`${$t('sidebar.dashboard')}`"
              @click="dialogHistory = true"
              class="btn btn-c btn-lg btn-light btn-light-c button-outlined float-right button-historic"
            />
            <v-switch
              inset
              :ripple="false"
              color="#0057f4"
              class="mt-0 pr-5"
              :label="`Eventos Clickhouse`"
              v-model="segment.isClickhouseSegment"
            ></v-switch>
          </div>
        </div>
      </v-col>
    </v-row>
    <div class="container-segment mt-3">
      <div class="div-column gap-5">
        <div class="div-row gap-20 w-100">
          <div v-if="segmentType !== 'segment-base-size'" class="div-column w-50">
            <label class="font-12 text-600 label-color mb-1">{{ $t('datatable.name') }}</label>
            <InputDefault
              autofocus
              :modelValue="segment.name"
              @updateInput="updateInput"
              max="40"
              :keyInput="'name'"
              :disabled="segment.isProcessing"
            ></InputDefault>
            <span v-if="isNotAvailable" class="label-sub-title text-error">
              {{ $t('alert.nameExist', { product: $t('title.segment') }) }}
            </span>
          </div>
          <div class="div-column" :class="[segmentType !== 'segment-base-size' ? 'w-50' : 'w-100']">
            <label class="font-12 text-600 label-color mb-1">{{ $t('create.description') }}</label>
            <InputDefault
              max="255"
              :modelValue="segment.description"
              :keyInput="'description'"
              :disabled="segment.isProcessing"
              @updateInput="updateInput"
            ></InputDefault>
          </div>
        </div>
        <div class="div-row gap-20 w-100">
          <div class="div-column w-100">
            <label class="font-12 text-600 label-color mb-1">{{ $t('create.limitAudience') }}</label>
            <InputDefault
              :modelValue="segment.contactsLimit"
              :keyInput="'contactsLimit'"
              :disabled="segment.isProcessing"
              @updateInput="updateInput"
            ></InputDefault>
          </div>
          <div class="div-column">
            <label class="font-12 text-600 label-color mb-1 text-nowrap">{{ $t('input.realTime') }}</label>
            <v-switch
              inset
              :ripple="false"
              color="#0057f4"
              class="mt-0"
              v-model="segment.isRealTimeSegment"
              :disabled="segment.isProcessing"
            ></v-switch>
          </div>
        </div>
      </div>
    </div>
    <div class="row card-title">
      <label class="label-title label-color mb-0 align-self-end font-16">{{ $t('create.conditionGroup') }}</label>
    </div>
    <div class="container-selected" v-for="(card, index) in steps" :key="`card-${index}`">
      <template v-if="steps.length > 1 && (index || index == steps.length - 1)">
        <LineComponent :type="'horizontal'" />
        <SelectConditionalComponent
          :indexCard="index"
          @updateStep="updateCard"
          :color="'select-purple'"
          :items="selectConditionalValues"
          :conditionalName="'conditionalCard'"
          :value="getValueConditionalCard(card)"
        />
        <LineComponent :type="'horizontal'" />
      </template>
      <div class="container-segment">
        <div class="actions-card">
          <button class="mr-3 button-copy" @click="copyCard(index, card)" v-tooltip.bottom="$t('button.duplicate')">
            <span class="material-symbols-rounded ds-light-gray-color">content_copy</span>
          </button>
          <button @click="removeCard(index)" class="button-trash" v-tooltip.bottom="$t('button.delete')">
            <span class="material-symbols-rounded ds-light-gray-color">delete</span>
          </button>
        </div>
        <div class="cards-segment d-flex">
          <section v-for="(step, indexStep) in card" :key="step.index" class="d-flex">
            <template v-if="step.type !== 'conditionalCard'">
              <div class="step" :class="indexStep <= index ? 'first-step' : ''">
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
                    @removeStep="removeStep"
                    @updateStep="updateStep"
                  />
                </div>
              </div>
            </template>
          </section>
          <AddStepComponent
            @addStep="addStep"
            :index="index"
            :stepsTypes="getStepsTypes(card)"
            style="margin-left: 1px"
            :class="!card.length || (index > 0 && card.length < 2) ? 'mt-7' : 'mt-5'"
          />
        </div>
      </div>
    </div>
    <div class="text-center">
      <div v-if="steps.length">
        <LineComponent :type="'horizontal'" />
      </div>
      <v-btn class="v-btn-icon" :color="'#0FB75C'" small dark fab @click="addCard()">
        <span class="material-symbols-rounded"> add </span>
      </v-btn>
    </div>
    <div class="footer-buttons mt-6">
      <input
        v-if="segmentType !== 'segment-base-size'"
        class="cancel-button"
        text
        @click="$router.push('/segments')"
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="segment.id ? `${$t('button.save')}` : `${$t('button.create')}`"
        @click="buttonSave()"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-light btn-light-c float-right"
        :disabled="segment.isProcessing"
      />
    </div>
    <SegmentLogModal :data="segment.segmentInfo" :dialog="dialogHistory" @hideModal="hideModal" />
  </div>
</template>

<script script lang="ts">
import ServicesService from '@/modules/messages/services/services.service';
import LoadingService from '@/services/loading.service';
import { Component, Vue, Prop } from 'vue-property-decorator';
import ToastService from '@/services/toast.service';
import { SegmentDto } from '../dtos/segment.dto';
import StepsComponent from '@/components/conditional-steps/StepsComponent.vue';
import AddStepComponent from '@/components/conditional-steps/AddStepComponent.vue';
import LineComponent from '@/components/conditional-steps/LineComponent.vue';
import SelectConditionalComponent from '@/components/conditional-steps/SelectConditionalComponent.vue';
import TagService from '../../tags/services/tag.service';
import CustomFieldService from '../../customfields/services/customFields.service';
import { StepTypes } from '@/interfaces/step-conditional.interfaces';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import SegmentLogModal from '../components/SegmentLogModal.vue';
import { debounce } from '@/util/debounce';
import ModalService from '@/services/modal.service';
import { mapState } from 'vuex';

@Component({
  components: {
    StepsComponent,
    AddStepComponent,
    LineComponent,
    SelectConditionalComponent,
    ButtonDefault,
    InputDefault,
    SegmentLogModal,
  },
  providers: [LoadingService, ServicesService],
  computed: {
    ...mapState(['isSuperAdmin']),
  },
  props: ['segmentType'],
})
export default class SegmentCreate extends Vue {
  @Prop() segmentType!: string;

  public isSuperAdmin!: boolean;
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();
  private tagService = new TagService();
  private customFieldService = new CustomFieldService();
  private readonly modalService = new ModalService();

  dialogHistory = false;
  segment: SegmentDto = new SegmentDto({
    addBounced: false,
    addInvalid: false,
    addUnsubscribed: false,
    isRealTimeSegment: false,
    name: '',
    description: '',
  } as SegmentDto);
  tags: any = [];
  customFields: any = [];
  steps: any = [];
  textAlert = '';
  selectConditionalValues = [
    { name: 'INTERSECT', value: (this.$t('datatable.and') as string).toUpperCase() },
    { name: 'UNION', value: (this.$t('input.or') as string).toUpperCase() },
  ];
  selectConditionalStepsValues = [
    { name: 'and', value: (this.$t('datatable.and') as string).toUpperCase() },
    { name: 'or', value: (this.$t('input.or') as string).toUpperCase() },
  ];
  isNotAvailable = false;
  debouncedValidateName = debounce(() => this.validateTagName(), 300);

  addStep(item: string, index: number) {
    this.steps[`${index}`].push({
      type: item,
    });
  }

  addCard() {
    this.steps.push([]);
  }

  removeCard(index: number) {
    this.steps.splice(index, 1);
    if (index === 0 && this.steps.length) {
      this.steps[0].splice(0, 1);
    }
  }

  removeStep(indexCard: number, indexStep: number) {
    this.steps[indexCard].splice(indexStep, 1);
  }

  updateInput(event: never, keyInput: keyof SegmentDto) {
    this.segment[keyInput] = event;
    if (keyInput === 'name') {
      this.debouncedValidateName();
    }
  }

  copyCard(index: number, card: any) {
    const cloneCard = JSON.parse(JSON.stringify(card));
    this.steps.splice(index, 0, cloneCard);
    if (index === 0 && this.steps[index].length > 1) {
      this.steps[index + 1].unshift({
        type: 'conditionalCard',
        value: 'UNION',
      });
    }
  }

  hideModal(show: boolean) {
    this.dialogHistory = show;
  }

  updateStep(indexCard: number, indexStep: number, key: string, value: string | number) {
    this.steps[indexCard][indexStep][key] = value;
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
  }

  async beforeMount() {
    this.addCard();
    await this.getSegment();
    this.tags = (await this.tagService.getTags({ type: 'tag' })).data;
    const getCustomFields = (await this.customFieldService.getCustomFields()).data;
    this.customFields = this.parseCustomFields(getCustomFields);
    this.segment.type = 'segment';
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

  async getSegment() {
    let segmentData: any;
    const segmentId = +this.$route.params.segment_id;
    if (segmentId) {
      segmentData = (await this.tagService.getTagById(segmentId))?.data;
    }
    if (this.segmentType === 'segment-base-size') {
      segmentData = (await this.tagService.getTags({ type: 'segment-base-size' }))?.data[0];
    }
    if (segmentData) {
      this.segment = new SegmentDto(segmentData);
      this.steps = JSON.parse(this.segment.steps);
    }
  }

  getValueConditionalCard(card: any) {
    if (card.length && card[0].type === 'conditionalCard') {
      return card[0].value;
    }
    return 'UNION';
  }

  invalidStepsTimes() {
    let isInvalid = false;
    const stepsToValidate = ['automation_state', 'interation', 'custom_event'];
    for (const cards of this.steps) {
      for (const step of cards) {
        if (stepsToValidate.includes(step.type) && !step.time) {
          isInvalid = true;
        }
      }
    }
    return isInvalid;
  }

  async buttonSave() {
    try {
      if (this.invalidStepsTimes()) {
        this.toastService.show({
          type: 'error',
          text: this.$t('warning.periodSegmentInvalid') as string,
        });
        return;
      }
      this.segment.steps = this.steps;
      if (!this.segment.contactsLimit) {
        this.segment.contactsLimit = null;
      }
      this.segment.status = 'reactivating';

      if (this.segmentType === 'segment-base-size') {
        this.segment.type = this.segmentType;
        this.segment.name = '00 - Base size';
      }

      this.loadingService.show();
      let response;
      if (this.segment && this.segment.id) {
        response = await this.tagService.updateSegment(this.segment);
      } else {
        response = await this.tagService.createSegment(this.segment);
      }
      this.loadingService.hide();
      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('modal.segmentSaved') as string,
        });

        if (this.segmentType !== 'segment-base-size') {
          this.$router.push(`/segments`);
        }
      }
    } catch (error) {
      this.loadingService.hide();
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.erroSavingSegment') as string,
      });
    }
  }

  async validateTagName() {
    try {
      if (this.segment.name === undefined || this.segment.name.length < 3) {
        return;
      }

      const { data } = await this.tagService.checkAvailableName(this.segment.name || '', this.segment.id);

      if (!data || data.length === 0) {
        this.isNotAvailable = false;
      } else {
        this.isNotAvailable = true;
      }
    } catch (error) {
      console.error('Error checking segment title:', error);
      return false;
    }
  }

  confirmActive() {
    this.modalService.confirm({
      title: this.$t('modal.activateSegment') as string,
      text: `${this.$t('modal.infoActivateSegment')}`,
      confirmLabel: this.$t('button.activateSegment') as string,
      cancelLabel: this.$t('button.cancel') as string,
      confirmFunction: this.buttonSave,
      isConfirm: true,
    });
  }

  getStepsTypes(card: any) {
    const stepsTypes = [
      { title: this.$t('create.interactions'), name: StepTypes.INTERATION },
      { title: this.$t('create.customFields'), name: StepTypes.CUSTOM_FIELD },
      { title: this.$t('create.contactFields'), name: StepTypes.USER_FIELD },
      { title: this.$t('create.customEvent'), name: StepTypes.CUSTOM_EVENT },
      { title: this.$t('create.automation'), name: StepTypes.AUTOMATION_STATE },
    ];
    const tag = card.find((step: any) => step.type === 'tag');
    if (!tag) {
      stepsTypes.push({ title: 'Tags', name: StepTypes.TAG });
    }

    return stepsTypes;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep.view-new-segment {
  width: 100%;
}
.info-segment {
  padding: 8px 15px;
  border-radius: 20px;
  margin-bottom: 20px;
}
.info-segment-inactive {
  background-color: #fffdef;
  border: 1px solid #c0970c;
}
.info-segment-active,
.info-segment-reactivating {
  background-color: $ds-blue-100;
  border: 1px solid $ds-blue;
}
.info-segment-p-inactive {
  font-size: 11pt;
  color: #c0970c;
}
.info-segment-p-active,
.info-segment-p-reactivating {
  font-size: 11pt;
  color: $ds-blue;
}
.info-segment-click {
  font-weight: bold;
  text-decoration: underline;
  cursor: pointer;
}
.container-segment {
  position: relative;
  background-color: white;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  padding: 1rem;
  border-radius: 16px;
}

.card-title {
  margin: 24px 12px 8px 0px;
}

.button-historic {
  box-shadow: none !important;
  padding: 5px 30px !important;
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

  section {
    position: relative;
    align-items: center;
  }
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
  top: 51px !important;
}
.first-step {
  margin-top: 0px !important;
}

::v-deep .v-btn--is-elevated.v-btn--fab {
  box-shadow: none !important;
}
.step {
  margin-bottom: 8px;
}

.text-error {
  color: $ds-red;
}
::-webkit-scrollbar {
  height: 10px;
}
::-webkit-scrollbar-thumb {
  background-color: #c1c1c1;
  border-radius: 5px;
}
::v-deep .v-input__slot {
  min-height: 36px !important;
}
::v-deep .v-input--switch__track {
  opacity: 0.8;
}
</style>
