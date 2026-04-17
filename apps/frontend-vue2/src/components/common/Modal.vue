<template>
  <div class="dialog">
    <div class="dialog-content div-column" v-bind:style="{ padding: view ? '0 !important' : '' }">
      <div
        v-if="!type"
        v-bind:class="[customTitleClass, 'dialog-c-title pb-4']"
        v-bind:style="{ 'padding-bottom': view ? '0 !important' : '' }"
      >
        <span class="button-back" v-if="view">
          <span class="material-symbols-rounded ds-gray-color font-24 cursor-pointer" @click="close()"
            >chevron_left</span
          >
        </span>
        <span>
          {{ title || $t('button.confirm') }}
        </span>
        <span
          v-if="showClose"
          class="dialog-close material-symbols-rounded ds-light-gray-color font-36"
          @click="close()"
          aria-hidden="true"
        >
          close_small
        </span>
      </div>
      <div class="dialog-c-alert">
        <section v-if="type === 'success'">
          <i class="material-symbols-rounded font-24 dialog-success-icon" aria-hidden="true">check_circle_outline</i>
          <h4>{{ $t('datatable.success') }}</h4>
          <p>{{ text || $t('datatable.operationCompleted') }}.</p>
        </section>
        <section v-if="type === 'warning'">
          <i class="material-symbols-rounded font-24 dialog-warn-icon" aria-hidden="true">warning</i>
          <h4>{{ $t('modal.attention') }}</h4>
          <p>{{ text || $t('datatable.operationRequestAttention') }}</p>
        </section>
        <section v-if="type === 'error'">
          <i class="material-symbols-rounded font-24 dialog-error-icon" aria-hidden="true">cancel</i>
          <h4>{{ $t('datatable.error') }}</h4>
          <p>{{ text || $t('datatable.errorRunning') }}</p>
        </section>
      </div>

      <div class="dialog-c-text" v-bind:class="{ 'dialog-c-t': view }" v-if="!custom && !type">
        <span class="font-14" v-html="text || $t('datatable.confirmOperation')"></span>
      </div>
      <component :data="data" @emitData="emitData($event)" v-if="custom" :is="customComponent"></component>
    </div>

    <div
      class="dialog-buttons pt-4"
      v-bind:class="{ 'dialog-btns': view }"
      v-bind:style="{ margin: view ? '32px auto 0 !important' : '' }"
      v-if="!custom"
    >
      <button
        type="button"
        v-if="type"
        class="dialog-button text-white dialog-button-alert btn btn-c btn-lg btn-success btn-success-c"
        :disabled="disabledClose"
        @click="confirm"
      >
        <span> {{ $t('button.close').toString().toUpperCase() }}</span>
      </button>

      <div class="div-row gap-15 main-buttons">
        <button
          v-if="!type"
          type="button"
          class="cancelation-button ds-blue-color text-600 font-10 d-flex"
          @click="cancel"
          :disabled="disabledCancel"
          data-cy="modal-cancel"
        >
          {{ cancelLabel || $t('button.cancel') }}
        </button>

        <button
          v-if="!type"
          type="button"
          class="confirmation-button dialog-button-confirm text-600 font-10 d-flex cursor-pointer text-uppercase"
          :class="[isConfirm ? 'confirm-background' : 'cancel-background']"
          @click.prevent="confirm"
          :disabled="disabledConfirm"
          data-cy="modal-success"
        >
          {{ confirmLabel || $t('button.confirm').toString().toUpperCase() }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class Modal extends Vue {
  @Prop() private type!: string;
  @Prop() private custom!: boolean;
  @Prop() private text!: string;
  @Prop() private title!: string;
  @Prop() private cancelLabel!: string;
  @Prop() private confirmLabel!: string;
  @Prop() private confirmFunction!: any;
  @Prop() private customComponent: any;
  @Prop() private showClose!: boolean;
  @Prop() private view!: boolean;
  @Prop() private disabledCancel!: boolean;
  @Prop() private disabledConfirm!: boolean;
  @Prop() private disabledClose!: boolean;
  @Prop() private isConfirm!: boolean;

  @Prop() private customTitleClass!: string;

  @Prop() private data!: any;

  confirm() {
    this.$emit('onConfirm');
  }
  cancel() {
    this.$emit('onCancel');
  }

  close() {
    this.$emit('onClose');
  }
  emitData(event: any) {
    this.$emit('onEmitDataFunction', event);
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.dialog-c-text {
  max-width: 100%;
  max-height: 450px;
  overflow-y: auto;
}

.dialog-c-t {
  margin: 32px;
}

.dialog-btns {
  padding: 0px;
  align-items: center;
  align-content: center;
  width: 582px;
  height: 34px;
}

.img-button-back {
  width: 7.2px;
  height: 12px;
  cursor: pointer;
}

.button-back {
  width: 24px;
  height: 24px;
}

.dialog-btn {
  width: 275px !important;
  height: 34px !important;
}

.dialog-close {
  cursor: pointer;
}

.dialog-close:hover {
  color: $ds-gray;
  border-radius: 50%;
}

.dialog-buttons {
  border-top: none !important;
  display: flex;
  flex: 0 1 auto;
}

.dialog {
  padding: 20px;
  overflow: visible;
}

.dialog button {
  letter-spacing: 0.07em !important;
  border-radius: 8px !important;
}

.confirmation-button {
  padding: 8px 12px 8px 12px;
  height: 26px;
}

.main-buttons {
  justify-content: end;
  width: 100%;
}
.cancelation-button {
  border: 0;
  height: 26px !important;
  outline: none;
  text-transform: uppercase;
  align-items: center;
  justify-content: center;
}

.dialog-button-confirm {
  outline: none;
  color: #ffffff !important;
  align-items: center;
  justify-content: center;
}

.cancel-background {
  background: #f03232 !important;
}
.confirm-background {
  background: $ds-blue !important;
}

.dialog-button-cancel {
  color: $ds-blue !important;
}

.dialog-c-title,
.modal-title {
  font-weight: 600;
  font-style: normal;
  font-size: 14px;
  line-height: 24px;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between;
  color: $ds-gray !important;
}

.dialog-content {
  flex: 1 0 auto !important;
  font-style: normal !important;
  font-weight: normal !important;
  font-size: 12px !important;
  line-height: 19px !important;
  color: $neutral-gray-800;
  overflow: visible;
}

.dialog-c-alert {
  text-align: center;
}

.dialog-error-icon {
  font-size: 80px;
  color: #f27474;
  padding: 10px;
}

.dialog-warn-icon {
  font-size: 80px;
  color: #f8bb86;
  padding: 10px;
}

.dialog-success-icon {
  font-size: 80px;
  color: #a5dc86;
  padding: 10px;
}

.dialog-c-alert h4 {
  margin-bottom: 5px !important;
}

button:disabled,
button[disabled] {
  color: $neutral-gray-700 !important;
  background-color: $neutral-gray-300 !important;
  opacity: 0.33;
  cursor: auto;
}
</style>
