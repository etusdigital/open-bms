<template>
  <div v-if="render">
    <label class="label-title mb-0 mt-1 font-14">{{ $t('datatable.chooseMessage') }}</label>
    <div style="position: relative">
      <v-autocomplete
        v-model="selectedOptionData.messages"
        item-color="#EBE9E8"
        :elevation="0"
        class="c-autocomplete mt-2"
        :class="{ 'have-item-selected': selectedOptionData.messages && selectedOptionData.messages.length }"
        :placeholder="`${$t('input.select')}`"
        :no-data-text="
          isLoadingSearch
            ? $t('input.searching')
            : searchOptions
              ? `${$t('datatable.noData')}`
              : $t('datatable.noMessages')
        "
        :items="optionsSelect"
        :item-text="'name'"
        :return-object="true"
        :multiple="true"
        :outlined="false"
        :search-input.sync="searchOptions"
        :loading="isLoadingSearch"
        @change="changeSelectedOptionDataPropety(selectedOptionData.messages, 'messages')"
        @click="handleAutocompleteClick()"
        solo
      >
        <template v-slot:item="{ item }">
          <v-list-item-content>
            {{ item.title }}
          </v-list-item-content>
        </template>

        <!-- eslint-disable-next-line vue/no-unused-vars -->
        <template v-slot:selection="data"> </template>
      </v-autocomplete>
      <div v-if="selectedOptionData.messages && selectedOptionData.messages.length" class="selected-items">
        {{ $t('input.selected') }}
        <span class="ml-2 counter">
          {{ selectedOptionData.messages ? selectedOptionData.messages.length : 0 }}
        </span>
      </div>
    </div>

    <div>
      <div
        v-for="(message, index) in selectedOptionData.messages"
        style="display: flex; align-items: center"
        :key="index"
      >
        <div class="message mt-2">
          <div class="message-content">
            <h4>{{ $t('datatable.message') }} {{ numberToLetter(index + 1) }}: {{ message.title }}</h4>
            <p class="mb-0">{{ $t('datatable.subject') }}: {{ message.subject }}</p>
          </div>
          <button type="button" class="view-button" @click="viewMessage(message.id, index)">
            <span class="material-symbols-rounded ds-light-gray-color">visibility</span>
          </button>
        </div>
        <div class="div-trash ml-2">
          <button class="ml-auto button-trash" type="button" @click="removeMessage(index)">
            <span class="material-symbols-rounded ds-light-gray-color">delete</span>
          </button>
        </div>
      </div>
    </div>

    <div>
      <label class="label-title mb-0 mt-5 font-14">{{ $t('datatable.winnerCriteria') }}</label>
      <div v-for="(option, index) in winnerCriteriaOptions" :key="option.name">
        <div class="winner-criteria-option" :class="{ 'mt-2': index > 0 }">
          <div style="position: relative">
            <span class="radio-circle" v-if="index === selectedWinnerCriteria"></span>
            <input
              :id="'rate-' + option.name"
              type="radio"
              name="winner-Criteria"
              :value="option.name"
              @click="changeWinnerCriteria(index)"
              :checked="index === selectedWinnerCriteria"
            />
          </div>
          <label
            :class="{ 'choose-option': index === selectedWinnerCriteria }"
            :for="'rate-' + option.name"
            class="label-radio"
          >
            {{ option.value }}
          </label>
        </div>
      </div>
    </div>
    <label class="label-title mb-2 mt-5 font-14">{{ $t('title.testDuration') }}</label>
    <div class="div-more-items">
      <div style="position: relative; width: 50%">
        <input
          type="number"
          class="input-style"
          v-model.number="selectedTime"
          :min="selectedTimeOptionName === 'day' ? 1 : 24"
          :max="selectedTimeOptionName === 'day' ? 30 : 720"
          @input="calculateDuration($event.target.value)"
        />
      </div>
      <div style="position: relative; width: 50%">
        <v-menu
          ref="menu"
          v-model="showTimeOptions"
          class="select-menu"
          :close-on-content-click="false"
          bottom
          transition="scale-y-transition"
          offset-y
          width="100%"
        >
          <template v-slot:activator="{ on }">
            <v-btn
              class="select-button"
              :class="{ 'select-button-open': showTimeOptions === true }"
              v-on="on"
              @click="showTimeOptions = true"
            >
              <div class="menu" v-on="on">
                <p :class="{ 'menu-open': showTimeOptions === true }" style="display: flex; flex-direction: row">
                  {{ selectedTimeOption }}
                </p>
              </div>
              <div>
                <span
                  class="material-symbols-rounded icon-up"
                  :class="{ 'icon-dropdown ds-blue-color': showTimeOptions === true }"
                >
                  arrow_drop_down
                </span>
              </div>
            </v-btn>
          </template>
          <v-card width="100%" class="select-card" :class="{ 'select-card-open': showTimeOptions === true }">
            <div class="select-options" v-for="(time, index) in timeOptions" :value="time.name" :key="time.name">
              <div class="option" @click="changeTimeOption(index)" :class="!timeOptions[index + 1] ? 'last-item' : ''">
                {{ time.value }}
              </div>
            </div>
          </v-card>
        </v-menu>
      </div>
    </div>
    <div class="pt-0" v-if="selectedTime < (selectedTimeOptionName === 'day' ? 1 : 24)">
      <small data-cy="email-error" class="form-text text-danger font-10">{{ $t('warning.durationNotAllow') }}</small>
    </div>
    <div class="pt-0" v-if="selectedTime > (selectedTimeOptionName === 'day' ? 30 : 720)">
      <small data-cy="duration-error" class="form-text text-danger font-10">{{
        $t('warning.maxDurationExceeded')
      }}</small>
    </div>
    <v-dialog v-model="showMessagePreview">
      <MessagePreview
        :messageId="allMessages"
        :messageIndex="messageIndex"
        :type="step.type"
        @closeMessagePreview="closeMessagePreview"
      />
    </v-dialog>
  </div>
