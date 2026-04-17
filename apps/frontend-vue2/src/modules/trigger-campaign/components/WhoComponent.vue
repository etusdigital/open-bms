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
            {{ isCompleted && !hasChanges ? 'check' : 'people' }}
          </span>
          <div class="div-column gap-5 align-items-start">
            <span class="font-18 ds-gray-color text-600">
              {{ $t('title.who') }}
            </span>
            <span class="font-14 ds-light-gray-color">{{ $t('title.defineWho') }}</span>
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
      <select class="form-control mo-select outline-select text-600" v-model="typeTrigger" @change="updateData">
        <option
          class="font-12"
          v-for="trigger in triggerOptions"
          :value="trigger.value"
          :key="'triggertype-' + trigger.value"
        >
          {{ trigger.name }}
        </option>
      </select>

      <select
        class="form-control mo-select outline-select text-600"
        v-if="typeTrigger === 'events'"
        v-model="eventType"
        @change="updateData"
      >
        <option
          class="font-12"
          v-for="trigger in eventTriggerOptions"
          :value="trigger.value"
          :key="'eventtriggertype-' + trigger.value"
        >
          {{ trigger.name }}
        </option>
      </select>

      <v-autocomplete
        v-model="selectedOptionData"
        v-if="typeTrigger === 'custom_events'"
        item-color="#EBE9E8"
        :elevation="0"
        class="c-autocomplete font-12"
        :placeholder="`${$t('input.search')}`"
        :no-data-text="
          isLoadingEvents
            ? $t('input.searching')
            : searchCustomEvents
            ? $t('datatable.noData')
            : $t('input.noCustomEvents')
        "
        :items="customEventsOptions"
        :item-text="'name'"
        :return-object="true"
        :multiple="false"
        :outlined="false"
        :search-input.sync="searchCustomEvents"
        :loading="isLoadingEvents"
        @change="updateCustomEvent"
        @click="handleAutocompleteEvents()"
        solo
      />

      <v-menu
        v-if="typeTrigger === 'events' && eventType !== 'first_open_30_days'"
        class="select-menu mt-3"
        ref="menu"
        v-model="showMessage"
        :close-on-content-click="false"
      >
        <template v-slot:activator="{ on }">
          <button class="select-button font-12 text-space ds-gray-color" @click.prevent="showMessage = true" v-on="on">
            {{ selectedMessage || $t('input.selectInsert') }}
            <span
              class="material-symbols-rounded icon-up"
              :class="{ 'icon-dropdown ds-blue-color': showMessage === true }"
            >
              arrow_drop_down
            </span>
          </button>
        </template>
        <div class="message-card" :class="{ 'select-button-open message-div': showMessage === true }">
          <div class="div-row input-message align-items-center">
            <input
              class="ds-gray-color font-12 text-space"
              type="text"
              id="trigger-messages-search"
              v-model="messageName"
              :placeholder="$t('input.selectInsert')"
              @input="getMessages($event.target.value)"
            />
            <span
              class="material-symbols-rounded icon-up"
              :class="{ 'icon-dropdown ds-blue-color': showMessage === true }"
            >
              arrow_drop_down
            </span>
          </div>
          <div class="messages-list-folder">
            <div class="message-list d-flex ds-gray-color cursor-pointer font-12" v-if="isLoadingMessages">
              {{ $t('input.searching') }}
            </div>

            <!-- <div
            class="message-list d-flex ds-gray-color cursor-pointer font-12"
            @click="selectMessage(undefined, 'any', undefined)"
          >
            {{ $t('input.anyMessage') }}
          </div> -->
            <div v-if="!isLoadingMessages && localMessages.length">
              <div
                class="message-list d-flex ds-gray-color cursor-pointer font-12"
                v-for="message in localMessages"
                :key="message.id"
                @click="selectMessage(message.id, message.name, message.title)"
              >
                {{ message.title }}
              </div>
            </div>
          </div>
        </div>
      </v-menu>

      <label class="title-label">{{ $t('automation.allowAllContacts') }}</label>
      <div class="radio-group">
        <v-radio-group v-model="applyFrequency" @change="updateData" class="mt-0">
          <v-radio value="unique">
            <template v-slot:label>
              <div
                class="text-radio-button"
                :class="applyFrequency === 'unique' ? 'active-option-label' : 'inactive-option-label'"
              >
                {{ $t('automation.onlyOnce') }}
              </div>
            </template>
          </v-radio>
          <v-radio value="multiply-period">
            <template v-slot:label>
              <div
                class="text-radio-button"
                :class="applyFrequency === 'multiply-period' ? 'active-option-label' : 'inactive-option-label'"
              >
                {{ $t('automation.multipleTimes') }}
              </div>
            </template>
          </v-radio>
          <div class="multiply-period py-1" v-show="applyFrequency === 'multiply-period'">
            <input
              v-if="applyFrequency !== 'unique'"
              v-model="timePeriod"
              class="input-bms"
              :placeholder="$t('input.reportTime')"
              type="number"
              maxlength="2"
              :disabled="applyFrequency !== 'multiply-period'"
              @change="updateData()"
              id="time-period"
            />
            <select
              v-if="applyFrequency !== 'unique'"
              v-model="typeMultiply"
              class="form-control mo-select input-height no-outline"
              @change="updateData()"
              :disabled="applyFrequency !== 'multiply-period'"
              id="time-period-type"
            >
              <option class="font-12" value="" selected disabled>
                {{ $t('input.selectTypeOptions') }}
              </option>
              <option v-for="options in multiplyOptions" :value="options.value" :key="options.value" class="font-12">
                {{ options.name }}
              </option>
            </select>
          </div>
          <v-radio value="multiply">
            <template v-slot:label>
              <div
                class="text-radio-button"
                :class="applyFrequency === 'multiply' ? 'active-option-label' : 'inactive-option-label'"
              >
                {{ $t('automation.multipleTimesWithout') }}
              </div>
            </template>
          </v-radio>
        </v-radio-group>
      </div>

      <label class="title-label">{{ $t('title.conditional') }}</label>
      <div class="mt-2">
        <ConditionalComponent
          :render="true"
          :step="selectedOptionData.conditional || []"
          @updateInfo="updateConditional"
          :localeType="'trigger'"
        />
      </div>
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
import ConditionalComponent from '@/modules/automations/components/UpdateModal/ConditionalComponent.vue';
import CustomEventService from '@/modules/custom-events/services/custom-event.service';
import { CampaignsDto } from '@/modules/campaigns/dtos/campaigns.dto';

