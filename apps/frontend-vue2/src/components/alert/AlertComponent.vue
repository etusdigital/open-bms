<template>
  <div class="alert div-row cursor-pointer" :class="type" @click="openAlert">
    <div class="div-row">
      <span
        class="material-symbols-rounded ds-white-color icon-specs mr-3"
        :class="[type === 'info' || type === 'success' ? 'font-14' : 'font-20']"
        v-if="showIcon"
        :style="`background-color: ${getCustomIcon(type).color}`"
      >
        {{ getCustomIcon(type).icon }}
      </span>
      <slot></slot>
    </div>
    <button class="button-alert" v-if="isExpandable">
      <span class="material-symbols-rounded ds-blue-color font-24" :class="expand ? 'hide-button' : 'expand-button'">
        keyboard_arrow_down
      </span>
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

enum AlertType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
}

@Component({
  name: 'AlertComponent',
  props: ['type', 'showIcon', 'isExpandable'],
})
export default class AlertComponent extends Vue {
  @Prop() public type!: AlertType;
  @Prop({ default: true }) public showIcon!: boolean;
  @Prop() public isExpandable!: boolean;

  iconsColors = [
    { type: 'info', color: '#0057F4' },
    { type: 'warning', color: '#FFC500' },
    { type: 'error', color: '#F03232' },
    { type: 'success', color: '#0FB75C' },
  ];
  expand = false;

  switchIconAlert(type: AlertType): string {
    switch (type) {
      case AlertType.INFO:
        return 'info_i';
      case AlertType.WARNING:
        return 'exclamation';
      case AlertType.ERROR:
        return 'exclamation';
      case AlertType.SUCCESS:
        return 'check';
      default:
        return '';
    }
  }

  getCustomIcon(type: AlertType) {
    return { icon: this.switchIconAlert(type), color: this.iconsColors.find((item: any) => item.type === type)?.color };
  }

  openAlert() {
    this.expand = !this.expand;
    this.$emit('openAlert', this.expand);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.alert {
  border-radius: 16px;
  font-size: 14px;
  padding: 8px 16px !important;
  margin-bottom: 8px;
  justify-content: space-between;
}

.icon-specs {
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.icon {
  width: auto;
  padding-right: 16px;
}
.alert.info {
  background-color: #f4f8ff !important;
  color: $ds-blue;
  border: $ds-blue 1px solid !important;
}
.alert.warning {
  background-color: #fffdef !important;
  color: #c0970c;
  border: #c0970c 1px solid !important;
}
.alert.error {
  background-color: #fff0f0 !important;
  color: $ds-red;
  border: $ds-red 1px solid !important;
}
.alert.success {
  background-color: #f2fff8 !important;
  color: #0fb75c;
  border: #0fb75c 1px solid !important;
}
.button-alert {
  display: flex;
  align-items: flex-start;
  outline: none;
}

.expand-button {
  transition: 0.3s;
  transform: rotate(-360deg);
}

.hide-button {
  transition: 0.3s;
  transform: rotate(-180deg);
}
</style>
