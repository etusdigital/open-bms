<template>
  <div class="view-date-time-component">
    <div class="div-row center-align-bms" :class="!double ? 'mt-1' : ''">
      <v-menu
        v-model="menu"
        v-if="!isCampaignRule"
        class="calendar-menu"
        bottom
        transition="scale-y-transition"
        offset-y
        width="272"
      >
        <template v-slot:activator="{ on }">
          <button
            v-on="on"
            class="text-field div-row"
            :class="{ 'border-top-menu': menu }"
            @click.prevent="menu = true"
          >
            <div class="div-row gap-10 align-items-center">
              <span class="material-symbols-rounded ds-gray-color font-16" :class="{ 'ds-blue-color': menu }">
                calendar_month
              </span>
              <span class="font-12 text-600 ds-gray-color">{{ selectedDate }}</span>
            </div>
            <span class="material-symbols-rounded ds-gray-color" :class="{ 'icon-dropdown ds-blue-color': menu }">
              arrow_drop_down
            </span>
          </button>
        </template>

        <div :class="{ 'border-bottom-menu': menu }">
          <v-list>
            <v-list-item
              class="dropdown-select"
              v-for="(item, index) in optionsDate"
              :key="index"
              @click="changeDate(item.value, dataName, dataNameTo)"
            >
              <v-list-item-title>{{ item.name }}</v-list-item-title>
            </v-list-item>
          </v-list>
          <v-date-picker
            v-model="pickedDate"
            no-title
            width="270"
            :min="dateToVuetifyString(minScheduleDate)"
            :max="dateToVuetifyString(maxScheduleDate)"
            @input="changeDataPicker($event, dataName, dataNameTo)"
          />
        </div>
      </v-menu>
      <div v-if="!isCampaignRule" class="d-flex align-center justify-center mx-2 align-bms-text">
        {{ $t('datatable.toThe') }}
      </div>
      <v-menu ref="menu" v-model="hourMenu" bottom class="tag-menu" :close-on-content-click="false">
        <template v-slot:activator="{ on }">
          <div class="menu-hours border-menu" v-on="on">
            <span
              class="material-symbols-rounded ds-gray-color font-16"
              :class="[hourMenu ? 'calendar-icon-active' : '']"
              dense
            >
              schedule
            </span>
            <label class="font-12 font-hour-select text-400 icon-up mb-0 cursor-pointer">
              {{ hourSelected !== '' ? hourSelected : currentHour }}
            </label>
            <span class="material-symbols-rounded ds-gray-color" :class="{ 'icon-dropdown': hourMenu }" dense>
              arrow_drop_down
            </span>
          </div>
        </template>
        <v-card class="hours-card">
          <div class="menu-hours">
            <div class="d-flex gap-10">
              <span class="material-symbols-rounded font-16" :class="[hourMenu ? 'calendar-icon-active' : '']" dense>
                schedule
              </span>
              <input
                :id="recurrenceTypeHourInputId"
                class="search-input"
                type="text"
                v-model="hourSelected"
                placeholder="12:00"
                v-time-mask
                @keyup="moveToHourMenu"
                @input="typeHour($event.target.value, scheduleTo, dataName)"
              />
            </div>
            <span
              class="material-symbols-rounded cursor-pointer"
              :class="{ 'icon-dropdown ds-blue-color': hourMenu }"
              dense
              @click="hourMenu = false"
            >
              arrow_drop_down
            </span>
          </div>
          <div :id="hourListId" class="hours-list">
            <button
              class="button-hours font-12 font-hour-select"
              :class="[hour === hourSelected ? 'selected-hour' : '']"
              v-for="hour in hours"
              :key="hour"
              @click="changeHour(hour, scheduleTo, dataName)"
              @keyup="moveInsideHourMenu"
            >
              {{ hour }}
            </button>
          </div>
        </v-card>
      </v-menu>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { mapState } from 'vuex';
