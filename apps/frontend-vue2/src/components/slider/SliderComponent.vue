<template>
  <div class="div-column gap-10">
    <input
      class="input-slider"
      @input="updateSlider"
      id="slider"
      type="range"
      :step="step"
      :max="max"
      v-model="localSliderValue"
      :style="{ '--track-gradient': trackGradient }"
    />
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';

@Component({
  props: ['sliderValue', 'step', 'max', 'min', 'dataName', 'itemCount'],
})
export default class SliderComponent extends Vue {
  @Prop() step!: number;
  @Prop() max!: number;
  @Prop() min!: number;
  @Prop() dataName!: string;
  @Prop() itemCount!: number;
  @Prop() sliderValue!: number;

  localSliderValue = 0;

  beforeMount() {
    this.localSliderValue = this.sliderValue;
  }

  get trackGradient() {
    const colors = ['#98C7FD', '#3E87F8', '#00CEFC', '#FF9654'].slice(0, Math.min(this.itemCount, 4));
    const numColors = colors.length;
    const step = this.localSliderValue / numColors;

    let gradient = `linear-gradient(to right`;

    for (let i = 0; i < numColors; i++) {
      const startPercentage = i * step;
      const endPercentage = (i + 1) * step;

      gradient += `, ${colors[i]} ${startPercentage}%, ${colors[i]} ${endPercentage}%`;
    }

    gradient += `, ${'#D9D9D9'} ${this.localSliderValue}%,
                  ${'#D9D9D9'} ${this.max}%)`;

    return gradient;
  }

  updateSlider() {
    if (this.localSliderValue < this.min) {
      this.localSliderValue = this.min;
    }
    this.$emit('updateInput', this.localSliderValue, this.dataName);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.input-slider {
  min-width: -webkit-fill-available;
  outline: none;
}

input::-webkit-slider-runnable-track {
  background-image: var(--track-gradient);
  border-radius: 10px;
  height: 8px;
  outline: none;
}

input::-webkit-slider-thumb {
  width: 16px;
  height: 16px;
  margin-top: -4px;
}
</style>
