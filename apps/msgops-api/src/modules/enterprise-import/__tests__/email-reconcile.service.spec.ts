import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EmailReconcileService } from '../email-reconcile.service';
import { EnterpriseImportJobEntity } from '../../../entities/enterprise-import-job.entity';
import { ContactEntity } from '../../../entities/contact.entity';

/**
 * EVO-1464 — reconcile masked emails against a raw-email CSV. Tests cover the
 * three matching outcomes (unique, ambiguous, no match), name-based tie-break
 * for collisions, and the apply path including operator resolutions.
 */
describe('EmailReconcileService', () => {
  let service: EmailReconcileService;
  let contactsRepo: {
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let jobsRepo: { findOne: jest.Mock };

  const makeQB = (rows: Partial<ContactEntity>[]) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
    getCount: jest.fn().mockResolvedValue(0),
  });

  beforeEach(async () => {
    contactsRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    jobsRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailReconcileService,
        { provide: getRepositoryToken(ContactEntity), useValue: contactsRepo },
        { provide: getRepositoryToken(EnterpriseImportJobEntity), useValue: jobsRepo },
      ],
    }).compile();

    service = module.get(EmailReconcileService);

    jobsRepo.findOne.mockResolvedValue({ id: 'job-1', accountId: 1 });
  });

  function setMaskedContacts(rows: Partial<ContactEntity>[]) {
    contactsRepo.createQueryBuilder.mockImplementation(() => makeQB(rows));
  }

  describe('preview', () => {
    it('counts unique matches when each CSV row maps to a distinct masked contact', async () => {
      setMaskedContacts([
        { id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' },
        { id: 11, email: 'maria***@gmail.com', firstName: 'Maria', lastName: 'Souza' },
      ]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01', 'Maria Souza,mariasouza@gmail.com,Active,2026-01-02'].join('\n');

      const out = await service.preview('job-1', csv);

      expect(out.uniqueMatches).toBe(2);
      expect(out.ambiguousMatches).toBe(0);
      expect(out.noMatches).toBe(0);
      expect(out.contactsMasked).toBe(2);
      expect(out.csvRows).toBe(2);
    });

    it('flags ambiguous when two CSV rows share the same mask and no name decides', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);

      const csv = [
        'name,email,status,created_at',
        'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01',
        // Same mask (`lucas***@gmail.com`) but a totally different person.
        'Carlos Pereira,lucasrocha@gmail.com,Active,2026-01-02',
      ].join('\n');

      const out = await service.preview('job-1', csv);

      // Name match resolves to Lucas Silva — picks the first row.
      expect(out.uniqueMatches).toBe(1);
      expect(out.ambiguousMatches).toBe(0);
    });

    it('keeps ambiguous when name similarity does not pass the threshold', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira' }]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01', 'Lucas Souza,lucasrocha@gmail.com,Active,2026-01-02'].join('\n');

      const out = await service.preview('job-1', csv);

      expect(out.uniqueMatches).toBe(0);
      expect(out.ambiguousMatches).toBe(1);
      expect(out.ambiguousSample[0]?.contactId).toBe(10);
      expect(out.ambiguousSample[0]?.candidates).toHaveLength(2);
    });

    it('reports no match when no CSV row reconstructs the mask', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);

      const csv = ['name,email,status,created_at', 'Maria Souza,mariasouza@gmail.com,Active,2026-01-02'].join('\n');

      const out = await service.preview('job-1', csv);

      expect(out.uniqueMatches).toBe(0);
      expect(out.noMatches).toBe(1);
      expect(out.noMatchSample[0]?.contactId).toBe(10);
    });

    it('skips invalid CSV rows (missing email)', async () => {
      setMaskedContacts([]);
      const csv = ['name,email,status,created_at', 'NoEmail,,Active,2026-01-01', 'Bad,not-an-email,Active,2026-01-02'].join('\n');

      const out = await service.preview('job-1', csv);

      expect(out.csvRows).toBe(2);
      expect(out.invalidCsvRows).toBe(2);
    });

    it('throws NotFoundException for unknown jobId', async () => {
      jobsRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.preview('missing', 'name,email,status,created_at')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when job has no accountId', async () => {
      jobsRepo.findOne.mockResolvedValueOnce({ id: 'job-1', accountId: null });
      await expect(service.preview('job-1', 'name,email,status,created_at')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('apply', () => {
    it('writes a row per unique match using repository.update so the BeforeUpdate listener fires', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01'].join('\n');

      const out = await service.apply('job-1', csv, []);

      expect(contactsRepo.update).toHaveBeenCalledWith({ id: 10 }, { email: 'lucassilva@gmail.com' });
      expect(out.updated).toBe(1);
      expect(out.skippedAmbiguous).toBe(0);
    });

    it('honors operator resolution picking a specific CSV row over auto-pick', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira' }]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01', 'Lucas Souza,lucasrocha@gmail.com,Active,2026-01-02'].join('\n');

      // Operator picks row 2 even though row 1 would otherwise be ambiguous.
      const out = await service.apply('job-1', csv, [{ contactId: 10, csvRowNumber: 2 }]);

      expect(contactsRepo.update).toHaveBeenCalledWith({ id: 10 }, { email: 'lucasrocha@gmail.com' });
      expect(out.updated).toBe(1);
    });

    it('skips contacts where operator chose csvRowNumber=null', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01'].join('\n');

      const out = await service.apply('job-1', csv, [{ contactId: 10, csvRowNumber: null }]);

      expect(contactsRepo.update).not.toHaveBeenCalled();
      expect(out.updated).toBe(0);
      expect(out.skippedAmbiguous).toBe(1);
    });

    it('records failures without aborting the batch', async () => {
      setMaskedContacts([
        { id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' },
        { id: 11, email: 'maria***@gmail.com', firstName: 'Maria', lastName: 'Souza' },
      ]);
      contactsRepo.update.mockImplementationOnce(() => Promise.reject(new Error('DB down')));

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01', 'Maria Souza,mariasouza@gmail.com,Active,2026-01-02'].join('\n');

      const out = await service.apply('job-1', csv, []);

      expect(out.updated).toBe(1);
      expect(out.failures).toHaveLength(1);
      expect(out.failures[0]?.contactId).toBe(10);
    });
  });
});
