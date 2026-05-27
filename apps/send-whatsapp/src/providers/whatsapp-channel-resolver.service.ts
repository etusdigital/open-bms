import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappChannelEntity } from '../entities/whatsapp-channel.entity';
import { WhatsappCloudProvider } from './whatsapp-cloud.provider';

/**
 * Wave 5 — resolves an account_id to a ready-to-send WhatsappCloudProvider.
 *
 * Same rule as msgops-api's WhatsappModeResolverService: the row carries the
 * mode and tokens, the env carries the URL bits. We do not depend on the
 * msgops-api package — the send worker only needs to read the row.
 *
 * Channel selection: per-account, only one ACTIVE channel is used at a time.
 * The wave 4 backend enforces single-channel-per-account in EvoHub mode and
 * future PRs will add a "primary channel" toggle for Meta multi-channel
 * accounts. For now, pick the most recently active one to keep behaviour
 * deterministic.
 */
@Injectable()
export class WhatsappChannelResolverService {
  private readonly logger = new Logger(WhatsappChannelResolverService.name);

  constructor(@InjectRepository(WhatsappChannelEntity) private readonly channels: Repository<WhatsappChannelEntity>) {}

  async buildProvider(accountId: number): Promise<{ provider: WhatsappCloudProvider; channel: WhatsappChannelEntity }> {
    const channel = await this.channels.findOne({
      where: { accountId, status: 'active' },
      order: { lastEventAt: 'DESC', updatedAt: 'DESC' },
    });
    if (!channel) {
      throw new NotFoundException(`No active WhatsApp channel for account ${accountId}. Connect one in Settings → WhatsApp.`);
    }
    if (!channel.phoneNumberId) {
      throw new NotFoundException(`WhatsApp channel ${channel.id} is active but missing phone_number_id — reconnect.`);
    }

    let baseUrl: string;
    let bearerToken: string | null;

    if (channel.mode === 'evohub') {
      // Hub's /meta proxy applies the API version internally; we MUST NOT
      // include /vNN.0 in the path (Meta returns 404 "Unknown path components"
      // through the proxy otherwise). Mirrors evo-ai-crm-community/lib/meta_base_url.rb.
      const hubUrl = (process.env.EVOLUTION_HUB_URL ?? 'https://api.evohub.ai').replace(/\/+$/, '');
      baseUrl = `${hubUrl}/meta`;
      bearerToken = channel.channelToken;
    } else {
      const graphVersion = process.env.WHATSAPP_GRAPH_VERSION ?? 'v18.0';
      baseUrl = `https://graph.facebook.com/${graphVersion}`;
      bearerToken = channel.accessToken;
    }

    if (!bearerToken) {
      throw new NotFoundException(`WhatsApp channel ${channel.id} is missing its ${channel.mode === 'evohub' ? 'channel_token' : 'access_token'}.`);
    }

    const provider = new WhatsappCloudProvider({
      baseUrl,
      bearerToken,
      phoneNumberId: channel.phoneNumberId,
    });

    return { provider, channel };
  }
}