</template>

<script lang="ts">
import MessagesService from '@/modules/messages/services/messages.service';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import MessagePreview from '@/components/common/MessagePreview.vue';

@Component({
  components: { MessagePreview },
  props: ['render', 'step'],
})
export default class TestABComponent extends Vue {
  private readonly messagesService = new MessagesService();
  @Prop() step!: any;
  @Prop() render!: boolean;
  optionsSelect = [];
  allMessages: any = [];
  selectedOptionData: any = {
    messages: [],
    winnerCriteria: 'click',
    status: 'notStarted',
    duration: 24,
    durationType: 'day',
    startDate: null,
    endDate: null,
  };
  showMessagePreview = false;
  messageIdDialog = 0;
  selectedWinnerCriteria = 0;
  winnerCriteriaOptions = [
    { name: 'click', value: this.$t('input.clickRate') as string },
    { name: 'open', value: this.$t('input.openRate') as string },
  ];
  count = 0;
  lastSearch = '';
  isLoadingSearch = false;
  searchOptions = null;
  showTimeOptions = false;
  selectedTime = 1;
  selectedTimeOption = (this.$t('title.day') as string) + 's';
  selectedTimeOptionName = 'day';
  timeOptions = [
    { name: 'hour', value: (this.$t('title.hour') as string) + 's' },
    { name: 'day', value: (this.$t('title.day') as string) + 's' },
  ];
  messageIndex = -1;

  isInitialRequestMade = false;

  async beforeMount() {
    this.showModal();

    if (!this.step?.settings || !Object.keys(this.step?.settings).length) {
      this.updateData();
    }
  }

  hideModal() {
    this.$emit('hideModal');
  }

  changeSelectedOptionDataPropety(value: any, key: string) {
    if (this.selectedOptionData.messages.length > 4) {
      this.selectedOptionData.messages.pop();
      return;
    }
    const self = this;
    this.selectedOptionData[key as keyof typeof self.selectedOptionData] = value;
    this.showTimeOptions = false;
    this.updateData();
  }

  updateData() {
    this.$emit('updateInfo', this.selectedOptionData);
  }

  @Watch('render')
  showModal() {
    if (this.render) {
      this.selectedOptionData =
        this.step?.settings && Object.keys(this.step?.settings).length ? this.step?.settings : this.selectedOptionData;
      this.searchOptions = this.step?.settings?.name;
      this.selectedTime =
        this.step?.settings?.durationType === 'day'
          ? this.step?.settings?.duration / 24
          : this.step?.settings?.duration;
      this.updateData();
    }
  }

  async findMessage(search?: string): Promise<any> {
    this.isLoadingSearch = true;
    try {
      const response: any = await this.messagesService.getMessages({
        title: search || '',
        page: 1,
        type: 'email',
        itemsPerPage: 40,
      });
      return response.data?.results.map((message: any) => {
        return {
          id: message.id,
          name: message.name,
          title: message.title,
          subject: message.subject,
          fromMail: message.fromMail,
          content: message.content,
        };
      });
    } catch (err) {
      this.isLoadingSearch = false;
      throw err;
    } finally {
      this.isLoadingSearch = false;
    }
  }

  async handleAutocompleteClick() {
    if (!this.isInitialRequestMade) {
      this.isInitialRequestMade = true;
      this.optionsSelect = await this.findMessage();
    }
  }

