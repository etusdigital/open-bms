<template>
  <div v-if="render">
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
      class="form-control mo-select outline-select text-600 mt-3"
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
      v-if="typeTrigger === 'tag'"
      item-color="#EBE9E8"
      :elevation="0"
      class="mt-3 c-autocomplete font-12"
      :placeholder="`${$t('input.search')}`"
      :no-data-text="
        isLoadingSearch ? $t('input.searching') : searchOptions ? $t('datatable.noData') : 'Nenhuma tag cadastrada'
      "
      :items="optionsSelect"
      :item-text="'name'"
      :return-object="true"
      :multiple="false"
      :outlined="false"
      :search-input.sync="searchOptions"
      :loading="isLoadingSearch"
      @change="updateData()"
      @click="handleAutocompleteClick()"
      solo
    />

    <v-autocomplete
      v-model="selectedOptionData"
      v-if="typeTrigger === 'custom_events'"
      item-color="#EBE9E8"
      :elevation="0"
      class="mt-3 c-autocomplete font-12"
      :placeholder="`${$t('input.search')}`"
      :no-data-text="
        isLoadingEvents ? $t('input.searching') : searchCustomEvents ? $t('datatable.noData') : 'Nenhuma tag cadastrada'
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
            @input="debouncedValidateName(messageName)"
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
          <div v-if="!isLoadingMessages && messages.length">
            <div
              class="message-list d-flex ds-gray-color cursor-pointer font-12"
              v-for="message in messages"
              :key="message.id"
              @click="selectMessage(message.id, message.name, message.title)"
            >
              {{ message.title }}
            </div>
          </div>
        </div>
      </div>
    </v-menu>

    <label class="title-label mt-4">{{ $t('automation.allowAllContacts') }}</label>
    <div class="radio-group">
      <v-radio-group v-model="applyFrequency" @change="updateData">
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
        <div class="multiply-period" v-show="applyFrequency === 'multiply-period'">
          <input
            v-if="applyFrequency !== 'unique'"
            v-model="timePeriod"
            class="input-bms"
            :placeholder="$t('input.reportTime')"
            type="number"
            maxlength="2"
            :disabled="applyFrequency !== 'multiply-period'"
            @change="updateData()"
          />
          <select
            v-if="applyFrequency !== 'unique'"
            v-model="typeMultiply"
            class="form-control mo-select"
            @change="updateData()"
            :disabled="applyFrequency !== 'multiply-period'"
          >
            <option v-for="options in multiplyOptions" :value="options.value" :key="options.value">
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
  </div>
</template>

<script lang="ts">
import InputDefault from '@/components/input/InputDefault.vue';
import MessagesService from '@/modules/messages/services/messages.service';
import AutomationService from '../../services/automations.service';
import CustomEventService from '@/modules/custom-events/services/custom-event.service';
import ConditionalComponent from './ConditionalComponent.vue';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import { debounce } from '@/util/debounce';

@Component({
  components: { InputDefault, ConditionalComponent },
  props: ['render', 'step'],
})
export default class TriggerComponent extends Vue {
  private readonly automationService = new AutomationService();
  private readonly messagesService = new MessagesService();
  private readonly customEventService = new CustomEventService();
  public messages: Array<MessageDto> = new Array<MessageDto>();
  @Prop() step!: any;
  @Prop() render!: boolean;
  optionsSelect = [];
  customEventsOptions = [];
  selectedOptionData: any;
  lastSearch = '';
  lastCustomEventsSearch = '';
  searchCustomEvents = '';
  isLoadingSearch = false;
  isLoadingEvents = false;
  isLoadingMessages = false;
  isInitialRequestMade = false;
  isCustomEventsInitialRequestMade = false;
  searchOptions = null;
  typeTrigger = '';
  typeMultiply = '';
  eventType: 'open' | 'click' | 'first_open_30_days' = 'open';
  applyFrequency = 'unique';
  timePeriod = 0;
  triggerOptions = [
    { name: this.$t('input.selectTypeOptions'), value: '' },
    { name: this.$t('input.triggerAddTag'), value: 'tag' },
    { name: this.$t('input.triggerMessageEvents'), value: 'events' },
    { name: this.$t('input.triggerCustomEvents'), value: 'custom_events' },
    { name: this.$t('input.triggerWebPush'), value: 'web-push' },
    { name: this.$t('input.triggerMobilePush'), value: 'mobile-push' },
  ];
  eventTriggerOptions = [
    { name: this.$t('input.selectEventTypeOptions'), value: '' },
    { name: this.$t('input.open'), value: 'open' },
    { name: this.$t('input.click'), value: 'click' },
    { name: this.$t('input.triggerFirstOpen30Days'), value: 'first_open_30_days' },
  ];
  multiplyOptions = [
    { name: this.$t('input.selectTypeOptions'), value: '' },
    { name: this.$t('input.days'), value: 'days' },
    { name: this.$t('title.hour') + 's', value: 'hours' },
    { name: this.$t('title.minutes'), value: 'minutes' },
  ];
  showMessage = false;
  messageName = '';
  selectedMessage = '';
  messageObj: any = {};
  customEventObj: any = {};

