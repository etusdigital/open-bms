<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useForm, useField } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import { EyeOutline, EyeOffOutline, CheckmarkCircle } from '@vicons/ionicons5';
import { BmsTextField, BmsButton } from '../../../components';
import { setupGateway } from '../../../gateways/Setup';
import { showToast } from '../../../utils/showToast';

const emit = defineEmits<{ (e: 'step-complete'): void }>();

type TestResult = { accountName: string | null } | null;

const testing = ref(false);
const testResult = ref<TestResult>(null);
const showApiKey = ref(false);
const skipping = ref(false);

const schema = toTypedSchema(
  z.object({
    apiKey: z
      .string()
      .min(10, 'API Key obrigatória')
      .refine((v) => v.startsWith('SG.'), 'API Key do SendGrid começa com "SG."'),
    subuserEmail: z.string().email('Email inválido'),
    subuserPrefix: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífen')
      .optional()
      .or(z.literal('')),
    defaultIpPool: z.string().optional().or(z.literal('')),
    webhookBaseUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  }),
);

const { handleSubmit, isSubmitting } = useForm({
  initialValues: { apiKey: '', subuserEmail: '', subuserPrefix: 'bms', defaultIpPool: '', webhookBaseUrl: '' },
  validationSchema: schema,
});
const { value: apiKey } = useField<string>('apiKey');
const { value: webhookBaseUrl } = useField<string>('webhookBaseUrl');

onMounted(async () => {
  try {
    const status = await setupGateway.getStatus();
    if (status.baseUrl && !webhookBaseUrl.value) {
      webhookBaseUrl.value = `${status.baseUrl.replace(/\/$/, '')}/bms/events`;
    }
  } catch {
    // Pre-fill é best-effort; se o status falhar, usuário digita manual.
  }
});

const canAdvance = computed(() => !!testResult.value);

// Invalidate the test result whenever the key changes so we never submit a
// key that wasn't the one validated.
let lastTestedKey = '';
function onApiKeyInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  apiKey.value = value;
  if (value !== lastTestedKey) testResult.value = null;
}

async function testCredentials() {
  if (!apiKey.value || !apiKey.value.startsWith('SG.')) {
    showToast({ type: 'error', description: 'Informe uma API Key válida começando com "SG.".' });
    return;
  }
  testing.value = true;
  try {
    const res = await setupGateway.testSendgrid(apiKey.value);
    testResult.value = res;
    lastTestedKey = apiKey.value;
    const name = res.accountName ? ` (conta: ${res.accountName})` : '';
    showToast({ type: 'success', description: `Credenciais válidas${name}.` });
  } catch (e: any) {
    testResult.value = null;
    showToast({ type: 'error', description: e?.response?.data?.message || 'Falha ao validar credenciais SendGrid.' });
  } finally {
    testing.value = false;
  }
}

async function skip() {
  skipping.value = true;
  try {
    await setupGateway.advanceStep(4, { skip: true });
    emit('step-complete');
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao pular SendGrid.' });
    skipping.value = false;
  }
}

const onSubmit = handleSubmit(async (v) => {
  if (!canAdvance.value) {
    showToast({ type: 'error', description: 'Teste as credenciais antes de continuar.' });
    return;
  }
  if (v.apiKey !== lastTestedKey) {
    showToast({ type: 'error', description: 'A API Key foi alterada após o teste. Teste novamente.' });
    return;
  }
  try {
    await setupGateway.advanceStep(4, {
      apiKey: v.apiKey,
      subuserEmail: v.subuserEmail,
      ...(v.subuserPrefix && { subuserPrefix: v.subuserPrefix }),
      ...(v.defaultIpPool && { defaultIpPool: v.defaultIpPool }),
      ...(v.webhookBaseUrl && { webhookBaseUrl: v.webhookBaseUrl }),
    });
    emit('step-complete');
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao salvar configuração SendGrid.' });
  }
});
</script>

