<script setup lang="ts">
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import { BmsTextField, BmsButton } from '../../../components';
import { setupGateway } from '../../../gateways/Setup';
import { showToast } from '../../../utils/showToast';

const emit = defineEmits<{ (e: 'step-complete'): void }>();

const testingSmtp = ref(false);

const schema = toTypedSchema(
  z.object({
    host: z.string().min(1, 'Host obrigatório'),
    port: z.coerce.number({ invalid_type_error: 'Porta inválida' }).int('Porta deve ser inteiro').min(1, 'Porta obrigatória').max(65535, 'Porta fora do intervalo'),
    user: z.string().min(1, 'Usuário obrigatório'),
    pass: z.string().min(1, 'Senha obrigatória'),
    from: z.string().email('Email inválido'),
  })
);

const { handleSubmit, isSubmitting, values } = useForm({
  initialValues: { host: '', port: 587, user: '', pass: '', from: '' },
  validationSchema: schema,
});

async function testSmtp() {
  testingSmtp.value = true;
  try {
    await setupGateway.testSmtp({ ...values });
    showToast({ type: 'success', description: 'Email de teste enviado para o administrador cadastrado no passo 1.' });
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Falha ao enviar email de teste.' });
  } finally {
    testingSmtp.value = false;
  }
}

const onSubmit = handleSubmit(async (v) => {
  try {
    await setupGateway.advanceStep(2, v);
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
      <p class="tw-mb-1 tw-text-xs tw-font-bold tw-text-main-gray">Teste de envio</p>
      <p class="tw-mb-3 tw-text-xs tw-text-gray">
        O teste envia um email para o endereço do administrador criado no passo 1.
      </p>
      <div class="tw-flex tw-justify-end">
        <BmsButton name="btn-test" type="button" variant="secondary" :disabled="testingSmtp" @click="testSmtp">
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
