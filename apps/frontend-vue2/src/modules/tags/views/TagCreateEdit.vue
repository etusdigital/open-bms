<template>
  <div class="view-new-tag col-12 pt-0">
    <v-card class="background-card d-flex div-column gap-20 card-name-description">
      <InputDefault
        :name="`${$t('title.name')}`"
        data-cy="message-new-title"
        autofocus
        :modelValue="currentTag.name"
        :placeholder="`${$t('input.tagName')}`"
        @updateInput="updateInput"
        :keyInput="'name'"
        max="40"
      />
      <InputDefault
        data-cy="message-new-description"
        autofocus
        max="255"
        :name="`${$t('create.description')}`"
        :modelValue="currentTag.description"
        :placeholder="`${$t('input.tagDescription')}`"
        :keyInput="'description'"
        @updateInput="updateInput"
      />
    </v-card>
    <div class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="$router.push('/tags')"
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="`${$t('button.create')}`"
        @click="buttonSave"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
      />
    </div>
  </div>
</template>

<script script lang="ts">
import ServicesService from '@/modules/messages/services/services.service';
import LoadingService from '@/services/loading.service';
import { Component, Vue } from 'vue-property-decorator';
import ToastService from '@/services/toast.service';
import { TagDto } from '../dtos/tag.dto';
import TagService from '../services/tag.service';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';

@Component({
  components: { InputDefault, ButtonDefault },
  providers: [LoadingService, ServicesService],
})
export default class TagsCreateEdit extends Vue {
  private readonly accountService = new TagService();
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();

  currentTag: TagDto = {} as TagDto;

  beforeMount() {
    this.getTag();
  }

  async getTag() {
    const accountId = +this.$route.params.account_id;
    if (accountId) {
      this.currentTag = (await this.accountService.getTagById(accountId))?.data;
    }
  }

  async newTag() {
    return await this.accountService.createTag(this.currentTag);
  }

  async updateTag(id: number) {
    return await this.accountService.updateTag(id, this.currentTag);
  }

  updateInput(event: never, key: keyof TagDto) {
    this.currentTag[key] = event;
  }

  async buttonSave() {
    let response;
    if (this.currentTag && this.currentTag.id) {
      response = await this.updateTag(this.currentTag.id);
    } else {
      response = await this.newTag();
    }

    if (response && response.data && response.data.id) {
      this.toastService.show({
        type: 'success',
        text: this.$t('modal.tagSaved') as string,
      });

      this.$router.push(`/tags`);
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep.view-new-tag {
  width: 100%;
}
</style>
