<template>
  <div class="view-step-button d-flex w-100">
    <div v-for="(item, index) in items" :key="`step-button-${index}`" class="d-flex">
      <button
        class="step-button text-start"
        :class="[
          index === currentStep ? 'active-button' : '',
          index === 0 ? 'fisrt-button' : '',
          !items[index + 1] ? 'last-button' : '',
          index !== 0 && items[index + 1] ? 'middle-button' : '',
          index < currentStep ? 'past-button' : 'normal-button',
          index % 2 == 0 ? 'even-button' : '',
        ]"
        @click="changeStep(item.name, index)"
      >
        <span class="step-value ml-2">{{ item.value }}</span>
        <span class="inside-triangle" v-if="items[index + 1] && index !== currentStep"></span>
        <span class="margin-triangle" v-if="index !== 0 && index !== currentStep"></span>
      </button>
    </div>
  </div>
</template>

<script script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import LineComponent from '../conditional-steps/LineComponent.vue';

@Component({
  components: { LineComponent },
  props: ['items', 'currentStep'],
})
export default class StepButtonComponent extends Vue {
  changeStep(key: string, step: number) {
    this.$emit('changeStep', key, step);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.step-button {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border: 1.5px solid $ds-gray-300;
  width: 200px;
  height: 45px;
  padding-left: 8px;
  margin-left: 10px;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 14px;
}

.step-button:hover {
  color: white;
  background: $ds-gray-300;

  &::after {
    border-color: transparent transparent transparent $ds-gray-300 !important;
  }
}

.active-button {
  background-color: $ds-blue;
  color: white !important;
  border: 1.5px solid $ds-blue;
}

.active-button:hover {
  background: $ds-blue-dark;
  border: 1.5px solid $ds-blue-dark;

  &::after {
    border-color: transparent transparent transparent $ds-blue-dark !important;
  }
}

.past-button {
  background-color: $ds-gray-100;
  color: $ds-blue;
  border: $ds-blue 2px solid;
  .inside-triangle {
    top: -4.8px !important;
    right: -24.6px !important;
    border-color: transparent transparent transparent $ds-blue !important;
  }

  .margin-triangle {
    border-color: transparent transparent transparent $ds-blue !important;
  }

  &::after {
    top: -2px !important;
    right: -21px !important;
    border-width: 23.75px 0 23.75px 23.75px !important;
    border-radius: 7px !important;
  }

  &::before {
    left: -2px !important;
  }
}

.past-button.even-button {
  background-color: $ds-gray-100;
  color: $ds-blue;
  border: $ds-blue 2px solid;
  .inside-triangle {
    top: -4.8px !important;
    right: -24px !important;
    border-color: transparent transparent transparent $ds-blue !important;
  }

  .margin-triangle {
    border-color: transparent transparent transparent $ds-blue !important;
  }

  &::after {
    top: -2px !important;
    right: -21.4px !important;
    border-width: 23.75px 0 23.75px 23.75px !important;
    border-radius: 7px !important;
  }

  &::before {
    left: -2.6px !important;
  }
}

.past-button:hover {
  color: white;
  background: $ds-blue;

  &::after {
    border-color: transparent transparent transparent $ds-blue !important;
  }
}

.fisrt-button {
  border-top-left-radius: 25px;
  border-bottom-left-radius: 25px;
  padding-left: 0px;
}

.fisrt-button::after {
  z-index: 15;
  content: '';
  position: absolute;
  top: -3px;
  right: -20.5px;
  width: 0;
  height: 0;
  border-style: solid;
  border-radius: 20px;
  border-width: 25px 0 25px 25px;
  border-color: transparent transparent transparent $ds-gray-100;
}

.active-button::after {
  z-index: 16;
  content: '';
  position: absolute;
  top: -4px !important;
  right: -23px !important;
  width: 0;
  height: 0;
  border-style: solid;
  border-radius: 25px;
  border-width: 26.25px 0 26.25px 26.25px !important;
  border-color: transparent transparent transparent $ds-blue !important;
}

.normal-button {
  color: $ds-gray-300;
}

.middle-button.even-button {
  &::after {
    right: -21.5px;
  }
}

.middle-button::after {
  z-index: 16;
  content: '';
  position: absolute;
  top: -3px;
  right: -21px;
  width: 0;
  height: 0;
  border-style: solid;
  border-radius: 25px;
  border-width: 25px 0 25px 25px;
  border-color: transparent transparent transparent $ds-gray-100;
}

.middle-button:before {
  z-index: 13;
  content: '';
  position: absolute;
  top: 0;
  left: -1.6px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 21.25px 0 21.25px 21.25px;
  border-color: transparent transparent transparent $ds-gray-100;
}

.last-button {
  border-top-right-radius: 25px;
  border-bottom-right-radius: 25px;
}

.last-button.active-button::after {
  border-color: transparent transparent transparent transparent !important;
}

.last-button:before {
  z-index: 13;
  content: '';
  position: absolute;
  top: 0px;
  left: -2px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 21.25px 0 21.25px 21.25px;
  border-color: transparent transparent transparent $ds-gray-100;
}

.margin-triangle {
  z-index: 10;
  content: '';
  position: absolute;
  top: 0px;
  left: 0px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 21.25px 0 21.25px 21.25px;
  border-color: transparent transparent transparent $ds-gray-300;
}

.inside-triangle {
  z-index: 15;
  content: '';
  position: absolute;
  top: -4px;
  right: -23px;
  width: 0;
  height: 0;
  border-style: solid;
  border-radius: 20px;
  border-width: 26.25px 0 26.25px 26.25px;
  border-color: transparent transparent transparent $ds-gray-300;
}
.step-number {
  border-right: 1px solid $neutral-gray-500;
  padding: 2px 15px;
}
.view-step-button {
  justify-content: center;
  margin: 1rem 0;
}
</style>
