<template>
  <v-dialog v-model="openCustom" @click:outside="closeCustom">
    <div class="custom-card w-100 div-column gap-20">
      <div class="div-row justify-space-between ds-gray-color">
        <span class="font-14 text-600">{{ $t('title.addCustomization') }}</span>
        <span class="material-symbols-rounded font-24 text-600 cursor-pointer" @click="closeCustom">close</span>
      </div>
      <div class="div-column gap-5 ds-gray-color">
        <span class="font-12 text-600">{{ $t('input.customfields_text') }}</span>
        <v-menu
          ref="menu"
          v-model="customMenu"
          class="div-column justify-center border-radius-custom"
          :close-on-content-click="false"
          bottom
          width="283"
        >
          <template v-slot:activator="{ activate }">
            <button
              v-on="activate"
              class="div-row justify-space-between ds-gray-color custom-input align-items-center"
              @click="customMenu = true"
            >
              <span class="font-12">{{ customFieldName ? customFieldName : $t('input.select') }}</span>
              <span
                class="material-symbols-rounded font-18"
                :class="{ 'icon-dropdown ds-blue-color': customMenu === true }"
                >arrow_drop_down</span
              >
            </button>
          </template>
          <v-card class="div-column">
            <input
              class="font-12 div-column custom-items items-border-bottom search-input"
              type="text"
              v-model="customSearch"
              :placeholder="`${$t('input.typeHere')}`"
            />
            <div class="custom-lists div-column list-content">
              <div
                v-for="(list, listIndex) in menuItems"
                :key="'list' + listIndex"
                class="div-column ds-gray-color items-border-bottom"
              >
                <template v-if="!isSubListEmpty(getSubList(filteredCustomFields, listIndex))">
                  <span class="div-column font-12 text-600 custom-items">
                    {{ list.value }}
                  </span>
                  <div
                    class="div-column custom-items items-border-bottom cursor-pointer items-list"
                    v-for="(subList, subListIndex) in getSubList(filteredCustomFields, listIndex)"
                    :key="'sub-list' + subListIndex"
                    @click="selectCustomField(subList)"
                  >
                    <span class="font-12">
                      {{ subList.name }}
                    </span>
                  </div>
                </template>
              </div>
            </div>
          </v-card>
        </v-menu>
      </div>
      <div class="div-column gap-5 ds-gray-color">
        <span class="font-12 text-600">{{ $t('title.typeValue') }}</span>
        <input
          class="custom-input font-12 input-style"
          type="text"
          v-model="customValue"
          :placeholder="`${$t('input.typeHere')}`"
        />
      </div>
      <div class="div-row gap-10 align-items-center justify-content-end">
        <button class="d-flex ds-blue-color font-12 text-uppercase text-600" @click="closeCustom">
          {{ $t('button.cancel') }}
        </button>
        <button class="add-button" @click="updateFields">
          {{ $t('sidebar.add') }}
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script script lang="ts">
import ContactsService from '@/modules/contacts/services/contacts.service';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
@Component({
  props: ['openCustom', 'type'],
})
export default class CustomSelection extends Vue {
  @Prop() openCustom!: boolean;
  @Prop() type!: string;

  private readonly contactsService = new ContactsService();

  customValue = '';
  customSearch = '';
  customMenu = false;
  menuItems = [
    { name: 'contactFields', value: this.$t('title.contact') },
    { name: 'customFields', value: this.$t('sidebar.customFields') },
    { name: 'dateFields', value: this.$t('datatable.date') },
  ];
  contactFields: any = [
    { id: 1, name: 'firstName', field: '%FIRSTNAME%', type: 'text' },
    { id: 2, name: 'lastName', field: '%LASTNAME%', type: 'text' },
    { id: 3, name: 'fullName', field: '%FULLNAME%', type: 'text' },
    { id: 4, name: 'email', field: '%EMAIL%', type: 'text' },
    { id: 5, name: 'hashedEmail', field: '%HASHEDEMAIL%', type: 'text' },
    { id: 6, name: 'uuid', field: '%UUID%', type: 'text' },
    { id: 7, name: 'phone', field: '%PHONE%', type: 'text' },
    { id: 8, name: 'link', field: '%LINK%', type: 'text' },
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
  customFields: any = [this.contactFields, [], this.dateFields];
  customFieldName = '';

  get filteredCustomFields() {
    if (!this.customSearch) {
      return this.customFields;
    }
    const searchLower = this.customSearch.toLowerCase();
    return this.customFields.map((fields: any) =>
      fields.filter((field: any) => field.name.toLowerCase().includes(searchLower))
    );
  }

  async beforeMount() {
    await this.getFields();
  }

  getSubList(name: any[], index: number): any[] {
    return name[index] || [];
  }

  isSubListEmpty(subList: any[]): boolean {
    return subList.length === 0;
  }

  async getFields() {
    const customFields: any = await this.contactsService.getContactsKeys();

    for (let i = 0; i < customFields?.data.length; i++) {
      this.customFields[1].push({
        id: i + 1,
        field: `%${customFields?.data[i].name}%`.toUpperCase(),
        name: `${customFields?.data[i].title}`,
        type: 'text',
      });
    }
  }

  selectCustomField(value: any) {
    this.customFieldName = value.name;
    this.customMenu = false;
  }

  updateFields() {
    this.$emit('updateFields', this.type, this.customFieldName, this.customValue);
    this.closeCustom();
  }

  closeCustom() {
    this.$emit('closeCustom');
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.custom-card {
  border-radius: 16px;
  padding: 20px;
  background-color: $neutral-basic-white;
}

.custom-input {
  border-radius: 8px;
  padding: 10px;
  height: 36px;
  outline: none;
  border: 1px solid $ds-gray-300;
  &.input-style:focus {
    border: 1px solid $ds-blue;
  }
}

.custom-items {
  height: 36px;
  padding: 10px;
  justify-content: center;
}

.items-border-top {
  border-top: 1px solid $ds-gray-100;
}

.items-border-bottom {
  border-bottom: 1px solid $ds-gray-100;
  &:last-child {
    border-bottom: unset;
  }
}

.items-list:hover {
  background-color: $ds-blue-100;
  & {
    color: $ds-blue;
  }
}

.search-input {
  outline: none;
  width: -webkit-fill-available;
  margin-right: 1px;
  position: fixed;
  background-color: $neutral-basic-white;
}

.custom-lists {
  max-height: 250px;
  overflow: auto;
}

.list-content {
  margin-top: 36px;
}

::v-deep.v-menu__content {
  border: 1px solid $ds-blue;
  border-radius: 8px !important;
}

::v-deep .v-dialog {
  max-width: 400px;
  border-radius: 16px;
}
</style>
