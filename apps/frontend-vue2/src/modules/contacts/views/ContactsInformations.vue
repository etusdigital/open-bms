<template>
  <div class="view-new-contact">
    <div class="main-section align-items-start div-row gap-20 mb-5">
      <div class="left-section div-column gap-15">
        <div class="div-column gap-5">
          <span class="font-12 text-600 ds-gray-color">{{ $t('title.contactInfo') }}</span>
          <v-card class="div-row align-items-center gap-15 p-4">
            <div class="div-row align-items-center">
              <div class="profile" v-if="!gravatarImage">
                {{ getInitialNames() }}
              </div>
              <div v-else>
                <img class="profile" :src="gravatarUrl" alt="avatar" />
              </div>
            </div>
            <div class="div-column gap-10 w-100 ds-gray-color justify-content-between">
              <div class="div-column gap-5">
                <div class="div-row align-items-center justify-content-between">
                  <span class="font-18 text-600 d-flex">{{ contactFullName }}</span>
                  <span class="font-12 text-600">
                    {{ $t('datatable.createdAt') }}:
                    {{ formatDate(currentContact.createdAt) }}
                  </span>
                </div>
                <span class="font-14 d-flex">{{ currentContact.email }}</span>
              </div>
              <div class="div-column gap-5">
                <span class="font-12 text-600">{{ $t('input.communicationChannels') }}</span>
                <div class="div-row align-items-center gap-5">
                  <span
                    v-for="(channel, index) in channelIcons"
                    :key="index"
                    :class="['material-symbols-rounded font-20', { inactive: !activeChannels[channel.key] }]"
                    v-tooltip.top="
                      `${
                        activeChannels[channel.key]
                          ? $t(channel.label) + ' ' + $t('datatable.active')
                          : $t(channel.label) + ' ' + $t('datatable.inactive')
                      }`
                    "
                  >
                    <template v-if="channel.key === 'wpp'">
                      <img
                        src="@/assets/whatsapp-icon.svg"
                        width="24"
                        :style="
                          activeChannels.wpp
                            ? 'filter: invert(68%) sepia(0%) saturate(0%) hue-rotate(220deg) brightness(90%) contrast(84%)'
                            : ''
                        "
                        class="wpp-icon"
                      />
                    </template>
                    <template v-else>
                      {{ channel.icon }}
                    </template>
                  </span>
                </div>
              </div>
            </div>
          </v-card>
        </div>
        <v-card class="contact-details">
          <div class="div-row align-items-center gap-5">
            <span class="font-12 text-600">{{ $t('title.contactDetails') }}</span>
            <span class="material-symbols-rounded cursor-pointer font-18" @click="showModal('editContactDetails')">
              edit
            </span>
          </div>
          <div class="contact-info">
            <h6 class="contact-details-labels">{{ $t('title.name') }}</h6>
            <p>{{ contactFullName }}</p>
          </div>
          <hr />
          <div class="contact-info">
            <h6 class="contact-details-labels">{{ $t('title.email') }}</h6>
            <p>{{ currentContact.email }}</p>
          </div>
          <hr />
          <div class="contact-info">
            <h6 class="contact-details-labels">{{ `${$t('title.phone')}` }}</h6>
            <p>{{ currentContact.phone }}</p>
          </div>
          <hr />
          <div class="contact-info">
            <h6 class="contact-details-labels">{{ $t('title.location') }}</h6>
            <p>{{ currentContact.region }}</p>
          </div>
          <hr />
          <div class="contact-info">
            <h6 class="contact-details-labels">{{ $t('title.status') }}</h6>
            <p>
              {{
                currentContact.isActive
                  ? $t('datatable.active')
                  : currentContact.isBlocked
                  ? $t('datatable.blocked')
                  : $t('datatable.inactive')
              }}
            </p>
          </div>
        </v-card>
        <v-card class="channel-info">
          <div>
            <h6>{{ $t('title.channelsInfo') }}</h6>
            <div class="channels-container">
              <table class="channels-table">
                <thead>
                  <tr class="header-tr">
                    <th class="channel-name">{{ `${$t('datatable.identifier')}` }}</th>
                    <th>{{ $t('datatable.entrance') }}</th>
                    <th>{{ $t('datatable.isActive') }}</th>
                    <th>{{ $t('datatable.lastInteraction') }}</th>
                    <th>{{ $t('datatable.lastSend') }}</th>
                    <th>{{ $t('datatable.lastOpen') }}</th>
                    <th>{{ $t('datatable.lastClick') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(channel, index) in contactChannelsInfo"
                    :key="channel.channel"
                    :class="[{ lastItem: index === contactChannelsInfo.length - 1 }]"
                  >
                    <td class="div-row align-items-center gap-10">
                      <div class="div-row align-items-center" v-tooltip.top="channel.channel">
                        <span v-if="channel.channel === 'Whatsapp'">
                          <img
                            src="@/assets/whatsapp-icon.svg"
                            width="22"
                            style="
                              filter: invert(68%) sepia(0%) saturate(0%) hue-rotate(220deg) brightness(90%)
                                contrast(84%);
                              width: 20px !important;
                            "
                          />
                        </span>
                        <span v-else class="material-symbols-rounded font-20">
                          {{ channel.icon }}
                        </span>
                      </div>
                      <span v-if="channel.identifier" class="channel-name-text">{{ channel.identifier }}</span>
                      <span v-else> -- </span>
                    </td>
                    <td>
                      <span v-if="channel.entrance"> {{ formatDate(channel.entrance) }} </span>
                      <span v-else> -- </span>
                    </td>
                    <td>
                      <span v-if="channel.isActive"> {{ channel.isActive }} </span>
                      <span v-else> -- </span>
                    </td>
                    <td>
                      <span v-if="channel.lastInteraction"> {{ formatDate(channel.lastInteraction) }} </span>
                      <span v-else> -- </span>
                    </td>
                    <td>
                      <span v-if="channel.lastSent"> {{ formatDate(channel.lastSent) }} </span>
                      <span v-else> -- </span>
                    </td>
                    <td>
                      <span v-if="channel.lastOpen"> {{ formatDate(channel.lastOpen) }} </span>
                      <span v-else> -- </span>
                    </td>
                    <td>
                      <span v-if="channel.lastClick"> {{ formatDate(channel.lastClick) }} </span>
                      <span v-else> -- </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </v-card>
        <v-card class="tags div-column gap-10 py-5 px-5">
          <h6 class="ds-gray-color text-600 mb-0">Tags</h6>
          <v-menu ref="menu" v-model="tagMenu" bottom class="tag-menu d-none" :close-on-content-click="false">
            <template v-slot:activator="{ on }">
              <div class="menu-tags cursor-pointer" v-on="on">
                <input class="input-tag" type="button" :value="` ${$t('input.select')}`" />
                <span class="material-symbols-rounded ds-gray-color" medium>arrow_drop_down</span>
              </div>
            </template>
            <v-card class="tag-card">
              <div class="div-row align-items-center search-bar-select">
                <input
                  id="header-menu__campaigns-search"
                  class="search-input"
                  type="text"
                  :placeholder="`${$t('input.search')}`"
                  @input="debouncedFindTags($event.target.value)"
                />
                <span class="material-symbols-rounded ds-blue-color"> arrow_drop_up </span>
              </div>
              <div class="tag-list">
                <div class="checkbox-tag pl-2" :key="`tags-modal-filter-${i}`" v-for="(tags, i) in filteredTags">
                  <input
                    type="checkbox"
                    :key="`search-input-tags-${i}`"
                    :id="`tag-options-${tags.id}`"
                    v-model="newTags"
                    :value="{ ...tags }"
                    class="input-filters"
                  />
                  <label class="label-filters" :for="`tag-options-${tags.id}`" :key="`tag-labels-${i}`">
                    {{ tags.name }}
                  </label>
                </div>
              </div>
              <div class="clear-apply p-2">
                <input
                  class="clear-tags"
                  :disabled="newTags.length === 0"
                  text
                  @click="clearTags()"
                  type="button"
                  :value="`${$t('button.clear')}`"
                />
                <ButtonDefault
                  data-cy="button-view-fields"
                  class="btn-default buttons-specs"
                  :disabled="newTags.length === 0"
                  @click="updateTags('add', newTags)"
                  :name="`${$t('title.addTag')}`"
                ></ButtonDefault>
              </div>
            </v-card>
          </v-menu>
          <div class="w-100 tags-chip">
            <v-chip
              v-for="item in selectedOptionData"
              :key="item"
              outlined
              class="mr-2 mb-2"
              :class="isLoading ? 'd-none' : ''"
            >
              <span class="font-12">
                {{ itemName(item) }}
              </span>
              <button class="material-symbols-rounded font-18" @click="updateTags('remove', item)">close</button>
            </v-chip>
            <div class="d-flex justify-center align-items-center w-100" v-if="isLoading">
              <span class="material-symbols-rounded ds-blue-color rotate-icon"> progress_activity </span>
            </div>
          </div>
        </v-card>
      </div>
      <div class="right-section gap-5 div-column">
        <span class="font-12 text-600 ds-gray-color">{{ $t('title.activityHistory') }}</span>
        <div class="history-filters w-100">
          <v-menu
            ref="menu"
            v-model="dateMenu"
            class="date-menu"
            :close-on-content-click="false"
            bottom
            width="283"
            transition="scale-y-transition"
            offset-y
          >
            <template v-slot:activator="{ activate }">
              <v-btn
                class="date-button button-border mb-1"
                :class="{ 'date-button-open': dateMenu === true }"
                v-on="activate"
                @click="dateMenu = true"
              >
                <div class="calendar-date">
                  <span
                    class="material-symbols-rounded font-16 calendar-icon"
                    :class="[dateMenu ? 'ds-blue-color' : '']"
                  >
                    calendar_month
                  </span>
                  <span class="date-range">{{ dateRangeText || $t('button.selectDate') }}</span>
                </div>
                <div>
                  <span
                    class="material-symbols-rounded icon-up font-20"
                    :class="{ 'icon-dropdown ds-blue-color': dateMenu === true }"
                    small
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card class="filters-card" :class="{ 'filters-card-open': dateMenu === true }">
              <v-date-picker
                width="280"
                no-title
                v-model="selectedDates"
                range
                class="date-picker"
                :locale="userLanguage"
                :max="dateToVuetifyString(new Date())"
                @input="changeDatePicker($event)"
              />
              <div class="date-filters">
                <v-btn class="date-period first-period" @click="selectDateFilter(0)">{{ $t('input.today') }}</v-btn>
                <v-btn class="date-period" @click="selectDateFilter(1)">{{ $t('input.yesterday') }}</v-btn>
                <v-btn class="date-period" @click="selectDateFilter(7)">{{
                  $t('input.dateRange', { days: '7' })
                }}</v-btn>
                <v-btn class="date-period" @click="selectDateFilter(15)">{{
                  $t('input.dateRange', { days: '15' })
                }}</v-btn>
                <v-btn class="date-period" @click="selectDateFilter(30)">{{
                  $t('input.dateRange', { days: '30' })
                }}</v-btn>
                <v-btn class="date-period last-period" @click="selectDateFilter('lastMonth')">{{
                  $t('input.lastMonth')
                }}</v-btn>
              </div>
              <button
                class="clear-fields d-flex justify-end align-items-center ds-blue-color text-600 p-3"
                v-if="selectedDates.length"
                :disabled="isDateRange === false"
                @click="clearDate()"
                type="button"
              >
                {{ $t('button.clear') }}
              </button>
            </v-card>
          </v-menu>
          <v-menu
            ref="menu"
            v-model="historyMenu"
            class="date-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="283"
            data-menu="show-history-filters"
          >
            <template v-slot:activator="{ on }">
              <v-btn
                id="bms-campaigns-list-button-advanced-filters"
                class="date-button mb-1"
                :class="[historyMenu === true ? 'filters-button-open' : 'button-border']"
                v-on="on"
                @click="historyMenu = true"
              >
                <div class="menu-filters" v-on="on">
                  <span class="material-symbols-rounded font-16" :class="{ 'ds-blue-color': historyMenu === true }"
                    >filter_list</span
                  >

                  <p
                    :class="{ 'menu-filters__hasfilters': selectedFilters }"
                    style="display: flex; flex-direction: row"
                  >
                    {{ $t('button.moreFilters') }}
                    <span v-if="selectedFilters" class="filter-selected">
                      <p>{{ selectedFilters }}</p>
                    </span>
                  </p>
                </div>
                <div>
                  <span
                    class="material-symbols-rounded icon-up font-20 dropdown-filter"
                    :class="{ 'icon-dropdown ds-blue-color': historyMenu === true }"
                    small
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card width="283" class="filters-card" :class="{ 'filters-card-open': historyMenu === true }">
              <div class="list-filters">
                <v-list-group :value="false" append-icon="mdi-chevron-down font-16">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="
                        selectedActivities.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'
                      "
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('title.activities') }}
                      <span v-if="selectedActivities.length" class="filter-selected-item">
                        <p>{{ selectedActivities.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters custom-checkbox"
                        :key="`campaign-filter-${index}`"
                        v-for="(activity, index) in activities"
                      >
                        <input
                          type="checkbox"
                          :key="`search-input-${index}`"
                          :id="`tag-option-${activity.type}`"
                          :value="activity.type"
                          v-model="selectedActivities"
                        />
                        <label class="label-filters" :for="`tag-option-${activity.type}`" :key="`tag-label-${index}`">
                          {{ activity.name }}
                        </label>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
                <v-list-group
                  v-if="selectedActivities.some((activity) => activity === 'message')"
                  class="list-groups"
                  :value="false"
                  append-icon="mdi-chevron-down font-16"
                >
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedChannels.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('title.channels') }}
                      <span v-if="selectedChannels.length" class="filter-selected-item">
                        <p>{{ selectedChannels.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters custom-checkbox"
                        :key="`campaign-filter-${index}`"
                        v-for="(channel, index) in channels"
                      >
                        <input
                          type="checkbox"
                          :key="`search-input-${index}`"
                          :id="`tag-option-${channel.type}`"
                          :value="channel.type"
                          v-model="selectedChannels"
                        />
                        <label class="label-filters" :for="`tag-option-${channel.type}`" :key="`tag-label-${index}`">
                          {{ channel.name }}
                        </label>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
              </div>
              <div class="div-row filters-buttons" v-if="selectedFilters !== 0">
                <a class="button-link" @click="clearFilters()"> {{ $t('button.clear') }} </a>
                <ButtonDefault
                  :name="`${$t('button.apply')}`"
                  data-cy="button-view-fields"
                  class="buttons-specs"
                  :disabled="selectedFilters === 0"
                  @click="getContactHistory()"
                />
              </div>
            </v-card>
          </v-menu>
        </div>
        <div class="activity-history div-column p-4">
          <DataLoader
            :isLoading="isLoadingHistory"
            :type="'table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line, table-heading'"
            :noShadow="true"
            class="data-loader-card"
          />
          <div class="div-column activity-history-container" :class="isLoadingHistory ? 'd-none' : ''">
            <div v-if="contactsHistory.length > 0" class="div-column gap-10 pr-3">
              <div
                class="div-row align-items-start justify-content-between py-3 history-items"
                v-for="(activity, index) in contactsHistory"
                :key="`${activity.type}-${index}`"
              >
                <div class="div-row align-items-start gap-10">
                  <div
                    class="d-flex align-items-center activity-icon"
                    :style="{ backgroundColor: getEventColor(activity.event) }"
                  >
                    <img
                      v-if="activity.message_type === 'whatsapp'"
                      src="@/assets/whatsapp-icon-white.svg"
                      alt="activity icon"
                      width="17"
                    />
                    <span v-else class="material-symbols-rounded ds-white-color font-14">
                      {{ getActivityIcon(activity) }}
                    </span>
                  </div>
                  <div class="div-column" v-if="activity.type === 'automation'">
                    <div class="div-row align-items-center gap-5 ds-blue-color">
                      <span class="font-12 text-600">
                        {{ $t('create.automation') }}
                      </span>
                      <span class="font-12 text-600">{{
                        activity.status === 'completed'
                          ? $t('automation.completed')
                          : activity.status === 'canceled'
                          ? $t('automation.canceled')
                          : activity.status
                      }}</span>
                    </div>
                    <div class="div-row align-items-center gap-10 ds-gray-color">
                      <span class="font-10">{{ activity.automation_title }}</span>
                      <button
                        class="material-symbols-rounded font-14 ds-light-gray-color"
                        @click="openLink(activity.automation_id, 'automation')"
                      >
                        visibility
                      </button>
                    </div>
                    <div class="div-column" v-if="activity.customFields && typeof activity.customFields === 'object'">
                      <div
                        v-for="(value, key) in filteredUtmSource(activity.customFields)"
                        :key="key"
                        v-show="showIndex === index"
                        class="custom-fields-history pl-2 mt-2 div-column gap-5"
                      >
                        <span class="font-10 text-600">{{ $t('title.newCustomField') }}</span>
                        <span class="font-10 text-600 fit-content-item">{{ key }}</span>
                        <span class="font-10 text-400 source-chip fit-content-item">{{ value }}</span>
                      </div>
                      <button
                        class="show-history-button text-600 ds-blue-color text-uppercase pt-2"
                        @click="toggleCustomFields(index)"
                        v-if="Object.keys(filteredUtmSource(activity.customFields)).length > 0"
                      >
                        {{ showIndex === index ? $t('button.hideDetails') : $t('button.showDetails') }}
                      </button>
                    </div>
                  </div>
                  <div class="div-column gap-5" v-if="activity.type === 'message'">
                    <div class="div-row align-items-center gap-5">
                      <span class="font-12 text-600" :style="{ color: getEventColor(activity.event) }">
                        {{ getEventsTitle(activity.event, activity.message_type) }}
                      </span>
                    </div>
                    <div class="div-row align-items-center gap-5">
                      <span class="">{{ activity.message_title }}</span>
                      <button
                        v-if="activity.message_id"
                        class="material-symbols-rounded font-14 ds-light-gray-color"
                        @click="openMessage(activity.message_id)"
                      >
                        visibility
                      </button>
                    </div>
                  </div>
                  <div class="div-column gap-5" v-if="activity.type === 'custom_event'">
                    <div class="div-row align-items-center gap-5 ds-blue-color">
                      <span class="font-12 text-600">
                        {{ $t('title.triggeredEvent') }}
                      </span>
                    </div>
                    <div class="div-row align-items-center gap-5">
                      <span class="">{{ activity.event }}</span>
                      <button
                        class="material-symbols-rounded font-14 ds-light-gray-color"
                        @click="openLink(activity.event_id, 'event')"
                      >
                        visibility
                      </button>
                    </div>
                  </div>
                </div>
                <div class="activity-right-info">
                  {{ formatDateTime(activity.type === 'automation' ? activity.created_at : activity.time) }}
                </div>
              </div>
              <button
                v-if="isMoreItems"
                class="ds-blue-color text-600 text-uppercase font-12"
                @click="getContactHistory(1)"
              >
                {{ $t('input.showMore') }}
              </button>
            </div>
            <div v-else class="div-row align-items-center justify-content-center">
              <span class="font-12 text-600 ds-gray-color">{{ $t('input.noHistory') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="custom-fields div-column gap-15">
      <h5 class="card-title mb-0">{{ $t('sidebar.customFields') }}</h5>
      <InputDefault
        :modelValue="customFieldsSearch"
        :placeholder="`${$t('input.search')}`"
        :prependIcon="'search'"
        :keyInput="'customFieldsSearch'"
        @updateInput="searchCustomFields"
      />
      <div class="custom-fields-container div-column">
        <DataLoader
          :isLoading="isLoadingCustomFields"
          :type="'table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line,table-heading, list-item-two-line, table-heading'"
          :noShadow="true"
          class="data-loader-card"
        />
        <table class="custom-fields-table d-flex my-4 mr-2" :class="isLoadingCustomFields ? 'd-none' : ''">
          <tbody v-if="filteredCustomFields && filteredCustomFields.length > 0" class="w-100">
            <tr
              class="div-row align-items-center justify-content-between"
              v-for="field in filteredCustomFields"
              :key="field.customFieldId"
            >
              <td class="ml-4">
                <span class="font-12 text-600"> {{ field.title }} </span>
              </td>
              <div class="div-row align-items-center gap-10">
                <td>
                  <div class="div-column gap-5 align-items-end">
                    <div class="font-10 ds-gray-color">{{ field.value }}</div>
                    <div class="font-8 ds-light-gray-color">
                      {{ formatDate(field.updatedAt) }}
                    </div>
                  </div>
                </td>
                <td>
                  <button
                    class="material-symbols-rounded font-18 ds-light-gray-color"
                    @click="openLink(field.customFieldId, 'fields', field.value, field.title)"
                  >
                    edit
                  </button>
                </td>
              </div>
            </tr>
          </tbody>
          <tbody v-else>
            <div class="no-custom-fields">{{ `${$t('datatable.noCustomFields')}` }}</div>
          </tbody>
        </table>
      </div>
    </div>
    <EditDetailsModal
      :dialog="showDetailsModal"
      :eventType="modalType"
      @hideModal="showDetailsModal = false"
      :contactData="currentContact"
    />
    <v-dialog v-model="showMessageModal">
      <MessagePreview :messageId="messageId" @closeMessagePreview="closeMessagePreview" />
    </v-dialog>
    <v-dialog v-model="showCustomFieldsModal">
      <div class="div-column gap-15 ds-gray-color p-4 custom-fields-modal">
        <div class="div-row align-items-center justify-content-between">
          <span class="text-600 font-16">{{ $t('input.editCustomField') }}</span>
          <button class="material-symbols-rounded font-20 ds-light-gray-color" @click="showCustomFieldsModal = false">
            close
          </button>
        </div>
        <div class="div-row gap-10 w-100">
          <InputDefault
            :name="$t('title.customField')"
            :modelValue="selectedCustomFieldTitle"
            :keyInput="'selectedCustomFieldTitle'"
            :disabled="true"
            :fontSize="'10px'"
          />
          <InputDefault
            :name="$t('input.value')"
            :modelValue="selectedCustomFieldValue"
            :placeholder="`${$t('input.writeValue')}`"
            :fontSize="'10px'"
            @updateInput="changeCustomField($event)"
          />
        </div>
        <div class="div-row align-items-center justify-content-end w-100">
          <ButtonDefault :name="$t('button.save')" @click="editCustomField()" class="btn-default buttons-specs" />
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import ServicesService from '@/modules/messages/services/services.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import { ContactsDto } from '../dto/contacts.dto';
import ContactService from '../services/contacts.service';
import InputDefault from '@/components/input/InputDefault.vue';
import ApiService from '@/services/api.service';
import { mapState } from 'vuex';
import dayjs from 'dayjs';
import AutomationsService from '@/modules/automations/services/automations.service';
import EditDetailsModal from '../components/EditDetailsModal.vue';
import { TagDto } from '@/modules/tags/dtos/tag.dto';
import ToastService from '@/services/toast.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { debounce } from '@/util/debounce';
import { createHmac } from 'crypto';
import MessagePreview from '@/components/common/MessagePreview.vue';
import { areObjectsEqual } from '@/util/objects';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';

interface ContactChannelInfo {
  icon: string;
  channel: string;
  identifier: string | number;
  entrance: Date | string;
  isActive: any;
  lastInteraction: Date | string;
  lastClick: Date | string;
  lastOpen: Date | string;
  lastDelivered: Date | string;
  lastSent: Date | string;
}

interface Automation {
  automationTitle: string;
  createdAt: string;
  status: string;
}

interface Option {
  name: string;
}

interface CustomField {
  title: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
  customFieldId: number;
}

@Component({
  components: { InputDefault, EditDetailsModal, ButtonDefault, MessagePreview, DataLoader },
  providers: [ServicesService],
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage', 'currentAccount']),
  },
})
export default class ContactsInformations extends Vue {
  private readonly toastService = new ToastService();
  private readonly contactService = new ContactService();
  private api = new ApiService();
  private readonly automationService = new AutomationsService();
  public userLanguage!: string;
  public selectedDates: any = [];
  public currentAccountTimezone!: string;
  public currentAccount!: AccountDto;

  currentContact: ContactsDto = {} as ContactsDto;
  channelIcons = [
    { key: 'email' as const, icon: 'email', label: 'datatable.email' },
    { key: 'webpush' as const, icon: 'computer', label: 'datatable.web-push' },
    { key: 'mobilepush' as const, icon: 'smartphone', label: 'datatable.mobile-push' },
    { key: 'sms' as const, icon: 'sms', label: 'title.sms' },
    { key: 'wpp' as const, icon: '', label: 'datatable.whatsapp' },
  ];
  activeChannels = {
    email: false,
    webpush: false,
    mobilepush: false,
    sms: false,
    wpp: false,
  };
  contactFullName = '';
  emailHash: any;
  gravatarUrl = '';
  gravatarImage = false;
  headers: any = [];
  contactChannelsInfo: ContactChannelInfo[] = [];
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  dateMenu = false;
  dateRangeText = '';
  isDateRange = false;
  customFieldsSearch = '';
  filteredCustomFields: CustomField[] = [];
  selectedOptionData: any = [];
  showDetailsModal = false;
  modalType = '';
  contactsTagsIds: number[] = [];
  tags: TagDto[] = [];
  newTags: TagDto[] = [];
  tagMenu = false;
  tagId: number[] = [];
  isLoading = false;
  contactsHistory: any[] = [];
  messageId: number | null = null;
  showMessageModal = false;
  showIndex: number | null = null;
  currentPage = 0;
  historyMenu = false;
  selectedActivities: string[] = [];
  selectedChannels: string[] = [];
  activities = [
    { type: 'automation', name: this.$t('title.automation') },
    { type: 'custom_events', name: this.$t('sidebar.customEvents') },
    { type: 'message', name: this.$t('sidebar.messages') },
  ];
  channels = [
    { type: 'email', name: this.$t('title.email') },
    { type: 'web-push', name: this.$t('title.push') },
    { type: 'mobile-push', name: this.$t('title.mobile-push') },
    { type: 'sms', name: this.$t('title.sms') },
    { type: 'wpp', name: this.$t('title.whatsapp') },
  ];
  isLoadingHistory = false;
  isMoreItems = false;
  isLoadingCustomFields = false;
  showCustomFieldsModal = false;
  selectedCustomFieldId: number | null = null;
  selectedCustomFieldValue = '';
  selectedCustomFieldTitle = '';
  oldCustomFieldValue = '';
  debouncedFindTags = debounce((item: string) => this.findTags(item), 300);

  get filteredTags() {
    return this.selectedOptionData.length > 0
      ? this.tags.filter((tag) => !this.selectedOptionData.includes(tag.name))
      : this.tags;
  }

  get selectedFilters() {
    return this.selectedActivities.length + this.selectedChannels.length;
  }

  async beforeMount() {
    await this.findTags();
    if (this.$route.params.contact_id) {
      this.getContact();
    }
    this.getValuesUrl();
    if (this.$route.query.startDate && this.$route.query.endDate) {
      this.selectedDates = [this.dateToVuetifyString(this.startDate), this.dateToVuetifyString(this.endDate)];
      await this.changeDatePicker(this.selectedDates);
    }
    if (!this.$route.query.startDate && !this.$route.query.endDate) {
      this.getContactHistory();
    }
  }

  itemName(item: string | Option): string {
    if (typeof item === 'string') {
      return item;
    }
    return item?.name || '';
  }

  async findTags(search?: string): Promise<any> {
    try {
      const response: any = await this.automationService.getTags({
        title: search || '',
        page: 1,
        type: 'tag',
        itemsPerPage: 50,
      });
      this.tags = response.data.results;
      return response.data.results;
    } catch (err) {
      throw err;
    }
  }

  async getContact() {
    const contactId = +this.$route.params.contact_id;
    if (contactId) {
      this.currentContact = (await this.contactService.getContactById(contactId))?.data;

      if (this.currentContact.firstName && this.currentContact.lastName) {
        this.contactFullName = this.currentContact.firstName + ' ' + this.currentContact.lastName;
      } else {
        this.contactFullName = this.currentContact.firstName as string;
      }

      this.$emit('contactName', this.contactFullName);

      this.updateChannels();

      if (this.currentContact && this.currentContact.contactTag) {
        this.selectedOptionData = this.currentContact.contactTag.map((tag: string) => tag);
      }

      if (this.currentContact && this.currentContact.customFields) {
        this.isLoadingCustomFields = true;
        this.filteredCustomFields = this.currentContact.customFields.map((customField: any) => ({
          title: customField.title,
          value: customField.value,
          createdAt: customField.createdAt,
          updatedAt: customField.updatedAt,
          customFieldId: customField.customFieldId,
        }));
        this.isLoadingCustomFields = false;
      }

      this.emailHash = createHmac('sha256', this.currentContact.email as string).digest('hex');

      this.gravatarUrl = `https://www.gravatar.com/avatar/${this.emailHash}?d=404`;

      fetch(this.gravatarUrl).then((response) => {
        if (response.status === 404) {
          this.gravatarImage = false;
        } else {
          this.gravatarImage = true;
        }
      });
    }
  }

  updateChannels() {
    this.activeChannels.email = !!this.currentContact.hasEmail;
    this.activeChannels.webpush = !!this.currentContact.hasWebPush;
    this.activeChannels.mobilepush = !!this.currentContact.hasMobilePush;
    this.activeChannels.sms = !!this.currentContact.hasPhone;
    this.activeChannels.wpp = !!this.currentContact.hasWhatsapp;

    function checksDataExistence(hasChannel: any, channelData: any) {
      return hasChannel ? channelData : null;
    }

    function lastInteraction(lastOpenDate: any, lastClickDate: any) {
      switch (true) {
        case lastOpenDate && lastClickDate:
          return lastOpenDate > lastClickDate ? lastOpenDate : lastClickDate;
        case lastOpenDate && !lastClickDate:
          return lastOpenDate;
        case lastClickDate && !lastOpenDate:
          return lastClickDate;
        default:
          return null;
      }
    }

    const isEmailActive =
      this.currentContact.hasEmail &&
      !this.currentContact.hasBounced &&
      !this.currentContact.isUnsubscribed &&
      this.currentContact.isValid &&
      this.currentContact.isActive
        ? this.$t('datatable.deliverable')
        : this.$t('datatable.notDeliverable');

    const channelConfigs = [
      {
        active: this.activeChannels.email,
        config: {
          icon: 'email',
          channel: 'Email',
          identifier: this.currentContact.email as string,
          entrance: checksDataExistence(this.currentContact.hasEmail, this.currentContact.createdAt),
          isActive: checksDataExistence(this.currentContact.hasEmail, isEmailActive),
          lastInteraction: checksDataExistence(
            this.currentContact.hasEmail,
            lastInteraction(this.currentContact.lastOpenDate, this.currentContact.lastClickDate)
          ),
          lastSent: checksDataExistence(this.currentContact.hasEmail, this.currentContact.lastSent),
          lastClick: checksDataExistence(this.currentContact.hasEmail, this.currentContact.lastClick),
          lastOpen: checksDataExistence(this.currentContact.hasEmail, this.currentContact.lastOpen),
          lastDelivered: checksDataExistence(this.currentContact.hasEmail, this.currentContact.lastSent),
        },
      },
      {
        active: this.activeChannels.webpush,
        config: {
          icon: 'computer',
          channel: 'Web Push',
          identifier: this.currentContact.webPush,
          entrance: checksDataExistence(this.currentContact.hasWebPush, this.currentContact.createdAt),
          isActive: null,
          lastInteraction: checksDataExistence(
            this.currentContact.hasWebPush,
            lastInteraction(this.currentContact.webPushLastOpen, this.currentContact.webPushLastClick)
          ),
          lastSent: checksDataExistence(this.currentContact.hasWebPush, this.currentContact.webPushLastSent),
          lastClick: checksDataExistence(this.currentContact.hasWebPush, this.currentContact.webPushLastClick),
          lastOpen: checksDataExistence(this.currentContact.hasWebPush, this.currentContact.webPushLastOpen),
          lastDelivered: checksDataExistence(this.currentContact.hasWebPush, this.currentContact.webPushLastDelivered),
        },
      },
      {
        active: this.activeChannels.mobilepush,
        config: {
          icon: 'smartphone',
          channel: 'Push Mobile',
          identifier: this.currentContact.phone as string,
          entrance: checksDataExistence(this.currentContact.hasWebPush, this.currentContact.createdAt),
          isActive: null,
          lastInteraction: checksDataExistence(
            this.currentContact.hasMobilePush,
            lastInteraction(this.currentContact.mobPushLastOpen, this.currentContact.mobPushLastClick)
          ),
          lastSent: checksDataExistence(this.currentContact.hasMobilePush, this.currentContact.mobPushLastSent),
          lastClick: checksDataExistence(this.currentContact.hasMobilePush, this.currentContact.mobPushLastClick),
          lastOpen: checksDataExistence(this.currentContact.hasMobilePush, this.currentContact.mobPushLastOpen),
          lastDelivered: checksDataExistence(
            this.currentContact.hasMobilePush,
            this.currentContact.mobPushLastDelivered
          ),
        },
      },
      {
        active: this.activeChannels.sms,
        config: {
          icon: 'sms',
          channel: 'SMS',
          identifier: this.currentContact.phone as string,
          entrance: checksDataExistence(this.currentContact.hasPhone, this.currentContact.createdAt),
          isActive: null,
          lastInteraction: checksDataExistence(
            this.currentContact.hasPhone,
            lastInteraction(this.currentContact.smsLastOpen, this.currentContact.smsLastClick)
          ),
          lastSent: checksDataExistence(this.currentContact.hasPhone, this.currentContact.smsLastSent),
          lastClick: checksDataExistence(this.currentContact.hasPhone, this.currentContact.smsLastClick),
          lastOpen: checksDataExistence(this.currentContact.hasPhone, this.currentContact.smsLastOpen),
          lastDelivered: checksDataExistence(this.currentContact.hasPhone, this.currentContact.smsLastDelivered),
        },
      },
      {
        active: this.activeChannels.wpp,
        config: {
          icon: '',
          channel: 'Whatsapp',
          identifier: this.currentContact.phone as string,
          entrance: this.currentContact.createdAt as Date,
          isActive: null,
          lastInteraction: checksDataExistence(
            this.currentContact.hasWhatsapp,
            lastInteraction(this.currentContact.whatsappLastOpen, this.currentContact.whatsappLastClick)
          ),
          lastSent: checksDataExistence(this.currentContact.hasWhatsapp, this.currentContact.whatsappLastSent),
          lastClick: checksDataExistence(this.currentContact.hasWhatsapp, this.currentContact.whatsappLastClick),
          lastOpen: checksDataExistence(this.currentContact.hasWhatsapp, this.currentContact.whatsappLastOpen),
          lastDelivered: checksDataExistence(
            this.currentContact.hasWhatsapp,
            this.currentContact.whatsappLastDelivered
          ),
        },
      },
    ];

    this.contactChannelsInfo = channelConfigs.filter((channel) => channel.active).map((channel) => channel.config);
  }

  searchCustomFields(searchTerm: string) {
    this.customFieldsSearch = searchTerm;
    if (this.currentContact && this.currentContact.customFields) {
      this.filteredCustomFields = this.currentContact.customFields.filter((customField: any) =>
        customField.title.toLowerCase().includes(searchTerm.toLowerCase())
      ) as CustomField[];
    }
  }

  checkDate(data: any) {
    if (!data) {
      return '-';
    }
    return data;
  }

  sortData(data: any) {
    const sortedData = data ? data.sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1)) : [];

    return sortedData;
  }

  showModal(type: string) {
    this.modalType = type;
    this.showDetailsModal = true;
  }

  getInitialNames() {
    let initiais = '';
    initiais += this.currentContact?.firstName ? this.currentContact.firstName[0] : '';
    initiais += this.currentContact?.lastName ? this.currentContact.lastName[0] : '';
    return initiais;
  }

  async updateTags(tagAction: string, item?: any) {
    try {
      this.isLoading = true;
      if (tagAction === 'remove') {
        const result = await this.findTags(item);
        this.tagId = result.filter((tag: any) => tag.name === item).map((tag: any) => tag.id);
      } else {
        this.tagMenu = false;
      }

      const response = await this.contactService.updateTag({
        contacts: [this.currentContact.id as number],
        tags: this.tagId.length > 0 ? this.tagId : item.map((tag: any) => tag.id),
        action: tagAction,
      });

      if (response && tagAction === 'add') {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.tagAdd') as string,
        });
      }

      if (response && tagAction === 'remove') {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.tagRemove') as string,
        });
        this.selectedOptionData = this.selectedOptionData.filter((tag: any) => tag !== item);
      }
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.tagError') as string,
      });
    }
    this.clearTags();
    this.getContact();
    this.isLoading = false;
  }

  clearTags() {
    this.newTags = [];
  }

  dateToVuetifyString(date?: Date): string {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateString = `${year}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`;
    return dateString;
  }

  async clearDate() {
    this.selectedDates = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.dateRangeText = '';
    this.isDateRange = false;
    this.getContactHistory();
  }

  async getContactHistory(page?: number) {
    this.isLoadingHistory = true;
    this.historyMenu = false;
    try {
      this.currentPage = page !== undefined ? this.currentPage + 1 : 1;
      const activities = this.selectedActivities.map((activity: any) => activity);
      const channels = this.selectedChannels.map((channel: any) => channel);

      const response = await this.contactService.getContactHistory(+this.$route.params.contact_id, {
        filters: {
          startDate: this.startDate,
          endDate: this.endDate,
          activities,
          channels,
        },
        pagination: {
          page: this.currentPage,
          itemsPerPage: 10,
        },
      });

      const history = response?.data?.results;
      this.isMoreItems = history.length > 0;
      this.contactsHistory = this.currentPage > 1 ? [...this.contactsHistory, ...history] : history;
      this.setValuesUrl();
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.tagError') as string,
      });
    } finally {
      this.isLoadingHistory = false;
    }
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
    this.dateRangeText = `${this.formatDate(dates[0].toDate())} - ${this.formatDate(dates[1].toDate())}`;
    this.isDateRange = true;
    this.dateMenu = false;
    this.getContactHistory();
  }

  selectDateFilter(dateRange: string | number): void {
    switch (dateRange) {
      case 'lastMonth':
        this.selectedDates[0] = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
        break;

      case 1:
        this.selectedDates[0] = dayjs().subtract(1, 'day').startOf('day').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().subtract(1, 'day').endOf('day').format('YYYY-MM-DD');
        break;

      default:
        this.selectedDates[0] = dayjs().subtract(Number(dateRange), 'day').format('YYYY-MM-DD');
        this.selectedDates[1] = dayjs().format('YYYY-MM-DD');
    }

    this.changeDatePicker(this.selectedDates);
  }

  getActivityIcon(activity: any) {
    if (activity.type === 'automation') {
      return 'account_tree';
    }

    if (activity.type === 'custom_event') {
      return 'bolt';
    }

    if (activity.type === 'message') {
      switch (activity.message_type) {
        case 'email':
          return 'mail';
        case 'web-push':
          return 'computer';
        case 'mobile-push':
          return 'smartphone';
        case 'sms':
          return 'sms';
        default:
          return 'question_mark';
      }
    }
    return 'info';
  }

  getEventColor(event: any) {
    if (event === 'open') {
      return '#076e62';
    }
    if (event === 'click') {
      return '#00CEFC';
    }
    if (event === 'sent') {
      return '#0057f4';
    }
    if (event === 'delivered') {
      return '#0FB75C';
    }
    if (event === 'close') {
      return '#F03232';
    }
    if (event === 'unsubscribe') {
      return '#8c0758';
    }
    if (event === 'bounce') {
      return '#FF9654';
    }
    return '#0057f4';
  }

  openMessage(messageId: number) {
    this.messageId = messageId;
    this.showMessageModal = true;
  }

  closeMessagePreview() {
    this.showMessageModal = false;
  }

  getEventsTitle(event: string, messageType: string) {
    let eventTitle = '';
    let messageTypeTitle = '';
    switch (event) {
      case 'open':
        eventTitle = this.$t('input.opened') as string;
        break;
      case 'click':
        eventTitle = this.$t('input.clicked') as string;
        break;
      case 'sent':
        eventTitle = this.$t('input.sent') as string;
        break;
      case 'delivered':
        eventTitle = this.$t('input.delivering') as string;
        break;
      case 'unsubscribe':
        eventTitle = this.$t('input.unsubscribed') as string;
        break;
      case 'bounce':
        eventTitle = this.$t('input.bounce') as string;
        break;
      case 'dropped':
        eventTitle = this.$t('input.dropped') as string;
        break;
      case 'deferred':
        eventTitle = this.$t('input.deferred') as string;
        break;
      case 'close':
        eventTitle = this.$t('input.close') as string;
        break;
    }
    switch (messageType) {
      case 'email':
        messageTypeTitle = this.$t('title.email') as string;
        break;
      case 'web-push':
        messageTypeTitle = this.$t('title.push') as string;
        break;
      case 'mobile-push':
        messageTypeTitle = this.$t('title.mobile-push') as string;
        break;
      case 'sms':
        messageTypeTitle = this.$t('title.sms') as string;
        break;
      case 'whatsapp':
        messageTypeTitle = this.$t('title.whatsapp') as string;
        break;
    }
    return this.userLanguage === 'pt-BR' ? `${eventTitle} ${messageTypeTitle}` : `${messageTypeTitle} ${eventTitle}`;
  }

  filteredUtmSource(customFields: Record<string, any>) {
    return Object.entries(customFields)
      .filter(([key]) => key === 'utm_source')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  }

  toggleCustomFields(index: number) {
    this.showIndex = this.showIndex === index ? null : index;
  }

  openLink(id: number, type: string, value?: string, title?: string) {
    if (type === 'automation') {
      window.open(`/automations/emails/${id}`, '_blank');
    }
    if (type === 'event') {
      window.open(`/custom-events/${id}`, '_blank');
    }
    if (type === 'fields') {
      this.showCustomFieldsModal = true;
      this.selectedCustomFieldId = id;
      this.oldCustomFieldValue = value || '';
      this.selectedCustomFieldValue = value || '';
      this.selectedCustomFieldTitle = title || '';
    }
  }

  async clearFilters() {
    this.selectedActivities = [];
    this.selectedChannels = [];
    this.$router.replace({
      query: {
        ...this.$route.query,
        channels: undefined,
        activities: undefined,
      },
    });
    this.getContactHistory();
  }

  getValuesUrl() {
    if (this.$route.query.startDate) {
      const date = new Date(this.$route.query.startDate as string);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      this.startDate = date;
    }

    if (this.$route.query.endDate) {
      const date = new Date(this.$route.query.endDate as string);
      date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
      this.endDate = date;
    }

    if (this.$route.query.activities) {
      const activitiesHistory = this.$route.query.activities as string;
      this.selectedActivities = activitiesHistory.split(',').map((itemQuery: string) => itemQuery);
    }

    if (this.$route.query.channels) {
      const channelsHistory = this.$route.query.channels as string;
      this.selectedChannels = channelsHistory.split(',').map((itemQuery: string) => itemQuery);
    }
  }

  setValuesUrl() {
    const activities = this.selectedActivities.map((item: any) => item).join(',');
    const channels = this.selectedChannels.map((item: any) => item).join(',');

    const query = {
      startDate: this.dateToVuetifyString(this.startDate),
      endDate: this.dateToVuetifyString(this.endDate),
      activities: activities || '',
      channels: channels || '',
    };

    if (areObjectsEqual(this.$route.query, query) === false) {
      this.$router.push({ query });
    }

    if (!activities && !channels && !this.startDate && !this.endDate) {
      this.$router.push({ query: {} });
    }
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) {
      return '--';
    }
    return Vue.filter('formatDate')(date);
  }

  formatDateTime(date: Date | string): string {
    return Vue.filter('formatDateTime')(date);
  }

  closeCustomFieldsModal() {
    this.showCustomFieldsModal = false;
  }

  changeCustomField(value: string) {
    this.selectedCustomFieldValue = value;
  }

  async editCustomField() {
    await this.contactService.updateContactCustomField({
      accountId: this.currentAccount.id || 0,
      contactId: +this.$route.params.contact_id,
      customFieldId: this.selectedCustomFieldId || 0,
      value: this.selectedCustomFieldValue,
      oldValue: this.oldCustomFieldValue,
    });
    this.toastService.show({
      type: 'success',
      text: this.$t('toast.customFieldUpdated') as string,
    });
    this.closeCustomFieldsModal();
    await this.getContact();
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
.title-field {
  font-size: 18px;
  color: $ds-blue;
  font-weight: bold;
}
::v-deep.view-new-contact {
  width: 100%;
  padding: 0 16px;
}

.view-new-contact {
  .main-section {
    align-items: center;

    .left-section {
      width: 50%;
    }

    .right-section {
      width: 50%;
    }
  }

  .card-title {
    color: $ds-gray;
    font-weight: 600;
  }
}

::v-deep .v-input__slot {
  background-color: #e9ecef !important;
}
.v-card {
  border-radius: 12px;
}
.text-timeline {
  font-size: 12px;
}
.text-timeline-info {
  font-weight: bold;
  color: $ds-blue;
}
.scroll-card {
  height: 750px;
  overflow-y: auto;
  overflow-x: hidden;
}

.contact-details {
  padding: 23px 20px 20px;
  color: $ds-gray;

  .contact-info {
    display: flex;
    justify-content: space-between;
    padding-top: 5px;
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  p {
    margin: 0;
  }
}

.channel-info {
  padding: 23px 20px 20px;
  color: $ds-gray;

  .channels-container {
    overflow-x: auto;
  }

  h6 {
    margin-bottom: 20px;
    font: 600 12px/12px 'Inter', sans-serif;
  }
}

.tags {
  color: $ds-gray;
  max-height: 26.1vh;

  h6 {
    font: 600 12px/12px 'Inter', sans-serif;
  }
}

.channels-table {
  width: 100%;
  tbody {
    tr {
      border-bottom: 1px solid $ds-gray-300;
      &:last-child {
        border-bottom: none;
      }
      td {
        padding-right: 20px;
        min-width: 100px;
        height: 40px;

        &:last-child {
          padding-right: 0;
        }
      }
    }
  }
}

.tags-chip {
  max-height: 24.2rem;
  overflow-y: auto;
}

.c-autocomplete {
  border: none !important;
}

.c-autocomplete ::v-deep .v-input__slot {
  background-color: white !important;
  margin-bottom: -10px !important;
  border: none !important;
  box-shadow: none !important;
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-top: 1px solid $ds-gray-300 !important;
  border-bottom: 1px solid $ds-gray-300 !important;
  height: 36px !important;
  border-radius: 8px !important;
}

.c-autocomplete ::v-deep .v-autocomplete__content {
  margin-top: -1 !important;
  top: 100% !important;
  border-top: none !important;
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-bottom: 1px solid $ds-gray-300 !important;
  border-radius: 0px 0px 8px 8px !important;
  box-shadow: none !important;
}

.c-autocomplete ::v-deep .v-input--is-focused + .v-input__slot {
  border-left: 1px solid $ds-gray-300 !important;
  border-right: 1px solid $ds-gray-300 !important;
  border-top: 1px solid $ds-gray-300 !important;
  border-bottom: 0px solid $ds-gray-300 !important;
  border-radius: 8px 8px 0px 0px !important;
}

.c-autocomplete ::v-deep .v-input--is-focused + .v-menu__content {
  border: 1px solid $ds-blue !important;
  border-top: none !important;
  border-radius: 0 0 8px 8px !important;
}

.c-autocomplete ::v-deep .v-list-item__action {
  display: none !important;
}

.activity-history {
  color: $ds-gray;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14),
    0px 1px 5px 0px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  max-height: 100vh;
}

.activity-history-container {
  overflow-y: auto;
}

.activity-icon {
  border-radius: 50%;
  padding: 5px;
}

.history-items {
  border-bottom: 1px solid $ds-gray-200;
}

.custom-fields-history {
  border-left: 1px solid $ds-gray-200;
}

.inactive {
  color: #d9d9d9;
}

.v-menu__content {
  border-radius: 0 0 8px 8px !important;
}

.date-picker {
  height: fit-content !important;
}

.date-button {
  width: 283px;
  margin-bottom: 8px;
  border-radius: 8px;
  padding-left: 11px !important;
  padding-right: 11px !important;
  height: 36px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: #ffffff !important;
  box-shadow: none;
  overflow: unset !important;
  border-radius: 8px;
  color: $ds-gray;

  .calendar-date {
    display: flex;
    align-items: center;

    .calendar-icon {
      margin-right: 8px;
    }
  }
}

.button-border {
  border: 1px solid $ds-gray-300;
}

.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.date-filters {
  display: flex;
  flex-direction: column;
}

.date-period {
  border-bottom: 1px solid $ds-gray-100;
  font-weight: 400;
  font-size: 12px;
  box-shadow: none;
  background-color: #ffffff !important;
  place-content: start;
  text-transform: initial !important;
  border-radius: 0px;
}

.first-period {
  border-top: 1px solid $ds-gray-100;
}

.last-period {
  border-radius: 0px 0px 8px 8px;
}

.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.autocomplete-counter {
  height: 20px;
  width: 20px;
  border-radius: 50%;
  background-color: $ds-blue;
  justify-content: center;
}

.profile {
  width: 130px;
  height: 130px;
  border-radius: 75px;
  font-size: 45px;
  line-height: 130px;
  margin: auto;
  font-weight: bold;
  text-align: center;
  background-color: $ds-blue;
  color: white;
}

.tag-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  z-index: 999;
}

