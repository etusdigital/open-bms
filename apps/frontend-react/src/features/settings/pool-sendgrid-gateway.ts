import { apiClient } from '@/lib/api-client';

// SendGrid IP pool descriptor as returned by GET /v3/send_ips/pools.
// `name` is the pool's identifier on SendGrid; we send it back as
// `poolName` when persisting our local pool row.
export interface SendgridPoolOption {
  name: string;
}

// SendGrid IP descriptor as returned by GET /v3/ips. Backend already
// filters by pool name on /pools/ips/sendgrid/:poolName.
export interface SendgridIp {
  ip: string;
  pools?: string[];
  warmup?: boolean;
  start_date?: number | null;
  assigned_at?: number | null;
}

export const poolSendgridGateway = {
  // Lists IP pools that exist on the SendGrid account currently authenticated
  // (resolved server-side from the per-account `sendgrid_key`, falling back
  // to the platform-wide global key). Returns an empty array when the
  // account has no SendGrid key configured at all.
  async listPools(): Promise<SendgridPoolOption[]> {
    const res = await apiClient.get<SendgridPoolOption[] | null>('/pools/sendgrid');
    return Array.isArray(res.data) ? res.data : [];
  },

  // Lists the IPs assigned to a specific SendGrid pool. The backend filters
  // GET /v3/ips by `pools.includes(poolName)`.
  async listIpsForPool(poolName: string): Promise<SendgridIp[]> {
    const res = await apiClient.get<SendgridIp[] | null>(
      `/pools/ips/sendgrid/${encodeURIComponent(poolName)}`,
    );
    return Array.isArray(res.data) ? res.data : [];
  },
};
