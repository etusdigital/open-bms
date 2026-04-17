<template>
  <div class="view-automations-logs">
    <h2 class="c-title pl-4 pb-0">{{ $t('title.automationLogs') }}</h2>
    <div>
      <v-data-table :headers="headers" :items="audits" hide-default-footer class="c-table" :calculate-widths="true">
        <template v-slot:[`item.name`]="{ item }">
          <div class="td-item">
            {{ item.user ? JSON.parse(item.user).name : '' }}
          </div>
        </template>
        <template v-slot:[`item.email`]="{ item }">
          <div class="td-item">
            {{ item.user ? JSON.parse(item.user).email : '' }}
          </div>
        </template>
        <template v-slot:[`item.ipAddress`]="{ item }">
          <div class="td-item">
            {{ item.ipAddress }}
          </div>
        </template>
        <template v-slot:[`item.createdAt`]="{ item }">
          <div class="td-item">
            <span> {{ item.createdAt | dateTime }} </span>
          </div>
        </template>
        <template v-slot:no-data>
          <p :value="true" color="error" class="no-data" icon="warning">{{ $t('datatable.noData') }}</p>
        </template>

        <template v-slot:[`item.actions`]="{ item }">
          <div class="td-item">
            <div v-tooltip.top="$t('datatable.viewChanges')">
              <span @click="showModalLogs(item)" class="cursor-pointer material-symbols-rounded ds-light-gray-color"
                >visibility</span
              >
            </div>
          </div>
        </template>
      </v-data-table>
      <automation-log-modal :dialog="dialog" :audit="currentAudit" @hideModalLogs="hideModalLogs">
      </automation-log-modal>
    </div>
  </div>
</template>
<script lang="ts">
import AutomationsService from '@/modules/automations/services/automations.service';

import { Component, Vue } from 'vue-property-decorator';
import { AuditDto } from '../dtos/audit.dto';
import LoadingService from '@/services/loading.service';

@Component({
  filters: {},
  computed: {},
})
export default class AutomationsLogs extends Vue {
  private readonly automationService = new AutomationsService();
  private readonly loadingService = new LoadingService();

  audits: AuditDto[] = [];
  headers: any = [];
  currentAudit: AuditDto = [] as AuditDto;
  dialog = false;

  beforeMount() {
    this.initTable();
  }

  async mounted() {
    await this.loadAudits();
  }

  async loadAudits() {
    this.loadingService.show();

    try {
      const automationId = +this.$route.params.automation_id;
      const result = await this.automationService.getAutomationAudits(automationId);
      this.audits = result?.data;
    } catch (error) {
      throw error;
    } finally {
      this.loadingService.hide();
    }
  }

  initTable() {
    this.headers = [
      { text: this.$t('datatable.responsibleName'), value: 'name', sortable: false },
      { text: this.$t('datatable.responsibleEmail'), value: 'email', sortable: false },
      { text: this.$t('datatable.responsibleIp'), value: 'ipAddress', sortable: false },
      { text: this.$t('datatable.editionDate'), value: 'createdAt', sortable: false },
      { text: '', value: 'actions', sortable: false },
    ];
  }

  showModalLogs(audit: AuditDto) {
    this.currentAudit = audit;
    this.dialog = true;
  }

  hideModalLogs() {
    this.dialog = false;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

::v-deep.view-automations-logs {
  width: 100%;
}

::v-deep.c-table {
  margin-top: 28px;
}
</style>
