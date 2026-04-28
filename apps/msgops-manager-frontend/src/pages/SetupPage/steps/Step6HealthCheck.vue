<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { BmsButton } from '../../../components';
import { setupGateway, HealthCheckResult } from '../../../gateways/Setup';
import { showToast } from '../../../utils/showToast';

const emit = defineEmits<{ 'step-complete': [] }>();

const loading = ref(false);
const completing = ref(false);
const results = ref<HealthCheckResult | null>(null);
const retryOnCooldown = ref(false);
const showConfirm = ref(false);

const services = [
  { key: 'postgres' as const, label: 'PostgreSQL' },
  { key: 'redis' as const, label: 'Redis' },
  { key: 'clickhouse' as const, label: 'ClickHouse' },
  { key: 'rabbitmq' as const, label: 'RabbitMQ' },
  { key: 's3' as const, label: 'S3 / MinIO' },
  { key: 'smtp' as const, label: 'SMTP' },
];

const failingServices = computed(() => {
  const r = results.value;
  if (!r) return [];
  return services
    .filter((s) => !r[s.key].ok)
    .map((s) => ({ ...s, error: r[s.key].error ?? '' }));
});

async function runCheck() {
  loading.value = true;
  retryOnCooldown.value = true;
  setTimeout(() => {
    retryOnCooldown.value = false;
  }, 4000);
  try {
    results.value = await setupGateway.healthCheck();
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao verificar serviços.' });
  } finally {
    loading.value = false;
  }
}

function handleComplete() {
  if (results.value?.allOk) {
    doComplete();
  } else {
    showConfirm.value = true;
  }
}

async function doComplete() {
  showConfirm.value = false;
  completing.value = true;
  try {
    const data = results.value?.allOk
      ? {}
      : { skipReason: 'Administrador optou por concluir com serviços com falha.' };
    await setupGateway.advanceStep(6, data);
    emit('step-complete');
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao concluir configuração.' });
  } finally {
    completing.value = false;
  }
}

onMounted(() => runCheck());
</script>

<template>
  <div>
    <div v-if="loading" class="tw-flex tw-items-center tw-gap-2 tw-py-8 tw-justify-center tw-text-gray">
      <v-progress-circular indeterminate size="20" width="2" color="primary" />
      <span class="tw-text-sm">Verificando serviços...</span>
    </div>

    <div v-else-if="results">
      <div class="tw-space-y-2 tw-mb-6">
        <div
          v-for="service in services"
          :key="service.key"
          class="tw-flex tw-items-center tw-justify-between tw-rounded-lg tw-border tw-px-4 tw-py-3"
          :class="results[service.key].ok ? 'tw-border-green-200 tw-bg-green-50' : 'tw-border-red-200 tw-bg-red-50'"
        >
          <span class="tw-text-sm tw-font-medium tw-text-main-gray">{{ service.label }}</span>
          <div class="tw-flex tw-items-center tw-gap-2">
            <span v-if="results[service.key].ok" class="tw-text-xs tw-text-gray">
              {{ results[service.key].latencyMs }}ms
            </span>
            <span v-else class="tw-text-xs tw-text-red-600 tw-max-w-[180px] tw-truncate" :title="results[service.key].error">
              {{ results[service.key].error }}
            </span>
            <span v-if="results[service.key].ok" class="tw-text-green-600 tw-font-bold">✓</span>
            <span v-else class="tw-text-red-600 tw-font-bold">✗</span>
          </div>
        </div>
      </div>

      <div class="tw-flex tw-justify-between tw-items-center">
        <BmsButton name="btn-retry" type="button" variant="secondary" :disabled="loading || completing || retryOnCooldown" @click="runCheck">
          Verificar novamente
        </BmsButton>
        <BmsButton
          name="btn-complete"
          type="button"
          variant="primary"
          :disabled="completing || loading"
          @click="handleComplete"
        >
          Concluir
        </BmsButton>
      </div>
    </div>

    <!-- Confirmation modal when services are failing -->
    <div
      v-if="showConfirm"
      class="tw-fixed tw-inset-0 tw-z-50 tw-flex tw-items-center tw-justify-center tw-bg-black/40 tw-px-4"
    >
      <div class="tw-w-full tw-max-w-sm tw-rounded-2xl tw-bg-white tw-p-6 tw-shadow-xl">
        <h3 class="tw-text-base tw-font-semibold tw-text-main-gray tw-mb-2">
          Serviços com falha
        </h3>
        <p class="tw-text-sm tw-text-gray tw-mb-3">
          Os serviços abaixo não responderam corretamente. A plataforma pode não funcionar como esperado até que sejam corrigidos:
        </p>
        <ul class="tw-mb-4 tw-space-y-1">
          <li
            v-for="s in failingServices"
            :key="s.key"
            class="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-text-red-600"
          >
            <span class="tw-font-bold">✗</span>
            {{ s.label }}
            <span class="tw-text-xs tw-text-red-400 tw-truncate" :title="s.error">
              — {{ s.error }}
            </span>
          </li>
        </ul>
        <p class="tw-text-xs tw-text-amber-600 tw-bg-amber-50 tw-border tw-border-amber-200 tw-rounded-lg tw-px-3 tw-py-2 tw-mb-5">
          Deseja concluir mesmo assim? Você poderá corrigir as configurações após o primeiro acesso.
        </p>
        <div class="tw-flex tw-justify-between tw-gap-3">
          <BmsButton name="btn-confirm-cancel" type="button" variant="secondary" :disabled="completing" @click="showConfirm = false">
            Cancelar
          </BmsButton>
          <BmsButton name="btn-confirm-ok" type="button" variant="primary" :disabled="completing" @click="doComplete">
            Concluir
          </BmsButton>
        </div>
      </div>
    </div>
  </div>
</template>
