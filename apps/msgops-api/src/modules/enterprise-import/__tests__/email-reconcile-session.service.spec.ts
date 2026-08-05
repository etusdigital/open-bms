import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EmailReconcileSessionService } from '../email-reconcile-session.service';
import { EmailReconcileService } from '../email-reconcile.service';
import { EnterpriseImportJobEntity } from '../../../entities/enterprise-import-job.entity';
import { EmailReconcileItemEntity } from '../../../entities/email-reconcile-item.entity';
import { EmailReconcileSessionEntity } from '../../../entities/email-reconcile-session.entity';
import { ContactEntity } from '../../../entities/contact.entity';

/**
 * Persisted reconcile session — the batched flow the operator actually drives:
 * create the working set once, apply auto matches in chunks, resolve the
 * ambiguous queue, and settle addresses that turn out to be already taken.
 *
 * The invariants under test are the ones that cost real data if they break:
 * the working set is replaced atomically, an address in use never silently
 * consumes an item (it becomes a reviewable conflict, not a failure), and every
 * contact write goes through save() so the BeforeUpdate listener re-derives
 * hashed_email.
 */
describe('EmailReconcileSessionService', () => {
  let service: EmailReconcileSessionService;
  let reconcileService: { computeReconciliation: jest.Mock };
  let contactsRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let jobsRepo: { findOne: jest.Mock };
  let sessionsRepo: { findOne: jest.Mock; delete: jest.Mock; insert: jest.Mock; manager: { transaction: jest.Mock } };
  let itemsRepo: { find: jest.Mock; count: jest.Mock; update: jest.Mock; insert: jest.Mock; createQueryBuilder: jest.Mock };
  let entityManager: { delete: jest.Mock; insert: jest.Mock };

  const emptyComputation = {
    csvRows: 0,
    invalidCsvRows: 0,
    contactsMasked: 0,
    alreadyClean: 0,
    matches: [] as any[],
    ambiguous: [] as any[],
    noMatches: [] as any[],
  };

  // Query builder stub covering every chain the service uses. Callers override
  // the terminal method they care about.
  const makeQB = (overrides: Record<string, unknown> = {}) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  });

  beforeEach(async () => {
    reconcileService = { computeReconciliation: jest.fn().mockResolvedValue({ ...emptyComputation }) };
    contactsRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((partial) => partial),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };
    jobsRepo = { findOne: jest.fn().mockResolvedValue({ id: 'job-1', accountId: 7 }) };
    entityManager = { delete: jest.fn().mockResolvedValue({ affected: 1 }), insert: jest.fn().mockResolvedValue({}) };
    sessionsRepo = {
      findOne: jest.fn().mockResolvedValue({
        jobId: 'job-1',
        accountId: 7,
        csvRows: 3,
        invalidCsvRows: 0,
        contactsMasked: 3,
        alreadyClean: 0,
        noMatchTotal: 0,
        noMatchSample: [],
        createdAt: new Date('2026-07-13T10:00:00Z'),
        updatedAt: new Date('2026-07-13T10:00:00Z'),
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({}),
      manager: { transaction: jest.fn(async (cb: any) => cb(entityManager)) },
    };
    itemsRepo = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      insert: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn(() => makeQB()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailReconcileSessionService,
        { provide: EmailReconcileService, useValue: reconcileService },
        { provide: getRepositoryToken(ContactEntity), useValue: contactsRepo },
        { provide: getRepositoryToken(EnterpriseImportJobEntity), useValue: jobsRepo },
        { provide: getRepositoryToken(EmailReconcileSessionEntity), useValue: sessionsRepo },
        { provide: getRepositoryToken(EmailReconcileItemEntity), useValue: itemsRepo },
      ],
    }).compile();

    service = module.get(EmailReconcileSessionService);
  });

  const insertedItems = () => entityManager.insert.mock.calls.filter((call) => call[0] === EmailReconcileItemEntity).flatMap((call) => call[1] as Array<Record<string, any>>);

  describe('createSession', () => {
    it('persists one item per matched contact, typed by kind', async () => {
      reconcileService.computeReconciliation.mockResolvedValue({
        ...emptyComputation,
        csvRows: 2,
        contactsMasked: 2,
        matches: [{ contactId: 10, currentEmail: 'lucas***@gmail.com', newEmail: 'lucassilva@gmail.com', csvRowNumber: 1, contactName: 'Lucas Silva' }],
        ambiguous: [
          {
            contactId: 11,
            currentEmail: 'maria***@gmail.com',
            contactName: 'Maria Souza',
            candidates: [{ csvRowNumber: 2, csvName: 'Maria Souza', csvEmail: 'mariasouza@gmail.com', score: 1, timeMatch: 2 }],
            candidatesTotal: 1,
          },
        ],
      });

      await service.createSession('job-1', 'csv');

      const items = insertedItems();
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ contactId: 10, kind: 'auto', status: 'pending', newEmail: 'lucassilva@gmail.com' });
      expect(items[1]).toMatchObject({ contactId: 11, kind: 'ambiguous', status: 'pending', candidatesTotal: 1 });
    });

    it('replaces the previous working set inside a single transaction', async () => {
      // An interrupted rewrite used to leave a session header with partial
      // items — a truncated reconciliation that reads as a complete one.
      await service.createSession('job-1', 'csv');

      expect(sessionsRepo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(sessionsRepo.delete).not.toHaveBeenCalled();
      expect(entityManager.delete).toHaveBeenCalledWith(EmailReconcileSessionEntity, { jobId: 'job-1' });
      const deleteOrder = entityManager.delete.mock.invocationCallOrder[0];
      const insertOrder = entityManager.insert.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(insertOrder);
    });

    it('propagates a failed rewrite instead of leaving a half-written session', async () => {
      reconcileService.computeReconciliation.mockResolvedValue({
        ...emptyComputation,
        matches: [{ contactId: 10, currentEmail: 'lucas***@gmail.com', newEmail: 'lucassilva@gmail.com', csvRowNumber: 1, contactName: 'Lucas Silva' }],
      });
      entityManager.insert.mockImplementation((entity: unknown) => {
        if (entity === EmailReconcileItemEntity) return Promise.reject(new Error('connection lost'));
        return Promise.resolve({});
      });

      await expect(service.createSession('job-1', 'csv')).rejects.toThrow('connection lost');
    });

    it('marks an auto pick whose address is already taken as a conflict up front', async () => {
      reconcileService.computeReconciliation.mockResolvedValue({
        ...emptyComputation,
        matches: [
          { contactId: 10, currentEmail: 'lucas***@gmail.com', newEmail: 'lucassilva@gmail.com', csvRowNumber: 1, contactName: 'Lucas Silva' },
          { contactId: 11, currentEmail: 'maria***@gmail.com', newEmail: 'mariasouza@gmail.com', csvRowNumber: 2, contactName: 'Maria Souza' },
        ],
      });
      // A clean contact already owns the first address.
      contactsRepo.find.mockResolvedValue([{ id: 99, email: 'lucassilva@gmail.com' }]);

      await service.createSession('job-1', 'csv');

      const items = insertedItems();
      expect(items[0]).toMatchObject({ contactId: 10, status: 'conflict', failureReason: 'email already in use by contact #99' });
      expect(items[1]).toMatchObject({ contactId: 11, status: 'pending', failureReason: null });
    });
  });

  describe('applyAutoChunk', () => {
    const pendingItem = { id: '1', contactId: 10, newEmail: 'lucassilva@gmail.com', csvRowNumber: 1, kind: 'auto', status: 'pending' };

    it('writes through save() so the BeforeUpdate listener re-derives hashed_email', async () => {
      // repo.update() skips entity listeners and would leave hashed_email and
      // email_provider pointing at the masked address, breaking the SHA-256
      // contact lookup downstream.
      itemsRepo.find.mockResolvedValue([{ ...pendingItem }]);

      const result = await service.applyAutoChunk('job-1', 100);

      expect(contactsRepo.save).toHaveBeenCalledWith({ id: 10, email: 'lucassilva@gmail.com' });
      expect(itemsRepo.update).toHaveBeenCalledWith({ id: '1' }, { status: 'applied', newEmail: 'lucassilva@gmail.com', csvRowNumber: 1 });
      expect(result).toMatchObject({ applied: 1, failed: 0, conflicts: 0 });
    });

    it('parks an address already in use as a conflict, not as a failure', async () => {
      itemsRepo.find.mockResolvedValue([{ ...pendingItem }]);
      contactsRepo.findOne.mockResolvedValue({ id: 42, email: 'lucassilva@gmail.com' });

      const result = await service.applyAutoChunk('job-1', 100);

      expect(contactsRepo.save).not.toHaveBeenCalled();
      expect(itemsRepo.update).toHaveBeenCalledWith(
        { id: '1' },
        { status: 'conflict', failureReason: 'email already in use by contact #42', newEmail: 'lucassilva@gmail.com', csvRowNumber: 1 },
      );
      expect(result).toMatchObject({ applied: 0, failed: 0, conflicts: 1 });
    });

    it('keeps a genuine write error as a failure', async () => {
      itemsRepo.find.mockResolvedValue([{ ...pendingItem }]);
      contactsRepo.save.mockRejectedValue(new Error('deadlock detected'));

      const result = await service.applyAutoChunk('job-1', 100);

      expect(itemsRepo.update).toHaveBeenCalledWith({ id: '1' }, { status: 'failed', failureReason: 'deadlock detected' });
      expect(result).toMatchObject({ applied: 0, failed: 1, conflicts: 0 });
    });

    it('leaves conflicts out of the pending set so the client loop terminates', async () => {
      itemsRepo.find.mockResolvedValue([{ ...pendingItem }]);
      contactsRepo.findOne.mockResolvedValue({ id: 42, email: 'lucassilva@gmail.com' });
      itemsRepo.count.mockResolvedValue(0);

      const result = await service.applyAutoChunk('job-1', 100);

      expect(itemsRepo.count).toHaveBeenCalledWith({ where: { jobId: 'job-1', kind: 'auto', status: 'pending' } });
      expect(result.remaining).toBe(0);
    });
  });

  describe('resolveBatch', () => {
    const ambiguousItem = {
      id: '5',
      contactId: 11,
      kind: 'ambiguous',
      status: 'pending',
      candidates: [
        { csvRowNumber: 2, csvName: 'Maria Souza', csvEmail: 'mariasouza@gmail.com', score: 1 },
        { csvRowNumber: 3, csvName: 'Maria S.', csvEmail: 'marias@gmail.com', score: 0.5 },
      ],
    };

    it('applies the candidate the operator picked', async () => {
      itemsRepo.find.mockResolvedValue([{ ...ambiguousItem }]);

      const result = await service.resolveBatch('job-1', [{ contactId: 11, csvRowNumber: 3 }]);

      expect(contactsRepo.save).toHaveBeenCalledWith({ id: 11, email: 'marias@gmail.com' });
      expect(result.applied).toBe(1);
    });

    it('reaches items parked in conflict, not only pending ones', async () => {
      // A conflict is a decision waiting to happen: the operator must be able
      // to pick another candidate for it.
      itemsRepo.find.mockResolvedValue([{ ...ambiguousItem, status: 'conflict' }]);

      await service.resolveBatch('job-1', [{ contactId: 11, csvRowNumber: 2 }]);

      const where = itemsRepo.find.mock.calls[0][0].where;
      expect(where.status._value ?? where.status).toEqual(expect.arrayContaining(['pending', 'conflict']));
    });

    it('skips the contact when the operator sends a null row', async () => {
      itemsRepo.find.mockResolvedValue([{ ...ambiguousItem }]);

      const result = await service.resolveBatch('job-1', [{ contactId: 11, csvRowNumber: null }]);

      expect(itemsRepo.update).toHaveBeenCalledWith({ id: '5' }, { status: 'skipped' });
      expect(result.skipped).toBe(1);
      expect(contactsRepo.save).not.toHaveBeenCalled();
    });

    it('counts a resolution pointing at an unknown candidate as invalid', async () => {
      itemsRepo.find.mockResolvedValue([{ ...ambiguousItem }]);

      const result = await service.resolveBatch('job-1', [{ contactId: 11, csvRowNumber: 999 }]);

      expect(result.invalid).toBe(1);
      expect(contactsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('bulkResolve', () => {
    it('never consumes an address another contact already owns', async () => {
      const item = {
        id: '7',
        contactId: 12,
        kind: 'ambiguous',
        status: 'pending',
        candidates: [{ csvRowNumber: 4, csvName: 'Pedro Costa', csvEmail: 'pedrocosta@gmail.com', score: 0.9 }],
      };
      itemsRepo.createQueryBuilder.mockReturnValue(makeQB({ getMany: jest.fn().mockResolvedValue([item]) }));
      contactsRepo.find.mockResolvedValue([{ id: 55, email: 'pedrocosta@gmail.com' }]);

      const result = await service.bulkResolve('job-1', 'best-name', 0.5, 100);

      // Left pending on purpose: the automatic pass must not burn the item, the
      // operator decides.
      expect(contactsRepo.save).not.toHaveBeenCalled();
      expect(result.resolved).toBe(0);
      expect(result.unresolved).toBe(1);
    });

    it('skip-remaining clears conflicts along with the pending queue', async () => {
      itemsRepo.update.mockResolvedValue({ affected: 4 });

      const result = await service.bulkResolve('job-1', 'skip-remaining', 0.5, 100);

      const where = itemsRepo.update.mock.calls[0][0];
      expect(where.status._value ?? where.status).toEqual(expect.arrayContaining(['pending', 'conflict']));
      expect(result.resolved).toBe(4);
    });
  });

  describe('reopenConflicts', () => {
    it('returns conflicting items to pending and clears the reason', async () => {
      itemsRepo.update.mockResolvedValue({ affected: 3 });

      const result = await service.reopenConflicts('job-1');

      expect(itemsRepo.update).toHaveBeenCalledWith({ jobId: 'job-1', status: 'conflict' }, { status: 'pending', failureReason: null });
      expect(result.reopened).toBe(3);
      expect(result.progress.jobId).toBe('job-1');
    });

    it('throws when the job has no session', async () => {
      sessionsRepo.findOne.mockResolvedValue(null);

      await expect(service.reopenConflicts('job-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getProgress', () => {
    it('counts conflicts apart from failures, both inside the totals', async () => {
      itemsRepo.createQueryBuilder.mockReturnValue(
        makeQB({
          getRawMany: jest.fn().mockResolvedValue([
            { kind: 'auto', status: 'applied', count: '10' },
            { kind: 'auto', status: 'conflict', count: '2' },
            { kind: 'auto', status: 'pending', count: '3' },
            { kind: 'ambiguous', status: 'conflict', count: '1' },
            { kind: 'ambiguous', status: 'pending', count: '4' },
          ]),
        }),
      );

      const progress = await service.getProgress('job-1');

      expect(progress.auto).toMatchObject({ applied: 10, conflict: 2, failed: 0, pending: 3, total: 15 });
      expect(progress.ambiguous).toMatchObject({ conflict: 1, pending: 4, total: 5 });
    });
  });

  describe('getAmbiguousPage', () => {
    it('shows conflicting items in the review queue and flags used candidates', async () => {
      const row = {
        contactId: 11,
        currentEmail: 'maria***@gmail.com',
        contactName: 'Maria Souza',
        status: 'conflict',
        candidates: [{ csvRowNumber: 2, csvName: 'Maria Souza', csvEmail: 'mariasouza@gmail.com', score: 1 }],
        candidatesTotal: 1,
      };
      itemsRepo.createQueryBuilder
        .mockReturnValueOnce(makeQB({ getManyAndCount: jest.fn().mockResolvedValue([[row], 1]) }))
        // Second builder: emails already applied in this session.
        .mockReturnValueOnce(makeQB({ getRawMany: jest.fn().mockResolvedValue([{ new_email: 'mariasouza@gmail.com', contact_id: 77 }]) }));

      const page = await service.getAmbiguousPage('job-1', 0, 50);

      expect(page.totalPending).toBe(1);
      expect(page.items[0].candidates[0].usedByContactId).toBe(77);
    });
  });
});