.tag-button {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  box-shadow: none;
  background: #ffffff;
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
}

.tag-select {
  color: $ds-gray-300;
  font-weight: 400;
  font-size: 12px;
  text-transform: capitalize;
}

.search-bar-select {
  background: #ffffff;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
  padding-right: 12px;
  padding-left: 12px;
  overflow: hidden;
}

.tag-card {
  border-radius: 8px;
  border: 1px solid $ds-blue;
}

.search-input {
  min-height: 37px !important;
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: -webkit-fill-available;
}

.menu-tags {
  display: flex;
  flex-direction: row;
  padding-right: 12px;
  padding-left: 12px;
  align-items: center;
  justify-content: space-between;
  border: 1px solid $ds-gray-300;
  min-height: 36px !important;
  border-radius: 8px;
  color: $ds-gray-300;
  cursor: default;
}

.input-tag {
  font-size: 12px;
  font-weight: 400;
}

.tag-list {
  max-height: 14em;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background-color: #ffffff;
}

.checkbox-tag {
  padding-top: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid $ds-gray-100;
  display: flex;
  flex-direction: row;
  gap: 0.5em;
}

.input-filters {
  margin: 0 !important;
  cursor: pointer;
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
}

.clear-apply {
  display: flex;
  align-items: center;
  gap: 1em;
  justify-content: flex-end;
}

