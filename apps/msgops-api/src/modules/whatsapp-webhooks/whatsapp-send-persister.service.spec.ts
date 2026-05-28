import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsappSendPersisterService } from './whatsapp-send-persister.service';
import { WhatsappMessageSendEntity } from '../../entities/whatsapp-message-send.entity';

describe('WhatsappSendPersisterService.persist', () => {
  let service: WhatsappSendPersisterService;

  const valuesRecord: any[] = [];
  const qb: any = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn((v: any) => {
      valuesRecord.push(v);
      return qb;
    }),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ identifiers: [] }),
  };
  const mockSends: any = { createQueryBuilder: jest.fn(() => qb) };

  beforeEach(async () => {
    valuesRecord.length = 0;
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhatsappSendPersisterService, { provide: getRepositoryToken(WhatsappMessageSendEntity), useValue: mockSends }],
    }).compile();
    service = module.get(WhatsappSendPersisterService);
  });

  it('UPSERTs the send mapping idempotently (orIgnore) (AC1)', async () => {
    await service.persist({
      wamid: 'wamid.OK',
      accountId: 7,
      channelId: 3,
      contactId: 42,
      messageId: 11,
      campaignId: 99,
      templateName: 'order_update',
      toNumber: '5511999990001',
      utmCampaign: 'camp_1',
      sentAt: '2026-05-28T10:00:00.000Z',
    });
    expect(qb.orIgnore).toHaveBeenCalled();
    expect(valuesRecord[0]).toMatchObject({ wamid: 'wamid.OK', accountId: 7, channelId: 3, contactId: 42, messageId: 11, campaignId: 99 });
    expect(valuesRecord[0].sentAt).toBeInstanceOf(Date);
  });

  it('normalizes to_number to E.164-without-+ on insert (F11)', async () => {
    await service.persist({
      wamid: 'wamid.OK2',
      accountId: 7,
      channelId: 3,
      contactId: 42,
      messageId: 11,
      toNumber: '+55 (11) 99999-0001',
    } as any);
    expect(valuesRecord[0].toNumber).toBe('5511999990001');
  });

  it('skips when wamid is missing', async () => {
    await service.persist({ accountId: 7, channelId: 3, contactId: 42, messageId: 11 } as any);
    expect(mockSends.createQueryBuilder).not.toHaveBeenCalled();
  });
});
