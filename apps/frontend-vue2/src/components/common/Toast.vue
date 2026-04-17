<template>
  <div class="toast-component">
    <v-snackbar
      v-model="visible"
      :top="true"
      :right="true"
      :rounded="true"
      :color="type == 'error' ? '#d21c1c' : type == 'warn' ? '#f9971e' : type == 'success' ? '#46b655' : '#0172cb'"
      class="c-toast"
      content-class="c-toast-content"
    >
      {{ text }}
      <template v-slot:action="{ attrs }">
        <span text v-bind="attrs" @click="visible = false" class="material-symbols-rounded font-24 cursor-pointer">
          close
        </span>
      </template>
    </v-snackbar>
  </div>
</template>

<script lang="ts">
import { eventHub } from '@/services/toast.service';
import { Component, Vue } from 'vue-property-decorator';

@Component
export default class Toast extends Vue {
  private type = '';
  private text = '';
  private leftBorder = false;
  private visible = false;

  created() {
    eventHub.$on('showToast', (options: any) => this.showToast(options));
    eventHub.$on('hideToast', (options: any) => (this.visible = false));
  }

  showToast(options: { type: string; text: string; leftBorder?: boolean }) {
    this.text = options.text;
    this.type = options.type;
    this.leftBorder = options.leftBorder || false;
    this.visible = true;
  }
}
</script>
