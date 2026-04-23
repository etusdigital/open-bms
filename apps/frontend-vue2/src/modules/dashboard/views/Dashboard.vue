<template>
  <div class="col-12">
    <div class="title-route">
      <h2 class="c-title">{{ $t('sidebar.dashboard') }}</h2>
    </div>
    <div class="div-row gap-10 nav-bar-pages">
      <router-link
        v-for="message in messagesPages"
        :key="`message-${message.title}`"
        :to="message.router"
        :class="[
          message.router === $route.path.replace('transactional-', '') ? 'active-class' : 'inactive-class',
          'messages-pages text-600 font-14',
        ]"
      >
        {{ message.title }}
      </router-link>
    </div>
    <div class="date-select">
      <div>
        <v-menu
          ref="menu"
          v-model="menu"
          class="date-menu"
          :close-on-content-click="false"
          bottom
          transition="scale-y-transition"
          offset-y
          width="283"
        >
          <template v-slot:activator="{ on }">
            <v-btn class="date-button" :class="{ 'date-button-open': menu === true }" v-on="on" @click="menu = true">
              <div class="calendar-date">
                <span
                  class="material-symbols-rounded font-24 calendar-icon"
                  :class="[menu ? 'calendar-icon-active' : '']"
                >
                  calendar_month
                </span>
                <span class="date-range">{{ dateRangeText || $t('button.selectDate') }}</span>
              </div>
              <div>
                <span
                  class="material-symbols-rounded icon-up font-20"
                  :class="{ 'icon-dropdown ds-blue-color': menu === true }"
                >
                  arrow_drop_down
                </span>
              </div>
            </v-btn>
          </template>
          <v-card class="filters-card" :class="{ 'filters-card-open': menu === true }">
            <v-date-picker
              width="280"
              no-title
              v-model="pickedDate"
              range
              :locale="userLanguage"
              :min="dateToVuetifyString(minFilterDate)"
              :max="dateToVuetifyString(new Date())"
              @input="changeDatePicker($event)"
            />
          </v-card>
        </v-menu>
      </div>
      <div class="container-filters-customize-metrics">
        <div class="container-filters-customize-metrics-switch" v-if="currentAccount.isInternal">
          <v-switch v-model="showMetricsByUser" inset :label="`Por usuário`"></v-switch>
        </div>

        <div class="customize-metrics-menu">
          <button @click="showCustomizeMetrics">
            <span class="material-symbols-rounded font-16">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24px"
                viewBox="0 -960 960 960"
                width="24px"
                fill="#5f6368"
              >
                <path
                  d="M240-160q-33 0-56.5-23.5T160-240q0-33 23.5-56.5T240-320q33 0 56.5 23.5T320-240q0 33-23.5 56.5T240-160Zm0-240q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm0-240q-33 0-56.5-23.5T160-720q0-33 23.5-56.5T240-800q33 0 56.5 23.5T320-720q0 33-23.5 56.5T240-640Zm240 0q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Zm240 0q-33 0-56.5-23.5T640-720q0-33 23.5-56.5T720-800q33 0 56.5 23.5T800-720q0 33-23.5 56.5T720-640ZM480-400q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm40 240v-123l221-220q9-9 20-13t22-4q12 0 23 4.5t20 13.5l37 37q8 9 12.5 20t4.5 22q0 11-4 22.5T863-380L643-160H520Zm300-263-37-37 37 37ZM580-220h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19Z"
                />
              </svg>
            </span>
          </button>
        </div>
        <div v-if="hasAnyFilter">
          <v-menu
            ref="menu"
            v-model="show"
            class="date-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="283"
          >
            <template v-slot:activator="{ on }">
              <v-btn class="date-button" :class="{ 'date-button-open': show === true }" v-on="on" @click="show = true">
                <div class="menu-filters" v-on="on">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    :class="{ 'menu-filters__hasfilters': show }"
                  >
                    <g id="Filtros">
                      <path
                        id="Vector"
                        d="M15.2 5.41176H0.8C0.587827 5.41176 0.384344 5.3374 0.234315 5.20502C0.0842855 5.07264 0 4.89309 0 4.70588C0 4.51867 0.0842855 4.33913 0.234315 4.20675C0.384344 4.07437 0.587827 4 0.8 4H15.2C15.4122 4 15.6157 4.07437 15.7657 4.20675C15.9157 4.33913 16 4.51867 16 4.70588C16 4.89309 15.9157 5.07264 15.7657 5.20502C15.6157 5.3374 15.4122 5.41176 15.2 5.41176ZM12.5333 8.70588H3.46667C3.25449 8.70588 3.05101 8.63151 2.90098 8.49913C2.75095 8.36676 2.66667 8.18721 2.66667 8C2.66667 7.81279 2.75095 7.63324 2.90098 7.50087C3.05101 7.36849 3.25449 7.29412 3.46667 7.29412H12.5333C12.7455 7.29412 12.949 7.36849 13.099 7.50087C13.249 7.63324 13.3333 7.81279 13.3333 8C13.3333 8.18721 13.249 8.36676 13.099 8.49913C12.949 8.63151 12.7455 8.70588 12.5333 8.70588ZM9.33333 12H6.66667C6.45449 12 6.25101 11.9256 6.10098 11.7933C5.95095 11.6609 5.86667 11.4813 5.86667 11.2941C5.86667 11.1069 5.95095 10.9274 6.10098 10.795C6.25101 10.6626 6.45449 10.5882 6.66667 10.5882H9.33333C9.54551 10.5882 9.74899 10.6626 9.89902 10.795C10.049 10.9274 10.1333 11.1069 10.1333 11.2941C10.1333 11.4813 10.049 11.6609 9.89902 11.7933C9.74899 11.9256 9.54551 12 9.33333 12Z"
                        fill="currentColor"
                      />
                    </g>
                  </svg>

                  <p
                    :class="{ 'menu-filters__hasfilters': filtersSelected }"
                    style="display: flex; flex-direction: row"
                  >
                    {{ $t('button.moreFilters') }}
                    <span v-if="filtersSelected" class="filter-selected">
                      <p>{{ filtersSelected }}</p>
                    </span>
                  </p>
                </div>
                <div>
                  <span
                    class="material-symbols-rounded icon-up font-20 dropdown-filter"
                    :class="{ 'icon-dropdown ds-blue-color': show === true }"
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card class="filters-card" width="283" :class="{ 'filters-card-open': show === true }">
              <div class="list-filters" v-if="$store.getters.can('campaigns:view')">
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="
                        selectedCampaigns.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'
                      "
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('sidebar.campaigns') }}
                      <span v-if="selectedCampaigns.length" class="filter-selected-item">
                        <p>{{ selectedCampaigns.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="search-bar pl-2">
                      <span class="material-symbols-rounded font-16"> search </span>
                      <input
                        id="header-menu__campaigns-search"
                        class="search-input pl-2"
                        type="text"
                        :placeholder="`${$t('input.search')}`"
                        @input="getCampaigns($event.target.value)"
                      />
                    </div>
                    <div class="filters-list">
                      <div class="checkbox-filters pl-2">
                        <input
                          type="checkbox"
                          v-model="isAllCampaigns"
                          @change="selectAll('campaigns')"
                          class="input-filters"
                          id="checkbox-campaigns"
                          :disabled="selectedCampaigns.length >= 1"
                        />
                        <label
                          :class="[
                            selectedCampaigns.length >= 1 ? 'label-filters label-filters-disabled' : 'label-filters',
                          ]"
                          for="checkbox-campaigns"
                          >{{ $t('input.allCampaigns') }}</label
                        >
                      </div>
                      <div
                        class="checkbox-filters pl-2"
                        :key="`campaign-filter-${index}`"
                        v-for="(campaign, index) in filterCampaigns"
                      >
                        <input
                          type="checkbox"
                          :key="`search-input-${index}`"
                          :id="`campaign-option-${campaign.id}`"
                          :value="campaign"
                          v-model="selectedCampaigns"
                          :disabled="isAllCampaigns"
                          class="input-filters"
                        />
                        <label
                          class="label-filters"
                          :for="`campaign-option-${campaign.id}`"
                          :key="`campaign-label-${index}`"
                          :class="[isAllCampaigns ? 'label-filters label-filters-disabled' : 'label-filters']"
                          >{{ campaign.title }}</label
                        >
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
              </div>
              <div v-if="$store.getters.can('automations:view')">
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="
                        selectedAutomations.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'
                      "
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('sidebar.automations') }}
                      <span v-if="selectedAutomations.length" class="filter-selected-item">
                        <p>{{ selectedAutomations.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="search-bar pl-2">
                      <span class="material-symbols-rounded font-16"> search </span>
                      <input
                        id="header-menu__campaigns-search"
                        class="search-input pl-2"
                        type="text"
                        :placeholder="`${$t('input.search')}`"
                        @input="getAutomations($event.target.value)"
                      />
                    </div>
                    <div class="filters-list">
                      <div class="checkbox-filters pl-2">
                        <input
                          type="checkbox"
                          class="input-filters"
                          id="checkbox-automations"
                          v-model="isAllAutomations"
                          @change="selectAll('automations')"
                          :disabled="selectedAutomations.length >= 1"
                        />
                        <label
                          for="checkbox-automations"
                          :class="[
                            selectedAutomations.length >= 1 ? 'label-filters label-filters-disabled' : 'label-filters',
                          ]"
                          >{{ $t('input.allAutomations') }}</label
                        >
                      </div>
                      <div
                        class="checkbox-filters pl-2"
                        :key="`automation-filter-${index}`"
                        v-for="(automation, index) in filterAutomations"
                      >
                        <input
                          type="checkbox"
                          :key="`automation-input-${index}`"
                          :id="`automation-option-${automation.id}`"
                          :value="automation"
                          v-model="selectedAutomations"
                          :disabled="isAllAutomations"
                          class="input-filters"
                        />
                        <label
                          :class="[isAllAutomations ? 'label-filters label-filters-disabled' : 'label-filters']"
                          :for="`automation-option-${automation.id}`"
                          :key="`automation-label-${index}`"
                          >{{ automation.title }}</label
                        >
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
              </div>
              <div v-if="$store.getters.can('messages:view')">
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedMessages.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('sidebar.messages') }}
                      <span v-if="selectedMessages.length" class="filter-selected-item">
                        <p>{{ selectedMessages.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="search-bar pl-2">
                      <span class="material-symbols-rounded font-16"> search </span>
                      <input
                        id="header-menu__campaigns-search"
                        class="search-input pl-2"
                        type="text"
                        :placeholder="`${$t('input.search')}`"
                        @input="getAutomationsMessages($event.target.value)"
                      />
                    </div>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters pl-2"
                        :key="`message-filter-${index}`"
                        v-for="(message, index) in filterMessages"
                      >
                        <input
                          type="checkbox"
                          :key="`message-input-${index}`"
                          :id="`message-option-${message.id}`"
                          :value="message"
                          v-model="selectedMessages"
                          class="input-filters"
                        />
                        <label
                          class="label-filters"
                          :for="`message-option-${message.id}`"
                          :key="`message-label-${index}`"
                          >{{ message.title }}</label
                        >
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
              </div>
              <div v-if="$store.getters.can('audience:tags_view')">
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedTags.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('sidebar.tags') }}
                      <span v-if="selectedTags.length" class="filter-selected-item">
                        <p>{{ selectedTags.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="search-bar pl-2">
                      <span class="material-symbols-rounded font-16"> search </span>
                      <input
                        id="header-menu__tags-search"
                        class="search-input pl-2"
                        type="text"
                        :placeholder="`${$t('input.search')}`"
                        @input="filterTags($event.target.value)"
                      />
                    </div>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters pl-2"
                        :key="`tag-filter-${index}`"
                        v-for="(tag, index) in filteredTags"
                      >
                        <input
                          type="checkbox"
                          :key="`tag-input-${index}`"
                          :id="`tag-option-${tag.id}`"
                          :value="tag"
                          v-model="selectedTags"
                          class="input-filters"
                        />
                        <label class="label-filters" :for="`tag-option-${tag.id}`" :key="`tag-label-${index}`">{{
                          tag.name
                        }}</label>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
              </div>
              <div v-if="$store.getters.can('audience:segments_view')">
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedSegments.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('sidebar.segments') }}
                      <span v-if="selectedSegments.length" class="filter-selected-item">
                        <p>{{ selectedSegments.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="search-bar pl-2">
                      <span class="material-symbols-rounded font-16"> search </span>
                      <input
                        id="header-menu__campaigns-search"
                        class="search-input pl-2"
                        type="text"
                        :placeholder="`${$t('input.search')}`"
                        @input="filterSegments($event.target.value)"
                      />
                    </div>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters pl-2"
                        :key="`segment-filter-${index}`"
                        v-for="(segment, index) in filteredSegments"
                      >
                        <input
                          type="checkbox"
                          :key="`segment-input-${index}`"
                          :id="`segment-option-${segment.id}`"
                          :value="segment"
                          v-model="selectedSegments"
                          class="input-filters"
                        />
                        <label
                          class="label-filters"
                          :for="`segment-option-${segment.id}`"
                          :key="`segment-label-${index}`"
                          >{{ segment.name }}</label
                        >
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
              </div>
              <div v-if="senders.length > 1 && $store.getters.can('infra:view')">
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedSenders.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('sidebar.sender') }}
                      <span v-if="selectedSenders.length" class="filter-selected-item">
                        <p>{{ selectedSenders.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters pl-2"
                        :key="`sender-filter-${index}`"
                        v-for="(sender, index) in filteredSenders"
                      >
                        <input
                          type="checkbox"
                          :key="`sender-input-${index}`"
                          :id="`sender-option-${sender.senderEmail}`"
                          :value="sender"
                          v-model="selectedSenders"
                          class="input-filters"
                        />
                        <label
                          class="label-filters"
                          :for="`sender-option-${sender.senderEmail}`"
                          :key="`sender-label-${index}`"
                        >
                          {{ sender.senderEmail }}
                        </label>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
              </div>
              <div v-if="originalSubUsers.length > 1">
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedSubUsers.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('sidebar.subUsers') }}
                      <span v-if="selectedSubUsers.length" class="filter-selected-item">
                        <p>{{ selectedSubUsers.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="search-bar pl-2">
                      <span class="material-symbols-rounded font-16"> search </span>
                      <input
                        id="header-menu__campaigns-search"
                        class="search-input pl-2"
                        type="text"
                        :placeholder="`${$t('input.search')}`"
                        @input="filterSubUsers($event.target.value)"
                      />
                    </div>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters pl-2"
                        :key="`segment-filter-${index}`"
                        v-for="(subUsers, index) in filteredSubUsers"
                      >
                        <input
                          type="checkbox"
                          :key="`subUsers-input-${index}`"
                          :id="`subUsers-option-${subUsers.value}`"
                          :value="subUsers"
                          v-model="selectedSubUsers"
                          class="input-filters"
                        />
                        <label
                          class="label-filters"
                          :for="`subUsers-option-${subUsers.value}`"
                          :key="`subUsers-label-${index}`"
                          >{{ subUsers.value }}</label
                        >
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
              </div>
              <div class="filters-buttons">
                <input
                  class="clear-fields"
                  :disabled="filtersSelected === 0"
                  text
                  @click="clearFilters()"
                  type="button"
                  :value="`${$t('button.clearFilters')}`"
                />
                <ButtonDefault
                  :name="`${$t('button.apply')}`"
                  data-cy="button-view-fields"
                  class="btn btn-c btn-light btn-light-c button-view-fields"
                  :disabled="filtersSelected === 0 && chipItems.length === 0"
                  @click="
                    getChipItems();
                    getStatistics();
                    show = false;
                  "
                />
              </div>
            </v-card>
          </v-menu>
        </div>
      </div>
    </div>
    <div class="filters-chips gap-5" :class="[isOpen ? 'expand-tags d-flex' : 'closed-tags div-row']">
      <div :class="[isOpen ? 'chip-expand' : 'div-row div-chip-gap']">
        <div class="md-chips filters-chips-color" :key="`chip-${index}`" v-for="(chip, index) in visibleChips">
          <div class="md-chip-icon">
            <div v-tooltip.bottom="$t(`sidebar.${chip.selectedFilter}`)">
              <span>{{ chip.typeRemove[8] }}</span>
            </div>
          </div>
          <span class="chip-text">{{ chip.title }}</span>
          <span
            class="material-symbols-rounded icon-chips cursor-pointer"
            @click="removeCategory(chip.typeRemove, chip)"
          >
            close
          </span>
        </div>
        <button class="open-chips text-600 font-12" v-on:click="isOpen = !isOpen" v-if="chipItems.length > 2">
          {{ isOpen ? $t('input.showLess') : '+' + `${chipItems.length - 2} ` + $t('input.others') }}
        </button>
      </div>
    </div>
    <div class="dashboard-cards-wrapper" v-if="!showMetricsByUser">
      <div class="dashboard-cards" :class="`cards-${type} ${showMetricsByUser ? 'cards-by-user' : ''}`">
        <div v-if="['web-push', 'mobile-push'].includes(type) && messageMetrics.sent.visible">
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="icon-title">
              <span class="material-symbols-rounded font-16 ds-gray-color">send</span>
              <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.sent') }}</p>
            </div>
            <div class="number-percentage">
              <p class="number-color-contacts number-align m-0 p-0" v-if="!showMetricsByUser">
                {{ statisticsData.general.sent | formatNumber }}
              </p>
              <p class="number-color-contacts number-align m-0 p-0" v-else>
                {{ statisticsData.general.unique_user_sent | formatNumber }}
              </p>
            </div>
          </v-card>
        </div>
        <div v-if="messageMetrics.delivered.visible">
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="icon-title">
              <span class="material-symbols-rounded font-16 ds-gray-color">check_circle</span>
              <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.delivered') }}</p>
            </div>
            <div class="number-percentage" v-if="['web-push', 'mobile-push'].includes(type)">
              <p class="number-color-open number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.delivered, statisticsData.general.sent) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.delivered | formatNumber }}</p>
            </div>
            <div class="number-percentage" v-else>
              <p class="number-color-contacts number-align m-0 p-0" v-if="!showMetricsByUser">
                {{ statisticsData.general.delivered | formatNumber }}
              </p>
              <p class="number-color-contacts number-align m-0 p-0" v-else>
                {{ statisticsData.general.unique_user_delivered | formatNumber }}
              </p>
            </div>
          </v-card>
        </div>
        <div v-if="!['web-push', 'mobile-push'].includes(type) && messageMetrics.open.visible">
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="icon-title">
              <span class="material-symbols-rounded font-16 ds-gray-color">drafts</span>
              <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.open') }}</p>
            </div>
            <div class="number-percentage" v-if="!showMetricsByUser">
              <p class="number-color-open number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.open, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.open | formatNumber }}</p>
            </div>
            <div class="number-percentage" v-else>
              <p class="number-color-open number-align m-0 p-0">
                {{
                  getPercentage(statisticsData.general.unique_user_open, statisticsData.general.unique_user_delivered)
                }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.unique_user_open | formatNumber }}</p>
            </div>
          </v-card>
        </div>
        <div
          v-if="
            !['web-push', 'mobile-push'].includes(type) && messageMetrics.unique_opens.visible && !showMetricsByUser
          "
        >
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="icon-title">
              <img src="../../../assets/circled-drafts.svg" />
              <p class="card-title-dashboard m-0 p-0">{{ messageMetrics.unique_opens.title }}</p>
            </div>
            <div class="number-percentage">
              <p class="number-color-unique-opens number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.unique_opens, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.unique_opens | formatNumber }}</p>
            </div>
          </v-card>
        </div>
        <div v-if="messageMetrics.click.visible">
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <span class="material-symbols-rounded font-16 ds-gray-color">web_traffic</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.click') }}</p>
              </div>
            </div>
            <div class="number-percentage" v-if="!showMetricsByUser">
              <p class="number-color-click number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.click, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.click | formatNumber }}</p>
            </div>
            <div class="number-percentage" v-else>
              <p class="number-color-click number-align m-0 p-0">
                {{
                  getPercentage(statisticsData.general.unique_user_click, statisticsData.general.unique_user_delivered)
                }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.unique_user_click | formatNumber }}</p>
            </div>
          </v-card>
        </div>
        <div
          v-if="
            !['web-push', 'mobile-push'].includes(type) && messageMetrics.unique_clicks.visible && !showMetricsByUser
          "
        >
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <img src="../../../assets/circled-arrow.svg" />
                <p class="card-title-dashboard m-0 p-0">{{ messageMetrics.unique_clicks.title }}</p>
              </div>
            </div>
            <div class="number-percentage">
              <p class="number-color-unique-click number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.unique_clicks, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.unique_clicks | formatNumber }}</p>
            </div>
          </v-card>
        </div>
        <div
          v-if="
            !['web-push', 'mobile-push'].includes(type) && messageMetrics.percentageCtor.visible && !showMetricsByUser
          "
        >
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <span class="material-symbols-rounded font-16 ds-gray-color">touch_app</span>
                <p class="card-title-dashboard m-0 p-0">CTOR</p>
              </div>
            </div>
            <div class="number-percentage">
              <p class="number-color-ctor number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.click, statisticsData.general.open) }}%
              </p>
            </div>
          </v-card>
        </div>
        <div v-if="!['web-push', 'mobile-push'].includes(type) && messageMetrics.unsubscribe.visible">
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <span class="material-symbols-rounded font-16 ds-gray-color">unsubscribe</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.unsubscribe') }}</p>
              </div>
            </div>
            <div class="number-percentage" v-if="!showMetricsByUser">
              <p class="number-color-unsubscribe number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.unsubscribe, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">
                {{ statisticsData.general.unsubscribe | formatNumber }}
              </p>
            </div>
            <div class="number-percentage" v-else>
              <p class="number-color-unsubscribe number-align m-0 p-0">
                {{
                  getPercentage(
                    statisticsData.general.unique_user_unsubscribe,
                    statisticsData.general.unique_user_delivered
                  )
                }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.unique_user_unsubscribe | formatNumber }}</p>
            </div>
          </v-card>
        </div>
        <div v-if="!['web-push', 'mobile-push'].includes(type) && messageMetrics.bounce.visible">
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <img src="../../../assets/bounce-icon.svg" />
                <p class="card-title-dashboard m-0 p-0">Bounce</p>
              </div>
            </div>
            <div class="number-percentage" v-if="!showMetricsByUser">
              <p class="number-color-bounce number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.bounce, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.bounce | formatNumber }}</p>
            </div>
            <div class="number-percentage" v-else>
              <p class="number-color-bounce number-align m-0 p-0">
                {{
                  getPercentage(
                    statisticsData.general.unique_user_bounce,
                    statisticsData.general.unique_user_delivered
                  )
                }}%
              </p>
              <p class="number-cards m-0 p-0">{{ statisticsData.general.unique_user_bounce | formatNumber }}</p>
            </div>
          </v-card>
        </div>
        <div v-if="type === 'web-push' && messageMetrics.close.visible">
          <DataLoader :isLoading="isLoadingData" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingData">
            <div class="d-flex card-text">
              <div class="icon-title">
                <span class="material-symbols-rounded font-16 ds-gray-color">unsubscribe</span>
                <p class="card-title-dashboard m-0 p-0">{{ $t('datatable.close') }}</p>
              </div>
            </div>
            <div class="number-percentage">
              <p class="number-color-unsubscribe number-align m-0 p-0">
                {{ getPercentage(statisticsData.general.close, statisticsData.general.delivered) }}%
              </p>
              <p class="number-cards m-0 p-0">
                {{ statisticsData.general.close | formatNumber }}
              </p>
            </div>
          </v-card>
        </div>
      </div>
    </div>
    <div class="switch-chart" v-if="!showMetricsByUser">
      <div
        v-tooltip.bottom="$t('input.numeric')"
        class="switch-option switch-option-first"
        :class="{ 'switch-option-active': !isChartPercentage }"
        @click="changeChart(false)"
      >
        <span class="material-symbols-rounded font-20">tag</span>
      </div>
      <div
        v-tooltip.bottom="$t('input.percentage')"
        class="switch-option switch-option-last"
        :class="{ 'switch-option-active': isChartPercentage }"
        @click="changeChart(true)"
      >
        <span class="material-symbols-rounded font-20"> percent </span>
      </div>
    </div>

    <v-row class="mt-0 mb-3">
      <v-col>
        <DataLoader
          height="400"
          :isLoading="isLoadingData"
          :type="'table-heading, list-item-two-line, list-item-two-line, list-item-two-line, list-item-two-line'"
        />
        <v-card class="chart-card" v-if="!isLoadingData">
          <div>
            <apexChart
              v-show="!isChartPercentage"
              id="chart"
              height="345"
              type="line"
              :options.sync="chartOptions"
              :series.sync="effectiveSeries"
            ></apexChart>
            <apexChart
              v-show="isChartPercentage"
              id="chart-percentage"
              height="345"
              type="line"
              :options.sync="chartOptionsPercentage"
              :series.sync="effectiveSeries"
            ></apexChart>
          </div>
        </v-card>
      </v-col>
    </v-row>
    <div>
      <DataLoader :isLoading="isLoadingData" :type="'table-tbody,table-tbody'" />
      <v-data-table
        :headers="effectiveHeaders"
        :items="tableData"
        hide-default-footer
        class="c-table"
        :sort-by.sync="sortBy"
        :sort-desc.sync="sortDesc"
        :itemsPerPage.sync="itemsPerPage"
        :page.sync="currentPage"
        :calculate-widths="true"
        v-if="!isLoadingData"
      >
        <template v-slot:[`header.percentageCtor`]="{ header }">
          <span v-tooltip.bottom="`${$t(`datatable.ctor`)}`">{{ header.text }}</span>
        </template>

        <template v-slot:[`header.percentageUto`]="{ header }">
          <span v-tooltip.bottom="`${$t(`datatable.uto`)}`">{{ header.text }}</span>
        </template>

        <template v-slot:[`item.date`]="{ item }">
          <div class="td-item tabular-nums">
            {{ formatDateDayjs(item.date) | formatDate({ year: 'numeric', month: '2-digit', day: '2-digit' }) }}
          </div>
        </template>

        <template v-slot:[`item.delivered`]="{ item }">
          <template v-if="['web-push', 'mobile-push'].includes(type)">
            <div class="td-item percentage-number mb-1 tabular-nums">
              <div class="number-color-open">{{ item.percentageDelivered }}%</div>
              <div class="td-item">
                {{ item.delivered | formatNumber }}
              </div>
            </div>
            <v-progress-linear
              :value="item.percentageDelivered"
              height="4"
              :color="messageMetrics.delivered.color"
              rounded
            />
          </template>
          <div class="td-item tabular-nums" v-else>
            {{ item.delivered | formatNumber }}
          </div>
        </template>

        <template v-slot:[`item.unique_user_delivered`]="{ item }">
          <div class="td-item tabular-nums">
            {{ item.unique_user_delivered | formatNumber }}
          </div>
        </template>

        <template v-slot:[`item.sent`]="{ item }">
          <div class="td-item tabular-nums">
            {{ item.sent | formatNumber }}
          </div>
        </template>

        <template v-slot:[`item.open`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-open">{{ item.percentageOpen }}%</div>
            <div class="td-item">
              {{ item.open | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageOpen" height="4" :color="messageMetrics.open.color" rounded />
        </template>

        <template v-slot:[`item.unique_user_open`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-open">{{ item.percentageUserOpen }}%</div>
            <div class="td-item">
              {{ item.unique_user_open | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageUserOpen" height="4" :color="messageMetrics.open.color" rounded />
        </template>

        <template v-slot:[`item.unique_opens`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unique-open">{{ item.percentageUniqueOpen }}%</div>
            <div class="td-item">
              {{ item.unique_opens | formatNumber }}
            </div>
          </div>
          <v-progress-linear
            :value="item.percentageUniqueOpen"
            height="4"
            :color="messageMetrics.unique_opens.color"
            rounded
          />
        </template>

        <template v-slot:[`item.click`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-click">{{ item.percentageClick }}%</div>
            <div class="td-item">
              {{ item.click | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageClick" height="4" :color="messageMetrics.click.color" rounded />
        </template>

        <template v-slot:[`item.unique_user_click`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-click">{{ item.percentageUserClick }}%</div>
            <div class="td-item">
              {{ item.unique_user_click | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageUserClick" height="4" :color="messageMetrics.click.color" rounded />
        </template>

        <template v-slot:[`item.opens_per_contact`]="{ item }">
          <div class="td-item">
            {{ item.opens_per_contact }}
          </div>
        </template>

        <template v-slot:[`item.unique_clicks`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unique-click">{{ item.percentageUniqueClick }}%</div>
            <div class="td-item">
              {{ item.unique_clicks | formatNumber }}
            </div>
          </div>
          <v-progress-linear
            :value="item.percentageUniqueClick"
            height="4"
            :color="messageMetrics.unique_clicks.color"
            rounded
          />
        </template>

        <template v-slot:[`item.percentageCtor`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-ctor">{{ item.percentageCtor }}%</div>
          </div>
          <v-progress-linear
            :value="item.percentageCtor"
            height="4"
            :color="messageMetrics.percentageCtor.color"
            rounded
          />
        </template>

        <template v-slot:[`item.unsubscribe`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unsubscribe">{{ item.percentageUnsubscribe }}%</div>
            <div class="td-item">
              {{ item.unsubscribe | formatNumber }}
            </div>
          </div>
          <v-progress-linear
            :value="item.percentageUnsubscribe"
            height="4"
            :color="messageMetrics.unsubscribe.color"
            rounded
          />
        </template>

        <template v-slot:[`item.unique_user_unsubscribe`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unsubscribe">{{ item.percentageUserUnsubscribe }}%</div>
            <div class="td-item">
              {{ item.unique_user_unsubscribe | formatNumber }}
            </div>
          </div>
          <v-progress-linear
            :value="item.percentageUserUnsubscribe"
            height="4"
            :color="messageMetrics.unsubscribe.color"
            rounded
          />
        </template>

        <template v-slot:[`item.percentageUto`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unsubscribe">{{ item.percentageUto }}%</div>
          </div>
          <v-progress-linear :value="item.percentageUto" height="4" color="#F06158" rounded />
        </template>

        <template v-slot:[`item.close`]="{ item }">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-unsubscribe">{{ item.percentageClose }}%</div>
            <div class="td-item">
              {{ item.close | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageClose" height="4" :color="messageMetrics.close.color" rounded />
        </template>

        <template v-slot:[`item.bounce`]="{ item }" v-if="!['web-push', 'mobile-push'].includes(type)">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-bounce">{{ item.percentageBounce }}%</div>
            <div class="td-item">
              {{ item.bounce | formatNumber }}
            </div>
          </div>
          <v-progress-linear :value="item.percentageBounce" height="4" :color="messageMetrics.bounce.color" rounded />
        </template>

        <template v-slot:[`item.unique_user_bounce`]="{ item }" v-if="!['web-push', 'mobile-push'].includes(type)">
          <div class="td-item percentage-number mb-1 tabular-nums">
            <div class="number-color-bounce">{{ item.percentageUserBounce }}%</div>
            <div class="td-item">
              {{ item.unique_user_bounce | formatNumber }}
            </div>
          </div>
          <v-progress-linear
            :value="item.percentageUserBounce"
            height="4"
            :color="messageMetrics.bounce.color"
            rounded
          />
        </template>

        <template v-slot:no-data>
          <p :value="true" color="error" class="no-data" icon="warning">{{ $t('datatable.noData') }}</p>
        </template>

        <template v-slot:footer>
          <div class="stats-footer">
            <button
              v-if="$store.getters.can('analytics:dashboard_export')"
              type="button"
              class="button-secondary"
              @click="exportData()"
            >
              {{ $t('datatable.exportButton') }}
            </button>
          </div>
        </template>
      </v-data-table>
      <div v-if="tableData.length > itemsPerPage" class="pagination">
        <v-btn :disabled="currentPage == 1" color="primary" @click="changePage('prev')">
          <span class="material-symbols-rounded">navigate_before</span>
        </v-btn>
        <v-btn
          :disabled="currentPage == Math.ceil(tableData.length / itemsPerPage)"
          color="primary"
          @click="changePage('next')"
        >
          <span class="material-symbols-rounded">navigate_next</span>
        </v-btn>
      </div>
    </div>
    <div>
      <v-dialog v-model="showModalCustomizeMetrics" max-width="500">
        <v-card class="dialog-customize-metrics">
          <div class="modal-header mb-1">
            {{ $t('modal.displayCustomization') }}
            <button class="d-flex" @click="cancelCustomizeMetrics">
              <span class="material-symbols-rounded buttons-color"> close </span>
            </button>
          </div>
          <div class="modal-body" v-for="n in filteredMessageMetrics" :key="n.title">
            <div class="item-modal-customize-metrics" :draggable="true">
              <div class="item-modal-customize-metrics-label">
                <img src="../../../assets/drag_indicator.svg" class="img-item-modal-customize-metrics-label" />
                {{ n.title }}
              </div>
              <div class="item-modal-customize-metrics-switch">
                <v-switch inset v-model="n.visible"></v-switch>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <input
              class="cancel-button mr-4"
              text
              @click="cancelCustomizeMetrics"
              type="button"
              :value="`${$t('button.cancel')}`"
            />
            <ButtonDefault
              :name="`${$t('button.save')}`"
              @click="saveCustomizeMetrics"
              class="btn btn-c btn-lg btn-success btn-success-c float-right"
            />
          </div>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import DashboardService from '../services/dashboard.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import { CampaignsDto } from '@/modules/campaigns/dtos/campaigns.dto';
import CampaignService from '@/services/campaign.service';
import { MessageDto } from '@/modules/messages/dtos/message.dto';
import AutomationsService from '@/modules/automations/services/automations.service';
import TagsService from '@/modules/tags/services/tag.service';
import MessagesService from '@/modules/messages/services/messages.service';
import { AutomationDto } from '@/modules/automations/dtos/automation.dto';
import VueApexCharts from 'vue-apexcharts';
import { TagDto } from '@/modules/tags/dtos/tag.dto';
import { SegmentDto } from '@/modules/segment/dtos/segment.dto';
import { PoolDto } from '@/modules/pools/dtos/pool.dto';
import {
  TableHeader,
  MessageMetrics,
  TimeSerieInterface,
  ChartOptionsInterface,
} from '../interfaces/dashboard.interface';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: {
    ButtonDefault,
    InputDefault,
    DataLoader,
    VueApexCharts,
  },
  computed: {
    ...mapState(['currentAccount', 'accountChannels', 'currentAccountTimezone', 'userLanguage']),
  },
})
export default class Dashboard extends Vue {
  private readonly dashboardService = new DashboardService();
  private readonly campaignService = new CampaignService();
  private readonly automationsService = new AutomationsService();
  private readonly messagesService = new MessagesService();
  private readonly tagsService = new TagsService();
  public currentAccount!: AccountDto;
  public campaigns: Array<CampaignsDto> = new Array<CampaignsDto>();
  public messages: Array<MessageDto> = new Array<MessageDto>();
  public automations: Array<AutomationDto> = new Array<AutomationDto>();
  public tags: Array<TagDto> = new Array<TagDto>();
  public segments: Array<SegmentDto> = new Array<SegmentDto>();
  public senders: Array<PoolDto> = new Array<PoolDto>();
  public selectedCampaigns: any = [];
  public selectedMessages: any = [];
  public selectedAutomations: any = [];
  public selectedTags: any = [];
  public selectedSegments: any = [];
  public selectedSenders: any = [];
  public selectedSubUsers: any = [];
  public allSelectedCampaigns: any = [];
  public allSelectedAutomations: any = [];
  public accountChannels!: any;
  public currentAccountTimezone!: string;
  public userLanguage!: string;

  statisticsData: any = {};
  pickedDate: string[] = [];
  dateRangeText = '';
  minFilterDate = new Date();
  startDate = new Date();
  endDate = new Date();
  menu = false;
  isLoadingData = true;
  itemsPerPage = 20;
  currentPage = 1;
  sortBy = ['date'];
  sortDesc = [true];
  tableData: any = [];
  show = false;
  chipItems: any = [];
  selectedFilter: any = [];
  loadPage = false;
  isAllCampaigns = false;
  isAllAutomations = false;
  type = '';
  isChartPercentage = false;
  isOpen = false;
  showModalCustomizeMetrics = false;
  showMetricsByUser = false;
  subUsers: any = [];
  messageMetricsState: MessageMetrics = {};
  messageMetrics: MessageMetrics = {
    delivered: {
      title: this.$t('datatable.delivered'),
      icon: 'mail',
      visible: true,
      types: ['web-push', 'mobile-push', 'email'],
      color: '#0057f4',
    },
    open: {
      title: this.$t('datatable.open'),
      icon: 'drafts',
      visible: true,
      types: ['email'],
      color: '#0FB75C',
    },
    unique_opens: {
      title: this.$t('datatable.unique_opens'),
      icon: 'drafts',
      visible: true,
      types: ['email'],
      color: '#076e62',
    },
    click: {
      title: this.$t('datatable.click'),
      icon: 'arrow_selector_tool',
      visible: true,
      types: ['web-push', 'mobile-push', 'email'],
      color: '#00cefc',
    },
    unique_clicks: {
      title: this.$t('datatable.unique_clicks'),
      icon: 'arrow_selector_tool',
      visible: true,
      types: ['email'],
      color: '#436bba',
    },
    percentageCtor: {
      title: 'CTOR',
      icon: 'touch_app',
      visible: true,
      types: ['email'],
      color: '#800080',
    },
    unsubscribe: {
      title: this.$t('datatable.unsubscribe'),
      icon: 'unsubscribe',
      visible: true,
      types: ['email'],
      color: '#f06158',
    },
    bounce: {
      title: 'Bounce',
      icon: require('@/assets/bounce-icon.svg'),
      visible: true,
      types: ['email'],
      color: '#ff9654',
    },
    sent: {
      title: this.$t('datatable.sent'),
      icon: 'send',
      visible: true,
      types: ['web-push', 'mobile-push'],
      color: '#0057f4',
    },
    close: {
      title: this.$t('datatable.close'),
      icon: 'mail_off',
      visible: true,
      types: ['web-push'],
      color: '#f06158',
    },
    unique_user_delivered: {
      title: this.$t('datatable.baseSize'),
      icon: 'mail',
      visible: true,
      types: ['email', 'web-push', 'mobile-push'],
      color: '#0057f4',
    },
    unique_user_open: {
      title: this.$t('datatable.engagedUsers'),
      icon: 'mail_off',
      visible: true,
      types: ['email', 'web-push', 'mobile-push'],
      color: '#0FB75C',
    },
    unique_user_click: {
      title: this.$t('datatable.DAU'),
      icon: 'mail_off',
      visible: true,
      types: ['email', 'web-push', 'mobile-push'],
      color: '#00cefc',
    },
    opens_per_contact: {
      title: this.$t('datatable.averageOpenRate'),
      icon: 'mail_off',
      visible: true,
      types: ['email', 'web-push', 'mobile-push'],
      color: '#B0E2C7',
    },
    clicks_per_contact: {
      title: this.$t('datatable.averageClickRate'),
      icon: 'mail_off',
      visible: true,
      types: ['web-push', 'mobile-push', 'email'],
      color: '#98C7FD',
    },
    unique_user_unsubscribe: {
      title: this.$t('datatable.unsubscribeByBaseSize'),
      icon: 'mail_off',
      visible: true,
      types: ['email'],
      color: '#f06158',
    },
  };

  chartOptions: ChartOptionsInterface = {
    chart: {
      zoom: {
        enabled: false,
      },
      id: 'chart',
      toolbar: {
        show: false,
      },
      align: 'center',
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    colors: [],
    yaxis: {
      labels: {
        formatter: (value: any) => {
          return Vue.filter('formatNumberText')(value);
        },
      },
    },
    xaxis: {
      categories: [],
      labels: {},
      tooltip: {
        enabled: false,
      },
    },
    tooltip: {},
  };
  chartOptionsOriginal: ChartOptionsInterface = this.chartOptions;
  hiddenSeries: boolean[] = [];

  chartOptionsPercentage: ChartOptionsInterface = {
    chart: {
      zoom: {
        enabled: false,
      },
      id: 'chart',
      toolbar: {
        show: false,
      },
      align: 'center',
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    colors: [],
    yaxis: {
      min: 0,
      labels: {
        formatter: (val: any) => {
          return val + '%';
        },
      },
    },
    xaxis: {
      categories: [],
      labels: {},
      tooltip: {
        enabled: false,
      },
    },
    tooltip: {},
  };

  series: TimeSerieInterface[] = [];
  effectiveSeries: TimeSerieInterface[] = [];

  headers: TableHeader[] = [];
  effectiveHeaders: TableHeader[] = [];
  chartInstance: any = null;
  messagesPages: any = [];
  campaignsIds: any = [];
  automationsIds: any = [];
  messagesIds: any = [];
  tagsIds: any = [];
  segmentsIds: any = [];
  sendersIds: any = [];
  subUserNames: any = [];

  get originalSubUsers() {
    let subUsers: any = [];
    if (this.currentAccount.id === 1) {
      subUsers = [
        {
          value: 'etusdigital-plusdin-campaigns',
        },
        {
          value: 'etusdigital-plusdin-automations',
        },
        {
          value: 'etusdigital-plusdin-transactional',
        },
      ];
      return subUsers;
    }
    if (this.currentAccount.id === 16) {
      subUsers = [
        {
          value: 'etusdigital-vouquitar-campaigns',
        },
        {
          value: 'etusdigital-vouquitar-automations',
        },
        {
          value: 'etusdigital-vouquitar-transactional',
        },
      ];
      return subUsers;
    }
    if (this.currentAccount.id === 5) {
      subUsers = [
        {
          value: 'etusdigital-easydinheiro-campaigns',
        },
        {
          value: 'etusdigital-easydinheiro-automations',
        },
        {
          value: 'etusdigital-easydinheiro-transactional',
        },
      ];
      return subUsers;
    }
    return [];
  }

  get filterCampaigns() {
    return this.campaigns.map((campaign: any) => ({
      ...campaign,
      typeRemove: 'selectedCampaigns',
      selectedFilter: 'campaigns',
    }));
  }

  get filterAutomations() {
    return this.automations.map((automation: any) => ({
      ...automation,
      typeRemove: 'selectedAutomations',
      selectedFilter: 'automations',
    }));
  }

  get filterMessages() {
    return this.messages.map((message: any) => ({
      ...message,
      typeRemove: 'selectedMessages',
      selectedFilter: 'messages',
    }));
  }

  get filteredTags() {
    return this.tags.map((tag: any) => ({
      ...tag,
      title: tag.name,
      typeRemove: 'selectedTags',
      selectedFilter: 'tags',
    }));
  }

  get filteredSegments() {
    return this.segments.map((segment: any) => ({
      ...segment,
      title: segment.name,
      typeRemove: 'selectedSegments',
      selectedFilter: 'segments',
    }));
  }

  get filteredSenders() {
    return this.senders.map((sender: any) => ({
      ...sender,
      title: sender.senderEmail,
      typeRemove: 'selectedSenders',
      selectedFilter: 'senders',
    }));
  }

  get filteredSubUsers() {
    return this.subUsers.map((subUser: any) => ({
      ...subUser,
      title: subUser.value,
      typeRemove: 'selectedSubUsers',
      selectedFilter: 'subUsers',
    }));
  }

  get visibleChips() {
    return this.isOpen ? this.chipItems : this.chipItems.slice(0, 2);
  }

  get filteredMessageMetrics() {
    return Object.values(this.messageMetrics).filter((n) => n.types.includes(this.type));
  }

  saveFilteredMessageMetricsToLocalStorage(metrics: any) {
    localStorage.setItem('filteredMessageMetrics', JSON.stringify(metrics));
  }

  formatDateDayjs(date: any) {
    if (!date) {
      return null;
    }

    const parsedDate = dayjs.tz(date, this.currentAccountTimezone);
    if (!parsedDate.isValid()) {
      return null;
    }

    return parsedDate.utc();
  }

  showCustomizeMetrics() {
    this.messageMetricsState = {};
    this.messageMetricsState = structuredClone(this.messageMetrics);
    this.showModalCustomizeMetrics = true;
  }

  cancelCustomizeMetrics() {
    this.messageMetrics = { ...this.messageMetricsState };
    this.messageMetricsState = {};
    this.showModalCustomizeMetrics = false;
  }

  saveCustomizeMetrics() {
    this.messageMetricsState = {};
    this.showModalCustomizeMetrics = false;
    this.saveFilteredMessageMetricsToLocalStorage(this.messageMetrics);
  }

  filterHeaders(headers: TableHeader[], metrics: MessageMetrics): TableHeader[] {
    return headers.filter((header) => {
      const metric = metrics[header.value];
      return metric ? metric.visible : true;
    });
  }

  filterChartSeries(series: TimeSerieInterface[], metrics: MessageMetrics): TimeSerieInterface[] {
    return series.filter((serie) => {
      const metric = metrics[serie.value];
      return metric ? metric.visible : true;
    });
  }

  safeNumber(value: any): number {
    if (value == null || value === '' || isNaN(value) || value === '0') {
      return 0;
    }
    return Number(value);
  }

  applySafeNumberToSeries(series: any[]): any[] {
    return series.map((serie) => ({
      ...serie,
      data: this.tableData.map((item: any) => this.safeNumber(item[serie.value])),
    }));
  }

  async beforeMount() {
    this.subUsers = [...this.originalSubUsers];
    this.setMessagePages();
    this.isLoadingData = true;
    this.startDate.setDate(this.endDate.getDate() - 30);
    const storedMetrics = localStorage.getItem('filteredMessageMetrics');
    if (storedMetrics) {
      const parsedMetrics = JSON.parse(storedMetrics);
      Object.keys(this.messageMetrics).forEach((key) => {
        if (parsedMetrics[key]) {
          this.messageMetrics[key] = { ...this.messageMetrics[key], ...parsedMetrics[key] };
        }
      });
    }
    this.updateDeliveredColor();
    await this.dispatchBeforeMount();
  }

  setMessagePages() {
    this.messagesPages = [
      ...(this.accountChannels.hasEmail
        ? [{ title: this.$t('title.email'), router: '/messages/email/statistics' }]
        : []),
      ...(this.accountChannels.hasWebPush
        ? [{ title: this.$t('title.web-push'), router: '/messages/web-push/statistics' }]
        : []),
      ...(this.accountChannels.hasMobilePush
        ? [{ title: this.$t('title.mobile-push'), router: '/messages/mobile-push/statistics' }]
        : []),
    ];
  }

  async dispatchBeforeMount() {
    this.type = this.$route.params.type;
    this.getValuesUrl();
    this.pickedDate = [this.dateToVuetifyString(this.startDate), this.dateToVuetifyString(this.endDate)];
    this.minFilterDate.setDate(new Date().getDate() - 90);

    await this.changeDatePicker(this.pickedDate);
    await Promise.all([
      this.$store.getters.can('campaigns:view') ? this.getCampaigns('') : Promise.resolve(),
      this.$store.getters.can('messages:view') ? this.getAutomationsMessages('') : Promise.resolve(),
      this.$store.getters.can('automations:view') ? this.getAutomations('') : Promise.resolve(),
      this.$store.getters.can('audience:segments_view') ? this.filterSegments('') : Promise.resolve(),
      this.$store.getters.can('audience:tags_view') ? this.filterTags('') : Promise.resolve(),
      this.$store.getters.can('infra:view') ? this.getSenders() : Promise.resolve(),
    ]);
    this.getSelectedFilters();
    this.getChipItems();

    if (['web-push', 'mobile-push'].includes(this.type)) {
      this.headers = [
        { text: this.$t('datatable.date'), value: 'date', sortable: true, width: '10%' },
        { text: this.$t('datatable.sent'), value: 'sent', sortable: true, width: '10%', align: 'end' },
        { text: this.$t('datatable.delivered'), value: 'delivered', sortable: true, width: '15%', align: 'end' },
        { text: this.$t('datatable.click'), value: 'click', sortable: true, width: '15%', align: 'start' },
      ];
      if (this.type === 'web-push') {
        this.headers.push({
          text: this.$t('datatable.close'),
          value: 'close',
          sortable: true,
          width: '15%',
          align: 'start',
        });
      }
    } else {
      this.headers = [
        { text: this.$t('datatable.date'), value: 'date', sortable: true, width: '10%' },
        { text: this.$t('datatable.delivered'), value: 'delivered', sortable: true, width: '10%', align: 'end' },
        { text: this.$t('datatable.open'), value: 'open', sortable: true, width: '15%', align: 'start' },
        {
          text: this.$t('datatable.unique_opens'),
          value: 'unique_opens',
          sortable: true,
          width: '15%',
          align: 'start',
        },
        { text: this.$t('datatable.click'), value: 'click', sortable: true, width: '15%', align: 'start' },
        {
          text: this.$t('datatable.unique_clicks'),
          value: 'unique_clicks',
          sortable: true,
          width: '15%',
          align: 'start',
        },
        { text: 'CTOR', value: 'percentageCtor', sortable: true, width: '10%', align: 'start' },
        { text: this.$t('datatable.unsubscribe'), value: 'unsubscribe', sortable: true, width: '15%', align: 'start' },
        { text: 'UTO', value: 'percentageUto', sortable: true, width: '10%', align: 'start' },
        { text: 'Bounce', value: 'bounce', sortable: true, width: '15%', align: 'start' },
      ];
    }
    this.effectiveHeaders = [...this.headers];
  }

  @Watch('sortBy')
  @Watch('sortDesc')
  setValuesUrl() {
    const campaignsIds = this.isAllCampaigns
      ? 'all'
      : this.selectedCampaigns.length > 0
        ? this.selectedCampaigns.map((campaign: any) => campaign.id)
        : this.campaignsIds;

    const automationsIds = this.isAllAutomations
      ? 'all'
      : this.selectedAutomations.length > 0
        ? this.selectedAutomations.map((automation: any) => automation.id)
        : this.automationsIds;

    const messagesIds =
      this.selectedMessages.length > 0 ? this.selectedMessages.map((message: any) => message.id) : this.messagesIds;

    const segmentsIds =
      this.selectedSegments.length > 0 ? this.selectedSegments.map((segment: any) => segment.id) : this.segmentsIds;

    const tagsIds = this.selectedTags.length > 0 ? this.selectedTags.map((tag: any) => tag.id) : this.tagsIds;

    const sendersIds =
      this.selectedSenders.length > 0 ? this.selectedSenders.map((sender: any) => sender.id) : this.sendersIds;

    const subUsers =
      this.selectedSubUsers.length > 0 ? this.selectedSubUsers.map((subUser: any) => subUser.value) : this.subUserNames;

    this.$router.push(
      `?startDate=${this.dateToVuetifyString(this.startDate)}&endDate=${this.dateToVuetifyString(
        this.endDate
      )}&sortBy=${this.sortBy}&sortDesc=${this.sortDesc}&campaigns=${campaignsIds || ''}&messages=${
        messagesIds || ''
      }&automations=${automationsIds || ''}&tags=${tagsIds || ''}&segments=${segmentsIds || ''}&senders=${
        sendersIds || ''
      }&subUsers=${subUsers || ''}`
    );
  }

  @Watch('currentAccount')
  async updateAccount() {
    this.setMessagePages();
    await this.changeDatePicker(this.pickedDate);
    await this.clearFilters();
    if (this.$store.getters.can('campaigns:view')) {
      await this.getCampaigns('');
    }
    if (this.$store.getters.can('messages:view')) {
      await this.getAutomationsMessages('');
    }
    if (this.$store.getters.can('automations:view')) {
      await this.getAutomations('');
    }
    if (this.$store.getters.can('audience:segments_view')) {
      await this.filterSegments('');
    }
    if (this.$store.getters.can('audience:tags_view')) {
      await this.filterTags('');
    }
    if (this.$store.getters.can('infra:view')) {
      await this.getSenders();
    }
  }

  @Watch('showMetricsByUser')
  updateHeaders() {
    if (this.showMetricsByUser) {
      this.effectiveHeaders = [
        { text: this.$t('datatable.date'), value: 'date', sortable: true, width: '10%' },
        {
          text: this.$t('datatable.baseSize'),
          value: 'unique_user_delivered',
          sortable: true,
          width: '10%',
          align: 'end',
        },
        {
          text: this.$t('datatable.engagedUsers'),
          value: 'unique_user_open',
          sortable: true,
          width: '15%',
          align: 'start',
        },
        { text: this.$t('datatable.DAU'), value: 'unique_user_click', sortable: true, width: '15%', align: 'start' },
        {
          text: this.$t('datatable.averageOpenRate'),
          value: 'opens_per_contact',
          sortable: true,
          width: '15%',
          align: 'end',
        },
        {
          text: this.$t('datatable.averageClickRate'),
          value: 'clicks_per_contact',
          sortable: true,
          width: '15%',
          align: 'end',
        },
        {
          text: this.$t('datatable.unsubscribeByBaseSize'),
          value: 'unique_user_unsubscribe',
          sortable: true,
          width: '15%',
          align: 'start',
        },
        // { text: 'Bounce', value: 'unique_user_bounce', sortable: true, width: '15%', align: 'start' },
      ];

      this.effectiveSeries = this.applySafeNumberToSeries([
        {
          name: this.$t('datatable.baseSize') as string,
          value: 'unique_user_delivered',
          type: 'line',
        },
        {
          name: this.$t('datatable.engagedUsers') as string,
          value: 'unique_user_open',
          type: 'line',
        },
        {
          name: this.$t('datatable.DAU') as string,
          value: 'unique_user_click',
          type: 'line',
        },
        {
          name: this.$t('datatable.averageOpenRate') as string,
          value: 'opens_per_contact',
          type: 'bar',
        },
        {
          name: this.$t('datatable.averageClickRate') as string,
          value: 'clicks_per_contact',
          type: 'bar',
        },
        {
          name: this.$t('datatable.unsubscribeByBaseSize') as string,
          value: 'unique_user_unsubscribe',
          type: 'line',
        },
      ]);

      this.chartOptionsOriginal = { ...this.chartOptions };
      this.chartOptions = {
        ...this.chartOptions,
        chart: {
          ...this.chartOptions.chart,
          events: {
            // This event is called after a series is hidden/shown through legend click
            legendClick: (chartContext: any, seriesIndex: any, config: any) => {
              // Toggle the hidden state of the series
              if (config.config.series[seriesIndex].data.length === 0) {
                // is being hidden
                this.hiddenSeries[seriesIndex] = false;
              } else {
                // is being shown
                this.hiddenSeries[seriesIndex] = true;
              }
            },
          },
        },
        plotOptions: {
          bar: {
            columnWidth: '50%', // Controls the width of the bars (50% of available space)
          },
        },
        yaxis: [
          {
            seriesName: [
              this.$t('datatable.baseSize') as string,
              this.$t('datatable.engagedUsers') as string,
              this.$t('datatable.DAU') as string,
              this.$t('datatable.unsubscribeByBaseSize') as string,
            ],
            labels: {
              formatter: (value: number) => {
                return Vue.filter('formatNumberText')(value);
              },
            },
          },
          {
            seriesName: [
              this.$t('datatable.averageOpenRate') as string,
              this.$t('datatable.averageClickRate') as string,
            ],
            opposite: true,
            min: 0,
            max: 10,
            labels: {
              formatter: (value: number) => {
                if (!value) {
                  return '';
                }
                return value.toFixed(0);
              },
            },
          },
        ],
        colors: this.colors,
        tooltip: {
          custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
            const dataItem = this.tableData[dataPointIndex];
            return `<div class="custom-tooltip" style="width: max-content;">
              <div class="date" style="display: flex; justify-content: center; background: #eceff1; padding: 8px 8px;">
                ${Vue.filter('formatDate')(this.formatDateDayjs(dataItem.date))}
              </div>
              <div class="data-tooltip" style="padding: 15px 15px; display: grid; gap: 10px;">
                <div class="delivered" style="display: ${
                  this.messageMetrics.unique_user_delivered.visible && !this.hiddenSeries[0] ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: max-content;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unique_user_delivered.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.baseSize')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.unique_user_delivered)}
                  </p>
                </div>
                <div class="open" style="display: ${
                  this.messageMetrics.unique_user_open.visible && !this.hiddenSeries[1] ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: max-content;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unique_user_open.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t(
                    'datatable.engagedUsers'
                  )}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.unique_user_open)}
                    (${Vue.filter('formatNumber')(dataItem.percentageUserOpen)}%)
                  </p>
                </div>
                <div class="click" style="display: ${
                  this.messageMetrics.unique_user_click.visible && !this.hiddenSeries[2] ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: max-content;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unique_user_click.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('datatable.DAU')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.unique_user_click)}
                    (${Vue.filter('formatNumber')(dataItem.percentageUserClick)}%)
                  </p>
                </div>
                <div class="open" style="display: ${
                  this.messageMetrics.opens_per_contact.visible && !this.hiddenSeries[3] ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: max-content;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.opens_per_contact.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.averageOpenRate')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.opens_per_contact)}
                  </p>
                </div>
                <div class="click" style="display: ${
                  this.messageMetrics.clicks_per_contact.visible && !this.hiddenSeries[4] ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: max-content;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.clicks_per_contact.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.averageClickRate')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.clicks_per_contact)}
                  </p>
                </div>
                <div class="unsubscribe" style="display: ${
                  this.messageMetrics.unique_user_unsubscribe.visible && !this.hiddenSeries[5] ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: max-content;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unique_user_unsubscribe.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.unsubscribeByBaseSize')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.unique_user_unsubscribe)}
                    (${Vue.filter('formatNumber')(dataItem.percentageUserUnsubscribe)}%)
                  </p>
                </div>
              </div>
            </div>`;
          },
        },
      };
    } else {
      this.effectiveHeaders = [...this.headers];
      this.chartOptions = this.chartOptionsOriginal;
      this.changeChart(false);
    }
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

    if (this.$route.query.sortBy) {
      this.sortBy = [(this.$route.query.sortBy as string) || 'date'];
    }

    if (this.$route.query.sortDesc) {
      this.sortDesc = this.$route.query.sortDesc ? [this.$route.query.sortDesc === 'true'] : [true];
    }

    if (this.$route.query.campaigns) {
      const campaigns: any = this.$route.query.campaigns;
      this.campaignsIds = campaigns.split(',');
    }

    if (this.$route.query.automations) {
      const automations: any = this.$route.query.automations;
      this.automationsIds = automations.split(',');
    }

    if (this.$route.query.messages) {
      const messages: any = this.$route.query.messages;
      this.messagesIds = messages.split(',');
    }

    if (this.$route.query.tags) {
      const tags: any = this.$route.query.tags;
      this.tagsIds = tags.split(',');
    }

    if (this.$route.query.segments) {
      const segments: any = this.$route.query.segments;
      this.segmentsIds = segments.split(',');
    }

    if (this.$route.query.senders) {
      const senders: any = this.$route.query.senders;
      this.sendersIds = senders.split(',');
    }

    if (this.$route.query.subUsers) {
      const subUsers: any = this.$route.query.subUsers;
      this.subUserNames = subUsers.split(',');
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
    this.dateRangeText = `${Vue.filter('formatDate')(dates[0])} - ${Vue.filter('formatDate')(dates[1])}`;
    await this.getStatistics();
  }

  changePage(type: string) {
    if (type === 'next' && this.currentPage < Math.ceil(this.tableData.length / this.itemsPerPage)) {
      this.currentPage++;
    } else if (type === 'prev' && this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getSelectedFilters() {
    this.selectedCampaigns = this.campaignsIds.map((campaignId: any) => {
      const filter = this.campaigns.find((campaign: any) => campaign.id === parseInt(campaignId, 10));
      return {
        ...filter,
        typeRemove: 'selectedCampaigns',
        selectedFilter: 'campaigns',
      };
    });

    this.selectedAutomations = this.automationsIds.map((automationId: any) => {
      const filter = this.automations.find((automation: any) => automation.id === parseInt(automationId, 10));
      return {
        ...filter,
        typeRemove: 'selectedAutomations',
        selectedFilter: 'automations',
      };
    });

    this.selectedMessages = this.messagesIds.map((messageId: string) => {
      const filter = this.messages.find((message: any) => message.id === parseInt(messageId, 10));
      return {
        ...filter,
        typeRemove: 'selectedMessages',
        selectedFilter: 'messages',
      };
    });

    this.selectedTags = this.tagsIds.map((tagId: string) => {
      const filter: any = this.tags.find((tag: any) => tag.id === parseInt(tagId, 10));
      return {
        ...filter,
        title: filter.name,
        typeRemove: 'selectedTags',
        selectedFilter: 'tags',
      };
    });

    this.selectedSegments = this.segmentsIds.map((segmentId: string) => {
      const filter: any = this.segments.find((segment: any) => segment.id === parseInt(segmentId, 10));
      return {
        ...filter,
        title: filter.name,
        typeRemove: 'selectedSegments',
        selectedFilter: 'segments',
      };
    });

    this.selectedSenders = this.sendersIds.map((poolId: string) => {
      const filter: any = this.senders.find((sender: any) => sender.id === parseInt(poolId, 10));
      return {
        ...filter,
        title: filter.senderEmail,
        typeRemove: 'selectedSenders',
        selectedFilter: 'senders',
      };
    });

    this.selectedSubUsers = this.subUserNames.map((subUserId: string) => {
      const filter: any = this.subUsers.find((subUser: any) => subUser.value === subUserId);
      return {
        ...filter,
        title: filter.value,
        typeRemove: 'selectedSubUsers',
        selectedFilter: 'subUsers',
      };
    });
  }

  getChipItems() {
    this.chipItems = [];
    if (this.isAllAutomations) {
      this.chipItems.push({
        title: this.$t('input.allAutomations'),
        typeRemove: 'selectedAutomations',
        selectedFilter: 'automations',
      });
    } else {
      this.chipItems = this.chipItems.concat(this.selectedAutomations);
    }
    if (this.isAllCampaigns) {
      this.chipItems.push({
        title: this.$t('input.allCampaigns'),
        typeRemove: 'selectedCampaigns',
        selectedFilter: 'campaigns',
      });
    } else {
      this.chipItems = this.chipItems.concat(this.selectedCampaigns);
    }
    this.chipItems = this.chipItems.concat(this.selectedMessages);
    this.chipItems = this.chipItems.concat(this.selectedTags);
    this.chipItems = this.chipItems.concat(this.selectedSegments);
    this.chipItems = this.chipItems.concat(this.selectedSenders);
    this.chipItems = this.chipItems.concat(this.selectedSubUsers);
  }

  async getStatistics() {
    this.isLoadingData = true;
    try {
      const campaignsIds = this.isAllCampaigns
        ? 'all'
        : this.campaignsIds.length > 0
          ? this.campaignsIds
          : this.selectedCampaigns.map((campaign: any) => campaign.id);
      const automationsIds = this.isAllAutomations
        ? 'all'
        : this.automationsIds.length > 0
          ? this.automationsIds
          : this.selectedAutomations.map((automation: any) => automation.id);
      const messages =
        this.messagesIds.length > 0 ? this.messagesIds : this.selectedMessages.map((message: any) => message.id);
      const tags = this.tagsIds.length > 0 ? this.tagsIds : this.selectedTags.map((tag: any) => tag.id);
      const segments =
        this.segmentsIds.length > 0 ? this.segmentsIds : this.selectedSegments.map((segment: any) => segment.id);
      const senders =
        this.sendersIds.length > 0 ? this.sendersIds : this.selectedSenders.map((sender: any) => sender.id);
      const subUsers =
        this.subUserNames.length > 0 ? this.subUserNames : this.selectedSubUsers.map((subUser: any) => subUser.value);
      const response = await this.dashboardService.getDashboardData(
        this.startDate,
        this.endDate,
        {
          campaigns: campaignsIds,
          automations: automationsIds,
          messages,
          tags,
          segments,
          senders,
          subUsers,
          type: this.type,
        },
        `statistics/${this.type.includes('email') ? 'email' : 'push'}`
      );
      this.statisticsData = response?.data || {};

      const sortedByDate = this.statisticsData.daily.sort((a: any, b: any) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      });

      this.tableData = sortedByDate.map((item: any) => {
        const percentageOpen = this.getPercentage(item.open, item.delivered);
        const percentageUniqueOpen = this.getPercentage(item.unique_opens, item.delivered);
        const percentageClick = this.getPercentage(item.click, item.delivered);
        const percentageUniqueClick = this.getPercentage(item.unique_clicks, item.delivered);
        const percentageCtor = this.getPercentage(item.click, item.open);
        const percentageUto = this.getPercentage(item.unsubscribe, item.open);
        const percentageUnsubscribe = this.getPercentage(item.unsubscribe, item.delivered);
        const percentageBounce = this.getPercentage(item.bounce, item.delivered);
        const percentageClose = this.getPercentage(item.close || 0, item.delivered);
        const percentageDelivered = this.getPercentage(item.delivered, item.sent);

        const percentageUserOpen = this.getPercentage(item.unique_user_open, item.unique_user_delivered);
        const percentageUserClick = this.getPercentage(item.unique_user_click, item.unique_user_delivered);
        const percentageUserUnsubscribe = this.getPercentage(item.unique_user_unsubscribe, item.unique_user_delivered);
        const percentageUserBounce = this.getPercentage(item.unique_user_bounce, item.unique_user_delivered);

        // web-push | mobile-push
        const percentageUserDelivered = this.getPercentage(item.unique_user_delivered, item.unique_user_sent);
        const percentageUserClose = this.getPercentage(item.unique_user_close || 0, item.unique_user_sent);

        return {
          ...item,
          date: item.date,
          percentageOpen,
          percentageUniqueOpen,
          percentageClick,
          percentageUniqueClick,
          percentageCtor,
          percentageUto,
          percentageUnsubscribe,
          percentageBounce,
          percentageClose,
          percentageDelivered,
          percentageUserOpen,
          percentageUserClick,
          percentageUserUnsubscribe,
          percentageUserBounce,
          percentageUserClose,
          percentageUserDelivered,
        };
      });
      if (['web-push', 'mobile-push'].includes(this.type)) {
        this.series = this.applySafeNumberToSeries([
          {
            name: this.$t('datatable.sent') as string,
            value: 'sent',
          },
          {
            name: this.$t('datatable.delivered') as string,
            value: 'delivered',
          },
          {
            name: this.$t('title.click') as string,
            value: 'click',
          },
        ]);
        if (this.type === 'web-push') {
          this.series.push(
            ...this.applySafeNumberToSeries([
              {
                name: this.$t('title.close'),
                value: 'close',
              },
            ])
          );
        }
      } else {
        this.series = this.applySafeNumberToSeries([
          {
            name: this.$t('datatable.delivered') as string,
            value: 'delivered',
          },
          {
            name: this.$t('datatable.open') as string,
            value: 'open',
          },
          {
            name: this.$t('datatable.unique_opens') as string,
            value: 'unique_opens',
          },
          {
            name: this.$t('datatable.click') as string,
            value: 'click',
          },
          {
            name: this.$t('datatable.unique_clicks') as string,
            value: 'unique_clicks',
          },
          {
            name: this.$t('datatable.unsubscribe') as string,
            value: 'unsubscribe',
          },
          {
            name: 'Bounce',
            value: 'bounce',
          },
        ]);
      }

      this.effectiveSeries = [...this.series];
      this.chartOptions = {
        ...this.chartOptions,
        colors: [...this.colors],
        xaxis: {
          ...this.chartOptions.xaxis,
          categories: this.tableData.map((item: any) => item.date),
          labels: {
            formatter: (value: Date) => {
              return Vue.filter('formatDate')(this.formatDateDayjs(value), { day: '2-digit', month: '2-digit' });
            },
          },
        },
        tooltip: {
          custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
            const dataItem = this.tableData[dataPointIndex];
            if (['web-push', 'mobile-push'].includes(this.type)) {
              return `<div class="custom-tooltip" style="width: max-content">
                <div class="date" style="display: flex; justify-content: center; background: #eceff1; padding: 8px 8px;">
                  ${Vue.filter('formatDate')(this.formatDateDayjs(dataItem.date))}
                </div>
                <div class="data-tooltip" style="padding: 15px 15px;">
                  <div class="sent" style="display: ${
                    this.messageMetrics.sent.visible ? 'flex' : 'none'
                  }; flex-direction: row; align-items: center; width: 250px;">
                    <span class="tooltip-circle" style="background: ${
                      this.messageMetrics.sent.color
                    }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                    <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                      ${this.$t('datatable.sent')}:
                    </p>
                    <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                      ${Vue.filter('formatNumber')(dataItem.sent)}
                    </p>
                  </div>
                  <div class="delivered" style="display: ${
                    this.messageMetrics.delivered.visible ? 'flex' : 'none'
                  }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                    <span class="tooltip-circle" style="background: ${
                      this.messageMetrics.delivered.color
                    }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                    <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                      ${this.$t('datatable.delivered')}: </p>
                    <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                      ${Vue.filter('formatNumber')(dataItem.delivered)}
                      (${Vue.filter('formatNumber')(dataItem.percentageDelivered)}%)
                    </p>
                  </div>
                  <div class="click" style="display: ${
                    this.messageMetrics.click.visible ? 'flex' : 'none'
                  }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                    <span class="tooltip-circle" style="background: ${
                      this.messageMetrics.click.color
                    }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                    <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.click')}: </p>
                    <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                      ${Vue.filter('formatNumber')(dataItem.click)}
                      (${Vue.filter('formatNumber')(dataItem.percentageClick)}%)
                    </p>
                  </div>
                  <div class="Close" style="display: ${
                    this.messageMetrics.close.types.includes(this.type) ? 'flex' : 'none'
                  }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                    <span class="tooltip-circle" style="background: ${
                      this.messageMetrics.close.color
                    }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                    <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.close')}: </p>
                    <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                      ${Vue.filter('formatNumber')(dataItem.close)}
                      (${Vue.filter('formatNumber')(dataItem.percentageClose)}%)
                    </p>
                  </div>
                </div>
              </div>`;
            }
            return `<div class="custom-tooltip" style="width: max-content">
              <div class="date" style="display: flex; justify-content: center; background: #eceff1; padding: 8px 8px;">
                ${Vue.filter('formatDate')(this.formatDateDayjs(dataItem.date))}
              </div>
              <div class="data-tooltip" style="padding: 15px 15px;">
                <div class="delivered" style="display: ${
                  this.messageMetrics.delivered.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.delivered.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.delivered')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.delivered)}
                  </p>
                </div>
                <div class="open" style="display: ${
                  this.messageMetrics.open.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.open.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.open')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.open)}
                    (${Vue.filter('formatNumber')(dataItem.percentageOpen)}%)
                  </p>
                </div>
                <div class="open" style="display: ${
                  this.messageMetrics.unique_opens.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unique_opens.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t(
                    'title.unique_opens'
                  )}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.unique_opens)}
                    (${Vue.filter('formatNumber')(dataItem.percentageUniqueOpen)}%)
                  </p>
                </div>
                <div class="click" style="display: ${
                  this.messageMetrics.click.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.click.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.click')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.click)}
                    (${Vue.filter('formatNumber')(dataItem.percentageClick)}%)
                  </p>
                </div>
                <div class="click" style="display: ${
                  this.messageMetrics.unique_clicks.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unique_clicks.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t(
                    'title.unique_clicks'
                  )}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.unique_clicks)}
                    (${Vue.filter('formatNumber')(dataItem.percentageUniqueClick)}%)
                  </p>
                </div>
                <div class="unsubscribe" style="display: ${
                  this.messageMetrics.unsubscribe.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unsubscribe.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.unsubscribe')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.unsubscribe)}
                    (${Vue.filter('formatNumber')(dataItem.percentageUnsubscribe)}%)
                  </p>
                </div>
                <div class="bounce" style="display: ${
                  this.messageMetrics.bounce.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.bounce.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">Bounce: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${Vue.filter('formatNumber')(dataItem.bounce)}
                    (${Vue.filter('formatNumber')(dataItem.percentageBounce)}%)
                  </p>
                </div>
              </div>
            </div>`;
          },
        },
      };

      this.chartOptionsPercentage = {
        ...this.chartOptionsPercentage,
        colors: [...this.colors],
        xaxis: {
          ...this.chartOptions.xaxis,
          categories: this.tableData.map((item: any) => item.date),
          labels: {
            formatter: (value: Date) => {
              return Vue.filter('formatDate')(this.formatDateDayjs(value), { day: '2-digit', month: '2-digit' });
            },
          },
        },
        tooltip: {
          custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
            const dataItem = this.tableData[dataPointIndex];
            if (['web-push', 'mobile-push'].includes(this.type)) {
              return `<div class="custom-tooltip" style="width: max-content">
                <div class="date" style="display: flex; justify-content: center; background: #eceff1; padding: 8px 8px;">
                  ${Vue.filter('formatDate')(this.formatDateDayjs(dataItem.date))}
                </div>
                <div class="data-tooltip" style="padding: 15px 15px;">
                  <div class="delivered" style="display: ${
                    this.messageMetrics.delivered.visible ? 'flex' : 'none'
                  }; flex-direction: row; align-items: center; width: 250px; margin-top: 0px;">
                    <span class="tooltip-circle" style="background: ${
                      this.messageMetrics.delivered.color
                    }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                    <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                      ${this.$t('datatable.delivered')}:
                    </p>
                    <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                      ${dataItem.percentageDelivered}% (${Vue.filter('formatNumber')(dataItem.delivered)})
                    </p>
                  </div>
                  <div class="click" style="display: ${
                    this.messageMetrics.click.visible ? 'flex' : 'none'
                  }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                    <span class="tooltip-circle" style="background: ${
                      this.messageMetrics.click.color
                    }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                    <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.click')}: </p>
                    <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                      ${dataItem.percentageClick}% (${Vue.filter('formatNumber')(dataItem.click)})
                    </p>
                  </div>
                  <div class="Close" style="display: ${
                    this.messageMetrics.close.visible ? 'flex' : 'none'
                  }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                    <span class="tooltip-circle" style="background: ${
                      this.messageMetrics.close.color
                    }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                    <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.close')}: </p>
                    <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                      ${dataItem.percentageClose}% (${Vue.filter('formatNumber')(dataItem.close)})
                    </p>
                  </div>
                </div>
              </div>`;
            }
            return `<div class="custom-tooltip" style="width: max-content">
              <div class="date" style="display: flex; justify-content: center; background: #eceff1; padding: 8px 8px;">
                ${Vue.filter('formatDate')(this.formatDateDayjs(dataItem.date))}
              </div>
              <div class="data-tooltip" style="padding: 15px 15px;">
                <div class="open" style="display: ${
                  this.messageMetrics.open.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 0px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.open.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.open')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageOpen}% (${Vue.filter('formatNumber')(dataItem.open)})
                  </p>
                </div>
                <div class="open" style="display: ${
                  this.messageMetrics.unique_opens.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 0px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unique_opens.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t(
                    'title.unique_opens'
                  )}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageUniqueOpen}% (${Vue.filter('formatNumber')(dataItem.unique_opens)})
                  </p>
                </div>
                <div class="click" style="display: ${
                  this.messageMetrics.click.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.click.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t('title.click')}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageClick}% (${Vue.filter('formatNumber')(dataItem.click)})
                  </p>
                </div>
                <div class="click" style="display: ${
                  this.messageMetrics.unique_clicks.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unique_clicks.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">${this.$t(
                    'title.unique_clicks'
                  )}: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageUniqueClick}% (${Vue.filter('formatNumber')(dataItem.unique_clicks)})
                  </p>
                </div>
                <div class="unsubscribe" style="display: ${
                  this.messageMetrics.unsubscribe.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.unsubscribe.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">
                    ${this.$t('datatable.unsubscribe')}:
                  </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageUnsubscribe}% (${Vue.filter('formatNumber')(dataItem.unsubscribe)})
                  </p>
                </div>
                <div class="bounce" style="display: ${
                  this.messageMetrics.bounce.visible ? 'flex' : 'none'
                }; flex-direction: row; align-items: center; width: 250px; margin-top: 20px;">
                  <span class="tooltip-circle" style="background: ${
                    this.messageMetrics.bounce.color
                  }; height: 10px; width: 10px; border-radius: 50%; margin-right: 10px;"></span>
                  <p style="margin-right: 10px; font-size: 15px; margin-bottom: 0px;">Bounce: </p>
                  <p style="font-weight: bold; font-size: 14px; margin-bottom: 0px;">
                    ${dataItem.percentageBounce}% (${Vue.filter('formatNumber')(dataItem.bounce)})
                  </p>
                </div>
              </div>
            </div>`;
          },
        },
      };

      if (this.isChartPercentage) {
        this.changeChart(true);
      }
      if (this.loadPage) {
        this.setValuesUrl();
      }
      this.loadPage = true;
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoadingData = false;
    }
  }

  get hasAnyFilter() {
    const can = this.$store.getters.can;
    return (
      can('campaigns:view') ||
      can('automations:view') ||
      can('messages:view') ||
      can('audience:tags_view') ||
      can('audience:segments_view') ||
      can('infra:view')
    );
  }

  get filtersSelected() {
    return (
      (this.isAllCampaigns ? 1 : this.selectedCampaigns.length) +
      this.selectedMessages.length +
      this.selectedTags.length +
      this.selectedSegments.length +
      this.selectedSenders.length +
      this.selectedSubUsers.length +
      (this.isAllAutomations ? 1 : this.selectedAutomations.length)
    );
  }

  changeChart(isChartPercentage: boolean) {
    this.isChartPercentage = isChartPercentage;
    if (this.isChartPercentage) {
      if (['web-push', 'mobile-push'].includes(this.type)) {
        this.series = this.applySafeNumberToSeries([
          {
            name: this.$t('datatable.delivered') as string,
            value: 'percentageDelivered',
          },
          {
            name: this.$t('title.click') as string,
            value: 'percentageClick',
          },
          {
            name: this.$t('title.close'),
            value: 'percentageClose',
          },
        ]);
      } else {
        this.series = this.applySafeNumberToSeries([
          {
            name: this.$t('datatable.open') as string,
            value: 'percentageOpen',
          },
          {
            name: this.$t('datatable.unique_opens') as string,
            value: 'percentageUniqueOpen',
          },
          {
            name: this.$t('datatable.click') as string,
            value: 'percentageClick',
          },
          {
            name: this.$t('datatable.unique_clicks') as string,
            value: 'percentageUniqueClick',
          },
          {
            name: this.$t('datatable.unsubscribe') as string,
            value: 'percentageUnsubscribe',
          },
          {
            name: 'Bounce',
            value: 'percentageBounce',
          },
        ]);
      }
    } else {
      if (['web-push', 'mobile-push'].includes(this.type)) {
        this.series = this.applySafeNumberToSeries([
          {
            name: this.$t('datatable.sent') as string,
            value: 'sent',
          },
          {
            name: this.$t('datatable.delivered') as string,
            value: 'delivered',
          },
          {
            name: this.$t('title.click') as string,
            value: 'click',
          },
          {
            name: this.$t('title.close'),
            value: 'close',
          },
        ]);
      } else {
        this.series = this.applySafeNumberToSeries([
          {
            name: this.$t('datatable.delivered') as string,
            value: 'delivered',
            type: 'line',
          },
          {
            name: this.$t('datatable.open') as string,
            value: 'open',
            type: 'line',
          },
          {
            name: this.$t('datatable.unique_opens') as string,
            value: 'unique_opens',
            type: 'line',
          },
          {
            name: this.$t('datatable.click') as string,
            value: 'click',
            type: 'line',
          },
          {
            name: this.$t('datatable.unique_clicks') as string,
            value: 'unique_clicks',
            type: 'line',
          },
          {
            name: this.$t('datatable.unsubscribe') as string,
            value: 'unsubscribe',
            type: 'line',
          },
          {
            name: 'Bounce',
            value: 'bounce',
            type: 'line',
          },
        ]);
      }
    }
    this.onMessageMetricsChange();
  }

  async clearFilters() {
    this.selectedAutomations =
      this.selectedCampaigns =
      this.selectedMessages =
      this.selectedSegments =
      this.selectedTags =
      this.selectedSenders =
      this.selectedSubUsers =
        [];
    this.isAllAutomations = this.isAllCampaigns = false;
    if (this.chipItems.length !== 0) {
      this.getChipItems();
      this.getStatistics();
    }
  }

  removeCategory(type: string, item: any) {
    if (type === 'selectedCampaigns') {
      this.isAllCampaigns = false;
      this.selectedCampaigns = this.selectedCampaigns.filter((campaign: any) => campaign.id !== item.id);
      this.campaignsIds = [];
    }
    if (type === 'selectedAutomations') {
      this.isAllAutomations = false;
      this.selectedAutomations = this.selectedAutomations.filter((automation: any) => automation.id !== item.id);
      this.automationsIds = [];
    }
    if (type === 'selectedMessages') {
      this.selectedMessages = this.selectedMessages.filter((message: any) => message.id !== item.id);
      this.messagesIds = [];
    }
    if (type === 'selectedTags') {
      this.selectedTags = this.selectedTags.filter((tag: any) => tag.id !== item.id);
      this.tagsIds = [];
    }
    if (type === 'selectedSegments') {
      this.selectedSegments = this.selectedSegments.filter((segment: any) => segment.id !== item.id);
      this.segmentsIds = [];
    }
    if (type === 'selectedSenders') {
      this.selectedSenders = this.selectedSenders.filter((sender: any) => sender.senderEmail !== item.senderEmail);
      this.sendersIds = [];
    }
    if (type === 'selectedSubUsers') {
      this.selectedSubUsers = this.selectedSubUsers.filter((subUser: any) => subUser.value !== item.value);
      this.subUserNames = [];
    }

    this.getChipItems();
    this.getStatistics();
  }

  async getCampaigns(value: string) {
    try {
      const campaigns = this.$route.query.campaigns as string | undefined;
      let campaignsIds: number[] = [];

      if (campaigns) {
        campaignsIds = campaigns.split(',').map((id) => Number(id));
      }
      const result = await this.campaignService.getCampaigns({
        title: value,
        pagination: { itemsPerPage: 20, page: 1 },
        type: this.type,
        filters: {
          campaignsIds: campaignsIds.length > 0 ? campaignsIds : undefined,
        },
      });
      this.campaigns = result?.data?.results;
    } catch (err) {
      console.error(err);
    }
  }

  async getAutomationsMessages(value: string) {
    try {
      const messages = this.$route.query.messages as string | undefined;
      let messagesIds: number[] = [];

      if (messages) {
        messagesIds = messages.split(',').map((id) => Number(id));
      }

      const result = await this.messagesService.getMessages({
        title: value,
        itemsPerPage: 20,
        page: 1,
        type: this.type.includes('email') || this.type.includes('push') ? this.type : null,
        messagesIds: messagesIds.length > 0 ? messagesIds : undefined,
      });

      this.messages = result?.data?.results;
    } catch (err) {
      console.error(err);
    }
  }

  async filterSegments(value: string) {
    this.segments = await this.getTags(value, 'segment');
  }

  filterSubUsers(value: string) {
    if (!value) {
      this.subUsers = [...this.originalSubUsers];
      return;
    }
    this.subUsers = this.originalSubUsers.filter((subUser: any) =>
      subUser.value.toLowerCase().includes(value.toLowerCase())
    );
  }

  async filterTags(value: string) {
    this.tags = await this.getTags(value, 'tag');
  }

  async getTags(value: string, type: string) {
    const values =
      type === 'tag'
        ? (this.$route.query.tags as string | undefined)
        : (this.$route.query.segments as string | undefined);
    let ids: number[] = [];

    if (values) {
      ids = values.split(',').map((id) => Number(id));
    }
    try {
      const result = await this.tagsService.getTags({
        title: value,
        itemsPerPage: 20,
        page: 1,
        ids: ids.length > 0 ? ids : undefined,
        ...(type ? { type } : {}),
      });
      return result?.data?.results || [];
    } catch (err) {
      console.error(err);
    }
  }

  async getSenders() {
    try {
      const senders = this.$route.query.senders as string | undefined;
      let sendersIds: number[] = [];

      if (senders) {
        sendersIds = senders.split(',').map((id) => Number(id));
      }
      const result = await this.messagesService.getPools({
        sendersIds: sendersIds.length > 0 ? sendersIds : undefined,
      });
      this.senders = result?.data || [];
    } catch (err) {
      console.error(err);
    }
  }

  async getAutomations(value: string) {
    try {
      const automations = this.$route.query.automations as string | undefined;
      let automationsIds: number[] = [];

      if (automations) {
        automationsIds = automations.split(',').map((id) => Number(id));
      }
      const result = await this.automationsService.getAutomations(
        { page: 1, itemsPerPage: 20 },
        { title: value, automationsIds: automationsIds.length > 0 ? automationsIds : undefined }
      );
      this.automations = result?.data?.results;
    } catch (err) {
      console.error(err);
    }
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

  getPercentage(partialNumber: number, totalNumber: number) {
    if (!partialNumber || partialNumber === 0) {
      return 0;
    }
    if (!totalNumber || totalNumber === 0) {
      return 0;
    }
    const value = (partialNumber / totalNumber) * 100;
    return value.toFixed(2);
  }

  selectAll(type: string) {
    if (type === 'campaigns') {
      if (this.isAllCampaigns) {
        this.allSelectedCampaigns = this.campaigns;
      } else {
        this.allSelectedCampaigns = [];
      }
    }
    if (type === 'automations') {
      if (this.isAllAutomations) {
        this.allSelectedAutomations = this.automations;
      } else {
        this.allSelectedAutomations = [];
      }
    }
  }

  exportData() {
    const titleKeys = this.headers.map((item: any) => item.value);

    let csvContent = titleKeys.join(',') + '\n';

    for (const item of this.tableData) {
      const itemData = [];
      for (const x of this.headers) {
        if (x.value === 'date') {
          itemData.push(item['originalDate']);
          continue;
        }

        itemData.push(item[x.value]);
      }
      csvContent += itemData.join(',') + '\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8,' });
    const objUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', objUrl);
    link.setAttribute('download', `bfm-stats-${this.type}.csv`);
    document.body.appendChild(link);
    link.click();
  }

  @Watch('$route.params.type', { immediate: true, deep: true })
  async onTypeChange(newType: any) {
    if (this.type && this.type !== newType) {
      this.isLoadingData = true;
      this.loadPage = false;
      await this.clearFilters();
      const storedMetrics = localStorage.getItem('filteredMessageMetrics');
      if (storedMetrics) {
        const parsedMetrics = JSON.parse(storedMetrics);
        Object.keys(this.messageMetrics).forEach((key) => {
          if (parsedMetrics[key]) {
            this.messageMetrics[key] = { ...this.messageMetrics[key], ...parsedMetrics[key] };
          }
        });
      }
      await this.dispatchBeforeMount();
    }
  }

  get colors(): string[] {
    return this.effectiveSeries.map((serie) => {
      let metricKey = serie.value;

      if (serie.value.startsWith('percentage')) {
        const baseValue = serie.value.replace(/^percentage/, '');

        switch (baseValue) {
          case 'UniqueOpen':
            metricKey = 'unique_opens';
            break;
          case 'UniqueClick':
            metricKey = 'unique_clicks';
            break;
          default:
            metricKey = baseValue.toLowerCase();
            break;
        }
      }
      return this.messageMetrics[metricKey]?.color;
    });
  }

  @Watch('messageMetrics', { deep: true })
  onMessageMetricsChange(): void {
    this.effectiveSeries = this.filterChartSeries(this.series, this.messageMetrics);
    this.effectiveHeaders = this.filterHeaders(this.headers, this.messageMetrics);

    if (this.isChartPercentage) {
      this.chartOptionsPercentage = {
        ...this.chartOptionsPercentage,
        colors: this.colors,
      };
    } else {
      this.chartOptions = {
        ...this.chartOptions,
        colors: this.colors,
      };
    }
  }

  @Watch('type')
  updateDeliveredColor() {
    this.messageMetrics.delivered.color = ['web-push', 'mobile-push'].includes(this.type) ? '#0FB75C' : '#0057f4';
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.dashboard-cards-wrapper {
  container-type: inline-size;
  container-name: dashboard-cards;
  margin-bottom: 2em;
}

.switch-chart {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  margin-bottom: 0;
}

.switch-option {
  padding: 8px;
  color: #a6a6a6;
  line-height: 100%;

  &:hover {
    cursor: pointer;
    background: #a6a6a6;
    color: white;
  }
}

.switch-option-first {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  border-top: 1px #a6a6a6 solid;
  border-bottom: 1px #a6a6a6 solid;
  border-left: 1px #a6a6a6 solid;
}

.switch-option-last {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  border-top: 1px #a6a6a6 solid;
  border-bottom: 1px #a6a6a6 solid;
  border-right: 1px #a6a6a6 solid;
}

.switch-option-active {
  background: $ds-blue;
  color: white;
  border-color: $ds-blue;

  &:hover {
    background: $ds-blue;
    color: white;
  }
}

.dashboard-cards {
  display: grid;
  gap: 1em;
  grid-template-columns: repeat(4, 1fr);
}

.cards-push,
.cards-by-user {
  grid-template-columns: repeat(5, 1fr) !important;
}

@container dashboard-cards (width < 1000px) {
  .dashboard-cards {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}

.card-title-dashboard {
  font-weight: 600;
  font-size: 14px;
}
.c-table {
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  margin-top: 1rem;
}

::v-deep.v-data-table > .v-data-table__wrapper > table > tbody > tr > td {
  padding: $spacing-sm $spacing-sm !important;
}
.pagination {
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  margin-top: 1em;
  justify-content: center;
}
.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}
.container-filters-customize-metrics {
  display: flex;
  flex-direction: row;
  justify-content: right;
}

.container-filters-customize-metrics-switch {
  > div {
    margin-top: 0;
    margin-right: 0.5em;
  }
}

.customize-metrics-menu {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 0.4em;
  margin-right: 0.5em;
  border: 1px solid #dddddd;
  border-radius: 9px;
  background-color: #ffffff;

  &:hover {
    background: #f5f5f5;
  }
}

.date-button {
  width: 283px;
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
.date-range {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 400;
  text-transform: initial !important;
}
::v-deep.v-data-table > .v-data-table__wrapper > table > thead > tr > th.active span,
::v-deep.v-data-table > .v-data-table__wrapper > table > thead > tr > th.active i {
  color: $ds-blue !important;
}

::v-deep.v-data-table > .v-data-table__wrapper > table > thead > tr > th span,
::v-deep.v-data-table > .v-data-table__wrapper > table > thead > tr > th i {
  text-align: start !important;
}

.search-bar {
  display: flex;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-gray-100;
  margin-bottom: 0px !important;
  align-items: center;
}
.search-input {
  min-height: 36px !important;
  outline: none;
  font-size: 12px;
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
}

/* width */
::-webkit-scrollbar {
  width: 8px;
}

/* Track */
::-webkit-scrollbar-track {
  border-radius: 10px;
  background: $ds-gray-300;
}

/* Handle */
::-webkit-scrollbar-thumb {
  background: #a6a6a6;
  border-radius: 10px;
}

.item-campaigns {
  color: $ds-gray;
  height: 36px !important;
  border-bottom: 1px solid $ds-gray-100;
  font-style: normal;
  font-weight: 400;
  font-size: 12px;
  width: 262px;
}

.v-list-item__title {
  font-weight: 600;
  font-size: 12px !important;
}
::v-deep .v-label .theme--light {
  font-size: 12px !important;
}
.button-percent {
  display: flex;
  flex-direction: row;
  padding: 1em;
}
.close-button {
  background-color: #ffffff !important;
  color: $ds-gray !important;
  box-shadow: none;
  outline: none !important;
}
.filters-card {
  border-radius: 8px;
}

.filters {
  width: 262px;
  display: flex;
  flex-direction: row;
  text-transform: none;
  box-shadow: none;
  place-content: initial;
  font-size: 12px;
  font-weight: 600;
  align-items: center;
  gap: 5px;
}
.filters-text {
  text-decoration: underline;
}
.percentage-number {
  display: flex;
  justify-content: space-between;
}
.number-percentage {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}
.filter-header {
  display: flex;
  flex-direction: row;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
}
.list-groups {
  border-bottom: 1px solid $ds-gray-100;
}
.v-list-item__action {
  margin-right: 0.5em !important;
  margin-left: 0em !important;
}
.card-text {
  justify-content: space-between;
}
.checkbox-filters {
  display: flex;
  flex-direction: row;
  gap: 5px;
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
}
.label-filters-disabled {
  color: $ds-gray-300 !important;
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
.clear-fields {
  text-transform: none;
  font-size: 12px;
}
.clear-fields:disabled {
  color: $ds-gray-300;
}
.clear-fields:hover {
  text-decoration: underline;
}
.filters-buttons {
  display: flex;
  flex-direction: row;
  padding: 0.5em;
  margin-top: 10px;
  justify-content: flex-end;
  gap: 25px;
}

.md-chip-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  background: $ds-gray-300;
  border: 1px solid $ds-gray-300;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  text-align: center;
  cursor: default;
}
.filters-chips-color {
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  height: 24px;
  font-size: 10px;
  display: flex;
  font-weight: 600;
  border-radius: 20px;
  align-items: center;
  justify-content: space-between;
  padding-right: 6px;
  gap: 10px;
}
::v-deep .v-chip__content {
  display: flex !important;
  gap: 10px !important;
}
.icon-chips {
  color: $ds-gray-300;
}
.date-select {
  padding-bottom: 1em;
  align-items: center;
  justify-content: left;
  display: flex;
  flex-direction: row;
  gap: 0.5em;
  justify-content: space-between;
}
.date-text {
  width: 283px;
  border-radius: 8px;
  height: 35px;
  display: flex;
  flex-direction: row;
  cursor: pointer;
  box-shadow: none;
  font-weight: 400;
  font-size: 14px;
  border: 1px solid $ds-gray-300;
}
::v-deep.v-text-field.v-text-field--solo:not(.v-text-field--solo-flat) > .v-input__control > .v-input__slot {
  box-shadow: none;
}
.icon-title {
  display: flex;
  gap: 0.5em;
  flex-direction: row;
  align-items: center;
}
.chart-card {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  padding: 15px 20px 5px 20px;
  border-radius: 16px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1) !important;
  width: auto;
  z-index: 0 !important;
}

.info-cards {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  border-radius: 16px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1) !important;
  height: 92px;
  width: auto;
  z-index: 0 !important;
}

::v-deep .v-data-table-header {
  white-space: nowrap !important;
}

.number-align {
  text-align: flex-end;
  font-weight: 600;
  font-size: 20px;
}
.number-cards {
  font-weight: 400;
  font-size: 14px;
}

.number-color-contacts {
  color: $ds-blue;
}

.number-color-open {
  color: $ds-green;
}

.number-color-unique-opens {
  color: $ds-green-dark;
}

.number-color-click {
  color: $ds-light-blue;
}

.number-color-unique-click {
  color: $ds-blue-dark;
}

.number-color-ctor {
  color: $ds-purple;
}

.number-color-unsubscribe {
  color: $ds-red;
}

.number-color-bounce {
  color: $ds-orange;
}
.nav-bar-pages {
  background-color: #ffffff;
  width: 100%;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 24px;
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.1),
    0px 1px 2px 0px rgba(0, 0, 0, 0.06);
}

.messages-pages {
  text-decoration: none;
  letter-spacing: 0.7px;
  display: flex;
  padding: 6px 12px;
  border-radius: 12px;
}

.inactive-class {
  color: #a6a6a6;
  background-color: #ffffff;

  &:hover {
    background-color: $ds-gray-100;
  }
}

.active-class {
  color: $ds-blue;
  background-color: #f4f8ff;
}

.filters-chips {
  display: flex;
  flex-direction: row;
  align-items: center;
  width: -webkit-fill-available;
}

.expand-tags {
  margin-top: -7px;
  transition:
    width 2s ease-out,
    height 2s ease-out;
  margin-bottom: 10px;
}

.closed-tags {
  margin-top: -7px;
  margin-bottom: 10px;
  max-height: 24px;
}

.chip-expand {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-text {
  white-space: nowrap;
  max-width: 250px;
  text-overflow: ellipsis;
  overflow: hidden;
}

.open-chips {
  outline: none;
  white-space: nowrap;
  color: $ds-blue;
  padding-left: 8px;
  cursor: pointer !important;

  &:hover {
    color: $ds-blue-dark;
  }
}

.div-chip-gap {
  gap: 8px;
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

.icon-up {
  color: $ds-gray;
}

.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.filters-title {
  color: $ds-gray;
  font-size: 12px !important;
  font-weight: 400;
}

.filters-title:active {
  color: $ds-gray;
}

.menu-filters-item__hasfilters {
  font-weight: bold;
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

::v-deep.v-list-group > .v-list-group__header > .v-list-group__header__append-icon .v-icon {
  color: $ds-blue !important;
}

.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}

.calendar-icon-active {
  color: $ds-blue !important;
}

.calendar-icon {
  color: $ds-gray;
  font-size: 18px;
}

.calendar-date {
  display: flex;
  align-items: center;
  gap: 9px;
}

.stats-footer {
  padding: 1.5em;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.modal-footer {
  display: flex;
  flex-direction: row;
  border: none;
  margin-top: 1rem;
}

.modal-header {
  font-size: 1.7em;
  font-weight: 500;
  border: none;
}

.modal-body {
  font-size: 2em;
  padding: 0.1em;
}

.dialog-customize-metrics {
  width: 100%;
  border-radius: 10px;
  justify-content: center;
  padding: 1em;
}

.item-modal-customize-metrics {
  font-size: 0.7em;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  border: 1px solid #dddddd;
  border-radius: 10px;
  padding: 0;
}

.item-modal-customize-metrics-label {
  display: flex;
  justify-content: left;
  align-items: center;
  padding-left: 1em;
}

.img-item-modal-customize-metrics-label {
  padding: 0.6em;
}

.item-modal-customize-metrics-switch {
  display: flex;
  justify-content: right;
  align-items: center;
  padding: 0;
}

.button-cancel {
  width: 147px;
  height: 36px;
  border-radius: 15px;
  border: none;
  font-size: 12px;
  font-weight: 700;
  line-height: 12px;
  letter-spacing: 0.07em;
  color: #0057f4;
  text-transform: uppercase;
}

.button-save {
  width: 147px;
  height: 36px;
  border-radius: 15px !important;
  border: none;
  font-size: 12px;
  font-weight: 700;
  line-height: 12px;
  letter-spacing: 0.07em;
  color: #ffffff;
  background-color: #0057f4;
  text-transform: uppercase;
}

.buttons-color {
  color: #a6a6a6;
  &:hover {
    color: $ds-gray;
  }
}

.dropdown-filter {
  margin-right: -2px;
}

::v-deep .v-icon.mdi-chevron-down {
  font-size: 18px;
}
</style>
