import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_MSGOPS;

const http = axios.create({ baseURL: baseUrl });

export interface SetupStatus {
  configured: boolean;
  currentStep: number;
  baseUrl?: string;
}

export interface ServiceHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface HealthCheckResult {
  postgres: ServiceHealthResult;
  redis: ServiceHealthResult;
  clickhouse: ServiceHealthResult;
  rabbitmq: ServiceHealthResult;
  s3: ServiceHealthResult;
  smtp: ServiceHealthResult;
  allOk: boolean;
}

export const setupGateway = {
  async getStatus(): Promise<SetupStatus> {
    const res = await http.get<SetupStatus>('/setup/status');
    return res.data;
  },

  async healthCheck(): Promise<HealthCheckResult> {
    const res = await http.get<HealthCheckResult>('/setup/health-check');
    return res.data;
  },

  async advanceStep(step: number, data: Record<string, unknown>): Promise<void> {
    await http.post('/setup/advance', { step, data });
  },

  async testSmtp(data: Record<string, unknown>): Promise<void> {
    await http.post('/setup/test-smtp', data);
  },

  async testSendgrid(apiKey: string): Promise<{ accountName: string | null }> {
    const res = await http.post<{ accountName: string | null }>('/setup/test-sendgrid', { apiKey });
    return res.data;
  },
};