  debouncedValidateName = debounce((search: string) => this.findMessage(search), 300);

  beforeMount() {
    this.showModal();
  }

  hideModal() {
    this.$emit('hideModal');
  }

  updateData() {
    if (['web-push', 'mobile-push'].includes(this.typeTrigger)) {
      this.selectedOptionData = { id: 0, type: this.typeTrigger };
    }

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
    } else {
      this.selectedOptionData.timePeriod = 0;
      this.selectedOptionData.typeMultiply = '';
    }

    this.$emit('updateInfo', this.selectedOptionData);
  }

  updateConditional(value: any) {
    this.selectedOptionData.conditional = value;
    this.$emit('updateInfo', this.selectedOptionData);
  }

  @Watch('applyFrequency')
  changeFrequency() {
    if (this.applyFrequency !== 'multiply-period') {
      this.selectedOptionData.timePeriod = 0;
      this.selectedOptionData.typeMultiply = '';
    }
    this.selectedOptionData.applyFrequency = this.applyFrequency;
  }

  @Watch('render')
  showModal() {
    if (this.render) {
      let parseMinutes = 1;
      if (this.step?.settings.typeMultiply === 'hours') {
        parseMinutes *= 60;
      } else if (this.step?.settings.typeMultiply === 'days') {
        parseMinutes *= 24 * 60;
      }
      this.selectedOptionData = { ...this.step?.settings };
      this.selectedMessage =
        this.step?.settings?.name === 'any' ? this.$t('input.anyMessage') : this.step?.settings?.title;
      this.typeTrigger = this.selectedOptionData?.type ?? '';
      this.searchOptions = this.selectedOptionData?.name;
      this.searchCustomEvents = this.selectedOptionData?.name;
      this.applyFrequency = this.selectedOptionData.applyFrequency || 'unique';
      this.timePeriod = parseInt(this.selectedOptionData.timePeriod, 10) / parseMinutes || 0;
      this.typeMultiply = this.selectedOptionData.typeMultiply || '';
      this.messageObj = this.selectedOptionData;
      this.findMessage(this.typeTrigger === 'events' ? this.selectedOptionData.name : '');
    } else {
      this.showMessage = false;
    }
  }

  async findTags(search?: string): Promise<any> {
    this.isLoadingSearch = true;
    try {
      const response: any = await this.automationService.getTags({
        title: search || '',
        page: 1,
        type: 'tag',
        itemsPerPage: 40,
      });
      return response.data?.results.map((item: any) => {
        return {
          id: item.id,
          name: item.name,
          type: this.typeTrigger,
        };
      });
    } catch (err) {
      this.isLoadingSearch = false;
      throw err;
    } finally {
      this.isLoadingSearch = false;
    }
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

  async findMessage(search?: string): Promise<any> {
    try {
      this.isLoadingMessages = true;
      const response: any = await this.messagesService.getMessages({
        title: search || '',
        page: 1,
        type: 'email',
        itemsPerPage: 10,
      });
      this.messages = response.data?.results.map((message: any) => {
        return {
          id: message.id,
          name: message.name,
          title: message.title,
        };
      });
      this.messages.unshift({
        id: 0,
        name: 'any-message',
        title: this.$t('input.anyMessage') as string,
      });
    } catch (err) {
      throw err;
    } finally {
      this.isLoadingMessages = false;
    }
  }

  async handleAutocompleteClick() {
    if (!this.isInitialRequestMade) {
      this.isInitialRequestMade = true;
      this.optionsSelect = await this.findTags();
    }
  }

  async handleAutocompleteEvents() {
    if (!this.isCustomEventsInitialRequestMade) {
      this.isCustomEventsInitialRequestMade = true;
      this.customEventsOptions = await this.findEvents();
    }
  }

  updateCustomEvent(event: any) {
    this.customEventObj = event;
    this.updateData();
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

  @Watch('searchOptions')
  async onSearch(search: string) {
    if (search && search !== this.lastSearch) {
      const data = await this.findTags(search);
      this.optionsSelect = data;
      this.lastSearch = search;
    }
  }

  @Watch('searchCustomEvents')
  async onSearchCustomEvents(search: string) {
    if (search && search !== this.lastCustomEventsSearch) {
      const data = await this.findEvents(search);
      this.customEventsOptions = data;
      this.lastCustomEventsSearch = search;
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
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables.scss';

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
</style>
