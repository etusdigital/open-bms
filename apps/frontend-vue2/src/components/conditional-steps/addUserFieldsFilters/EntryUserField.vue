<template>
  <div class="d-flex">
    <SelectConditionalComponent
      @updateStep="updateStep"
      :color="'select-light-purple'"
      :items="conditionalUserFields"
      :conditionalName="'conditional_user_field'"
      :value="step.conditional_user_field || '='"
    />

    <LineComponent :type="'vertical'" />

    <div v-tooltip.right="$t('datatable.zeroToday')" v-if="selectedConditional === '-'">
      <v-text-field
        autofocus
        class="form-control input-date"
        solo
        :rules="[() => step.user_field_value >= 0 || $t('warning.negativeNotAllowed')]"
        @input="updateStep('user_field_value', $event.target.value)"
        v-model="step.user_field_value"
        type="number"
        min="0"
      />
    </div>
    <v-menu
      v-else
      ref="menu"
      v-model="menu"
      bottom
      class="date-menu"
      :close-on-content-click="false"
      transition="scale-transition"
      offset-x
    >
      <template v-slot:activator="{ on, attrs }">
        <v-text-field
          v-model="selectedDate"
          class="date-text"
          solo
          :rules="[
            () => !!selectedDate || $t('warning.fillDate'),
            () => (!!selectedDate && selectedDate.length == 10) || $t('warning.formatDate'),
            () => (!!selectedDate && convertLocaleToDate(selectedDate) < new Date()) || $t('warning.futureDate'),
            () =>
              (!!selectedDate && convertLocaleToDate(selectedDate) > minScheduleDate) ||
              $t('warning.oldestDateAllowed', { limitDate: dateToStringLocal(minScheduleDate) }),
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
        class="date-input"
        :min="dateToVuetifyString(minScheduleDate)"
        :max="dateToVuetifyString(new Date())"
        :locale="userLanguage"
        @input="changeDataPicker($event, 'user_field_value')"
      />
    </v-menu>
  </div>
</template>

<script script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import SelectConditionalComponent from '../SelectConditionalComponent.vue';
import LineComponent from '../LineComponent.vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { mapState } from 'vuex';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: { SelectConditionalComponent, LineComponent },
  props: ['step', 'dataName', 'dataNameTo'],
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class EntryUserField extends Vue {
  public currentAccountTimezone!: string;
  public userLanguage!: string;
  selectedConditional = '';
  userFieldValue = '';
  menu = false;
  selectedDate = '';
  pickedDate = '';
  minScheduleDate = new Date();
  keysPressed: { [key: string]: any } = {};
  conditionalUserFields = [
    { name: '=', value: 'Igual' },
    { name: '!=', value: 'Diferente' },
    { name: '>', value: 'Maior' },
    { name: '>=', value: 'Maior Igual' },
    { name: '<', value: 'Menor' },
    { name: '<=', value: 'Menor Igual' },
    { name: '-', value: 'Últimos Dias' },
  ];

  beforeMount() {
    const step = this.$props.step;
    const date = step.user_field_value ? new Date(step.user_field_value) : new Date();
    if (step.user_field_value === '' && step.conditional_user_field !== '-') {
      this.$emit('updateStep', 'user_field_value', date);
    }
    this.selectedConditional = step.conditional_user_field;
    this.userFieldValue = step?.user_field_value || '';
    this.selectedDate = this.dateToStringLocal(date);
    this.pickedDate = this.dateToVuetifyString(date);
    this.minScheduleDate.setDate(new Date().getDate() - 180);
  }

  dateToStringLocal(date: Date) {
    return date.toLocaleDateString(this.userLanguage, { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  convertLocaleToDate(date: string) {
    const dateParts = date.split('/');
    let utcDate = new Date(
      Date.UTC(parseInt(dateParts[2], 10), parseInt(dateParts[0], 10) - 1, parseInt(dateParts[1], 10))
    );
    if (this.userLanguage === 'pt-BR') {
      utcDate = new Date(
        Date.UTC(parseInt(dateParts[2], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[0], 10))
      );
    }
    utcDate.setDate(utcDate.getUTCDate());
    return utcDate;
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

  updateStep(key: string, value: string) {
    if (key === 'conditional_user_field' && this.$props.step.conditional_user_field !== value) {
      this.selectedConditional = value;
      if (!(this.$props.step.user_field_value instanceof Date)) {
        const newDate = new Date();
        this.selectedDate = this.dateToStringLocal(newDate);
        this.pickedDate = this.dateToVuetifyString(newDate);
        this.$emit('updateStep', 'user_field_value', newDate);
      }
    }

    this.$emit('updateStep', key, value);
  }

  changeDateTextField(value: string) {
    if (value.length < 10) {
      return;
    }

    const date = this.convertLocaleToDate(value);
    this.selectedDate = this.dateToStringLocal(date);
    this.pickedDate = this.dateToVuetifyString(date);
    this.$emit('updateStep', 'user_field_value', date);
  }

  changeDataPicker(e: string, keyName: string) {
    const newDate = dayjs.utc(e).startOf('day').tz(this.currentAccountTimezone, true);
    this.selectedDate = this.dateToStringLocal(new Date(newDate.format('YYYY-MM-DDTHH:mm:ss')));
    this.pickedDate = this.dateToVuetifyString(new Date(newDate.format('YYYY-MM-DDTHH:mm:ss')));
    this.$emit('updateStep', keyName, new Date(newDate.format('YYYY-MM-DDTHH:mm:ss')));
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
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
.input-date {
  width: 167px;
}
::v-deep .v-input__slot {
  border-radius: 8px;
  border: 1px solid $ds-gray-300;
  box-shadow: none !important;
}

::v-deep .v-input__control {
  display: block;
}
</style>
