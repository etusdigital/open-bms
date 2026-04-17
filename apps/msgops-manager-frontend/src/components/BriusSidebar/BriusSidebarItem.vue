<script setup lang="ts">
export type BriusSidebarItemProps = {
  name: string;
  icon: unknown;
  active?: boolean;
  size: 'small' | 'large';
  hideFromRoles?: string[];
};

const props = defineProps<BriusSidebarItemProps>();
</script>

<template>
  <div
    class="tw-my-1 tw-flex tw-h-9 tw-cursor-pointer tw-items-center tw-gap-3 tw-rounded-lg tw-px-3 tw-py-1 tw-align-middle hover:tw-bg-gray-light hover:tw-transition-colors"
  >
    <component
      :is="props.icon"
      class="tw-h-5 tw-w-5 tw-text-main-gray tw-transition-colors tw-delay-100 tw-ease-in-out"
      :class="{ 'sidebar-item-active': active }"
    />
    <span
      v-if="size === 'large'"
      class="tw-text-sm tw-capitalize tw-text-main-gray tw-transition-colors tw-delay-100 tw-ease-in-out"
      :class="{ 'sidebar-item-active': active }"
    >
      {{ props.name.toLocaleLowerCase() }}
    </span>
    <v-tooltip v-else activator="parent" location="start">{{ props.name }}</v-tooltip>
  </div>
</template>
