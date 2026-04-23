<script setup lang="ts">
interface BmsFormProps {
  onSubmit: (e?: Event | undefined) => Promise<Promise<void> | undefined>;
}

const props = defineProps<BmsFormProps>();
</script>

<template>
  <form class="tw-mb-4 tw-rounded tw-bg-white tw-px-8 tw-pb-8 tw-pt-6 tw-shadow-md" @submit.prevent="props.onSubmit">
    <slot></slot>
  </form>
</template>
