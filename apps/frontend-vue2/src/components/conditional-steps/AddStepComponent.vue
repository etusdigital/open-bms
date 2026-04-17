<template>
  <div class="view-add-step container-style">
    <v-menu v-model="fab" bottom :offset-x="true" style="z-index: 11">
      <template v-slot:activator="{ on, attrs }">
        <v-btn
          class="v-btn-icon"
          :color="fab ? '#F03232' : '#0FB75C'"
          small
          dark
          fab
          v-bind="attrs"
          v-on="on"
          @click="addAutomaticStep"
        >
          <span class="material-symbols-rounded" v-if="fab"> close </span>
          <span class="material-symbols-rounded" v-else> add </span>
        </v-btn>
      </template>

      <v-list v-if="stepsTypes.length > 1" style="background-color: white; padding: 6px !important">
        <v-list-item v-for="step in stepsTypes" :key="step.name" class="p-0 list-item">
          <v-list-item-content>
            <v-btn class="text-start btn-list font-12" @click="addStep(step.name)">{{ step.title }}</v-btn>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script script lang="ts">
import { AddStepType } from '@/interfaces/step-conditional.interfaces';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

@Component({
  components: {},
  props: ['index', 'stepsTypes'],
})
export default class AddStepComponent extends Vue {
  fab = false;
  @Prop() stepsTypes!: Array<AddStepType>;
  @Prop() index!: number;

  addStep(item: string) {
    this.$emit('addStep', item, this.index);
  }

  addAutomaticStep() {
    if (this.stepsTypes.length === 1) {
      this.addStep(this.stepsTypes[0].name);
    }
  }

  @Watch('fab')
  changeModelAutomaticStep() {
    if (this.stepsTypes.length === 1) {
      this.fab = false;
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.v-btn-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 33px !important;
  width: 33px !important;
  border-radius: 50%;
}
.view-add-step {
  margin-top: auto;
}
.list-item {
  border-radius: 16px;
}
.btn-list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  background-color: white !important;
  border-radius: 8px;
  text-transform: math-auto;
  box-shadow: none;
}

::v-deep.v-btn:not(.v-btn--round).v-size--default {
  padding: 0 8px;
}

::v-deep span.v-btn__content {
  border-radius: 50%;
}

.icon {
  color: white !important;
}
</style>
