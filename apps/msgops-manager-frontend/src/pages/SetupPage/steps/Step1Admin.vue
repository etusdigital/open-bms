<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import { BmsTextField, BmsButton } from '../../../components';
import { setupGateway } from '../../../gateways/Setup';
import { showToast } from '../../../utils/showToast';

const emit = defineEmits<{ (e: 'step-complete', payload: { email: string; password: string }): void }>();

const schema = toTypedSchema(
  z.object({
    name: z.string().min(2, 'Nome obrigatório'),
    email: z.string().email('Email inválido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  }).refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  })
);

const { handleSubmit, isSubmitting } = useForm({
  initialValues: { name: '', email: '', password: '', confirmPassword: '' },
  validationSchema: schema,
});

const onSubmit = handleSubmit(async (values) => {
  try {
    await setupGateway.advanceStep(1, { name: values.name, email: values.email, password: values.password });
    emit('step-complete', { email: values.email, password: values.password });
  } catch (e: any) {
    showToast({ type: 'error', description: e?.response?.data?.message || 'Erro ao criar administrador.' });
  }
});
</script>

<template>
  <form @submit.prevent="onSubmit">
    <BmsTextField name="name" label="Nome completo" placeholder="João Silva" />
    <BmsTextField name="email" label="Email" type="email" placeholder="admin@empresa.com" />
    <BmsTextField name="password" label="Senha" type="password" placeholder="Mínimo 8 caracteres" />
    <BmsTextField name="confirmPassword" label="Confirmar senha" type="password" placeholder="Repita a senha" />

    <div class="tw-mt-6 tw-flex tw-justify-end">
      <BmsButton name="btn-step1" type="submit" variant="primary" :disabled="isSubmitting">
        Criar e continuar
      </BmsButton>
    </div>
  </form>
</template>
