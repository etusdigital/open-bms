<script setup lang="ts">
interface BmsDataLoaderProps {
  isLoading?: boolean;
  type?: string;
  height?: string;
  class?: string;
}

const props = defineProps<BmsDataLoaderProps>();
</script>

<template>
  <div v-if="props.isLoading">
    <v-skeleton-loader
      class="tw-mx-auto tw-rounded-2xl"
      :type="props.type"
      :height="props.height"
      :class="props.class"
      style="box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1)"
    >
    </v-skeleton-loader>
  </div>
</template>
