import axios, { AxiosInstance } from 'axios';
import type { ChannelCreateResult, ChannelSummary, CreateChannelInput, EvolutionHubClientOptions, HubPlan, MetaAppOption } from './types';

const DEFAULT_BASE_URL = 'https://api.evohub.ai';

export class EvolutionHubClient {
  private readonly http: AxiosInstance;

  constructor(options: EvolutionHubClientOptions) {
    if (!options.apiKey) {
      throw new Error('EvolutionHubClient requires an apiKey');
    }
    this.http = axios.create({
      baseURL: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
      timeout: options.timeoutMs ?? 15_000,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createChannel(input: CreateChannelInput): Promise<ChannelCreateResult> {
    const { data } = await this.http.post<ChannelCreateResult>('/api/v1/channels', input);
    if (!data?.id || !data?.public_link || !data?.channel_token) {
      throw new Error('EvoHub createChannel response missing required fields');
    }
    return data;
  }

  async deleteChannel(id: string): Promise<void> {
    await this.http.delete(`/api/v1/channels/${encodeURIComponent(id)}`);
  }

  async listChannels(): Promise<ChannelSummary[]> {
    const { data } = await this.http.get<ChannelSummary[]>('/api/v1/channels');
    return data ?? [];
  }

  async getChannel(id: string): Promise<ChannelSummary> {
    const { data } = await this.http.get<ChannelSummary>(`/api/v1/channels/${encodeURIComponent(id)}`);
    return data;
  }

  async getPlan(): Promise<HubPlan> {
    const { data } = await this.http.get<HubPlan>('/api/v1/plan');
    return data;
  }

  async getMetaAppOptions(): Promise<MetaAppOption[]> {
    const { data } = await this.http.get<MetaAppOption[]>('/api/v1/meta-apps');
    return data ?? [];
  }
}
