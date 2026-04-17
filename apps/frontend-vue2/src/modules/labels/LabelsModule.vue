<template>
  <div v-if="currentAccount.isInternal" class="c-cards">
    <div class="col-12 title-button title-position mb-0 align-items-center">
      <div class="div-column">
        <router-link
          to="/labels"
          class="clickable-breadcrumb"
          v-if="/\/([0-9]+)(?=[^\/]*$)/.test($route.path) || $route.path.includes('labels/new')"
        >
          <span class="material-symbols-rounded ds-blue-color font-20">chevron_left</span>
          <span>{{ $t('sidebar.labels') }}</span>
        </router-link>

        <h2 class="c-title pb-0">{{ title }}</h2>
      </div>
      <button
        v-if="listPath && $store.getters.can('infra:manage')"
        class="v-btn-icon button-create"
        @click="$router.push('/labels/new')"
      >
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="add-span">{{ $t('button.create').toString().toUpperCase() }}</span>
      </button>
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';
import { AccountDto } from '../accounts/dtos/account.dto';

@Component({
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class LabelsModule extends Vue {
  private readonly modalService = new ModalService();
  public currentAccount!: AccountDto;

  title = '';
  listPath = true;

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
    if (this.$route.path.includes('labels')) {
      this.listPath = true;
      this.title = this.$t('sidebar.labels') as string;
    }
    if (this.$route.path.includes('labels/new')) {
      this.listPath = false;
      this.title = this.$t('title.registerLabel') as string;
    }
    if (/\/([0-9]+)(?=[^\/]*$)/.test(this.$route.path)) {
      this.listPath = false;
      this.title = this.$t('title.editLabel') as string;
    }
  }
}
</script>
