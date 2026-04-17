<template>
  <div class="c-cards">
    <h2 class="c-title pl-4 pb-0">{{ title }}</h2>
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';

@Component({})
export default class ProfileModule extends Vue {
  private readonly modalService = new ModalService();

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
    if (this.$route.path.includes('profile')) {
      this.title = this.$t('title.profile') as string;
    }
  }
}
</script>
