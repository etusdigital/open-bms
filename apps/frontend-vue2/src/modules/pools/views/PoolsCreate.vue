<template>
  <div class="col-12 pt-0">
    <v-card class="background-card d-flex div-column gap-20 card-name-description">
      <InputDefault
        :name="`${$t('title.name')}`"
        data-cy="pools-new-title"
        autofocus
        :modelValue="currentPool.name"
        :placeholder="`${$t('input.poolName')}`"
        @updateInput="updateInput"
        :keyInput="'name'"
        max="40"
      />
      <InputDefault
        data-cy="pools-new-description"
        autofocus
        max="255"
        :name="`${$t('create.description')}`"
        :modelValue="currentPool.description"
        :placeholder="`${$t('input.poolDescription')}`"
        :keyInput="'description'"
        @updateInput="updateInput"
      />
    </v-card>
    <div>
      <label class="label-title font-16">{{ $t('title.configuration') }}</label>
      <v-card class="background-card col-12">
        <div class="row">
          <div class="row pl-4 pr-4 pt-3 pb-3">
            <div class="col-4 pb-1">
              <label class="label-title font-12">{{ $t('create.senderName') }}</label>
              <InputDefault
                data-cy="name"
                autofocus
                class="validateInput"
                :modelValue="currentPool.senderName"
                :placeholder="`${$t('input.senderName')}`"
                :keyInput="'senderName'"
                @updateInput="updateInput"
                max="60"
              />
            </div>

            <div class="col-4 pb-1">
              <label class="label-title font-12">{{ $t('create.senderEmail') }}</label>
              <InputDefault
                data-cy="email"
                autofocus
                class="validateInput"
                :modelValue="currentPool.senderEmail"
                :placeholder="`${$t('input.senderEmail')}`"
                :keyInput="'senderEmail'"
                @updateInput="updateInput"
              />
            </div>

            <div class="col-4 pb-1">
              <label class="label-title font-12">{{ $t('create.replyTo') }}</label>
              <InputDefault
                data-cy="email"
                autofocus
                class="validateInput"
                :modelValue="currentPool.senderReplyTo"
                :placeholder="`${$t('input.replyEmail')}`"
                :keyInput="'senderReplyTo'"
                @updateInput="updateInput"
              />
            </div>

            <div class="col-6 mb-3 pt-0">
              <label class="label-title font-12">IP Pool</label>
              <select
                data-cy="automation-message-ippool"
                class="form-control mo-select border-color"
                v-model="currentPool.poolName"
              >
                <option disabled selected value="">{{ $t('input.selectPool') }}</option>
                <option v-for="pool in ipPools" :value="pool.name" :key="pool.name">
                  {{ pool.name }}
                </option>
              </select>
            </div>

            <div class="col-6 mb-3 d-flex pt-0">
              <label for=""></label>
              <v-checkbox
                v-model="currentPool.isDefault"
                class="c-checkbox mt-6 mb-0 pb-0"
                :label="`${$t('input.isDefaultPool')}`"
              ></v-checkbox>
            </div>
          </div>
        </div>
      </v-card>
      <v-card class="row background-card pl-0 pr-0" v-if="ips.length">
        <div class="row col-12 p-3 pb-0">
          <div class="col-6 pb-0">
            <label>{{ $t('datatable.ipAddress') }}</label>
          </div>
          <div class="col-6 pb-0"><label>Pools</label></div>
        </div>
        <div class="row col-12 p-3 pb-0" v-for="(ip, index) in ips" :key="index">
          <div class="col-6 pb-0">
            <v-checkbox :value="ip" :key="ip" :label="ip" class="mt-0 pt-0" v-model="currentPool.ipsSelected">
            </v-checkbox>
          </div>
          <div class="col-6 pb-0">
            <span class="badge-pools" v-for="(pools, index) in ip.pools" :key="index">{{ pools }}</span>
          </div>
        </div>
      </v-card>
    </div>
    <div class="footer-buttons">
      <input
        class="cancel-button"
        text
        @click="$router.push('/pools')"
        type="button"
        :value="`${$t('button.cancel')}`"
      />
      <ButtonDefault
        :name="`${$t('button.create')}`"
        @click="checkCharacters"
        data-cy="automation-message-save-btn"
        class="btn btn-c btn-lg btn-success btn-success-c float-right"
      />
    </div>
    <v-dialog v-model="showSaveDialog" persistent max-width="400px">
      <v-card>
        <v-card-title class="text-h6" style="white-space: pre-line; word-break: keep-all">{{
          $t('toast.specialCharacters')
        }}</v-card-title>
        <v-card-actions>
          <v-spacer></v-spacer>
          <input
            class="cancel-button mr-4"
            text
            @click="showSaveDialog = false"
            type="button"
            :value="`${$t('button.cancel')}`"
          />
          <ButtonDefault
            class="btn btn-c btn-lg btn-success btn-success-c"
            text
            @click="buttonSave"
            :name="$t('input.yes')"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script lang="ts">
