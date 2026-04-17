<template>
  <div class="div-fields">
    <div class="list-fields">
      <div>
        <v-data-table
          ref="dataTableRef"
          :headers="headers"
          :items="fields"
          :items-per-page="fields.length"
          hide-default-footer
          v-bind:class="[{ hideBorder: hideBorder }, 'c-table']"
          fixed-header
          :height="height"
          :calculate-widths="true"
        >
          <template v-slot:[`item.name`]="{ item }">
            <span>
              {{ item.name }}
            </span>
          </template>
          <template v-slot:[`item.type`]="{ item }">
            {{ item.type }}
          </template>
          <template v-slot:[`item.field`]="{ item }">
            <div style="display: flex; flex-direction: row; align-items: center">
              <span :class="`field-${item.id} field-text`"> {{ item.field }}</span>
              <span class="span-clipboard-icon">
                <div
                  v-tooltip.bottom="showCopyedMessage ? $t('button.fieldCopied') : $t('button.copyField')"
                  style="width: min-content; margin-left: 8px"
                >
                  <span
                    class="material-symbols-rounded ds-light-gray-color icon-active cursor-pointer font-20"
                    @mouseleave="onClipboardLeave"
                    @click="copyToCLipboard(item.id)"
                  >
                    content_copy
                  </span>
                </div>
              </span>
            </div>
          </template>

          <template v-slot:no-data>
            <p :value="true" color="error" icon="warning">{{ $t('datatable.noData') }}</p>
          </template>
        </v-data-table>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { FieldsInterface } from '@/components/fields-list/interfaces/fields.interface';
import store from '@/store';
import { Component, Prop, Watch, Vue } from 'vue-property-decorator';

@Component({
  components: {},
  store,
})
export default class ListFields extends Vue {
  @Prop({ default: [] }) fields!: Array<FieldsInterface>;
  @Prop({ default: '355px' }) height!: string;
  @Prop({ default: false }) hideBorder!: boolean;

  headers: any = [];

  showCopyedMessage = false;

  async beforeMount() {
    this.initTable();
  }

  initTable() {
    this.headers = [
      { text: this.$t('datatable.fieldName'), value: 'name', sortable: false, width: '30%' },
      { text: this.$t('datatable.type'), value: 'type', sortable: false, width: '20%' },
      { text: this.$t('datatable.howTo'), value: 'field', sortable: false, width: '50%' },
    ];
  }

  copyToCLipboard(id: any) {
    const el = document.querySelector(`.field-${id}`);
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('copy');
        selection.removeAllRanges();
        this.showCopyedMessage = true;
      }
    }
  }

  @Watch('fields')
  scrollToTop() {
    const dataTableElement = document.querySelector<HTMLElement>('.list-fields');
    if (dataTableElement) {
      dataTableElement.scrollTop = 0;
    }
  }

  onClipboardLeave() {
    this.showCopyedMessage = false;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.span-clipboard-icon img {
  width: 30px;
  height: 30px;
  padding: 5px 5px 5px 5px;
}
.span-clipboard-icon img:hover {
  background-color: #5c5c5c;
  border-radius: 4px;
}
.div-fields {
  padding: 5px 5px 5px 0px;
  border-radius: 16px;
  background: white !important;
  box-shadow: $shadow-base;
}
::v-deep.list-fields {
  overflow-y: auto;
  overflow-x: hidden;
  background: white !important;
  border-radius: 16px;

  .hideBorder table {
    border: none;
  }
  .c-table {
    tbody td:not(:last-child) {
      padding: 21.5px 16px 21.5px 16px !important;
    }
    thead th {
      padding: 11px 16px 16px 16px !important;
    }

    tbody td {
      vertical-align: middle !important;
    }

    .field-text {
      word-break: break-all;
    }
  }
}
</style>