<template>
  <form @submit.prevent="onSubmit">
    <details class="tw-mb-5 tw-text-xs tw-text-gray">
      <summary class="tw-cursor-pointer tw-font-medium tw-text-primary">O que é isso e quando pular?</summary>
      <p class="tw-mt-2 tw-leading-relaxed">
        SendGrid é o motor de disparo em massa do BMS — campanhas, automações e transacionais de marketing. O SMTP do passo 2 é usado só pra
        email operacional interno (reset de senha, alertas). Se sua instância não vai disparar campanhas agora, pule esta etapa — dá pra
        configurar depois em Super Admin.
      </p>
    </details>

    <div class="tw-mb-4">
      <label for="sg-apikey" class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray">API Key SendGrid</label>
      <div class="tw-flex tw-items-center tw-gap-2">
        <div class="tw-relative tw-flex-1">
          <input
            id="sg-apikey"
            :type="showApiKey ? 'text' : 'password'"
            :value="apiKey"
            placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            autocomplete="off"
            class="tw-h-10 tw-w-full tw-rounded-lg tw-border tw-border-gray-light tw-bg-white tw-px-3 tw-pr-10 tw-text-xs tw-text-main-gray focus:tw-border-primary focus:tw-outline-none"
            @input="onApiKeyInput"
          />
          <button
            type="button"
            class="tw-absolute tw-right-2 tw-top-1/2 -tw-translate-y-1/2 tw-text-gray hover:tw-text-main-gray"
            :aria-label="showApiKey ? 'Ocultar' : 'Mostrar'"
            @click="showApiKey = !showApiKey"
          >
            <component :is="showApiKey ? EyeOffOutline : EyeOutline" class="tw-h-4 tw-w-4" />
          </button>
        </div>
        <BmsButton
          name="btn-test-sg"
          type="button"
          variant="secondary"
          :disabled="testing || !apiKey || apiKey.length < 10 || !apiKey.startsWith('SG.')"
          @click="testCredentials"
        >
          {{ testing ? 'Testando...' : 'Testar credenciais' }}
        </BmsButton>
      </div>
      <div v-if="testResult" class="tw-mt-2 tw-flex tw-items-center tw-gap-1 tw-text-xs tw-text-plus-green">
        <component :is="CheckmarkCircle" class="tw-h-4 tw-w-4" />
        <span
          >Conectado<span v-if="testResult.accountName"> — {{ testResult.accountName }}</span></span
        >
      </div>
      <p class="tw-mt-1 tw-text-xs tw-text-gray">Encontre em app.sendgrid.com → Settings → API Keys. Precisa ter permissão Full Access.</p>
    </div>

    <BmsTextField name="subuserEmail" label="Email do billing da conta SendGrid" type="email" placeholder="billing@empresa.com" />
    <p class="tw-mb-4 tw-text-xs tw-text-gray tw-mt-[-12px]">Usado como contato do owner ao provisionar sub-accounts.</p>

    <div class="tw-mb-[26px] tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-py-4 tw-shadow-md">
      <p class="tw-mb-3 tw-text-xs tw-font-bold tw-text-main-gray">Configurações avançadas (opcional)</p>
      <div class="tw-grid tw-grid-cols-2 tw-gap-4">
        <BmsTextField name="subuserPrefix" label="Prefixo de subusuários" placeholder="bms" />
        <BmsTextField name="defaultIpPool" label="IP Pool padrão" placeholder="bms-ip-pool-01" />
      </div>
      <BmsTextField name="webhookBaseUrl" label="URL do webhook" placeholder="https://app.empresa.com/bms/events" />
      <p class="tw-mt-[-12px] tw-text-xs tw-text-gray">
        Pré-preenchida com a URL base (passo 3) + /bms/events. Edite só se o BMS estiver atrás de um prefixo diferente.
      </p>
    </div>

    <div class="tw-mt-6 tw-flex tw-justify-between">
      <BmsButton name="btn-skip-sg" type="button" variant="secondary" :disabled="isSubmitting || skipping" @click="skip">
        Pular esta etapa
      </BmsButton>
      <BmsButton name="btn-step4" type="submit" variant="primary" :disabled="isSubmitting || skipping || !canAdvance">
        Salvar e continuar
      </BmsButton>
    </div>
  </form>
</template>
