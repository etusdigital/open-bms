import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { SendersService } from './senders.service';
import { SenderEntity } from '../../entities/sender.entity';
import { SendgridHandler } from '../../handlers/email/sendgrid/sendgrid.handler';

describe('SendersService', () => {
  let service: SendersService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let sendgrid: { getVerifiedSenders: jest.Mock };
  let cls: { get: jest.Mock };

  const ACCOUNT_ID = 7;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 99, ...x })),
      update: jest.fn(),
    };
    sendgrid = { getVerifiedSenders: jest.fn() };
    cls = { get: jest.fn().mockReturnValue(ACCOUNT_ID) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendersService,
        { provide: getRepositoryToken(SenderEntity), useValue: repo },
        { provide: SendgridHandler, useValue: sendgrid },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    service = module.get<SendersService>(SendersService);
  });

  describe('findOneBySenderEmail', () => {
    it('scopes by accountId', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      await service.findOneBySenderEmail('a@b.com', ACCOUNT_ID);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { senderEmail: 'a@b.com', accountId: ACCOUNT_ID } });
    });
  });

  describe('edit', () => {
    it('only mutates sendingLimit and senderReplyTo', async () => {
      const existing: any = { id: 1, accountId: ACCOUNT_ID, senderEmail: 'keep@x.com', senderName: 'Keep', sendingLimit: 10, senderReplyTo: 'old@x.com' };
      repo.findOneOrFail.mockResolvedValue(existing);
      await service.edit({ id: 1, sendingLimit: 500, senderReplyTo: 'new@x.com', senderEmail: 'HACK@x.com', senderName: 'HACK' });
      expect(existing.senderEmail).toBe('keep@x.com');
      expect(existing.senderName).toBe('Keep');
      expect(existing.sendingLimit).toBe(500);
      expect(existing.senderReplyTo).toBe('new@x.com');
    });
  });

  describe('syncFromSendgrid', () => {
    it('creates senders that do not exist locally (AC2)', async () => {
      sendgrid.getVerifiedSenders.mockResolvedValue([
        { id: 1, from_email: 'a@x.com', from_name: 'A', reply_to: 'ra@x.com' },
        { id: 2, from_email: 'b@x.com', from_name: 'B' },
        { id: 3, from_email: 'c@x.com', from_name: 'C', reply_to: null },
      ]);
      repo.find.mockResolvedValue([]);

      const result = await service.syncFromSendgrid();

      expect(result).toEqual({ created: 3, updated: 0, removed: 0 });
      expect(repo.save).toHaveBeenCalledTimes(3);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: ACCOUNT_ID, senderEmail: 'a@x.com', senderName: 'A', senderReplyTo: 'ra@x.com', sgVerifiedSenderId: '1' }),
      );
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ senderEmail: 'b@x.com', senderReplyTo: null }));
    });

    it('preserves local sendingLimit/senderReplyTo on re-sync (AC3)', async () => {
      sendgrid.getVerifiedSenders.mockResolvedValue([{ id: 1, from_email: 'a@x.com', from_name: 'A', reply_to: 'remote@x.com' }]);
      const local: any = {
        id: 1,
        accountId: ACCOUNT_ID,
        sgVerifiedSenderId: '1',
        senderEmail: 'a@x.com',
        senderName: 'A',
        sendingLimit: 500,
        senderReplyTo: 'localedited@x.com',
        removedAtSource: null,
      };
      repo.find.mockResolvedValue([local]);

      const result = await service.syncFromSendgrid();

      expect(result).toEqual({ created: 0, updated: 0, removed: 0 });
      expect(local.sendingLimit).toBe(500);
      expect(local.senderReplyTo).toBe('localedited@x.com');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('flags locals absent from SendGrid with removedAtSource, not delete (AC4)', async () => {
      sendgrid.getVerifiedSenders.mockResolvedValue([]);
      const local: any = { id: 1, accountId: ACCOUNT_ID, sgVerifiedSenderId: '1', senderEmail: 'gone@x.com', removedAtSource: null };
      repo.find.mockResolvedValue([local]);

      const result = await service.syncFromSendgrid();

      expect(result).toEqual({ created: 0, updated: 0, removed: 1 });
      expect(local.removedAtSource).toBeInstanceOf(Date);
      expect(repo.update).toHaveBeenCalledWith(1, local);
    });

    it('clears removedAtSource when a sender reappears on SendGrid', async () => {
      sendgrid.getVerifiedSenders.mockResolvedValue([{ id: 1, from_email: 'a@x.com', from_name: 'A' }]);
      const local: any = { id: 1, accountId: ACCOUNT_ID, sgVerifiedSenderId: '1', senderEmail: 'a@x.com', removedAtSource: new Date() };
      repo.find.mockResolvedValue([local]);

      const result = await service.syncFromSendgrid();

      expect(result).toEqual({ created: 0, updated: 1, removed: 0 });
      expect(local.removedAtSource).toBeNull();
    });

    it('creates 2 distinct rows for duplicate from_email and is idempotent on re-sync (AC10)', async () => {
      sendgrid.getVerifiedSenders.mockResolvedValue([
        { id: 10, from_email: 'dup@x.com', from_name: 'First' },
        { id: 11, from_email: 'dup@x.com', from_name: 'Second' },
      ]);
      repo.find.mockResolvedValueOnce([]);

      const first = await service.syncFromSendgrid();
      expect(first).toEqual({ created: 2, updated: 0, removed: 0 });

      // Re-sync: both now exist locally keyed by sgVerifiedSenderId.
      repo.save.mockClear();
      repo.find.mockResolvedValueOnce([
        { id: 1, accountId: ACCOUNT_ID, sgVerifiedSenderId: '10', senderEmail: 'dup@x.com', senderName: 'First', removedAtSource: null },
        { id: 2, accountId: ACCOUNT_ID, sgVerifiedSenderId: '11', senderEmail: 'dup@x.com', senderName: 'Second', removedAtSource: null },
      ]);
      const second = await service.syncFromSendgrid();
      expect(second).toEqual({ created: 0, updated: 0, removed: 0 });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('legacy path: one local row without sgId + 2 remotes same email → upgrade one, create the other (AC10/decision #4)', async () => {
      sendgrid.getVerifiedSenders.mockResolvedValue([
        { id: 10, from_email: 'dup@x.com', from_name: 'First' },
        { id: 11, from_email: 'dup@x.com', from_name: 'Second' },
      ]);
      const legacy: any = { id: 1, accountId: ACCOUNT_ID, sgVerifiedSenderId: null, senderEmail: 'dup@x.com', senderName: 'First', removedAtSource: null };
      repo.find.mockResolvedValue([legacy]);

      const result = await service.syncFromSendgrid();

      // r1 takes the email fallback and upgrades the legacy row's sgId;
      // r2 finds it already consumed/keyed → creates a fresh distinct row.
      expect(result).toEqual({ created: 1, updated: 1, removed: 0 });
      expect(legacy.sgVerifiedSenderId).toBe('10');
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ sgVerifiedSenderId: '11', senderEmail: 'dup@x.com' }));
    });
  });
});
