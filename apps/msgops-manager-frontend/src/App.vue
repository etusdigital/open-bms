<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { BmsHeader, BmsSidebar, BmsLoadingPage } from './components';
import { userHttpGateway } from './gateways/User';
import { useUserStore } from './stores';
import { useI18n } from 'vue-i18n';
import { routes } from './pages';
import { SidebarItem } from './components/BmsSidebar/BmsSidebar.types';
import { useAuth } from './composables/useAuth';
import router from './router';

const { isAuthenticated, isLoading, user: authUser } = useAuth();
const userStore = useUserStore();
const { locale } = useI18n();
const location = useRoute();

const setLogin = ref(false);
const isPublicRoute = computed(() => Boolean((location.meta as Record<string, unknown>)?.public));
const sidebarItems: SidebarItem[] = routes
  .filter((route) => route.icon && route.label)
  .map<SidebarItem>((route) => ({
    name: route.label as string,
    icon: route.icon,
    value: route.name as string,
    clickMenuItem: () => router.push(route.path),
    hideFromRoles: route.hideFromRoles || [],
  }));

watch(
  authUser,
  async (newValue) => {
    if (isAuthenticated.value && newValue) {
      try {
        const me: any = await userHttpGateway.getMe();
        userStore.setAuthContext(me);
        if (me?.settings?.language) {
          locale.value = me.settings.language;
        }
        setLogin.value = true;
      } catch (err) {
        console.error('Could not hydrate user context', err);
      }
    } else {
      setLogin.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <router-view v-if="isPublicRoute" />
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
