<script setup lang="ts">
const props = defineProps({ isLoading: Boolean });
</script>

<template>
  <div id="app">
    <div :class="{ loader: true, fadeout: props.isLoading }">
      <div class="user-welcome">
        <svg width="100" height="100" viewBox="-126 -126 252 252" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="0" cy="0" r="8.5" stroke="white" stroke-width="5" fill="white" class="circle-3" />
          <circle cx="0" cy="0" r="72" stroke="white" stroke-width="25" class="circle-2" />
          <circle cx="115" cy="0" r="8.5" stroke="white" stroke-width="5" fill="white" class="bms-animated-logo" />
        </svg>
      </div>
    </div>
  </div>
</template>

<style></style>
