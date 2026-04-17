<template>
  <div class="view-add-step-button">
    <button class="v-btn-icon" type="button" @click="addStep">
      <span class="material-symbols-rounded v-icon-plus"> add </span>
    </button>
  </div>
</template>

<script script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({
  components: {},
  props: [],
})
export default class AddStepButtonComponent extends Vue {
  addStep() {
    this.$emit('addMessage');
  }
}
</script>

<style scoped lang="scss">
.view-add-step-button {
  display: flex;
  justify-content: center;
  align-items: center;
}
.v-btn-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 36px !important;
  width: 36px !important;
  background-color: #0fb75c;
  border-radius: 18px;
}
.v-icon-plus {
  color: white !important;
}
</style>
