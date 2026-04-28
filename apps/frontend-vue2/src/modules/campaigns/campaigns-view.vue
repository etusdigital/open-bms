<template>
  <div class="col-12">
    <div class="title-route">
      <h2 class="c-title">{{ $t('title.campaignList') }}</h2>
      <div
        v-if="$store.getters.can('campaigns:create') || $store.getters.can('campaigns:create_from_rule')"
        @mouseleave="closeAction"
        @mouseenter="openAction"
      >
        <button class="v-btn-icon button-create" @click="handleCreateClick">
          <span class="material-symbols-rounded v-icon-plus"> add </span>
          <span v-if="!currentAccount.isInternal && !showCreateSubmenu" class="add-span">{{
            $t('button.create').toString().toUpperCase()
          }}</span>
        </button>
        <div
          v-if="showCreateSubmenu"
          :class="['div-column gap-10 ds-gray-color actions-container', { show: showCreateActions }]"
        >
          <button
            v-if="$store.getters.can('campaigns:create')"
            @click="$router.push('/campaigns/new')"
            class="d-flex align-items-center justify-content-center cursor-pointer"
          >
            <span class="font-12 text-600">
              {{ $t('create.createCampaign') }}
            </span>
          </button>
        </div>
      </div>
    </div>
    <form class="default-filters-messages" @submit.prevent="filterByTitle">
      <div class="campaign-filters-options gap-10 div-row align-items-center">
        <div class="div-row align-items-center gap-5">
          <div class="search-input-size">
            <InputDefault
              :modelValue="filter.title"
              :placeholder="`${$t('input.search')}`"
              :prependIcon="'search'"
              :keyInput="'title'"
              @click="filterByTitle"
              @updateInput="updateInput"
            />
          </div>
          <v-menu
            ref="menu"
            v-model="dateMenu"
            class="date-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="283"
            data-menu="show-date"
          >
            <template v-slot:activator="{ activate }">
              <v-btn
                id="bms-campaigns-list-button-datepicker"
                class="date-button"
                :class="{ 'date-button-open': dateMenu === true }"
                v-on="activate"
                @click="dateMenu = true"
              >
                <div class="calendar-date">
                  <span
                    class="material-symbols-rounded font-16 calendar-icon"
                    :class="[dateMenu ? 'calendar-icon-active' : '']"
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
                :max="dateToVuetifyString(datePickerMaxDate)"
                @input="changeDatePicker($event)"
              />
              <div class="date-filters">
                <v-btn class="date-period" @click="selectDateFilter(0)">{{ $t('input.today') }}</v-btn>
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
                <v-btn class="date-period" @click="selectDateFilter('lastMonth')">{{ $t('input.lastMonth') }}</v-btn>
              </div>
              <div class="clear-date" v-if="selectedDates.length">
                <button class="clear-fields" :disabled="isDateRange === false" @click="clearDate()" type="button">
                  {{ $t('button.clear') }}
                </button>
              </div>
            </v-card>
          </v-menu>
        </div>
        <div class="menu-placement">
          <v-menu
            ref="menu"
            v-model="show"
            class="date-menu"
            :close-on-content-click="false"
            bottom
            transition="scale-y-transition"
            offset-y
            width="283"
            data-menu="show-filters"
          >
            <template v-slot:activator="{ on }">
              <v-btn
                id="bms-campaigns-list-button-advanced-filters"
                class="date-button"
                :class="{ 'date-button-open': show === true }"
                v-on="on"
                @click="show = true"
              >
                <div class="menu-filters" v-on="on">
                  <span class="material-symbols-rounded font-16" :class="{ 'ds-blue-color': show === true }"
                    >filter_list</span
                  >

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
                    small
                  >
                    arrow_drop_down
                  </span>
                </div>
              </v-btn>
            </template>
            <v-card width="283" class="filters-card" :class="{ 'filters-card-open': show === true }">
              <div class="list-filters">
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down font-16">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedStatus.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('datatable.status') }}
                      <span v-if="selectedStatus.length" class="filter-selected-item">
                        <p>{{ selectedStatus.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters custom-checkbox"
                        :key="`campaign-filter-${index}`"
                        v-for="(stats, index) in status"
                      >
                        <input
                          type="checkbox"
                          :key="`search-input-${index}`"
                          :id="`tag-option-${stats.id}`"
                          :value="stats"
                          v-model="selectedStatus"
                        />
                        <label class="label-filters" :for="`tag-option-${stats.id}`" :key="`tag-label-${index}`">
                          {{ stats.name }}
                        </label>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down font-16">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedTypes.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('datatable.type') }}
                      <span v-if="selectedTypes.length" class="filter-selected-item">
                        <p>{{ selectedTypes.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters custom-checkbox"
                        :key="`campaign-filter-${index}`"
                        v-for="(type, index) in campaignType"
                      >
                        <input
                          type="checkbox"
                          :key="`search-input-${index}`"
                          :id="`segment-option-${type.id}`"
                          :value="type"
                          v-model="selectedTypes"
                        />
                        <label class="label-filters" :for="`segment-option-${type.id}`" :key="`segment-label-${index}`">
                          {{ type.name }}
                        </label>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
                <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down font-16">
                  <template v-slot:activator>
                    <v-list-item-title
                      :class="selectedMessages.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                      style="display: flex; flex-direction: row"
                    >
                      {{ $t('title.channels') }}
                      <span v-if="selectedMessages.length" class="filter-selected-item">
                        <p>{{ selectedMessages.length }}</p>
                      </span>
                    </v-list-item-title>
                  </template>
                  <v-list-item-content>
                    <div class="filters-list">
                      <div
                        class="checkbox-filters custom-checkbox"
                        :key="`campaign-filter-${index}`"
                        v-for="(type, index) in typeCampaign"
                      >
                        <input
                          type="checkbox"
                          :key="`search-input-${index}`"
                          :id="`segment-option-${type}`"
                          :value="type"
                          v-model="selectedMessages"
                        />
                        <label class="label-filters" :for="`segment-option-${type}`" :key="`segment-label-${index}`">
                          {{ type }}
                        </label>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
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
                        class="checkbox-filters custom-checkbox"
                        :key="`tag-filter-${index}`"
                        v-for="(tag, index) in tags"
                      >
                        <input
                          type="checkbox"
                          :key="`tag-input-${index}`"
                          :id="`tag-option-${tag.id}`"
                          :value="tag.id"
                          v-model="selectedTags"
                          class="input-filters"
                        />
                        <label class="label-filters" :for="`tag-option-${tag.id}`" :key="`tag-label-${index}`">
                          {{ tag.name }}
                        </label>
                      </div>
                    </div>
                  </v-list-item-content>
                </v-list-group>
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
                        class="checkbox-filters custom-checkbox"
                        :key="`segment-filter-${index}`"
                        v-for="(segment, index) in segments"
                      >
                        <input
                          type="checkbox"
                          :key="`segment-input-${index}`"
                          :id="`segment-option-${segment.id}`"
                          :value="segment.id"
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
              <div class="filters-buttons" v-if="filtersSelected !== 0">
                <div class="switch-filter">
                  <ToggleSwitchComponent v-model="filterSettings.switchFilter" size="small" />
                  <span class="label-switch">Salvar filtro</span>
                </div>
                <a class="button-link" @click="clearFilters()"> {{ $t('button.clear') }} </a>
                <ButtonDefault
                  :name="`${$t('button.apply')}`"
                  data-cy="button-view-fields"
                  class="buttons-specs"
                  :disabled="filtersSelected === 0"
                  @click="applyFilters()"
                />
              </div>
            </v-card>
          </v-menu>
        </div>
      </div>
    </form>
    <div class="dashboard-cards-wrapper mt-4">
      <div class="dashboard-cards mt-1">
        <div>
          <DataLoader :isLoading="isLoadingCampaigns" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingCampaigns">
            <div class="icon-title">
              <span class="material-symbols-rounded ds-gray-color font-20">progress_activity</span>
              <p class="card-title-dashboard m-0 p-0">{{ $t('button.sending') }}</p>
            </div>
            <div class="number-percentage">
              <p class="number-align m-0 p-0">
                {{ sending | formatNumber }}
              </p>
            </div>
          </v-card>
        </div>
        <div>
          <DataLoader :isLoading="isLoadingCampaigns" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingCampaigns">
            <div class="icon-title">
              <span class="material-symbols-rounded ds-gray-color font-20">schedule </span>
              <p class="card-title-dashboard m-0 p-0">{{ $t('title.scheduled') }}</p>
            </div>
            <div class="number-percentage">
              <p class="number-align m-0 p-0">
                {{ scheduled | formatNumber }}
              </p>
            </div>
          </v-card>
        </div>
        <div>
          <DataLoader :isLoading="isLoadingCampaigns" :type="'table-heading, list-item-two-line'" />
          <v-card class="info-cards" v-if="!isLoadingCampaigns">
            <div class="icon-title">
              <span class="material-symbols-rounded ds-gray-color font-20">check_circle</span>
              <p class="card-title-dashboard m-0 p-0">{{ $t('title.sendedCampaigns') }}</p>
            </div>
            <div class="number-percentage">
              <p class="number-align m-0 p-0">
                {{ sended | formatNumber }}
              </p>
            </div>
          </v-card>
        </div>
      </div>
    </div>
    <div class="mt-7">
      <DataLoader :isLoading="isLoadingCampaigns" :type="'table-tbody, table-tbody'" class="mt-4" />
      <div :class="isLoadingCampaigns ? 'd-none' : ''">
        <v-data-table
          v-if="campaigns.length > 0"
          :headers="tHeader"
          :items="campaigns"
          :page.sync="pagination.page"
          :items-per-page="pagination.itemsPerPage"
          hide-default-footer
          class="c-table"
          :calculate-widths="true"
          :no-data-text="`${$t('datatable.noCampaign')}`"
          :loading="isLoadingCampaigns"
          :server-items-length="pagination.totalItems"
          :options.sync="options"
        >
          <template v-slot:[`item.title`]="{ item }">
            <div class="td-item">
              <router-link
                :to="{ name: 'news-campaigns-edit', params: { id: item.id } }"
                :title="`${$t('create.viewInfo')}`"
                class="cursor-pointer font-12 font-title-semibold"
                style="white-space: nowrap"
              >
                {{ item.title }}
              </router-link>

              <p class="m-0 mt-1 text--secondary font-12" v-if="item.description">
                {{ item.description }}
              </p>
            </div>
          </template>
          <template v-slot:[`item.status`]="{ item }">
            <div aria-label="sending" v-if="item.status === statusCampaignEnum.Sending">
              <template>
                <div class="progress-container">
                  <div class="progress-text">{{ $t(`datatable.sending`) }}: {{ item.sentPercentage || 0 }}%</div>
                  <span class="progress-bar" :style="{ width: (item.sentPercentage || 0) + '%' }"></span>
                </div>
              </template>
            </div>
            <span class="status-chip font-10" :class="[`status-${pipeStatusCampaign(item.status)}`]" v-else>
              {{ $t(`datatable.${pipeStatusCampaign(item.status)}`) }}
            </span>
          </template>
          <template v-slot:[`item.type`]="{ item }">
            <div
              v-tooltip.top="
                `${$t(`datatable.${item.type}`)}${
                  item.testabCriteria ? `: ${$t(`datatable.${item.testabCriteria}`)}` : ''
                }`
              "
            >
              <img :src="getCustomIcon('type', item.type)" class="icon-size" />
            </div>
          </template>
          <template v-slot:[`item.messageType`]="{ item }">
            <div class="message-type-icon">
              <div v-tooltip.top="`${$t(`datatable.${item.messageType}`)}`">
                <img
                  v-if="item.messageType === 'whatsapp'"
                  :src="getCustomIcon('message', item.messageType)"
                  class="icon-size size-message"
                />
                <span v-else class="material-symbols-rounded ds-gray-color font-20">
                  {{ getCustomIcon('message', item.messageType) }}
                </span>
              </div>
            </div>
          </template>

          <template v-slot:[`item.scheduleTo`]="{ item }">
            <div class="td-item tabular-nums datetime-wrapper font-12">
              {{ item.scheduleTo | formatDateTime }}
            </div>
          </template>

          <template v-slot:[`item.tags`]="{ item }">
            <div v-if="item.sendToAll" class="status-chip status-draft font-10">
              {{ $t('create.campaignSendToAll') }}
            </div>
            <div class="td-item d-flex" v-else-if="item.tags">
              <span
                v-for="(keyTag, index) in Object.keys(item.tags).slice(0, 2)"
                :key="index"
                class="mr-2 status-chip status-draft font-10"
              >
                {{ item.tags[keyTag].name }}
              </span>

              <div v-if="Object.keys(item.tags).length > 2"><span>...</span></div>
            </div>
          </template>

          <template v-slot:[`item.sentContacts`]="{ item }">
            <div class="td-item tabular-nums font-12">
              {{ item.sentContacts | formatNumber }}
            </div>
          </template>

          <template v-slot:[`item.deliveredRate`]="{ item }">
            <div class="td-item tabular-nums font-12 div-row gap-5 justify-end">
              {{ item.deliveredRate }}
            </div>
          </template>

          <template v-slot:[`item.openRate`]="{ item }">
            <div class="td-item tabular-nums font-12">
              {{ item.openRate }}
            </div>
          </template>

          <template v-slot:[`item.ctr`]="{ item }">
            <div class="td-item tabular-nums font-12">{{ item.ctr }}</div>
          </template>

          <template v-slot:[`item.ctor`]="{ item }">
            <div class="td-item tabular-nums font-12">{{ item.ctor }}</div>
          </template>

          <template v-slot:[`item.unsubscribe`]="{ item }">
            <div class="td-item tabular-nums font-12">
              {{ item.unsubscribe | formatNumber }}
            </div>
          </template>

          <template v-slot:[`item.bounce`]="{ item }">
            <div class="td-item tabular-nums font-12 pr-2">
              {{ item.bounce | formatNumber }}
            </div>
          </template>

          <template v-slot:[`item.actions-option`]="{ item }">
            <div class="action-row">
              <div class="outside-circle" :id="'action-button' + item.id" @click="showActions(item, $event.target)">
                <div class="inside-circle"></div>
                <div class="inside-circle"></div>
                <div class="inside-circle"></div>
              </div>
            </div>
          </template>
        </v-data-table>
        <div v-if="campaigns.length === 0 && !isLoadingCampaigns" class="container-no-results">
          <img src="@/assets/campaign_fill.svg" width="80" height="80" />
          <p class="font-16 font-title-style">{{ $t('datatable.noCampaigns') }}</p>
          <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
        </div>
      </div>
      <v-dialog v-model="showDeleteDialog" persistent max-width="400px">
        <v-card>
          <v-card-title class="text-h6 break-word">{{ $t('modal.removeCampaign') }}</v-card-title>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn class="button-outlined" text @click="showDeleteDialog = false">{{ $t('button.cancel') }}</v-btn>
            <v-btn color="red" text @click="deleteCampaign">{{ $t('input.yes') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
    <div v-if="campaigns.length > 0" class="text-center pagination pt-5 align-items-center justify-space-between">
      <div class="div-row gap-5 align-items-center">
        <span class="d-flex text-400 font-12 text-nowrap align-items-center">{{ $t('input.itemsPerPage') }}</span>
        <select
          class="select-items-per-page font-12 text-400"
          @change="setItemsNumber($event.target.value)"
          v-model="pagination.itemsPerPage"
        >
          <option class="font-12 text-400" v-for="item in selectItemsPerPage" :value="item.value" :key="item.value">
            {{ item.text }}
          </option>
        </select>
      </div>
      <v-pagination
        v-if="campaigns.length > 0"
        v-model="pagination.page"
        class="c-pagination"
        :length="pagination.totalPages"
        :total-visible="10"
        @input="handlePagination"
      ></v-pagination>
      <span class="font-12 text-400 text-nowrap">
        {{ $t('datatable.showing') }}
        {{
          $t('datatable.contactsTotal', {
            rangeStart: rangeStart,
            rangeFinal: rangeFinal,
            total: pagination.totalItems,
          })
        }}
      </span>
    </div>

    <div id="campaigns-item-menu" class="drop-down">
      <button type="button" class="copy-button" @click="openMessagePreview()">
        <span class="material-symbols-rounded ds-gray-color">visibility</span>
        <p class="font-title">{{ $t('button.viewMessage') }}</p>
      </button>
      <button type="button" class="copy-button" @click="getCampaignStatistic()">
        <span class="material-symbols-rounded ds-gray-color">finance</span>
        <p class="font-title">{{ $t('sidebar.dashboard') }}</p>
      </button>
      <button
        v-if="$store.getters.can('campaigns:duplicate')"
        type="button"
        @click="copyCampaign()"
        class="copy-button"
      >
        <span class="material-symbols-rounded ds-gray-color">content_copy</span>
        <p class="font-title">{{ $t('button.duplicate') }}</p>
      </button>
      <button
        v-if="$store.getters.can('campaigns:delete')"
        type="button"
        @click="confirmDeleteCampaign()"
        class="trash-button"
      >
        <span class="material-symbols-rounded ds-red-color">delete</span>
        <p class="font-title">{{ $t('button.delete') }}</p>
      </button>
    </div>
    <v-dialog v-model="open">
      <MessagePreview
        :messageId="campaignMessage"
        :type="campaignsType"
        :messageIndex="0"
        :isStatistics="campaignsStatus"
        :filterId="actionsSelectedItem && actionsSelectedItem.id"
        filterType="campaign"
        @closeMessagePreview="closeMessagePreview"
      />
    </v-dialog>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { CampaignMessageType, CampaignsType, StatusCampaignEnum } from '@/modules/campaigns/enums/campaign.enum';
import ApiService from '@/services/api.service';
import ToastService from '@/services/toast.service';
import { Pagination } from '@/models/pagination';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import CircularProgress from '@/components/circular-progress/CircularProgress.vue';
import { areObjectsEqual, getItemsPerPage, setItemsPerPage } from '../../util/objects';
import { CampaignsDto } from './dtos/campaigns.dto';
import CampaignService from '@/services/campaign.service';
import { CampaignsFiltersDto } from '../campaigns/dtos/campaings-filters.dto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import ToggleSwitchComponent from '@/components/toggle-switch/ToggleSwitchComponent.vue';
import TagsService from '@/modules/tags/services/tag.service';
import { TagDto } from '../tags/dtos/tag.dto';
import { SegmentDto } from '../segment/dtos/segment.dto';
import { mapState } from 'vuex';
import MessagePreview from '@/components/common/MessagePreview.vue';
import { setMenuTop } from '../../util/objects';
import DashboardService from '../dashboard/services/dashboard.service';
import { AccountDto } from '../accounts/dtos/account.dto';
import { formatDateTz } from '@/util/date';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: {
    ButtonDefault,
    DataLoader,
    InputDefault,
    CircularProgress,
    ToggleSwitchComponent,
    MessagePreview,
  },
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage', 'currentAccount']),
  },
})
export default class CampaignsView extends Vue {
  private api = new ApiService();
  private readonly toastService = new ToastService();
  private readonly campaignService = new CampaignService();
  private readonly tagsService = new TagsService();
  private readonly dashboardService = new DashboardService();
  public selectedStatus: any = [];
  public selectedTypes: any = [];
  public selectedMessages: any = [];
  public selectedTags: any = [];
  public selectedSegments: any = [];
  public selectedDates: any = [];
  public currentAccountTimezone!: string;
  public currentAccount!: AccountDto;
  public userLanguage!: string;
  filters: CampaignsFiltersDto = {} as CampaignsFiltersDto;
  campaigns: Array<CampaignsDto> = new Array<CampaignsDto>();
  tags: Array<TagDto> = new Array<TagDto>();
  segments: Array<SegmentDto> = new Array<SegmentDto>();
  statusCampaign: any = StatusCampaignEnum;
  typeCampaign: any = CampaignMessageType;
  currentEditingCampaign: any = {};
  pagination = new Pagination();
  campaignSending: any = { campaignsIds: [] };
  interval: any;
  campaignData = 0;
  show = false;
  open = false;
  tHeader: any = [
    {
      text: this.$t('datatable.name'),
      value: 'title',
      sortable: true,
      width: '20%',
      class: 'font-title-header',
    },
    {
      text: this.$t('datatable.status') as string,
      value: 'status',
      sortable: true,
      width: '10%',
      align: 'center',
      class: 'status-header',
    },
    { text: this.$t('datatable.type'), value: 'type', sortable: true, width: '5%', align: 'center' },
    { text: this.$t('datatable.message'), value: 'messageType', sortable: true, width: '5%', align: 'center' },
    { text: this.$t('datatable.dispatch'), value: 'scheduleTo', sortable: true, width: '5%' },
    { text: 'Tags', value: 'tags', sortable: true, width: '25%' },
    { text: this.$t('datatable.sended'), value: 'sentContacts', sortable: true, align: 'end', width: '20%' },
    { text: this.$t('datatable.delivered'), value: 'deliveredRate', sortable: true, align: 'end', width: '15%' },
    { text: this.$t('datatable.openRate'), value: 'openRate', sortable: true, align: 'end', width: '15%' },
    { text: 'CTR', value: 'ctr', sortable: true, align: 'end', width: '15%' },
    { text: 'CTOR', value: 'ctor', sortable: true, align: 'end', width: '15%' },
    { text: this.$t('datatable.unsubscribe'), value: 'unsubscribe', sortable: true, align: 'end', width: '15%' },
    { text: this.$t('datatable.bounce'), value: 'bounce', sortable: true, align: 'end', width: '15%' },
    { text: '', value: 'actions-option', sortable: false, width: '5%', cellClass: 'action-cell' },
  ];
  options: any = {
    page: 1,
    sortBy: ['scheduleTo'],
    sortDesc: [true],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  isLoadingCampaigns = false;
  showDeleteDialog = false;
  status: { id: StatusCampaignEnum; name: string }[] = [
    { id: StatusCampaignEnum.Scheduled, name: this.$t('datatable.scheduled') as string },
    { id: StatusCampaignEnum.Draft, name: this.$t('datatable.draft') as string },
    { id: StatusCampaignEnum.Sending, name: this.$t('datatable.sending') as string },
    { id: StatusCampaignEnum.Paused, name: this.$t('datatable.paused') as string },
    { id: StatusCampaignEnum.Stopped, name: this.$t('datatable.stopped') as string },
    { id: StatusCampaignEnum.Completed, name: this.$t('datatable.completed') as string },
    { id: StatusCampaignEnum.SendingTestAb, name: this.$t('datatable.sendingTestAb') as string },
  ];
  campaignType: { id: CampaignsType; name: string }[] = [
    { id: CampaignsType.SIMPLE, name: this.$t('datatable.simple') as string },
    { id: CampaignsType.SPLIT, name: this.$t('datatable.split') as string },
    { id: CampaignsType.TESTAB, name: this.$t('datatable.testAB') as string },
    { id: CampaignsType.RECURRING, name: this.$t('datatable.recurring') as string },
  ];
  statistics: any = {};
  sending = 0;
  scheduled = 0;
  sended = 0;
  filter: any = {
    time: 30,
    title: '',
  };
  type = '';
  order = '';
  hasPageLoaded = false;
  dateMenu = false;
  dateRangeText = '';
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  isDateRange = false;
  statusCampaignEnum = StatusCampaignEnum;
  showCampaignMessages = false;
  campaignIdDialog = 0;
  filterSettings: any = {
    saveFilterPage: false,
    switchFilter: 0,
    selectedStatus: [],
    selectedTypes: [],
    selectedMessages: [],
    selectedTags: [],
    selectedSegments: [],
  };
  itemsNumber = 10;
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  rangeStart = 0;
  rangeFinal = 0;
  isDataLoaded = false;
  actionsSelectedItem!: CampaignsDto;
  campaignMessage = [];
  campaignsType = '';
  isSidebarCollapsed = '';
  datePickerMaxDate = new Date();
  campaignsIds: any[] = [];
  campaignsValues: any[] = [];
  statisticsCampaign = [];
  campaignsStatus: boolean | undefined = false;
  showCreateActions = false;
  closeTimeout: any = null;

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('campaigns');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.filterSettings = {
      ...this.filterSettings,
      selectedStatus: this.selectedStatus,
      selectedTypes: this.selectedTypes,
      selectedMessages: this.selectedMessages,
      selectedTags: this.selectedTags,
      selectedSegments: this.selectedSegments,
    };
    this.filterTags('');
    this.filterSegments('');
    this.getFiltersValue();
    await this.updateCampaigns();
    this.hasPageLoaded = true;

    this.$el.addEventListener('click', this.actionButtons);
    window.addEventListener('resize', this.actionButtons);
  }

  beforeDestroy() {
    clearInterval(this.interval);
    this.$el.removeEventListener('click', this.actionButtons);
    window.removeEventListener('resize', this.actionButtons);
  }

  get filtersSelected() {
    return (
      this.selectedStatus.length +
      this.selectedTypes.length +
      this.selectedMessages.length +
      this.selectedTags.length +
      this.selectedSegments.length
    );
  }

  getFiltersValue() {
    this.getValuesUrl();
    const storageFilterSettings = localStorage.getItem('campaignsFilterSettings');
    if (storageFilterSettings) {
      this.filterSettings = JSON.parse(storageFilterSettings);
      this.filterSettings.switchFilter = this.filterSettings.switchFilter || 0;
      this.selectedStatus = this.filterSettings.selectedStatus || [];
      this.selectedTypes = this.filterSettings.selectedTypes || [];
      this.selectedMessages = this.filterSettings.selectedMessages || [];
      this.selectedTags = this.filterSettings.selectedTags || [];
      this.selectedSegments = this.filterSettings.selectedSegments || [];
    }
  }

  findStatistics() {
    if (this.statistics.length) {
      const testAb =
        this.statistics.find((item: any) => item.status === StatusCampaignEnum.SendingTestAb)?.count_status || 0;
      this.sending =
        Number(testAb) +
        Number(this.statistics.find((item: any) => item.status === StatusCampaignEnum.Sending)?.count_status || 0);
      this.scheduled = this.statistics.find((item: any) => item.status === StatusCampaignEnum.Scheduled)?.count_status;
      this.sended = this.statistics.find((item: any) => item.status === StatusCampaignEnum.Completed)?.count_status;
      return;
    }
    this.sending = 0;
    this.scheduled = 0;
    this.sended = 0;
  }

  pipeStatusCampaign(status: StatusCampaignEnum | string): string {
    switch (status) {
      case StatusCampaignEnum.Scheduled:
        return 'scheduled';
      case StatusCampaignEnum.Draft:
        return 'draft';
      case StatusCampaignEnum.Completed:
        return 'completed';
      case StatusCampaignEnum.Stopped:
        return 'stopped';
      case StatusCampaignEnum.Paused:
        return 'paused';
      case StatusCampaignEnum.SendingTestAb:
        return 'sendingTestAb';
      default:
        return 'unknown';
    }
  }

  getCustomIcon(type: string, value: string) {
    if (type === 'status') {
      return require('@/assets/' + this.pipeStatusCampaign(value) + '.svg');
    }
    if (type === 'type') {
      return require('@/assets/' + this.switchIconTypeCampaign(value) + '.svg');
    }
    if (type === 'message') {
      return value === 'whatsapp'
        ? require('@/assets/' + this.switchIconMessageTypeCampaign(value) + '.svg')
        : this.switchIconMessageTypeCampaign(value);
    }
  }

  switchIconMessageTypeCampaign(messageType: CampaignMessageType | string): string {
    switch (messageType) {
      case CampaignMessageType.EMAIL:
        return 'mail';
      case CampaignMessageType.WEBPUSH:
        return 'computer';
      case CampaignMessageType.MOBILEPUSH:
        return 'smartphone';
      case CampaignMessageType.SMS:
        return 'sms';
      case CampaignMessageType.WHATSAPP:
        return 'whatsapp';
      default:
        return 'unknown';
    }
  }

  switchIconTypeCampaign(type: CampaignsType | string): string {
    switch (type) {
      case CampaignsType.SIMPLE:
        return 'simple';
      case CampaignsType.SPLIT:
        return 'split';
      case CampaignsType.TESTAB:
        return 'testab';
      case CampaignsType.RECURRING:
        return 'recurring';
      default:
        return 'unknown';
    }
  }

  async updateCampaigns() {
    await this.getCampaigns();
    await this.getMessageStatistics();
  }

  setItemsNumber(items: number) {
    this.options = {
      ...this.options,
      itemsPerPage: Number(items),
      page: 1,
    };
    setItemsPerPage('campaigns', items);
    this.getCampaigns();
    this.getMessageStatistics();
  }

  async getCampaigns(params?: Pagination) {
    if (this.isLoadingCampaigns) {
      return;
    }

    this.isLoadingCampaigns = true;
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
      this.filters.startDate = this.startDate;
      this.filters.endDate = this.endDate;
      this.filters.status = this.selectedStatus.map((item: any) => item.id);
      this.filters.types = this.selectedTypes.map((item: any) => item.id);
      this.filters.messages = this.selectedMessages;
      this.filters.tags = this.selectedTags;
      this.filters.segments = this.selectedSegments;
      this.rangeStart = this.pagination.itemsPerPage * (this.pagination.page - 1) + 1;
      const result = await this.campaignService.getCampaigns({
        pagination: this.pagination,
        filters: this.filters,
        title: this.filter.title,
        isTrigger: false,
      });

      this.campaigns = result?.data?.results;
      this.campaignData = result?.data?.totalItems;

      this.pagination = {
        ...this.pagination,
        itemsPerPage: parseInt(result?.data?.itemsPerPage, 10),
        page: parseInt(result?.data?.page, 10),
        totalItems: result?.data?.totalItems,
        totalPages: Math.ceil(result?.data?.totalItems / result?.data?.itemsPerPage),
      };
      const calculateFinalRange = this.pagination.itemsPerPage + this.rangeStart - 1;
      this.rangeFinal =
        this.pagination.totalItems < calculateFinalRange ? this.pagination.totalItems : calculateFinalRange;
      this.setValuesUrl();
      this.getStatistics();
      this.campaigns.forEach((campaign: any) => {
        if (campaign.status === StatusCampaignEnum.Sending || campaign.status === StatusCampaignEnum.SendingTestAb) {
          this.campaignSending.campaignsIds.push(campaign.id);
        }
        const scheduleToDate = new Date(campaign.scheduleTo);
        if (scheduleToDate > this.datePickerMaxDate) {
          this.datePickerMaxDate = scheduleToDate;
        }
      });
      if (this.campaignSending.campaignsIds.length) {
        await this.getStatisticsCampaign();
        this.loadingStatisticsCampaign();
      }
      this.isDataLoaded = true;
    } catch (error) {
      console.error(error);
    } finally {
      this.isLoadingCampaigns = false;
    }
  }

  async getStatistics() {
    const api = await this.api.getApi();
    const params = {
      ...(this.filter.title ? { title: this.filter.title } : {}),
      ...(this.startDate && this.endDate
        ? { startDate: this.startDate.toISOString().slice(0, 10), endDate: this.endDate.toISOString().slice(0, 10) }
        : {}),
      ...(this.selectedStatus.length ? { status: this.selectedStatus.map((item: any) => item.id) } : {}),
      ...(this.selectedTypes.length ? { types: this.selectedTypes.map((item: any) => item.id) } : {}),
      ...(this.selectedMessages.length ? { messages: this.selectedMessages } : {}),
      ...(this.selectedTags.length ? { tags: this.selectedTags } : {}),
      ...(this.selectedSegments.length ? { segments: this.selectedSegments } : {}),
    };

    const { data } = await api.get(`campaigns/statistics-all`, { params });
    this.statistics = data;
    this.findStatistics();
  }

  async applyFilters() {
    if (this.filterSettings.switchFilter === 1) {
      this.filterSettings = {
        saveFilterPage: true,
        switchFilter: 1,
        selectedStatus: this.selectedStatus,
        selectedTypes: this.selectedTypes,
        selectedMessages: this.selectedMessages,
        selectedTags: this.selectedTags,
        selectedSegments: this.selectedSegments,
      };
      localStorage.setItem('campaignsFilterSettings', JSON.stringify(this.filterSettings));
    }
    this.pagination.page = 1;
    this.filterSettings.saveFilterPage = true;

    this.hasPageLoaded = true;
    this.setValuesUrl();
    await this.updateCampaigns();
    this.show = false;
  }
  async clearFilters() {
    this.filterSettings.switchFilter = 0;
    this.filterSettings.saveFilterPage = false;
    localStorage.removeItem('campaignsFilterSettings');
    this.selectedStatus = [];
    this.selectedTypes = [];
    this.selectedMessages = [];
    this.selectedTags = [];
    this.selectedSegments = [];
    this.pagination.page = 1;
    this.show = false;
    this.setValuesUrl();
    await this.updateCampaigns();
  }

  updateInput(event: undefined, key: any) {
    this.filter[key] = event;
  }

  filterByTitle() {
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  filterByTime() {
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  handlePagination() {
    this.setValuesUrl();
    this.updateCampaigns();
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

    this.changeDatePicker([this.selectedDates[0], this.selectedDates[1]]);
  }

  async copyCampaign() {
    if (!this.actionsSelectedItem) {
      return;
    }

    const campaign = this.actionsSelectedItem;

    if (campaign.id) {
      const response = await this.campaignService.duplicateCampaign(campaign.id);

      if (response && response.data && response.data.id) {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.campaignDuplicated') as string,
          leftBorder: false,
        });
        this.$router.push(`/campaigns/${response.data.id}`);
      }
    }
  }

  showActions(item: any, target: HTMLElement) {
    this.actionsSelectedItem = item;
    const actions = document.querySelector('#campaigns-item-menu') as HTMLElement;
    target.classList.add('active-more-actions');
    actions.style.visibility = 'visible';

    const rect = target.getBoundingClientRect();
    this.isSidebarCollapsed = localStorage.getItem('bms-sidebar-collapsed') || '';
    const actionsWidth = this.isSidebarCollapsed === 'true' ? 380 : 573;
    actions.style.left = `${rect.left + window.scrollX - actionsWidth}px`;
    actions.style.top = `${rect.top + window.scrollY - 50}px`;
  }

  actionButtons(event: Event) {
    const target = event.target as HTMLElement;
    if (event.type === 'resize' || !target.id.includes('action-button')) {
      const actionsMenu = document.querySelector('#campaigns-item-menu') as HTMLElement;
      if (actionsMenu) {
        actionsMenu.style.visibility = 'hidden';
      }
    }

    const activeItems = document.querySelectorAll('.active-more-actions');
    if (activeItems.length > 0) {
      for (const activeItem of activeItems) {
        if (activeItem !== target) {
          activeItem.classList.remove('active-more-actions');
        }
      }
    }
  }

  confirmDeleteCampaign() {
    if (!this.actionsSelectedItem) {
      return;
    }

    const campaign = this.actionsSelectedItem;
    this.currentEditingCampaign = campaign;
    this.showDeleteDialog = true;
  }

  async deleteCampaign() {
    this.showDeleteDialog = false;
    try {
      const api = await this.api.getApi();
      await api.delete(`campaigns/${this.currentEditingCampaign.id}`);
      const idx = this.campaigns.indexOf(this.currentEditingCampaign);
      this.campaigns.splice(idx, 1);
    } catch (e) {
      console.error(e);
    }
  }

  loadingStatisticsCampaign() {
    clearInterval(this.interval);
    if (this.campaignSending.campaignsIds.length) {
      this.interval = setInterval(async () => {
        await this.getStatisticsCampaign();
      }, 10000);
    }
  }

  async getStatisticsCampaign() {
    const api = await this.api.getApi();
    const { data } = await api.get(`campaigns/statistics`, { params: this.campaignSending });
    data.forEach((campaignStatistic: any) => {
      const indexCampaign = this.campaigns.findIndex(
        (campaign: any) => campaign.id === parseInt(campaignStatistic.id, 10)
      );
      if (indexCampaign >= 0) {
        this.campaigns[indexCampaign].sentContacts = campaignStatistic.sentContacts;
        this.campaigns[indexCampaign].sentPercentage = campaignStatistic.sentPercentage;
      }
      if (parseInt(campaignStatistic.sentPercentage, 10) === 100) {
        this.campaigns[indexCampaign].status = StatusCampaignEnum.Completed;
        this.removeCampaignSending(parseInt(campaignStatistic.id, 10));
      }
    });
  }

  removeCampaignSending(item: number) {
    const index = this.campaignSending.campaignsIds.indexOf(item);
    if (index !== -1) {
      this.campaignSending.campaignsIds.splice(index, 1);
    }
    if (!this.campaignSending.campaignsIds.length) {
      clearInterval(this.interval);
    }
  }

  setValuesUrl() {
    if (!this.isDataLoaded) {
      return;
    }

    const query = {
      itemsPerPage: this.pagination.itemsPerPage,
      page: this.pagination.page,
      title: this.filter.title,
      startDate: this.startDate?.toISOString().slice(0, 10) || '',
      endDate: this.endDate?.toISOString().slice(0, 10) || '',
      status: this.selectedStatus.length ? encodeURIComponent(JSON.stringify(this.selectedStatus)) : JSON.stringify([]),
      types: this.selectedTypes.length ? encodeURIComponent(JSON.stringify(this.selectedTypes)) : JSON.stringify([]),
      messages: this.selectedMessages.length
        ? encodeURIComponent(JSON.stringify(this.selectedMessages))
        : JSON.stringify([]),
      tags: this.selectedTags.length ? encodeURIComponent(JSON.stringify(this.selectedTags)) : JSON.stringify([]),
      segments: this.selectedSegments.length
        ? encodeURIComponent(JSON.stringify(this.selectedSegments))
        : JSON.stringify([]),
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
      this.selectedStatus = this.$route.query.status
        ? JSON.parse(decodeURIComponent(this.$route.query.status as string))
        : [];
      this.selectedTypes = this.$route.query.types
        ? JSON.parse(decodeURIComponent(this.$route.query.types as string))
        : [];
      this.selectedMessages = this.$route.query.messages
        ? JSON.parse(decodeURIComponent(this.$route.query.messages as string))
        : [];
      this.selectedTags = this.$route.query.messages
        ? JSON.parse(decodeURIComponent(this.$route.query.tags as string))
        : [];
      this.selectedSegments = this.$route.query.segments
        ? JSON.parse(decodeURIComponent(this.$route.query.segments as string))
        : [];

      if (this.$route.query.startDate) {
        this.selectedDates[0] = this.$route.query.startDate?.toString();
        this.selectedDates[1] = this.$route.query.endDate?.toString();
        this.changeDatePicker(this.selectedDates);
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

    this.options = { ...this.options, page: 1, sortBy: ['scheduleTo'], sortDesc: [true] };
    this.pagination = { ...this.pagination, page: 1, sortBy: 'scheduleTo', order: 'DESC' };
    this.filter.title = '';
    this.selectedStatus = [];
    this.selectedTypes = [];
    this.selectedMessages = [];
    this.selectedTags = [];
    this.selectedSegments = [];
  }

  async filterSegments(value: string) {
    this.segments = await this.getTags(value, 'segment');
  }

  async filterTags(value: string) {
    this.tags = await this.getTags(value, 'tag');
  }

  async getTags(value: string, type: string) {
    try {
      const result = await this.tagsService.getTags({
        title: value,
        itemsPerPage: 20,
        page: 1,
        ...(type ? { type } : {}),
      });
      return result?.data?.results || [];
    } catch (err) {
      console.error(err);
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
    this.isDateRange = true;
    this.pagination = { ...this.pagination, page: 1 };
    await this.getCampaigns();
    await this.getMessageStatistics();
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

  async clearDate() {
    this.selectedDates = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.isDateRange = false;
    this.dateRangeText = '';
    await this.getCampaigns();
    await this.getMessageStatistics();
  }

  openMessagePreview() {
    if (!this.actionsSelectedItem) {
      return;
    }
    this.open = true;
    const id = this.actionsSelectedItem.id;
    this.campaignIdDialog = id || 0;
    this.campaignMessage = this.actionsSelectedItem.campaignMessage;
    this.campaignsType = this.actionsSelectedItem.type;
    this.campaignsStatus =
      [StatusCampaignEnum.SendingTestAb, StatusCampaignEnum.Sending, StatusCampaignEnum.Completed].includes(
        this.actionsSelectedItem.status
      ) || undefined;
    const moreIcon = document.querySelector(`#outside-circle${id}`) as HTMLElement;
    const actions = document.querySelector('#campaigns-item-menu') as HTMLElement;
    actions.style.visibility = 'hidden';
    moreIcon?.classList.remove('active-more-actions');
  }

  closeMessagePreview() {
    this.open = false;
  }

  getCampaignStatistic() {
    const startDate = dayjs(this.actionsSelectedItem.scheduleTo).tz(this.currentAccountTimezone).format('YYYY-MM-DD');
    const maxEndDate = dayjs(startDate).add(30, 'day').tz(this.currentAccountTimezone).format('YYYY-MM-DD');
    const currentDate = dayjs().tz(this.currentAccountTimezone).format('YYYY-MM-DD');
    const endDate = dayjs(maxEndDate).isAfter(currentDate) ? currentDate : maxEndDate;

    const route = this.$router.resolve({
      path: `/messages/${this.actionsSelectedItem.messageType}/statistics?campaigns=${this.actionsSelectedItem.id}&startDate=${startDate}&endDate=${endDate}`,
    });
    window.open(route.href, '_blank');
  }

  async getMessageStatistics() {
    const eligible = this.campaigns.filter(
      (campaign) =>
        (campaign.type === CampaignsType.RECURRING || campaign?.status === StatusCampaignEnum.Completed) &&
        campaign?.id &&
        !(campaign.type === CampaignsType.RECURRING && !campaign.recurrenceSettings?.lastSentDate)
    );

    this.campaigns = this.campaigns.map((campaign) => {
      return {
        ...campaign,
        openRate: 0,
        ctr: 0,
        ctor: 0,
        unsubscribe: 0,
        bounce: 0,
        deliveredRate: 0,
      };
    });

    if (!eligible.length) {
      return;
    }

    const tz = this.currentAccountTimezone;

    const emailCampaigns = eligible.filter(
      (c) => ![CampaignMessageType.WEBPUSH, CampaignMessageType.MOBILEPUSH].includes(c.messageType)
    );
    const pushCampaigns = eligible.filter((c) =>
      [CampaignMessageType.WEBPUSH, CampaignMessageType.MOBILEPUSH].includes(c.messageType)
    );

    const getMinStartDate = (campaigns: any[]) => {
      let minDate = dayjs().tz(tz).format('YYYY-MM-DD');
      for (const c of campaigns) {
        const d =
          c.type === CampaignsType.RECURRING && c.recurrenceSettings?.lastSentDate
            ? formatDateTz(c.recurrenceSettings.lastSentDate, tz)
            : formatDateTz(c.scheduleTo, tz);
        if (d < minDate) {
          minDate = d;
        }
      }
      return minDate;
    };

    const results: Record<number, any> = {};
    const endDate = dayjs().tz(tz).format('YYYY-MM-DD');

    const requests: Promise<void>[] = [];

    if (emailCampaigns.length) {
      requests.push(
        this.dashboardService
          .getDashboardData(getMinStartDate(emailCampaigns), endDate, {
            campaigns: emailCampaigns.map((c) => String(c.id)),
            afterTestAb: false,
            groupByCampaign: true,
          })
          .then((response) => Object.assign(results, response.data))
      );
    }

    const pushByType = new Map<string, typeof eligible>();
    for (const c of pushCampaigns) {
      const list = pushByType.get(c.messageType) || [];
      list.push(c);
      pushByType.set(c.messageType, list);
    }

    for (const [type, campaigns] of pushByType) {
      requests.push(
        this.dashboardService
          .getDashboardData(
            getMinStartDate(campaigns),
            endDate,
            {
              campaigns: campaigns.map((c) => String(c.id)),
              afterTestAb: false,
              groupByCampaign: true,
              type,
            },
            '/statistics/push'
          )
          .then((response) => Object.assign(results, response.data))
      );
    }

    await Promise.all(requests);

    this.campaigns = this.campaigns.map((campaign) => {
      const stats = campaign.id != null ? results[campaign.id]?.general : undefined;
      return {
        ...campaign,
        openRate: this.calculateMetrics(stats?.open || 0, stats?.delivered || 0),
        ctr: this.calculateMetrics(stats?.click || 0, stats?.delivered || 0),
        ctor: this.calculateMetrics(stats?.click || 0, stats?.open || 0),
        unsubscribe: stats?.unsubscribe || 0,
        bounce: stats?.bounce || 0,
        deliveredRate: this.calculateMetrics(stats?.delivered || 0, campaign.sentContacts || 0),
      };
    });
  }

  calculateMetrics(clicks: number = 0, opens: number = 0): string {
    if (!opens || !clicks) {
      return '0%';
    }
    const rate = (clicks / opens) * 100;
    return new Intl.NumberFormat(this.userLanguage, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      style: 'percent',
    }).format(rate / 100);
  }

  @Watch('dateMenu')
  onShowDateChange(value: boolean) {
    this.onMenuChange(value, 'show-date');
  }

  @Watch('show')
  onShowFilterChange(value: boolean) {
    this.onMenuChange(value, 'show-filters');
  }

  onMenuChange(value: boolean, menuSelector: string) {
    if (value) {
      this.$nextTick(() => {
        setTimeout(() => {
          let activator: HTMLElement | null = null;
          activator = this.$el.querySelector(`[data-menu="${menuSelector}"]`) as HTMLElement;

          if (activator) {
            const offset = menuSelector === 'show-date' ? 18 : 0;
            setMenuTop(activator, offset);
          }
        }, 0);
      });
    }
  }

  @Watch('options')
  async onChangeOptions() {
    if (this.hasPageLoaded === false || this.isLoadingCampaigns) {
      return;
    }

    const { sortBy, sortDesc, page } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      sortBy: sortBy[0] || 'scheduleTo',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
    };
    this.setValuesUrl();

    await this.updateCampaigns();
  }

  @Watch('$route')
  async changePagination() {
    if (this.hasPageLoaded === false || this.isLoadingCampaigns) {
      this.isDataLoaded = false;
      return;
    }
    if (Object.keys(this.$route.query || {}).length === 0) {
      this.isDataLoaded = false;
    }
    this.getValuesUrl();
    await this.updateCampaigns();
  }

  get showCreateSubmenu() {
    return false;
  }

  handleCreateClick() {
    if (this.$store.getters.can('campaigns:create')) {
      this.$router.push('/campaigns/new');
    }
  }

  openAction() {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
    this.showCreateActions = true;
  }

  closeAction() {
    this.closeTimeout = setTimeout(() => {
      this.showCreateActions = false;
      this.closeTimeout = null;
    }, 200);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/bs-layout.scss';

.default-filters-messages {
  container-type: inline-size;
  container-name: campaign-filters-options;
  width: 100%;
}

.campaign-filters-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  width: 100%;
}

@container campaign-filters-options (width < 900px) {
  .campaign-filters-options {
    grid-template-columns: repeat(1, 1fr) !important;
  }
  .menu-placement {
    justify-self: self-start !important;
  }
}

::v-deep .v-data-table-header {
  white-space: nowrap !important;
}

.menu-placement {
  justify-self: self-end;
}

.search-input-size {
  width: 283px;
}

.campaign-type {
  text-transform: capitalize;
  display: flex;
  flex-direction: row;
  gap: 5px;
  align-items: center;
  white-space: nowrap !important;
}

.font-title-header {
  font-size: 34px;
}

.dashboard-cards-wrapper {
  container-type: inline-size;
}

.dashboard-cards {
  display: grid;
  gap: 1em;
  grid-template-columns: repeat(3, 1fr);
}

.div-type-campaign {
  width: 24px;
}

.div-message-campaign {
  display: flex;
  justify-content: center;
  width: 100%;
}

::v-deep .v-text-field__slot {
  max-height: 33px !important;
}

::v-deep .v-text-field__details {
  min-height: 0px !important;
  height: 0px;
  margin: 0 !important;
  margin-bottom: 0 !important;
}

::v-deep .v-input__prepend-inner {
  margin: 0 !important;
  align-items: center;
  display: contents;
}

::v-deep.c-table {
  margin-top: 16px;
  border-radius: 16px;
  width: 100%;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);

  th.text-start {
    white-space: nowrap;
  }

  .sucess--text {
    color: $ds-blue;
  }
}

::v-deep .status-header {
  white-space: nowrap !important;
}

::v-deep .v-progress-circular__overlay {
  stroke-linecap: round;
}

.status-draft {
  color: #5c5c5c;
  background: #f5f5f5;
}
.status-scheduled {
  color: #3e87f8;
  background: #f4f8ff;
}
.status-paused {
  color: #3e87f8;
  background: #f4f8ff;
}

.status-sendingTestAb {
  color: #c0970c;
  background: #fffdef;
}

.progress-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 116px;
  background-color: #f2efff;
  height: 24px;
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  left: 50%;
  transform: translateX(-50%);
}

.progress-bar {
  position: absolute;
  left: 0%;
  background-color: #d0c9f8;
  height: 100%;
  width: 0;
  transition: width 0.5s;
  max-width: 100%;
  z-index: 0;
}

.progress-text {
  color: #7b61ff;
  position: absolute;
  width: 100%;
  text-align: center;
  font-family: Inter;
  font-style: normal;
  font-size: 10px;
  font-weight: 600;
  line-height: 150%;
  letter-spacing: 0.05375rem;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}
.card-text {
  justify-content: space-between;
}

.icon-title {
  display: flex;
  gap: 0.5em;
  flex-direction: row;
  align-items: center;
}

.card-title-dashboard {
  font-weight: 600;
  font-size: 14px;
}

.number-percentage {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}

.number-align {
  text-align: flex-end;
  font-weight: 600;
  font-size: 24px;
  color: $ds-blue;
}

.info-cards {
  display: flex;
  flex-direction: column;
  gap: 25px;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1) !important;
  height: 107px;
}

.campaign-actions {
  margin-bottom: 24px;
}

.c-pagination {
  display: flex;
  width: 100%;
  justify-content: center;
}

.actions-row {
  display: flex;
  gap: 0.75em;
}

.break-word {
  word-break: break-word;
}

.v-progress-linear {
  border-radius: 12px;
  width: 200px;
}

.card-statistics-items {
  background-color: white;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1) !important;
  border-radius: 10px;
  width: 33%;
  height: 100px;
  align-items: center;
  justify-content: center;
}

.progress-circular {
  width: 40px !important;
  height: 40px !important;
}

.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
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

.date-picker {
  border-bottom: 1px solid $ds-gray-100;
}

.date-filters {
  display: flex;
  flex-direction: column;
  padding-bottom: 10px;
}

.date-period {
  border-bottom: 1px solid $ds-gray-100;
  font-weight: 400;
  font-size: 12px;
  box-shadow: none;
  background-color: #ffffff !important;
  place-content: start;
  text-transform: initial !important;
}

.clear-date {
  display: flex;
  padding: 0px 20px 10px 0px;
  place-content: flex-end;
}

.clear-fields {
  text-transform: none;
  font-size: 12px;
  background-color: #ffffff !important;
}

.clear-fields:disabled {
  color: $ds-gray-300 !important;
}

.clear-fields:hover {
  text-decoration: underline;
}

::v-deep .v-date-picker-table {
  height: 232px;
}

.filter-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  place-content: center;
  justify-content: space-between;
  padding: 11px;
  height: 36px;
  border-bottom: 1px solid $ds-gray-100;
  cursor: pointer;
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

.icon-up {
  color: $ds-gray;
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

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
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
  border-top: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.filters-card {
  border-radius: 8px;
}

.filters-label {
  color: $ds-blue;
}

.close-button {
  background-color: #ffffff !important;
  color: $ds-gray !important;
  box-shadow: none;
  outline: none !important;
}

.list-groups {
  border-bottom: 1px solid $ds-gray-100;
}

.search-bar {
  display: flex;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-gray-100;
  margin-bottom: 0px !important;
  align-items: center;
}

.filter-label-color {
  color: $ds-blue;
}

.search-input {
  min-height: 37px !important;
  outline: none;
  font-size: 12px;
  color: $ds-gray;
  width: -webkit-fill-available;
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

.filters-buttons {
  display: flex;
  flex-direction: center;
  padding: 0.5em;
  margin-top: 10px;
  justify-content: flex-end;
  gap: 15px;
  overflow: hidden;
}

.button-link {
  font-size: 14px;
  justify-content: center;
  color: #0057f4;
  text-decoration: none;
  font-weight: 700;
  text-transform: uppercase;
  margin-top: 4px;
}

.switch-filter {
  display: flex;
  margin-top: 5px;
  margin-right: 10px;
  flex-direction: center;
  align-items: center;
}
.label-switch {
  margin-bottom: 9px;
  font-size: 10px;
  font-weight: 400;
  color: #5c5c5c;
  padding-left: 3px;
}

.v-input--selection-controls {
  margin-top: 0px !important;
  padding-top: 0px !important;
}

.clear-fields {
  text-transform: none;
  font-size: 12px;
}

.v-list-item-title[aria-expanded='true'] {
  background-color: $ds-gray-100;
}

.btn-clear {
  color: $ds-blue !important;
  background-color: #ffffff !important;
  border: 1px solid $ds-blue !important;
  width: 72px;
}

.btn-clear:hover {
  background: $ds-blue !important;
  color: #ffffff !important;
}

.buttons-specs:disabled:hover {
  background-color: inherit !important;
}

.buttons-specs {
  box-shadow: none !important;
  align-items: center;
  text-align: center;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  font-style: normal;
  font-weight: 700;
  width: 73px;
  height: 26px !important;
  font-size: 10px;
  border-radius: 8px !important;
}

.btn-clear:disabled {
  color: $ds-gray-300 !important;
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300 !important;
}

.filters-title {
  color: $ds-gray;
  font-size: 12px !important;
}

.filters-title:active {
  color: $ds-gray;
}

::v-deep.v-list-group > .v-list-group__header > .v-list-group__header__append-icon .v-icon {
  color: $ds-blue !important;
}

.action-row {
  position: absolute;
  top: 3px;
  right: 0;
  height: 96%;
  width: 50px;
  background-color: white;
  display: flex;
  justify-content: center;
  align-items: center;
}

.outside-circle {
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  align-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  padding-top: 2px;
  padding-bottom: 2px;
}

.active-more-actions {
  background: $ds-blue;
  .inside-circle {
    background: white;
  }
}

.active-more-actions:hover {
  background: $ds-blue !important;
}

.outside-circle:hover {
  cursor: pointer;
  background: #0055f40e;
}

.inside-circle {
  background: $ds-gray-400;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  pointer-events: none;
}

.drop-down {
  z-index: 10;
  position: absolute;
  visibility: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  width: 229px;
  height: fit-content;
  padding: 10px 10px;
  background: white;
  border-radius: 16px;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.5);
  top: 0;
  right: 0;
  margin-top: -21px;
  margin-left: -8px;
}

.copy-button {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: clamp(6px, 0.8vw, 10px);
  width: 100%;

  p {
    margin-bottom: 0;
    margin-left: 9px;
    font-size: 16px;
  }
}
.copy-button:hover {
  background: $ds-gray-100;
  transition: all 0.25s;
  border-radius: 6px;
}

.trash-button {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: clamp(6px, 0.8vw, 10px);
  width: 100%;

  p {
    margin-bottom: 0;
    margin-left: 9px;
    color: $ds-red;
    font-size: 16px;
  }
}

.trash-button:hover {
  background: #f0323213;
  transition: all 0.25s;
  border-radius: 6px;
}

.div-trash:hover button img {
  filter: invert(24%) sepia(76%) saturate(2975%) hue-rotate(346deg) brightness(97%) contrast(92%);
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

.font-title-semibold {
  font-weight: 600;
}

.size-message {
  width: 20px;
  height: 20px;
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

.container-no-results {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #ffffff;
  border-radius: 16px;
  width: 100%;
  height: 247px;
  padding: 20px;
}

.dropdown-filter {
  margin-right: -2px;
}

.actions-container {
  position: absolute;
  top: 1px;
  left: 170px;
  transform: translateY(-15%);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: all 0.3s ease-out;

  &.show {
    transform: translateY(-55px);
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    cursor: pointer !important;
  }

  button {
    background-color: $neutral-basic-white;
    border-radius: 8px;
    padding: 10px;
    box-shadow: 0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06);
    width: max-content;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    &:hover {
      transform: scale(1.08);
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }
}

.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.date-text {
  display: flex;
  margin-bottom: -30px;
  width: 167px;
  font-size: 12px;
}

::v-deep .v-icon.mdi-chevron-down {
  font-size: 18px;
}

::v-deep .v-dialog {
  width: fit-content;
  border-radius: 16px;
}

::v-deep .v-input__control {
  height: 36px !important;
}
</style>
