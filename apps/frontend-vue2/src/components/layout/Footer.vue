<template>
  <v-footer absolute>
    <v-col class="text-center" cols="12">
      <p>By BRIUS</p>
    </v-col>
  </v-footer>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({
  components: {},
})
export default class Footer extends Vue {}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

footer {
  position: absolute;
  bottom: 0;
  background: $neutral-gray-200;
  color: $neutral-gray-200;
}
</style>
