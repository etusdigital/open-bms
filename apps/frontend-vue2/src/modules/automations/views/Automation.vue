<template>
  <div class="col-12">
    <div class="title-route mb-0">
      <div class="div-column title-automation mb-4">
        <router-link to="/automations/emails" class="clickable-breadcrumb">
          <span class="material-symbols-rounded ds-blue-color font-20">chevron_left</span>
          <span>{{ $t('title.automation') }}</span>
        </router-link>

        <div class="edit-title">
          <h2 class="c-title mb-0">{{ isNew ? $t('button.newAutomation') : automationDTO.title || '...' }}</h2>
        </div>
      </div>
    </div>
    <AlertComponent
      type="info"
      :class="showHistoric ? 'alert-historic-open' : 'alert-historic'"
      :showIcon="true"
      v-if="!isActualVersion"
    >
      {{ $t('alert.viewAutomation') }}
      <span class="date-alert pr-1">
        {{ historicDate | formatDate(dateTemplate) }}
      </span>
      {{ $t('alert.thisAutomation') }}
    </AlertComponent>
    <div class="pb-2 d-flex justify-space-between align-end">
      <span class="ds-gray-color font-16 text-600 mb-0 pt-0" v-if="isActualVersion">{{ $t('title.details') }}</span>
      <div class="d-flex gap-1" v-if="currentAccount.isInternal">
        <button
          class="historic-button ml-5"
          type="button"
          @click="
            () => {
              showAutomationStatistics = true;
            }
          "
        >
          {{ $t('sidebar.dashboard') }}
        </button>
        <button
          v-if="isActualVersion && $store.getters.can('audit_logs:view')"
          class="historic-button ml-5"
          type="button"
          @click="openHistoric"
        >
          {{ $t('button.historic') }}
        </button>
      </div>
    </div>
    <v-card class="background-card d-flex div-column gap-20 card-name-description" v-if="isActualVersion">
      <div>
        <InputDefault
          :name="`${$t('title.name')}`"
          data-cy="automation-new-name"
          autofocus
          :modelValue="automationDTO.title"
          :placeholder="`${$t('input.automationName')}`"
          @updateInput="updateInput"
          :keyInput="'title'"
          :max="maxLength"
        />
        <span v-if="isNotAvailable" class="label-sub-title text-error">
          {{ $t('alert.nameExist', { product: $t('title.automation') }) }}
        </span>
      </div>
      <div class="div-row gap-10 align-items-center w-100">
        <InputDefault
          class="w-75"
          data-cy="automation-new-description"
          autofocus
          max="255"
          :name="`${$t('create.description')}`"
          :modelValue="automationDTO.description"
          :placeholder="`${$t('input.automationDescription')}`"
          :keyInput="'description'"
          @updateInput="updateInput"
        />
        <div v-if="currentAccount.isInternal" class="div-column align-self-end w-25">
          <span class="text-600 font-12 mb-1 ds-gray-color">{{ $t('automation.product') }}</span>
          <select
            class="form-control mo-select ds-gray-color"
            v-model="automationDTO.verticalType"
            @change="updateInput($event.target.value, 'verticalType')"
          >
            <option value="" disabled>{{ $t('title.selectList') }}</option>
            <option v-for="type in verticalTypeData" :value="type.value" :key="type.value">
              {{ type.name }}
            </option>
          </select>
        </div>
        <div v-if="currentAccount.isInternal" class="div-column align-self-end w-25">
          <div class="div-row align-items-center gap-5 mb-1">
            <span class="text-600 font-12 ds-gray-color">{{ $t('automation.target') }}</span>
            <span
              v-tooltip.right="$t('automation.targetDescription')"
              class="material-symbols-rounded unfilled-icon font-12 ds-gray-color"
            >
              help
            </span>
          </div>
          <select
            class="form-control mo-select ds-gray-color"
            v-model="automationDTO.target"
            @change="updateInput($event.target.value, 'target')"
          >
            <option :value="null" disabled>{{ $t('title.selectList') }}</option>
            <option v-for="type in targetData" :value="type.value" :key="type.value">
              {{ type.name }}
            </option>
          </select>
        </div>
      </div>

      <LabelSelectComponent :labelContent="automationLabelContent" @selectLabels="selectLabels" />
    </v-card>

    <div class="flex justify-space-between d-flex mt-5 mb-2 align-end switch-end">
      <button class="restore-button" type="button" @click="saveAutomation" v-if="!isActualVersion">
        {{ $t('button.restoreVersion') }}
      </button>
      <div v-if="isActualVersion && !isNew" class="d-flex align-items-center">
        <label for="automation-statistics-select" class="m-0 text-no-wrap">
          {{ $t('title.automationStatisticsPeriod') }}
        </label>
        <select
          id="automation-statistics-select"
          class="form-control mo-select w-120 ml-2 pr-8"
          @change="mapSteps"
          v-model="rangeSelected"
        >
          <option v-for="range in rangeStatistics" :value="range.value" :key="`statistic${range.value}`">
            {{ range.name }}
          </option>
        </select>
      </div>
      <span v-if="isNew" class="ds-gray-color font-16 text-600 mb-0" for="">{{ $t('title.automation') }}</span>
      <div class="d-flex">
        <v-switch
          v-if="isActualVersion && currentAccount.isInternal"
          v-model="automationDTO.isRateLimit"
          center-affix
          inset
          :label="`${$t('input.userRateLimit')}`"
          class="mt-0 pt-0 active-switch switch-label-color"
        ></v-switch>
        <v-switch
          v-if="isActualVersion"
          v-model="automationDTO.isActive"
          center-affix
          inset
          :label="`${$t('create.automation')} ${automationDTO.isActive ? $t('create.active') : $t('create.inactive')}`"
          class="mt-0 pt-0 active-switch switch-label-color"
        ></v-switch>
      </div>
      <button
        v-if="!isActualVersion && $store.getters.can('audit_logs:view')"
        class="historic-button ml-5"
        type="button"
        @click="openHistoric"
      >
        {{ $t('button.historic') }}
      </button>
    </div>

    <v-card class="mt-1 background-card" style="position: relative">
      <div class="zoom">
        <span class="material-symbols-rounded expand-icon" @click="goBackToDefault">fullscreen</span>
        <div class="div-zoom-date">
          <button @click="zoomOut">-</button>
          <span>{{ (scale * 100).toFixed(0) }}%</span>
          <button @click="zoomIn">+</button>
        </div>
      </div>
      <div class="py-3 d-flex align-center flex-column">
        <div class="automations-steps-stage" @wheel="handleZoom">
          <svg
            width="100"
            height="100"
            viewBox="-126 -126 252 252"
            fill="none"
            class="logo-animated-loading"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="0" cy="0" r="8.5" stroke="#0057F4" stroke-width="5" fill="#0057F4" class="circle-3" />
            <circle cx="0" cy="0" r="72" stroke="#0057F4" stroke-width="25" class="circle-2" />
            <circle
              cx="115"
              cy="0"
              r="8.5"
              stroke="#0057F4"
              stroke-width="5"
              fill="#0057F4"
              class="brius-animated-logo"
            />
          </svg>

          <div
            class="automations-steps-loader"
            ref="automationSteps"
            @mousedown="startDrag"
            @mousemove="handleDrag"
            @mouseup="endDrag"
          >
            <div class="automations-steps-loader--background"></div>
            <RenderChild
              v-if="lastId > 0"
              :step="steps"
              :index="0"
              :lastId="lastId"
              :statistics="statistics"
              :isNotActualVersion="!isActualVersion"
              :automationId="$route.params.automation_id"
              :editStepId="editStepId"
              :stepValidateError="stepValidateError"
              @updateModal="updateModal"
              @addCard="addCard"
              @finishedLoading="finishedLoading"
              @deleteChoice="deleteChoice"
              @saveStepData="saveStepData"
            />
          </div>
        </div>
      </div>
    </v-card>

    <UpdateStepModal
      :dialog="showUpdateModal"
      :step="stepInfoEdit"
      :eventType="eventType"
      :automationSteps="steps"
      @hideUpdateModal="showUpdateModal = false"
      @deletePath="deletePath"
      @saveStepData="saveStepData"
    />

    <AddStepModal
      :dialog="showAddCard"
      :stepId="stepInfoEdit.id"
      @hideModal="showAddCard = false"
      @showStepType="updateModal"
    />

    <div class="btn-container" v-if="isActualVersion">
      <div class="footer-buttons buttons-height">
        <input
          class="cancel-button"
          text
          @click="$router.push('/automations/emails')"
          type="button"
          :value="`${$t('button.cancel')}`"
        />
        <ButtonDefault
          :name="isNew ? `${$t('button.create')}` : `${$t('button.save')}`"
          @click="saveAutomation"
          class="btn btn-c btn-lg button"
        />
      </div>
    </div>
    <AutomationHistoric
      :showHistoric="showHistoric"
      :audits="audits"
      @closeHistoric="closeHistoric"
      @changeAutomation="changeAutomation"
    />
    <v-dialog v-model="showAutomationStatistics">
      <div
        class="dialog-more-statistics"
        style="height: fit-content; max-height: 700px; overflow-y: auto; min-width: 800px"
      >
        <template>
          <div class="d-flex justify-space-between align-center mb-3">
            <h3>{{ $t('title.automationStatistics') }}</h3>
            <button
              class="close-button"
              @click="
                () => {
                  showAutomationStatistics = false;
                }
              "
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
          <div class="div-column gap-5" style="height: fit-content; gap: 8px">
            <div class="div-row over-flow-cards pb-5 w-100 h-100 gap-10">
              <div class="rate value-more" v-for="item in statisticsAutomationOptions" :key="item.name">
                <div class="d-flex" style="gap: 4px">
                  <span class="material-symbols-rounded font-16 icon" v-if="item.isMaterial">
                    {{ item.icon }}
                  </span>
                  <img :src="item.icon" class="icon" v-else />
                  <p class="mb-0 statistic-name">{{ item.value }}</p>
                </div>
                <div class="div-row align-items-baseline gap-5">
                  <span v-if="isLoadingStatistics"></span>
                  <v-progress-circular
                    indeterminate
                    color="#0057f4"
                    :size="24"
                    class="mr-2"
                    v-if="isLoadingStatistics"
                  ></v-progress-circular>
                  <p v-else class="font-16 text-600 mb-0">
                    {{ automationStatistics[item.name] }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="div-column gap-5">
            <div class="div-row align-items-center gap-5 justify-space-between">
              <span class="font-14 text-600 mb-0 ds-gray-color">{{ $t('title.contactsGoal') }}</span>
              <v-menu
                ref="menu"
                v-model="dateMenu"
                class="date-menu ml-1"
                :close-on-content-click="false"
                bottom
                transition="scale-y-transition"
                offset-y
                width="283"
              >
                <template v-slot:activator="{ activate }">
                  <v-btn
                    class="date-button"
                    :class="{ 'date-button-open': dateMenu === true }"
                    v-on="activate"
                    @click="dateMenu = true"
                  >
                    <div class="d-flex align-items-center gap-10">
                      <span
                        class="metric-icon ds-gray-color material-symbols-rounded"
                        :class="{ 'ds-blue-color': dateMenu === true }"
                      >
                        calendar_month
                      </span>
                      <span class="date-range">{{ dateRangeText || $t('button.selectDate') }}</span>
                    </div>
                    <div>
                      <span
                        class="icon-up material-symbols-rounded"
                        :class="{ 'icon-dropdown ds-blue-color': dateMenu === true }"
                        dense
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
                    :min="dateToVuetifyString(minFilterDate)"
                    :max="dateToVuetifyString(new Date())"
                    @input="changeDatePicker($event)"
                  />
                  <div class="clear-date" v-if="selectedDates.length">
                    <button
                      class="clear-fields text-600 font-10 ds-blue-color"
                      :disabled="isDateRange === false"
                      @click="clearDate()"
                    >
                      {{ $t('button.clear') }}
                    </button>
                  </div>
                </v-card>
              </v-menu>
            </div>
            <apexChart
              class="chart-height"
              id="chart"
              type="line"
              height="380"
              :options.sync="chartOptions"
              :series.sync="series"
            ></apexChart>
          </div>
        </template>
      </div>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import store from '@/store';
import { Component, Prop, Ref, Vue } from 'vue-property-decorator';
import AddStepModal from '../components/AddStepModal.vue';
import AutomationHistoric from '../components/AutomationHistoric.vue';
import AutomationService from '@/modules/automations/services/automations.service';
import { AutomationDto } from '../dtos/automation.dto';
import LoadingService from '@/services/loading.service';
import ToastService from '@/services/toast.service';
import InputDefault from '@/components/input/InputDefault.vue';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import RenderChild from '../components/RenderChild.vue';
import UpdateStepModal from '../components/UpdateStepModal.vue';
import AlertComponent from '@/components/alert/AlertComponent.vue';
import { debounce } from '@/util/debounce';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import VueApexCharts from 'vue-apexcharts';
import { ApexOptions } from 'apexcharts';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import LabelSelectComponent from '@/modules/labels/components/LabelSelectComponent.vue';
import { LabelDto } from '@/modules/labels/dtos/label.dto';
import { LabelContentDto } from '@/modules/labels/dtos/labelContent.dto';

dayjs.extend(utc);
dayjs.extend(timezone);

@Component({
  components: {
    AddStepModal,
    InputDefault,
    ButtonDefault,
    RenderChild,
    UpdateStepModal,
    AutomationHistoric,
    AlertComponent,
    VueApexCharts,
    LabelSelectComponent,
  },
  store,
  filters: {},
  computed: {
    ...mapState(['currentAccount', 'currentAccountTimezone', 'userLanguage']),
  },
})
export default class Automations extends Vue {
  private readonly automationService = new AutomationService();
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();
  public currentAccount!: AccountDto;
  public currentAccountTimezone!: string;
  public userLanguage!: string;
  @Prop([String]) readonly id!: number;
  @Ref('automationSteps') automationSteps!: HTMLDivElement;

  lastId = 0;
  showAutomationStatistics = false;
  isNew = true;
  hasTriggerStep = true;
  dialog = false;
  showUpdateModal = false;
  showAddCard = false;
  showHistoric = false;
  eventType = '';
  stepInfoEdit = { id: 0 };
  emailList: any = [];
  webPushList: any = [];
  mobilePushList: any = [];
  statistics: any = {};
  historicDate: Date | any = '';
  audits: any[] = [];
  isActualVersion = true;
  rangeStatistics = [
    { name: 'Hoje', value: 0 },
    { name: 'Ontem', value: 1 },
    { name: '7 Dias', value: 7 },
    { name: '30 Dias', value: 30 },
  ];
  dateTemplate = { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  rangeSelected = 0;
  container: HTMLElement | null = null;
  pos = { top: 0, left: 1096, x: 0, y: 0 };
  isNotAvailable = false;
  splitDeleteChoice: number | string = 0;
  deletedPaths = [] as number[];
  verticalTypeData = [
    { name: this.$t('automation.creditCard'), value: 'cc' },
    { name: this.$t('automation.loan'), value: 'emp' },
  ];
  targetData = [
    { name: this.$t('automation.click'), value: 'click' },
    { name: this.$t('automation.open'), value: 'open' },
  ];
  statisticsAutomationOptions = [
    {
      name: 'unique_open',
      value: this.$t('datatable.unique_opens'),
      icon: require('@/assets/circled-drafts.svg'),
      isMaterial: false,
    },
    {
      name: 'unique_click',
      value: this.$t('datatable.unique_clicks'),
      icon: require('@/assets/circled-arrow.svg'),
      isMaterial: false,
    },
    { name: 'total_running_today', value: this.$t('datatable.subscribeToday'), icon: 'meeting_room', isMaterial: true },
    { name: 'total_running', value: this.$t('datatable.automationRunning'), icon: 'laps', isMaterial: true },
  ];
  debouncedValidateName = debounce(() => this.validateAutomationName(), 300);
  automationStatistics = { unique_open: 0, unique_click: 0, total_running: 0, total_running_today: 0 };
  isLoadingStatistics = false;

  automationDTO: AutomationDto = {
    title: '',
    type: 'email',
    stepId: 3,
    isActive: true,
    isRateLimit: false,
    verticalType: 'cc',
    target: null,
  } as AutomationDto;

  get automationLabelContent() {
    return this.automationDTO.labelContent || [];
  }

  steps: any = {
    id: 1,
    type: 'trigger',
    settings: {
      id: 0,
      name: '',
    },
    child: [
      {
        id: 2,
        type: 'end',
        settings: {},
        child: [],
      },
    ],
  };
  dateMenu = false;
  dateRangeText = '';
  selectedDates: any[] = [];
  minFilterDate = new Date();
  isDateRange = false;
  goalsStatistics: any[] = [];
  startDate = '';
  endDate = '';
  chartOptions: ApexOptions = {
    chart: {
      id: 'chartGoals',
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      height: 350,
      stacked: false,
      type: 'line',
    },
    colors: ['#00CEFC'],
    xaxis: {
      categories: [] as string[],
    },
    yaxis: [
      {
        labels: {
          formatter(value: number) {
            return value === null ? '0' : value.toLocaleString();
          },
        },
      },
    ],
  };

  series: any[] = [];

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private translateX = 0;
  private translateY = 0;
  scale = 1;
  editStepId: any = 0;
  stepValidateError: any = 0;
  maxLength!: number;

  async beforeMount() {
    this.maxLength = this.currentAccount.isInternal ? 25 : 40;
    if (!isNaN(Number(this.$route.params.automation_id))) {
      this.steps = {};
    }
    await this.getValuesUrl();
  }

  async mounted() {
    await this.loadAutomation();

    if (this.currentAccount.isInternal) {
      this.loadAutomationStatistics();
      this.minFilterDate.setDate(new Date().getDate() - 180);
      await this.getGoalStatistics();
    }

    document.querySelector('html')?.classList.add('disable-swipe-navigation');
    document.querySelector('body')?.classList.add('disable-swipe-navigation');

    this.container = document.querySelector('.automations-steps-stage') as HTMLElement;
    this.container.addEventListener('mousedown', this.mouseDownHandler);

    if (this.isNew) {
      const loaderBG = document.querySelector('.automations-steps-loader--background');
      loaderBG?.classList.add('d-none');

      const loaderSVG = document.querySelector('.logo-animated-loading');
      loaderSVG?.classList.add('d-none');
      return;
    }

    setTimeout(() => {
      const firstStep = document.querySelector('.automation_steps_container .card-info') as HTMLElement;
      const firstRect = firstStep.getBoundingClientRect();
      const containerRect = (this.container as HTMLElement).getBoundingClientRect();
      (this.container as HTMLElement).scrollLeft = (firstRect.left - containerRect.x) / 2 + firstRect.width / 2;

      const loaderBG = document.querySelector('.automations-steps-loader--background');
      loaderBG?.classList.add('animated-fade-out__slow');

      const loaderSVG = document.querySelector('.logo-animated-loading');
      loaderSVG?.classList.add('animated-fade-out');
    }, 1000);

    setTimeout(() => {
      const loaderSVG = document.querySelector('.logo-animated-loading') as HTMLElement;
      loaderSVG.style.display = 'none';
    }, 1000);
  }

  beforeDestroy() {
    document.querySelector('html')?.classList.remove('disable-swipe-navigation');
    document.querySelector('body')?.classList.remove('disable-swipe-navigation');
  }

  startDrag(event: MouseEvent) {
    this.isDragging = true;
    this.startX = event.clientX - this.translateX;
    this.startY = event.clientY - this.translateY;
  }

  handleDrag(event: MouseEvent) {
    if (!this.isDragging) {
      return;
    }
    this.translateX = event.clientX - this.startX;
    this.translateY = event.clientY - this.startY;
    this.updateTransform();
  }

  endDrag() {
    this.isDragging = false;
  }

  handleZoom(event: WheelEvent) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();

    const scaleDelta = event.deltaY > 0 ? 0.9 : 1.1;
    this.scale *= scaleDelta;
    this.updateTransform();
  }

  updateTransform() {
    this.automationSteps.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
  }

  zoomIn() {
    this.scale *= 1.1;
    this.updateTransform();
  }

  zoomOut() {
    this.scale /= 1.1;
    this.updateTransform();
  }

  goBackToDefault() {
    this.scale = 1;
    this.updateTransform();
  }

  openHistoric() {
    this.showHistoric = true;
  }

  closeHistoric() {
    this.showHistoric = false;
  }

  updateModal(step: any, isNew = false) {
    this.stepValidateError = 0;
    if (isNew) {
      this.showAddCard = false;
    }
    if (['end', 'contactValidate'].includes(step.type) && isNew) {
      this.saveStepData(step.id, 'add', {
        type: step.type,
        settings: step.settings || {},
      });
      return;
    }
    if (step.type === 'trigger' && this.hasTriggerStep && isNew) {
      this.toastService.show({
        type: 'error',
        text: this.$t('warning.stepTriggerExistsAlready') as string,
        leftBorder: false,
      });
      return;
    }

    this.showUpdateModal = this.isActualVersion;
    this.editStepId = this.isActualVersion ? 0 : this.editStepId;
    this.stepInfoEdit = step;
    this.eventType = isNew ? 'add' : 'update';
  }

  addCard(stepId: number) {
    this.stepInfoEdit = { id: 0 };
    this.stepInfoEdit.id = stepId;
    this.showAddCard = this.isActualVersion;
  }

  deletePath(deletedPaths: any) {
    this.deletedPaths = deletedPaths;
  }

  deleteChoice(stepId: number, deleteChoice: any, eventType: string) {
    this.splitDeleteChoice = deleteChoice;
    this.saveStepData(stepId, eventType, undefined);
  }

  saveStepData(stepId: number | string, eventType: string, value: any) {
    this.steps = this.actionsStep(stepId, this.steps, eventType, value);
  }

  actionsStep(findId: number | string, step: any, type: string, value?: any) {
    if (value?.type === 'trigger' && type === 'add') {
      this.hasTriggerStep = true;
      return {
        id: this.automationDTO.stepId,
        ...value,
        child: [step],
      };
    }

    if (step.id === findId) {
      let { child } = step;
      switch (type) {
        case 'add':
          const currentId = this.automationDTO.stepId;
          this.automationDTO.stepId++;
          if (value.type === 'split') {
            child = this.definedSplit(currentId, value, child, 'add');
          } else if (value.type === 'conditional') {
            child = this.definedConditional(currentId, value, child);
          }
          step.child = [
            {
              id: currentId,
              ...value,
              child,
            },
          ];
          this.editStepId = currentId;
          break;
        case 'remove':
          if (step.type === 'trigger') {
            this.hasTriggerStep = false;
          } else if (step.type === 'split') {
            const newChild = this.handleSplitRemove(child, this.splitDeleteChoice);
            if (newChild) {
              child = [newChild];
            } else {
              child = [
                {
                  id: this.automationDTO.stepId,
                  type: 'end',
                  settings: {},
                  child: [],
                },
              ];
              this.automationDTO.stepId++;
            }
          } else if (step.type === 'conditional') {
            const newChild = this.handleConditionalStep(child, this.splitDeleteChoice);
            if (newChild) {
              child = [newChild];
            }
          }
          step = child.length ? child[0] : null;
          break;
        case 'update':
          this.editStepId = findId;
          if (this.deletedPaths.length) {
            this.handleSplitStep(step, value);
          } else if (value.type === 'split') {
            step.child = this.definedSplit(findId, value, child, 'update');
          } else if (value.type === 'conditional') {
            step.settings = value.settings;
            step.child = this.definedConditional(findId, value, child);
          } else {
            step.settings = value.settings;
          }
          break;
      }
    } else if (findId === 0) {
      step = {
        id: this.automationDTO.stepId,
        ...value,
        child: [],
      };
      this.automationDTO.stepId++;
    } else {
      const newChilds = step.child
        .map((item: any) => {
          return this.actionsStep(findId, item, type, value);
        })
        .filter((item: any) => {
          return item ?? false;
        });
      step.child = newChilds;
    }
    return step;
  }

  handleConditionalStep(child: any[], choice: number | string): any {
    const typeToKeep = choice === 'keepYes' ? 'conditionalTrue' : 'conditionalFalse';
    const mappedChild = child.find((item: any) => item.type === typeToKeep)?.child;
    if (mappedChild && mappedChild.length > 0) {
      return { ...mappedChild[0] };
    }
    return null;
  }

  handleSplitStep(step: any, value: any) {
    this.deletedPaths.forEach((index: any) => {
      if (index < step.child.length && step.child[index].type === 'splitPath') {
        step.child.splice(index, 1);
      }
    });
    this.deletedPaths = [];
    step.settings = value.settings;
    step.child.forEach((child: any, index: number) => {
      const newPath = (index + 1).toString();
      child.settings.path = newPath;
      child.settings.value = value.settings[newPath];
    });
  }

  handleSplitRemove(child: any[], choice: number | string): any {
    if (choice === 'removeAll') {
      return null;
    }

    const choiceIndex = Number(choice);
    if (!isNaN(choiceIndex) && child[choiceIndex]?.child?.length > 0) {
      return { ...child[choiceIndex].child[0] };
    }

    return null;
  }

  definedSplit(findId: number | string, value: any, child: any, type: string) {
    return Object.keys(value.settings).map((key: any, index: number) => {
      const oldChild = type !== 'add' && child.length > index ? child[index] : null;
      if (oldChild) {
        oldChild.id = `path_${findId}_${index}`;
        oldChild.settings = { path: key, value: value.settings[key] };
        return oldChild;
      }
      if (index !== 0) {
        child = [{ id: this.automationDTO.stepId, type: 'end', settings: {}, child: [] }];
        this.automationDTO.stepId++;
      }
      return {
        id: `path_${findId}_${index}`,
        type: 'splitPath',
        settings: { path: key, value: value.settings[key] },
        child,
      };
    });
  }

  definedConditional(findId: number | string, value: any, child: any) {
    const oldChildIndex = child.findIndex((item: any) => item.id === `conditional_${findId}_1`);
    if (oldChildIndex >= 0) {
      child[oldChildIndex].settings = value.settings;
      return child;
    }
    const childEnd = [{ id: this.automationDTO.stepId, type: 'end', settings: {}, child: [] }];
    this.automationDTO.stepId++;
    return [
      {
        id: `conditional_${findId}_1`,
        type: 'conditionalTrue',
        settings: value.settings,
        child,
      },
      {
        id: `conditional_${findId}_2`,
        type: 'conditionalFalse',
        settings: {},
        child: childEnd,
      },
    ];
  }

  updateInput(event: never, keyInput: keyof AutomationDto) {
    this.automationDTO[keyInput] = event;
    if (keyInput === 'title') {
      this.debouncedValidateName();
    }
  }

  async loadAutomation() {
    this.loadingService.show();

    try {
      const automationId = +this.$route.params.automation_id;
      if (automationId) {
        const response = await this.automationService.getAutomation(automationId);
        this.automationDTO = await response.data;

        if (this.automationDTO.labelContent && this.automationDTO.labelContent.length > 0) {
          this.automationDTO.labels = this.automationDTO.labelContent.map((content) => content.label);
        }

        this.steps = Object.keys(this.steps).length > 0 ? this.steps : this.automationDTO.steps;
        this.isNew = false;
        this.mapSteps();
      } else {
        this.lastId = 1;
      }
    } finally {
      this.loadingService.hide();
    }
  }

  async loadAutomationStatistics() {
    try {
      const automationId = +this.$route.params.automation_id;
      if (automationId) {
        this.isLoadingStatistics = true;
        const response = await this.automationService.getAutomationStatistics(automationId);
        this.automationStatistics = response.data[0];
      }
    } finally {
      this.isLoadingStatistics = false;
    }
  }

  finishedLoading() {
    // END LOADING STEPS
  }

  async mapSteps() {
    if (this.lastId === 0) {
      this.lastId = this.recursiveLoadingSteps(this.automationDTO.steps);
    }

    if (this.emailList.length || this.webPushList.length || this.mobilePushList.length) {
      const response = await this.automationService.getStatisticsMessage(
        this.emailList,
        this.webPushList,
        this.mobilePushList,
        this.rangeSelected,
        this.automationDTO.id || 0
      );
      this.statistics = response.data;
    }
  }

  recursiveLoadingSteps(steps: any): number {
    let lastId = steps.id;
    if (steps.type === 'email') {
      this.emailList.push(steps.settings.id);
    }
    if (steps.type === 'webPush') {
      this.webPushList.push(steps.settings.id);
    }
    if (steps.type === 'mobilePush') {
      this.mobilePushList.push(steps.settings.id);
    }
    if (steps.type === 'randomWebPush') {
      for (const message of steps.settings.messages) {
        this.webPushList.push(message.id);
      }
    }
    if (steps.type === 'randomMobilePush') {
      for (const message of steps.settings.messages) {
        this.mobilePushList.push(message.id);
      }
    }
    if (steps.type === 'testAB' || steps.type === 'randomMessage') {
      for (const message of steps.settings.messages) {
        this.emailList.push(message.id);
      }
    }
    if (steps.child && steps.child.length > 0) {
      steps.child.forEach((child: any) => {
        lastId = this.recursiveLoadingSteps(child);
      });
    }
    return lastId;
  }

  async saveAutomation() {
    this.loadingService.show();
    this.automationDTO.steps = this.steps;
    let response = null;
    if (this.isNew) {
      response = await this.automationService.createFullAutomation(this.automationDTO);
    } else {
      response = await this.automationService.updateFullAutomation(this.automationDTO);
    }
    if (response && response.data && response.data.messageError) {
      this.stepValidateError = response.data.stepError;
      if (this.stepValidateError) {
        document.querySelector('html')?.classList.add('disable-swipe-navigation');
        document.querySelector('body')?.classList.add('disable-swipe-navigation');

        this.container = document.querySelector('.automations-steps-stage') as HTMLElement;
        this.container.addEventListener('mousedown', this.mouseDownHandler);
        const firstStep = document.querySelector(`.step-location-id-${this.stepValidateError}`) as HTMLElement;
        const firstRect = firstStep.getBoundingClientRect();
        (this.container as HTMLElement).scrollTop -= firstRect.y * -1;
        const containerRect = (this.container as HTMLElement).getBoundingClientRect();
        (this.container as HTMLElement).scrollLeft = (firstRect.left - containerRect.x) / 2 + firstRect.width / 2;
      }
      this.toastService.show({
        type: 'error',
        text: this.$t(`automationsErrors.${response.data.messageError}`) as string,
        leftBorder: false,
      });
      return;
    }
    this.toastService.show({
      type: 'success',
      text: this.$t('modal.operationPerformed') as string,
      leftBorder: false,
    });

    this.$router.push('/automations/emails');
  }

  copyAutomationId() {
    navigator.clipboard.writeText(`${this.automationDTO.id}`);
  }

  mouseDownHandler(e: MouseEvent) {
    // reference: https://htmldom.dev/drag-to-scroll/
    (this.container as HTMLElement).style.cursor = 'grabbing';
    (this.container as HTMLElement).style.userSelect = 'none';

    this.pos = {
      // The current scroll
      left: this.container?.scrollLeft || 0,
      top: this.container?.scrollTop || 0,
      // Get the current mouse position
      x: e.clientX,
      y: e.clientY,
    };

    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  mouseMoveHandler(e: MouseEvent) {
    // How far the mouse has been moved
    const dx = e.clientX - this.pos.x;
    const dy = e.clientY - this.pos.y;

    // Scroll the element
    (this.container as HTMLElement).scrollTop = this.pos.top - dy;
    (this.container as HTMLElement).scrollLeft = this.pos.left - dx;
  }

  mouseUpHandler() {
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);

    (this.container as HTMLElement).style.cursor = 'grab';
    (this.container as HTMLElement).style.removeProperty('user-select');
  }

  changeAutomation(automation: any, isActualVersion: boolean) {
    this.steps = automation.newValues?.steps;
    this.isActualVersion = isActualVersion;
    this.historicDate = automation.createdAt;

    document.querySelector('html')?.classList.add('disable-swipe-navigation');
    document.querySelector('body')?.classList.add('disable-swipe-navigation');

    this.container = document.querySelector('.automations-steps-stage') as HTMLElement;
    this.container.addEventListener('mousedown', this.mouseDownHandler);

    if (this.isNew) {
      const loaderBG = document.querySelector('.automations-steps-loader--background');
      loaderBG?.classList.add('d-none');

      const loaderSVG = document.querySelector('.logo-animated-loading');
      loaderSVG?.classList.add('d-none');
      return;
    }

    setTimeout(() => {
      const firstStep = document.querySelector('.automation_steps_container .card-info') as HTMLElement;
      const firstRect = firstStep.getBoundingClientRect();
      const containerRect = (this.container as HTMLElement).getBoundingClientRect();
      (this.container as HTMLElement).scrollLeft = (firstRect.left - containerRect.x) / 2 + firstRect.width / 2;

      const loaderBG = document.querySelector('.automations-steps-loader--background');
      loaderBG?.classList.add('animated-fade-out__slow');

      const loaderSVG = document.querySelector('.logo-animated-loading');
      loaderSVG?.classList.add('animated-fade-out');
    }, 1000);

    setTimeout(() => {
      const loaderSVG = document.querySelector('.logo-animated-loading') as HTMLElement;
      loaderSVG.style.display = 'none';
    }, 1500);
  }

  async getValuesUrl() {
    if (this.$route.query?.historicId) {
      const historicId = parseInt(this.$route.query.historicId as string, 10);
      this.isActualVersion = historicId === this.audits[0].id ? true : false;
      const auditIndex = this.audits.findIndex((x: any) => x.id === historicId);
      this.historicDate = auditIndex !== -1 ? this.audits[auditIndex]?.createdAt : null;
      const stepsAudit = auditIndex !== -1 ? this.audits[auditIndex].newValues?.steps : false;
      this.steps = stepsAudit ? stepsAudit : this.steps;
      await this.loadAudits();
    } else {
      await this.loadAudits();
    }
  }
  async loadAudits() {
    if (isNaN(Number(this.$route.params.automation_id))) {
      return;
    }
    if (!this.$store.getters.can('audit_logs:view')) {
      return;
    }
    try {
      const automationId = Number(this.$route.params.automation_id);
      const result = await this.automationService.getAutomationAudits(automationId);
      this.audits = result?.data;
    } catch (error) {
      throw error;
    }
  }

  async validateAutomationName() {
    try {
      if (this.automationDTO.title === undefined || this.automationDTO.title.length < 3) {
        return;
      }

      const { data } = await this.automationService.checkAvailableName(this.automationDTO.title, this.automationDTO.id);

      if (!data || data.length === 0) {
        this.isNotAvailable = false;
      } else {
        this.isNotAvailable = true;
      }
    } catch (error) {
      console.error('Error checking automation title:', error);
      return false;
    }
  }

  async getGoalStatistics() {
    if (this.startDate === '' || this.endDate === '') {
      this.setDefaultDateRange();
    }

    const response = await this.automationService.getAutomationGoalsStatistics(
      this.automationDTO.id || 0,
      this.startDate,
      this.endDate
    );
    this.goalsStatistics = response.data;

    this.fillChartOptions();
  }

  fillChartOptions() {
    const sortedData = this.goalsStatistics.sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const dates = sortedData.map((item: any) => {
      const date = new Date(item.date);
      return date.toLocaleDateString(store.state.userLanguage, {
        day: 'numeric',
        month: 'short',
      });
    });

    this.chartOptions = {
      ...this.chartOptions,
      xaxis: {
        categories: dates,
      },
    };

    this.series = [
      {
        name: this.$t('title.reachedGoal'),
        data: sortedData.map((item: any) => Number(item.count)),
      },
    ];
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

    this.startDate = startDateInTimezone.format('YYYY-MM-DD');
    this.endDate = endDateInTimezone.format('YYYY-MM-DD');
    this.dateRangeText = `${Vue.filter('formatDate')(dates[0])} - ${Vue.filter('formatDate')(dates[1])}`;
    this.isDateRange = true;
    await this.getGoalStatistics();
  }

  async clearDate() {
    this.selectedDates = [];
    this.isDateRange = false;
    this.dateRangeText = '';
    await this.getGoalStatistics();
  }

  setDefaultDateRange() {
    const thirtyDaysAgo = dayjs().tz(this.currentAccountTimezone).subtract(30, 'day');
    const today = dayjs().tz(this.currentAccountTimezone);

    this.startDate = thirtyDaysAgo.format('YYYY-MM-DD');
    this.endDate = today.format('YYYY-MM-DD');
    this.dateRangeText = `${Vue.filter('formatDate')(thirtyDaysAgo)} - ${Vue.filter('formatDate')(today)}`;
    this.selectedDates = [
      this.dateToVuetifyString(new Date(this.startDate)),
      this.dateToVuetifyString(new Date(this.endDate)),
    ];
    this.isDateRange = true;
  }

  selectLabels(labels: LabelDto[]) {
    this.automationDTO.labels = labels;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
@import '@/assets/styles/animations.scss';

.automation-card {
  place-items: center;
}
.edit-title {
  display: flex;
  flex-direction: row;
}
.automations-steps-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overscroll-behavior-x: none;
  min-height: 100px;
  // overflow-x: scroll;
  overflow: auto;
  padding: 24px 0px;
  width: 100%;
  cursor: grab;
}

.automations-steps-stage::-webkit-scrollbar {
  display: none;
  width: 0px;
}

.automations-steps-loader {
  width: fit-content;
  height: calc(100vh - 620px);
  min-height: 600px;
  transform: translateX(0);
  margin: 0 auto;
}

.zoom {
  z-index: 10;
  position: absolute;
  display: flex;
  flex-direction: row;
  align-items: center;
  top: 10px;
  right: 10px;
  gap: 8px;
  white-space: nowrap;
}

.expand-icon {
  color: $ds-gray !important;
  font-size: 22px;
  padding: 5px;
  border-radius: 50%;

  &:hover {
    cursor: pointer;
    background: #f5f5f5;
  }
}

.div-zoom-date {
  display: flex;
  flex-direction: row;
  align-items: center;
  border-radius: 8px !important;
  padding: 8px 8px;
  background: #f5f5f5;
  color: $ds-gray !important;
  gap: 8px;

  button {
    width: 24px;
    height: 24px;
    font-size: 18px;
    padding: 0px 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 100%;
    &:hover {
      background-color: $ds-gray-300;
    }

    &:active {
      background-color: $ds-gray-200;
    }
  }

  span {
    font-size: 14px;
    margin-bottom: 0px !important;
    width: 39px;
    display: block;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
}

.automations-steps-loader--background {
  position: fixed;
  width: 100%;
  height: 120%;
  background: white;
  z-index: 9999;
}
.logo-animated-loading {
  position: relative;
  top: 50%;
  left: 50%;
  z-index: 99999;
  // margin-left: calc(-100% - 50px);
}

.v-card {
  border-radius: 12px;
}

.title-automation {
  display: flex;
  flex-direction: column;
}
.copy-icon {
  height: 19px;
  margin-top: -3px;
}

.btn-container {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  flex-flow: row-reverse;
}

.audience-container {
  display: flex;
  height: 49px;
  width: fit-content;
  border-radius: $spacing-xs;
}

.automation_links-list {
  background: $ds-blue;

  label {
    color: $neutral-gray-100;
    margin-right: 12px !important;
    display: flex;
  }

  .listName {
    margin-left: 4px;
  }
}

.c-autocomplete {
  padding-top: 0px;
  margin-top: 0px;
  font-size: 14px;
  line-height: 17px;
  height: 33px;
}

.automation-name {
  font-size: 0.7em;
  color: gray;
}

.animated-fade-out {
  animation: fadeout 1s forwards;
}

.animated-fade-out__slow {
  animation: fadeout 1.5s forwards;
}

.buttons-height {
  height: 44px;
}

.historic-button {
  color: $ds-blue;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  border: $ds-blue solid 2px;
  border-radius: 8px !important;
  padding: 5px !important;
  height: 26px;
  width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.7px !important;

  &:hover {
    background: $ds-blue;
    color: white;
  }
}

.restore-button {
  background: $ds-blue;
  color: white;
  font-weight: 600;
  font-size: 14px;
  text-transform: uppercase;
  border: $ds-blue solid 2px;
  border-radius: 8px !important;
  padding: 5px 25px !important;

  &:hover {
    background: $ds-blue-dark;
    border: $ds-blue-dark solid 2px;
  }
}

.historic-active {
  overflow: hidden;
}

.date-alert {
  font-weight: 600;
}

.alert-historic {
  margin-right: 0;
  transition: margin-right 0.4s ease-out;
}

.alert-historic-open {
  margin-right: 325px !important;
  transition: margin-right 0.4s ease-out;
}

.text-error {
  color: $ds-red;
}

.text-correct {
  color: #0fb75c;
}

::v-deep .switch-end .v-input__control .v-input__slot {
  align-items: end;
  flex-flow: row-reverse;
  gap: 15px;
}

.switch-label-color {
  color: #5c5c5c;
  letter-spacing: 0.07em !important;
}

::v-deep.switch-label-color .v-label {
  letter-spacing: 0.07em !important;
}
::v-deep.switch-label-color .v-input__slot {
  margin-bottom: 0px !important;
}

::v-deep .switch-label-color label {
  margin-bottom: 0px !important;
}
::v-deep .switch-label-color .v-input__control {
  margin-bottom: -2px !important;
}
::v-deep .v-label {
  font-size: 12px;
}
::v-deep .form-control:focus {
  box-shadow: none !important;
  border-color: $ds-gray-300 !important;
}
::v-deep .form-control:active {
  box-shadow: none !important;
  border-color: $ds-blue !important;
}
.dialog-more-statistics {
  background: white;
  padding: 20px;

  h3 {
    color: $ds-blue;
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 0px !important;
  }
}

.close-button {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 36px !important;
  width: 36px !important;
  border-radius: 18px;

  &:hover {
    background-color: #a6a6a617;
  }
}

.statistics {
  width: 100%;
  padding-bottom: 10px;
  overflow-x: auto;
}

.statistics::-webkit-scrollbar,
.statistics-cards::-webkit-scrollbar {
  height: 8px !important;
}

.statistics-cards {
  width: 100%;
  padding-bottom: 10px;
  overflow-x: auto;
  padding-top: 10px;
}

.over-flow-cards {
  max-width: 100%;
  overflow-y: auto;
}

::v-deep .v-dialog {
  border-radius: 16px;
  box-shadow: none;
  width: fit-content;
}

.rate {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  width: 30%;
  border-radius: 12px;
  border: 1px $ds-gray-300 solid;

  .icon {
    width: 14px;
    height: 14px;
    color: $ds-gray !important;
  }
}

.value-more {
  gap: 25px !important;
}

.chart-height {
  height: 380px;
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

.date-menu {
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px 8px 0px 0px !important;
}

.date-button-open {
  border-radius: 8px 8px 0px 0px !important;
  border-bottom: 1px solid $ds-gray-100 !important;
  border-top: 1px solid $ds-blue !important;
  border-right: 1px solid $ds-blue !important;
  border-left: 1px solid $ds-blue !important;
}

.date-range {
  font-size: 12px;
  color: $ds-gray;
  font-weight: 400;
  text-transform: initial !important;
}

.filters-card {
  border-radius: 8px;
}

.filters-card-open {
  border-radius: 0px 0px 8px 8px !important;
  border-bottom: 1px solid $ds-blue;
  border-right: 1px solid $ds-blue;
  border-left: 1px solid $ds-blue;
}

.date-picker {
  border-bottom: 1px solid $ds-gray-100;
}

.clear-date {
  display: flex;
  padding: 10px;
  place-content: flex-end;
}

.clear-fields {
  text-transform: uppercase;
  background-color: #ffffff !important;
}

.clear-fields:disabled {
  color: $ds-gray-300 !important;
}

::v-deep.v-menu__content {
  border-radius: 0px 0px 8px 8px !important;
}
</style>