  @Watch('searchOptions')
  async onSearch(search: string) {
    if (search && search !== this.lastSearch) {
      this.optionsSelect = await this.findMessage(search);
      this.lastSearch = search;
    }
  }

  viewMessage(id: number, index: number) {
    this.messageIndex = index;
    this.messageIdDialog = id;
    this.showMessagePreview = true;
  }

  closeMessagePreview() {
    this.showMessagePreview = false;
  }

  numberToLetter(number: number) {
    const baseCharCode = 'A'.charCodeAt(0) - 1;
    const letterCode = baseCharCode + number;

    return String.fromCharCode(letterCode);
  }

  changeWinnerCriteria(index: number) {
    this.selectedWinnerCriteria = index;
    this.changeSelectedOptionDataPropety(this.winnerCriteriaOptions[index].name, 'winnerCriteria');
  }

  changeTimeOption(index: number) {
    this.selectedTimeOption = this.timeOptions[index].value;
    this.selectedTimeOptionName = this.timeOptions[index].name;
    this.calculateDuration(this.selectedTime);
  }

  calculateDuration(number: any) {
    const numberParsed = parseInt(number, 10);
    let duration = 1;
    if (numberParsed > 0 && !isNaN(numberParsed)) {
      const maxValue = this.selectedTimeOptionName === 'day' ? 30 : 720;
      duration = Math.min(numberParsed, maxValue);
      this.selectedTime = duration;
      if (this.selectedTimeOptionName === 'day') {
        duration *= 24;
      }
    } else {
      duration = 24;
    }

    this.changeSelectedOptionDataPropety(this.selectedTimeOptionName, 'durationType');
    this.changeSelectedOptionDataPropety(duration, 'duration');
  }

  removeMessage(index: number) {
    this.selectedOptionData.messages.splice(index, 1);
  }

  @Watch('selectedOptionData.messages')
  getAllMessages() {
    this.allMessages = this.selectedOptionData.messages.map((item: any) => item.id);
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables.scss';

.c-autocomplete {
  border-radius: 8px;
  border: $ds-gray-300 solid 1px !important;
  font-size: 12px;
  ::v-deep .v-input__control {
    height: auto !important;
    min-height: auto !important;
  }

  ::v-deep .v-input__slot {
    margin: 0 !important;
  }
}

::v-deep.v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  box-shadow: none !important;
}

.have-item-selected {
  padding-left: 115px !important;
}

.selected-items {
  position: absolute;
  top: 12px;
  left: 12px;
  font-size: 12px;
  font-weight: bold;
  color: $ds-gray;
}

.counter {
  padding: 2px 7px;
  background: $ds-gray-100;
  border-radius: 50%;
  font-size: 12px;
}

.message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 98%;
  background: $ds-gray-100;
  border-radius: 8px;
  padding: 12px 10px;
}

.message-content {
  h4 {
    font-size: 12px;
    font-weight: 600;
  }

  p {
    font-size: 12px;
  }
}

.view-button {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.view-icon {
  height: 24px;
  filter: invert(75%) sepia(52%) saturate(13%) hue-rotate(333deg) brightness(100%) contrast(79%);
}

.view-icon:hover {
  cursor: pointer;
  filter: none;
}

.div-trash {
  margin-top: 6px;
}

input[type='radio'] {
  width: 14px;
  height: 14px;
  -webkit-appearance: none;
  background-color: transparent;
  border: $ds-gray-300 2px solid;
  border-radius: 50%;
}

input[type='radio']:checked {
  border: $ds-blue 2px solid;
}

.winner-criteria-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;

  div {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  span {
    font-size: 12px;
  }
}

.radio-circle {
  position: absolute;
  width: 6px;
  height: 6px;
  background-color: $ds-blue;
  border-radius: 50%;
  left: 4px;
}

.label-radio {
  font-size: 12px;
  margin-bottom: 0px !important;
}

.choose-option {
  color: $ds-blue;
  font-weight: bold;
}

.div-more-items {
  display: flex;
  width: 100%;
  gap: 8px;
}

input[type='number'] {
  -moz-appearance: textfield;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.input-style {
  height: 36px;
  font-weight: 400;
  font-size: 12px;
  border-radius: 8px;
  width: 100%;
  flex: 1;
  padding: 8px 9px;
  border: 1px $ds-gray-300 solid;
  outline: none;

  &:focus {
    border: 1px $ds-blue solid;
    outline: none;
  }
}

::v-deep.v-btn:not(.v-btn--round).v-size--default {
  width: 100%;
}
.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.select-card {
  position: relative;
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
  width: 100%;
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
  width: fit-content;
  border-radius: 0px 0px 8px 8px !important;
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

::v-deep .v-dialog {
  width: fit-content !important;
  border-radius: 16px;
  box-shadow: none;
}
</style>
