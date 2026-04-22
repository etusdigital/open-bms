<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useForm, InvalidSubmissionHandler } from 'vee-validate';
import { useI18n } from 'vue-i18n';
import { TrashOutline } from '@vicons/ionicons5';
import { BmsPageBase, BmsPageTitleWithPlusAction, BmsButton, BmsTextField } from '../../../components';
import { useAccountStore, useUserStore } from '../../../stores';
import { EditUser, userEditZodValidation } from '../../../entities/User';
import { dateFormatter } from '../../../utils';
import { showToast } from '../../../utils/showToast';
import { AccountObject } from '../UserCreatePage/UserCreatePage.vue';
import { computed } from 'vue';

type AccountFieldItem = {
  id: number;
  accountId: number | null;
  isAdmin: boolean;
};

const router = useRouter();
const { t } = useI18n();
const { params } = useRoute();
const { userEdit, loading, error } = storeToRefs(useUserStore());
const { fetchUser, updateUser, deleteUser } = useUserStore();

const { accounts, loading: accountsLoading } = storeToRefs(useAccountStore());
const { fetchAccounts } = useAccountStore();

const accountsList = computed(() => {
  return Array.isArray(accounts.value) ? accounts.value : accounts.value.results;
});

fetchAccounts({ itemsPerPage: 10000 });

onMounted(async () => {
  if (params.id) {
    fetchUser(Number(params.id)).then(() => {
      if (!userEdit?.value) return;

      userEdit.value.userAccount.map((i) => {
        accountFields.value.push({ accountId: i.accountId, isAdmin: i.isMasterUser, id: id });
        id++;
      });
      const formInitalValues = {
        id: userEdit.value.id,
        name: userEdit.value.name,
        email: userEdit.value.email,
        createdAt: userEdit.value.createdAt,
        accounts: [],
      };
      resetForm({ values: formInitalValues });
    });
  }
});

let id = 0;
const accountFields = ref<AccountFieldItem[]>([]);
const permissions = [
  { name: t('admin'), value: true },
  { name: t('collaborator'), value: false },
];

const { handleSubmit, isSubmitting, resetForm } = useForm<EditUser>({
  validationSchema: userEditZodValidation,
});

const onInvalidSubmit: InvalidSubmissionHandler<EditUser> = ({ errors }) => {
  showToast({ type: 'error', description: t('userPage.error') });
  console.error(errors);
};

const onSubmit = handleSubmit(async (values, { resetForm }) => {
  if (!userEdit?.value?.id) return;
  const accounts: AccountObject[] = [];

  accountFields.value.map((item: AccountFieldItem) => {
    accounts.push({ accountId: item.accountId, isMasterUser: item.isAdmin });
  });

  const hasNull = (el: AccountObject) => {
    return el.accountId === null;
  };

  if (accounts.some(hasNull)) {
    showToast({ type: 'error', description: t('accountRequired') });
    return;
  }
  await updateUser({ ...values, id: userEdit.value.id, accounts: accounts });
  showToast({ type: 'success', description: t('userPage.success') });
  resetForm();
  router.push({ name: 'usersPage' });
}, onInvalidSubmit);

const onCancel = () => {
  router.back();
};

const onDelete = () => {
  if (!userEdit?.value?.id) return;

  deleteUser(userEdit.value.id);
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
  <BmsPageBase>
    <div>
      <BmsPageTitleWithPlusAction>
        <template #subtitle>{{ $t('userPage.users') }}</template>
        {{ $t('userPage.editUser').toLocaleLowerCase() }}
      </BmsPageTitleWithPlusAction>
    </div>
    <p v-if="loading">{{ $t('userPage.loadingUser') }}</p>
    <p v-if="error">{{ error?.message }}</p>
    <div v-if="userEdit">
      <form id="edit-user" @submit.prevent="onSubmit">
        <p class="tw-mt-4 tw-font-semibold tw-text-main-gray">{{ $t('information') }}</p>
        <div
          class="tw-mb-[26px] tw-mt-2 tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-pt-5 tw-shadow-md"
        >
          <div class="tw-grid tw-grid-cols-2 tw-gap-4">
            <BmsTextField :value="userEdit?.name" name="name" :label="$t('name')" type="text" />
            <BmsTextField :value="userEdit?.email" name="email" :label="$t('email')" type="email" />
          </div>
        </div>

        <p class="tw-mt-4 tw-font-semibold tw-text-main-gray">{{ $t('access') }}</p>
        <div
          class="tw-mb-[26px] tw-mt-2 tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-py-5 tw-shadow-md"
        >
          <div v-for="(row, i) in accountFields" :key="row.id">
            <div class="tw-grid tw-grid-cols-[46%_46%_4%] tw-gap-4">
              <div>
                <label
                  class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray"
                  :for="'accountsId' + row.id"
                  >{{ $t('account') }}</label
                >
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
                <label
                  class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray"
                  :for="'permission' + row.id"
                  >{{ $t('permission') }}</label
                >
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
                class="-tw-ml-2 tw-h-5 tw-w-5 tw-cursor-pointer tw-self-center tw-text-gray-light"
                @click="handleDeleteRow(i)"
              />
            </div>
          </div>
          <BmsButton
            name="back-page"
            type="button"
            variant="primary"
            :disabled="isSubmitting"
            @click="handleAddRow()"
          >
            {{ $t('addNewAccount') }}
          </BmsButton>
        </div>

        <div class="tw-flex tw-items-center tw-justify-between">
          <p class="tw-text-xs tw-text-main-gray">
            {{ $t('createdOn') + ' ' + dateFormatter(userEdit?.createdAt, userEdit?.settings.language) }}
          </p>
          <div class="tw-flex tw-justify-end tw-gap-4">
            <BmsButton
              class="-tw-mr-2"
              name="back-page"
              type="button"
              variant="secondary"
              :disabled="isSubmitting"
              @click="onCancel"
            >
              {{ $t('cancel') }}
            </BmsButton>
            <BmsButton name="delete-user" type="button" variant="delete" :disabled="isSubmitting" @click="onDelete">
              {{ $t('delete') }}
            </BmsButton>
            <BmsButton name="edit-user" type="submit" :disabled="isSubmitting">{{ $t('save') }}</BmsButton>
          </div>
        </div>
      </form>
    </div>
  </BmsPageBase>
</template>

<style scoped></style>
