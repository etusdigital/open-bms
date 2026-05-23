import { apiClient } from '@/lib/api-client';

export type ImportScope = 'account' | 'instance';
export type ImportStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export interface ImportProgressEntry {
  total?: number;
  done?: number;
  page?: number;
  skipped?: boolean;
  reason?: string;
}

export interface ImportStatusResponse {
  jobId: string;
  accountId: number | null;
  scope: ImportScope;
  status: ImportStatus;
  enterpriseBaseUrl: string;
  progress: Record<string, ImportProgressEntry>;
  checkpoint: { entity?: string; page?: number; accountId?: number };
  selectedSteps: string[] | null;
  error: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CreateImportInput {
  accountData: { name: string; description?: string; isActive?: boolean };
  enterpriseBaseUrl: string;
  enterpriseApiKey: string;
  // Selective re-import: only these pipeline steps run (parents auto-included
  // server-side). Omit for a full import.
  selectedSteps?: string[];
}

export const importGateway = {
  async createImport(input: CreateImportInput): Promise<{ accountId: number; jobId: string }> {
    const { data } = await apiClient.post<{ accountId: number; jobId: string }>('/accounts/import', input);
    return data;
  },

  async getStatus(jobId: string, signal?: AbortSignal): Promise<ImportStatusResponse> {
    const { data } = await apiClient.get<ImportStatusResponse>(`/imports/${jobId}`, { signal });
    return data;
  },

  async resume(jobId: string, enterpriseApiKey?: string): Promise<{ jobId: string; status: string }> {
    const { data } = await apiClient.post<{ jobId: string; status: string }>(`/imports/${jobId}/resume`, enterpriseApiKey ? { enterpriseApiKey } : {});
    return data;
  },
};
