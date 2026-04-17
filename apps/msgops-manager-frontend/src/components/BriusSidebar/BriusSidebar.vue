<script setup lang="ts">
import type { Ref } from 'vue';
import { ref, computed } from 'vue';
import { ChevronForward, ChevronBack } from '@vicons/ionicons5';
import type { SidebarItem } from './BriusSidebar.types';
import BriusSidebarItem from './BriusSidebarItem.vue';
import { useUserStore } from '../../stores';

interface BriusSidebarProps {
  items: SidebarItem[];
  activeValue?: string;
}

const props = defineProps<BriusSidebarProps>();
const size: Ref<'small' | 'large'> = ref('small');
const userStore = useUserStore();

function toggleSidebarSize() {
  size.value = size.value === 'large' ? 'small' : 'large';
}

const visibleItems: any = computed(() => {
  return props.items.filter((item) => {
    if (!item.hideFromRoles) {
      return true;
    }
    return !item.hideFromRoles.some((role) => userStore.roles.includes(role));
  });
});
</script>

<template>
  <div
    class="tw-delay-20 tw-flex tw-h-[90vh] tw-w-[250px] tw-flex-col tw-rounded-2xl tw-bg-white tw-shadow-md tw-transition-all"
    :class="{ 'collapsed-sidebar': size === 'small' }"
  >
    <div class="tw-mb-2 tw-flex tw-h-16 tw-items-end tw-px-4 tw-py-2">
      <img class="logo" src="../../assets/brand-brius-sm.svg" alt="BMS - Brius Message System Logo" />
      <Transition
        enter-from-class="tw-translate-x-[100%] tw-opacity-0"
        leave-to-class="tw-translate-x-[100%] tw-opacity-0"
        enter-active-class="tw-transition tw-duration-500"
        leave-active-class="tw-transition tw-duration-0"
      >
        <p
          v-if="size === 'large'"
          class="tw-mt-3 tw-self-center tw-pl-4 tw-text-xs tw-font-semibold tw-tracking-wider tw-text-primary tw-transition tw-duration-150 tw-ease-out"
        >
          BMS ADMIN
        </p>
      </Transition>
    </div>
    <div class="tw-ml-4 tw-flex tw-flex-1 tw-flex-col">
      <BriusSidebarItem
        v-for="item in visibleItems"
        :key="item.value"
        :name="item.name"
        :icon="item.icon"
        :active="item.value === props.activeValue"
        :size="size"
        @click="item.clickMenuItem"
      />
    </div>
    <div v-if="size === 'small'" class="tw-flex tw-h-14 tw-pl-5 tw-align-middle tw-text-main-gray">
      <div class="tw-w-8" @click="toggleSidebarSize">
        <ChevronForward color="#5C5C5C" />
      </div>
    </div>
    <div v-else class="tw-flex tw-h-14 tw-pl-5 tw-align-middle tw-text-main-gray">
      <div class="tw-w-8" @click="toggleSidebarSize">
        <ChevronBack color="#5C5C5C" />
      </div>
    </div>
  </div>
</template>
