<template>
  <div>
    <div class="table-component" :class="isLoading ? 'd-none' : ''">
      <v-data-table
        :headers="headers"
        :items="items"
        hide-default-footer
        class="c-table"
        :calculate-widths="true"
        :no-data-text="`${$t('datatable.noData')}`"
        :server-items-length="totalData"
        :options.sync="localOptions"
        :pageReference="pageReference"
      >
        <template v-if="!isNotLink" v-slot:[`item.${headers[0].value}`]="{ item }">
          <div class="td-item">
            <router-link :to="`${pageReference}/${item.id}`" class="table-item-click font-12" cursor="pointer">
              {{ item[headers[0].value] }}
            </router-link>
            <p class="m-0 mt-1 text--secondary font-12" v-if="item.description">
              {{ item.description }}
            </p>
          </div>
        </template>
        <template v-slot:[`item.updatedAt`]="{ item }">
          <div class="td-item tabular-nums font-12">
            <span> {{ item.updatedAt || item.createdAt | formatDateTime }} </span>
          </div>
        </template>
        <template v-slot:[`item.createdAt`]="{ item }">
          <div class="td-item tabular-nums font-12">
            <span> {{ item.createdAt | formatDateTime }} </span>
          </div>
        </template>
        <template v-if="renderStatus" v-slot:[`item.renderStatus`]="{ item }">
          <div class="td-item">
            <span
              class="status-chip"
              :class="{
                'status-active': item.renderStatus === $t('datatable.active'),
                'status-inactive': item.renderStatus === $t('datatable.inactive'),
              }"
            >
              {{ item.status }}
            </span>
          </div>
        </template>
        <template v-slot:[`item.actions`]="{ item }">
          <div class="actionIcons">
            <template v-for="action in actions">
              <button
                @click="actionsTable(action, item)"
                :key="`button-${action}`"
                v-tooltip.bottom="$t(`button.${action}`)"
                :class="`button-${action} text-end`"
              >
                <span
                  class="material-symbols-rounded ds-light-gray-color font-20"
                  :class="{ 'unfilled-icon': action === 'history' }"
                  >{{ actionIcons[action] }}</span
                >
                <!-- <img class="icon-size size-img" :src="actionIcons[action]" /> -->
              </button>
            </template>
          </div>
        </template>
      </v-data-table>
    </div>
    <div class="text-center pagination pt-5 align-items-center justify-space-between">
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
        v-if="items.length > 0"
        class="c-pagination"
        v-model="pagination.page"
        :length="pagination.totalPages"
        @input="handlePagination"
        :total-visible="10"
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
  </div>
</template>

<script lang="ts">
import { setItemsPerPage } from '@/util/objects';
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';

@Component({
  props: [
    'actions',
    'items',
    'headers',
    'pagination',
    'totalData',
    'redirectLink',
    'isLoading',
    'pageReference',
    'options',
    'renderStatus',
    'getDataRequest',
    'rangeStart',
    'rangeFinal',
    'isNotLink',
  ],
})
export default class DataTable extends Vue {
  @Prop() public actions!: any;
  @Prop() public items!: any;
  @Prop() public headers!: any;
  @Prop() public pagination!: any;
  @Prop() public totalData!: any;
  @Prop() public redirectLink!: string;
  @Prop() public isLoading!: boolean;
  @Prop() public pageReference!: string;
  @Prop() public options!: any;
  @Prop() public getDataRequest!: string;
  @Prop() public rangeStart!: number;
  @Prop() public rangeFinal!: number;
  @Prop() public isNotLink!: boolean;
  actionIcons = {
    edit: 'edit_square',
    delete: 'delete',
    duplicate: 'content_copy',
    run: 'play_circle',
    history: 'overview',
  };
  order = '';
  localOptions: any = {};
  firstOptions = false;
  selectItemsPerPage = [
    { text: '10', value: 10 },
    { text: '20', value: 20 },
    { text: '50', value: 50 },
    { text: '100', value: 100 },
  ];

  beforeMount() {
    this.localOptions = this.options;
  }

  actionsTable(action: string, item: any) {
    this.$emit(action, item);
  }

  setItemsNumber(items: number) {
    this.pagination.itemsPerPage = Number(items);
    this.pagination.page = 1;
    setItemsPerPage(this.pageReference, items);
    this.$emit('getDataRequest');
  }

  @Watch('localOptions', { deep: true })
  async onChangeOptions() {
    if (this.firstOptions) {
      this.$emit('onChangeOptions', this.localOptions);
      return;
    }

    this.firstOptions = true;
  }

  async handlePagination() {
    this.$emit('handlePagination', this.localOptions);
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';

.size-img {
  width: 20px;
  height: 20px;
}

.c-table {
  box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.06), 0px 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 16px;
  margin-top: 1rem;
}
.actionIcons {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5em;
}
.table-item-click {
  color: $ds-blue;
}

.button-duplicate img {
  height: 24px;
}
.button-duplicate:hover img {
  filter: invert(79%) sepia(9%) saturate(15%) hue-rotate(70deg) brightness(92%) contrast(87%);
}

.button-delete img {
  height: 20px;
}
.button-delete:hover img {
  filter: invert(27%) sepia(73%) saturate(6631%) hue-rotate(351deg) brightness(102%) contrast(88%);
}

.button-run img {
  filter: invert(71%) sepia(3%) saturate(6%) hue-rotate(340deg) brightness(95%) contrast(85%);
}
.button-run:hover img {
  filter: none;
}
</style>
