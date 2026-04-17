<template>
  <div v-if="$store.getters.can('infra:view')" class="c-cards">
    <div class="col-12 title-button title-position mb-0 align-items-center">
      <div class="div-column">
        <router-link
          to="/pools"
          class="clickable-breadcrumb"
          v-if="/\/([0-9]+)(?=[^\/]*$)/.test($route.path) || $route.path.includes('pools/new')"
        >
          <span class="material-symbols-rounded ds-blue-color font-20">chevron_left</span>
          <span>{{ $t('sidebar.pools') }}</span>
        </router-link>

        <h2 class="c-title pb-0 m-0">{{ title }}</h2>
      </div>

      <button
        v-if="listPath && $store.getters.can('infra:manage')"
        class="v-btn-icon button-create"
        @click="$router.push('/pools/new')"
      >
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="add-span">{{ $t('button.create').toString().toUpperCase() }}</span>
      </button>
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';

@Component({
  computed: {
    ...mapState(['isSuperAdmin']),
  },
})
export default class PoolsModule extends Vue {
  public isSuperAdmin!: boolean;
  title = '';
  listPath = true;

  buttonBack() {
    this.$router.back();
  }

  @Watch('$route.path')
  beforeMount() {
    this.getPageTitle();
  }

  @Watch('$route.path')
  async watchRoute(to: string, from: string) {
    this.getPageTitle();
  }

  getPageTitle() {
    if (this.$route.path.includes('pools')) {
      this.listPath = true;
      this.title = this.$t('sidebar.pools') as string;
    }
    if (this.$route.path.includes('pools/new')) {
      this.listPath = false;
      this.title = this.$t('button.newPool') as string;
    }
    if (/\/([0-9]+)(?=[^\/]*$)/.test(this.$route.path)) {
      this.listPath = false;
      this.title = this.$t('title.editPool') as string;
    }
  }
}
</script>
