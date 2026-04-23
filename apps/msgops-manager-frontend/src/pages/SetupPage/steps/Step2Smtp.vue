<script setup lang="ts">
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import { BmsTextField, BmsButton } from '../../../components';
import { setupGateway } from '../../../gateways/Setup';
import { showToast } from '../../../utils/showToast';

const emit = defineEmits<{ (e: 'step-complete'): void }>();

const testEmail = ref('');
const testingSmtp = ref(false);

const schema = toTypedSchema(
  z.object({
    host: z.string().min(1, 'Host obrigatório'),
    port: z.string().min(1, 'Porta obrigatória'),
    user: z.string().min(1, 'Usuário obrigatório'),
    pass: z.string().min(1, 'Senha obrigatória'),
    from: z.string().email('Email inválido'),
  })
);

const { handleSubmit, isSubmitting, values } = useForm({
  initialValues: { host: '', port: '587', user: '', pass: '', from: '' },
  validationSchema: schema,
});

async function testSmtp() {
  testingSmtp.value = true;
  try {
    await setupGateway.testSmtp({ ...values, port: Number(values.port), toEmail: testEmail.value });
    showToast({ type: 'success', description: 'Email de teste enviado com sucesso!' });
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Falha ao enviar email de teste.' });
  } finally {
    testingSmtp.value = false;
  }
}

const onSubmit = handleSubmit(async (v) => {
  try {
    await setupGateway.advanceStep(2, { ...v, port: Number(v.port) });
    emit('step-complete');
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao salvar configuração SMTP.' });
  }
});
</script>

<template>
  <form @submit.prevent="onSubmit">
    <div class="tw-grid tw-grid-cols-2 tw-gap-4">
      <BmsTextField name="host" label="Host SMTP" placeholder="smtp.sendgrid.net" />
      <BmsTextField name="port" label="Porta" type="number" placeholder="587" />
    </div>
    <BmsTextField name="user" label="Usuário" placeholder="apikey" />
    <BmsTextField name="pass" label="Senha" type="password" placeholder="SG.xxxxx" />
    <BmsTextField name="from" label="Email remetente (from)" type="email" placeholder="noreply@empresa.com" />

    <div class="tw-mt-4 tw-mb-[26px] tw-rounded-2xl tw-border tw-border-gray-light tw-bg-white tw-px-5 tw-py-4 tw-shadow-md">
      <p class="tw-mb-3 tw-text-xs tw-font-bold tw-text-main-gray">Teste de envio</p>
      <div class="tw-flex tw-items-end tw-gap-3">
        <div class="tw-flex-1">
          <label class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray">Enviar teste para</label>
          <div class="tw-flex tw-w-full tw-appearance-none tw-items-center tw-rounded-lg tw-border tw-border-gray-light tw-py-2 tw-px-3 tw-shadow">
            <input
              v-model="testEmail"
              type="email"
              placeholder="teste@empresa.com"
              class="tw-w-full tw-bg-transparent tw-text-xs tw-text-main-gray focus:tw-outline-none"
            />
          </div>
        </div>
        <BmsButton name="btn-test" type="button" variant="secondary" :disabled="testingSmtp || !testEmail" @click="testSmtp">
          {{ testingSmtp ? 'Enviando...' : 'Enviar teste' }}
        </BmsButton>
      </div>
    </div>

    <div class="tw-flex tw-justify-end">
      <BmsButton name="btn-step2" type="submit" variant="primary" :disabled="isSubmitting">
        Salvar e continuar
      </BmsButton>
    </div>
  </form>
</template>
