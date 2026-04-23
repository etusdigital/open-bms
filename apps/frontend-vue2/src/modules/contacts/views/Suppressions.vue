<template>
  <div class="col-12 pt-0">
    <div class="date-select align-items-center mt-6">
      <div class="default-filters__search-input">
        <form @submit.prevent="filterByTitle">
          <InputDefault
            :modelValue="filter.title"
            :placeholder="`${$t('input.search')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>
          <v-btn type="submit" hidden>{{ $t('input.search') }}</v-btn>
        </form>
      </div>
      <div class="default-filters__search-input">
        <InputDefault
          :modelValue="dateRangeText"
          :placeholder="`${$t('input.search')}`"
          :prependIcon="'calendar_month'"
          @click="toggleDatePicker"
        ></InputDefault>
        <v-date-picker
          width="240"
          no-title
          v-model="pickedDate"
          range
          :locale="userLanguage"
          :max="dateToVuetifyString(new Date())"
          @input="changeDatePicker($event)"
          :style="{ display: this.showDatePicker ? 'block' : 'none' }"
          ><ButtonDefault
            :name="`${$t('button.clear')}`"
            data-cy="button-view-fields"
            class="btn-clear buttons-specs"
            :disabled="dateRangeText === ''"
            @click="clearFilters()" />
          <ButtonDefault
            :name="`${$t('button.apply')}`"
            data-cy="button-view-fields"
            class="buttons-specs"
            :disabled="dateRangeText === ''"
            @click="applyFilters()"
        /></v-date-picker>
      </div>
    </div>
    <div class="container-datatable">
      <DataLoader :isLoading="isLoadingContacts" :type="'table-tbody,table-tbody'" class="mt-4" />
      <v-data-table
        v-if="contacts.length > 0"
        :headers="headers"
        hide-default-footer
        :items="contacts"
        :items-per-page="pagination.itemsPerPage"
        class="c-table"
        :loading="isLoadingContacts"
        :server-items-length="totalContactsData"
        :options.sync="options"
      >
        <template v-slot:[`item.unsubscribed_at`]="{ item }">
          <div class="td-item font-12">
            <span> {{ blockedOnly ? item.blocked_at : item.unsubscribed_at | formatDateTime }} </span>
          </div>
        </template>
      </v-data-table>
      <div v-if="contactsTotal < 0 && !isLoadingContacts" class="container-no-results">
        <span class="material-symbols-rounded icons-color">mail</span>
        <p class="font-16 font-title-style">
          {{ blockedOnly ? $t('datatable.noEmailBlocked') : $t('datatable.noEmailUnsubscribed') }}
        </p>
        <button class="v-btn-icon button-create" @click="toggleModalSuppression">
          <span class="material-symbols-rounded v-icon-plus"> add </span>
          <span class="add-span">{{
            blockedOnly
              ? $t('button.block').toString().toUpperCase()
              : $t('button.unsubscribe').toString().toUpperCase()
          }}</span>
        </button>
      </div>
      <div v-if="contactsTotal === 0 && contacts.length === 0 && !isLoadingContacts" class="container-no-results">
        <span class="material-symbols-rounded icons-color">mail</span>
        <p class="font-16 font-title-style">{{ $t('datatable.noEmail') }}</p>
        <p class="font-12 font-subtitle-style">{{ $t('datatable.noFoundEmailData') }}</p>
      </div>

      <div v-if="contacts.length > 0" class="text-center div-row pt-5 align-items-center justify-space-between">
        <div class="div-row gap-5 align-items-center">
          <span class="d-flex text-400 font-14 text-nowrap align-items-center">{{ $t('input.itemsPerPage') }}</span>
          <select
            class="select-items-per-page font-12 text-400"
            @change="setItemsNumber($event.target.value)"
            v-model="itemsNumber"
          >
            <option class="font-12 text-400" v-for="item in selectItemsPerPage" :value="item.value" :key="item.value">
              {{ item.text }}
            </option>
          </select>
        </div>
        <div class="div-row gap-10" v-if="!isLoadingCount">
          <v-btn :disabled="disablePrevious" color="primary" @click="previousPage">
            <span class="material-symbols-rounded">navigate_before</span>
          </v-btn>
          <v-btn :disabled="disableNext" color="primary" @click="nextPage">
            <span class="material-symbols-rounded">navigate_next</span>
          </v-btn>
        </div>
        <div class="d-flex">
          <div v-if="isLoadingCount" class="loading-dot-flashing"></div>
          <div v-else class="show-contacts">
            <label class="font-14">
              {{ $t('datatable.showing') }}

              {{
                $t('datatable.contactsTotal', {
                  rangeStart: rangeStart,
                  rangeFinal: rangeFinal,
                  total: formatedTotalNumber,
                })
              }}
            </label>
          </div>
        </div>
      </div>
    </div>
    <v-dialog v-model="$store.state.showModalSuppression" max-width="700">
      <v-card class="modal-card">
        <div class="container-modal">
          <div class="modal-close-button btn">
            <span @click="cancelSuppression">X</span>
          </div>
          <div>
            <div class="modal-title">{{ blockedOnly ? $t('modal.blockTitle') : $t('modal.unsubscribeTitle') }}</div>
          </div>
          <div class="modal-body">
            <span style="">E-mails</span>
            <textarea
              ref="textarea"
              :placeholder="`${blockedOnly ? $t('modal.blockPlaceholder') : $t('modal.unsubscribePlaceholder')}`"
            ></textarea>
          </div>
          <div class="unsubscribe-modal-warning">
            <span class="material-symbols-rounded">info</span>
            <div>{{ blockedOnly ? $t('modal.blockAlert') : $t('modal.unsubscribeAlert') }}</div>
          </div>
          <div class="m-footer">
            <input
              class="cancel-button mr-4"
              @click="cancelSuppression"
              type="button"
              :value="`${$t('button.cancel')}`"
            />
            <ButtonDefault
              :name="'Confirmar'"
              :disabled="false"
              class="btn btn-c btn-lg btn-success btn-success-c float-right"
              @click="suppress"
            />
          </div>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import ContactsService from '../services/contacts.service';