@Component({
  components: {
    ButtonDefault,
    ConditionalComponent,
  },
  props: ['messages', 'isNew', 'campaign', 'forceOpen'],
})
export default class WhoComponent extends Vue {
  @Prop() messages!: any[];
  @Prop() isNew!: boolean;
  @Prop() campaign!: CampaignsDto;
  @Prop() forceOpen!: boolean;

  customEventService = new CustomEventService();
  isMainModalOpen = false;
  isClosing = false;
  showMessage = false;
  messageName = '';
  selectedMessage = '';
  applyFrequency = 'unique';
  timePeriod = 0;
  typeMultiply = '';
  customEventsOptions: any[] = [];
  searchCustomEvents = '';
  isLoadingEvents = false;
  isLoadingMessages = false;
  localMessages: any[] = [];
  isCustomEventsInitialRequestMade = false;
  multiplyOptions = [
    { name: this.$t('input.days'), value: 'days' },
    { name: this.$t('title.hour') + 's', value: 'hours' },
    { name: this.$t('title.minutes'), value: 'minutes' },
  ];
  typeTrigger = '';
  eventType = '';
  triggerOptions = [
    { name: this.$t('input.selectTypeOptions'), value: '' },
    { name: this.$t('input.triggerMessageEvents'), value: 'events' },
    { name: this.$t('input.triggerCustomEvents'), value: 'custom_events' },
  ];
  eventTriggerOptions = [
    { name: this.$t('input.selectEventTypeOptions'), value: '' },
    { name: this.$t('input.open'), value: 'open' },
    { name: this.$t('input.click'), value: 'click' },
    { name: this.$t('input.triggerFirstOpen30Days'), value: 'first_open_30_days' },
  ];
  lastCustomEventsSearch = '';
  customEventObj: any = {};
  messageObj: any = {};
  selectedOptionData: any = { conditional: [] };
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

