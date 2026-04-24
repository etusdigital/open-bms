<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import { ref, watch, computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import _ from 'lodash';
import { useAccountStore, useBillingStore, useUserStore } from '../../../stores';
import { BmsPageBase, BmsPageTitleWithPlusAction } from '../../../components';
import { numberFormatter } from '../../../utils/numberFormatter';
import BmsDataLoader from '../../../components/BmsDataLoader.vue';
import type { Account } from '../../../entities/Account';
const userStore = useUserStore();
const { push } = useRouter();
const route = useRoute();
const { t } = useI18n();
const { billing, months, loading, error } = storeToRefs(useBillingStore());
const { accounts } = storeToRefs(useAccountStore());
const { fetchBilling, fetchGetMonths } = useBillingStore();
const { fetchAccounts, fetchAllAccounts, setAccount } = useAccountStore();
const month = ref();
const account = ref();
const uniqueAccount = ref(false);
const accountMenu = ref(false);
const monthMenu = ref(false);
const messagesMenu = ref(false);
const selectedAccounts = ref<Account[]>([]);
const accountsIds = ref<number[]>([]);
const selectedMonth = ref();
const isOpen = ref(false);
const chipItems = ref<Account[]>([]);
const isDataSelected = ref(false);
const accountsStringIds = ref();
const menuAccounts = ref();
const searchValue = ref();
const monthNames = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const messagesTypes = ['EMAIL', 'WEB_PUSH', 'MOBILE_PUSH', 'WHATSAPP', 'SMS'];

const visibleChips: any = computed(() => {
  return isOpen.value ? chipItems.value : chipItems.value.slice(0, 3);
});

const filteredBillingCards = computed(() => {
  return billingCards.filter((legend) => legend.type !== 'total' && getCostByType(legend.type) > 0);
});

const filteredBillingServices: any = computed(() => {
  return billing.value.filter((item) => !messagesTypes.includes(item.service) && item.service !== 'Total');
});

const filteredBillingMessages: any = computed(() => {
  return billing.value.filter((item) => messagesTypes.includes(item.service) && item.service !== 'Total');
});

const billingTotal = computed(() => {
  return billing.value.find((item) => item.service === 'Total')?.cost;
});

onBeforeMount(async () => {
  await getAccounts();
  if (route.query) {
    accountsStringIds.value = route.query.accountsIds;
    getValuesUrl();
    await applyAccount();
  }
});

const focusInput = () => {
  setTimeout(() => {
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.focus();
    }
  }, 100);
};

const setValuesUrl = () => {
  const accountsIds = selectedAccounts.value.map((account: any) => account.id).join(',');
  const queryParams = {
    accountsIds,
    month: selectedMonth.value.dateString,
  };

  const shouldUpdateQueryString = _.isEqualWith(route.query, queryParams, (x, y) =>
    typeof x === 'object' && typeof y === 'object' ? undefined : x == y,
  );

  if (!shouldUpdateQueryString) {
    push({ query: queryParams });
  }
  if (!accountsIds) {
    push({ query: {} });
  }
};

const getValuesUrl = () => {
  if (route.query.accountsIds) {
    accountsStringIds.value = route.query.accountsIds;
    const accountsList = Array.isArray(accounts.value) ? accounts.value : accounts.value.results;
    selectedAccounts.value = accountsStringIds.value.split(',').map((accountId: string) => {
      return accountsList.find((account: any) => account.id === parseInt(accountId, 10));
    }) as any;
  }
  if (route.query.month) {
    selectedMonth.value = formatMonthYear(route.query?.month as string);
  }
};

const clearFilters = () => {
  selectedAccounts.value = [];
  selectedMonth.value = '';
  months.value = [];
  billing.value = [];
  chipItems.value = [];
  accountMenu.value = false;
  setValuesUrl();
};

const removeAccountChip = async (id: number) => {
  selectedAccounts.value = selectedAccounts.value.filter((message: any) => message.id !== id);

  if (selectedAccounts.value.length) {
    await applyAccount();
  }
  if (!selectedAccounts.value.length) {
    clearFilters();
  }
};

