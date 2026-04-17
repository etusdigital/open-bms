<template>
  <div class="recurring-step mt-8 w-100">
    <section class="div-column recurring-section" v-if="newCampaign.type === campaignsType.RECURRING">
      <span class="text-600 font-16 card-label">{{ $t('title.recurrence') }}</span>
      <v-card class="px-5 card-recurring">
        <div class="d-flex div-column">
          <span class="font-12 text-600 pb-1">{{ $t('title.firstSend') }}</span>
          <div class="div-row gap-10 hour-select">
            <v-menu
              ref="first-menu"
              v-model="dateMenu"
              :close-on-content-click="false"
              bottom
              transition="scale-y-transition"
              offset-y
              width="283"
              v-if="!isCampaignRule"
            >
              <template v-slot:activator="{ activate }">
                <v-btn
                  class="date-button width-date"
                  :class="{ 'date-button-open': dateMenu }"
                  v-on="activate"
                  @click="dateMenu = true"
                  data-menu="start-date"
                >
                  <div class="calendar-date">
                    <span
                      class="material-symbols-rounded font-24 calendar-icon"
                      :class="[dateMenu ? 'calendar-icon-active' : '']"
                    >
                      calendar_month
                    </span>
                    <span v-if="date" class="date-range">{{ date | formatDate }}</span>
                    <span v-else class="date-range">{{ $t('button.selectSingleDate') }}</span>
                  </div>
                  <div>
                    <span class="material-symbols-rounded" :class="{ 'icon-dropdown ds-blue-color': dateMenu }" dense>
                      arrow_drop_down
                    </span>
                  </div>
                </v-btn>
              </template>
              <v-card class="filters-card" :class="{ 'filters-card-open': dateMenu }">
                <v-date-picker
                  width="281"
                  no-title
                  v-model="firstSendDate"
                  class="date-picker"
                  :locale="userLanguage"
                  :min="dateToVuetifyString(new Date())"
                  :max="dateToVuetifyString(maxScheduleDate)"
                  @input="handleDateChange($event, 'first')"
                />
              </v-card>
            </v-menu>
            <span v-if="!isCampaignRule" class="font-12 text-600">{{ $t('title.at') }}</span>
            <v-menu ref="second-menu" v-model="hourMenu" bottom class="tag-menu" :close-on-content-click="false">
              <template v-slot:activator="{ on }">
                <div class="div-row menu-hours border-menu" v-on="on">
                  <span
                    class="material-symbols-rounded calendar-icon"
                    :class="[hourMenu ? 'calendar-icon-active' : '']"
                    dense
                  >
                    schedule
                  </span>
                  <label class="font-12 text-400 icon-up mb-0 cursor-pointer">
                    {{ hourSelected !== '' ? hourSelected : currentHour }}
                  </label>
                  <span
                    class="material-symbols-rounded icon-up"
                    :class="{ 'icon-dropdown ds-blue-color': hourMenu }"
                    dense
                  >
                    arrow_drop_down
                  </span>
                </div>
              </template>
              <v-card class="tag-card">
                <div class="menu-hours">
                  <div class="div-row align-items-center gap-10">
                    <span
                      class="material-symbols-rounded calendar-icon"
                      :class="[hourMenu ? 'calendar-icon-active' : '']"
                      dense
                    >
                      schedule
                    </span>
                    <input
                      id="recurrenceTypeHourInput"
                      class="search-input"
                      type="text"
                      v-model="hourSelected"
                      placeholder="12:00"
                      v-time-mask
                      @keyup="moveToHourMenu"
                      @input="typeHour($event.target.value)"
                    />
                    <span
                      class="material-symbols-rounded"
                      :class="{ 'icon-dropdown ds-blue-color': hourMenu }"
                      dense
                      @click="hourMenu = false"
                    >
                      arrow_drop_down
                    </span>
                  </div>
                </div>
                <div class="hours-list">
                  <button
                    class="button-hours font-12"
                    :class="[hour === hourSelected ? 'selected-hour' : '']"
                    v-for="hour in hours"
                    :key="hour"
                    @click="selectHour(hour)"
                    @keyup="moveInsideHourMenu"
                  >
                    {{ hour }}
                  </button>
                </div>
              </v-card>
            </v-menu>
          </div>
        </div>
        <div class="div-row gap-20 pt-3 repeat-div">
          <div class="div-column">
            <span class="font-12 text-600 pb-1">{{ $t('title.repeatEach') }}</span>
            <div class="div-row gap-10">
              <div class="div-row hour-select">
                <input
                  class="input-number font-14 pl-2 input-size icon-up"
                  type="number"
                  id="recurringNumber"
                  v-model="numbersRecurring"
                  min="1"
                  @input="updateObjectInput(numbersRecurring, 'interval', 'recurrenceSettings')"
                />
                <div class="div-column">
                  <button
                    class="button-number d-flex hour-select"
                    type="button"
                    v-on:click.prevent="numbersRecurring += 1"
                  >
                    <span class="material-symbols-rounded icon-up" medium>arrow_drop_up</span>
                  </button>
                  <button
                    class="button-number d-flex hour-select"
                    type="button"
                    v-on:click.prevent="numbersRecurring >= 1 ? (numbersRecurring -= 1) : 1"
                  >
                    <span class="material-symbols-rounded icon-up" medium>arrow_drop_down</span>
                  </button>
                </div>
              </div>
              <select
                class="font-12 border-menu pl-2 pr-2 input-number select-period"
                v-model="periodSelected"
                @input="updateObjectInput(Number($event.target.value), 'frequency', 'recurrenceSettings')"
              >
                <option selected disabled value="0">{{ $t('input.select') }}</option>
                <template v-if="numbersRecurring <= 1">
                  <option v-for="option in periodOptions" class="font-12" :key="option.value" :value="option.value">
                    {{ option.title }}
                  </option>
                </template>
                <template v-if="numbersRecurring > 1">
                  <option
                    v-for="options in periodOptionsPlural"
                    class="font-12"
                    :key="options.value"
                    :value="options.value"
                  >
                    {{ options.title }}
                  </option>
                </template>
              </select>
            </div>
          </div>
          <div v-if="periodSelected === 2" class="div-column gap-10">
            <span class="font-12 text-600">{{ $t('title.repeatEvery') }}</span>
            <div class="div-row gap-10">
              <div v-for="day in daysOptions" :key="day.value">
                <v-tooltip top>
                  <template v-slot:activator="{ on }">
                    <button
                      @click="selectDay(day.value)"
                      v-on="on"
                      class="font-12 text-400 days-buttons"
                      type="button"
                      :class="{ 'day-button-active': day.selected }"
                    >
                      {{ day.title[0] }}
                    </button>
                  </template>
                  <span>{{ day.title }}</span>
                </v-tooltip>
              </div>
            </div>
          </div>
        </div>
        <div class="div-column pt-3">
          <span class="font-12 text-600 pb-1">{{ $t('title.endsIn') }}</span>
          <div class="div-row gap-5 hour-select">
            <input
              type="checkbox"
              class="all-checkbox"
              :class="{ 'all-checkbox-clicked': hasExpirationDate === true || hasExpirationSend === true }"
              id="never"
              v-model="hasExpiration"
            />
            <label for="never" class="font-12 text-400 mb-0 cursor-pointer label-ends">{{ $t('input.never') }}</label>
          </div>
          <div class="pt-2 pb-1 div-row gap-5 hour-select">
            <input
              type="checkbox"
              class="all-checkbox"
              :class="{ 'all-checkbox-clicked': hasExpiration === true || hasExpirationSend === true }"
              id="at"
              v-model="hasExpirationDate"
            />
            <label for="at" class="font-12 text-400 mb-0 cursor-pointer label-ends">{{ $t('input.in') }}</label>
          </div>
          <div class="div-row gap-10 hour-select">
            <v-menu
              ref="menu"
              v-model="endMenu"
              :close-on-content-click="false"
              bottom
              transition="scale-y-transition"
              offset-y
              width="283"
            >
              <template v-slot:activator="{ activate }">
                <v-btn
                  class="date-button width-date"
                  :class="{ 'date-button-open': endMenu }"
                  v-on="activate"
                  @click="endMenu = true"
                  :disabled="hasExpirationDate === false"
                  data-menu="end-date"
                >
                  <div class="calendar-date">
                    <span
                      class="material-symbols-rounded font-24 calendar-icon"
                      :class="[endMenu ? 'calendar-icon-active' : '']"
                    >
                      calendar_month
                    </span>
                    <span v-if="newCampaign.recurrenceSettings.untilDate" class="date-range">
                      {{ endDate | formatDate }}
                    </span>
                    <span v-else class="date-range">{{ $t('button.selectSingleDate') }}</span>
                  </div>
                  <div>
                    <span class="material-symbols-rounded" :class="{ 'icon-dropdown ds-blue-color': endMenu }" dense>
                      arrow_drop_down
                    </span>
                  </div>
                </v-btn>
              </template>
              <v-card class="filters-card" :class="{ 'filters-card-open': endMenu }">
                <v-date-picker
                  width="280"
                  no-title
                  v-model="endingSendDate"
                  class="date-picker"
                  :locale="userLanguage"
                  :min="dateToVuetifyString(date)"
                  @input="handleDateChange($event, 'ending')"
                  :disabled="hasExpirationDate === false"
                />
              </v-card>
            </v-menu>
          </div>
          <div class="pt-2 div-row gap-5 hour-select">
            <input
              type="checkbox"
              class="all-checkbox"
              :class="{ 'all-checkbox-clicked': hasExpiration === true || hasExpirationDate === true }"
              id="after"
              v-model="hasExpirationSend"
            />
            <label for="after" class="font-12 text-400 mb-0 cursor-pointer label-ends">{{ $t('input.after') }}</label>
          </div>
          <div class="pt-2 div-row hour-select">
            <input
              class="input-number font-14 pl-2 input-size icon-up input-after"
              type="number"
              id="endingNumber"
              v-model="numberEnds"
              min="1"
              :disabled="hasExpirationSend === false"
              @input="updateObjectInput(numberEnds, 'untilSend', 'recurrenceSettings')"
            />
            <div class="div-column">
              <button
                class="button-number d-flex hour-select"
                type="button"
                v-on:click.prevent="numberEnds += 1"
                :disabled="hasExpirationSend === false"
              >
                <span class="material-symbols-rounded icon-up" medium>arrow_drop_up</span>
              </button>
              <button
                class="button-number d-flex hour-select"
                type="button"
                v-on:click.prevent="numberEnds >= 1 ? (numberEnds -= 1) : 1"
                :disabled="hasExpirationSend === false"
              >
                <span class="material-symbols-rounded icon-up" medium>arrow_drop_down</span>
              </button>
            </div>
            <span class="font-12 text-400 span-ends">{{ $t('input.sendings') }}</span>
          </div>
        </div>

        <div class="mt-4" v-if="newCampaign.messageType != campaignsMessageType.WEBPUSH">
          <label class="font-12 text-600">{{ $t('input.sendDistribute') }}</label>
          <select
            data-cy="campaign-recurring-spreadtime"
            class="select-spreadtime form-control mo-select"
            v-model="spreadSending"
            @change="updateInput($event.target.value, 'spreadSending')"
          >
            <option v-for="time in times" :value="time.value" :key="'spreadTimeCampaign-' + time.value">
              {{ time.name }}
            </option>
          </select>
        </div>
      </v-card>
    </section>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { CampaignsType, CampaignMessageType } from '../enums/campaign.enum';
