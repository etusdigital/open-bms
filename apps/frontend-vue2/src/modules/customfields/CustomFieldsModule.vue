<template>
  <div class="c-cards">
    <div class="col-12 title-button title-position mb-0 align-items-center">
      <div class="div-column">
        <router-link
          to="/customfields"
          class="clickable-breadcrumb"
          v-if="/\/([0-9]+)(?=[^\/]*$)/.test($route.path) || $route.path.includes('customfields/new')"
        >
          <span class="material-symbols-rounded ds-blue-color font-20">chevron_left</span>
          <span>{{ $t('sidebar.customFields') }}</span>
        </router-link>

        <span class="font-24 pb-0 text-600 ds-gray-color m-0">{{ title }}</span>
      </div>
      <button
        v-if="listPath && $store.getters.can('audience:custom_fields_manage')"
        class="v-btn-icon button-create"
        @click="$router.push('/customfields/new')"
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

@Component({})
export default class CustomFieldsModule extends Vue {
  private readonly modalService = new ModalService();

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
    if (this.$route.path.includes('customfields')) {
      this.listPath = true;
      this.title = this.$t('sidebar.customFields') as string;
    }
    if (this.$route.path.includes('customfields/new')) {
      this.listPath = false;
      this.title = this.$t('title.registerField') as string;
    }
    if (/\/([0-9]+)(?=[^\/]*$)/.test(this.$route.path)) {
      this.listPath = false;
      this.title = this.$t('title.editField') as string;
    }
  }
}
</script>
