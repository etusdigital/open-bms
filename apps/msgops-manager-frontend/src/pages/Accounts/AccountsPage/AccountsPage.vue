<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import _ from 'lodash';
import { SearchOutline } from '@vicons/ionicons5';
import { useAccountStore, useUserStore } from '../../../stores';
import { BriusPageBase, BriusPageTitleWithPlusAction } from '../../../components';
import { dateWithTimeFormatter } from '../../../utils';
import { Pagination } from '../../../utils/pagination';
import { computed } from 'vue';
import { BriusHttpResponse } from '../../../gateways/_common/Brius';
import { Account } from '../../../entities/Account';

type sortBy = {
  key: string;
  order: string;
};

const userStore = useUserStore();
const { accounts, loading, error } = storeToRefs(useAccountStore());
const { fetchAccounts } = useAccountStore();

const { push } = useRouter();
const { query } = useRoute();
const { t } = useI18n();

let pagination = new Pagination();
const options: any = ref({ page: 1, itemsPerPage: 10, sortBy: [] });

const search = ref('');
const totalAccountData = ref(0);
const initialSortByValue = [{ key: '', order: '' }];
const sortByRef = ref(initialSortByValue);

const accountsList = computed(() => accounts.value as BriusHttpResponse<Account[]>);

const setValuesUrl = () => {
  if (pagination.page === 1 && (query.page === undefined || pagination.page === Number(query.page))) {
    return;
  }

  const queryParams = {
    itemsPerPage: pagination.itemsPerPage,
    page: pagination.page,
    search: search.value,
    sortBy: sortByRef.value[0].key,
    order: sortByRef.value[0].order,
  };

  const shouldUpdateQueryString = _.isEqualWith(query, queryParams, (x, y) =>
    typeof x === 'object' && typeof y === 'object' ? undefined : x == y,
  );

  if (!shouldUpdateQueryString) {
    push({ query: queryParams });
  }
};

const getValuesUrl = () => {
  if (query.page) {
    pagination.page = Number(query.page);
    pagination.itemsPerPage = Number(query.itemsPerPage);
    pagination.sortBy = String(query.sortBy);
    pagination.order = String(query.order);
    search.value = String(query.search);
    sortByRef.value = [
      {
        key: String(query.sortBy),
        order: String(query.order),
      },
    ];

    if (Number(options.value.page) !== Number(query.page)) {
      options.value = {
        ...options,
        page: Number(query.page),
      };
    }
    return;
  }

  options.value = { ...options };
  pagination = { ...pagination };
};

const getAccounts = async (params: Pagination) => {
  try {
    loading.value = true;
    await fetchAccounts({ ...params, search: search.value });
    totalAccountData.value = accountsList.value.totalItems;

    pagination = {
      ...pagination,
      itemsPerPage: parseInt(accountsList.value.itemsPerPage, 10),
      page: parseInt(accountsList.value.page, 10),
      totalPages: Math.ceil(accountsList.value.totalItems / Number(accountsList.value.itemsPerPage)),
    };
    setValuesUrl();
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  getValuesUrl();
  await getAccounts(pagination);
});

const dataTableHeaders = [
  { title: t('name'), align: 'start', key: 'name', sortable: true },
  { title: t('accountPage.description'), align: 'start', key: 'description', sortable: true },
  { title: t('createdAt'), align: 'start', key: 'createdAt', sortable: true },
];

const handlePlusClick = () => push('/accounts/create');

const handlePagination = async () => await getAccounts(pagination);

const filterByName = async () => {
  pagination = new Pagination();
  await getAccounts(pagination);
};

const onChangeOptions = async (sortBy: sortBy[]) => {
  if (loading.value) return;

  if (!sortBy[0]) {
    pagination = {
      ...pagination,
      sortBy: '',
      order: '',
    };

    sortByRef.value = initialSortByValue;
  } else {
    pagination = {
      ...pagination,
      sortBy: sortBy[0].key,
      order: sortBy[0].order,
    };
  }

  await getAccounts(pagination);
};
</script>

<template>
  <BriusPageBase>
    <BriusPageTitleWithPlusAction @click-plus="handlePlusClick">
      {{ $t('accountPage.accounts').toLocaleLowerCase() }}
    </BriusPageTitleWithPlusAction>
    <div>
      <form
        class="tw-mt-3 tw-flex tw-max-h-10 tw-max-w-[283px] tw-flex-row tw-rounded-lg tw-border tw-border-gray-light tw-bg-white tw-p-1 focus-within:tw-outline focus-within:tw-outline-primary"
        @submit.prevent="filterByName"
      >
        <input
          v-model.trim="search"
          class="tw-grow tw-px-2 focus:tw-outline-none"
          :placeholder="$t('search')"
          :disabled="loading"
        />
        <button type="submit" class="tw-mr-2 tw-mt-0.5 tw-h-5 tw-w-4 tw-text-main-gray">
          <SearchOutline color="#5C5C5C" />
        </button>
      </form>
      <p v-if="error">{{ error?.message }}</p>
      <div class="tw-mt-4">
        <v-skeleton-loader
          v-if="loading"
          class="tw-rounded-2xl"
          :elevation="1"
          color="white"
          type="table-tbody"
        ></v-skeleton-loader>
        <v-data-table-server
          v-else
          v-model:sort-by="sortByRef"
          class="tw-rounded-2xl tw-border-solid tw-text-main-gray tw-shadow-md"
          :headers="dataTableHeaders"
          :items="accountsList"
          :items-length="totalAccountData"
          :items-per-page="accountsList.itemsPerPage"
          :loading="loading"
          @update:sort-by="onChangeOptions"
        >
          <template #[`item.name`]="{ item }">
            <RouterLink :to="`/accounts/edit/${item.value}`" class="tw-font-semibold tw-text-primary tw-underline">{{
              item.columns.name
            }}</RouterLink>
          </template>

          <template #[`item.description`]="{ item }">
            <p>{{ item.columns.description }}</p>
          </template>

          <template #[`item.createdAt`]="{ item }">
            <p>
              {{
                dateWithTimeFormatter(
                  item.columns.createdAt,
                  $t('userPage.timePreposition'),
                  userStore.user?.settings.language,
                )
              }}
            </p>
          </template>

          <template #bottom></template>
        </v-data-table-server>

        <v-pagination
          v-model="pagination.page"
          class="mt-7 tw-text-primary"
          :length="pagination.totalPages"
          :total-visible="10"
          @update:model-value="handlePagination"
        ></v-pagination>
      </div>
    </div>
  </BriusPageBase>
</template>

<style scoped></style>
