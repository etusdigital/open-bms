import { Injectable } from '@nestjs/common';
import { SystemConfigCacheProvider } from '../../providers/system-config-cache.provider';

export type WhatsappMode = 'meta' | 'evohub';

export interface ResolvedWhatsappChannelConfig {
  mode: WhatsappMode;
  baseUrl: string;
  bearerToken: string;
  phoneNumberId: string;
}

/**
 * Minimal channel shape the resolver needs. The real WhatsappChannel entity
 * (packages/database) carries more fields; this interface keeps the resolver
 * decoupled from TypeORM while still typing the call sites in waves 4-6.
 */
export interface ResolvableChannel {
  mode: WhatsappMode;
  phoneNumberId: string | null;
  accessToken: string | null;
  channelToken: string | null;
}

interface HubSystemSettings {
  enabled?: boolean;
  apiKey?: string;
  webhookSecret?: string;
}

const HUB_KEY = 'whatsapp_hub_system_settings';

/**
 * Wave 3 — mode resolver (Wave 7.8 hardening).
 *
 * Source of truth for "is this install in Meta-direct or EvoHub-proxy mode?"
 * is the `system_config` row written by Super Admin → WhatsApp (EvoHub).
 * We read through the SystemConfigCacheProvider (Redis, 60s TTL, invalidated
 * on save) so flipping the toggle in the admin UI reflects in seconds without
 * a process restart.
 *
 * Falls back to process.env.EVOLUTION_HUB_ENABLED only when the DB row
 * has not been populated yet — useful for fresh installs.
 */
@Injectable()
export class WhatsappModeResolverService {
  constructor(private readonly cache: SystemConfigCacheProvider) {}

  async resolveMode(): Promise<WhatsappMode> {
    return (await this.isHubEnabled()) ? 'evohub' : 'meta';
  }

  async isHubEnabled(): Promise<boolean> {
    const cfg = await this.cache.get<HubSystemSettings>(HUB_KEY);
    if (cfg && typeof cfg.enabled === 'boolean') return cfg.enabled;
    return this.readEnvFlag();
  }

  /** Synchronous env-only check — used by callers that cannot await (e.g. controllers in setup paths). */
  isHubEnabledFromEnv(): boolean {
    return this.readEnvFlag();
  }

  async resolveChannel(channel: ResolvableChannel): Promise<ResolvedWhatsappChannelConfig> {
    const mode = await this.resolveMode();

    if (channel.mode !== mode) {
      // Channel was created under a different install mode (e.g. install
      // started in meta mode, channel persisted, then EvoHub got enabled).
      // Refuse the channel rather than silently use mismatched credentials.
      throw new Error(`WhatsApp channel mode (${channel.mode}) does not match install mode (${mode}). Reconnect the channel under the active mode.`);
    }

    if (!channel.phoneNumberId) {
      throw new Error('WhatsApp channel is missing phone_number_id — channel is not ready to send.');
    }

    if (mode === 'evohub') {
      if (!channel.channelToken) {
        throw new Error('EvoHub channel is missing channel_token — wait for channel_connected webhook.');
      }
      const hubUrl = (process.env.EVOLUTION_HUB_URL ?? 'https://api.evohub.ai').replace(/\/+$/, '');
      const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v18.0';
      return {
        mode,
        baseUrl: `${hubUrl}/meta/${graphVersion}`,
        bearerToken: channel.channelToken,
        phoneNumberId: channel.phoneNumberId,
      };
    }

    // mode === 'meta'
    if (!channel.accessToken) {
      throw new Error('Meta channel is missing access_token — finish FB.login + code→token exchange.');
    }
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v18.0';
    return {
      mode,
      baseUrl: `https://graph.facebook.com/${graphVersion}`,
      bearerToken: channel.accessToken,
      phoneNumberId: channel.phoneNumberId,
    };
  }

  private readEnvFlag(): boolean {
    const raw = (process.env.EVOLUTION_HUB_ENABLED ?? '').toString().trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }
}
