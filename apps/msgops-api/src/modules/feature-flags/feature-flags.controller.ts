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
  getFlags(): FeatureFlagsDto {
    return {
      evolution_hub_enabled: this.resolver.isHubEnabled(),
    };
  }
}
