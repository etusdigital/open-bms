import { HttpException } from '@nestjs/common';
import { BmsTrackerController } from './bms-tracker.controller';
import type { ContactsService } from '../contacts/contacts.service';

// The tracker (bmstrk.js) POSTs {data: base64(JSON(...))}. These tests pin the
// decode + the mapping to ContactsService, including the 404-on-unknown contract
// that bmstrk relies on (non-200 = "not found, retry/anonymous").

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');

function build(svc: Partial<Record<keyof ContactsService, jest.Mock>> = {}) {
  const contactsService = {
    resolveTrackerContact: jest.fn(),
    getTrackerContactTags: jest.fn(),
    ...svc,
  } as unknown as ContactsService;
  return { controller: new BmsTrackerController(contactsService), contactsService };
}

describe('BmsTrackerController', () => {
  afterEach(() => jest.clearAllMocks());

  describe('POST /c — resolveContact', () => {
    it('decodes {data} and resolves the contact by email', async () => {
      const resolveTrackerContact = jest.fn().mockResolvedValue({ uuid: 'u-1', email: 'a@b.com' });
      const { controller, contactsService } = build({ resolveTrackerContact });

      const out = await controller.resolveContact({ data: b64({ e: 'a@b.com' }) });

      expect(contactsService.resolveTrackerContact).toHaveBeenCalledWith({ email: 'a@b.com', uuid: undefined });
      expect(out).toEqual({ uuid: 'u-1', email: 'a@b.com' });
    });

    it('resolves by uuid (u field)', async () => {
      const resolveTrackerContact = jest.fn().mockResolvedValue({ uuid: 'u-9' });
      const { controller, contactsService } = build({ resolveTrackerContact });

      await controller.resolveContact({ data: b64({ u: 'u-9' }) });

      expect(contactsService.resolveTrackerContact).toHaveBeenCalledWith({ email: undefined, uuid: 'u-9' });
    });

    it('throws 404 when the contact is unknown (bmstrk treats non-200 as not-found)', async () => {
      const { controller } = build({ resolveTrackerContact: jest.fn().mockResolvedValue(null) });
      await expect(controller.resolveContact({ data: b64({ e: 'nobody@x.com' }) })).rejects.toBeInstanceOf(HttpException);
    });

    it('treats malformed base64 as an empty query → 404', async () => {
      const { controller, contactsService } = build({ resolveTrackerContact: jest.fn().mockResolvedValue(null) });
      await expect(controller.resolveContact({ data: 'not-valid-base64-!!!' })).rejects.toBeInstanceOf(HttpException);
      // decode failed → {} → resolveTrackerContact called with undefined/undefined
      expect(contactsService.resolveTrackerContact).toHaveBeenCalledWith({ email: undefined, uuid: undefined });
    });
  });

  describe('POST /bms/cs — contactTags', () => {
    it('decodes {data:{i}} and returns the tag names', async () => {
      const getTrackerContactTags = jest.fn().mockResolvedValue(['vip', 'newsletter']);
      const { controller, contactsService } = build({ getTrackerContactTags });

      const out = await controller.contactTags({ data: b64({ i: 55 }) });

      expect(contactsService.getTrackerContactTags).toHaveBeenCalledWith({ id: 55, uuid: undefined });
      expect(out).toEqual(['vip', 'newsletter']);
    });
  });
});
