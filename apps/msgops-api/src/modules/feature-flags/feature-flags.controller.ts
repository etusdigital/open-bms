import { Controller, Get } from '@nestjs/common';
import { PublicRoute } from '../authz/public-route.decorator';
import { WhatsappModeResolverService } from '../whatsapp-mode-resolver/whatsapp-mode-resolver.service';

export interface FeatureFlagsDto {
  /**
   * Whether this install runs WhatsApp through EvoHub (true) or talks to
   * graph.facebook.com directly (false). Drives the UI between the two
   * connect buttons. Source of truth: EVOLUTION_HUB_ENABLED env var.
   */
  evolution_hub_enabled: boolean;

  /**
   * Public Meta App identifiers (NOT secrets) that the frontend needs to
   * initialize the Facebook SDK and call FB.login with the Embedded Signup
   * config. Both are read off process.env, populated by the Super Admin →
   * WhatsApp (Meta App) tab. Empty string when not configured yet — the UI
   * uses this to surface a "configure credentials first" hint.
   */
  whatsapp_app_id: string;
  whatsapp_config_id: string;
  whatsapp_graph_version: string;
}

/**
 * Wave 3 — read-only feature flag endpoint.
 *
 * Lives at GET /feature-flags and is public (no Bearer token required) so the
 * frontend can decide which login / connect button to render before any user
 * context exists. Cache aggressively on the client side — this changes only
 * on env update + restart.
 */
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly resolver: WhatsappModeResolverService) {}

  @Get()
  @PublicRoute()
  async getFlags(): Promise<FeatureFlagsDto> {
    return {
      evolution_hub_enabled: await this.resolver.isHubEnabled(),
      whatsapp_app_id: process.env.WHATSAPP_APP_ID ?? '',
      whatsapp_config_id: process.env.WHATSAPP_CONFIG_ID ?? '',
      whatsapp_graph_version: process.env.WHATSAPP_GRAPH_VERSION ?? 'v18.0',
    };
  }
}