import { CampaignsDto } from '../dtos/campaigns.dto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { mapState } from 'vuex';
import { setMenuTop } from '@/util/objects';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: {},
  props: ['newCampaign', 'isCampaignRule'],
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class RecurringStep extends Vue {
  @Prop() public newCampaign!: CampaignsDto;
  @Prop() public isCampaignRule!: boolean;
  public campaignsType = CampaignsType;
  public campaignsMessageType = CampaignMessageType;
  public currentAccountTimezone!: string;
  public userLanguage!: string;

  date: Date = new Date();
  endDate: Date = new Date();
  maxScheduleDate = new Date();
  firstSendDate = '';
  endingSendDate = '';
  dateMenu = false;
  endMenu = false;
  hourMenu = false;
  hasExpiration = true;
  hasExpirationDate = false;
  hasExpirationSend = false;
  hours: string[] = [];
  hourSelected = '';
  selectedHour!: number;
  selectedMinute!: number;
  periodSelected = 0;
  weekDays: number[] = [];
  numbersRecurring = 0;
  numberEnds = 0;
  optionsMinute = ['00', '15', '30', '45'];
  periodOptions = [
    { title: this.$t('input.day'), value: 1 },
    { title: this.$t('input.week'), value: 2 },
    { title: this.$t('input.month'), value: 3 },
  ];
  periodOptionsPlural = [
    { title: this.$t('input.days'), value: 1 },
    { title: this.$t('input.weeks'), value: 2 },
    { title: this.$t('input.months'), value: 3 },
  ];
  daysOptions = [
    { title: this.$t('input.sunday') as string, value: 0, selected: false },
    { title: this.$t('input.monday') as string, value: 1, selected: false },
    { title: this.$t('input.tuesday') as string, value: 2, selected: false },
    { title: this.$t('input.wednesday') as string, value: 3, selected: false },
    { title: this.$t('input.thursday') as string, value: 4, selected: false },
    { title: this.$t('input.friday') as string, value: 5, selected: false },
    { title: this.$t('input.saturday') as string, value: 6, selected: false },
  ];

  spreadSending = 60;
  times = [
    { value: 10, name: '10 ' + this.$t('title.minute') + 's' },
    { value: 30, name: '30 ' + this.$t('title.minute') + 's' },
    { value: 60, name: '60 ' + this.$t('title.minute') + 's' },
    { value: 90, name: '1 ' + this.$t('title.hour') + ' 30 ' + this.$t('title.minute') + 's' },
    { value: 120, name: '2 ' + this.$t('title.hour') + 's' },
    { value: 150, name: '2 ' + this.$t('title.hour') + 's' + ' 30 ' + this.$t('title.minute') + 's' },
    { value: 180, name: '3 ' + this.$t('title.hour') + 's' },
    { value: 240, name: '4 ' + this.$t('title.hour') + 's' },
    { value: 300, name: '5 ' + this.$t('title.hour') + 's' },
    { value: 360, name: '6 ' + this.$t('title.hour') + 's' },
    { value: 420, name: '7 ' + this.$t('title.hour') + 's' },
    { value: 480, name: '8 ' + this.$t('title.hour') + 's' },
    { value: 540, name: '9 ' + this.$t('title.hour') + 's' },
    { value: 600, name: '10 ' + this.$t('title.hour') + 's' },
    { value: 660, name: '11 ' + this.$t('title.hour') + 's' },
    { value: 720, name: '12 ' + this.$t('title.hour') + 's' },
    { value: 1060, name: '18 ' + this.$t('title.hour') + 's' },
    { value: 1440, name: '24 ' + this.$t('title.hour') + 's' },
    { value: 0, name: this.$t('title.noInterval') },
  ];
  spreadingPercent = ['0%', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];

  beforeMount() {
    const date = dayjs(this.newCampaign.recurrenceSettings.date || new Date()).tz(this.currentAccountTimezone);
    this.date = date.toDate();
    this.hourSelected = date.format('HH:mm');
    this.selectedHour = date.hour();
    this.selectedMinute = date.minute();

    this.spreadSending = this.newCampaign.spreadSending;

    this.maxScheduleDate.setDate(new Date().getDate() + 30);
    this.firstSendDate = this.dateToVuetifyString(date.toDate());
    this.numbersRecurring = this.newCampaign.recurrenceSettings.interval || 0;
    this.periodSelected = this.newCampaign.recurrenceSettings.frequency || 0;
    this.weekDays = this.newCampaign.recurrenceSettings.weekDays || [];
    this.daysOptions = this.daysOptions.map((days) => ({
      ...days,
      selected: this.weekDays.includes(days.value),
    }));

    this.hasExpiration = this.newCampaign.recurrenceSettings.hasExpiration || true;
    this.hasExpirationDate = this.newCampaign.recurrenceSettings.untilDate
      ? this.newCampaign.recurrenceSettings.hasExpiration
      : false;

    this.hasExpirationSend = this.newCampaign.recurrenceSettings.untilSend
      ? this.newCampaign.recurrenceSettings.hasExpiration
      : false;

    if (this.newCampaign.recurrenceSettings.untilDate) {
      this.endDate = this.newCampaign.recurrenceSettings.untilDate;
      const endingDate = dayjs(this.endDate).tz(this.currentAccountTimezone);
      this.endingSendDate = this.dateToVuetifyString(endingDate.toDate());
    }

    if (this.newCampaign.recurrenceSettings.untilSend) {
      this.numberEnds = this.newCampaign.recurrenceSettings.untilSend || 0;
    }
    this.getInputHours();
  }

  getInputHours() {
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 4; j++) {
        let hour = i + ':' + this.optionsMinute[j];
        if (i < 10) {
          hour = '0' + hour;
        }
        this.hours.push(hour);
      }
    }
  }

  typeHour(h: string) {
    const hourDivs: NodeListOf<HTMLElement> = document.querySelectorAll('.hours-list button');

    let targetDiv!: HTMLElement;
    for (const div of hourDivs) {
      if (div.textContent?.trim().substring(0, h.length) === h) {
        targetDiv = div;
        break;
      }
    }

    if (targetDiv) {
      const container = document.querySelector<HTMLElement>('.hours-list');
      if (container) {
        container.scrollTop = targetDiv.offsetTop - container.clientHeight / 2 + targetDiv.clientHeight / 2;
      }
    }

    if (/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(h)) {
      this.selectHour(h);
    }
  }

  selectHour(h: string) {
    this.hourSelected = h;
    const [hour, minute] = h.split(':');
    this.selectedHour = parseInt(hour, 10);
    this.selectedMinute = parseInt(minute, 10);

    const newDate = dayjs(this.date)
      .tz(this.currentAccountTimezone)
      .hour(this.selectedHour)
      .minute(this.selectedMinute)
      .second(0)
      .millisecond(0);

    this.updateInput(newDate.toDate(), 'scheduleTo');
    this.updateObjectInput(newDate.toDate(), 'date', 'recurrenceSettings');

    if (this.newCampaign.recurrenceSettings.untilDate) {
      const untilDate = dayjs(this.newCampaign.recurrenceSettings.untilDate)
        .tz(this.currentAccountTimezone)
        .hour(this.selectedHour)
        .minute(this.selectedMinute)
        .second(0)
        .millisecond(0);

      this.handleDateChange(untilDate.toISOString(), 'ending');
    }
  }

  moveToHourMenu(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      const hourDivs: NodeListOf<HTMLElement> = document.querySelectorAll('.hours-list button');

      let targetDiv!: HTMLElement;
      for (const div of hourDivs) {
        if (div.textContent?.trim().substring(0, this.hourSelected.length) === this.hourSelected) {
          targetDiv = div;
          break;
        }
      }

      if (targetDiv) {
        targetDiv.focus();
      }
    }
  }

  moveInsideHourMenu(event: KeyboardEvent) {
    let nextElement: HTMLButtonElement;
    if (event.key === 'Enter') {
      this.hourMenu = false;
    }

    if (event.key === 'ArrowDown') {
      nextElement = (event.target as HTMLButtonElement).nextSibling as HTMLButtonElement;
      if (nextElement) {
        nextElement.focus();
      }
    }

    if (event.key === 'ArrowUp') {
      nextElement = (event.target as HTMLButtonElement).previousSibling as HTMLButtonElement;
      if (nextElement) {
        nextElement.focus();
      }

      const container = document.querySelector<HTMLElement>('.hours-list');
      if (container && nextElement) {
        container.scrollTop = nextElement.offsetTop - container.clientHeight / 2 + nextElement.clientHeight / 2;
      }
    }
  }

  get currentHour() {
    return dayjs().tz(this.currentAccountTimezone).add(1, 'hour').startOf('hour').format('HH:00');
  }

  selectDay(dayValue: number) {
    const index = this.weekDays.indexOf(dayValue);
    const selectedDay = this.daysOptions.find((date) => date.value === dayValue);

    if (index !== -1) {
      this.weekDays.splice(index, 1);
    } else {
      this.weekDays.push(dayValue);
    }

    if (selectedDay) {
      selectedDay.selected = !selectedDay.selected;
    }

    this.weekDays.sort();
    this.updateObjectInput(this.weekDays, 'weekDays', 'recurrenceSettings');
  }

  handleDateChange(dateString: string, dateType: 'first' | 'ending') {
    let date = dayjs.utc(dateString).tz(this.currentAccountTimezone, true);
    if (this.selectedHour) {
      date = date.hour(this.selectedHour).minute(this.selectedMinute);
    }

    if (dateType === 'first') {
      this.date = date.toDate();
      this.updateInput(date.toDate(), 'scheduleTo');
      this.updateObjectInput(date.toDate(), 'date', 'recurrenceSettings');
    } else if (dateType === 'ending') {
      this.endDate = date.toDate();
      this.updateObjectInput(date.toDate(), 'untilDate', 'recurrenceSettings');
    }
  }

  dateToTimeString(dateTime: Date): string {
    if (!dateTime) {
      return '';
    }
    const hour = dateTime.getHours().toString().padStart(2, '0');
    const minutes = dateTime.getMinutes().toString().padStart(2, '0');
    return `${hour}:${minutes}`;
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

  updateInput(event: any, key: any) {
    this.$emit('updateInput', event, key);
  }

  updateObjectInput(event: any, key: any, keyObject: any) {
    this.$emit('updateObjectInput', event, key, keyObject);
  }

  @Watch('hourMenu')
  focusHourMenu() {
    if (this.hourMenu) {
      setTimeout(() => {
        const inputElement = document.getElementById('recurrenceTypeHourInput') as HTMLInputElement;
        if (inputElement) {
          inputElement.focus();
          inputElement.select();
        }
      }, 100);
    }
  }

  @Watch('numbersRecurring')
  intervalNumber() {
    this.updateObjectInput(this.numbersRecurring, 'interval', 'recurrenceSettings');
  }

  @Watch('numberEnds')
  untilSendNumber() {
    this.updateObjectInput(this.numberEnds, 'untilSend', 'recurrenceSettings');
  }

  @Watch('hasExpiration')
  checkNeverEnding() {
    if (this.hasExpiration === true) {
      this.hasExpirationSend = false;
      this.hasExpirationDate = false;
      this.updateObjectInput(!this.hasExpiration, 'hasExpiration', 'recurrenceSettings');
    }
  }

  @Watch('hasExpirationDate')
  checkEndingIn() {
    if (this.hasExpirationDate === true) {
      this.hasExpirationSend = false;
      this.hasExpiration = false;
      this.numberEnds = 0;
      this.updateObjectInput(this.hasExpirationDate, 'hasExpiration', 'recurrenceSettings');
      this.updateObjectInput(null, 'untilSend', 'recurrenceSettings');
    } else {
      this.endingSendDate = '';
    }
  }

  @Watch('hasExpirationSend')
  checkEndingAfter() {
    if (this.hasExpirationSend === true) {
      this.hasExpirationDate = false;
      this.hasExpiration = false;
      this.updateObjectInput(this.hasExpirationSend, 'hasExpiration', 'recurrenceSettings');
      this.updateObjectInput(null, 'untilDate', 'recurrenceSettings');
    }
  }

  @Watch('periodSelected')
  changeFrequency() {
    if (this.periodSelected !== 2) {
      this.weekDays = [];
      delete this.newCampaign.recurrenceSettings['weekDays'];
    }
  }

  @Watch('endMenu')
  @Watch('dateMenu')
  onMenuChange(value: boolean, oldValue: boolean) {
    if (value) {
      this.$nextTick(() => {
        setTimeout(() => {
          const menuType = this.endMenu ? 'end-date' : 'start-date';
          const activator = this.$el.querySelector(`.date-button[data-menu="${menuType}"]`) as HTMLElement;
          if (activator) {
            setMenuTop(activator);
          }
        }, 0);
      });
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.recurring-step {
  display: flex;
  place-content: center;
}

.recurring-section {
  width: fit-content;
  align-items: start;
}

.card-recurring {
  width: 100%;
  padding: 1em;
  margin: 1em 0;
  border-radius: 16px;
}

.card-label {
  text-align: start;
}

.w-15 {
  width: 15%;
}

.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}

.width-date {
  width: 283px;
}

.width-hour {
  width: 103px;
}

.date-button {
  border-radius: 8px;
  padding-left: 8px !important;
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

.date-range {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 400;
  text-transform: initial !important;
}

.date-picker {
  border-bottom: 1px solid $ds-gray-100;
}

.calendar-icon {
  color: $ds-gray !important;
  font-size: 18px;
}

.calendar-date {
  display: flex;
  align-items: center;
  gap: 9px;
}

.calendar-icon-active {
  color: $ds-blue !important;
}

.icon-up {
  color: $ds-gray !important;
}

.label-placeholder {
  color: $ds-gray-300 !important;
}

.calendar-icon-active {
  color: $ds-blue !important;
}

.day-button-active {
  color: $neutral-basic-white !important;
  background-color: $ds-blue !important;
}

.calendar-icon {
  color: $ds-gray;
  font-size: 18px;
}

.calendar-date {
  display: flex;
  align-items: center;
  gap: 9px;
}

.filters-card {
  border-radius: 8px;
}

.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}

.hour-select {
  align-items: center;
}

.menu-hours {
  display: flex;
  flex-direction: row;
  padding-left: 5px;
  padding-right: 5px;
  width: 115px;
  justify-content: space-between;
  align-items: center;
  min-height: 36px !important;
  color: $ds-gray-300;
  cursor: pointer;
}

.border-menu {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
}

.hours-list {
  max-height: 9em;
  overflow-y: scroll;
  overflow-x: hidden !important;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background-color: #ffffff;
}

.button-hours {
  border-top: 1px solid $ds-gray-100;

  text-align: center;
  padding: 7px 0;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  box-sizing: content-box;

  &:hover,
  &:focus {
    background-color: $ds-blue-100;
  }

  &.selected-hour {
    color: $ds-blue;
    background-color: $ds-blue-100;
  }
}

.search-bar-select {
  display: flex;
  background: #ffffff;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
  padding-right: 12px;
  padding-left: 10px;
  width: 115px;
}

.tag-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
  width: 115px;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  display: block;
  overflow: hidden;
  margin: 0 !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
}

.search-input {
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: 40px;
  text-align: center;
}

::-webkit-scrollbar {
  width: 8px;
}

/* Track */
::-webkit-scrollbar-track {
  border-radius: 10px;
  background: $ds-gray-300;
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: #a6a6a6;
  border-radius: 10px;
}

::placeholder {
  color: $ds-gray-300;
}

.input-number {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  outline: none;
}

.input-size {
  height: 36px;
  width: 50px;
}

.select-period {
  -webkit-appearance: auto;
  height: 36px;
}

.days-buttons {
  color: #a6a6a6;
  background-color: #eaeaea;
  border-radius: 50%;
  width: 25px;
  height: 25px;
}

.all-checkbox {
  width: 16px;
  height: 16px;
  appearance: none;
  border: 1px solid $ds-gray-300;
  border-radius: 50%;
  background-clip: content-box;
  padding: 3px;
  cursor: pointer;
}

.all-checkbox:checked {
  background-color: $ds-blue;
  border: 1px solid $ds-blue !important;
}

.all-checkbox-clicked {
  background-color: inherit !important;
}

.button-number {
  height: 15px;
  outline: none;
}

.all-checkbox-clicked ~ label {
  background-color: inherit !important;
}

input[type='checkbox']:checked + label {
  color: $ds-blue;
  font-weight: 600;
}

.input-button-number {
  width: 15px;
}

input[type='number'] {
  -moz-appearance: textfield;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

button.button-number:disabled {
  background-color: inherit !important;
}

button.button-number:disabled,
button[disabled] .icon-up {
  color: $ds-gray !important;
  opacity: 1 !important;
}

input.input-after:disabled {
  background-color: $ds-gray-100 !important;
  color: $ds-gray-300 !important;
  border: 0px !important;
}

input:disabled ~ .span-ends {
  background-color: inherit !important;
}

input:disabled ~ label.label-ends {
  background-color: inherit !important;
  color: $ds-gray-300 !important;
}

.repeat-div {
  width: 462px;
}

.select-spreadtime {
  max-width: 283px;
}
</style>
