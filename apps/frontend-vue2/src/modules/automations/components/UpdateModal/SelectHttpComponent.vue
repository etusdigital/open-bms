<template>
  <div class="more-filters w-50 overflow-hidden">
    <v-menu
      ref="menu"
      v-model="show"
      class="date-menu"
      :close-on-content-click="false"
      bottom
      transition="scale-y-transition"
      offset-y
    >
      <template v-slot:activator="{ on }">
        <v-btn class="date-button" :class="{ 'date-button-open': show === true }" v-on="on" @click="show = true">
          <div class="menu-filters" v-on="on">
            <p class="http-request__display_description">
              {{ description }}
            </p>
          </div>
          <div>
            <span class="material-symbols-rounded icon-up" :class="{ 'icon-dropdown ds-blue-color': show === true }"
              >arrow_drop_down</span
            >
          </div>
        </v-btn>
      </template>
      <v-card class="filters-card w-100" :class="{ 'filters-card-open': show === true }">
        <div class="list-filters">
          <v-list-group class="list-groups" :value="true" append-icon="mdi-chevron-down">
            <template v-slot:activator>
              <v-list-item-title class="filters-title" style="display: flex; flex-direction: row">
                {{ $t('automation.custom') }}
              </v-list-item-title>
            </template>
            <v-list-item-content>
              <div class="filters-list">
                <input
                  class="input-custom-default"
                  :placeholder="`${$t('automation.customValue')}`"
                  customValue
                  :value="description"
                  @input="setFilter($event.target.value, $event.target.value, 'custom')"
                />
              </div>
            </v-list-item-content>
          </v-list-group>
          <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
            <template v-slot:activator>
              <v-list-item-title class="filters-title" style="display: flex; flex-direction: row">
                {{ $t('title.automation') }}
              </v-list-item-title>
            </template>
            <v-list-item-content>
              <div class="filters-list">
                <div
                  class="checkbox-filters custom-checkbox"
                  :key="`contacts-filter-${index}`"
                  v-for="(field, index) in automationFields"
                >
                  <label
                    class="label-filters"
                    @click="setFilter(field.value, `${$t('title.automation')} - ${field.name}`)"
                  >
                    {{ field.name }}
                  </label>
                </div>
              </div>
            </v-list-item-content>
          </v-list-group>
          <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
            <template v-slot:activator>
              <v-list-item-title class="filters-title" style="display: flex; flex-direction: row">
                {{ $t('sidebar.customFields') }}
              </v-list-item-title>
            </template>
            <v-list-item-content>
              <div class="search-bar div-row align-items-center pl-2">
                <span class="material-symbols-rounded font-16"> search </span>
                <input
                  id="header-menu__campaigns-search"
                  class="search-input pl-2"
                  type="text"
                  :placeholder="`${$t('input.search')}`"
                  @input="filterCustomFields($event.target.value)"
                />
              </div>
              <div class="filters-list">
                <div
                  class="checkbox-filters custom-checkbox"
                  :key="`campaign-filter-${index}`"
                  v-for="(customField, index) in customFieldsFilter"
                >
                  <label
                    class="label-filters"
                    @click="
                      setFilter(
                        `contact.customFields[${customField.id}]`,
                        `${$t('sidebar.customFields')} - ${customField.title}`
                      )
                    "
                  >
                    {{ customField.title }}
                  </label>
                </div>
              </div>
            </v-list-item-content>
          </v-list-group>
          <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
            <template v-slot:activator>
              <v-list-item-title class="filters-title" style="display: flex; flex-direction: row">
                {{ $t('title.contactInfo') }}
              </v-list-item-title>
            </template>
            <v-list-item-content>
              <div class="filters-list">
                <div
                  class="checkbox-filters custom-checkbox"
                  :key="`contacts-filter-${index}`"
                  v-for="(field, index) in contactsFields"
                >
                  <label
                    class="label-filters"
                    @click="setFilter(field.value, `${$t('sidebar.contacts')} - ${field.name}`)"
                  >
                    {{ field.name }}
                  </label>
                </div>
              </div>
            </v-list-item-content>
          </v-list-group>
        </div>
      </v-card>
    </v-menu>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, Watch } from 'vue-property-decorator';