import { Pagination } from '@/models/pagination';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { areObjectsEqual } from '../../../util/objects';
import InputDefault from '@/components/input/InputDefault.vue';
import ToastService from '@/services/toast.service';
import dayjs from 'dayjs';
import { mapState } from 'vuex';
import { SuppressedsFiltersDto } from '../dto/suppresseds-filter.dto';
import { SuppressedsDto } from '../dto/suppresseds.dto';

@Component({
  components: { ButtonDefault, DataLoader, InputDefault },
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage']),
  },
})
export default class Suppressions extends Vue {
  private readonly contactsService = new ContactsService();
  private readonly toastService = new ToastService();
  public currentAccountTimezone!: string;
  public userLanguage!: string;

  contacts: Array<SuppressedsDto> = new Array<SuppressedsDto>();
  filter: SuppressedsFiltersDto = {} as SuppressedsFiltersDto;
  pagination: Pagination = new Pagination();

  pickedDate: string[] = [];
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  dateRangeText = '';
  blockedOnly = false;
  isDateRange = false;
  showDatePicker = false;
  isLoadingCount = false;
  disablePrevious = true;
  disableNext = false;
  totalContactsData = 0;
  itemsNumber = 10;
  rangeStart = 0;
  rangeFinal = 0;
  contactsTotal = 0;

  isLoadingContacts = false;

  headers: any = [
    { text: this.$t('datatable.email'), value: 'email', sortable: true },
    { text: this.$t('datatable.date'), value: this.blockedOnly ? 'blocked_at' : 'unsubscribed_at', sortable: false },
  ];

