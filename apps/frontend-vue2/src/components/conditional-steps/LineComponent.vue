<template>
  <div class="text-center" :class="[type, defaultClass]">
    <svg
      v-if="type == 'horizontal'"
      width="2"
      height="30"
      viewBox="0 0 1 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style="background-color: #d9d9d9"
    >
      <line x1="0.5" y1="-4.46616e-08" x2="0.50001" y2="30" stroke="#A6A6A6" />
    </svg>
    <svg
      v-if="type == 'vertical'"
      width="16"
      height="2"
      viewBox="0 0 30 1"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style="background-color: #d9d9d9"
    >
      <line y2="0.5" x2="-4.46616e-08" y1="0.50001" x1="30" stroke="#A6A6A6" />
    </svg>
  </div>
</template>

<script script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({
  props: ['type', 'defaultClass'],
})
export default class LineComponent extends Vue {}
</script>

<style scoped lang="scss">
.vertical {
  display: flex;
  align-items: flex-end;
  margin-bottom: 18px;
}
</style>
