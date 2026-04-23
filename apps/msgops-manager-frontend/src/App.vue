<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth0 } from '@auth0/auth0-vue';
import { BmsHeader, BmsSidebar, BmsLoadingPage } from './components';
import { loginHttpGateway } from './gateways/Login';
import { useUserStore } from './stores';
import { User } from './entities/User';
import { useI18n } from 'vue-i18n';
import { routes } from './pages';
import { SidebarItem } from './components/BmsSidebar/BmsSidebar.types';
import router from './router';

const { isLoading, user: authUser } = useAuth0();

const { setUser } = useUserStore();
const { locale } = useI18n();
const location = useRoute();

const setLogin = ref(false);
const sidebarItems: SidebarItem[] = routes
  .filter((route) => route.icon && route.label)
  .map<SidebarItem>((route) => ({
    name: route.label as string,
    icon: route.icon,
    value: route.name as string,
    clickMenuItem: () => router.push(route.path),
    hideFromRoles: route.hideFromRoles || [],
  }));

// Only loads user data — redirect to Auth0 is handled entirely by the router guard
watch(authUser, async (newValue) => {
  if (!newValue) return;
  const req = {
    name: newValue.name ?? '',
    email: newValue.email ?? '',
    picture: newValue.picture ?? '',
  };
  const user: User = await loginHttpGateway.loginApi(req);
  locale.value = user.settings.language;
  setUser(user);
  setLogin.value = true;
});
</script>

<template>
  <router-view v-if="location.path.startsWith('/setup')" />

  <template v-else>
    <BmsHeader></BmsHeader>
    <div>
      <div v-if="isLoading">
        <BmsLoadingPage :is-loading="isLoading" />
      </div>
      <div v-else>
        <BmsLoadingPage v-if="!setLogin" :is-loading="!setLogin" />

        <div v-else>
          <div class="tw-mx-10 tw-grid tw-grid-cols-content">
            <BmsSidebar :items="sidebarItems" :active-value="location.name?.toString()"></BmsSidebar>
            <div class="tw-px-5">
              <router-view></router-view>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<style>
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #d9d9d9;
  border-radius: 8px;
}

::-webkit-scrollbar-thumb {
  background: #a6a6a6;
  border-radius: 8px;
}

::-webkit-scrollbar-thumb:hover {
  background: #818589;
}
</style>