  options: any = {
    page: 1,
    itemsPerPage: 10,
    sortBy: [this.blockedOnly ? 'blocked_at' : 'unsubscribed_at'],
    sortDesc: [true],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };

  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];

  async beforeMount() {
    this.blockedOnly = this.$route.params.type === 'blocked';
    await this.getCountUnsubscribed();
    this.getValuesUrl();
    if (this.contactsTotal >= 0) {
      await this.loadUnsubscribedContacts();
    }
    this.$store.commit('closeModalSuppression');
  }

  async nextPage() {
    this.pagination.page++;
    this.setValuesUrl();
  }

  async previousPage() {
    this.pagination.page--;
    this.setValuesUrl();
  }

  checkPage() {
    this.disablePrevious = true;

    if (this.pagination.page > 1) {
      this.disablePrevious = false;
    }

    if (this.pagination.page === 1 && this.contacts.length > 10) {
      this.disableNext = false;
    }

    if (this.contacts.length < 10 || this.contactsTotal <= this.pagination.page * 10) {
      this.disableNext = true;
    } else {
      this.disableNext = false;
    }
  }

  get formatedTotalNumber() {
    return Vue.filter('formatNumber')(this.contactsTotal);
  }

  async getCountUnsubscribed() {
    this.isLoadingCount = true;
    const result = await this.contactsService.getSuppressedContacts({
      countOnly: true,
      blockedOnly: this.$route.params.type === 'blocked',
    });
    this.contactsTotal = result?.data.totalItems;
    if (this.contactsTotal === 0) {
      this.contactsTotal = -1;
    }
    this.isLoadingCount = false;
    this.checkPage();
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    this.loadUnsubscribedContacts();
  }

  cancelSuppression() {
    this.$store.commit('toggleModalSuppression');
  }

  async loadUnsubscribedContacts(params?: Pagination) {
    if (this.isLoadingContacts) {
      return;
    }

    this.isLoadingContacts = true;
    if (params) {
      this.pagination = {
        page: params.page,
        itemsPerPage: params.itemsPerPage,
        totalPages: params.totalPages,
        sortBy: params.sortBy,
        order: params.order,
      };
    }

    try {
      this.filter.startDate = this.startDate;
      this.filter.endDate = this.endDate;

      const result = await this.contactsService.getSuppressedContacts({
        ...this.$route.query,
        ...this.pagination,
        pagination: this.pagination,
        filters: this.filter,
        blockedOnly: this.$route.params.type === 'blocked',
      });

      this.contacts = result?.data?.results;
      this.totalContactsData = result?.data?.totalItems;
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      this.pagination = {
        ...this.pagination,
        itemsPerPage: parseInt(result?.data?.itemsPerPage, 10),
        page: parseInt(result?.data?.page, 10),
        totalItems: result?.data?.totalItems,
        totalPages: Math.ceil(result?.data?.totalItems / result?.data?.itemsPerPage),
      };

      const calculateFinalRange = this.pagination.itemsPerPage + this.rangeStart - 1;
      this.rangeFinal =
        this.pagination.totalItems < calculateFinalRange
          ? this.pagination.totalItems * this.pagination.page
          : calculateFinalRange;
      this.setValuesUrl();

      this.isLoadingContacts = false;

      if (this.filter.title !== '' || this.isDateRange !== false) {
        this.isLoadingCount = true;
        const totalCount = await this.contactsService.getSuppressedContacts({
          filters: this.filter,
          countOnly: true,
          blockedOnly: this.$route.params.type === 'blocked',
        });
        this.contactsTotal = totalCount?.data?.totalItems;
        this.isLoadingCount = false;
      } else {
        this.getCountUnsubscribed();
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoadingContacts = false;
      this.checkPage();
    }
  }

  removeInvalidEmails(emails: any[]) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter((email: string) => emailRegex.test(email));
    return validEmails;
  }

  async suppress() {
    const block = this.$route.params.type === 'blocked';
    const textarea = this.$refs.textarea as HTMLTextAreaElement;
    let emails = textarea.value.split(/[\n,]/);

    emails = emails.map((email) => email.trim());

    emails = this.removeInvalidEmails(emails);
    const countEmails = emails.length;
    if (countEmails === 0) {
      return;
    }

    try {
      const date = this.dateToVuetifyString(new Date());
      const params = {
        emails: [...emails],
        allAccounts: true,
        block,
      };
      const response = await this.contactsService.bulkUnsubscribe(params);
      if (response) {
        this.toastService.show({
          type: 'success',
          text: block
            ? (this.$t('toast.emailsBlocked', { countEmails }) as string)
            : (this.$t('toast.emailsUnsubscribed', { countEmails }) as string),
        });
      }
    } catch {
      this.toastService.show({
        type: 'error',
        text: block ? (this.$t('toast.blockError') as string) : (this.$t('toast.unsubscribeError') as string),
      });
    }

    textarea.value = '';
    await this.loadUnsubscribedContacts();
    this.$store.commit('closeModalSuppression');
  }

  setValuesUrl() {
    if (
      this.pagination.page === 1 &&
      this.filter.title === '' &&
      this.$route.query.title === undefined &&
      this.pickedDate.length === 0 &&
      ((this.$route.query.order === undefined && this.pagination.order === 'DESC') ||
        this.pagination.order === this.$route.query.order) &&
      ((this.$route.query.sortBy === undefined && this.pagination.sortBy === 'unsubscribed_at') ||
        this.pagination.sortBy === this.$route.query.sortBy) &&
      (this.$route.query.page === undefined || this.pagination.page === Number(this.$route.query.page))
    ) {
      return;
    }

    const query = {
      itemsPerPage: this.pagination.itemsPerPage,
      page: this.pagination.page,
      title: this.filter.title || '',
      startDate: this.startDate?.toISOString().slice(0, 10) || '',
      endDate: this.endDate?.toISOString().slice(0, 10) || '',
      order: this.pagination.order || '',
      sortBy: this.pagination.sortBy || '',
    };

    if (areObjectsEqual(this.$route.query, query) === false) {
      this.$router.push({ query });
    }
  }

  getValuesUrl() {
    if (this.$route.query.page) {
      this.pagination.page = Number(this.$route.query.page);
      this.pagination.itemsPerPage = Number(this.$route.query.itemsPerPage);
      this.pagination.sortBy = this.$route.query.sortBy?.toString() || '';
      this.pagination.order = this.$route.query.order?.toString() || 'DESC';
      this.filter.title = this.$route.query.title.toString();

      if (this.$route.query.startDate) {
        this.pickedDate[0] = this.$route.query.startDate?.toString();
        this.pickedDate[1] = this.$route.query.endDate?.toString();
        this.changeDatePickerGetValuesUrl(this.pickedDate);
      } else {
        this.clearDate();
      }

      if (
        Number(this.options.page) !== Number(this.$route.query.page) ||
        this.options.sortBy[0] !== this.$route.query.sortBy ||
        this.options.sortDesc[0] !== (this.$route.query.order === 'DESC')
      ) {
        this.options = {
          ...this.options,
          sortBy: [this.pagination.sortBy],
          sortDesc: [this.pagination.order === 'DESC'],
          page: Number(this.$route.query.page),
        };
      }

      return;
    }

    this.options = { ...this.options, page: 1, sortBy: ['unsubscribed_at'], sortDesc: [true] };
    this.pagination = { ...this.pagination, page: 1, sortBy: 'unsubscribed_at', order: 'DESC' };
    this.filter.title = '';
    this.clearDate();
  }

  async clearDate() {
    this.pickedDate = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.dateRangeText = '';
    this.isDateRange = false;
  }

  changeDatePickerGetValuesUrl(e: string[]) {
    if (e.length < 2) {
      return;
    }

    const dates: dayjs.Dayjs[] = e.map((item) => {
      const date = dayjs.utc(item).tz(this.currentAccountTimezone, true);
      return date;
    });

    if (dates[0] > dates[1]) {
      dates.reverse();
    }

    const startDateInTimezone = dates[0].tz(this.currentAccountTimezone);
    const endDateInTimezone = dates[1].tz(this.currentAccountTimezone);

    this.startDate = new Date(startDateInTimezone.format('YYYY-MM-DDTHH:mm:ss'));
    this.endDate = new Date(endDateInTimezone.format('YYYY-MM-DDTHH:mm:ss'));
    this.dateRangeText = `${Vue.filter('formatDate')(dates[0])} - ${Vue.filter('formatDate')(dates[1])}`;
    this.isDateRange = true;
  }

  async filterByTitle() {
    this.pagination.page = 1;

    this.setValuesUrl();
    await this.loadUnsubscribedContacts();
  }

  updateInput(event: undefined, key: keyof SuppressedsFiltersDto) {
    this.filter[key] = event;
  }

  dateToVuetifyString(date: Date): string {
    if (!date) {
      return '';
    }

    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateString = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    return dateString;
  }

  async changeDatePicker(e: string[]) {
    if (e.length < 2) {
      return;
    }

    const dates: dayjs.Dayjs[] = e.map((item) => {
      const date = dayjs.utc(item).tz(this.currentAccountTimezone, true);
      return date;
    });

    if (dates[0] > dates[1]) {
      dates.reverse();
    }

    const startDateInTimezone = dates[0].tz(this.currentAccountTimezone);
    const endDateInTimezone = dates[1].tz(this.currentAccountTimezone);

    this.startDate = new Date(startDateInTimezone.format('YYYY-MM-DDTHH:mm:ss'));
    this.endDate = new Date(endDateInTimezone.format('YYYY-MM-DDTHH:mm:ss'));
    this.dateRangeText = `${Vue.filter('formatDate')(dates[0])} - ${Vue.filter('formatDate')(dates[1])}`;
  }

  toggleDatePicker() {
    this.showDatePicker = !this.showDatePicker;
  }

  async applyFilters() {
    this.pagination.page = 1;
    if (this.dateRangeText !== '') {
      this.isDateRange = true;
    }

    this.setValuesUrl();
    this.loadUnsubscribedContacts();
  }

  async clearFilters() {
    this.pickedDate = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.pagination.page = 1;
    this.dateRangeText = '';

    if (this.isDateRange === true) {
      this.dateRangeText = '';
      this.isDateRange = false;
      this.loadUnsubscribedContacts();
    }
  }

  @Watch('options', { deep: true })
  async onChangeOptions() {
    if (this.isLoadingContacts) {
      return;
    }

    const { sortBy, sortDesc, page, itemsPerPage, totalPages } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      itemsPerPage,
      sortBy: sortBy[0] || 'unsubscribed_at',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
      totalPages,
    };

    this.setValuesUrl();

    await this.loadUnsubscribedContacts();
  }

  @Watch('$route')
  async changePagination() {
    this.getValuesUrl();
    await this.loadUnsubscribedContacts();
  }

  toggleModalSuppression() {
    this.$store.commit('toggleModalSuppression');
  }
}
</script>
<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.container-modal {
  height: 50em;

  .modal-title {
    font-size: 1.6em;
    font-weight: 600;
    padding-bottom: 1em;
  }

  .modal-close-button {
    float: right;
    font-weight: 600;
    font-size: large;
    color: grey;
  }

  .m-footer {
    display: flex;
    float: right;
  }
}

