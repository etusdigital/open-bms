<template>
  <div v-if="render">
    <label class="mb-3 text-600 font-12">{{ $t('title.splitInto') }}</label>
    <div class="div-column" v-for="(value, index) in splitItems" :key="index">
      <div>
        <span class="ds-gray-color font-12 text-600">{{ $t('title.splitPath', { value: sliderLabel(index) }) }}</span>
      </div>
      <div class="div-row slider-number mb-3 gap-10">
        <input
          class="input-slider"
          type="range"
          min="0"
          max="100"
          :value="value"
          @input="updateInput(index, $event)"
          :style="{ '--track-gradient': sliderGradient(index) }"
        />
        <div class="div-row input-number-div">
          <input
            class="input-number input-size ds-gray-color font-12 text-400"
            type="number"
            min="0"
            max="100"
            :value="value"
            @input="updateInput(index, $event)"
          />
          <span class="text-400 font-12 ds-gray-color">%</span>
        </div>
        <div class="div-column">
          <button class="button-number d-flex align-items-center" type="button" @click.prevent="incrementSlider(index)">
            <span class="material-symbols-rounded font-24 ds-gray-color">arrow_drop_up</span>
          </button>
          <button class="button-number d-flex align-items-center" type="button" @click.prevent="decrementSlider(index)">
            <span class="material-symbols-rounded font-24 ds-gray-color">arrow_drop_down</span>
          </button>
        </div>
        <button
          class="d-flex align-items-center ml-1"
          v-if="splitItems.length > 2"
          @click.prevent="deleteSlider(index)"
        >
          <span class="material-symbols-rounded font-24 ds-light-gray-color icon-active">delete</span>
        </button>
      </div>
    </div>
    <div v-if="splitItems.length < 5" class="d-flex">
      <button class="d-flex" @click.prevent="addSlider">
        <span class="material-symbols-rounded add-icon">add_circle</span>
      </button>
    </div>
    <div class="div-row reset-value">
      <button class="ds-blue-color font-10 text-600 reset-button" @click.prevent="resetValues">
        {{ $t('button.reset') }}
      </button>
      <span
        class="total-value text-600 font-10"
        :class="[totalSliderValue < 100 || totalSliderValue > 100 ? 'split-error' : 'split-correct']"
        >Total: {{ totalSliderValue }}%</span
      >
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

@Component({
  components: {},
  props: ['render', 'step'],
})
export default class SplitComponent extends Vue {
  @Prop() step!: any;
  @Prop() render!: boolean;
  splitItems: number[] = [50, 50];
  deletedPaths = [] as number[];

  beforeMount() {
    if (this.render && this.step.child) {
      this.splitItems = this.step.child.map((childObject: any) => childObject.settings.value);
    }
    this.updateInput(0);
  }

  get totalSliderValue(): number {
    return this.splitItems.reduce((total, value) => total + value, 0);
  }

  sliderLabel(index: number): string {
    const labels = ['A', 'B', 'C', 'D', 'E'];
    return labels[index] || '';
  }

  addSlider() {
    const numSliders = this.splitItems.length + 1;
    const initialValue = Math.floor(100 / numSliders);
    this.splitItems.push(initialValue);
    this.resetValues();
  }

  updateInput(index: number, event?: Event) {
    if (event) {
      const target = event.target as HTMLInputElement;
      const value = parseInt(target.value, 10);
      this.$set(this.splitItems, index, value);
      if (this.splitItems.length === 2) {
        const otherIndex = index === 0 ? 1 : 0;
        const newValue = 100 - value;
        this.$set(this.splitItems, otherIndex, newValue);
      }
    }

    const splitItemsObj: Record<string, number> = {};
    this.splitItems.forEach((slidersValue, slidersIndex) => {
      splitItemsObj[(slidersIndex + 1).toString()] = slidersValue;
    });

    this.$emit('updateInfo', splitItemsObj);
  }

