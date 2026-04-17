<template>
  <div class="c-cards">
    <router-view></router-view>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';
import { hasAccessToModule } from '@/store';
import { AccountDto } from '../accounts/dtos/account.dto';

@Component({
  computed: {
    ...mapState(['currentAccount']),
  },
})
export default class MessageModule extends Vue {
  public currentAccount!: AccountDto;

  title = '';

  buttonBack() {
    this.$router.back();
  }

  @Watch('currentAccount', { immediate: true, deep: true })
  @Watch('$route', { immediate: true })
  checkPermissions() {
    if (this.$route.path.includes('/email') && !hasAccessToModule(this.currentAccount, 'email_settings')) {
      this.$router.push('/access-denied');
    }

    if (this.$route.path.includes('/web-push') && !hasAccessToModule(this.currentAccount, 'webpush_settings')) {
      this.$router.push('/access-denied');
    }

    if (this.$route.path.includes('/sms') && !hasAccessToModule(this.currentAccount, 'sms_settings')) {
      this.$router.push('/access-denied');
    }

    if (this.$route.path.includes('/whatsapp') && !hasAccessToModule(this.currentAccount, 'whatsapp_settings')) {
      this.$router.push('/access-denied');
    }
  }
}
</script>
