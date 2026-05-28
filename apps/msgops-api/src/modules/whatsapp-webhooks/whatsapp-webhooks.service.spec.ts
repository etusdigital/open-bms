import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsappWebhooksService } from './whatsapp-webhooks.service';
import { RedisService } from '../../providers/redis.provider';
import { EventPublisherService } from '../../providers/messaging/event-publisher.service';
import { WhatsappChannelEntity } from '../../entities/whatsapp-channel.entity';
import { MessageEntity } from '../../entities/message.entity';
import { ContactEntity } from '../../entities/contact.entity';
import { WhatsappMessageSendEntity } from '../../entities/whatsapp-message-send.entity';
import { WhatsappInboundMessageEntity } from '../../entities/whatsapp-inbound-message.entity';

import statusesFixture from '../../../test/fixtures/meta-webhook-statuses.json';
import inboundFixture from '../../../test/fixtures/meta-webhook-inbound.json';

// Chainable query-builder mock that records each .set()/.values() and the
// executed .where(sql, params) args so assertions can inspect the raw
// UPDATE/INSERT (F13: verify the `() => 'NOW()'` update hits the right row).
// `record.rejectExecute` lets a test force the next .execute() to throw, to
// exercise the PG-failure path (F1).
function makeQueryBuilder(record: { sets: any[]; values: any[]; wheres?: any[]; rejectExecute?: boolean }) {
  record.wheres = record.wheres ?? [];
  const qb: any = {
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    set: jest.fn((v: any) => {
      record.sets.push(v);
      return qb;
    }),
    values: jest.fn((v: any) => {
      record.values.push(v);
      return qb;
    }),
    orIgnore: jest.fn().mockReturnThis(),
    where: jest.fn((sql: any, params: any) => {
      record.wheres!.push({ sql, params });
      return qb;
    }),
    execute: jest.fn(async () => {
      if (record.rejectExecute) throw new Error('pg_write_failed');
      return { affected: 1 };
    }),
  };
  return qb;
}

