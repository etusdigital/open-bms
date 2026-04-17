<template>
  <div class="c-cards">
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';
import { hasAccessToModule } from '@/store';
import { AccountDto } from '../accounts/dtos/account.dto';

@Component({
  computed: {
    ...mapState(['currentAccount', 'isSuperAdmin']),
  },
})
export default class DashboardModule extends Vue {
  private readonly modalService = new ModalService();
  public currentAccount!: AccountDto;
  public isSuperAdmin!: boolean;

  @Watch('currentAccount', { immediate: true, deep: true })
  @Watch('$route', { immediate: true })
  checkPermissions() {
    if (this.$route.path.includes('/email') && !hasAccessToModule(this.currentAccount, 'email_settings')) {
      this.$router.push('/access-denied');
    }

    if (this.$route.path.includes('/web-push') && !hasAccessToModule(this.currentAccount, 'webpush_settings')) {
      this.$router.push('/access-denied');
    }
    if (this.$route.path === '/leads' && !this.currentAccount.isInternal) {
      this.$router.push('/access-denied');
    }
  }
}
</script>
