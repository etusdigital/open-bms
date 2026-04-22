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
      <span class="tw-text-primary tw-text-sm tw-font-semibold tw-tracking-widest"><slot name="subtitle"></slot></span>
      <span class="tw-capitalize tw-title tw-text-2xl tw-font-semibold tw-text-main-gray tw-tracking-wider" ><slot></slot></span>
    </div>
    <button
      v-if="props.onClickPlus"
      class="tw-capitalize tw-flex tw-items-center -tw-mt-1 tw-p-1 tw-rounded-full tw-w-fit tw-bg-primary tw-group"
      type="button"
      @click="props.onClickPlus"
      @mouseover="isHovering = true"
      @mouseleave="isHovering = false"
    >
      <div class="tw-w-5 tw-h-5 tw-transition tw-duration-500 tw-ease-in-out" :class="{ expanded: isHovering }">
        <AddOutline color="white"/>
      </div>
      <Transition
        enter-from-class="tw-translate-x-[100%] tw-opacity-0"
        leave-to-class="tw-translate-x-[100%] tw-opacity-0"
        enter-active-class="tw-transition tw-duration-500"
        leave-active-class="tw-transition tw-duration-300"
      >
        <p v-if="isHovering" class="hover:tw-transition hover:tw-duration-150 hover:tw-ease-out tw-text-white tw-text-xs tw-px-1">{{$t('create').toLocaleLowerCase()}}</p>
      </Transition>
    </button>
  </div>
</template>

<style scoped></style>
