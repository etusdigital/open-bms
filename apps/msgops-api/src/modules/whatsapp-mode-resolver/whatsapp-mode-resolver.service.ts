import { Injectable } from '@nestjs/common';

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

/**
 * Wave 3 — mode resolver.
 *
 * Centralises the rule "is this install in Meta-direct or EvoHub-proxy mode?".
 * The mode is install-wide (driven by EVOLUTION_HUB_ENABLED), matching the
 * Evo CRM behaviour referenced in the spec §2.1/§2.2.
 *
 * resolveChannel() is the function the WhatsappCloudProvider (wave 5) and
 * WhatsappTemplateSyncService (wave 6) will call before sending or syncing —
 * it returns the { baseUrl, bearerToken, phoneNumberId } triple that makes
 * one provider work for both modes.
 */
@Injectable()
export class WhatsappModeResolverService {
  resolveMode(): WhatsappMode {
    return this.isHubEnabled() ? 'evohub' : 'meta';
  }

  isHubEnabled(): boolean {
    const raw = (process.env.EVOLUTION_HUB_ENABLED ?? '').toString().trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  resolveChannel(channel: ResolvableChannel): ResolvedWhatsappChannelConfig {
    const mode = this.resolveMode();

    if (channel.mode !== mode) {
      // Channel was created under a different install mode (e.g. install
      // started in meta mode, channel persisted, then EVOLUTION_HUB_ENABLED
      // flipped on). The send path should refuse the channel rather than
      // silently use mismatched credentials.
      throw new Error(`WhatsApp channel mode (${channel.mode}) does not match install mode (${mode}). Reconnect the channel under the active mode.`);
    }

    if (!channel.phoneNumberId) {
      throw new Error('WhatsApp channel is missing phone_number_id — channel is not ready to send.');
    }

    if (mode === 'evohub') {
      if (!channel.channelToken) {
        throw new Error('EvoHub channel is missing channel_token — wait for channel_connected webhook.');
      }
      // EvoHub endpoint is fixed at https://api.evohub.ai — matches HUB_API_URL
      // in evo-ai-crm-community/lib/meta_base_url.rb. EVOLUTION_HUB_URL stays
      // available as an emergency override for dev / staging Hub mocks.
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
}
