import { Test, TestingModule } from '@nestjs/testing';
import { EnterpriseImportController } from '../enterprise-import.controller';
import { EnterpriseImportService } from '../enterprise-import.service';
import { EmailReconcileService } from '../email-reconcile.service';
import { EmailReconcileSessionService } from '../email-reconcile-session.service';
import { EnterpriseImportEnabledGuard } from '../enterprise-import.guard';

/**
 * Controller-level contract of the reconcile session endpoints: what the
 * service receives after the query string is parsed. The clamps matter — an
 * unbounded `limit` on a 350k-contact session is a multi-hundred-MB response,
 * which is what sank the original stateless flow.
 */
describe('EnterpriseImportController (reconcile session)', () => {
  let controller: EnterpriseImportController;
  let sessionService: {
    createSession: jest.Mock;
    getProgress: jest.Mock;
    getAmbiguousPage: jest.Mock;
    getItemsPage: jest.Mock;
    resolveBatch: jest.Mock;
    applyAutoChunk: jest.Mock;
    bulkResolve: jest.Mock;
    reopenConflicts: jest.Mock;
    deleteSession: jest.Mock;
  };

  beforeEach(async () => {
    sessionService = {
      createSession: jest.fn().mockResolvedValue({}),
      getProgress: jest.fn().mockResolvedValue({}),
      getAmbiguousPage: jest.fn().mockResolvedValue({}),
      getItemsPage: jest.fn().mockResolvedValue({}),
      resolveBatch: jest.fn().mockResolvedValue({}),
      applyAutoChunk: jest.fn().mockResolvedValue({}),
      bulkResolve: jest.fn().mockResolvedValue({}),
      reopenConflicts: jest.fn().mockResolvedValue({}),
      deleteSession: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnterpriseImportController],
      providers: [
        { provide: EnterpriseImportService, useValue: {} },
        { provide: EmailReconcileService, useValue: {} },
        { provide: EmailReconcileSessionService, useValue: sessionService },
      ],
    })
      .overrideGuard(EnterpriseImportEnabledGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EnterpriseImportController);
  });

  it('creates the session with the CSV and the deselected columns', async () => {
    await controller.createReconcileSession('job-1', { csv: 'name,email', ignoreColumns: ['status'] } as any);

    expect(sessionService.createSession).toHaveBeenCalledWith('job-1', 'name,email', ['status']);
  });

  describe('ambiguous page', () => {
    it('applies defaults when the query is absent', async () => {
      await controller.getReconcileAmbiguousPage('job-1');

      expect(sessionService.getAmbiguousPage).toHaveBeenCalledWith('job-1', 0, 50, '');
    });

    it('caps the page size and floors the offset', async () => {
      await controller.getReconcileAmbiguousPage('job-1', '-10', '99999', 'lucas');

      expect(sessionService.getAmbiguousPage).toHaveBeenCalledWith('job-1', 0, 200, 'lucas');
    });

    it('truncates an oversized search term', async () => {
      await controller.getReconcileAmbiguousPage('job-1', '0', '50', 'x'.repeat(500));

      expect(sessionService.getAmbiguousPage.mock.calls[0][3]).toHaveLength(200);
    });
  });

  describe('items page', () => {
    it('forwards kind and status filters, conflict included', async () => {
      await controller.getReconcileItemsPage('job-1', '0', '20', '', 'auto', 'conflict');

      expect(sessionService.getItemsPage).toHaveBeenCalledWith('job-1', expect.objectContaining({ kind: 'auto', status: 'conflict', limit: 20 }));
    });

    it('drops filters it does not recognize instead of querying for them', async () => {
      await controller.getReconcileItemsPage('job-1', '0', '20', '', 'nonsense', 'nonsense');

      expect(sessionService.getItemsPage).toHaveBeenCalledWith('job-1', expect.objectContaining({ kind: undefined, status: undefined }));
    });
  });

  it('reopens conflicts for the job', async () => {
    await controller.reopenReconcileConflicts('job-1');

    expect(sessionService.reopenConflicts).toHaveBeenCalledWith('job-1');
  });

  it('forwards the bulk strategy with its cursor', async () => {
    await controller.bulkResolveReconcile('job-1', { strategy: 'best-name', threshold: 0.7, limit: 5000, afterId: '42' } as any);

    expect(sessionService.bulkResolve).toHaveBeenCalledWith('job-1', 'best-name', 0.7, 5000, '42');
  });

  it('reports the deletion of the working set', async () => {
    await expect(controller.deleteReconcileSession('job-1')).resolves.toEqual({ deleted: true });
    expect(sessionService.deleteSession).toHaveBeenCalledWith('job-1');
  });
});
