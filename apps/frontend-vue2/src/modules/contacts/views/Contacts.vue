<template>
  <div class="col-12 pt-0">
    <!-- Barra de progresso circular no canto superior direito -->
    <div v-if="isExporting" class="export-progress-container">
      <CircularProgress :progress="exportProgress.toString()" />
      <span class="export-progress-text">Exporting...</span>
      <span class="export-progress-text">{{ exportProgress }}%</span>
    </div>

    <v-skeleton-loader v-if="!dataInfo" type="image, card-heading"></v-skeleton-loader>
    <v-row v-if="dataInfo">
      <v-col cols="4">
        <v-card class="card-info">
          <h6><span class="material-symbols-rounded font-20 mr-2"> people </span>Total</h6>
          <h3>{{ dataInfo.total | formatNumber }}</h3>
        </v-card>
      </v-col>
      <v-col cols="4">
        <v-card class="card-info">
          <h6>
            <span class="material-symbols-rounded font-20 mr-2"> meeting_room </span
            >{{ $t('datatable.subscribeToday') }}
          </h6>
          <h3>{{ dataInfo.current_date | formatNumber }}</h3>
        </v-card>
      </v-col>
      <v-col cols="4">
        <v-card class="card-info">
          <h6>
            <span class="material-symbols-rounded font-20 mr-2"> arrow_drop_down </span
            >{{ $t('datatable.activePlural') }}
          </h6>
          <h3>{{ dataInfo.active | formatNumber }}</h3>
        </v-card>
      </v-col>
    </v-row>
    <v-row v-if="dataInfo">
      <v-col cols="12">
        <v-card class="card-info">
          <div class="horizontal-bar w-100 d-flex mt-5">
            <div
              v-for="(n, index) in 5"
              :key="`chart-index-${index}`"
              v-tooltip.top="((dataInfo[providers[index]] / dataInfo.total) * 100).toFixed(1) + '%'"
              :style="{ width: `${(dataInfo[providers[index]] / dataInfo.total) * 100}%` }"
              :class="getClassChart(providers[index], index)"
            ></div>
          </div>
          <div class="d-flex justify-center align-center mt-5 mb-2">
            <template v-for="(n, index) in 5">
              <span :class="providers[index] + '-color span-provider-color'" :key="`chart-span-${index}`"></span>
              <label class="px-2 mr-5 mb-0 label-provider" :key="`chart-label-${index}`">{{ providers[index] }}</label>
            </template>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <div class="date-select align-items-center mt-6">
      <div class="default-filters__search-input">
        <form @submit.prevent="filterByTitle">
          <InputDefault
            :modelValue="filter.title"
            :placeholder="`${$t('input.searchName')}`"
            :prependIcon="'search'"
            :keyInput="'title'"
            @click="filterByTitle"
            @updateInput="updateInput"
          ></InputDefault>
          <v-btn type="submit" hidden>{{ $t('input.search') }}</v-btn>
        </form>
      </div>
      <div class="more-filters">
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

                <p :class="{ 'menu-filters__hasfilters': filtersSelected }" style="display: flex; flex-direction: row">
                  {{ $t('button.moreFilters') }}
                  <span v-if="filtersSelected" class="filter-selected"
                    ><p>{{ filtersSelected }}</p></span
                  >
                </p>
              </div>
              <div>
                <span
                  class="material-symbols-rounded dropdown-filter icon-up font-20"
                  :class="{ 'icon-dropdown ds-blue-color': show === true }"
                  >arrow_drop_down</span
                >
              </div>
            </v-btn>
          </template>
          <v-card width="283" class="filters-card" :class="{ 'filters-card-open': show === true }">
            <div class="list-filters">
              <v-list-group
                v-if="$store.getters.can('audience:tags_view')"
                class="list-groups"
                :value="false"
                append-icon="mdi-chevron-down"
              >
                <template v-slot:activator>
                  <v-list-item-title
                    :class="selectedTags.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                    style="display: flex; flex-direction: row"
                  >
                    {{ $t('sidebar.tags') }}
                    <span v-if="selectedTags.length" class="filter-selected-item"
                      ><p>{{ selectedTags.length }}</p></span
                    >
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
                      @input="findItems($event.target.value, 'tag')"
                    />
                  </div>
                  <div class="filters-list">
                    <div
                      class="checkbox-filters custom-checkbox"
                      :key="`campaign-filter-${index}`"
                      v-for="(tag, index) in filteredTags"
                    >
                      <input
                        type="checkbox"
                        :key="`search-input-${index}`"
                        :id="`tag-option-${tag.id}`"
                        :value="{ ...tag, typeRemove: 'selectedTags', selectedFilter: 'tags' }"
                        v-model="selectedTags"
                      />
                      <label class="label-filters" :for="`tag-option-${tag.id}`" :key="`tag-label-${index}`">{{
                        tag.name
                      }}</label>
                    </div>
                  </div>
                </v-list-item-content>
              </v-list-group>
              <v-list-group
                v-if="$store.getters.can('audience:segments_view')"
                class="list-groups"
                :value="false"
                append-icon="mdi-chevron-down"
              >
                <template v-slot:activator>
                  <v-list-item-title
                    :class="selectedSegments.length ? 'filters-title menu-filters-item__hasfilters' : 'filters-title'"
                    style="display: flex; flex-direction: row"
                  >
                    {{ $t('sidebar.segments') }}
                    <span v-if="selectedSegments.length" class="filter-selected-item"
                      ><p>{{ selectedSegments.length }}</p></span
                    >
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
                      @input="findItems($event.target.value)"
                    />
                  </div>
                  <div class="filters-list">
                    <div
                      class="checkbox-filters custom-checkbox"
                      :key="`campaign-filter-${index}`"
                      v-for="(segment, index) in filteredSegments"
                    >
                      <input
                        type="checkbox"
                        :key="`search-input-${index}`"
                        :id="`segment-option-${segment.id}`"
                        :value="{ ...segment, typeRemove: 'selectedSegments', selectedFilter: 'segments' }"
                        v-model="selectedSegments"
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
              <v-list-group class="list-groups" :value="false" append-icon="mdi-chevron-down">
                <template v-slot:activator>
                  <v-list-item-title
                    :class="
                      pickedDate.length > 1
                        ? 'filters-title menu-filters-item__hasfilters date-label'
                        : 'filters-title date-label'
                    "
                    style="display: flex; flex-direction: row"
                  >
                    {{ $t('title.createdDate') }}
                  </v-list-item-title>
                </template>
                <v-list-item-content>
                  <div class="date-range-div">
                    <label class="date-range">{{ dateRangeText || $t('button.selectDate') }}</label>
                  </div>
                  <v-date-picker
                    width="240"
                    no-title
                    v-model="pickedDate"
                    range
                    :locale="userLanguage"
                    :max="dateToVuetifyString(new Date())"
                    @input="changeDatePicker($event)"
                  />
                </v-list-item-content>
              </v-list-group>
            </div>
            <div class="filters-buttons" v-if="filtersSelected !== 0">
              <ButtonDefault
                :name="`${$t('button.clear')}`"
                data-cy="button-view-fields"
                class="btn-clear buttons-specs"
                :disabled="filtersSelected === 0"
                @click="clearFilters()"
              />
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
    <div :class="`${chipItems.length === 0 ? 'filters-chips' : 'filters-chips mt-2'}`">
      <div class="filters-chips-color" :key="`chip-${index}`" v-for="(chip, index) in chipItems">
        <div class="md-chip-icon">
          <div v-tooltip.bottom="chip.name">
            <span>{{ chip.typeRemove[8] }}</span>
          </div>
        </div>
        <span>{{ chip.name }}</span>
        <span class="material-symbols-rounded icon-chips" @click="removeCategory(chip.typeRemove, chip.id)" small
          >close</span
        >
      </div>
    </div>
    <div>
      <DataLoader :isLoading="isLoadingContacts" :type="'table-tbody,table-tbody'" class="mt-4" />
      <div :class="isLoadingContacts ? 'd-none' : ''">
        <v-data-table
          v-if="contacts.length > 0"
          :headers="headers"
          :items="contacts"
          :items-per-page="pagination.itemsPerPage"
          hide-default-footer
          :value="selectedContacts"
          @input="onSelectionInput"
          @toggle-select-all="onHeaderSelectAll"
          show-select
          class="c-table"
          :calculate-widths="true"
          :loading="isLoadingContacts"
          :server-items-length="totalContactsData"
          :options.sync="options"
        >
          <template v-slot:[`item.first_name`]="{ item }">
            <div class="td-item">
              <router-link
                :to="{ name: 'contacts-view', params: { contact_id: item.id } }"
                :title="`${$t('create.viewInfo')}`"
                class="cursor-pointer font-12 font-first-name"
              >
                {{ item.first_name || $t('datatable.emptyName') }}
              </router-link>
            </div>
          </template>

          <template v-slot:[`item.status`]="{ item }">
            <div class="td-item">
              <span class="status-chip style-font" :class="[`status-${getStatus(item)}`]">
                {{ $t(`datatable.${[getStatus(item)]}`) }}
              </span>
            </div>
          </template>

          <template v-slot:[`item.email`]="{ item }">
            <div v-if="item.email" class="td-item font-12">
              {{ item.email }}
            </div>
            <div v-else class="td-item font-title">-</div>
          </template>

          <template v-slot:[`item.has_email`]="{ item }">
            <div class="td-item">
              <div
                v-tooltip.bottom="
                  $t('datatable.hasEmail', {
                    status: item.has_email ? $t('datatable.active') : $t('datatable.inactive'),
                  })
                "
                class="mr-1"
              >
                <span
                  :class="[item.has_email ? 'ds-gray-color ' : 'ds-lighter-gray-color ']"
                  class="material-symbols-rounded font-20"
                  >mail</span
                >
              </div>
              <div
                v-tooltip.bottom="
                  $t('datatable.hasWebPush', {
                    status: item.has_web_push ? $t('datatable.active') : $t('datatable.inactive'),
                  })
                "
                class="mr-1"
              >
                <span
                  :class="[item.has_web_push ? 'ds-gray-color ' : 'ds-lighter-gray-color ']"
                  class="material-symbols-rounded font-20"
                  >notifications</span
                >
              </div>
              <div
                v-tooltip.bottom="
                  $t('datatable.hasMobilePush', {
                    status: item.has_mobile_push ? $t('datatable.active') : $t('datatable.inactive'),
                  })
                "
                class="mr-1"
              >
                <span
                  :class="[item.has_mobile_push ? 'ds-gray-color ' : 'ds-lighter-gray-color ']"
                  class="material-symbols-rounded font-20"
                  >smartphone</span
                >
              </div>
              <div
                v-tooltip.bottom="
                  $t('datatable.hasPhone', {
                    status: item.has_phone ? $t('datatable.active') : $t('datatable.inactive'),
                  })
                "
                class="mr-1"
              >
                <span
                  :class="[item.has_phone ? 'ds-gray-color ' : 'ds-lighter-gray-color ']"
                  class="material-symbols-rounded font-20"
                  >sms</span
                >
              </div>
              <div
                v-tooltip.bottom="
                  $t('datatable.hasWhatsapp', {
                    status: item.has_whatsapp ? $t('datatable.active') : $t('datatable.inactive'),
                  })
                "
                class="mr-1 mb-1"
              >
                <img
                  src="@/assets/whatsapp-icon.svg"
                  width="24"
                  style="filter: invert(68%) sepia(0%) saturate(0%) hue-rotate(220deg) brightness(90%) contrast(84%)"
                  v-if="item.has_whatsapp"
                />
                <img src="@/assets/whatsapp-icon.svg" width="20" v-else />
              </div>
            </div>
          </template>

          <template v-slot:[`item.created_at_date`]="{ item }">
            <div class="td-item font-12">
              <span> {{ item.created_at | formatDateTime }} </span>
            </div>
          </template>

          <template v-slot:[`item.interation`]="{ item }">
            <div class="td-item font-12">
              <span> {{ (item.last_open || item.last_click) | formatDateTime }} </span>
            </div>
          </template>

          <template v-slot:[`item.tags`]="{ item }">
            <div class="td-item d-flex" v-if="item.tags">
              <span
                outlined
                v-for="(keyTag, index) in Object.keys(item.tags).slice(0, 2)"
                :key="index"
                class="mr-2 tag-chip"
              >
                {{ item.tags[keyTag].name }}
              </span>

              <span outlined v-if="Object.keys(item.tags).length > 2"> ... </span>
            </div>
          </template>

          <template v-slot:footer>
            <div class="select-slot">
              <select
                :disabled="selectedContacts.length === 0"
                v-model="selectedAction"
                data-cy="automation-message-ippool"
                class="select-items-per-page font-12 pr-8"
                @change="eventActionTable"
              >
                <option selected disabled value="">{{ $t('input.selectAction') }}</option>
                <option v-if="$store.getters.can('audience:tags_view')" value="add">{{ $t('button.addTag') }}</option>
                <option v-if="$store.getters.can('audience:tags_view')" value="remove">
                  {{ $t('button.removeTag') }}
                </option>
                <option v-if="$store.getters.can('audience:contacts_suppress')" value="unsubscribe">Unsubscribe</option>
                <option v-if="$store.getters.can('audience:contacts_export')" value="export">
                  {{ selectedContacts.length >= 10 ? $t('button.exportAll') : $t('button.export') }}
                </option>
              </select>
            </div>
            <div>
              <v-dialog persistent v-model="tagsModal">
                <div class="tag-modal" v-if="['unsubscribe', 'export'].includes(selectedAction) === false">
                  <label class="contact-label-color">
                    {{ selectedAction === 'add' ? $t('button.addTag') : $t('button.removeTag') }}
                  </label>
                  <v-menu ref="menu" v-model="menu" bottom class="tag-menu" :close-on-content-click="false">
                    <template v-slot:activator="{ on }">
                      <div class="menu-tags cursor-pointer" v-on="on">
                        <input class="input-tag" type="button" :value="`${$t('input.select')}`" />
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
                          @input="findItems($event.target.value, 'tag')"
                        />
                        <span class="material-symbols-rounded ds-blue-color"> arrow_drop_up </span>
                      </div>
                      <div class="tag-list">
                        <div
                          class="checkbox-tag pl-2"
                          :key="`tags-modal-filter-${i}`"
                          v-for="(tags, i) in filteredTags"
                        >
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
                    </v-card>
                  </v-menu>
                  <div class="no-tags-area" v-if="newTags.length === 0">
                    <span class="no-tags-placeholder">{{ $t('input.noTags') }}</span>
                  </div>
                  <div v-if="newTags.length > 0" class="chips-tag">
                    <div class="div-row filters-chips-tags" :key="`chip-${index}`" v-for="(chip, index) in newTags">
                      <span class="chip-tag-text">{{ chip.name }}</span>
                      <span
                        class="material-symbols-rounded ds-gray-color icon-chips-tags font-18 cursor-pointer"
                        @click="removeTag(chip.id)"
                        small
                        >close</span
                      >
                    </div>
                  </div>
                  <div class="modal-buttons">
                    <ButtonDefault
                      data-cy="button-cancel"
                      class="btn-cancel buttons-specs"
                      @click="resetModal"
                      :name="`${$t('button.cancel')}`"
                    ></ButtonDefault>
                    <div class="clear-apply">
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
                        @click="updateTag(selectedAction)"
                        :name="`${$t('button.applyAll')}`"
                      ></ButtonDefault>
                    </div>
                  </div>
                </div>
                <div class="tag-modal unsub" v-if="selectedAction === 'unsubscribe'">
                  <label class="contact-label-color">{{ $t('modal.attention') }}</label>
                  <div>
                    <p
                      class="mt-2 unsubscribe-confirm"
                      v-html="$t('modal.confirmUnsubscribe', { count: countUnsubscribeConfirm })"
                    ></p>
                  </div>

                  <div class="modal-buttons-unsub">
                    <ButtonDefault
                      data-cy="button-cancel"
                      class="btn-cancel buttons-specs"
                      @click="resetModal"
                      :name="`${$t('button.cancel')}`"
                    ></ButtonDefault>
                    <div class="clear-apply">
                      <ButtonDefault
                        data-cy="button-view-fields"
                        class="btn-default buttons-specs"
                        @click="unsubscribe()"
                        :name="`${$t('button.confirm')}`"
                      ></ButtonDefault>
                    </div>
                  </div>
                </div>
              </v-dialog>
            </div>
          </template>
        </v-data-table>
        <div v-if="contacts.length === 0 && !isLoadingContacts" class="container-no-results">
          <span class="material-symbols-rounded icons-color">group</span>
          <p class="font-16 font-title-style">{{ $t('datatable.noContact') }}</p>
          <p class="font-14 font-subtitle-style">{{ $t('datatable.noSearchResults') }}</p>
        </div>

        <div v-if="contacts.length > 0" class="text-center div-row pt-5 align-items-center justify-space-between">
          <div class="div-row gap-5 align-items-center">
            <span class="d-flex text-400 font-14 text-nowrap align-items-center">{{ $t('input.itemsPerPage') }}</span>
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
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import ContactsService from '@/modules/contacts/services/contacts.service';
import { Pagination } from '@/models/pagination';
import { ContactsDto } from '../dto/contacts.dto';
import { ContactsFiltersDto } from '../dto/contacts-filter.dto';
import InputDefault from '@/components/input/InputDefault.vue';
import DataLoader from '@/components/data-loader/DataLoader.vue';
import TagService from '@/modules/tags/services/tag.service';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import { areObjectsEqual, getItemsPerPage, setItemsPerPage } from '../../../util/objects';
import { TagDto } from '@/modules/tags/dtos/tag.dto';
import { SegmentDto } from '@/modules/segment/dtos/segment.dto';
import ToastService from '@/services/toast.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { mapState } from 'vuex';
import CircularProgress from '@/components/circular-progress/CircularProgress.vue';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: { InputDefault, DataLoader, ButtonDefault, CircularProgress },
  computed: {
    ...mapState(['currentAccountTimezone', 'userLanguage', 'currentAccount', 'isSuperAdmin']),
  },
})
export default class Contacts extends Vue {
  private readonly contactsService = new ContactsService();
  private readonly tagService = new TagService();
  private readonly toastService = new ToastService();
  public selectedTags: any = [];
  public selectedSegments: any = [];
  public tags: Array<TagDto> = new Array<TagDto>();
  public segments: Array<SegmentDto> = new Array<SegmentDto>();
  public newTags: any = [];
  public currentAccountTimezone!: string;
  public isSuperAdmin!: boolean;
  public currentAccount!: AccountDto;
  public userLanguage!: string;

