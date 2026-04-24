<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const { logout, isAuthenticated, user } = useAuth();
const router = useRouter();

const msgopsUrl = import.meta.env.VITE_APP_REDIRECT_MSGOPS;

const handleLogout = async () => {
  await logout();
  router.push({ name: 'login' });
};
</script>

<template>
  <div class="tw-flex tw-w-full tw-items-center tw-p-2.5">
    <div class="tw-flex-1"></div>
    <div class="tw-flex tw-flex-1 tw-justify-end">
      <button class="tw-btn"></button>
      <v-menu v-if="isAuthenticated">
        <template #activator="{ props }">
          <v-btn name="menu" size="small" v-bind="props" icon="mdi-dots-vertical" variant="text" />
        </template>
        <v-list density="comfortable">
          <v-list-item>
            <v-list-item :prepend-avatar="user?.picture || undefined" :title="user?.name" :subtitle="user?.email" />
          </v-list-item>
          <v-divider></v-divider>
          <v-list-item active-color="primary" :href="msgopsUrl">
            <v-list-item-title>MsgOps</v-list-item-title>
          </v-list-item>
          <v-list-item active-color="primary" @click="handleLogout">
            <template #prepend>
              <v-icon icon="mdi-logout"></v-icon>
            </template>
            <v-list-item-title>Logout</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>
  </div>
</template>

<style scoped></style>