  updateData() {
    if (this.typeTrigger === 'events') {
      this.selectedOptionData = {
        ...this.messageObj,
        type: this.typeTrigger,
        eventType: this.eventType,
        ...(this.eventType === 'first_open_30_days' && {
          id: 0,
        }),
      };
    }

    if (this.typeTrigger === 'custom_events') {
      this.selectedOptionData = {
        ...this.customEventObj,
        type: this.typeTrigger,
      };
    }

    this.selectedOptionData.applyFrequency = this.applyFrequency;

    if (this.applyFrequency === 'multiply-period') {
      let parseMinutes = 1;
      if (this.typeMultiply === 'hours') {
        parseMinutes *= 60;
      } else if (this.typeMultiply === 'days') {
        parseMinutes *= 24 * 60;
      }
      this.selectedOptionData.timePeriod = this.timePeriod * parseMinutes;
      this.selectedOptionData.typeMultiply = this.typeMultiply;
      this.trackChanges();
    } else {
      this.selectedOptionData.timePeriod = 0;
      this.selectedOptionData.typeMultiply = '';
    }
  }

  updateCustomEvent(event: any) {
    this.customEventObj = event;
    this.updateData();
  }

  async handleAutocompleteEvents() {
    if (!this.isCustomEventsInitialRequestMade) {
      this.isCustomEventsInitialRequestMade = true;
      this.customEventsOptions = await this.findEvents();
    }
  }

  selectMessage(messageId: number | undefined, messageName: string | undefined, messageTitle: string | undefined) {
    this.showMessage = false;
    this.selectedMessage = messageName === 'any' ? (this.$t('input.anyMessage') as string) : messageTitle || '';
    this.messageObj =
      messageId !== undefined
        ? {
            id: messageId,
            name: messageName,
            title: messageTitle,
          }
        : {
            name: messageName,
          };
    this.updateData();
  }

  updateConditional(conditional: any) {
    this.selectedOptionData.conditional = conditional;
    this.trackChanges();
  }

  getMessages(inputValue: string) {
    this.$emit('getAllMessages', inputValue);
  }

  async findEvents(search?: string): Promise<any> {
    this.isLoadingEvents = true;
    try {
      const response: any = await this.customEventService.getCustomEvents({
        title: search || '',
        page: 1,
        itemsPerPage: 20,
      });

      return response.data?.results.map((item: any) => {
        return {
          id: item.id,
          name: item.name,
        };
      });
    } catch (err) {
      this.isLoadingEvents = false;
      throw err;
    } finally {
      this.isLoadingEvents = false;
    }
  }

  nextStep() {
    this.$emit('nextStep', this.selectedOptionData);
    this.toggleModal();
    this.isCompleted = true;
    this.hasChanges = false;
    this.updateOriginalData();
  }

  @Watch('searchCustomEvents')
  async onSearchCustomEvents(search: string) {
    if (search && search !== this.lastCustomEventsSearch) {
      const data = await this.findEvents(search);
      this.customEventsOptions = data;
      this.lastCustomEventsSearch = search;
    }
  }

  @Watch('messages')
  checkMessages(newVal: any[]) {
    this.localMessages = newVal;
  }

  @Watch('forceOpen', { immediate: true })
  onForceOpenChange(newVal: boolean) {
    if (newVal && !this.isMainModalOpen) {
      this.isMainModalOpen = true;
    }
  }

  @Watch('showMessage')
  openMessagesMenu(isOpen: boolean) {
    if (isOpen) {
      setTimeout(() => {
        if ((document.querySelector('#trigger-messages-search') as HTMLElement) !== null) {
          (document.querySelector('#trigger-messages-search') as HTMLElement).focus();
        }
      }, 100);
    }
  }

  @Watch('applyFrequency')
  changeFrequency() {
    if (this.applyFrequency !== 'multiply-period') {
      this.selectedOptionData.timePeriod = 0;
      this.selectedOptionData.typeMultiply = '';
    }
    this.selectedOptionData.applyFrequency = this.applyFrequency;
  }

