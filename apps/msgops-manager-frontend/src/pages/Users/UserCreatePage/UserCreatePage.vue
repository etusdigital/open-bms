<script setup lang="ts">
import { ref } from 'vue';
import { InvalidSubmissionHandler, useForm } from 'vee-validate';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { BriusPageBase, BriusPageTitleWithPlusAction, BriusButton, BriusTextField } from '../../../components';
import { TrashOutline } from '@vicons/ionicons5';
import { useUserStore, useAccountStore } from '../../../stores';
import { CreateUser, userCreateZodValidation } from '../../../entities/User';
import { showToast } from '../../../utils/showToast';
import { computed } from 'vue';

export type AccountObject = {
  accountId: number | null;
  isMasterUser: boolean;
};

const { accounts, loading: accountsLoading } = storeToRefs(useAccountStore());

const { fetchAccounts } = useAccountStore();
const { createUser } = useUserStore();

const router = useRouter();
const { t } = useI18n();

const accountsList = computed(() => {
  return Array.isArray(accounts.value) ? accounts.value : accounts.value.results;
});

if (!accountsList.value || !accountsList.value.length) {
  fetchAccounts({ itemsPerPage: 10000 });
}

let id = 0;
const accountFields = ref([{ accountId: null, isAdmin: false, id: id }]);
const permissions = [
  { name: t('admin'), value: true },
  { name: t('collaborator'), value: false },
];

const formValues: CreateUser = { accounts: [], email: '', name: '', password: 'P@$$w0Rd' };

const { handleSubmit, isSubmitting } = useForm({
  initialValues: formValues,
  validationSchema: userCreateZodValidation,
});

const onInvalidSubmit: InvalidSubmissionHandler<CreateUser> = ({ errors }) => {
  showToast({ type: 'error', description: t('userPage.error') });
  console.error(errors);
};

const onSubmit = handleSubmit(async (values, { resetForm }) => {
  const accounts: AccountObject[] = [];

  accountFields.value.map((item) => {
    accounts.push({ accountId: item.accountId, isMasterUser: item.isAdmin });
  });

  const hasNull = (el: AccountObject) => {
    return el.accountId === null;
  };

  if (accounts.some(hasNull)) {
    showToast({ type: 'error', description: t('accountRequired') });
    return;
  }

  await createUser({ ...values, accounts: accounts });
  showToast({ type: 'success', description: t('userPage.success') });
  resetForm();
  router.push({ name: 'usersPage' });
}, onInvalidSubmit);

const onCancel = () => {
  router.back();
};

const handleAddRow = () => {
  id++;
  accountFields.value.push({
    accountId: null,
    isAdmin: false,
    id: id,
  });
};

const handleDeleteRow = (index: number) => {
  if (index === 0) showToast({ type: 'error', description: t('accountRequired') });
  else accountFields.value.splice(index, 1);
};
</script>

<template>
  <BriusPageBase>
    <div>
      <BriusPageTitleWithPlusAction>
        <template #subtitle>{{ $t('userPage.users') }}</template>
        {{ $t('userPage.addUser').toLocaleLowerCase() }}
      </BriusPageTitleWithPlusAction>
    </div>
    <form id="create-user" @submit.prevent="onSubmit">
      <p class="tw-mt-4 tw-font-semibold tw-text-main-gray">{{ $t('information') }}</p>
      <div
        class="tw-mb-[26px] tw-mt-2 tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-pt-5 tw-shadow-md"
      >
        <div class="tw-grid tw-grid-cols-4 tw-gap-4">
          <BriusTextField name="name" :label="$t('name')" :placeholder="$t('typeHere')" type="text" />
          <BriusTextField name="email" :label="$t('email')" :placeholder="$t('typeHere')" type="email" />
          <BriusTextField
            :password="true"
            name="password"
            :label="$t('userPage.password')"
            type="text"
            characters="a-z,A-Z,0-9,#"
            :size="16"
          />
        </div>
      </div>

      <p class="tw-mt-4 tw-font-semibold tw-text-main-gray">{{ $t('access') }}</p>
      <div
        class="tw-mb-[26px] tw-mt-2 tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-py-5 tw-shadow-md"
      >
        <div v-for="(row, i) in accountFields" :key="row.id">
          <div class="tw-grid tw-grid-cols-[46%_46%_4%] tw-gap-4">
            <div>
              <label class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray" :for="'accountsId' + row.id">{{
                $t('account')
              }}</label>
              <v-autocomplete
                :id="'accountsId' + row.id"
                v-model="accountFields[i]['accountId']"
                :name="'accountsId' + row.id"
                :items="accountsList"
                :loading="accountsLoading"
                item-title="name"
                item-value="id"
                :label="$t('select')"
                variant="solo"
              />
            </div>

            <div>
              <label class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray" :for="'permission' + row.id">{{
                $t('permission')
              }}</label>
              <v-select
                :id="'permission' + row.id"
                v-model="accountFields[i]['isAdmin']"
                :name="'permission' + row.id"
                :items="permissions"
                item-title="name"
                item-value="value"
                :label="$t('select')"
                variant="solo"
              />
            </div>
            <TrashOutline
              class="tw-h-5 tw-w-5 tw-cursor-pointer tw-self-center tw-text-gray-light"
              @click="handleDeleteRow(i)"
            />
          </div>
        </div>
        <BriusButton name="back-page" type="button" variant="primary" :disabled="isSubmitting" @click="handleAddRow()">
          {{ $t('addNewAccount') }}
        </BriusButton>
      </div>

      <div class="tw-flex tw-justify-end tw-gap-4">
        <BriusButton name="back-page" type="button" variant="secondary" :disabled="isSubmitting" @click="onCancel">
          {{ $t('cancel') }}
        </BriusButton>
        <BriusButton name="create-user" type="submit" :disabled="isSubmitting">{{
          $t('userPage.addAndInvite')
        }}</BriusButton>
      </div>
    </form>
  </BriusPageBase>
</template>

<style scoped></style>
