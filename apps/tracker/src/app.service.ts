import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MsgopsService } from './msgops/msgops.service';
import { EventPublisherService } from './event-publisher.service';
import { ClsService } from 'nestjs-cls';
import * as crypto from 'crypto';
import { TrackerRedirectRequest } from './interfaces/tracker-redirect-event.interface';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly eventPublisher: EventPublisherService,
    private readonly msgopsService: MsgopsService,
    private readonly cls: ClsService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async processShortLink(shortCode: string, ipAddress: string, response, headers: any) {
    const longUrl = await this.msgopsService.findLongUrl(shortCode);
    if (!longUrl) {
      throw new NotFoundException();
    }

    const url = new URL(longUrl);
    const objectParams = Object.fromEntries(url.searchParams);

    const domain = url.hostname.split('.');
    const rootDomain = domain
      .slice(0)
      .slice(-(domain.length === 4 ? 3 : 2))
      .join('.');

    response.cookie('bmsUUID', `${objectParams.uuid}`, { domain: `.${rootDomain}`, path: '/', secure: true });

    const payloadEvent = {
      categories: { ...objectParams, utmcampaign: objectParams.utm_campaign },
      payload: { event: 'click', ip: ipAddress, url: `${url.origin}${url.pathname}`, headers: headers, eventID: crypto.randomUUID() },
    };

    await this.eventPublisher.publish(payloadEvent, {
      platform: 'twilio',
      message_type: objectParams.message_type,
    });

    const deleteKeys = new Set([
      'platform',
      'message_type',
      'type',
      'uuid',
      'account',
      'id',
      'message',
      'campaign_type',
      'campaign',
      'domain',
      'contactId',
      'automation',
      'automationName',
      'automationType',
    ]);

    for (const key in objectParams) {
      if (deleteKeys.has(key)) {
        url.searchParams.delete(key);
      }
    }

    return response.redirect(302, url.toString());
  }

  async publishRedirectClick(params: { bmsUUID: string; accountId: string; decodedUrl: string; ip?: string; userAgent?: string }): Promise<void> {
    if (process.env.ENABLE_TRACKER_REDIRECT_EVENT !== 'true') {
      return;
    }

    const body: TrackerRedirectRequest = {
      platform: 'internal',
      payload: [
        {
          event: 'tracker-redirect',
          schemaVersion: 1,
          timestamp: Date.now(),
          accountId: params.accountId,
          uuid: params.bmsUUID,
          url: params.decodedUrl,
          ip: params.ip,
          userAgent: params.userAgent,
        },
      ],
    };

    try {
      await this.eventPublisher.publish(body, {
        platform: 'internal',
        message_type: 'tracker-redirect',
      });
    } catch (err) {
      this.logger.error(`tracker-redirect publish failed (accountId=${params.accountId}, uuid=${params.bmsUUID}): ${err}`);
    }
  }

  async findContactsByEmail(email: string, options?: string[]) {
    try {
      if (!email) {
        throw new NotFoundException();
      }

      return this.msgopsService.contactByEmail(this.cls.get('accountId'), email, options);
    } catch {
      throw new NotFoundException();
    }
  }
}
