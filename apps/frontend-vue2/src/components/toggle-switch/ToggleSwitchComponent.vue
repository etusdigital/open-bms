<template>
  <label :class="['toggle-switch', size + '-label']">
    <input v-model="isChecked" type="checkbox" :class="[size + '-input']" @change="toggleSwitch" />
    <span class="slider" :class="[size + '-span']"></span>
  </label>
</template>

<script script lang="ts">
import { Component, Vue, Watch, Prop } from 'vue-property-decorator';

@Component({
  components: {},
  props: {
    value: {
      type: Number,
      required: true,
    },
  },
})
export default class ToggleSwitchComponent extends Vue {
  @Prop(String) private size!: string;
  @Prop(Number) private value!: number;

  isChecked!: boolean;

  beforeMount() {
    this.isChecked = this.value === 1;
  }

  toggleSwitch() {
    this.isChecked = this.isChecked;
    this.$emit('input', this.isChecked ? 1 : 0);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.toggle-switch {
  position: relative;
  display: inline-block;
  background-color: #ffffff;
  border-radius: 15px;
  overflow: hidden;
}

.small-label {
  width: 40px;
  height: 20px;
}

.small-label input:checked + .slider:before {
  transform: translateX(20px);
}

.small-span:before {
  height: 13px;
  width: 13px;
  left: 3px;
  bottom: 3px;
}

.large-label {
  width: 50px;
  height: 30px;
}

.large-label input:checked + .slider:before {
  transform: translateX(22px);
}

.large-span:before {
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 5px;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #bdbdbd;
  transition: 0.4s;
  border-radius: 15px;
}

.toggle-switch input:checked + .slider {
  background-color: #0057f4;
}

// .toggle-switch input:checked + .slider:before {
//   transform: translateX(20px);
// }

.slider:before {
  position: absolute;
  content: '';
  // height: 13px;
  // width: 13px;
  // left: 3px;
  // bottom: 2.5px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}
</style>
