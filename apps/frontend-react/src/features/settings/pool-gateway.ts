import { apiClient } from '@/lib/api-client';

export interface Pool {
  id: number;
  name: string;
  description?: string;
  poolName: string;
  ip: string[] | string | null;
  accountId: number;
  isDefault?: boolean;
}

export interface PoolPayload {
  name: string;
  description?: string;
  poolName: string;
  ip?: string;
  accountId?: number;
  isDefault?: boolean;
}

export const poolGateway = {
  async list(): Promise<Pool[]> {
    const res = await apiClient.get<Pool[] | { data: Pool[] }>('/pools');
    const data = res.data as any;
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async create(payload: PoolPayload): Promise<Pool> {
    const res = await apiClient.post<Pool>('/pools', payload);
    return res.data;
  },

  async update(id: number, payload: PoolPayload): Promise<Pool> {
    const res = await apiClient.put<Pool>(`/pools/${id}`, payload);
    return res.data;
  },
};
