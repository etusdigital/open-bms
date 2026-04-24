<template>
  <div
    class="automation_steps_container"
    :class="[`step-location-id-${step.id}`, { 'remove-automation-description': step.type === 'removeAutomation' }]"
  >
    <div
      class="div-row gap-10 align-items-center"
      v-if="
        [
          'email',
          'webPush',
          'mobilePush',
          'sms',
          'whatsapp',
          'testAB',
          'randomMessage',
          'randomWebPush',
          'randomMobilePush',
        ].includes(step.type)
      "
    >
      <MessageCardComponent
        :step="step"
        @editCard="editCard"
        :statistics="currentStatistics"
        :automationId="automationId"
        @saveStepData="saveStepData"
        :stepError="step.id === stepValidateError"
      />
      <button
        class="ml-auto button-trash button-placement"
        v-if="step.type !== 'testAB' || (step.type === 'testAB' && step.settings.status !== 'running')"
        @click.prevent="confirmDelete(step.id, step.type)"
      >
        <span class="material-symbols-rounded ds-light-gray-color icon-active">delete</span>
      </button>
    </div>
    <div class="div-row gap-10 align-items-center" v-else>
      <AutomationCardInfo
        :step="step"
        :text="renderText()"
        :stepError="step.id === stepValidateError"
        :description="description"
        @editCard="editCard"
      />
      <button
        class="ml-auto button-trash button-placement"
        v-if="!['end', 'trigger', 'splitPath', 'conditionalTrue', 'conditionalFalse'].includes(step.type)"
        @click.prevent="confirmDelete(step.id, step.type)"
      >
        <span class="material-symbols-rounded ds-light-gray-color icon-active">delete</span>
      </button>
    </div>
    <DeleteModal
      :openModal="openModal"
      :stepId="step.id"
      :type="removeType"
      :branches="step.settings"
      @deleteChoice="deleteChoice"
      @closeModal="closeModal"
    />
    <template v-if="!['end', 'split', 'conditional'].includes(step.type) && !isNotActualVersion">
      <LineComponent :type="'horizontal'" />
      <AddStepButtonComponent @addMessage="addCard(step.id)" />
    </template>
    <template v-if="['split', 'conditional'].includes(step.type)">
      <LineComponent :type="'horizontal'" />
      <svg
        :width="svgWidth"
        height="20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="step_split_svg"
        :style="`margin-left: ${svgMarginLeft}px`"
      >
        <path
          :d="`M1 20V12C1 5.3726 6.37258 0 13 
          0H${svgWidth - 10}C${svgWidth - 2} 0 ${svgWidth} 5.3726 ${svgWidth} 12V20`"
          stroke="#A6A6A6"
          stroke-linejoin="round"
        />
      </svg>
    </template>
    <template v-if="hasChild()">
      <LineComponent :type="'horizontal'" v-if="!['split', 'conditional'].includes(step.type)" />
      <div class="d-flex div-child">
        <RenderChild
          v-for="(child, index) in step.child"
          :lastId="lastId"
          :key="`child${index}`"
          :step="child"
          :statistics="statistics"
          :isNotActualVersion="isNotActualVersion"
          :automationId="automationId"
          :stepId="step.id"
          :editStepId="editStepId"
          :stepValidateError="stepValidateError"
          @updateModal="editCard"
          @addCard="addCard"
          @finishedLoading="finishedLoading"
          @childHasBeenMounted="childHasBeenMounted"
          @childHasBeenDestroyed="childHasBeenDestroyed"
          @deleteChoice="deleteChoice"
          @saveStepData="saveStepData"
        />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import MessageCardComponent from '../components/MessageCardComponent.vue';
import AutomationCardInfo from '../components/AutomationCardInfo.vue';
import AddStepButtonComponent from '@/components/add-step-button/AddStepButtonComponent.vue';
import LineComponent from '@/components/conditional-steps/LineComponent.vue';
import UpdateStepModal from '../components/UpdateStepModal.vue';
import { mapState } from 'vuex';
import ModalService from '@/services/modal.service';
import DeleteModal from '@/components/common/DeleteModal.vue';
import store from '@/store';
import { LeadFieldsTypes } from '@/interfaces/step-conditional.interfaces';

@Component({
  name: 'RenderChild',
  components: {
    AddStepButtonComponent,
    AutomationCardInfo,
    LineComponent,
    MessageCardComponent,
    UpdateStepModal,
    DeleteModal,
  },
  computed: {
    ...mapState(['userLanguage', 'currentUser', 'currentAccount']),
  },
  props: [
    'step',
    'index',
    'statistics',
    'lastId',
    'isNotActualVersion',
    'automationId',
    'stepId',
    'editStepId',
    'stepValidateError',
  ],
})
export default class RenderChild extends Vue {
  @Prop() public readonly step!: any;
  @Prop() public readonly lastId!: number;
  @Prop() public readonly statistics!: any;
  @Prop({ default: false }) readonly isNotActualVersion!: boolean;
  @Prop() public readonly automationId!: any;
  @Prop() public readonly stepId!: number;
  @Prop() public readonly editStepId!: number;
  @Prop() public readonly stepValidateError!: number;

  private readonly modalService = new ModalService();

  rendredChilds = 0;
  childsElements: HTMLElement[] = [];
  childsPosition: any = {};
  svgMarginLeft = 0;
  svgWidth = 0;
  isLanguageEnUs = false;
  userLanguage!: string;
  currentStatistics: any;
  openModal = false;
  deletedChoice!: string;
  description = '';
  removeType = '';

  beforeMount() {
    this.isLanguageEnUs = this.userLanguage === 'en-US';
    this.description = this.renderDescription();
  }

  editCard(step: any) {
    this.$emit('updateModal', step);
  }

  addCard(stepId: number) {
    this.$emit('addCard', stepId);
  }

  finishedLoading() {
    this.$emit('finishedLoading');
  }

  hasChild() {
    const { child } = this.step;
    if (this.lastId === this.step.id) {
      this.finishedLoading();
    }
    return child && child.length > 0;
  }

  renderText() {
    switch (this.step.type) {
      case 'trigger':
        if (!this.step.settings.type) {
          return this.$t('button.addTrigger');
        }
        if (this.step.settings.type === 'web-push') {
          return this.$t('input.triggerWebPush');
        }
        if (this.step.settings.type === 'mobile-push') {
          return this.$t('input.triggerMobilePush');
        }
        if (this.step.settings.type === 'tag') {
          return `${this.$t('input.triggerAddTag')}: ${this.step.settings.name}`;
        }
        if (this.step.settings.type === 'events') {
          if (this.step.settings.eventType === 'first_open_30_days') {
            return this.$t('automation.triggerFirstOpen30Days');
          }

          return `${
            this.step.settings.eventType === 'open'
              ? this.$t('automation.triggerEventOpen')
              : this.$t('automation.triggerEventClick')
          }: ${this.step.settings.title ? this.step.settings.title : this.$t('input.anyMessage')}`;
        }
        if (this.step.settings.type === 'custom_events') {
          return this.$t('automation.triggerCustomEvent', { name: this.step.settings.name });
        }
        break;
      case 'addTag':
        if (Array.isArray(this.step.settings) && this.step.settings.length > 1) {
          return this.$t('automation.addTagCount', { count: this.step.settings.length }) + ':';
        }
        return this.$t('button.addTag') + ':';

      case 'removeTag':
        if (Array.isArray(this.step.settings) && this.step.settings.length > 1) {
          return this.$t('automation.removeTagCount', { count: this.step.settings.length }) + ':';
        }
        return this.$t('button.removeTag') + ':';

      case 'wait':
        return this.$tc(`automation.wait${this.step.settings.timerType}`, this.step.settings.timer, {
          duration: this.step.settings.timer,
        });

      case 'conditionalTime':
        return this.$t('automation.conditionalTime', {
          startTime: this.formatTime(this.step.settings.initialTime),
          endTime: this.formatTime(this.step.settings.endTime),
        });

      case 'conditional':
        return this.$t('automation.conditional');

      case 'updateCustomField':
        return `${this.$t('automation.fillField')} <strong>
          ${this.step.settings.customFieldSelected.title}
          </strong> ${this.$t('automation.withValue')}: <strong>${this.formattedCustomField({
            customFieldValue: this.step.settings.customFieldValue,
            customFieldType: this.step.settings.customFieldSelected.type,
          })}</strong>`;

      case 'end':
        this.description = '';
        return this.$t('automation.end');

      case 'split':
        return this.$t('automation.split');

      case 'splitPath':
        return `${this.splitPathName(this.step.settings.path)}: ${this.step.settings.value}%`;

      case 'conditionalTrue':
        return this.$t('automation.yes');

      case 'conditionalFalse':
        return this.$t('automation.no');

      case 'httpRequest':
        const link =
          this.step.settings.url.length > 40
            ? `${this.step.settings.url.match(/.{1,40}/g)[0]}...`
            : this.step.settings.url;
        return `${this.$t('title.httpRequest')} ${this.$t('title.toLink', { link })}`;

      case 'contactValidate':
        return this.$t('automation.contactEmailValidate');

      case 'activeCampaign':
        return this.$t('automation.sendActiveCampaign', { list: this.step.settings?.list?.name || '' });

      case 'contactTransfer':
        return `${this.$t('automation.transferAccount', {
          account: this.step.settings?.accountName || '',
        })}</br> ${this.$t('automation.transferTags', {
          tag: this.step.settings?.tagName,
        })}`;

      case 'removeAutomation':
        const automationList = this.step.settings?.automations?.map((automation: any) => automation.title) || [];
        const displayList = automationList.slice(0, 3);
        const remaining = automationList.length > 3 ? ` +${automationList.length - 3}` : '';
        return this.$t('automation.removeAutomation', {
          automation: displayList.length ? '\n- ' + displayList.join(',\n- ') + remaining : '',
        });
    }
  }

  getPaths() {
    if (this.step.settings.headers) {
      let paths = '/';
      this.step.settings.headers.forEach((header: any) => {
        paths += header + '/';
      });
      return paths.slice(0, -1);
    }
  }

  renderDescription() {
    if (['addTag', 'removeTag'].includes(this.step.type)) {
      const step = this.step;
      const tags = step.settings;
      let description = '';
      switch (step.type) {
        case 'addTag':
          if (Array.isArray(tags)) {
            if (tags.length > 1) {
              description += `${tags[0].name} + ${tags.length - 1}`;
              break;
            }

            if (tags.length === 0) {
              description = '';
            } else {
              description += `${tags[0].name}`;
            }
            break;
          }
          description += `${tags.name}`;
          break;
        case 'removeTag':
          if (Array.isArray(tags)) {
            if (tags.length > 1) {
              description += `${tags[0].name} +${tags.length - 1}`;
              break;
            }
            description += `${tags[0].name}`;
            break;
          }
          description += `${tags.name}`;
          break;
      }
      return description;
    }
    if (this.step.type === 'conditional' && this.step.settings.length) {
      const step = this.step.settings[0];
      return this.formattedConditionalDescription(step, this.step.settings.length);
    }
    if (this.step.type === 'trigger' && this.step.settings.conditional && this.step.settings.conditional.length) {
      const step = this.step.settings.conditional[0];
      return this.formattedConditionalDescription(step, this.step.settings.conditional.length);
    }

    return '';
  }

  formattedConditionalDescription(step: any, stepsLenght: number) {
    const conditionalCustomFields: any = {
      '=': this.$t('input.valueIsEqual'),
      iLike: this.$t('input.valueContains'),
      '!=': this.$t('input.valueIsDifferent'),
      '>': this.$t('input.valueGreater'),
      '>=': this.$t('input.valueGreaterOrEqual'),
      '<': this.$t('input.valueLess'),
      '<=': this.$t('input.valueLessOrEqual'),
    };
    const formatDate = new Date();
    let description = '';
    switch (step.type) {
      case 'interation':
        let timeFilter =
          step.conditional_interation === 'yes' ? this.$t('automation.notNull') : this.$t('automation.isNull');
        if (step.time !== 'all') {
          formatDate.setDate(formatDate.getDate() - step.time);
          timeFilter =
            step.conditional_interation === 'yes'
              ? `<strong>${conditionalCustomFields['>']}</strong> ${Vue.filter('formatDate')(formatDate)}`
              : `<strong>${conditionalCustomFields['<']}</strong> ${Vue.filter('formatDate')(formatDate)}
                  ${this.$t('automation.orNull')}`;
        }
        description += `${this.$t(`title.${step.event}`)} ${timeFilter}`;
        break;
      case 'tag':
        const tagsName = step.tag_info.map((tag: { id: number; name: string }) => {
          return tag.name;
        });
        description += `<strong>${this.$t('title.containsTags')}</strong> (${tagsName.join(',')})`;
        break;
      case 'custom_field':
        description += `${this.$t('create.customFields')}: ${step.custom_field_name} <strong>${
          conditionalCustomFields[step.conditional_custom_field as keyof typeof conditionalCustomFields]
        }</strong> ${
          step.custom_field_name_2 ||
          this.formattedCustomField({
            customFieldValue: step.custom_field_value,
            customFieldType: step.custom_field_type,
          })
        }`;
        break;
      case 'user_field':
        if (step.user_field_key === 'created_at_date') {
          if (step.conditional_user_field === '-') {
            description += `${this.$t('title.createdSinceXDays', { days: step.user_field_value })}`;
            break;
          }

          description += `${this.$t('title.creationDate')} <strong>${
            conditionalCustomFields[step.conditional_user_field as keyof typeof conditionalCustomFields]
          }</strong> ${Vue.filter('formatDate')(step.user_field_value)}`;
          break;
        }
        if (step.user_field_key === 'automation_entry') {
          description += `${this.$t('title.entryAutomation')} ${step.user_field_automation.title} ${
            step.user_field_value === 1
              ? this.$t('title.lastDay')
              : this.$t('title.lastDays', { days: step.user_field_value })
          }.`;
        }
        if (step.user_field_key === 'email_provider') {
          description += `${this.$t('title.sendingProvider')} <strong>${
            conditionalCustomFields[step.conditional_user_field as keyof typeof conditionalCustomFields]
          }</strong> ${step.user_field_value}`;
          break;
        }
        if (step.user_field_key === 'communication_channels') {
          const communicationKeys: any = {
            has_email: this.$t('title.hasEmail'),
            has_web_push: this.$t('title.hasWebPush'),
            has_mobile_push: this.$t('title.hasMobilePush'),
            has_phone: this.$t('title.hasPhone'),
            true: this.$t('title.has'),
            false: this.$t('title.doesNotHas'),
          };
          description += `<strong>${communicationKeys[step.conditional_user_field]}</strong>: ${
            communicationKeys[step.user_field_value]
          }`;
          break;
        }
        break;
      case 'lead':
        if (step.lead_field_key === LeadFieldsTypes.ENGAGED) {
          const key = parseInt(step.lead_field_value, 10) < 0 ? 'neverEngaged' : 'engagedRecently';
          description += ` ${this.$t(`automation.${key}`, { days: Math.abs(step.lead_field_value) })}`;
          break;
        }
        description += ` ${this.$t(`automation.${step.lead_field_key}`)} ${
          conditionalCustomFields[`${step.conditional_lead_field}`]
        } ${
          step.lead_field_key === LeadFieldsTypes.STATUS
            ? this.$t(`title.${step.lead_field_value}`)
            : step.lead_field_value
        }`;
        break;
      case 'automation':
        const automationArray = step.user_field_automation.map((automation: any) => {
          return automation.title;
        });
        if (step.user_field_key === 'automation_entry') {
          description += `${this.$t('title.entryAutomation')} ${
            automationArray.slice(0, 3).join(', ') + (automationArray.length > 3 ? '...' : '')
          } ${
            step.user_field_value === '1'
              ? this.$t('title.lastDay')
              : this.$t('title.lastDays', { days: step.user_field_value })
          }.`;
        }
        break;
      case 'custom_event':
        description += `${
          step.conditional_event_type === 'in' ? this.$t('automation.has') : this.$t('automation.notHave')
        } ${this.$t('automation.event')} <strong>${step?.event?.name || ''}</strong>`;
        switch (step.time_type) {
          case 'time':
          case 'custom':
            description += ` ${
              step.time === '1' ? this.$t('title.lastDay') : this.$t('title.lastDays', { days: step.time })
            }`;
            break;
          case 'date':
            description += ` ${step.conditional_event_filter} ${Vue.filter('formatDate')(step.custom_event_date)}`;
            break;
          case 'range':
            description += ` ${this.$t('automation.between')} ${Vue.filter('formatDate')(
              step.custom_event_date
            )} ${this.$t('datatable.and')} ${Vue.filter('formatDate')(step.custom_event_date_end)}`;
            break;
        }
        break;
    }
    if (stepsLenght > 1) {
      description += ` ... ${this.$t('input.others')}`;
    }
    return description;
  }

  calculateChilds(): void {
    if (!this.hasChild() || this.rendredChilds < 2) {
      return;
    }

    this.svgWidth = 0;
    this.svgMarginLeft = 0;
    const child1 = this.childsElements[0];
    const child2 = this.childsElements[1];
    const parent = this.$el.getBoundingClientRect();

    this.svgWidth = this.getPositionAtCenter(child2).x - this.getPositionAtCenter(child1).x;
    this.svgMarginLeft = this.getPositionAtCenter(child1).x - parent.x - 8;
  }

  childHasBeenMounted(element: HTMLElement | undefined) {
    if (element) {
      this.rendredChilds++;
      this.childsElements.push(element);
    }

    this.calculateChilds();
    this.$emit('childHasBeenMounted');
  }

  childHasBeenDestroyed() {
    this.calculateChilds();
    setTimeout(() => {
      this.$emit('childHasBeenDestroyed');
    }, 100);
  }

  mounted() {
    this.$emit('childHasBeenMounted', this.$el);
  }

  destroyed() {
    this.$emit('childHasBeenDestroyed');
  }

  getPositionAtCenter(element: HTMLElement) {
    const { top, left, width, height } = element.getBoundingClientRect();
    return {
      x: left + width / 2,
      y: top + height / 2,
    };
  }

  formatTime(time: any) {
    if (!this.isLanguageEnUs) {
      return time + 'h';
    }

    if (!isNaN(time)) {
      let ampm = 'AM';
      if (time >= 12) {
        ampm = 'PM';
        if (time > 12) {
          time -= 12;
        }
      } else if (time === 0) {
        time = 12;
      }

      return `${time} ${ampm}`;
    }
  }

  splitPathName(path: string): string {
    if (parseInt(path, 10) > 26) {
      return String.fromCharCode(parseInt(path, 10) - 26 + 64) + '2';
    }

    return String.fromCharCode(parseInt(path, 10) + 64);
  }

  closeModal(value: boolean) {
    this.openModal = value;
  }

  deleteChoice(stepId: number, choice?: string) {
    this.$emit('deleteChoice', stepId, choice, 'remove');
  }

  saveStepData(stepId: number) {
    this.$emit('saveStepData', stepId, 'remove');
  }

  dateToStringLocal(date: Date) {
    return date.toLocaleDateString(store.state.userLanguage, { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  formattedCustomField(customField: any) {
    if (customField.customFieldType === 'date') {
      return this.dateToStringLocal(new Date(customField.customFieldValue));
    }
    return customField.customFieldValue;
  }

  confirmDelete(stepId: number, stepType?: string) {
    if (stepType === 'conditional' || stepType === 'split') {
      this.openModal = !this.openModal;
      this.removeType = stepType;
    } else {
      let modalText = '';

      if (stepType) {
        const stepName = this.$t(`title.${stepType}`) as string;
        modalText = this.$t('description.areYouSureDeleteStep', { step: stepName }) as string;
      } else {
        modalText = this.$t('description.areYouSureDelete') as string;
      }

      this.modalService.confirm({
        title: this.$t('button.deleteStep') as string,
        text: modalText,
        confirmLabel: this.$t('button.delete') as string,
        cancelLabel: this.$t('button.cancel') as string,
        confirmFunction: () => this.saveStepData(stepId),
        showClose: true,
      });
    }
  }

  @Watch('statistics', { immediate: true, deep: true })
  filterStatistics() {
    this.currentStatistics = this.statistics;
  }

  @Watch('editStepId', { immediate: true, deep: true })
  editStepDescription() {
    if (this.step.type === 'end') {
      this.description = '';
    } else {
      this.description = this.renderDescription();
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.automation_steps_container {
  display: inline-flex;
  align-items: center;
  flex-direction: column;
  padding: 0 0.5em;
}

.div-child {
  gap: 2rem;
}

.step_split_svg {
  align-self: flex-start;
}

.button-placement {
  margin-right: -34px;
}

.step-validate-error {
  border: 2px solid red;
}
</style>