.clear-tags {
  text-decoration: underline;
  font-weight: 400;
  font-size: 12px;
}

.clear-tags:disabled {
  color: $ds-gray-300;
}

.buttons-specs {
  display: flex;
  align-items: center;
  text-align: center;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  box-shadow: none;
  font-weight: 700;
  font-size: 10px;
  max-height: 26px !important;
  padding: 15px !important;
}

.clear-fields {
  justify-self: flex-end;
}

@keyframes rotateRight {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotate-icon {
  animation: rotateRight 2s linear infinite;
}

.source-chip {
  border: 1px solid $ds-gray-300;
  border-radius: 16px;
  padding: 5px 10px;
}

.fit-content-item {
  width: fit-content;
}

.show-history-button {
  letter-spacing: 0.16em;
  place-self: start;
  font-size: 8px;
}

.custom-fields-container {
  color: $ds-gray;
  overflow: hidden;
  background-color: white;
  border-radius: 16px;
  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14),
    0px 1px 5px 0px rgba(0, 0, 0, 0.12);
}

.custom-fields-table {
  overflow-y: auto;
  max-height: 30rem;
  justify-content: center;
  tr {
    display: flex;
    width: 100%;
    border-bottom: 1px solid $ds-gray-100;
    padding: 10px 0;
    &:first-child {
      padding-top: 0px;
    }
  }

  td:last-child {
    margin-right: 10px;
  }

  .icon {
    cursor: pointer;
  }

  .no-custom-fields {
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    font: 400 12px/12px 'Inter', sans-serif;
    color: $ds-gray;
  }
}

