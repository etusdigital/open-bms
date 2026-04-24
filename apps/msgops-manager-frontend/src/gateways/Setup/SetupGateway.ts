import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_MSGOPS;

const http = axios.create({ baseURL: baseUrl });

export interface SetupStatus {
  configured: boolean;
  currentStep: number;
}

export const setupGateway = {
  async getStatus(): Promise<SetupStatus> {
    const res = await http.get<SetupStatus>('/setup/status');
    return res.data;
  },

  async advanceStep(step: number, data: Record<string, unknown>): Promise<void> {
    await http.post('/setup/advance', { step, data });
  },

  async testSmtp(data: Record<string, unknown>): Promise<void> {
    await http.post('/setup/test-smtp', data);
  },
};
