<template>
  <div class="c-cards">
    <div class="col-12 title-button title-position mb-0 align-items-center">
      <div class="div-column">
        <router-link
          to="/contacts"
          class="clickable-breadcrumb"
          v-if="/\/([0-9]+)(?=[^\/]*$)/.test($route.path) || $route.path.includes('contacts/new')"
        >
          <span class="material-symbols-rounded ds-blue-color font-20">chevron_left</span>
          <span>{{ $t('sidebar.contacts') }}</span>
        </router-link>

        <h2 class="c-title pb-0 m-0">{{ title }}</h2>
      </div>
      <button
        v-if="listPath && $store.getters.can('audience:contacts_import')"
        class="v-btn-icon button-create"
        @click="$router.push('/contacts/new')"
      >
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="add-span">{{ $t('button.import').toString().toUpperCase() }}</span>
      </button>
      <button
        v-if="unsubscribe && $store.getters.can('audience:contacts_suppress')"
        class="v-btn-icon button-create"
        @click="toggleModalSuppression"
      >
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="add-span">{{ $t('button.unsubscribe').toString().toUpperCase() }}</span>
      </button>
      <button
        v-if="block && $store.getters.can('audience:contacts_suppress')"
        class="v-btn-icon button-create"
        @click="toggleModalSuppression"
      >
        <span class="material-symbols-rounded v-icon-plus"> add </span>
        <span class="add-span">{{ $t('button.block').toString().toUpperCase() }}</span>
      </button>
    </div>
    <router-view @contactName="setContactName"></router-view>
  </div>
</template>

<script lang="ts">
import ContactsService from '@/modules/contacts/services/contacts.service';
import ModalService from '@/services/modal.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { hasAccessToModule } from '@/store';
import { mapState } from 'vuex';
import { AccountDto } from '../accounts/dtos/account.dto';

@Component({
  components: {},
  computed: {
    ...mapState(['isSuperAdmin', 'currentAccount', 'isSuportUser']),
  },
})
export default class ContactsModule extends Vue {
  private readonly modalService = new ModalService();
  private readonly contactsService = new ContactsService();
  public isSuperAdmin!: boolean;
  public isSuportUser!: boolean;
  public currentAccount!: AccountDto;

  title = '';
  totalOfContacts = '<div class="loading-dot-flashing"></div>';
  listPath = true;
  unsubscribe = false;
  block = false;

  buttonBack() {
    this.$router.back();
  }

  beforeMount() {
    this.getPageTitle();
  }

  setContactName(contactName: string) {
    this.title = contactName;
  }

  @Watch('$route.path')
  async watchRoute(to: string, from: string) {
    this.getPageTitle();
  }

  toggleModalSuppression() {
    this.$store.commit('toggleModalSuppression');
  }

  getPageTitle() {
    if (this.$route.path.includes('contacts')) {
      this.unsubscribe = false;
      this.block = false;
      this.listPath = true;
      this.title = this.$t('sidebar.contacts') as string;
    }
    if (this.$route.path.includes('contacts/new')) {
      this.unsubscribe = false;
      this.block = false;
      this.listPath = false;
      this.title = this.$t('title.contactsImport') as string;
    }
    if (this.$route.path.includes('contacts/suppressions/unsubscribed')) {
      this.listPath = false;
      this.block = false;
      this.unsubscribe = true;
      this.title = this.$t('title.unsubscribe') as string;
    }
    if (this.$route.path.includes('contacts/suppressions/blocked')) {
      this.listPath = false;
      this.unsubscribe = false;
      this.block = true;
      this.title = this.$t('title.block') as string;
    }
    if (/\/([0-9]+)(?=[^\/]*$)/.test(this.$route.path)) {
      this.unsubscribe = false;
      this.listPath = false;
      this.title = this.$t('title.contactName') as string;
    }
  }

  @Watch('currentAccount', { immediate: true, deep: true })
  @Watch('$route', { immediate: true })
  checkPermissions() {
    if (
      ['/contacts/suppressions/unsubscribed', '/contacts/suppressions/blocked'].includes(this.$route.path) &&
      !this.$store.getters.can('audience:contacts_suppress')
    ) {
      this.$router.push('/access-denied');
    }
  }
}
</script>
