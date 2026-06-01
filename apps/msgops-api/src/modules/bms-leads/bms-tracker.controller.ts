import { Body, Controller, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactsService } from '../contacts/contacts.service';
import { RequirePermission } from '../authz/require-permission.decorator';
import { BmsTrackerDataDto } from './bms-leads.dto';

// bmstrk.js sends {data: base64(JSON(...))}. Decode defensively — a malformed
// payload yields {} rather than throwing, so a bad tracker call is a no-op.
function decodeTrackerData(data: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(data, 'base64').toString('utf8')) ?? {};
  } catch {
    return {};
  }
}

// On-page tracker (bmstrk.js) endpoints that aren't under /bms/leads:
//   POST /c       — resolve a contact by email/uuid (writes the bmsUUID cookie)
//   POST /bms/cs  — tag names for a contact (opt-in popup segmentation)
// Both authenticate via the `api-key` header (resolved by PrincipalContextGuard);
// the body is {data: base64(JSON)}. NOTE: /c is NOT under /bms, so the frontend
// nginx needs a `location = /c` proxy to msgops-api or it falls through to the SPA.
@ApiTags('bms-tracker')
@ApiBearerAuth()
@Controller()
export class BmsTrackerController {
  constructor(private readonly contactsService: ContactsService) {}

  @ApiOperation({ summary: 'Tracker: resolve a contact by email/uuid' })
  @RequirePermission('audience:contacts_view')
  @Post('c')
  @HttpCode(200)
  async resolveContact(@Body() dto: BmsTrackerDataDto): Promise<Record<string, unknown>> {
    const payload = decodeTrackerData(dto.data) as { e?: string; email?: string; u?: string; uuid?: string };
    const contact = await this.contactsService.resolveTrackerContact({
      email: payload.e || payload.email,
      uuid: payload.u || payload.uuid,
    });
    // bmstrk treats a non-200 as "not found" and retries; a known-absent contact
    // is a legitimate 404 (visitor not yet a contact), not an error.
    if (!contact) throw new HttpException('Contact not found', HttpStatus.NOT_FOUND);
    return contact;
  }

  @ApiOperation({ summary: 'Tracker: tag names for a contact (opt-in segmentation)' })
  @RequirePermission('audience:contacts_view')
  @Post('bms/cs')
  @HttpCode(200)
  async contactTags(@Body() dto: BmsTrackerDataDto): Promise<string[]> {
    const payload = decodeTrackerData(dto.data) as { i?: number; uuid?: string };
    return this.contactsService.getTrackerContactTags({ id: payload.i, uuid: payload.uuid });
  }
}
