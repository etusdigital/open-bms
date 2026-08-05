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
// Contacts (and their CSV rows) whose masks collide 1:1 on both sides: the
// pairing is certain, so their delta IS the export's timezone offset. Three of
// them is the minimum the inference accepts before committing to a value.
// Written in America/Sao_Paulo local time (UTC-3) with no offset marker.
const OFFSET_ANCHOR_CONTACTS = [
  { id: 90, email: 'alice***@gmail.com', firstName: 'Alice', lastName: 'Nunes', createdAt: new Date('2023-04-01T13:00:00Z') },
  { id: 91, email: 'bruno***@gmail.com', firstName: 'Bruno', lastName: 'Reis', createdAt: new Date('2023-04-02T18:30:00Z') },
  { id: 92, email: 'carla***@gmail.com', firstName: 'Carla', lastName: 'Dias', createdAt: new Date('2023-04-03T21:45:00Z') },
];
const OFFSET_ANCHOR_ROWS = [
  'Alice Nunes,alicenunes@gmail.com,Active,2023-04-01 10:00:00',
  'Bruno Reis,brunoreis@gmail.com,Active,2023-04-02 15:30:00',
  'Carla Dias,carladias@gmail.com,Active,2023-04-03 18:45:00',
];

describe('EmailReconcileService', () => {
  let service: EmailReconcileService;
  let contactsRepo: {
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
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
      // create() passes the partial through so save() assertions can inspect
      // exactly what would be persisted.
      create: jest.fn((partial) => partial),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      // No pre-existing holder of any email unless a test says otherwise.
      findOne: jest.fn().mockResolvedValue(null),
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

  describe('required CSV columns', () => {
    it('rejects a CSV missing created_at before processing any row', async () => {
      setMaskedContacts([]);
      const csv = ['name,email,status', 'Lucas Silva,lucassilva@gmail.com,Active'].join('\n');

      const err = await service.preview('job-1', csv).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ code: 'RECONCILE_MISSING_COLUMNS', missing: ['created_at'] });
    });

    it('lists every missing required column', async () => {
      setMaskedContacts([]);
      const csv = ['email,status', 'lucassilva@gmail.com,Active'].join('\n');

      const err = await service.preview('job-1', csv).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ missing: ['name (or first_name + last_name)', 'created_at'] });
    });

    it('accepts first_name/last_name in place of name, composing the full name', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira' }]);

      // Collision decided by name only (contact has no createdAt) — proves the
      // composed first+last name feeds the similarity scoring.
      const csv = [
        'first_name,last_name,email,status,created_at',
        'Joao,Pereira,lucassilva@gmail.com,Active,2026-01-01',
        'Carlos,Melo,lucasrocha@gmail.com,Active,2026-01-02',
      ].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(1);
      expect(out.ambiguousMatches).toBe(0);
    });

    it('rejects first_name without last_name when name is absent', async () => {
      setMaskedContacts([]);
      const csv = ['first_name,email,created_at', 'Lucas,lucassilva@gmail.com,2026-01-01'].join('\n');

      const err = await service.preview('job-1', csv).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ missing: ['name (or first_name + last_name)'] });
    });

    it('accepts headers regardless of case and semicolon delimiter', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);
      const csv = ['Name;Email;Status;Created_At', 'Lucas Silva;lucassilva@gmail.com;Active;2026-01-01'].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(1);
    });
  });

  describe('created_at disambiguation', () => {
    it('auto-matches when exactly one collision candidate shares the exact timestamp', async () => {
      // Names are useless here (both totally different people) — only the
      // timestamp separates them.
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira', createdAt: new Date('2023-04-10T14:22:31Z') }]);

      const csv = ['name,email,status,created_at', 'Ana Souza,lucassilva@gmail.com,Active,2023-04-10 14:22:31', 'Rita Melo,lucasrocha@gmail.com,Active,2024-08-01 09:00:00'].join(
        '\n',
      );

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(1);
      expect(out.ambiguousMatches).toBe(0);
    });

    it('tolerates a fixed timezone offset in offset-less timestamps', async () => {
      setMaskedContacts([
        { id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira', createdAt: new Date('2023-04-10T14:22:31Z') },
        // Anchors: masks colliding 1:1 on both sides, which is where the
        // export's offset (UTC-3 here) is inferred from.
        ...OFFSET_ANCHOR_CONTACTS,
      ]);

      // Export written in America/Sao_Paulo local time (UTC-3), no offset marker.
      const csv = [
        'name,email,status,created_at',
        'Ana Souza,lucassilva@gmail.com,Active,2023-04-10 11:22:31',
        'Rita Melo,lucasrocha@gmail.com,Active,2024-08-01 09:00:00',
        ...OFFSET_ANCHOR_ROWS,
      ].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(1 + OFFSET_ANCHOR_ROWS.length);
      expect(out.ambiguousMatches).toBe(0);
    });

    it('does not grant exact agreement to an arbitrary offset when none was established', async () => {
      // Same shape as the test above, minus the anchors: the CSV alone gives no
      // evidence of its timezone, so a 3h gap is NOT an exact match. Accepting
      // any half-hour-aligned shift per candidate (the old rule) made ~57
      // offsets plausible and let unrelated rows claim the strongest tier.
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira', createdAt: new Date('2023-04-10T14:22:31Z') }]);

      const csv = [
        'name,email,status,created_at',
        'Ana Souza,lucassilva@gmail.com,Active,2023-04-10 11:22:31',
        // Same calendar date, so both survive as day-level candidates and the
        // contact goes to the operator instead of being silently decided.
        'Rita Melo,lucasrocha@gmail.com,Active,2023-04-10 09:00:00',
      ].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(0);
      expect(out.ambiguousMatches).toBe(1);
      expect(out.ambiguousSample[0]?.candidates.every((c) => c.timeMatch === 1)).toBe(true);
    });

    it('infers the offset from unambiguous pairs and applies it to the colliding ones', async () => {
      setMaskedContacts([
        // Two rows collide on this mask; only the one shifted by exactly the
        // inferred offset takes the exact tier.
        { id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira', createdAt: new Date('2023-04-10T14:22:31Z') },
        ...OFFSET_ANCHOR_CONTACTS,
      ]);

      const csv = [
        'name,email,status,created_at',
        // 11:22 local == 14:22Z under the inferred UTC-3.
        'Ana Souza,lucassilva@gmail.com,Active,2023-04-10 11:22',
        // 14:22 local == 17:22Z — the shift the OLD rule would have accepted
        // as exact too (0 offset), making the pair undecidable.
        'Rita Melo,lucasrocha@gmail.com,Active,2023-04-10 14:22',
        ...OFFSET_ANCHOR_ROWS,
      ].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(1 + OFFSET_ANCHOR_ROWS.length);
      expect(out.ambiguousMatches).toBe(0);
    });

    it('parses the locale timestamp the streaming export used to emit', async () => {
      // `Date.prototype.toString()` output — what fast-csv wrote before the
      // exporter was pinned to ISO. CSVs in that shape are still in operator
      // hands, and rejecting them silently killed the whole time tier.
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira', createdAt: new Date('2026-07-09T07:48:16.039Z') }]);

      const csv = [
        'name,email,status,created_at',
        'Ana Souza,lucassilva@gmail.com,Active,Thu Jul 09 2026 03:48:16 GMT-0400 (Eastern Daylight Time)',
        'Rita Melo,lucasrocha@gmail.com,Active,Thu Jul 09 2026 05:10:00 GMT-0400 (Eastern Daylight Time)',
      ].join('\n');

      const out = await service.preview('job-1', csv);
      // The offset is explicit in the string, so the instant is absolute — no
      // inference needed and the second row loses on the exact tier.
      expect(out.uniqueMatches).toBe(1);
      expect(out.ambiguousMatches).toBe(0);
    });

    it('uses date-only agreement when the CSV carries no time component', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira', createdAt: new Date('2023-04-10T14:22:31Z') }]);

      const csv = ['name,email,status,created_at', 'Ana Souza,lucassilva@gmail.com,Active,2023-04-10', 'Rita Melo,lucasrocha@gmail.com,Active,2024-08-01'].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(1);
    });

    it('keeps ambiguity but drops time-disagreeing candidates when several share the date', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira', createdAt: new Date('2023-04-10T14:22:31Z') }]);

      const csv = [
        'name,email,status,created_at',
        'Ana Souza,lucassilva@gmail.com,Active,2023-04-10',
        'Rita Melo,lucasrocha@gmail.com,Active,2023-04-10',
        'Bia Costa,lucasbia@gmail.com,Active,2024-08-01',
      ].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.ambiguousMatches).toBe(1);
      // Only the two same-day candidates survive; each carries timeMatch=1.
      expect(out.ambiguousSample[0]?.candidates).toHaveLength(2);
      expect(out.ambiguousSample[0]?.candidates.every((c) => c.timeMatch === 1)).toBe(true);
    });

    it('compares at minute precision, ignoring seconds and milliseconds', async () => {
      // DB keeps ms, export truncates to the minute — the instant tier must
      // still discriminate between two same-day candidates.
      setMaskedContacts([
        { id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira', createdAt: new Date('2023-04-10T14:22:31.874Z') },
        ...OFFSET_ANCHOR_CONTACTS,
      ]);

      const csv = [
        'name,email,status,created_at',
        // 11:22 local (UTC-3) == 14:22Z — same minute, no seconds written.
        'Ana Souza,lucassilva@gmail.com,Active,2023-04-10 11:22',
        // Same day but a different minute — must lose to the row above.
        'Rita Melo,lucasrocha@gmail.com,Active,2023-04-10 09:15',
        ...OFFSET_ANCHOR_ROWS,
      ].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(1 + OFFSET_ANCHOR_ROWS.length);
      expect(out.ambiguousMatches).toBe(0);
    });

    it('matches names regardless of punctuation and token order', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);

      const csv = ['name,email,status,created_at', '"Silva, Lucas",lucassilva@gmail.com,Active,2026-01-01', 'Carlos Pereira,lucasrocha@gmail.com,Active,2026-01-02'].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.uniqueMatches).toBe(1);
      expect(out.ambiguousMatches).toBe(0);
    });

    it('does not hand a lone CSV row to every contact sharing the mask (partial CSV)', async () => {
      // Real incident: a 1-row test CSV auto-matched all 82 contacts whose
      // mask collided with the row's — the same email assigned 82 times.
      setMaskedContacts([
        { id: 10, email: 'franc***@gmail.com', firstName: 'Francyne', lastName: 'Ferraz', createdAt: new Date('2026-07-09T07:48:16.039Z') },
        { id: 11, email: 'franc***@gmail.com', firstName: 'Francisco', lastName: 'Picone', createdAt: new Date('2026-04-11T14:02:32.298Z') },
        { id: 12, email: 'franc***@gmail.com', firstName: 'Franco', lastName: 'Caputo', createdAt: new Date('2026-03-16T16:44:14.642Z') },
      ]);

      // Export truncates seconds — 04:48 local (UTC-3) vs 07:48:16.039Z still
      // agrees at minute precision (seconds/ms ignored on both sides).
      const csv = ['first_name,last_name,email,status,created_at', 'Francyne,Ferraz,francferraz98@gmail.com,Active,2026-07-09 04:48'].join('\n');

      const out = await service.preview('job-1', csv);

      expect(out.uniqueMatches).toBe(1);
      // The other two collision contacts must NOT auto-receive the same email;
      // the operator sees the row as a (time-disagreeing) manual option.
      expect(out.ambiguousMatches).toBe(2);
      expect(out.ambiguousSample.map((a) => a.contactId).sort()).toEqual([11, 12]);
    });

    it('gives a CSV row claimed by two auto picks to the strongest agreement only', async () => {
      // Bulk-created base: both contacts share the mask AND the creation
      // minute, so both would auto-pick the lone row. Email is unique per
      // account — the better name keeps it, the other goes to the operator.
      setMaskedContacts([
        { id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva', createdAt: new Date('2026-01-05T12:30:10Z') },
        { id: 11, email: 'lucas***@gmail.com', firstName: 'Pedro', lastName: 'Costa', createdAt: new Date('2026-01-05T12:30:40Z') },
      ]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-05 12:30'].join('\n');

      const out = await service.preview('job-1', csv);

      expect(out.uniqueMatches).toBe(1);
      expect(out.ambiguousMatches).toBe(1);
      expect(out.ambiguousSample[0]?.contactId).toBe(11);
      expect(out.ambiguousSample[0]?.candidates).toHaveLength(1);
    });

    it('arbitrates duplicate CSV rows carrying the same address, not just the same row number', async () => {
      // Exports repeat addresses across rows. Arbitrating by row number let
      // each duplicate produce its own automatic winner, and the second one
      // then died on the per-account email uniqueness at apply time.
      setMaskedContacts([
        { id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva', createdAt: new Date('2026-01-05T12:30:10Z') },
        { id: 11, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva', createdAt: new Date('2026-01-05T12:31:40Z') },
      ]);

      // Each contact confidently auto-picks a different ROW (the instants are
      // explicit), but the two rows carry the SAME address.
      const csv = [
        'name,email,status,created_at',
        'Lucas Silva,lucassilva@gmail.com,Active,2026-01-05T12:30:00Z',
        'Lucas Silva,LucasSilva@gmail.com,Active,2026-01-05T12:31:00Z',
      ].join('\n');

      const out = await service.preview('job-1', csv);

      expect(out.uniqueMatches).toBe(1);
      expect(out.ambiguousMatches).toBe(1);
    });

    it('falls back to name-only behavior when the contact has no createdAt', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira' }]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01', 'Lucas Souza,lucasrocha@gmail.com,Active,2026-01-02'].join('\n');

      const out = await service.preview('job-1', csv);
      expect(out.ambiguousMatches).toBe(1);
      expect(out.ambiguousSample[0]?.candidates).toHaveLength(2);
    });
  });

  describe('apply', () => {
    it('writes a row per unique match using save() so the BeforeUpdate listener fires', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01'].join('\n');

      const out = await service.apply('job-1', csv, []);

      expect(contactsRepo.save).toHaveBeenCalledWith({ id: 10, email: 'lucassilva@gmail.com' });
      expect(out.updated).toBe(1);
      expect(out.skippedAmbiguous).toBe(0);
    });

    it('honors operator resolution picking a specific CSV row over auto-pick', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Joao', lastName: 'Pereira' }]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01', 'Lucas Souza,lucasrocha@gmail.com,Active,2026-01-02'].join('\n');

      // Operator picks row 2 even though row 1 would otherwise be ambiguous.
      const out = await service.apply('job-1', csv, [{ contactId: 10, csvRowNumber: 2 }]);

      expect(contactsRepo.save).toHaveBeenCalledWith({ id: 10, email: 'lucasrocha@gmail.com' });
      expect(out.updated).toBe(1);
    });

    it('skips contacts where operator chose csvRowNumber=null', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01'].join('\n');

      const out = await service.apply('job-1', csv, [{ contactId: 10, csvRowNumber: null }]);

      expect(contactsRepo.save).not.toHaveBeenCalled();
      expect(out.updated).toBe(0);
      expect(out.skippedAmbiguous).toBe(1);
    });

    it('fails friendly when the email already belongs to another contact in the account', async () => {
      setMaskedContacts([{ id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' }]);
      // Someone else (a clean contact) already holds the address.
      contactsRepo.findOne.mockResolvedValue({ id: 999 });

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01'].join('\n');

      const out = await service.apply('job-1', csv, []);

      expect(contactsRepo.save).not.toHaveBeenCalled();
      expect(out.updated).toBe(0);
      expect(out.failures).toHaveLength(1);
      expect(out.failures[0]?.reason).toContain('#999');
    });

    it('records failures without aborting the batch', async () => {
      setMaskedContacts([
        { id: 10, email: 'lucas***@gmail.com', firstName: 'Lucas', lastName: 'Silva' },
        { id: 11, email: 'maria***@gmail.com', firstName: 'Maria', lastName: 'Souza' },
      ]);
      contactsRepo.save.mockImplementationOnce(() => Promise.reject(new Error('DB down')));

      const csv = ['name,email,status,created_at', 'Lucas Silva,lucassilva@gmail.com,Active,2026-01-01', 'Maria Souza,mariasouza@gmail.com,Active,2026-01-02'].join('\n');

      const out = await service.apply('job-1', csv, []);

      expect(out.updated).toBe(1);
      expect(out.failures).toHaveLength(1);
      expect(out.failures[0]?.contactId).toBe(10);
    });
  });
});
