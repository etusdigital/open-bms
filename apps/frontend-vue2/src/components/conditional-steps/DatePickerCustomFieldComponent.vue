<template>
  <v-menu ref="menu" bottom class="date-menu" :close-on-content-click="false" transition="scale-transition" offset-x>
    <template v-slot:activator="{ on, attrs }">
      <v-text-field
        v-model="selectedDate"
        class="form-control"
        solo
        :rules="[
          () => !!selectedDate || $t('warning.fillDate'),
          () => (!!selectedDate && selectedDate.length == 10) || $t('warning.formatDate'),
        ]"
        append-icon="mdi-chevron-down"
        v-bind="attrs"
        v-on="on"
        @input="changeDateTextField($event)"
      ></v-text-field>
    </template>
    <v-date-picker
      no-title
      v-model="pickedDate"
      class="input-date"
      :locale="$store.state.userLanguage"
      :min="minDays !== undefined ? dateToVuetifyString(minScheduleDate) : null"
      :max="maxDays !== undefined ? dateToVuetifyString(maxScheduleDate) : null"
      @input="changeDatePicker($event, 'custom_field_value')"
    />
  </v-menu>
</template>

<script script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import store from '../../store';
import { mapState } from 'vuex';

@Component({
  computed: {
    ...mapState(['currentAccountTimezone']),
  },
})
export default class DatePickerCustomFieldComponent extends Vue {
  @Prop() step!: any;
  @Prop() keyName!: any;
  @Prop() minDays!: number;
  @Prop() maxDays!: number;
  @Prop() type!: string;

  currentAccountTimezone!: string;
  selectedDate: any = '';
  pickedDate: any = '';
  key: any = 'custom_field_value';
  minScheduleDate = new Date();
  maxScheduleDate = new Date();

  beforeMount() {
    const step = this.$props.step;
    this.key = this.keyName ? this.keyName : 'custom_field_value';

    const date = step[this.key] ? this.createDateInAccountTimezone(step[this.key]) : new Date();
    this.selectedDate = this.dateToStringLocal(date);
    this.pickedDate = this.dateToVuetifyString(date);
    if (!step[this.key]) {
      this.$emit('updateStep', this.key, this.pickedDate);
      this.$emit('updateInfo', { customFieldValue: this.pickedDate });
    }
    this.minScheduleDate.setDate(new Date().getDate() - (this.minDays !== undefined ? this.minDays : 180));
    this.maxScheduleDate.setDate(new Date().getDate() + (this.maxDays || 360));
  }

  createDateInAccountTimezone(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  changeDatePicker(e: string, keyName: string) {
    const dateParts = e.split('-');
    const newDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), 23, 59, 59);
    this.selectedDate = this.dateToStringLocal(newDate);
    this.pickedDate = this.dateToVuetifyString(newDate);
    this.$emit('updateStep', this.key, this.pickedDate);
    this.$emit('updateInfo', { customFieldValue: this.pickedDate });
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

  dateToStringLocal(date: Date) {
    if (!this.currentAccountTimezone || this.type === 'campaign-rule') {
      const noTimezoneYear = date.getFullYear();
      const noTimezoneMonth = date.getMonth() + 1;
      const noTimezoneDay = date.getDate();
      return `${noTimezoneDay < 10 ? '0' : ''}${noTimezoneDay}/${
        noTimezoneMonth < 10 ? '0' : ''
      }${noTimezoneMonth}/${noTimezoneYear}`;
    }

    const dateInTimezone = new Date(date.toLocaleString('en-US', { timeZone: this.currentAccountTimezone }));
    const year = dateInTimezone.getFullYear();
    const month = dateInTimezone.getMonth() + 1;
    const day = dateInTimezone.getDate();

    return `${day < 10 ? '0' : ''}${day}/${month < 10 ? '0' : ''}${month}/${year}`;
  }

  convertLocaleToDate(date: string) {
    const dateParts = date.split('/');
    let utcDate = new Date(
      Date.UTC(parseInt(dateParts[2], 10), parseInt(dateParts[0], 10) - 1, parseInt(dateParts[1], 10))
    );
    if (store.state.userLanguage === 'pt-BR') {
      utcDate = new Date(
        Date.UTC(parseInt(dateParts[2], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[0], 10))
      );
    }
    utcDate.setDate(utcDate.getUTCDate());
    return utcDate;
  }

  changeDateTextField(value: string) {
    if (value.length < 10) {
      return;
    }

    const date = this.convertLocaleToDate(value);
    this.selectedDate = this.dateToStringLocal(date);
    this.pickedDate = this.dateToVuetifyString(date);
    this.$emit('updateStep', this.key, this.pickedDate);
    this.$emit('updateInfo', { customFieldValue: this.pickedDate });
  }
}
</script>

<style scoped lang="scss">
.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.date-text {
  display: flex;
  margin-bottom: -30px;
  width: 167px;
  font-size: 12px;
}

.form-control {
  border: none !important;
}
</style>
