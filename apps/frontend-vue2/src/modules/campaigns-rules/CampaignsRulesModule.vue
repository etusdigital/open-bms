<template>
  <div class="c-cards">
    <div v-if="listPath" class="col-12 title-button title-position mb-0 align-items-center">
      <div class="div-column">
        <h2 class="c-title pb-0">{{ title }}</h2>
      </div>
      <button v-if="$store.getters.can('infra:manage')" class="v-btn-icon button-create" @click="redirectToCreate()">
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
export default class CampaignsRulesModule extends Vue {
  private readonly modalService = new ModalService();
  public currentAccount!: AccountDto;

  title = '';
  listPath = false;

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

  redirectToCreate() {
    this.$route.path === '/campaign-rules-configs'
      ? this.$router.push('/campaign-rules-configs/new')
      : this.$router.push('/campaign-rules/new');
  }

  getPageTitle() {
    this.listPath = false;
    if (['/campaign-rules-configs', '/campaign-rules'].includes(this.$route.path)) {
      this.listPath = true;
      this.title =
        this.$route.path === '/campaign-rules-configs'
          ? (this.$t('sidebar.campaignConfigs') as string)
          : (this.$t('sidebar.campaignRules') as string);
    }
  }

  @Watch('$route', { immediate: true })
  checkPermissions() {
    if (!this.currentAccount.isInternal) {
      this.$router.push('/access-denied');
    }
  }
}
</script>