import TagService from '@/modules/tags/services/tag.service';
import { TagDto } from '@/modules/tags/dtos/tag.dto';
import { SegmentDto } from '@/modules/segment/dtos/segment.dto';

@Component({
  components: {},
  filters: {},
  props: ['customFields', 'index', 'name', 'keyItem', 'step'],
})
export default class SelectHttpComponent extends Vue {
  private readonly tagService = new TagService();
  @Prop() customFields!: any;
  @Prop() step!: any;
  @Prop() index!: number;
  @Prop() name!: string;
  @Prop() keyItem!: string;
  public tags: Array<TagDto> = new Array<TagDto>();
  public segments: Array<SegmentDto> = new Array<SegmentDto>();
  public newTags: any = [];
  filter: any = {};
  order = '';
  show = false;
  selectedFilter: any = [];
  tagsFormatted: any = [];
  menu = false;
  description = '';

  contactsFields = [
    { value: 'contact.id', name: 'ID' },
    { value: 'contact.email', name: this.$t('title.email') },
    { value: 'contact.email_provider', name: this.$t('input.emailProvider') },
    { value: 'contact.firstName', name: this.$t('title.firstName') },
    { value: 'contact.lastName', name: this.$t('title.lastName') },
    { value: 'contact.phone', name: this.$t('title.phone') },
    { value: 'contact.city', name: this.$t('title.city') },
    { value: 'contact.region', name: this.$t('title.region') },
    { value: 'contact.country', name: this.$t('title.country') },
    { value: 'contact.ip', name: 'IP' },
    { value: 'contact.timezone', name: this.$t('title.timezone') },
    { value: 'contact.isUnsubscribed', name: this.$t('datatable.unsubscribed') },
    { value: 'contact.hasBounced', name: this.$t('datatable.bounce') },
    { value: 'contact.last_sent', name: this.$t('title.lastSend') },
    { value: 'contact.last_open', name: this.$t('title.lastOpen') },
    { value: 'contact.last_click', name: this.$t('title.lastClick') },
    { value: 'contact.last_automation', name: this.$t('automation.lastAutomation') },
    { value: 'contact.has_email', name: this.$t('automation.hasEmail') },
    { value: 'contact.has_phone', name: this.$t('automation.hasPhone') },
    { value: 'contact.has_web_push', name: this.$t('automation.hasWebPush') },
    { value: 'contact.has_mobile_push', name: this.$t('automation.hasMobilePush') },
    { value: 'contact', name: this.$t('automation.contactsAll') },
  ];
  automationFields = [
    { value: 'automation.id', name: 'ID' },
    { value: 'automation.name', name: this.$t('title.name') },
    { value: 'automation.createdAt', name: this.$t('automation.createdAt') },
    { value: 'automation.updatedAt', name: this.$t('automation.updatedAt') },
    { value: 'step.id', name: this.$t('automation.stepId') },
  ];
  customFieldsFilter!: any;

  beforeMount() {
    this.customFieldsFilter = this.customFields;
    this.description = this.step.value ? this.step.value.description : 'Selecione';
  }

  filterCustomFields(value: string) {
    this.customFieldsFilter = this.customFields.filter((customField: any) => customField.title.includes(value));
  }

