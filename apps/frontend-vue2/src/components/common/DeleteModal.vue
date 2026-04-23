<template>
  <v-dialog v-model="openModal" class="d-flex align-items-center">
    <div class="delete-modal div-column gap-15">
      <div class="div-row justify-space-between align-items-center">
        <span class="text-600 font-14 ds-gray-color">{{ $t('input.deleteOptions') }}</span>
        <span class="material-symbols-rounded ds-light-gray-color icon-active cursor-pointer" @click="closeModal">
          close
        </span>
      </div>
      <div class="div-column gap-10">
        <div
          class="div-row gap-5 align-items-normal"
          v-for="(choice, index) in removeChoices[type]"
          :key="`${stepId}-${index}-choice`"
        >
          <input
            type="radio"
            class="cursor-pointer"
            :key="`choice-${stepId}-${index}`"
            :id="`choice-${stepId}-${choice.type}`"
            :checked="index === selectedChoiceIndex"
            :value="choice.type"
            v-model="selectedChoice"
          />
          <label
            :for="`choice-${stepId}-${choice.type}`"
            class="mb-0 font-12 ds-gray-color cursor-pointer"
            :class="{ 'ds-blue-color text-600': index === selectedChoiceIndex }"
          >
            {{ choice.title }}
          </label>
        </div>
      </div>
      <div class="div-row gap-15 align-self-end align-items-center">
        <button @click="closeModal" class="d-flex align-items-center">
          <span class="font-10 ds-blue-color text-600 text-uppercase">{{ $t('button.cancel') }}</span>
        </button>
        <button class="delete-button d-flex align-items-center" @click="deleteChoice">
          <span class="font-10 text-uppercase text-600">{{ $t('button.confirm') }}</span>
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

@Component({
  props: ['openModal', 'stepId', 'type', 'branches'],
})
export default class DeleteModal extends Vue {
  @Prop() openModal!: boolean;
  @Prop() stepId!: number;
  @Prop() type!: string;
  @Prop() branches!: any;

  selectedChoiceIndex = 0;
  removeChoices: {
    conditional: { title: string; type: number | string }[];
    split: { title: string; type: number | string }[];
    [key: string]: { title: string; type: number | string }[];
  } = {
    conditional: [
      { title: this.$t('input.keepYes') as string, type: 'keepYes' },
      { title: this.$t('input.keepNo') as string, type: 'keepNo' },
      { title: this.$t('input.removeBoth') as string, type: 'removeBoth' },
    ],
    split: [] as { title: string; type: number | string }[],
  };
  selectedChoice: number | string = 0;

  @Watch('type', { immediate: true, deep: true })
  checkType() {
    this.removeChoices.split = [];
    if (this.type === 'split') {
      Object.entries(this.branches).forEach(([key, value], index) => {
        const branchLetter = String.fromCharCode(65 + index);
        const branchName = `${branchLetter}: ${value}%`;
        this.removeChoices.split.push({
          title: this.$t('input.branchRemove', { path: branchName }) as string,
          type: index,
        });
      });

      this.removeChoices.split.push({
        title: this.$t('input.removeSplit') as string,
        type: 'removeAll',
      });
    }
    if (this.removeChoices[this.type]?.length > 0) {
      this.selectedChoice = this.removeChoices[this.type][0].type;
    }
  }

  @Watch('selectedChoice')
  checkIndex() {
    this.selectedChoiceIndex = this.removeChoices[this.type].findIndex(
      (item: any) => item.type === this.selectedChoice
    );
  }

  closeModal() {
    this.$emit('closeModal', false);
  }

  deleteChoice() {
    this.$emit('deleteChoice', this.stepId, this.selectedChoice, this.type);
    this.closeModal();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.delete-modal {
  align-self: center;
  width: 500px;
  min-height: 100px;
  background-color: $neutral-basic-white;
  border-radius: 16px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.delete-button {
  height: 26px;
  background-color: $ds-blue;
  border-radius: 8px;
  color: $neutral-basic-white;
  padding: 8px 10px 8px 10px;
}

::v-deep .v-dialog {
  box-shadow: none;
  border-radius: 16px !important;
  display: flex;
  justify-content: center;
}
</style>