import { setMenuTop } from '@/util/objects';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  props: ['scheduleTo', 'scheduleEnd', 'double', 'dataName', 'dataNameTo', 'idSuffix', 'isCampaignRule'],
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class DateTimeComponent extends Vue {
  @Prop() readonly scheduleTo!: Date;
  @Prop() readonly scheduleEnd!: Date;
  @Prop() readonly double!: boolean;
  @Prop() readonly isCampaignRule!: boolean;
  @Prop() readonly dataName!: string;
  @Prop() readonly dataNameTo!: string;
  @Prop() readonly idSuffix!: string;

  public currentAccountTimezone!: string;
  public userLanguage!: string;
  minScheduleDate = new Date();
  maxScheduleDate = new Date();
  showDatePicker = false;
  showTimePicker = false;
  pickedDate = '';
  showInvalidDate = false;

  hourMenu = false;
  hours: string[] = [];
  hourSelected = '##:##';
  optionsMinute = ['00', '15', '30', '45'];

  optionsDate = [
    { name: this.$t('input.today'), value: 0 },
    { name: this.$t('input.tomorrow'), value: 1 },
    { name: this.$t('input.nextWeek'), value: 7 },
    { name: this.$t('input.nextMonth'), value: 30 },
  ];
  selectedDate = '';
  selectedHour!: number;
  selectedMinute!: number;
  keysPressed: { [key: string]: any } = {};
  menu = false;

  get recurrenceTypeHourInputId() {
    return `recurrenceTypeHourInput-${this.idSuffix}`;
  }

  get hourListId() {
    return `hour-list-${this.idSuffix}`;
  }

  beforeMount() {
    const date = dayjs(this.scheduleTo || new Date()).tz(this.currentAccountTimezone);
    this.minScheduleDate.setDate(new Date().getDate());
    this.maxScheduleDate.setDate(new Date().getDate() + 30);
    this.pickedDate = this.dateToVuetifyString(date.toDate());
    this.selectedDate = this.dateToStringLocal(date.toDate());
    this.selectedHour = date.hour();
    this.selectedMinute = date.minute();
    this.hourSelected = `${this.selectedHour}:${
      this.selectedMinute < 10 ? `0${this.selectedMinute}` : this.selectedMinute
    }`;
    this.getInputHours();
  }

  mounted() {
    document.addEventListener('keydown', this.captureKeys);
    document.addEventListener('keyup', this.releaseKeys);
  }

  destroyed() {
    document.removeEventListener('keydown', this.captureKeys);
    document.removeEventListener('keyup', this.releaseKeys);
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

  get currentHour() {
    return dayjs().tz(this.currentAccountTimezone).add(1, 'hour').startOf('hour').format('HH:00');
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

  changeDate(e: number, keyName: string, keyNameTo = '', useSelectedDate = false) {
    const useDate = useSelectedDate ? this.scheduleTo : new Date();
    const newDate = dayjs(useDate)
      .tz(this.currentAccountTimezone)
      .add(e, 'day')
      .hour(this.selectedHour)
      .minute(this.selectedMinute);

    this.selectedDate = this.dateToStringLocal(newDate.toDate());
    this.pickedDate = this.dateToVuetifyString(newDate.toDate());
    this.$emit('updateInput', newDate.toDate(), keyName);
    if (keyNameTo) {
      this.$emit('updateInput', newDate.toDate(), keyNameTo);
    }
  }

  changeHour(time: string, date: Date, keyName: string) {
    const [hour, minute] = time.split(':');
    this.selectedHour = parseInt(hour, 10);
    this.selectedMinute = parseInt(minute, 10);
    this.hourSelected = time;
    this.hourMenu = false;
    const newDate = dayjs(date)
      .tz(this.currentAccountTimezone)
      .set('hour', this.selectedHour)
      .set('minute', this.selectedMinute);
    this.$emit('updateInput', newDate.toDate(), keyName);
  }

  changeDataPicker(date: string, keyName: string, keyNameTo = '') {
    const newDate = dayjs
      .utc(date)
      .startOf('day')
      .tz(this.currentAccountTimezone, true)
      .hour(this.selectedHour)
      .minute(this.selectedMinute);

    this.selectedDate = this.dateToStringLocal(newDate.toDate());
    this.$emit('updateInput', newDate.toDate(), keyName);
    if (keyNameTo) {
      this.$emit('updateInput', newDate.toDate(), keyNameTo);
      this.$emit('updateInput', newDate, keyNameTo);
    }
  }

  dateToStringLocal(data: Date) {
    return Vue.filter('formatDate')(data, { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  captureKeys(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (!/^(?:input|textarea|select)$/i.test(target.tagName)) {
      this.keysPressed[event.key] = true;

      if (this.keysPressed['d'] && event.key === 'n') {
        this.changeDate(1, this.$props.dataName, this.$props.dataNameTo, true);
      }
    }
  }

  releaseKeys(event: KeyboardEvent) {
    setTimeout(() => {
      delete this.keysPressed[event.key];
    }, 500);
  }

  get describeTimeZone(): string {
    const date = new Date(this.pickedDate);
    const long = new Intl.DateTimeFormat(this.userLanguage, {
      timeZone: this.currentAccountTimezone,
      timeZoneName: 'long',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName');

    const short = new Intl.DateTimeFormat(this.userLanguage, {
      timeZone: this.currentAccountTimezone,
      timeZoneName: 'short',
    })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName');

    if (long === undefined || short === undefined) {
      return '';
    }

    return `(${short.value}) ${long.value}`;
  }

  moveToHourMenu(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      const hourList = document.getElementById(this.hourListId);
      if (!hourList) {
        return;
      }

      const hourDivs: NodeListOf<HTMLElement> = hourList.querySelectorAll('button');

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

    const hourList = document.getElementById(this.hourListId);
    if (!hourList) {
      return;
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

      if (hourList && nextElement) {
        hourList.scrollTop = nextElement.offsetTop - hourList.clientHeight / 2 + nextElement.clientHeight / 2;
      }
    }
  }

  typeHour(h: string, date: Date, key: string) {
    const hourList = document.getElementById(this.hourListId);
    if (!hourList) {
      return;
    }

    const hourDivs: NodeListOf<HTMLElement> = hourList.querySelectorAll('button');

    let targetDiv!: HTMLElement;
    for (const div of hourDivs) {
      if (div.textContent?.trim().substring(0, h.length) === h) {
        targetDiv = div;
        break;
      }
    }

    if (targetDiv) {
      hourList.scrollTop = targetDiv.offsetTop - hourList.clientHeight / 2 + targetDiv.clientHeight / 2;
    }

    if (/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(h)) {
      this.changeHour(h, date, key);
    }
  }

  @Watch('hourMenu')
  focusHourMenu() {
    if (this.hourMenu) {
      setTimeout(() => {
        const inputElement = document.getElementById(this.recurrenceTypeHourInputId) as HTMLInputElement;
        if (inputElement) {
          inputElement.focus();
          inputElement.select();
        }
      }, 100);
    }
  }

  @Watch('menu')
  onMenuChange(value: boolean) {
    if (value) {
      this.$nextTick(() => {
        setTimeout(() => {
          const activator = this.$el.querySelector('.text-field') as HTMLElement;
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

::v-deep .v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  box-shadow: none !important;
}

::v-deep .theme--light.v-text-field--solo > .v-input__control > .v-input__slot {
  background: none !important;
}

::v-deep .v-input__icon--prepend i {
  font-size: 20px !important;
  left: 2px !important;
  top: -6px !important;
  display: flex !important;
  justify-content: center !important;
}

::v-deep .v-label {
  position: relative !important;
}
::v-deep .v-input__slot {
  min-height: 38px !important;
}

.expansion-panel-content {
  transition: height 0.3s ease-in-out;
}

.view-date-time-component {
  z-index: 1;
}

.prepend-icon {
  font-size: 20px !important;
  position: absolute;
  left: 10px;
  top: 17px;
  transform: translateY(-50%);
  pointer-events: none;
}

.center-align-bms {
  text-align: center;
}
.align-bms-text {
  margin-top: 2px;
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
  letter-spacing: 0em;
  text-align: left;
  color: #5c5c5c;
}

.v-select-date {
  width: 272px;
  height: 36px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
}
.select-hour-bms {
  width: 120px;
  min-height: 36px !important;
  height: 36px !important;
  max-height: 36px !important;
  border-radius: 8px;
  border-top: 1px solid #d9d9d9 !important;
  border-left: 1px solid #d9d9d9 !important;
  border-right: 1px solid #d9d9d9 !important;
  border-bottom: 1px solid #d9d9d9 !important;
}

.custom-select-date {
  width: 272px;
  height: 36px;
  padding: 0px 38px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
}

.custom-select-date:hover {
  cursor: pointer;
}

.text-field {
  width: 272px;
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

.date-input {
  outline: none;
  justify-content: center;
}

.calendar-menu {
  border-radius: 8px 8px 0px 0px !important;
  outline: none !important;
}

.dropdown-select {
  border-bottom: 1px solid #f5f5f5;
}

.border-bottom-menu {
  border-bottom: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-radius: 0px 0px 8px 8px !important;
}

.border-top-menu {
  border-bottom: 1px solid #f5f5f5;
  border-top: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-radius: 8px 8px 0px 0px !important;
}

.v-icon-up {
  position: absolute;
  font-size: 24px;
  top: 7px;
  right: 10px;
}

::v-deep.v-text-field.v-text-field--solo .v-label {
  top: 0px !important;
  margin-bottom: 3px;
}

.calendar-icon-active {
  color: $ds-blue !important;
  font-size: 16px;
}
::v-deep.v-picker--date {
  border-radius: 0px 0px 8px 8px !important;
}
::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}

.hour-select {
  align-items: center;
  font-size: 12px;
  color: #5c5c5c;
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
.font-hour-select {
  color: #5c5c5c;
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

.hours-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
  width: 115px;
}

.search-input {
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: 40px;
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

input[type='number'] {
  -moz-appearance: textfield;
}

.icon-up {
  color: $ds-gray !important;
}
</style>
