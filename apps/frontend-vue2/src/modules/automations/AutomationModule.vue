<template>
  <div class="c-cards">
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class AutomationModule extends Vue {
  title = '';

  buttonBack() {
    this.$router.back();
  }
}
</script>
