<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useForm, InvalidSubmissionHandler } from 'vee-validate';
import { useI18n } from 'vue-i18n';
import { BmsPageBase, BmsPageTitleWithPlusAction, BmsButton, BmsTextField } from '../../../components';
import { useAccountStore } from '../../../stores';
import { EditAccount, accountEditZodValidation } from '../../../entities/Account';
import { showToast } from '../../../utils/showToast';
import {  onBeforeUnmount } from 'vue'

const router = useRouter();
const { params } = useRoute();
const { t } = useI18n();

const { account, loading, error } = storeToRefs(useAccountStore());
const { fetchAccount, updateAccount, deleteAccount, setAccount } = useAccountStore();

if (params.id) {
  setAccount({ id: params.id });
  fetchAccount(Number(params.id)).then(() => {
    if (!account?.value) return;

    const formInitalValues = {
      id: account.value.id,
      name: account.value.name,
      description: account.value.description,
    };
    resetForm({ values: formInitalValues });
  });
}

const { handleSubmit, isSubmitting, resetForm } = useForm<EditAccount>({
  validationSchema: accountEditZodValidation,
});

const onInvalidSubmit: InvalidSubmissionHandler<EditAccount> = ({ errors }) => {
  showToast({ type: 'error', description: t('accountPage.error') });
  console.error(errors);
};

const onSubmit = handleSubmit(async (values, { resetForm }) => {
  if (!account?.value?.id) return;

  await updateAccount({ ...values, id: account.value.id });
  showToast({ type: 'success', description: t('accountPage.success') });
  resetForm();
  router.push({ name: 'accountsPage' });
}, onInvalidSubmit);

const onCancel = () => {
  router.back();
};

const onDelete = () => {
  if (!account?.value?.id) return;

  deleteAccount(account.value.id);
};

onBeforeUnmount(() => {
  setAccount(undefined);
});
</script>

<template>
  <BmsPageBase>
    <BmsPageTitleWithPlusAction>
      <template #subtitle>{{ $t('accountPage.accounts') }}</template>
      {{ $t('accountPage.editAccount').toLocaleLowerCase() }}
    </BmsPageTitleWithPlusAction>
    <p v-if="loading">{{ $t('accountPage.loadingAccount') }}</p>
    <p v-if="error">{{ error?.message }}</p>
    <div v-if="account">
      <form id="edit-account" @submit.prevent="onSubmit">
        <div
          class="tw-mb-[26px] tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-pb-1 tw-pt-5 tw-shadow-md"
        >
          <div class="tw-grid tw-grid-cols-1 tw-gap-1">
            <BmsTextField :value="account?.name" name="name" :label="$t('name')" type="text" />
            <BmsTextField
              :value="account?.description"
              name="description"
              :label="$t('accountPage.description')"
              type="text"
            />
          </div>
        </div>

        <div class="tw-flex tw-justify-end tw-gap-4">
          <BmsButton name="back-page" type="button" variant="secondary" :disabled="isSubmitting" @click="onCancel">
            {{ $t('cancel') }}
          </BmsButton>
          <BmsButton name="delete-account" type="button" variant="delete" :disabled="isSubmitting" @click="onDelete">
            {{ $t('delete') }}
          </BmsButton>
          <BmsButton name="edit-account" type="submit" :disabled="isSubmitting">{{ $t('save') }}</BmsButton>
        </div>
      </form>
    </div>
  </BmsPageBase>
</template>

<style scoped></style>