  setFilter(id: string, description: string, type = 'replace') {
    this.description = description;
    this.$emit('updateInput', this.name, this.index, this.keyItem, { id, description, type });
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

::v-deep .v-text-field__details {
  min-height: 0px !important;
  height: 0px;
  margin: 0 !important;
  margin-bottom: 0 !important;
}

::v-deep .v-messages {
  min-height: 0px !important;
}

::v-deep .v-input__control {
  height: 33px;
}

.menu-filters {
  display: flex;
  flex-direction: row;
  padding: 0.5em;
  font-size: 12px;
  font-weight: 600;
  align-items: center;
  gap: 5px;
  cursor: default;
  letter-spacing: 0.05em;
  justify-content: center;
  overflow: hidden;

  p:hover {
    cursor: pointer;
  }

  svg:hover {
    cursor: pointer;
  }

  & > p {
    margin: 0;
    text-transform: none;
    font-weight: normal;

    &.menu-filters__hasfilters {
      font-weight: bold;
    }
  }

  & > svg.menu-filters__hasfilters {
    color: $ds-blue;
  }
}

.filters-card {
  border-radius: 0px !important;
}

.filters-label {
  color: $ds-blue;
}

.list-groups {
  border-bottom: 1px solid $ds-gray-100;
}

.search-bar {
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-gray-100;
  margin-bottom: 0px !important;
}

.search-input {
  min-height: 37px !important;
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: -webkit-fill-available;
}

.filters-list {
  max-height: 11rem;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  padding-top: 0.5em;
  padding-bottom: 0.5em;
  overflow: auto;
  background-color: #ffffff;
}

.checkbox-filters {
  display: flex;
  flex-direction: row;
  gap: 5px;
  margin-left: 8px;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  width: 220px;
  display: block;
  overflow: hidden;
  margin: 0 !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
  background-color: white;
}

.label-filters:hover {
  background-color: $ds-gray-100;
}

::v-deep .v-label .theme--light {
  font-size: 12px !important;
}

.date-button {
  border-radius: 0px;
  height: 36px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  background-color: $ds-gray-100 !important;
  box-shadow: none;
  overflow: unset !important;
  opacity: 1;
  margin-bottom: 0px;
}

::v-deep .list-groups .v-list-group__items .v-list-item__content > * {
  line-height: 1.5 !important;
}

::v-deep .v-dialog {
  width: 542px;
  border-radius: 16px;
  top: 35%;
  position: absolute;
}

::v-deep .v-input__icon {
  flex: inherit;
  padding-right: 12px;
}

::v-deep .v-select.v-select--is-menu-active .v-input__icon--append .v-icon {
  transform: none;
  color: $ds-gray !important;
}

::v-deep .v-text-field > .v-input__control > .v-input__slot:before {
  border-color: none;
  border-style: hidden;
  border-width: 0px;
}

::v-deep .v-text-field > .v-input__control > .v-input__slot:after {
  border-color: none;
  border-style: hidden;
  border-width: 0px;
}

::v-deep .v-list-item__content {
  align-self: inherit;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}

::v-deep.v-list-group > .v-list-group__header > .v-list-group__header__append-icon .v-icon {
  color: $ds-blue !important;
}

.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue !important;
  border-right: 1px solid $ds-blue !important;
  border-left: 1px solid $ds-blue !important;
}

.date-menu {
  display: flex;
  width: 100%;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}

.list-filters {
  margin-bottom: 5px;
}
.date-button {
  width: 100%;
  border-radius: 8px;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  box-shadow: none;
  overflow: unset !important;
  border-radius: 8px;
}

.menu-filters-item__hasfilters {
  font-weight: bold !important;
}

.filter-selected {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 15px;
  width: 15px;
  border-radius: 50%;
  background: $ds-blue;
  margin-left: 4px;

  p {
    color: white;
    font-size: 10px;
    margin-bottom: 1px !important;
  }
}

.filter-selected-item {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 15px;
  width: 15px;
  border-radius: 50%;
  background: $ds-blue;
  margin-left: 4px;

  p {
    color: white;
    font-size: 10px;
    margin-bottom: 1px !important;
    margin-right: 1px;
  }
}

.input-custom-default {
  font-size: 12px;
  color: #5c5c5c;
  padding-left: 12px;
  width: -webkit-fill-available;
  outline: none;
}

::v-deep.date-button span.v-btn__content {
  width: 100% !important;
  overflow: hidden !important;
}

.http-request__display_description {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
