<template>
  <div class="view-fields-modal">
    <div class="fields">
      <nav class="nav-bar">
        <button
          v-for="(field, index) in menuItems"
          class="nav-bar-button"
          :class="indexField === index ? 'nav-bar-button-active' : ''"
          @click="changeFieldIndex(index)"
          :key="field.name"
        >
          {{ field.value }}
        </button>
      </nav>
      <ListFields :fields.sync="fields[indexField]" :hideBorder="true" />
    </div>
  </div>
</template>

<script lang="ts">
import LoadingService from '@/services/loading.service';
import { Component, Vue } from 'vue-property-decorator';
import Multiselect from 'vue-multiselect';
import { MailTriggerEnum } from '@/enums/mail-trigger.enum';
import store from '@/store';
import ListFields from '@/components/fields-list/ListFields.vue';
import ContactsService from '@/modules/contacts/services/contacts.service';

@Component({
  components: { Multiselect, ListFields },
  store,
})
export default class ViewFields extends Vue {
  private readonly loadingService = new LoadingService();
  private readonly contactsService = new ContactsService();

  mailTriggerEnum = MailTriggerEnum;

  selectedTriggerFilter: any = null;
  triggerOptions: any = [];

  accounts: any = [];
  selectedAccount: any = null;

  headers: any = [];
  indexField = 0;
  menuItems = [
    { name: 'contactFields', value: this.$t('title.contact') },
    { name: 'customFields', value: this.$t('sidebar.customFields') },
    { name: 'dateFields', value: this.$t('datatable.date') },
    { name: 'messageFields', value: this.$t('datatable.message') },
    { name: 'otherFields', value: this.$t('datatable.others') },
  ];
  contactFields: any = [
    { id: 1, name: 'firstName', field: '%FIRSTNAME%', type: 'text' },
    { id: 2, name: 'lastName', field: '%LASTNAME%', type: 'text' },
    { id: 3, name: 'fullName', field: '%FULLNAME%', type: 'text' },
    { id: 4, name: 'email', field: '%EMAIL%', type: 'text' },
    { id: 5, name: 'hashedEmail', field: '%HASHEDEMAIL%', type: 'text' },
    { id: 6, name: 'id', field: '%CONTACT_ID%', type: 'text' },
    { id: 7, name: 'uuid', field: '%UUID%', type: 'text' },
    { id: 8, name: 'phone', field: '%PHONE%', type: 'text' },
    { id: 9, name: 'city', field: '%CITY%', type: 'text' },
    { id: 10, name: 'region', field: '%REGION%', type: 'text' },
    { id: 11, name: 'country', field: '%COUNTRY%', type: 'text' },
    { id: 12, name: 'link', field: '%LINK%', type: 'text' },
  ];
  dateFields: any = [
    { id: 1, name: 'dateToday', field: '%DATE_TODAY%', type: 'date' },
    { id: 2, name: 'dateTomorrow', field: '%DATE_TOMORROW%', type: 'date' },
    { id: 3, name: 'dayWeekToday', field: '%DAY_OF_WEEK_TODAY%', type: 'date' },
    { id: 4, name: 'dayWeekTomorrow', field: '%DAY_OF_WEEK_TOMORROW%', type: 'date' },
    { id: 5, name: 'monthToday', field: '%MONTH_TODAY%', type: 'date' },
    { id: 6, name: 'monthNext', field: '%MONTH_NEXT%', type: 'date' },
    { id: 7, name: 'hourNow', field: '%HOUR_NOW%', type: 'date' },
    { id: 8, name: 'hourNextHour', field: '%HOUR_NEXT_HOUR%', type: 'date' },
    { id: 9, name: 'hourNext8Hours', field: '%HOUR_NEXT_8_HOUR%', type: 'date' },
    { id: 10, name: 'hourNext16Hours', field: '%HOUR_NEXT_16_HOUR%', type: 'date' },
    { id: 11, name: 'hourNext23Hours', field: '%HOUR_NEXT_23_HOUR%', type: 'date' },
  ];
  messageFields: any = [
    { id: 1, name: 'id', field: '%MESSAGE_ID%', type: 'text' },
    { id: 2, name: 'name', field: '%MESSAGE_NAME%', type: 'text' },
  ];
  otherFields: any = [
    { id: 1, name: 'random4', field: '%RANDOM4%', type: 'text' },
    { id: 2, name: 'random8', field: '%RANDOM8%', type: 'text' },
    { id: 3, name: 'random12', field: '%RANDOM12%', type: 'text' },
  ];
  fields: any = [this.contactFields, [], this.dateFields, this.messageFields, this.otherFields];

  async beforeMount() {
    this.load();
  }

  async load() {
    this.loadingService.show();
    try {
      await this.getFields();
    } finally {
      this.loadingService.hide();
    }
  }

  async getFields() {
    const customFields: any = await this.contactsService.getContactsKeys();

    for (let i = 0; i < customFields?.data.length; i++) {
      this.fields[1].push({
        id: i + 1,
        field: `%${customFields?.data[i].name}%`.toUpperCase(),
        name: `${customFields?.data[i].title}`,
        type: 'text',
      });
    }
  }

  closeModal() {
    this.$emit('emitData');
  }

  changeFieldIndex(index: number) {
    this.indexField = index;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

::v-deep.view-fields-modal {
  .dialog-button {
    width: 100%;
    border-radius: 8px !important;
  }

  .dialog-buttons button:first-child {
    margin: 0 !important;
  }
}

.nav-bar {
  display: flex;
  background: white;
  box-shadow: $shadow-base;
  padding: 10px 15px;
  margin-top: 15px;
  border-radius: 16px;
  margin-top: 0px;
  margin-bottom: 8px;
  gap: 10px;

  button {
    font-weight: bold !important;
    font-size: 12px;
  }
}

.nav-bar-button {
  color: #a6a6a6;
  border-radius: 8px !important;
  padding: 5px 12px;
  font-weight: normal !important;

  &:hover {
    background: $ds-gray-100;
  }
}

.nav-bar-button-active {
  color: $ds-blue;
  background: $ds-blue-100;

  &:hover {
    background: $ds-blue-100;
  }
}
</style>