.modal-body {
  height: 36em;
  padding: 0;
  padding-top: 1.5em;

  span {
    font-size: 1.3em;
    font-weight: 600;
  }

  textarea {
    width: 100%;
    height: 31.5em;
    border: 1px solid #ccc;
    border-radius: 10px;
    padding: 1em;
    resize: none;
  }
}

.modal-card {
  border-radius: 20px;
  padding: 1em;
  padding: 2em;
}

.button-create {
  max-width: 100%;
}

.date-select {
  justify-content: flex-start;
  display: flex;
  flex-direction: row;
  gap: 1em;
  padding-bottom: 2em;
}

.unsubscribe-modal-warning {
  display: flex;
  flex-direction: row;
  border: 2px solid #fcd23b;
  border-radius: 25px;
  background-color: #fffdef;
  padding: 0.3em;
  margin-bottom: 1em;
}

.unsubscribe-modal-warning span {
  color: #fcd23b;
  font-size: 3.3em;
  padding-right: 0.3em;
  padding-left: 0.2em;
  margin-top: auto;
  margin-bottom: auto;
}

.unsubscribe-modal-warning div {
  color: #fcd23b;
  margin-top: 0.7em;
  font-size: 13px;
  margin-top: auto;
  margin-bottom: auto;
}

::v-deep .v-dialog.v-dialog--active {
  box-shadow: none !important;
  margin: 0 !important;
}