import LoadingService from '@/services/loading.service';
import { Component, Vue, Watch } from 'vue-property-decorator';
import ToastService from '@/services/toast.service';
import PoolService from '../services/pool.service';
import { PoolDto } from '../dtos/pool.dto';
import ButtonDefault from '@/components/button/ButtonDefault.vue';
import InputDefault from '@/components/input/InputDefault.vue';
import { hasEmojiCharacters, hasEspecialCharacters } from '../../../util/objects';

@Component({
  components: { ButtonDefault, InputDefault },
  providers: [LoadingService],
})
export default class PoolsCreate extends Vue {
  private readonly poolService = new PoolService();
  private readonly loadingService = new LoadingService();
  private readonly toastService = new ToastService();

  currentPool: any = {};
  ipPools: any = [];
  ips = [];
  showSaveDialog = false;

  constructor() {
    super();
  }

  beforeMount() {
    this.getPool();
    this.getPoolSendgrid();
  }

  async getPool() {
    const poolId = +this.$route.params.pool_id;
    if (poolId) {
      this.currentPool = (await this.poolService.getPoolById(poolId))?.data;
    }
  }

  async getPoolSendgrid() {
    this.loadingService.show();
    this.ipPools = (await this.poolService.getPoolSendgrid())?.data;
    this.loadingService.hide();
  }

  async getIPsSendgrid() {
    const ips = this.ipPools.find((pool: any) => pool.name === this.currentPool.poolName);
    this.ips = ips?.ips_preview || [];
    this.currentPool.ipsSelected = this.ips.map((item: any) => {
      return item;
    });
  }

  async newPool() {
    return await this.poolService.createPool({
      name: this.currentPool.name,
      description: this.currentPool.description,
      poolName: this.currentPool.poolName,
      ip: JSON.stringify(this.currentPool.ipsSelected),
      senderEmail: this.currentPool.senderEmail,
      senderName: this.currentPool.senderName,
      senderReplyTo: this.currentPool.senderReplyTo,
      isDefault: this.currentPool.isDefault,
    });
  }

  async updatePool(id: number) {
    return await this.poolService.updatePool(id, {
      name: this.currentPool.name,
      description: this.currentPool.description,
      poolName: this.currentPool.poolName,
      ip: JSON.stringify(this.currentPool.ipsSelected),
      senderEmail: this.currentPool.senderEmail,
      senderName: this.currentPool.senderName,
      senderReplyTo: this.currentPool.senderReplyTo,
      isDefault: this.currentPool.isDefault,
    });
  }

  async checkCharacters() {
    if (!hasEmojiCharacters(this.currentPool.senderName)) {
      this.toastService.show({
        type: 'error',
        text: this.$t('toast.haveEmoji') as string,
      });
      return false;
    }

    if (!hasEspecialCharacters(this.currentPool.senderName)) {
      this.showSaveDialog = true;
      return false;
    }
    await this.buttonSave();
  }

  async buttonSave() {
    this.showSaveDialog = false;

    let response;
    if (this.currentPool && this.currentPool.id) {
      response = await this.updatePool(this.currentPool.id);
    } else {
      response = await this.newPool();
    }

    if (response && response.data && response.data.id) {
      this.toastService.show({
        type: 'success',
        text: this.$t('modal.poolSaved') as string,
      });

      this.$router.push(`/pools`);
    }
  }

  @Watch('currentPool.poolName')
  alterPoolName() {
    this.getIPsSendgrid();
  }

  updateInput(event: any, keyInput: any) {
    this.currentPool[keyInput] = event;
  }
}
</script>

<style scoped lang="scss">
@import '@/assets/styles/variables.scss';
::v-deep.view-new-pool {
  width: 100%;
}

.background-card {
  background-color: #ffffff;
  margin-bottom: 24px;
  border-radius: 14px;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  width: 100%;
}

.title-info {
  margin-left: 8px;
}

span.badge-pools {
  background-color: #d3d3d3;
  padding: 5px 10px;
  margin-right: 1%;
  border-radius: 15px;
}

.validateInput {
  height: 36px !important;
  margin-bottom: 15px;
}

::v-deep .v-text-field__slot {
  height: 36px !important;
}
::v-deep .v-text-field--outlined .v-input__control .v-input__slot {
  min-height: 36px !important;
}
</style>
