<template>
  <div class="c-cards">
    <div class="col-12 title-button title-position mb-0">
      <div class="div-column">
        <h2 class="c-title pb-0">{{ title }}</h2>
      </div>
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';

@Component({})
export default class ProductModule extends Vue {
  title = '';
  listPath = true;

  beforeMount() {
    this.getPageTitle();
  }

  @Watch('$route.path')
  async watchRoute(to: string, from: string) {
    this.getPageTitle();
  }

  getPageTitle() {
    if (this.$route.path.includes('/product')) {
      this.listPath = true;
      this.title = this.$t('title.products') as string;
    }
  }
}
</script>