describe('WhatsappWebhooksService — status + inbound handlers', () => {
  let service: WhatsappWebhooksService;

  // Status dedup is now a READ (exists) up-front + a WRITE (set) only after the
  // PG write succeeds (F1). The mock exposes both; `redisExistsResult` drives
  // the duplicate fast-path, `redisSet` records the post-write commit.
  let redisExistsResult: number; // 1 = key already set (duplicate)
  const redisExists = jest.fn(async () => redisExistsResult);
  const redisSet = jest.fn(async () => 'OK');
  const redisDel = jest.fn(async () => 1);
  const mockRedis = { getClient: () => ({ exists: redisExists, set: redisSet, del: redisDel }) };

  const mockPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  // repo records
  const sendsRecord = { sets: [] as any[], values: [] as any[], wheres: [] as any[], rejectExecute: false };
  const contactsRecord = { sets: [] as any[], values: [] as any[], wheres: [] as any[], rejectExecute: false };
  const inboundRecord = { sets: [] as any[], values: [] as any[], wheres: [] as any[], rejectExecute: false };

  const mockSends: any = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => makeQueryBuilder(sendsRecord)),
  };
  const mockContacts: any = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => makeQueryBuilder(contactsRecord)),
  };
  const mockInbound: any = {
    createQueryBuilder: jest.fn(() => makeQueryBuilder(inboundRecord)),
  };
  const mockChannels: any = { findOne: jest.fn() };
  const mockMessages: any = { createQueryBuilder: jest.fn(() => makeQueryBuilder({ sets: [], values: [] })) };

  beforeEach(async () => {
    redisExistsResult = 0; // not a duplicate by default
    for (const r of [sendsRecord, contactsRecord, inboundRecord]) {
      r.sets.length = 0;
      r.values.length = 0;
      r.wheres.length = 0;
      r.rejectExecute = false;
    }
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappWebhooksService,
        { provide: getRepositoryToken(WhatsappChannelEntity), useValue: mockChannels },
        { provide: getRepositoryToken(MessageEntity), useValue: mockMessages },
        { provide: getRepositoryToken(ContactEntity), useValue: mockContacts },
        { provide: getRepositoryToken(WhatsappMessageSendEntity), useValue: mockSends },
        { provide: getRepositoryToken(WhatsappInboundMessageEntity), useValue: mockInbound },
        { provide: RedisService, useValue: mockRedis },
        { provide: EventPublisherService, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get(WhatsappWebhooksService);
  });

  const knownSend = {
    wamid: 'wamid.X',
    accountId: 7,
    channelId: 3,
    contactId: 42,
    messageId: 11,
    campaignId: 99,
    automationId: null,
    utmCampaign: 'camp_1',
  };

  describe('applyStatusEvent', () => {
    it('delivered: updates send + contact and publishes (AC2)', async () => {
      mockSends.findOne.mockResolvedValueOnce({ ...knownSend });
      await service.applyStatusEvent({ id: 'wamid.X', status: 'delivered', timestamp: '1716800000' }, { phone_number_id: 'P1' });

      expect(sendsRecord.sets[0]).toHaveProperty('deliveredAt');
      // F13: the raw NOW() UPDATE targets the right row — set deliveredAt where
      // wamid = the event's wamid (not some other row/column).
      expect(sendsRecord.sets[0].deliveredAt).toBeInstanceOf(Function); // () => 'NOW()'
      expect(sendsRecord.wheres[0]).toEqual({ sql: 'wamid = :wamid', params: { wamid: 'wamid.X' } });
      // contact whatsapp_last_delivered updated via raw query
      expect(contactsRecord.sets[0]).toHaveProperty('whatsappLastDelivered');
      expect(contactsRecord.wheres[0]).toEqual({ sql: 'id = :id', params: { id: 42 } });
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'bms.events',
        'event.received.whatsapp',
        expect.objectContaining({ event: 'delivered', wamid: 'wamid.X', accountId: 7, contactId: 42, campaignId: 99 }),
      );
      // F1: dedup key committed only AFTER the PG write succeeded.
      expect(redisSet).toHaveBeenCalledWith('wa:webhook:status:wamid.X:delivered', '1', 'EX', expect.any(Number));
    });

    it('read: maps to whatsappLastOpen and publishes event=read (AC3)', async () => {
      mockSends.findOne.mockResolvedValueOnce({ ...knownSend });
      await service.applyStatusEvent({ id: 'wamid.X', status: 'read', timestamp: '1716800100' }, { phone_number_id: 'P1' });
      expect(sendsRecord.sets[0]).toHaveProperty('readAt');
      expect(contactsRecord.sets[0]).toHaveProperty('whatsappLastOpen');
      expect(mockPublisher.publish).toHaveBeenCalledWith('bms.events', 'event.received.whatsapp', expect.objectContaining({ event: 'read' }));
    });

    it('failed code 131026: flips has_whatsapp=false (AC4)', async () => {
      mockSends.findOne.mockResolvedValueOnce({ ...knownSend });
      await service.applyStatusEvent(
        { id: 'wamid.X', status: 'failed', timestamp: '1716800200', errors: [{ code: 131026, title: 'Message undeliverable' }] },
        { phone_number_id: 'P1' },
      );
      // failure fields written on the send
      expect(sendsRecord.sets[0]).toHaveProperty('failureCode');
      // contact flipped — one of the contact UPDATEs sets hasWhatsapp:false
      expect(contactsRecord.sets.some((s) => s.hasWhatsapp === false)).toBe(true);
      expect(mockPublisher.publish).toHaveBeenCalledWith('bms.events', 'event.received.whatsapp', expect.objectContaining({ event: 'failed', errorCode: 131026 }));
    });

    it('failed code 131000: does NOT flip has_whatsapp (AC5)', async () => {
      mockSends.findOne.mockResolvedValueOnce({ ...knownSend });
      await service.applyStatusEvent({ id: 'wamid.X', status: 'failed', timestamp: '1716800200', errors: [{ code: 131000, title: 'Generic' }] }, { phone_number_id: 'P1' });
      expect(sendsRecord.sets[0]).toHaveProperty('failedAt');
      expect(contactsRecord.sets.some((s) => s.hasWhatsapp === false)).toBe(false);
    });

    it('unknown wamid: no contact update, publishes with account only (AC10)', async () => {
      mockSends.findOne.mockResolvedValueOnce(null);
      mockChannels.findOne.mockResolvedValueOnce({ id: 3, accountId: 7 });
      await service.applyStatusEvent({ id: 'wamid.UNKNOWN', status: 'delivered', timestamp: '1716800000' }, { phone_number_id: 'P1' });

      expect(contactsRecord.sets.length).toBe(0);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'bms.events',
        'event.received.whatsapp',
        expect.objectContaining({ event: 'delivered', wamid: 'wamid.UNKNOWN', accountId: 7, contactId: undefined }),
      );
    });

    it('dedup: a duplicate (wamid,status) is a no-op (AC8)', async () => {
      redisExistsResult = 1; // key already set → duplicate
      await service.applyStatusEvent({ id: 'wamid.X', status: 'delivered', timestamp: '1' }, { phone_number_id: 'P1' });
      expect(mockSends.findOne).not.toHaveBeenCalled();
      expect(mockPublisher.publish).not.toHaveBeenCalled();
      expect(redisSet).not.toHaveBeenCalled();
    });

    it('F1: PG write throws → dedup key NOT set → a second call reprocesses', async () => {
      // First call: the delivered UPDATE on `sends` rejects (simulated PG error).
      mockSends.findOne.mockResolvedValueOnce({ ...knownSend });
      sendsRecord.rejectExecute = true;
      await expect(service.applyStatusEvent({ id: 'wamid.X', status: 'delivered', timestamp: '1716800000' }, { phone_number_id: 'P1' })).rejects.toThrow('pg_write_failed');
      // Critical: the dedup key was NEVER committed (it would suppress the retry).
      expect(redisSet).not.toHaveBeenCalled();

      // Second call (Meta retry): not a duplicate (exists still 0), PG now OK →
      // it reprocesses end-to-end and finally commits the dedup key.
      sendsRecord.rejectExecute = false;
      mockSends.findOne.mockResolvedValueOnce({ ...knownSend });
      await service.applyStatusEvent({ id: 'wamid.X', status: 'delivered', timestamp: '1716800000' }, { phone_number_id: 'P1' });
      expect(mockSends.findOne).toHaveBeenCalledTimes(2); // re-looked up, i.e. reprocessed
      expect(redisSet).toHaveBeenCalledWith('wa:webhook:status:wamid.X:delivered', '1', 'EX', expect.any(Number));
      expect(mockPublisher.publish).toHaveBeenCalledWith('bms.events', 'event.received.whatsapp', expect.objectContaining({ event: 'delivered' }));
    });

    it('F2: unknown wamid does NOT set the dedup key (so a retry can reconcile)', async () => {
      mockSends.findOne.mockResolvedValueOnce(null);
      mockChannels.findOne.mockResolvedValueOnce({ id: 3, accountId: 7 });
      await service.applyStatusEvent({ id: 'wamid.UNKNOWN', status: 'delivered', timestamp: '1716800000' }, { phone_number_id: 'P1' });
      expect(redisSet).not.toHaveBeenCalled();
    });
  });

  describe('applyInboundMessage', () => {
    it('persists with resolved contact_id and publishes inbound (AC6)', async () => {
      mockChannels.findOne.mockResolvedValueOnce({ id: 3, accountId: 7 });
      mockContacts.findOne.mockResolvedValueOnce({ id: 42 });
      await service.applyInboundMessage(
        { from: '5574999999999', id: 'wamid.IN1', type: 'text', text: { body: 'Olá!' }, context: { id: 'wamid.OUT1' }, timestamp: '1716800300' },
        { phone_number_id: 'P1' },
      );
      const inserted = inboundRecord.values[0];
      expect(inserted).toMatchObject({ wamid: 'wamid.IN1', contactId: 42, textBody: 'Olá!', contextWamid: 'wamid.OUT1', fromNumber: '5574999999999' });
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'bms.events',
        'event.received.whatsapp.inbound',
        expect.objectContaining({ event: 'inbound', wamid: 'wamid.IN1', contactId: 42 }),
      );
    });

    it('persists with contact_id=NULL when sender is unknown (AC7)', async () => {
      mockChannels.findOne.mockResolvedValueOnce({ id: 3, accountId: 7 });
      mockContacts.findOne.mockResolvedValueOnce(null);
      await service.applyInboundMessage({ from: '5500000000000', id: 'wamid.IN2', type: 'text', text: { body: 'hi' }, timestamp: '1716800300' }, { phone_number_id: 'P1' });
      const inserted = inboundRecord.values[0];
      expect(inserted.contactId).toBeNull();
      expect(inserted.fromNumber).toBe('5500000000000');
      expect(inserted.rawPayload).toBeDefined();
    });
  });

  describe('processMetaEvent routing', () => {
    it('routes each status in the statuses fixture to applyStatusEvent', async () => {
      const spy = jest.spyOn(service, 'applyStatusEvent').mockResolvedValue(undefined);
      await service.processMetaEvent(statusesFixture);
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy.mock.calls.map((c) => (c[0] as any).status)).toEqual(['delivered', 'read', 'failed']);
    });

    it('routes the inbound fixture message to applyInboundMessage', async () => {
      const spy = jest.spyOn(service, 'applyInboundMessage').mockResolvedValue(undefined);
      await service.processMetaEvent(inboundFixture);
      expect(spy).toHaveBeenCalledTimes(1);
      expect((spy.mock.calls[0][0] as any).id).toBe('wamid.IN1');
    });
  });
});
