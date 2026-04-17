<template>
  <div class="c-cards">
    <h2 class="c-title pl-4 pb-0">{{ title }}</h2>
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';

@Component({})
export default class SettingsModule extends Vue {
  title = '';

  buttonBack() {
    this.$router.back();
  }

  beforeMount() {
    this.getPageTitle();
  }

  @Watch('$route.path')
  async watchRoute(to: string, from: string) {
    this.getPageTitle();
  }

  getPageTitle() {
    if (this.$route.path.includes('settings')) {
      this.title = this.$t('title.settings') as string;
    }
  }
}
</script>