  @Watch('isMainModalOpen')
  showModal() {
    if (this.isMainModalOpen) {
      let parseMinutes = 1;
      if (this.selectedOptionData.typeMultiply === 'hours') {
        parseMinutes *= 60;
      } else if (this.selectedOptionData.typeMultiply === 'days') {
        parseMinutes *= 24 * 60;
      }

      this.selectedMessage =
        this.selectedOptionData?.name === 'any' ? this.$t('input.anyMessage') : this.selectedOptionData?.title;
      this.typeTrigger = this.selectedOptionData?.type ?? '';
      this.searchCustomEvents = this.selectedOptionData?.name;
      this.applyFrequency = this.selectedOptionData.applyFrequency || 'unique';
      this.timePeriod = parseInt(this.selectedOptionData.timePeriod, 10) / parseMinutes || 0;
      this.typeMultiply = this.selectedOptionData.typeMultiply || '';
      this.messageObj = this.selectedOptionData;
      this.eventType = this.selectedOptionData.eventType || '';
      this.customEventObj = this.selectedOptionData.customEvent || {};
      this.getMessages(this.typeTrigger === 'events' ? this.selectedOptionData.name : '');
    } else {
      this.showMessage = false;
    }
  }

  @Watch('campaign')
  onCampaignChange(newVal: any) {
    this.localCampaign = newVal;
    if (this.localCampaign && this.localCampaign.steps) {
      const triggerData = this.getTriggerDataFromSteps(this.localCampaign.steps);
      if (triggerData) {
        this.populateComponentFromTriggerData(triggerData);
        this.isCompleted = true;

        if (!this.isNew) {
          this.updateOriginalData();
          this.hasChanges = false;
        }
      }
    }
  }

  getTriggerDataFromSteps(steps: any): any {
    let triggerData = null;

    const traverseStep = (step: any) => {
      if (!step) {
        return;
      }

      if (step.type === 'trigger' && step.settings) {
        triggerData = step.settings;
        return;
      }

      if (step.child && Array.isArray(step.child)) {
        step.child.forEach(traverseStep);
      }
    };

    traverseStep(steps);
    return triggerData;
  }

  populateComponentFromTriggerData(triggerData: any) {
    this.selectedOptionData = { ...triggerData };
    this.typeTrigger = triggerData.type || '';
    this.eventType = triggerData.eventType || '';
    this.applyFrequency = triggerData.applyFrequency || 'unique';

    let parseMinutes = 1;
    if (triggerData.typeMultiply === 'hours') {
      parseMinutes = 60;
    } else if (triggerData.typeMultiply === 'days') {
      parseMinutes = 24 * 60;
    }

    this.timePeriod = triggerData.timePeriod ? triggerData.timePeriod / parseMinutes : 0;
    this.typeMultiply = triggerData.typeMultiply || '';

    this.selectedMessage = triggerData.name === 'any' ? this.$t('input.anyMessage') : triggerData.title;

    if (triggerData.type === 'events') {
      this.messageObj = {
        id: triggerData.id,
        name: triggerData.name,
        title: triggerData.title,
      };
    }
  }

  trackChanges() {
    if (!this.isNew && this.originalData) {
      const currentData = {
        typeTrigger: this.typeTrigger,
        eventType: this.eventType,
        selectedMessage: this.selectedMessage,
        applyFrequency: this.applyFrequency,
        timePeriod: this.timePeriod,
        typeMultiply: this.typeMultiply,
        conditional: JSON.stringify(this.selectedOptionData.conditional || []),
        customEventName: this.selectedOptionData.name,
      };

      this.hasChanges =
        currentData.typeTrigger !== this.originalData.typeTrigger ||
        currentData.eventType !== this.originalData.eventType ||
        currentData.selectedMessage !== this.originalData.selectedMessage ||
        currentData.applyFrequency !== this.originalData.applyFrequency ||
        currentData.timePeriod !== this.originalData.timePeriod ||
        currentData.typeMultiply !== this.originalData.typeMultiply ||
        currentData.conditional !== this.originalData.conditional ||
        currentData.customEventName !== this.originalData.customEventName;
    }
  }

