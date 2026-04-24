<template>
  <div v-if="isLoading">
    <v-sheet :color="`grey lighten-4`">
      <v-skeleton-loader
        :class="{ 'no-shadow': noShadow }"
        class="mx-auto skeleton-style"
        :type="type"
        :height="height"
        :width="width"
        :style="`${newStyle}`"
      >
      </v-skeleton-loader>
    </v-sheet>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component({
  props: ['isLoading', 'type', 'height', 'noShadow', 'width', 'newStyle'],
})
export default class DataLoader extends Vue {
  @Prop({ default: false }) isLoading!: boolean;
  @Prop({ default: '' }) height!: string;
  @Prop({ default: '' }) type!: string;
  @Prop({ default: false }) noShadow!: boolean;
  @Prop({ default: '' }) width!: string;
  @Prop({ default: '' }) newStyle!: string;
}
</script>
<style scoped lang="scss">
.skeleton-style {
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
}
.no-shadow {
  box-shadow: none;
}
</style>
