<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import _ from 'lodash';
import { SearchOutline } from '@vicons/ionicons5';
import { useUserStore } from '../../../stores';
import { BmsPageBase, BmsPageTitleWithPlusAction } from '../../../components';
import { dateWithTimeFormatter } from '../../../utils';
import { Pagination } from '../../../utils/pagination';

type sortBy = {
  key: string;
  order: string;
}

const { push } = useRouter();
const { query } = useRoute();
const { t } = useI18n();

const { user: userState, users, loading, error } = storeToRefs(useUserStore());
const { fetchUsers } = useUserStore();

let pagination = new Pagination();
const options: any = ref({ page: 1, itemsPerPage: 10, sortBy: []});

const search = ref('');
const totalUserData = ref(0);
const initialSortByValue = [{ key: '', order: '' }];
const sortByRef = ref(initialSortByValue);
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
    typeof x === 'object' && typeof y === 'object' ? undefined : x == y
  );

  if (!shouldUpdateQueryString) {
    push({ query: queryParams });
  }
}

const getValuesUrl = () => {
  if (query.page) {
    pagination.page = Number(query.page);
    pagination.itemsPerPage = Number(query.itemsPerPage);
    pagination.sortBy = String(query.sortBy);
    pagination.order = String(query.order);
    search.value = String(query.search);
    sortByRef.value = [{
      key: String(query.sortBy),
      order: String(query.order),
    }];

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
}

onMounted(async () => {
  getValuesUrl();
  await getUsers(pagination);
})

const getUsers = async (params: Pagination) => {
  try {
    loading.value = true;
    await fetchUsers({ ...params, search: search.value });
    totalUserData.value = users?.value.totalItems;

    pagination = {
      ...pagination,
      itemsPerPage: parseInt(users?.value.itemsPerPage, 10),
      page: parseInt(users?.value.page, 10),
      totalPages: Math.ceil(users?.value.totalItems / Number(users?.value.itemsPerPage)),
    };
    setValuesUrl();
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

const dataTableHeaders = [
  { title: t('name'), align: 'start', key: 'name', sortable: true },
  { title: t('email'), align: 'start', key: 'email', sortable: true },
  { title: t('createdAt'), align: 'start', key: 'createdAt', sortable: true },
];

const handlePlusClick = () => push('/users/create');

const handlePagination = async () => await getUsers(pagination);

const filterByName = async () => {
  pagination = new Pagination();
  await getUsers(pagination);
}

const onChangeOptions = async (sortBy: sortBy[]) => {
  if (loading.value) return;

  if (!sortBy[0]) {
    pagination = {
      ...pagination,
      sortBy: "",
      order: "",
    };

    sortByRef.value = initialSortByValue;
  } else {
    pagination = {
      ...pagination,
      sortBy: sortBy[0].key,
      order: sortBy[0].order,
    };
  }

  await getUsers(pagination);
}
</script>

<template>
  <BmsPageBase>
    <BmsPageTitleWithPlusAction @click-plus="handlePlusClick">
      {{$t('userPage.users').toLocaleLowerCase()}}
    </BmsPageTitleWithPlusAction>
    <div>
      <form
        class="tw-mt-3 tw-max-w-[283px] tw-max-h-10 tw-p-1 tw-flex tw-flex-row tw-border tw-border-gray-light tw-bg-white tw-rounded-lg focus-within:tw-outline focus-within:tw-outline-primary"
        @submit.prevent="filterByName"
      >
        <input
          v-model.trim="search"
          class="tw-grow tw-px-2 focus:tw-outline-none"
          :placeholder="$t('search')"
          :disabled="loading"
        >
        <button type="submit" class="tw-mr-2 tw-mt-0.5 tw-h-5 tw-w-4 tw-text-main-gray">
          <SearchOutline color="#5C5C5C"/>
        </button>
      </form>
       <p v-if="error">{{ error?.message }}</p>
      <div class="tw-mt-4">
        <v-skeleton-loader v-if="loading" class="tw-rounded-2xl" :elevation="1" color="white" type="table-tbody"></v-skeleton-loader>
          <v-data-table-server
            v-else
            v-model:sort-by="sortByRef"
            class="tw-rounded-2xl tw-border-solid tw-text-main-gray tw-shadow-md"
            :headers="dataTableHeaders"
            :items="users.results"
            :items-length="totalUserData"
            :items-per-page="users.itemsPerPage"
            :loading="loading"
            @update:sort-by="onChangeOptions"
          >
            <template #[`item.name`]="{ item }">
              <RouterLink :to="`/users/edit/${item.value}`" class="tw-text-primary tw-underline tw-font-semibold">{{ item.columns.name }}</RouterLink>
            </template>
            
            <template #[`item.email`]="{ item }">
              <p>{{ item.columns.email }}</p>
            </template>
            
            <template #[`item.createdAt`]="{ item }">
              <p>{{ dateWithTimeFormatter(item.columns.createdAt, $t('userPage.timePreposition'), userState?.settings.language) }}</p>
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
  </BmsPageBase>
</template>