::v-deep .v-input__slot {
  background-color: white !important;
  width: 30rem !important;
}

.menu-filters {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 9px;

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

.menu-filters-item__hasfilters {
  font-weight: bold;
}

.filters-title {
  color: $ds-gray;
  font-size: 12px !important;
}

.filters-title:active {
  color: $ds-gray;
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
    margin-bottom: 0px !important;
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

.checkbox-filters {
  margin-left: 8px;
  margin-bottom: 8px;
}

.input-filters {
  margin: 0 !important;
  cursor: pointer;
  width: 12px;
  height: 12px;
  border-radius: 4px;
}

.label-filters {
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-transform: capitalize;
  width: 220px;
  display: block;
  overflow: hidden;
  margin: 0 0 0 8px !important;
  cursor: pointer;
  color: $ds-gray;
  flex: 1;
}

.filters-card {
  border-radius: 8px;
}

.filters-label {
  color: $ds-blue;
}

.filters-list {
  border-top: 1px solid $ds-gray-100;
  overflow-y: scroll;
  display: flex;
  flex-direction: column;
  gap: 0.25em;
  padding-top: 8px;
  padding-bottom: 8px;
  overflow: auto;
  background-color: #ffffff;
}

.filters-buttons {
  padding: 0.5em;
  justify-content: flex-end;
  gap: 15px;
  overflow: hidden;
  border-top: 1px solid $ds-gray-100;
}

.button-link {
  font-size: 12px;
  justify-content: center;
  color: #0057f4;
  text-decoration: none;
  font-weight: 600;
  text-transform: uppercase;
  align-content: center;
  letter-spacing: 0.07em;
}

.filters-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.custom-fields-modal {
  background-color: white;
  border-radius: 16px;
}

@media (max-width: 1601px) {
  .history-filters {
    display: flex;
    flex-direction: column;
    align-self: start;
  }
}

@media (min-width: 1600px) {
  .history-filters {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
}

::v-deep .v-list-group {
  border-top: 1px solid $ds-gray-100;
}

::v-deep .v-list-item__content {
  border-bottom-right-radius: 8px;
  border-bottom-left-radius: 8px;
}

::v-deep.v-list-group > .v-list-group__header > .v-list-group__header__append-icon .v-icon {
  color: $ds-blue !important;
}

::v-deep .v-date-picker-table {
  height: fit-content !important;
  margin-bottom: 10px;
}

::v-deep .v-chip {
  height: 24px;
}

::v-deep .v-chip__content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

::v-deep .v-dialog {
  width: fit-content;
  border-radius: 16px;
}
</style>
