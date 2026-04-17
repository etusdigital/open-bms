<template>
  <div class="view-new-tag col-12 pt-0">
    <v-card class="background-card d-flex div-column gap-20 card-name-description">
      <InputDefault
        :name="`${$t('title.name')}`"
        data-cy="message-new-title"
        autofocus
        :modelValue="currentLabel.name"
        :placeholder="`${$t('input.labelName')}`"
        @updateInput="updateInput"
        :keyInput="'name'"
        max="40"
      />
      <InputDefault
        data-cy="message-new-description"
        autofocus
        max="255"
        :name="`${$t('create.description')}`"
        :modelValue="currentLabel.description"
        :placeholder="`${$t('input.labelDescription')}`"
        :keyInput="'description'"
        @updateInput="updateInput"
      />
    </v-card>
    <div class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="$router.push('/labels')"
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="currentLabel.id ? `${$t('button.save')}` : `${$t('button.create')}`"
        @click="buttonSave"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import LoadingService from '@/services/loading.service';
import { Component, Vue } from 'vue-property-decorator';
import ToastService from '@/services/toast.service';
import { LabelDto } from '../dtos/label.dto';
import LabelService from '../services/label.service';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';

@Component({
  components: { InputDefault, ButtonDefault },
  providers: [LoadingService, LabelService],
})
export default class LabelsCreateEdit extends Vue {
  private readonly labelService = new LabelService();
  private readonly toastService = new ToastService();

  currentLabel: LabelDto = {} as LabelDto;

  beforeMount() {
    this.getLabel();
  }

  async getLabel() {
    const labelId = +this.$route.params.label_id;
    if (labelId) {
      this.currentLabel = (await this.labelService.getLabelById(labelId))?.data;
    }
  }

  async newLabel() {
    return await this.labelService.createLabel(this.currentLabel);
  }

  async updateLabel(label: LabelDto) {
    return await this.labelService.updateLabel(label);
  }

  updateInput(event: never, key: keyof LabelDto) {
    this.currentLabel[key] = event;
  }

  async buttonSave() {
    let response;
    if (this.currentLabel && this.currentLabel.id) {
      response = await this.updateLabel(this.currentLabel);
    } else {
      response = await this.newLabel();
    }

    if (response && response.data && response.data.id) {
      this.toastService.show({
        type: 'success',
        text: this.$t('modal.labelSaved') as string,
      });

      this.$router.push(`/labels`);
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep.view-new-tag {
  width: 100%;
}
</style>