const getBilling = async (month: string) => {
  selectedMonth.value = formatMonthYear(month);
  try {
    loading.value = true;

    setValuesUrl();

    await fetchBilling(month, accountsIds.value);
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const getMonths = async () => {
  try {
    await fetchGetMonths();
  } catch (err) {
    console.error(err);
  }
};

const getAccounts = async () => {
  try {
    if (userStore.canSeeAllAccounts) {
      await fetchAllAccounts();
    } else {
      await fetchAccounts({ itemsPerPage: 500 });
    }
    const accountsList = Array.isArray(accounts.value) ? accounts.value : accounts.value.results;
    menuAccounts.value = accountsList;
    if (accountsList.length === 1) {
      account.value = accountsList[0].id;
      uniqueAccount.value = true;
      selectedAccounts.value = [accountsList[0]];
      await applyAccount();
    }
  } catch (err) {
    console.error(err);
  }
};

const applyAccount = async () => {
  accountsIds.value = selectedAccounts.value.map((account: any) => account.id);
  accountMenu.value = false;
  chipItems.value = [];
  chipItems.value = chipItems.value.concat(selectedAccounts.value);
  if (!selectedAccounts.value.length) {
    return;
  }
  try {
    setAccount({ id: accountsIds.value[0] });
    month.value = null;
    await getMonths();

    if (selectedMonth.value?.dateString) {
      await getBilling(selectedMonth.value.dateString);
    }
  } catch (err) {
    console.error(err);
  }
};

const getCostByType = (type: string) => {
  let billingCost;

  switch (type) {
    case 'messages':
      return billing.value
        .filter((bill) => messagesTypes.includes(bill.service))
        .reduce((total, bill) => total + Number(bill.cost), 0);
    default:
      billingCost = billing.value.find((bill) => bill.service.toLowerCase() === type)?.cost;
      return Number(billingCost) || 0;
  }
};

const formatMonthYear = (dateString: string): { dateString: string; translatedMonth: string; year: string } => {
  const [year, month] = dateString.split('-');
  const translatedMonth = t(`months.${monthNames[parseInt(month, 10) - 1]}`);
  return { dateString, translatedMonth, year };
};

const getBarData = (legend: any, index?: number) => {
  let widthPercentage = (getCostByType(legend.type) / getCostByType('total')) * 100;
  if (index === 0 && widthPercentage < 2) {
    widthPercentage = 2;
  }
  if (index === filteredBillingCards.value.length - 1 && widthPercentage < 2) {
    widthPercentage = 2;
  }
  return widthPercentage;
};

const sumValues = (billingArray: any) => {
  const sumObject = {
    service: t('billingPage.sentMessages'),
    quantity: 0,
    unitCost: 0,
    cost: 0,
  };

  for (const item of billingArray) {
    sumObject.quantity += parseInt(item.quantity);
    sumObject.unitCost = parseFloat((sumObject.unitCost + item.unitCost).toFixed(6));
    sumObject.cost += parseFloat(item.cost);
  }

  return sumObject;
};

const toogle = (boolean: any) => {
  messagesMenu.value = boolean ? false : true;
};

const searchAccount = (event: any) => {
  const account = (event.target as HTMLInputElement).value || null;
  const accountsList = Array.isArray(accounts.value) ? accounts.value : accounts.value.results;
  if (!account) {
    menuAccounts.value = accountsList;
  } else {
    menuAccounts.value = accountsList.filter((value) => value.name?.toLowerCase().includes(account.toLowerCase()));
  }
};

watch(billing, async () => {
  if ((billing.value.length && selectedMonth.value) || selectedAccounts.value.length) {
    isDataSelected.value = true;
  } else {
    isDataSelected.value = false;
  }
});

const dataTableHeaders = [
  { title: t('billingPage.product'), align: 'start', key: 'service', sortable: false, width: '30%' },
  { title: t('billingPage.quantity'), align: 'end', key: 'quantity', sortable: false, width: '20%' },
  { title: t('billingPage.unitCost'), align: 'end', key: 'unitCost', sortable: false, width: '20%' },
  { title: t('billingPage.cost'), align: 'end', key: 'cost', sortable: false, width: '30%' },
];

const billingCards = [
  { title: t('billingPage.count_contacts'), color: 'rgb(0, 206, 252)', type: 'count_contacts' },
  { title: t('billingPage.sentMessages'), color: '#436BBA', type: 'messages' },
  { title: t('billingPage.count_ips'), color: '#4A004F', type: 'count_ips' },
  { title: t('billingPage.email_validate'), color: '#C6315C', type: 'email_validate' },
  // { title: t('billingPage.eventProcessed'), color: '#FF9654', type: '' },
  { title: t('billingPage.totalCost'), color: '#0057F4', type: 'total' },
];
</script>

<template>
  <BmsPageBase>
    <BmsPageTitleWithPlusAction>
      {{ t('billingPage.billing').toLocaleLowerCase() }}
    </BmsPageTitleWithPlusAction>
    <div class="mt-3 tw-flex tw-items-center" :class="{ 'tw-gap-3': !uniqueAccount, 'tw-mb-5': !chipItems.length }">
      <v-menu v-if="!uniqueAccount" v-model="accountMenu" :close-on-content-click="false">
        <template #activator="{ props }">
          <div
            class="tw-flex tw-h-9 tw-w-[282px] tw-cursor-pointer tw-items-center tw-justify-between tw-bg-white tw-pl-2 tw-pr-1 tw-text-[#5c5c5c]"
            :class="{
              'tw-rounded-t-lg tw-border-x tw-border-t tw-border-[#0057F4]': accountMenu,
              'tw-rounded-lg tw-border tw-border-[#D9D9D9]': !accountMenu,
            }"
            v-bind="props"
            @click="focusInput"
          >
            <input
              class="tw-text-xs tw-text-[#D9D9D9] tw-outline-none"
              :class="{ 'tw-mt-[-36px] tw-hidden': accountMenu }"
              type="button"
              :value="`${t('billingPage.selectAccount')}`"
            />
            <span class="material-symbols-rounded tw-text-2xl" :class="{ 'tw-hidden': accountMenu }"
              >arrow_drop_down</span
            >
          </div>
        </template>
        <div
          class="tw-relative tw-mt-[-29px] tw-max-h-[220px] tw-w-[282px] tw-rounded-b-lg tw-border-x tw-border-b tw-border-[#0057F4] tw-bg-white"
        >
          <div class="tw-flex tw-h-7 tw-flex-row tw-items-start tw-justify-between tw-pl-2 tw-pr-2">
            <input
              id="search"
              v-model="searchValue"
              class="tw-flex tw-w-[-webkit-fill-available] tw-items-center tw-bg-white tw-pt-1 tw-text-xs tw-outline-none"
              :placeholder="`${t('billingPage.searchAccount')}`"
              type="text"
              @input="searchAccount($event)"
            />
            <span class="material-symbols-rounded font-20 cursor-pointer tw-text-[#0057F4]"> search </span>
          </div>
          <div class="tw-flex tw-max-h-[145px] tw-flex-col tw-overflow-y-auto">
            <div
              v-for="(userAccount, i) in menuAccounts"
              :key="`account-modal-filter-${i}`"
              class="tw-flex tw-min-h-[36px] tw-cursor-pointer tw-flex-row tw-content-center tw-items-center tw-gap-2 tw-border-t tw-border-[#f5f5f5] tw-pl-2"
            >
              <input
                :id="`account-options-${userAccount.id}`"
                :key="`search-input-account-${i}`"
                v-model="selectedAccounts"
                type="checkbox"
                class="tw-cursor-pointer"
                :value="{ ...userAccount }"
              />
              <label
                :key="`account-labels-${i}`"
                class="tw-w-[-webkit-fill-available] tw-cursor-pointer tw-text-xs tw-text-[#5c5c5c]"
                :for="`account-options-${userAccount.id}`"
                >{{ userAccount.name }}</label
              >
            </div>
          </div>
          <div class="tw-flex tw-flex-row tw-justify-end tw-gap-2 tw-border-t tw-border-[#f5f5f5] tw-p-2">
            <button
              class="tw-cursor-pointer tw-text-[10px] tw-font-semibold tw-uppercase tw-text-[#0057F4]"
              :class="{ 'tw-text-[#A6A6A6]': !selectedAccounts.length }"
              :disabled="!selectedAccounts.length"
              @click.prevent="clearFilters"
            >
              {{ t('billingPage.clear') }}
            </button>
            <button
              class="tw-flex tw-h-[26px] tw-cursor-pointer tw-items-center tw-justify-center tw-rounded-lg tw-bg-[#0057f4] tw-p-2 tw-text-[10px] tw-font-semibold tw-uppercase tw-text-white"
              :class="{ 'tw-bg-[#D9D9D9] tw-text-[#A6A6A6]': !selectedAccounts.length }"
              :disabled="!selectedAccounts.length"
              @click.prevent="applyAccount"
            >
              {{ t('billingPage.apply') }}
            </button>
          </div>
        </div>
      </v-menu>
      <v-menu v-model="monthMenu" bottom :close-on-content-click="true">
        <template #activator="{ props: on }">
          <div
            class="tw-flex tw-h-9 tw-w-[282px] tw-cursor-pointer tw-items-center tw-justify-between tw-gap-5 tw-bg-white tw-pl-2 tw-pr-1 tw-text-[#5c5c5c]"
            :class="{
              'tw-rounded-t-lg tw-border-x tw-border-t tw-border-[#0057F4]': monthMenu,
              'tw-rounded-lg tw-border tw-border-[#D9D9D9]': !monthMenu,
            }"
            v-bind="on"
          >
            <div class="tw-flex tw-flex-row tw-items-center tw-gap-1">
              <span
                class="material-symbols-rounded tw-flex tw-h-min tw-items-center tw-text-lg"
                :class="{ 'tw-text-[#0057F4]': monthMenu }"
                >calendar_month</span
              >
              <input
                v-if="!selectedMonth"
                class="tw-text-xs tw-text-[#D9D9D9] tw-outline-none"
                type="button"
                :value="`${t('billingPage.selectMonth')}`"
              />
              <span v-else class="tw-flex tw-h-min tw-items-center tw-text-xs tw-outline-none"
                >{{ selectedMonth.translatedMonth }}/{{ selectedMonth.year }}</span
              >
            </div>
            <span class="material-symbols-rounded tw-text-2xl" :class="{ 'tw-rotate-180 tw-text-[#0057F4]': monthMenu }"
              >arrow_drop_down</span
            >
          </div>
        </template>
        <div
          class="tw-max-h-[200px] tw-overflow-y-auto tw-rounded-b-lg tw-border-x tw-border-b tw-border-[#0057F4] tw-bg-white"
        >
          <div
            v-for="(billMonth, index) in months"
            :key="`message-statistics-${index}`"
            class="tw-flex tw-h-9 tw-w-[-webkit-fill-available] tw-cursor-pointer tw-items-center tw-border-t tw-border-[#f5f5f5] tw-pl-3"
          >
            <span
              class="tw-h-[-webkit-fill-available] tw-w-[-webkit-fill-available] tw-content-center tw-text-xs tw-text-[#5c5c5c]"
              @click="getBilling(billMonth.toString())"
            >
              {{ formatMonthYear(billMonth.toString()).translatedMonth }}/{{
                formatMonthYear(billMonth.toString()).year
              }}
            </span>
          </div>
          <span
            v-if="!selectedAccounts.length || !months.length"
            class="tw-flex tw-h-9 tw-items-center tw-border-t tw-border-[#f5f5f5] tw-pl-3 tw-text-xs tw-text-[#5c5c5c]"
          >
            {{ !selectedAccounts.length ? t('billingPage.selectAccountFirst') : t('billingPage.noData') }}</span
          >
        </div>
      </v-menu>
    </div>
    <div class="tw-flex tw-flex-row tw-gap-5" :class="{ 'tw-mb-6 tw-mt-2': chipItems.length }">
      <div
        class="tw-align-center tw-flex tw-w-[-webkit-fill-available] tw-flex-row"
        :class="[
          isOpen
            ? 'tw-duration-2000 tw-mr-2 tw-flex tw-transition-all tw-ease-out'
            : 'tw-mr-2 tw-flex tw-max-h-6 tw-flex-row',
        ]"
      >
        <div :class="[isOpen ? 'tw-flex tw-flex-wrap tw-gap-2' : 'tw-flex tw-flex-row tw-gap-2']">
          <div
            v-for="(chip, index) in visibleChips"
            :key="`chip-${index}`"
            class="tw-flex tw-h-6 tw-items-center tw-justify-between tw-gap-4 tw-rounded-full tw-border tw-border-solid tw-border-[#D9D9D9] tw-bg-white tw-pl-3 tw-pr-3 tw-text-xs tw-font-semibold"
          >
            <span
              class="tw-max-w-[250px] tw-overflow-hidden tw-text-ellipsis tw-whitespace-nowrap tw-text-[10px] tw-text-[#5C5C5C]"
              >{{ chip.name }}</span
            >
            <span
              v-if="chipItems.length > 1"
              class="material-symbols-rounded tw-cursor-pointer tw-text-base tw-text-[#5C5C5C]"
              @click="removeAccountChip(chip.id)"
            >
              close
            </span>
          </div>
          <button
            v-if="chipItems.length > 3"
            class="tw-cursor-pointer tw-whitespace-nowrap tw-text-xs tw-font-semibold tw-text-[#0057F4] tw-outline-none hover:tw-text-[#00228d]"
            @click="isOpen = !isOpen"
          >
            {{ isOpen ? t('showLess') : '+' + `${chipItems.length - 3} ` + t('others').toLowerCase() }}
          </button>
        </div>
      </div>
    </div>
    <div v-if="!isDataSelected && !loading" class="tw-flex tw-h-[500px] tw-items-center tw-justify-center">
      <span class="tw-text-base tw-font-semibold tw-text-[#a6a6a6]">{{ t('billingPage.chooseAccount') }}</span>
    </div>
    <div v-if="isDataSelected" class="tw-container tw-max-w-[-webkit-fill-available]">
      <div class="tw-grid tw-grid-cols-3 tw-gap-4 tw-pb-4 xl:tw-grid-cols-5">
        <BmsDataLoader
          v-for="cards in billingCards"
          :key="`loader-${cards}`"
          :is-loading="loading"
          :type="'text, text'"
          :height="'97'"
          :class="'tw-rounded-2xl tw-border-[0.5px] tw-border-[#D9D9D9]'"
        />
        <div
          v-for="(card, index) in billingCards"
          :key="`card-${index}`"
          :class="loading ? 'd-none' : ''"
          class="tw-flex tw-h-[97px] tw-w-[-webkit-fill-available] tw-flex-col tw-gap-6 tw-rounded-2xl tw-border-[0.5px] tw-border-[#D9D9D9] tw-bg-white tw-px-5 tw-py-3"
          style="box-shadow: 0px 1px 3px 0px #0000001a; box-shadow: 0px 1px 2px 0px #0000000f"
          :style="`${card.type === 'total' ? 'background-color: #F4F8FF; border: 0.5px solid #0057F4' : ''}`"
        >
          <span
            class="tw-flex tw-text-sm tw-font-semibold tw-text-[#5C5C5C]"
            :style="`${card.type === 'total' ? `color: ${card.color}` : ''}`"
            >{{ card.title }}</span
          >
          <div class="tw-flex tw-flex-row tw-items-baseline tw-gap-2">
            <span class="tw-flex tw-text-base tw-font-semibold tw-leading-3" :style="`color: ${card.color}`"> R$ </span>
            <span class="tw-flex tw-text-2xl tw-font-semibold tw-leading-5" :style="`color: ${card.color}`">
              {{ numberFormatter(getCostByType(card.type) || 0) }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <BmsDataLoader
      v-if="isDataSelected"
      :is-loading="loading"
      :type="'text, text'"
      :height="'98'"
      :class="'tw-mb-4 tw-justify-center tw-rounded-2xl'"
    />
    <div
      v-if="isDataSelected"
      :class="loading ? 'd-none' : ''"
      class="tw-mb-4 tw-flex tw-h-[98px] tw-flex-col tw-justify-center tw-gap-4 tw-rounded-2xl tw-bg-white tw-p-4"
      style="
        box-shadow:
          0px 1px 2px rgba(0, 0, 0, 0.06),
          0px 1px 3px rgba(0, 0, 0, 0.1);
      "
    >
      <div class="tw-flex tw-w-full tw-flex-row">
        <span
          v-for="(bar, i) in filteredBillingCards"
          :key="`bar-${i}`"
          :style="`background-color: ${bar.color}; width: ${getBarData(bar, i).toFixed(2)}%`"
          class="tw-h-6 first:tw-rounded-l-[20px] last:tw-rounded-r-[20px]"
        >
          <v-tooltip activator="parent" location="top">{{ getBarData(bar).toFixed(2) }}%</v-tooltip></span
        >
      </div>
      <div class="tw-flex tw-flex-row tw-items-center tw-justify-center tw-gap-4">
        <div
          v-for="(legend, index) in filteredBillingCards"
          :key="`legend-${index}`"
          class="tw-flex tw-h-4 tw-flex-row tw-items-center tw-gap-1"
        >
          <span :style="`background-color: ${legend.color}`" class="tw-h-[8px] tw-w-[8px] tw-rounded-[50%]"></span>
          <span class="tw-text-xs tw-text-[#5C5C5C]">{{ legend.title }}</span>
        </div>
      </div>
    </div>
    <div v-if="isDataSelected">
      <div class="tw-mb-2 tw-flex tw-flex-row tw-gap-1">
        <span class="tw-text-base tw-font-semibold tw-text-[#5c5c5c]">{{ t('billingPage.billingDetail') }} </span>
        <span v-if="selectedMonth" class="tw-text-base tw-font-semibold tw-text-[#5c5c5c]">{{
          t('billingPage.of', {
            month: selectedMonth?.translatedMonth,
            year: selectedMonth?.year,
          })
        }}</span>
      </div>
      <p v-if="error">{{ error?.message }}</p>
      <BmsDataLoader :is-loading="loading" :type="'table-tbody'" :class="'tw-mt-1 tw-rounded-2xl tw-text-main-gray'" />
      <table
        :class="loading ? 'd-none' : ''"
        class="tw-flex tw-w-[-webkit-fill-available] tw-flex-col tw-rounded-2xl tw-border-[1px] tw-border-solid tw-border-[#D9D9D9] tw-bg-white tw-p-5 tw-text-[#5c5c5c]"
        style="box-shadow: 0px 1px 3px 0px #0000001a; box-shadow: 0px 1px 2px 0px #0000000f"
      >
        <thead>
          <tr
            class="tw-flex tw-h-[35px] tw-w-[-webkit-fill-available] tw-flex-row tw-justify-between tw-border-b-[1px] tw-border-[#D9D9D9] tw-text-sm"
          >
            <th
              v-for="(header, i) in dataTableHeaders"
              :key="`billing-header-${i}`"
              class="tw-flex tw-w-[25%]"
              :class="[header.key !== 'service' ? 'tw-justify-end' : '']"
            >
              {{ header.title }}
            </th>
          </tr>
        </thead>
        <tbody class="tw-flex tw-w-[-webkit-fill-available] tw-flex-col tw-border-b-[1px] tw-border-[#D9D9D9]">
          <tr
            v-for="(body, index) in filteredBillingServices"
            v-show="body.service !== 'Total'"
            :key="`billing-body-${index}`"
            class="tw-flex tw-h-[45px] tw-w-[-webkit-fill-available] tw-flex-row tw-items-center tw-justify-between tw-border-b-[1px] tw-border-[#D9D9D9]"
          >
            <td class="tw-flex tw-w-[25%] tw-text-sm tw-font-semibold">
              {{ t(`billingPage.${body.service.toLowerCase()}`) }}
            </td>
            <td class="tw-flex tw-w-[25%] tw-justify-end tw-text-xs tw-font-semibold">
              {{ $n(parseInt(body.quantity)) }}
            </td>
            <td class="tw-flex tw-w-[25%] tw-flex-row tw-justify-end tw-gap-1 tw-text-xs">
              <span>R$</span>
              <span>{{ numberFormatter(body.unitCost || 0) }}</span>
            </td>
            <td class="tw-flex tw-w-[25%] tw-flex-row tw-justify-end tw-gap-1 tw-text-xs tw-font-semibold">
              <span>R$</span>
              <span>
                {{ numberFormatter(body.cost || 0) }}
              </span>
            </td>
          </tr>
          <tr
            v-show="filteredBillingMessages"
            class="tw-flex tw-h-[45px] tw-w-[100%] tw-cursor-pointer tw-flex-row tw-items-center tw-justify-between"
            @click="toogle(messagesMenu)"
          >
            <td class="tw-flex tw-w-[25%] tw-flex-row tw-items-center">
              <span
                class="material-symbols-rounded tw-flex tw-w-4 tw-text-[#3E87F8]"
                :class="[messagesMenu ? 'tw-rotate-180' : '']"
                :style="`${messagesMenu ? '' : 'justify-content: right'}`"
                >arrow_drop_down</span
              >
              <span class="tw-whitespace-nowrap tw-text-sm tw-font-semibold">
                {{ sumValues(filteredBillingMessages)?.service }}
              </span>
            </td>
            <td class="tw-flex tw-w-[25%] tw-justify-end tw-text-xs tw-font-semibold">
              {{ $n(sumValues(filteredBillingMessages)?.quantity) }}
            </td>
            <td class="tw-flex tw-w-[25%] tw-flex-row tw-justify-end tw-gap-1 tw-text-xs">
              <span>R$</span>
              <span>
                {{ numberFormatter(sumValues(filteredBillingMessages)?.unitCost || 0) }}
              </span>
            </td>
            <td class="tw-flex tw-w-[25%] tw-flex-row tw-justify-end tw-gap-1 tw-text-xs tw-font-semibold">
              <span>R$</span>
              <span>
                {{ numberFormatter(sumValues(filteredBillingMessages)?.cost) }}
              </span>
            </td>
          </tr>
          <tr
            v-for="(message, index) in filteredBillingMessages"
            :key="`billing-message-${index}`"
            class="tw-flex tw-w-[-webkit-fill-available] tw-flex-row tw-items-center tw-justify-between tw-pb-3"
            :class="messagesMenu ? '' : 'tw-hidden'"
          >
            <td class="tw-flex tw-w-[25%] tw-whitespace-nowrap tw-pl-4 tw-text-xs tw-font-semibold">
              {{ t(`billingPage.${message.service.toLowerCase()}`) }}
            </td>
            <td class="tw-flex tw-w-[25%] tw-justify-end tw-text-xs">{{ $n(parseInt(message.quantity)) }}</td>
            <td class="tw-flex tw-w-[25%] tw-flex-row tw-justify-end tw-gap-1 tw-text-xs">
              <span> R$ </span>
              <span>{{ numberFormatter(message?.unitCost || 0) }}</span>
            </td>
            <td class="tw-flex tw-w-[25%] tw-flex-row tw-justify-end tw-gap-1 tw-text-xs">
              <span> R$ </span>
              <span>
                {{ numberFormatter(message.cost || 0) }}
              </span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="tw-flex tw-h-[35px] tw-w-[100%] tw-flex-row tw-items-center tw-justify-end">
            <td class="tw-flex tw-w-[25%] tw-justify-end tw-gap-1 tw-text-sm tw-font-semibold">
              <span>{{ t('billingPage.total') }}:</span>
              <span>R$ </span>
              <span>
                {{ numberFormatter(Number(billingTotal)) }}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </BmsPageBase>
</template>
