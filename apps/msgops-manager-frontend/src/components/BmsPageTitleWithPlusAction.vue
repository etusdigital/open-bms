<script setup lang="ts">
import { ref } from 'vue';
import { AddOutline } from '@vicons/ionicons5';

interface BmsPageTitleWithPlusActionProps {
  onClickPlus?: (event: MouseEvent) => void;
}

const isHovering = ref(false);

const props = defineProps<BmsPageTitleWithPlusActionProps>();
</script>

<template>
  <div class="tw-flex tw-items-center tw-gap-2 tw-pb-2">
    <div class="tw-flex tw-flex-col">
      <span class="tw-text-sm tw-font-semibold tw-tracking-widest tw-text-primary"><slot name="subtitle"></slot></span>
      <span class="tw-title tw-text-2xl tw-font-semibold tw-capitalize tw-tracking-wider tw-text-main-gray"
        ><slot></slot
      ></span>
    </div>
    <button
      v-if="props.onClickPlus"
      class="tw-group -tw-mt-1 tw-flex tw-w-fit tw-items-center tw-rounded-full tw-bg-primary tw-p-1 tw-capitalize"
      type="button"
      @click="props.onClickPlus"
      @mouseover="isHovering = true"
      @mouseleave="isHovering = false"
    >
      <div class="tw-h-5 tw-w-5 tw-transition tw-duration-500 tw-ease-in-out" :class="{ expanded: isHovering }">
        <AddOutline color="white" />
      </div>
      <Transition
        enter-from-class="tw-translate-x-[100%] tw-opacity-0"
        leave-to-class="tw-translate-x-[100%] tw-opacity-0"
        enter-active-class="tw-transition tw-duration-500"
        leave-active-class="tw-transition tw-duration-300"
      >
        <p
          v-if="isHovering"
          class="tw-px-1 tw-text-xs tw-text-white hover:tw-transition hover:tw-duration-150 hover:tw-ease-out"
        >
          {{ $t('create').toLocaleLowerCase() }}
        </p>
      </Transition>
    </button>
  </div>
</template>

<style scoped></style>