  incrementSlider(index: number) {
    if (this.splitItems.length <= 2) {
      const otherIndex = index === 0 ? 1 : 0;
      if (this.splitItems[index] < 100 && this.splitItems[otherIndex] > 0) {
        this.$set(this.splitItems, index, this.splitItems[index] + 1);
        this.$set(this.splitItems, otherIndex, this.splitItems[otherIndex] - 1);
      }
    }
    if (this.splitItems.length > 2 && this.splitItems[index] < 100) {
      this.$set(this.splitItems, index, this.splitItems[index] + 1);
    }
    this.updateInput(index);
  }

  decrementSlider(index: number) {
    if (this.splitItems.length <= 2) {
      const otherIndex = index === 0 ? 1 : 0;
      if (this.splitItems[index] > 0 && this.splitItems[otherIndex] < 100) {
        this.$set(this.splitItems, index, this.splitItems[index] - 1);
        this.$set(this.splitItems, otherIndex, this.splitItems[otherIndex] + 1);
      }
    }
    if (this.splitItems.length > 2 && this.splitItems[index] > 0) {
      this.$set(this.splitItems, index, this.splitItems[index] - 1);
    }
    this.updateInput(index);
  }

  deleteSlider(index: number) {
    this.splitItems.splice(index, 1);
    this.deletedPaths.push(index);
    this.resetValues();
    this.$emit('deletePath', this.deletedPaths, true);
  }

  resetValues() {
    const newSliderValue = Math.floor(100 / this.splitItems.length);
    this.splitItems = Array(this.splitItems.length).fill(newSliderValue);
    this.splitItems.forEach((value, index) => {
      this.updateInput(index);
    });
  }

  sliderGradient(index: number): string {
    const sliderValue = this.splitItems[index];
    const thumbPercentage = sliderValue;

    const gradient = `linear-gradient(to right, #9ABBF8 0%, #9ABBF8 ${thumbPercentage}%, #D9D9D9 ${thumbPercentage}%, #D9D9D9 100%)`;
    return gradient;
  }

  @Watch('render')
  async renderSplit() {
    if (this.render && this.step && this.step.child) {
      this.splitItems = this.step.child.map((childObject: any) => childObject.settings.value);
      this.deletedPaths = [];
      this.updateInput(0);
    }
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.split-items {
  gap: 10px;
}
.div-input-split {
  min-width: 100px;
}

.input-slider {
  -webkit-appearance: none;
  width: -webkit-fill-available;
  height: 4px;
  background: #ddd;
  border-radius: 5px;
  outline: none;
  margin: 0;
  padding: 0;
}

.input-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 15px;
  height: 15px;
  background: $ds-blue;
  cursor: pointer;
  border-radius: 50%;
  margin-top: -5px;
}

/* Customize the track */
.input-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: #ddd;
  border-radius: 5px;
  background-image: var(--track-gradient);
}

.button-slider {
  border-radius: 50%;

  background-color: #0fb75c;
  color: #ffffff;
}

.plus-icon {
  color: #ffffff;
}

.input-number-div {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  padding: 5px;
  height: 36px;
  align-items: center;
  gap: 3px;
}

.input-number {
  border: none;
  outline: none;
  justify-items: flex-end;
}

.input-size {
  width: 20px;
}

.slider-number {
  align-items: center;
}

.button-number {
  outline: none;
  height: 20px;
  width: 20px;
}

.trash-can:hover {
  color: #f03232;
}

.reset-value {
  justify-content: end;
  gap: 20px;
}

.reset-button {
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.total-value {
  border-radius: 20px;
  padding: 4px 24px 4px 24px;
}

.split-correct {
  background-color: #f2fff8;
  color: #0fb75c;
}

.split-error {
  background-color: #fff0f0;
  color: #f03232;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.add-icon {
  color: #0fb75c;
  font-size: 30px;
}
</style>
