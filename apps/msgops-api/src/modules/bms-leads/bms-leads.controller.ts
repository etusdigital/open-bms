import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactsService } from '../contacts/contacts.service';
import { ContactDto } from '../contacts/contacts.dto';
import { RequirePermission } from '../authz/require-permission.decorator';
import { BmsLeadDto, BmsLeadUpdateDto, WebPushSubscriptionDto } from './bms-leads.dto';

// Drop-in replacement for the enterprise `POST /bms/leads` endpoint used by
// the evo-academy BMS conversion pixel (see BmsLeadService in evo-academy).
// The body shape — `{ contact, apiKey, tagName }` — is fixed by that client.
//
// Auth: the api key arrives inside the body; BmsLeadsAuthMiddleware copies it
// to `x-api-key` before PrincipalContextGuard runs, so account resolution and
// CLS population use the same path as any other api-key request.
@ApiTags('bms-leads')
@ApiBearerAuth()
@Controller('bms/leads')
export class BmsLeadsController {
  constructor(private readonly contactsService: ContactsService) {}

  @ApiOperation({ summary: 'Register a lead from the evo-academy BMS pixel (upsert + tag)' })
  @RequirePermission('audience:contacts_view')
  @Post('/')
  @HttpCode(200)
  async register(@Body() dto: BmsLeadDto): Promise<{ ok: true }> {
    const payload: ContactDto = {
      email: dto.contact.email,
      firstName: dto.contact.firstName ?? '',
      lastName: dto.contact.lastName ?? '',
      // phone alone is enough for WhatsApp: ContactEntity @BeforeInsert
      // mirrors phone → whatsapp when whatsapp is empty, and send-whatsapp
      // reads contact.whatsapp as the destination. Pass through both so an
      // explicit whatsapp value (different from phone) is honored.
      phone: dto.contact.phone,
      whatsapp: dto.contact.whatsapp,
      tagNames: [dto.tagName],
      // ContactDto requires these as non-optional but they're allowed to be
      // empty strings on insert — the @BeforeInsert listener fills derived
      // columns (email_provider, hashed_email) from `email`.
      city: '',
      region: '',
      country: '',
      postal: '',
      ip: undefined as unknown as string,
      latitude: undefined as unknown as number,
      longitude: undefined as unknown as number,
      timezone: '',
    };

    const existing = await this.contactsService.findByProperty({ email: dto.contact.email });
    if (existing) {
      await this.contactsService.update(payload, existing);
    } else {
      await this.contactsService.create(payload);
    }

    // The evo-academy BmsLeadService only checks response->successful(), so
    // a minimal envelope is enough and avoids leaking contact internals to
    // an externally-configured webhook URL.
    return { ok: true };
  }

  // Web-push subscription ingestion (from web-push.js). Dedicated route so the
  // lead-pixel DTO above stays strict. Auth is the same api-key-in-body path
  // (BmsLeadsAuthMiddleware copies it to x-api-key). Creates/updates the
  // contact's web-push ContactDevice so the FCM token persists.
  @ApiOperation({ summary: 'Register a web-push subscription (token) from web-push.js' })
  @RequirePermission('audience:contacts_view')
  @Post('/web-push')
  @HttpCode(201)
  async registerWebPush(@Body() dto: WebPushSubscriptionDto): Promise<{ ok: true; deviceId: number }> {
    const device = dto.contact.devices?.[0];
    const { deviceId } = await this.contactsService.upsertWebPushDevice({
      contact: { email: dto.contact.email, uuid: dto.contact.uuid },
      device: {
        token: device.token,
        type: device.type,
        os: device.os,
        browser: device.browser,
        browserVersion: device.browserVersion,
        deviceType: device.deviceType,
        resolution: device.resolution,
        subscriptionUrl: device.subscriptionUrl,
      },
    });
    return { ok: true, deviceId };
  }

  // bmstrk.js trkEvent() → update a contact's custom fields and optionally tag it.
  // Client uses mode:'no-cors' and ignores the response, so this only needs to
  // perform the write and return a minimal envelope.
  @ApiOperation({ summary: 'Tracker: update contact custom fields / tag' })
  @RequirePermission('audience:contacts_view')
  @Post('update')
  @HttpCode(200)
  async update(@Body() dto: BmsLeadUpdateDto): Promise<{ ok: true }> {
    const existing = await this.contactsService.findByProperty({ uuid: dto.contact.uuid });
    if (existing) {
      await this.contactsService.update(
        {
          email: existing.email,
          firstName: existing.firstName ?? '',
          lastName: existing.lastName ?? '',
          phone: existing.phone,
          whatsapp: existing.whatsapp,
          tagNames: dto.tagName ? [dto.tagName] : [],
          customFields: dto.contact.customFields,
          city: '',
          region: '',
          country: '',
          postal: '',
          ip: undefined as unknown as string,
          latitude: undefined as unknown as number,
          longitude: undefined as unknown as number,
          timezone: '',
        } as ContactDto,
        existing,
      );
    }
    return { ok: true };
  }
}
