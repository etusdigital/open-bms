<template>
  <div class="d-flex w-100" v-if="render">
    <input
      type="number"
      class="form-control mr-3 focus-border no-outline input-height"
      v-model="timer"
      :placeholder="`${timerType === 'hours' ? $t('input.time') : $t('input.timeMinutes')}`"
      @input="updateData"
      min="1"
      id="timer"
    />
    <select
      class="form-control mo-select no-outline input-height"
      v-model="timerType"
      @change="updateData"
      id="timer-type"
    >
      <option v-for="type in timerTypeData" :value="type.value" :key="type.value" id="timer-type">
        {{ type.name }}
      </option>
    </select>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

@Component({
  components: {},
  props: ['render', 'step'],
})
export default class WaitComponent extends Vue {
  @Prop() step!: any;
  @Prop() render!: boolean;
  timer = '';
  timerType = 'hours';
  timerTypeData = [
    { name: 'Horas', value: 'hours' },
    { name: 'Minutos', value: 'minutes' },
  ];

  beforeMount() {
    this.showModal();
  }
  hideModal() {
    this.$emit('hideModal');
  }
  updateData() {
    this.$emit('updateInfo', { timer: this.timer, timerType: this.timerType });
  }
  @Watch('render')
  showModal() {
    if (this.render) {
      this.timer = this.step?.settings?.timer || '';
      this.timerType = this.step?.settings?.timerType || 'hours';
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.focus-border {
  &:focus {
    border-color: $ds-blue !important;
  }
}

.no-outline {
  &:focus {
    box-shadow: none;
    outline: none;
  }
}
</style>
