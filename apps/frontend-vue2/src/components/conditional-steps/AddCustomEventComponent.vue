<template>
  <div class="view-custom-event-step">
    <div class="d-flex">
      <SelectConditionalComponent
        @updateStep="updateStep"
        :color="'select-light-purple'"
        :items="conditionalEvents"
        :conditionalName="'conditional_event_type'"
        :value="step.conditional_event_type || 'in'"
      />
      <LineComponent :type="'vertical'" />
      <div class="group-input mt-auto menu-message-list">
        <div class="d-flex justify-space-between">
          <label class="block">{{ $t('sidebar.customEvents') }}</label>
        </div>
        <v-menu
          class="select-menu"
          ref="menu"
          v-model="showCustomEvent"
          :close-on-content-click="false"
          bottom
          width="150"
        >
          <template v-slot:activator="{ on }">
            <button
              class="select-button font-12 text-space ds-gray-color"
              :class="{ 'text-600': event.name }"
              @click="showCustomEvent = true"
              v-on="on"
            >
              {{ event.name || $t('input.selectEvent') }}
              <span
                class="material-symbols-rounded icon-up"
                :class="{ 'icon-dropdown ds-blue-color': showCustomEvent === true }"
              >
                arrow_drop_down
              </span>
            </button>
          </template>
          <div class="message-card" :class="{ 'select-button-open message-div': showCustomEvent === true }">
            <div class="div-row input-message">
              <input
                class="ds-gray-color font-12 text-space"
                type="text"
                v-model="eventName"
                :placeholder="$t('input.selectInsert')"
                @input="findCustomEvents(eventName)"
              />
              <span
                class="material-symbols-rounded icon-up"
                :class="{ 'icon-dropdown ds-blue-color': showCustomEvent === true }"
              >
                arrow_drop_down
              </span>
            </div>
            <div class="messages-list-folder">
              <div
                class="message-list d-flex ds-gray-color cursor-pointer font-12"
                v-for="event in customEvents"
                :key="event.id"
                @click="selectEvent(event)"
              >
                {{ event.name }}
              </div>
            </div>
          </div>
        </v-menu>
      </div>
      <LineComponent :type="'vertical'" v-if="type !== 'automations' && conditinalEventType == 'in'" />
      <SelectConditionalComponent
        v-if="type !== 'automations' && conditinalEventType === 'in'"
        @updateStep="updateStep"
        :color="'select-light-purple'"
        :items="conditionalCustomEvents"
        :conditionalName="'conditional_times_value'"
        :value="step.conditional_times_value || '>='"
      />
      <LineComponent :type="'vertical'" v-if="type !== 'automations' && conditinalEventType === 'in'" />
      <div v-if="type !== 'automations' && conditinalEventType == 'in'">
        <label class="block font-12">{{ $t('input.times') }}</label>
        <input
          type="number"
          min="1"
          class="form-control value-input"
          @input="updateStep('custom_times_value', $event.target.value)"
          :value="step.custom_times_value || 1"
        />
      </div>
      <LineComponent :type="'vertical'" />
      <div class="group-input mt-auto">
        <div class="d-flex justify-space-between">
          <label class="block">{{ $t('input.period') }}</label>
        </div>
        <div>
          <v-menu
            ref="menu"
            v-model="showTime"
            class="select-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="283"
          >
            <template v-slot:activator="{ on }">
              <v-btn
                class="select-button"
                :class="{ 'select-button-open': showTime === true }"
                v-on="on"
                @click="showTime = true"
              >
                <div class="menu" v-on="on">
                  <p
                    class="ds-gray-color"
                    :class="{ 'menu-open': showTime === true }"
                    style="display: flex; flex-direction: row"
                  >
                    {{ selectedTime || $t('input.select') }}
                  </p>
                </div>
                <div>
                  <span
                    class="material-symbols-rounded icon-up"
                    :class="{ 'icon-dropdown ds-blue-color': showTime === true }"
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card width="283" class="select-card" :class="{ 'select-card-open': showTime === true }">
              <div class="select-options" v-for="(time, index) in timeType" :key="index">
                <div class="option" @click="changeTime(index)" :class="!timeType[index + 1] ? 'last-item' : ''">
                  {{ time.value }}
                </div>
              </div>
            </v-card>
          </v-menu>
        </div>
      </div>
      <LineComponent :type="'vertical'" v-if="['custom', 'range', 'date'].includes(showTimeCustom)" />
      <div class="mt-auto time-custom" :class="[{ 'time-custom-focus': isFocused }]" v-if="showTimeCustom == 'custom'">
        <input
          oninput="value = value.replace(/[^0-9]/g, '')"
          class="form-control mo-input days-input"
          @input="updateTime($event.target.value)"
          @focus="onFocus"
          @blur="onBlur"
          :value="timeCustom"
          placeholder="00"
          maxlength="3"
        />
        <span class="days"
          >{{ $t('input.days') }} <span class="max-days">({{ $t('input.max90') }})</span></span
        >
      </div>
      <div class="group-input mt-auto" v-else-if="showTimeCustom == 'date'">
        <DatePickerCustomFieldComponent :step="step" :keyName="'custom_event_date'" @updateStep="updateStep" />
      </div>
      <div class="group-input mt-auto" v-else-if="showTimeCustom == 'range'">
        <v-menu
          ref="menu"
          bottom
          class="date-menu"
          :close-on-content-click="false"
          transition="scale-y-transition"
          offset-y
          width="200"
        >
          <template v-slot:activator="{ on, attrs }">
            <v-text-field
              :value="dateRangeText"
              class="form-control"
              solo
              append-icon="mdi-chevron-down"
              v-bind="attrs"
              v-on="on"
            ></v-text-field>
          </template>
          <v-date-picker
            width="230"
            no-title
            v-model="pickedDate"
            range
            :locale="userLanguage"
            :max="dateToVuetifyString(new Date())"
            @input="changeDatePicker($event)"
          />
        </v-menu>
      </div>
      <LineComponent :type="'vertical'" v-if="time && (time == 'current_week' || time == 'last_week')" />
      <SelectConditionalComponent
        v-if="time && (time == 'current_week' || time == 'last_week')"
        @updateStep="updateStep"
        :color="'select-light-purple'"
        :items="weekDays"
        :conditionalName="'conditional_week_day_filter'"
        :value="step.conditional_week_day_filter || '1'"
      />
      <div class="div-trash ml-2">
        <button class="ml-auto button-trash" @click="removeStep" type="button">
          <span class="material-symbols-rounded ds-light-gray-color icon-active">delete</span>
        </button>
      </div>
    </div>
    <div class="second-line-interactions d-block" v-if="type !== 'automations'">
      <div class="properties-line" :class="[noFirstElement ? 'properties-line-small' : 'properties-line-large']"></div>
      <div class="d-flex mb-2" v-for="(property, index) in properties" :key="'custom-properties-' + index">
        <LineComponent :type="'vertical'" :defaultClass="'custom-properties-line'" />
        <div class="properties-input">
          <label class="label-title font-12 label-color mb-1">{{ $t('title.property') }}</label>
          <select
            class="form-control mo-select border-color font-12"
            @change="updateProperty($event.target.value, index, 'property')"
            :value="property.property"
          >
            <option disabled selected value="">{{ $t('input.selectProperty') }}</option>
            <option
              v-for="propertySelect in propertiesSelect"
              :value="propertySelect.name"
              :selected="propertySelect.name === property.property"
              :key="'custom-event-' + index + propertySelect.name"
            >
              {{ propertySelect.name }}
            </option>
          </select>
        </div>
        <LineComponent :type="'vertical'" :defaultClass="'custom-properties-line'" />
        <div class="properties-input">
          <InputDefault
            max="500"
            :name="`${$t('title.value')}`"
            :modelValue="property.value"
            :keyInput="`${index}`"
            :defaultData="`value`"
            @updateInput="updateProperty"
          />
        </div>
        <div class="div-trash ml-2 mb-2">
          <button class="ml-auto button-trash" @click="removeProperty(index)" type="button">
            <span class="material-symbols-rounded ds-light-gray-color icon-active">delete</span>
          </button>
        </div>
      </div>
      <div class="d-flex">
        <LineComponent :type="'vertical'" :defaultClass="'custom-properties'" />
        <button
          class="addition-button font-10 text-600 text-uppercase"
          type="button"
          @click="addProperty"
          :disabled="properties.length >= 3"
        >
          <span class="material-symbols-rounded v-icon-plus"> add </span>
          <span class="mr-1">{{ $t('input.addProperty') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import LineComponent from './LineComponent.vue';
import ToastService from '@/services/toast.service';
import CustomEventService from '@/modules/custom-events/services/custom-event.service';
import { CustomEventDto } from '@/modules/custom-events/dtos/custom-event.dto';
import SelectConditionalComponent from './SelectConditionalComponent.vue';
import DatePickerCustomFieldComponent from './DatePickerCustomFieldComponent.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { mapState } from 'vuex';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: { LineComponent, SelectConditionalComponent, DatePickerCustomFieldComponent, InputDefault },
  props: ['step', 'type', 'noFirstElement'],
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class AddCustomEventComponent extends Vue {
  private readonly toastService = new ToastService();
  private readonly customEventService = new CustomEventService();
  public customEvents: Array<CustomEventDto> = new Array<CustomEventDto>();
  public allCustomEvents: Array<CustomEventDto> = new Array<CustomEventDto>();
  public userLanguage!: string;
  public currentAccountTimezone!: string;

  conditionalEvents = [
    { name: 'in', value: this.$t('title.have') },
    { name: 'not in', value: this.$t('title.doesntHave') },
  ];
  timeType: any = [
    { name: '0', value: this.$t('input.today') },
    { name: '1', value: this.$t('input.yesterday') },
    { name: '7', value: this.$t('input.last7Days') },
    { name: '15', value: this.$t('input.last15Days') },
    { name: 'date', value: this.$t('datatable.date') },
    { name: 'range', value: this.$t('input.period') },
    { name: 'custom', value: this.$t('input.custom') },
    { name: 'current_week', value: this.$t('input.currentWeek') },
    { name: 'last_week', value: this.$t('input.lastWeek') },
  ];
  conditionalCustomEvents = [
    { name: '=', value: this.$t('input.valueIsEqual') },
    { name: '>', value: this.$t('input.valueGreater') },
    { name: '>=', value: this.$t('input.valueGreaterOrEqual') },
    { name: '<', value: this.$t('input.valueLess') },
    { name: '<=', value: this.$t('input.valueLessOrEqual') },
  ];

  weekDays = [
    { name: '1', value: this.$t('input.monday') },
    { name: '2', value: this.$t('input.tuesday') },
    { name: '3', value: this.$t('input.wednesday') },
    { name: '4', value: this.$t('input.thursday') },
    { name: '5', value: this.$t('input.friday') },
    { name: '6', value: this.$t('input.saturday') },
    { name: '0', value: this.$t('input.sunday') },
  ];

  time = '';
  timeCustom: any = '';
  showTime = false;
  showTimeCustom = '';
  conditinalEventType = 'in';
  showCustomEvent = false;
  pickedDate: string[] = [];
  selectedTime = '';
  eventName = '';
  isFocused = false;
  event = { name: '', id: 0 };
  dateRangeText = '';
  properties: any = [];
  propertiesSelect: any = [];

  beforeMount() {
    this.findCustomEvents();
    const step = this.$props.step;
    this.showTimeCustom = step.time_type;
    this.time = step.time === 0 && step.time_type ? step.time_type : step?.time || '';
    this.timeCustom = this.time || '';
    this.properties = step.properties || [];
    this.conditinalEventType = step?.conditional_event_type || 'in';
    this.event = step?.event || { name: '' };
    this.selectedTime = this.timeType.find((x: any) => x.name === this.time || x.name === step.time_type)?.value;
    if (this.showTimeCustom === 'range' && step.custom_event_date && step.custom_event_date_end) {
      this.pickedDate = [step.custom_event_date, step.custom_event_date_end];
      const dates: dayjs.Dayjs[] = this.pickedDate.map((item) => {
        const date = dayjs.utc(item).tz(this.currentAccountTimezone, true);
        return date;
      });
      this.dateRangeText = `${Vue.filter('formatDate')(dates[0])} - ${Vue.filter('formatDate')(dates[1])}`;
    }
    this.updateStep('custom_times_value', step.custom_times_value || 1);
    this.updateStep('conditional_event_filter', '>=');
  }
  onFocus() {
    this.isFocused = true;
  }
  onBlur() {
    this.isFocused = false;
  }
  removeStep() {
    this.$emit('removeStep');
  }
  updateStep(key: string, value: string | number | object) {
    this.$emit('updateStep', key, value);
    if (key === 'conditional_event_type') {
      this.conditinalEventType = value as string;
    }
    if (key === 'conditional_event_type') {
      this.$emit('updateStep', 'conditional_times_value', '>=');
      this.$emit('updateStep', 'custom_times_value', 1);
    }
  }
  updateTime(time: any) {
    if (time > 180) {
      this.timeCustom = 180;
      time = 180;
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.customBiggerThan90') as string,
      });
    }
    this.timeCustom = time;
    this.updateStep('time', this.timeCustom || 0);
  }
  changeTime(index: number) {
    this.time = this.timeType[index].name;
    this.selectedTime = this.timeType[index].value;
    this.showTime = false;
    if (['custom', 'range', 'date'].includes(this.time)) {
      this.updateTime('');
      this.showTimeCustom = this.time;
      this.updateStep('time_type', this.time || '');
    } else {
      this.updateStep('time', this.time);
      this.updateStep('time_type', 'time');
      this.showTimeCustom = '';
    }
  }

  async findCustomEvents(search?: string): Promise<any> {
    try {
      const response: any = await this.customEventService.getCustomEvents({
        title: search || '',
        page: 1,
        itemsPerPage: 10,
      });
      this.allCustomEvents = response.data?.results;
      if (!search) {
        this.propertiesSelect = this.allCustomEvents.find((item) => item.id === this.event.id)?.properties || [];
      }
      this.customEvents = response.data?.results.map((event: any) => {
        return {
          id: event.id,
          name: event.name,
        };
      });
    } catch (err) {
      throw err;
    }
  }

  selectEvent(event: any) {
    this.showCustomEvent = false;
    this.event = event;
    this.updateStep('event', event || {});
    this.propertiesSelect = this.allCustomEvents.find((item) => item.id === event.id)?.properties || [];
  }

  addProperty() {
    this.properties.push({});
    this.updateStep('properties', this.properties);
  }

  updateProperty(value: string, index: number, key: string) {
    this.properties[index][key] = value;
    this.updateStep('properties', this.properties);
  }

  removeProperty(index: number) {
    this.properties.splice(index, 1);
    this.updateStep('properties', this.properties);
  }

  dateToVuetifyString(date: Date): string {
    if (!date) {
      return '';
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateString = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    return dateString;
  }

  async changeDatePicker(e: string[]) {
    if (e.length < 2) {
      return;
    }
    const dates: dayjs.Dayjs[] = e.map((item) => {
      const date = dayjs.utc(item).tz(this.currentAccountTimezone, true);
      return date;
    });

    if (dates[0] > dates[1]) {
      dates.reverse();
    }

    const startDateInTimezone = dates[0].tz(this.currentAccountTimezone);
    const endDateInTimezone = dates[1].tz(this.currentAccountTimezone);
    this.updateStep('custom_event_date', startDateInTimezone.format('YYYY-MM-DD'));
    this.updateStep('custom_event_date_end', endDateInTimezone.format('YYYY-MM-DD'));
    this.dateRangeText = `${Vue.filter('formatDate')(dates[0])} - ${Vue.filter('formatDate')(dates[1])}`;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep.v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  box-shadow: none !important;
  border: 1px solid $ds-gray-300;
}
.group-input label {
  display: block;
}
.time-custom {
  display: flex;
  align-items: center;
  width: 160px;
  gap: 5px;
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  height: 36px !important;
  padding: 0.375rem 0rem 0.375rem 0.375rem;
  transition: border-color 0.15s ease-in-out;
}
.time-custom-focus {
  border: 1px $ds-blue solid !important;
}
.mo-input:focus {
  border: none !important;
  box-shadow: none;
  color: $ds-blue;
}
.mo-input {
  height: 28px !important;
  border-radius: 0 !important;
  padding: 0 !important;
  border: none !important;
}

.days-input {
  width: 20% !important;
}
.days {
  font-size: 12px;
  right: 0.75rem;
  top: 0.375rem;
  color: $ds-gray;
}
.max-days {
  color: $neutral-gray-500;
  font-size: 12px;
}

label {
  color: $ds-gray !important;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 0.25rem;
}

::v-deep.v-btn:not(.v-btn--round).v-size--default {
  width: 200px;
}
.select-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.select-card {
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
  width: 283px;
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
  border-radius: 0px 0px 8px 8px !important;
  width: 176px;
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
.div-trash {
  display: flex;
  align-items: flex-end;
  z-index: 1;
}

.text-space {
  text-wrap: nowrap;
  outline: none;
  letter-spacing: 0.05em;
  width: 230px;
}

.message-card {
  background-color: #ffffff;
  width: -webkit-fill-available;
}

.input-message {
  justify-content: space-between;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px;
  overflow: hidden;
  border-bottom: 1px solid #d9d9d9;
}

.search-input {
  outline: none;
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

.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 230px;
}

.date-text {
  display: flex;
  margin-bottom: -30px;
  width: 167px;
  font-size: 12px;
}

.form-control {
  border: 1px solid #d9d9d9;
}
.second-line-interactions {
  margin-top: 10px;
  margin-left: 160px;
}
.custom-properties {
  align-items: center;
  margin-bottom: 0;
}

.properties-line {
  margin-top: -10px;
  position: absolute;
  width: 2px;

  background: #d9d9d9;
}

.properties-line-small {
  height: calc(100% - 113px);
}

.properties-line-large {
  height: calc(100% - 68px);
}

::v-deep.v-card > *:last-child:not(.v-btn):not(.v-chip) {
  border-bottom-left-radius: 24px !important;
  border-bottom-right-radius: 24px !important;
}
.addition-button {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: normal;
  height: 24px !important;
  width: 180px !important;
  padding: 4px 8px 6px 8px;
  background-color: #0fb75c;
  border-radius: 24px !important;
  color: white;
}

.addition-button[disabled] {
  background-color: #cccccc;
  color: #666666;
}
.add {
  font-size: 16px;
  color: white !important;
}

.properties-input {
  width: 220px;
}

.custom-properties-line {
  margin-bottom: 21px;
}
</style>