::v-deep.v-picker {
  position: fixed;
  display: none;
}

::v-deep .container-no-results {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #fff;
  border-radius: 16px;
  width: 100%;
  height: 247px;
  padding: 20px;
}

::v-deep .icons-color {
  color: #ffb1b4;
  font-size: 80px;
}

::v-deep .font-title-style {
  font-weight: 600;
  line-height: 21px;
  margin-bottom: 5px;
}

::v-deep .font-subtitle-style {
  line-height: 18px;
  font-weight: 400;
}

::v-deep.c-table {
  margin-top: 16px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 16px;

  .icon {
    width: 16px;
    opacity: 0.6;
  }

  .no-data {
    margin: 0;
  }

  td {
    min-height: 52px;
    height: auto !important;
    padding: 16px 32px !important;
  }

  td:last-child {
    .td-item {
      float: right;
    }
  }

  th:last-child.text-start span {
    float: right;
    padding-right: 8.2em;
  }

  th:last-child.text-start i {
    float: right;
  }

  .font-first-name {
    font-weight: 600;
  }

  .style-font {
    font-size: 10px !important;
  }

  .td-item {
    display: flex;
    align-items: center;
    height: 100%;
  }

  .automation {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sucess--text {
    color: $ds-blue;
  }

  .hidden {
    display: none;
  }

  .font-title-style {
    font-weight: 600;
    line-height: 21px;
    margin-bottom: 5px;
  }

  .font-subtitle-style {
    line-height: 18px;
    font-weight: 400;
  }
  .icons-color {
    color: #ffb1b4;
    font-size: 80px;
  }
}
</style>
