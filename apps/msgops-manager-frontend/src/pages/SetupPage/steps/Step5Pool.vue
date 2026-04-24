<script setup lang="ts">
import { ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import { BmsTextField, BmsButton } from '../../../components';
import { setupGateway } from '../../../gateways/Setup';
import { showToast } from '../../../utils/showToast';

const emit = defineEmits<{ (e: 'step-complete'): void }>();

const ips = ref<string[]>([]);
const skipping = ref(false);

const schema = toTypedSchema(
  z.object({
    accountName: z.string().min(1, 'Nome da conta obrigatório'),
    poolName: z.string().min(1, 'Nome do pool obrigatório'),
    senderEmail: z.string().email('Email inválido'),
    senderName: z.string().min(1, 'Nome obrigatório'),
    replyToEmail: z.string().email('Email inválido'),
    sendingLimit: z.string().min(1, 'Limite obrigatório'),
  })
);

const { handleSubmit, isSubmitting } = useForm({
  initialValues: { accountName: '', poolName: '', senderEmail: '', senderName: '', replyToEmail: '', sendingLimit: '1000' },
  validationSchema: schema,
});

async function skip() {
  skipping.value = true;
  try {
    await setupGateway.advanceStep(5, { skip: true });
    emit('step-complete');
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao finalizar setup.' });
    skipping.value = false;
  }
}

const onSubmit = handleSubmit(async (values) => {
  try {
    await setupGateway.advanceStep(5, { ...values, sendingLimit: Number(values.sendingLimit), ips: ips.value });
    emit('step-complete');
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao criar pool e conta.' });
  }
});
</script>

<template>
  <form @submit.prevent="onSubmit">
    <div class="tw-grid tw-grid-cols-2 tw-gap-4">
      <BmsTextField name="accountName" label="Nome da conta" placeholder="Minha Empresa" />
      <BmsTextField name="poolName" label="Nome do pool" placeholder="Pool Principal" />
    </div>
    <div class="tw-grid tw-grid-cols-2 tw-gap-4">
      <BmsTextField name="senderEmail" label="Email remetente" type="email" placeholder="noreply@empresa.com" />
      <BmsTextField name="senderName" label="Nome remetente" placeholder="Empresa" />
    </div>
    <div class="tw-grid tw-grid-cols-2 tw-gap-4">
      <BmsTextField name="replyToEmail" label="Reply-to" type="email" placeholder="contato@empresa.com" />
      <BmsTextField name="sendingLimit" label="Limite diário de envios" type="number" placeholder="1000" />
    </div>

    <div class="tw-mb-4">
      <label class="tw-mb-1 tw-block tw-text-xs tw-font-bold tw-text-main-gray">IPs do pool</label>
      <v-combobox
        v-model="ips"
        placeholder="Digite um IP e pressione Enter"
        variant="outlined"
        density="compact"
        chips
        multiple
        hide-details
        class="tw-text-xs"
      />
    </div>

    <div class="tw-mt-6 tw-flex tw-justify-between">
      <BmsButton name="btn-skip" type="button" variant="secondary" :disabled="isSubmitting || skipping" @click="skip">
        Pular esta etapa
      </BmsButton>
      <BmsButton name="btn-step4" type="submit" variant="primary" :disabled="isSubmitting || skipping">
        Salvar e finalizar
      </BmsButton>
    </div>
  </form>
</template>
