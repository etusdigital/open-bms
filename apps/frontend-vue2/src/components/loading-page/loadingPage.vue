<template>
  <div id="loadingScreen">
    <div :class="{ loader: true }">
      <div class="user-welcome">
        <svg width="100" height="100" viewBox="-126 -126 252 252" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="0" cy="0" r="8.5" :stroke="color" stroke-width="5" :fill="color" class="circle-3" />
          <circle cx="0" cy="0" r="72" :stroke="color" stroke-width="25" class="circle-2" />
          <circle cx="115" cy="0" r="8.5" :stroke="color" stroke-width="5" :fill="color" class="brius-animated-logo" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'LoadingScreen',
  props: ['isLoading', 'color'],
};
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/animations.scss';

.loader {
  background-color: $ds-blue;
  bottom: 0;
  color: white;
  display: block;
  font-size: 24px;
  left: 0;
  overflow: hidden;
  padding-top: 20vh;
  position: fixed;
  right: 0;
  text-align: center;
  top: 0;
}

.brius-animated-logo {
  width: 10%;
  animation: brius-logo-rotate 6s infinite;
}

.user-welcome {
  padding-top: 6.5em;
  display: flex;
  align-items: center;
  flex-direction: column;
}

.username {
  margin-top: 5rem;
}

.fadeout {
  animation: fadeout 4s forwards;
}

@keyframes brius-logo-rotate {
  0% {
    cx: 115;
    transform: none;
  }
  50% {
    cx: 115;
    transform: rotate(360deg);
  }
  75% {
    cx: 0;
    transform: rotate(360deg);
  }
  100% {
    cx: 115;
    transform: rotate(360deg);
  }
}
</style>
