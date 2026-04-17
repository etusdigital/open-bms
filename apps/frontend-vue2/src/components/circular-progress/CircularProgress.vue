<template>
  <div class="wrapper">
    <svg fill="none" width="24" height="24" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="gradient" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#7B61FF">
            <animate
              attributeName="stop-color"
              values="#7B61FF; #D0C9F8; #7B61FF"
              dur="2s"
              repeatCount="indefinite"
            ></animate>
          </stop>
          <stop offset="50%" stop-color="#7B61FF">
            <animate
              attributeName="stop-color"
              values="#7B61FF; #D0C9F8; #7B61FF"
              dur="2s"
              repeatCount="indefinite"
            ></animate>
          </stop>
          <stop offset="100%" stop-color="#D0C9F8">
            <animate
              attributeName="stop-color"
              values="#D0C9F8; #7B61FF; #D0C9F8"
              dur="2s"
              repeatCount="indefinite"
            ></animate>
          </stop>
        </linearGradient>
      </defs>
      <circle cx="100" cy="93" r="88" fill="transparent" stroke="#D0C9F8" stroke-width="25px"></circle>
      <circle
        cx="100"
        cy="93"
        r="88"
        stroke-dasharray="540"
        :stroke-dashoffset="540 - (540 * (Number(progress) || 0)) / 100"
        stroke-width="25"
        stroke="url('#gradient')"
        fill="none"
      >
        <!-- color animation here
        <animate attributeName="stroke" values="#7B61FF;#D0C9F8;#7B61FF" dur="2s" repeatCount="indefinite" /> -->
        <!-- spinning animation here
        <animate attributeName="stroke-dasharray" :from="teste" :to="teste2" dur="8s" repeatCount="indefinite" /> -->
      </circle>
    </svg>
    <!-- <span>{{ progress || 0 }}%</span> -->
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';

@Component
export default class CircularProgress extends Vue {
  @Prop() public progress!: string;
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.wrapper {
  position: relative;
  max-height: 24px;
  max-width: 24px;
  margin-left: 32%;
}

svg circle {
  width: 100%;
  height: 100%;
  stroke-linecap: round;
  transform: translateX(7px) rotate(-90deg);
  transform-origin: center;
}

span {
  color: #7b61ff;
  font-size: 8px;
  position: absolute;
  top: 4px;
  left: 5px;
}
</style>