  headers: any = [
    { text: this.$t('datatable.name'), value: 'first_name', sortable: false },
    { text: 'Status', value: 'status', sortable: false },
    { text: this.$t('datatable.email'), value: 'email', sortable: true },
    { text: this.$t('datatable.type'), value: 'has_email', sortable: true },
    { text: this.$t('datatable.registration'), value: 'created_at_date', sortable: true },
    { text: 'Interagiu Em', value: 'interation', sortable: true },
    { text: 'Tags/Segments', value: 'tags', width: '10%', sortable: false },
  ];
  orderOptions: any = [];
  filter: ContactsFiltersDto = {} as ContactsFiltersDto;
  contacts: Array<ContactsDto> = new Array<ContactsDto>();
  pagination = new Pagination();
  searchLoadingOptions = false;
  searchOptions: ContactsDto[] = [];
  disablePrevious = true;
  disableNext = false;
  isLoadingContacts = false;
  isLoadingCount = false;
  options: any = {
    page: 1,
    sortBy: ['created_at_date'],
    sortDesc: [true],
    groupBy: [],
    groupDesc: [],
    mustSort: false,
    multiSort: false,
  };
  totalContactsData = 0;
  order = '';
  dataInfo: any = false;
  providers = ['gmail', 'icloud', 'yahoo', 'other', 'microsoft'];
  show = false;
  selectedFilter: any = [];
  chipItems: any = [];
  selectedContacts: any = [];
  tagsModal = false;
  selectedAction = '';
  chipTags: any = [];
  tagsFormatted: any = [];
  isAddTag = false;
  showTags = false;
  menu = false;
  pickedDate: string[] = [];
  dateRangeText = '';
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  isDateRange = false;
  contactsTotal = 0;
  rangeStart = 0;
  rangeFinal = 0;
  isCount = false;
  itemsNumber = 10;
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];
  filteredTags: any = [];
  filteredSegments: any = [];
  formatNumber: any;
  formatDateTime: any;
  initialLoad = true;
  hasFilteredTotal = false;
  isExporting = false;
  exportId = '';
  exportTotal = 0;
  exportProgress = 0;
  exportPollingInterval: any = null;
  countUnsubscribeConfirm = 0;
  manualSelectAll = false;

  async beforeMount() {
    const storedItemsPerPage = getItemsPerPage('contacts');
    if (storedItemsPerPage) {
      this.pagination.itemsPerPage = storedItemsPerPage;
    }
    this.getValuesUrl();
    await this.loadContacts();
    await this.getTags();
    await this.getDashboardData();
    this.initialLoad = false;
  }

  beforeDestroy() {
    this.stopExportPolling();
  }

  async getDashboardData() {
    this.isLoadingCount = true;
    const result = await this.contactsService.getDashboardData();
    this.dataInfo = result?.data;
    if (!this.hasFilteredTotal) {
      this.contactsTotal = this.dataInfo.total;
    }
    this.isLoadingCount = false;
    this.checkPage();
  }

  eventActionTable() {
    if (this.selectedAction === 'export') {
      this.selectedAction = '';
      this.toastService.show({
        type: 'success',
        text: this.$t('toast.exportContacts') as string,
      });
      return this.exportData();
    }
    if (this.selectedAction === 'unsubscribe') {
      this.countUnsubscribe();
    }
    this.tagsModal = true;
  }

  setValuesUrl() {
    if (
      this.pagination.page === 1 &&
      this.filter.title === '' &&
      this.$route.query.title === undefined &&
      this.pickedDate.length === 0 &&
      this.selectedTags.length === 0 &&
      this.selectedSegments.length === 0 &&
      ((this.$route.query.order === undefined && this.pagination.order === 'DESC') ||
        this.pagination.order === this.$route.query.order) &&
      ((this.$route.query.sortBy === undefined && this.pagination.sortBy === 'created_at_date') ||
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
      tags: this.selectedTags.length ? encodeURIComponent(JSON.stringify(this.selectedTags)) : JSON.stringify([]),
      segments: this.selectedSegments.length
        ? JSON.stringify(
            this.selectedSegments.map((x: any) => {
              return {
                ...x,
                description: encodeURIComponent(x.description),
              };
            })
          )
        : JSON.stringify([]),
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
      this.selectedTags = this.$route.query.tags
        ? JSON.parse(decodeURIComponent(this.$route.query.tags as string))
        : [];
      this.selectedSegments = this.$route.query.segments
        ? JSON.parse(decodeURIComponent(this.$route.query.segments as string))
        : [];

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

    this.options = { ...this.options, page: 1, sortBy: ['created_at_date'], sortDesc: [true] };
    this.pagination = { ...this.pagination, page: 1, sortBy: 'created_at_date', order: 'DESC' };
    this.filter.title = '';
    this.selectedTags = [];
    this.selectedSegments = [];
    this.clearDate();
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

  async clearDate() {
    this.pickedDate = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.dateRangeText = '';
    this.isDateRange = false;
  }

  async loadContacts(params?: Pagination) {
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
      this.chipItems = this.selectedTags.concat(this.selectedSegments);
      this.filter.tags = this.selectedTags.concat(this.selectedSegments).map((item: any) => item.id);
      this.filter.startDate = this.startDate;
      this.filter.endDate = this.endDate;

      const result = await this.contactsService.getContacts({
        ...this.$route.query,
        ...this.pagination,
        pagination: this.pagination,
        filters: this.filter,
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

      if (
        this.filter.title !== '' ||
        this.selectedSegments.length > 0 ||
        this.selectedTags.length > 0 ||
        this.isDateRange
      ) {
        await this.getContactsTotal();
      } else {
        this.hasFilteredTotal = false;
        this.contactsTotal = this.totalContactsData;
      }
    } catch (err) {
      this.isLoadingContacts = false;
      console.error(err);
    }
    this.checkPage();
  }

  async getContactsTotal() {
    this.isLoadingCount = true;
    const totalCount = await this.contactsService.getContacts({
      filters: this.filter,
      countOnly: true,
    });
    this.contactsTotal = totalCount?.data?.totalItems;
    this.hasFilteredTotal = true;
    this.isLoadingCount = false;
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    setItemsPerPage('contacts', items);
    this.loadContacts();
  }

  async filterByTitle() {
    this.pagination.page = 1;
    this.setValuesUrl();
  }

  async getTags() {
    const canViewTags = this.$store.getters.can('audience:tags_view');
    const canViewSegments = this.$store.getters.can('audience:segments_view');

    if (!canViewTags && !canViewSegments) {
      return;
    }

    try {
      const result = await this.tagService.getTags({
        status: 'active',
      });
      const tags = result?.data;

      if (canViewTags) {
        this.tags = tags.filter((tag: any) => tag.type === 'tag');
        this.filteredTags = this.tags;
        this.parseTags();
      }

      if (canViewSegments) {
        this.segments = tags.filter((segment: any) => segment.type === 'segment');
        this.filteredSegments = this.segments;
      }
    } catch (err) {
      console.error(err);
    }
  }

  findItems(value: string, itemType?: string) {
    let items = itemType === 'tag' ? this.filteredTags : this.filteredSegments;

    if (!value) {
      items = itemType === 'tag' ? this.tags : this.segments;
    } else {
      items = items.filter((item: any) => item.name.includes(value));
    }

    if (itemType === 'tag') {
      this.filteredTags = items;
    } else {
      this.filteredSegments = items;
    }
  }

  parseTags() {
    this.tagsFormatted = this.tags.map((tag: any) => {
      return {
        id: tag.id,
        name: tag.name,
      };
    });
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

  get filtersSelected() {
    return this.selectedTags.length + this.selectedSegments.length + (this.dateRangeText !== '' ? 1 : 0);
  }

  get formatedTotalNumber() {
    return Vue.filter('formatNumber')(this.contactsTotal);
  }

  async applyFilters() {
    this.pagination.page = 1;
    if (this.dateRangeText !== '') {
      this.isDateRange = true;
    }

    this.setValuesUrl();
    this.loadContacts();
    this.show = false;
  }

  async clearFilters() {
    this.selectedTags = [];
    this.selectedSegments = [];
    this.pickedDate = [];
    this.startDate = undefined;
    this.endDate = undefined;
    this.pagination.page = 1;
    this.dateRangeText = '';

    if (this.chipItems.length !== 0 || this.isDateRange === true) {
      this.dateRangeText = '';
      this.isDateRange = false;
      this.loadContacts();
    }
  }

  async clearTags() {
    this.newTags = [];
  }

  removeCategory(type: string, id: number) {
    if (type === 'selectedTags') {
      this.selectedTags = this.selectedTags.filter((tag: any) => tag.id !== id);
    }

    if (type === 'selectedSegments') {
      this.selectedSegments = this.selectedSegments.filter((segment: any) => segment.id !== id);
    }

    this.pagination.page = 1;
    this.loadContacts();
  }

  removeTag(id: number) {
    this.newTags = this.newTags.filter((tag: any) => tag.id !== id);
  }

  resetModal() {
    this.tagsModal = false;
    this.selectedAction = '';
    this.newTags = [];
  }

  async updateTag(tagAction: string) {
    try {
      const response = await this.contactsService.updateTag({
        contacts: this.selectedContacts.map((contact: any) => contact.id),
        tags: this.newTags.map((tag: any) => tag.id),
        action: tagAction,
      });

      if (response && this.selectedAction === 'add') {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.tagAdd') as string,
        });
      }
      if (response && this.selectedAction === 'remove') {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.tagRemove') as string,
        });
      }

      this.resetModal();
    } catch (error) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.tagError') as string,
      });

      this.resetModal();
    }
  }

  async exportData() {
    this.chipItems = this.selectedTags.concat(this.selectedSegments);
    this.filter.tags = this.selectedTags.concat(this.selectedSegments).map((item: any) => item.id);
    this.filter.startDate = this.startDate;
    this.filter.endDate = this.endDate;
    this.filter.contacts =
      this.filter.contacts =
      this.filter.contacts =
        this.selectedContacts.length === this.contacts.length && this.manualSelectAll
          ? []
          : this.selectedContacts.map((contact: any) => contact.id);

    try {
      this.isExporting = true;
      this.exportProgress = 0;

      const exportInfo: any = await this.contactsService.exportInit({
        ...this.$route.query,
        filters: this.filter,
      });

      this.exportId = exportInfo.data.exportId;
      this.exportTotal = exportInfo.data.estimatedTotal;
      if (this.exportId) {
        this.startExportPolling();
        await this.contactsService.exportContacts({
          ...this.$route.query,
          filters: this.filter,
          exportId: this.exportId,
          exportTotal: this.exportTotal,
        });
      }
    } catch (error) {
      console.error('Erro no export:', error);
      this.isExporting = false;
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.exportError') as string,
      });
    }
  }

  startExportPolling() {
    if (this.exportPollingInterval) {
      clearInterval(this.exportPollingInterval);
    }

    this.exportPollingInterval = setInterval(async () => {
      try {
        const statusResponse = await this.contactsService.getExportStatus(this.exportId);
        const status = statusResponse.data;

        this.exportProgress = Math.round(status.progress || 0);

        if (status.status === 'completed') {
          this.isExporting = false;
          this.exportProgress = 100;
          this.stopExportPolling();

          this.toastService.show({
            type: 'success',
            text: this.$t('toast.exportSuccess') as string,
          });
        } else if (status.status === 'error') {
          this.isExporting = false;
          this.stopExportPolling();

          this.toastService.show({
            type: 'error',
            text: this.$t('toast.exportError') as string,
          });
        }
      } catch (error) {
        console.error('Erro ao verificar status do export:', error);
        this.isExporting = false;
        this.stopExportPolling();
      }
    }, 1000); // Verificar a cada segundo
  }

  stopExportPolling() {
    if (this.exportPollingInterval) {
      clearInterval(this.exportPollingInterval);
      this.exportPollingInterval = null;
    }
  }

  async countUnsubscribe() {
    this.chipItems = this.selectedTags.concat(this.selectedSegments);
    this.filter.tags = this.selectedTags.concat(this.selectedSegments).map((item: any) => item.id);
    this.filter.startDate = this.startDate;
    this.filter.endDate = this.endDate;
    this.filter.contacts =
      this.selectedContacts.length === this.contacts.length && this.manualSelectAll
        ? []
        : this.selectedContacts.map((contact: any) => contact.id);

    try {
      const params: any = {
        ...this.$route.query,
        filters: this.filter,
      };

      const response = await this.contactsService.unsubscribe(params, true);

      if (response && response.data) {
        this.countUnsubscribeConfirm = response.data;
      }
    } catch (err) {
      console.error(err);
    }
  }

  onHeaderSelectAll(event: { items: any[]; value: boolean }) {
    this.manualSelectAll = event.value;
    this.selectedContacts = event.value ? event.items : [];
  }

  onSelectionInput(selectedItems: any[]) {
    if (selectedItems.length === this.contacts.length && !this.manualSelectAll) {
      this.selectedContacts = [...selectedItems];
      return;
    }

    this.selectedContacts = selectedItems;

    if (selectedItems.length < this.contacts.length) {
      this.manualSelectAll = false;
    }
  }

  async unsubscribe() {
    this.isLoadingContacts = true;

    this.chipItems = this.selectedTags.concat(this.selectedSegments);
    this.filter.tags = this.selectedTags.concat(this.selectedSegments).map((item: any) => item.id);
    this.filter.startDate = this.startDate;
    this.filter.endDate = this.endDate;
    this.filter.contacts = this.filter.contacts =
      this.selectedContacts.length === this.contacts.length && this.manualSelectAll
        ? []
        : this.selectedContacts.map((contact: any) => contact.id);

    try {
      const params: any = {
        ...this.$route.query,
        filters: this.filter,
      };

      const response = await this.contactsService.unsubscribe(params);
      if (response && response.status === 200) {
        this.toastService.show({
          type: 'success',
          text: this.$t('toast.contactUnsubscribed', { count: response.data?.total }) as string,
        });
      }

      this.resetModal();
      this.selectedContacts = [];
      await this.loadContacts();
    } catch (err) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.unsubscribeError') as string,
      });

      this.resetModal();
    } finally {
      this.isLoadingContacts = false;
    }
  }

  getStatus(contact: any) {
    if (contact.is_active === false) {
      return 'inactive';
    }

    if (contact.has_bounced) {
      return 'bounce';
    }

    if (contact.is_unsubscribed) {
      return 'unsubscribed';
    }

    if (contact.is_blocked) {
      return 'blocked';
    }

    if (!contact.is_valid) {
      return 'invalid';
    }
    return 'active';
  }

  updateInput(event: undefined, key: keyof ContactsFiltersDto) {
    this.filter[key] = event;
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

  async nextPage() {
    this.pagination.page++;
    this.setValuesUrl();
  }

  async previousPage() {
    this.pagination.page--;
    this.setValuesUrl();
  }

  @Watch('options', { deep: true })
  async onChangeOptions() {
    if (this.isLoadingContacts || this.initialLoad) {
      return;
    }

    const { sortBy, sortDesc, page, itemsPerPage, totalPages } = this.options;

    this.pagination = {
      ...this.pagination,
      page,
      itemsPerPage,
      sortBy: sortBy[0] || 'created_at_date',
      order: sortDesc[0] === true ? 'DESC' : 'ASC',
      totalPages,
    };

    this.setValuesUrl();

    await this.loadContacts();
  }

  @Watch('$route')
  async changePagination() {
    if (this.initialLoad) {
      return;
    }
    this.getValuesUrl();
    await this.loadContacts();
  }

  getClassChart(provider: string, index: number) {
    if (index === 0) {
      return `${provider.toLowerCase()}-color first-span span-horizontal-bar`;
    } else if (index === this.providers.length - 1) {
      return `${provider.toLowerCase()}-color last-span span-horizontal-bar`;
    }
    return `${provider.toLowerCase()}-color span-horizontal-bar`;
  }
  vTooltip(vTooltip: any) {
    throw new Error('Method not implemented.');
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

::v-deep.c-table {
  margin-top: 16px;
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
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

  th.text-start {
    white-space: nowrap;
  }

  .sucess--text {
    color: $ds-blue;
  }
}

.green-text {
  color: $ds-blue;
}

.red-text {
  color: $neutral-error-red;
}

.test-stats {
  color: $neutral-basic-white;
  font-weight: bold;
  font-size: 14px;
  border-radius: 4px;
  padding: 4px 8px;
}

.test-stats--inbox {
  background: $ds-blue;
}

.test-stats--spam {
  background: $neutral-error-red;
}

.test-stats--other {
  background: $neutral-gray-500;
}

.subject-message-list {
  font-size: 0.8rem;
  color: #a0a0a0;
}

.actions-row {
  display: flex;
  gap: 0.75em;
}

.break-word {
  word-break: break-word;
}

.card-info {
  padding: 1rem;
  border-radius: 16px;

  h6 {
    display: flex;
    align-items: center;
  }

  h3 {
    color: $ds-blue;
    font-weight: bold;
  }

  .gmail-color {
    background-color: #009be4;
  }

  .yahoo-color {
    background-color: #8c0758;
  }

  .microsoft-color {
    background-color: #4515ab;
  }

  .icloud-color {
    background-color: $ds-orange;
  }

  .other-color {
    background-color: #f06158;
  }

  .span-horizontal-bar {
    height: 32px;
  }

  .first-span {
    border-radius: 16px 0px 0px 16px;
  }

  .last-span {
    border-radius: 0px 16px 16px 0px;
  }

  .span-provider-color {
    width: 16px;
    height: 16px;
    border-radius: 8px;
  }

  .label-provider:first-letter {
    text-transform: uppercase;
  }
}

.type-active {
  color: $ds-blue;
}

.date-select {
  justify-content: space-between;
  display: flex;
  flex-direction: row;
  gap: 0.5em;
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

  p:hover {
    cursor: pointer;
  }

  svg:hover {
    cursor: pointer;
  }
}
.filters-buttons {
  display: flex;
  flex-direction: row;
  padding: 0.5em;
  margin-top: 10px;
  justify-content: flex-end;
  gap: 15px;
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

.filters-card {
  border-radius: 0px !important;
}

.filters-label {
  color: $ds-blue;
}

.close-button {
  background-color: #ffffff !important;
  color: $ds-gray !important;
  box-shadow: none;
  outline: none !important;
  text-decoration: none !important;
}

.list-groups {
  border-bottom: 1px solid $ds-gray-100;
}

.search-bar {
  display: flex;
  align-items: center;
  border-bottom: 1px solid $ds-gray-100;
  border-top: 1px solid $ds-gray-100;
  margin-bottom: 0px !important;
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
  max-height: 9em;
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

.filter-label-color {
  color: $ds-blue;
}

.filter-header {
  display: flex;
  flex-direction: row;
  border-bottom: 1px solid $ds-gray-100;
  justify-content: space-between;
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

.list-content {
  z-index: 999;
}

.checkbox-filters {
  display: flex;
  flex-direction: row;
  gap: 5px;
  margin-left: 8px;
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

.v-list-item__title {
  font-weight: 400 !important;
  font-size: 12px !important;
  color: $ds-gray;
}

::v-deep .v-label .theme--light {
  font-size: 12px !important;
}

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

.filters-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
  margin-top: -7px;
  margin-bottom: 24px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chips-tag {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5em;
  padding-top: 8px;
  min-inline-size: fit-content;
  min-height: 140px;
  grid-auto-rows: min-content;
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

.filters-chips-tags {
  background-color: #ffffff !important;
  border: 1px solid $ds-gray-300;
  height: 24px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 20px;
  align-items: center;
  padding: 0 8px;
  gap: 8px;
}

.chip-tag-text {
  width: 100px;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.md-chip-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  background: $ds-gray-300;
  border: 1px solid $ds-gray-300;
  height: 24px;
  width: 24px;
  border-radius: 50%;
  text-align: center;
  cursor: default;
}

::v-deep .v-chip__content {
  display: flex !important;
  gap: 10px !important;
}

.icon-chips {
  color: $ds-gray-300;
}

.date-range {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 500;
  padding-left: 12px;
  text-transform: none !important;
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

.date-label {
  font-weight: 400 !important;
  font-size: 12px !important;
  color: $ds-gray;
}

.date-range-div {
  border-top: 1px solid $ds-gray-100;
  border-bottom: 1px solid $ds-gray-100;
  background-color: #ffffff !important;
  height: 30px;
  margin-bottom: 0px;
  display: flex;
  align-items: center;
}

.date-range {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 600;
  padding-left: 12px;
  text-transform: none !important;
  margin-bottom: 0px !important;
}

::v-deep .v-date-picker-header {
  padding-right: 0px !important;
  padding-left: 0px !important;
}

::v-deep .v-date-picker-table {
  padding-right: 0px !important;
  padding-left: 0px !important;
  height: 232px;
}

::v-deep .v-picker__body {
  margin: 0px;
}

::v-deep .v-picker {
  place-items: center;
}

::v-deep .list-groups .v-list-group__items .v-list-item__content > * {
  line-height: 1.5 !important;
}

.select-slot {
  padding-left: 35px;
  padding-top: 10px;
  padding-bottom: 20px;
}

.select-action {
  width: 176px;
}

.tag-modal {
  width: 542px;
  min-height: 200px;
  background: #ffffff;
  padding: 21px;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.07em;
  text-transform: capitalize;
  display: flex;
  border-radius: 16px;
  flex-direction: column;
}

.tag-modal.unsub {
  min-height: 175px;
}

.no-tags-area {
  height: 140px;
  display: flex;
  align-items: center;
  place-content: center;
}

.no-tags-placeholder {
  letter-spacing: 0.07em;
  color: #a6a6a6;
  font-weight: 600;
  font-size: 12px;
}

.contact-label-color {
  color: $ds-blue;
  margin-bottom: 16px;
}

.tags-complete {
  border: 1px solid $ds-gray-300;
  border-radius: 8px;
  height: auto;
}

.modal-buttons {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  flex: 1;
  gap: 16px;
  margin: 16px 0 0 0;
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

.btn-cancel {
  color: $ds-red !important;
  background-color: #ffffff !important;
  border: 1px solid $ds-red;
  padding: 14px !important;
}

.btn-cancel:hover {
  background-color: #ffffff !important;
}

.clear-tags {
  text-decoration: underline;
  font-weight: 400;
  font-size: 12px;
}

.clear-tags:disabled {
  color: $ds-gray-300;
}

.btn-default {
  color: #ffffff;
  background-color: $ds-blue;
}

.clear-apply {
  display: flex;
  align-items: center;
  gap: 1em;
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

::v-deep .v-select__selections {
  padding-left: 12px;
}

::v-deep .tag-modal .v-text-field {
  padding-top: 0px;
  padding-left: 0px;
  padding-bottom: 0px;
  align-items: center;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}

::v-deep .tags-complete .v-input__control {
  height: 36px !important;
}

::v-deep .v-list-item__content {
  align-self: inherit;
}

.select-action {
  color: #495057;
  -webkit-appearance: auto;
}

.show-contacts {
  align-self: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unsubscribe-confirm {
  font-size: 12px;
  font-weight: normal;
  color: $ds-gray;
  text-transform: none;
}

.modal-buttons-unsub {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  flex: 1;
  gap: 16px;
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
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}

.list-filters {
  margin-bottom: 5px;
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
.status-bounce {
  color: #c0970c;
  background-color: #fffdef;
}
.status-unsubscribed {
  color: #f03232;
  background-color: #fff0f0;
}

.tag-chip {
  font-size: 10px;
  font-weight: 600;
  padding: clamp(14px, 1vw, 16px);
  border-radius: 20px;
  color: #5c5c5c;
  background-color: $ds-gray-100;
  height: 15px;
  display: flex;
  text-align: center;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
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
.icons-color {
  color: #ffb1b4;
  font-size: 80px;
}

.dropdown-filter {
  margin-right: -2px;
}

::v-deep .v-icon.mdi-chevron-down {
  font-size: 18px;
}

.export-progress-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.export-progress-text {
  font-size: 12px;
  font-weight: 600;
  color: #7b61ff;
  white-space: nowrap;
}

.export-progress-container .wrapper {
  margin-left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
