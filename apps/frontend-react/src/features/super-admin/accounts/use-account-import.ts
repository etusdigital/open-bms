import { useMutation } from '@tanstack/react-query';
import { importGateway, type CreateImportInput } from './import-gateway';

export function useAccountImport() {
  return useMutation({
    mutationFn: (input: CreateImportInput) => importGateway.createImport(input),
  });
}

export function useResumeImport() {
  return useMutation({
    mutationFn: ({ jobId, apiKey }: { jobId: string; apiKey?: string }) => importGateway.resume(jobId, apiKey),
  });
}
