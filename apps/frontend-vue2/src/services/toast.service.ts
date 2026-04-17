import Vue from 'vue';
export const eventHub = new Vue();

export default class ToastService {
  show(options: { type: string; text: string; leftBorder?: boolean }) {
    eventHub.$emit('showToast', options);
  }

  hide() {
    eventHub.$emit('hideToast');
  }
}
