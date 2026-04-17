<template>
  <div class="access-denied">
    <span class="material-symbols-rounded denied-icon"> lock </span>
    <h1>{{ $t('alert.accessDenied') }}</h1>
    <h3>{{ $t('alert.dontHavePermission') }}</h3>
  </div>
</template>

<script script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class AccessDenied extends Vue {}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.access-denied {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 75vh;

  h1 {
    font-size: 16px;
    font-weight: bold;
    color: $ds-gray;
  }

  h3 {
    font-size: 14px;
    color: $ds-gray;
  }
}

.denied-icon {
  color: $ds-gray !important;
  font-size: 76px !important;
  margin-bottom: 12px;
}
</style>
