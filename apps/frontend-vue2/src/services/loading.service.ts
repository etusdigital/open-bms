import Vue from 'vue';
import { injectable } from 'vue-typescript-inject';
export const eventHub = new Vue();
export default class LoadingService {
  show() {
    eventHub.$emit('show');
  }

  hide() {
    eventHub.$emit('hide');
  }
}
