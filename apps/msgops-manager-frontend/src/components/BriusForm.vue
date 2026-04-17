<script setup lang="ts">
interface BriusFormProps {
  onSubmit: (e?: Event | undefined) => Promise<Promise<void> | undefined>;
}

const props = defineProps<BriusFormProps>();
</script>

<template>
  <form class="tw-mb-4 tw-rounded tw-bg-white tw-px-8 tw-pt-6 tw-pb-8 tw-shadow-md" @submit.prevent="props.onSubmit">
    <slot></slot>
  </form>
</template>