  updateOriginalData() {
    this.originalData = {
      typeTrigger: this.typeTrigger,
      eventType: this.eventType,
      selectedMessage: this.selectedMessage,
      applyFrequency: this.applyFrequency,
      timePeriod: this.timePeriod,
      typeMultiply: this.typeMultiply,
      conditional: JSON.stringify(this.selectedOptionData.conditional || []),
      customEventName: this.selectedOptionData.name,
    };
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

.outline-select {
  outline: none !important;
  &:focus {
    outline: none !important;
    box-shadow: none !important;
  }
}

.radio-group {
  display: flex;
  flex-direction: column;
}
.screen-trigger {
  display: flex;
  flex-direction: column;
}

.multiply-period {
  display: flex;
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.3s ease;
  justify-content: center;
  align-items: center;

  > * {
    flex: 1;
    &:not(:last-child) {
      margin-right: 10px;
    }
  }
}

.radio-group .multiply-period {
  max-height: 150px;
}
.c-autocomplete {
  margin-bottom: 0px !important;
  border: none !important;
  box-shadow: none !important;
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-top: 1px solid $ds-gray-300 !important;
  border-bottom: 1px solid $ds-gray-300 !important;
  border-radius: 8px !important;
}

.c-autocomplete ::v-deep .v-autocomplete__content {
  margin-top: -1 !important;
  top: 100% !important;
  border-top: none !important;
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-bottom: 1px solid $ds-gray-300 !important;
  border-radius: 0px 0px 8px 8px !important;
  box-shadow: none !important;
}

.c-autocomplete ::v-deep .v-input--is-focused + .v-input__slot {
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-top: 1px solid $ds-gray-300 !important;
  border-bottom: 0px solid $ds-gray-300 !important;
  border-radius: 8px 8px 0px 0px !important;
}

.c-autocomplete ::v-deep .v-input--is-focused + .v-menu__content {
  border: 1px solid $ds-blue !important;
  border-top: none !important;
  border-radius: 0 0 8px 8px !important;
}

.c-autocomplete ::v-deep .v-list-item__action {
  display: none !important;
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

.inactive-option-label {
  color: #5c5c5c;
  font-weight: 400 !important;
}

.active-option-label {
  font-weight: 600;
  color: #0057f4 !important;
}

.title-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
  margin-bottom: 0px !important;
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
.outline-select {
  outline: none !important;
  &:focus {
    outline: none !important;
    box-shadow: none !important;
  }
}

.c-autocomplete {
  border-radius: 8px;
  box-shadow: none !important;
  ::v-deep .v-input__control {
    height: auto !important;
    min-height: auto !important;
  }

  ::v-deep .v-input__slot {
    margin: 0 !important;
    box-shadow: none !important;
  }
}

.menu-message-list {
  display: flex;
  align-items: center;
}

.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: -webkit-fill-available;
  border-radius: 8px 8px 0px 0px !important;
}

.select-button {
  height: 36px;
  padding-left: 11px;
  padding-right: 11px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #ffffff !important;
  box-shadow: none;
  overflow: unset !important;
  width: -webkit-fill-available;
}

.text-space {
  text-wrap: nowrap;
  outline: none;
  letter-spacing: 0.05em;
  width: -webkit-fill-available;
}

.message-card {
  background-color: #ffffff;
  width: -webkit-fill-available;
}

.select-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.input-message {
  justify-content: space-between;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px;
  overflow: hidden;
  border-bottom: 1px solid #d9d9d9;
}

.message-div {
  border-bottom: 1px solid $ds-blue;
  border-radius: 8px !important;
}

.messages-list-folder {
  max-height: 200px;
  overflow-y: scroll;
}

.message-list {
  border-top: 1px solid #d9d9d9;
  height: 36px;
  padding-left: 11px !important;
  align-items: center;
}

.message-list:first-child {
  border-top: none;
}

.trigger-learn-more-button {
  position: relative;
  display: block;
  margin-bottom: -12px;
  font-size: 12px;
}

::v-deep .v-text-field__details,
::v-deep .v-messages,
::v-deep .v-menu {
  display: none !important;
}
::v-deep .v-input input {
  max-height: 36px !important;
}

.no-outline {
  &:focus {
    box-shadow: none;
    outline: none;
  }
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
</style>
