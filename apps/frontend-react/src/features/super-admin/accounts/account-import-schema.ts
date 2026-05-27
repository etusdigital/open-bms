import { z } from 'zod';

export const accountImportSchema = z.object({
  accountName: z.string().trim().min(1, 'Nome da conta é obrigatório'),
  enterpriseBaseUrl: z.string().url('Informe uma URL válida (https://...)'),
  enterpriseApiKey: z.string().min(8, 'API key deve ter pelo menos 8 caracteres'),
});

export type AccountImportFormValues = z.infer<typeof accountImportSchema>;
