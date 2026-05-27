import { EnterpriseImportProcessor } from './enterprise-import.processor';

// onFailed terminal-state logic and orphan-account cleanup.
describe('EnterpriseImportProcessor onFailed + orphan cleanup', () => {
  function make(jobRow: any) {
    const jobRepo: any = {
      findOne: jest.fn(async () => ({ ...jobRow })),
      save: jest.fn(async (e: any) => e),
      update: jest.fn(async () => {}),
      query: jest.fn(async () => {}),
    };
    const dataSource: any = { query: jest.fn(async () => {}) };
    const proc = new EnterpriseImportProcessor(jobRepo, dataSource, {} as any, {} as any, {} as any, {} as any);
    return { proc, jobRepo, dataSource };
  }
  const job = (attemptsMade: number, attempts = 5) => ({ id: 'b1', data: { jobId: 'j1' }, attemptsMade, opts: { attempts } }) as any;

  it('does not mark failed while retries remain (no off-by-one)', async () => {
    const { proc, jobRepo } = make({ id: 'j1', status: 'running', scope: 'account', accountId: 5, progress: {} });
    await proc.onFailed(job(2, 5), new Error('5xx transient'));
    expect(jobRepo.update).not.toHaveBeenCalled();
  });

  it('marks failed once retries are exhausted', async () => {
    const { proc, jobRepo } = make({ id: 'j1', status: 'running', scope: 'instance', accountId: null, progress: {} });
    await proc.onFailed(job(5, 5), new Error('5xx exhausted'));
    // Partial update (not a full-entity save) so progress/checkpoint are not clobbered.
    expect(jobRepo.update).toHaveBeenCalledWith({ id: 'j1' }, expect.objectContaining({ status: 'failed' }));
    expect(jobRepo.save).not.toHaveBeenCalled();
  });

  it('does not clobber an already-terminal state (completed/failed)', async () => {
    const { proc, jobRepo } = make({ id: 'j1', status: 'completed', scope: 'account', accountId: 5, progress: {} });
    await proc.onFailed(job(5, 5), new Error('late failure'));
    expect(jobRepo.update).not.toHaveBeenCalled();
    expect(jobRepo.save).not.toHaveBeenCalled();
  });

  it('soft-deletes the orphan account when account-scope fails with no progress', async () => {
    const { proc, dataSource } = make({ id: 'j1', status: 'running', scope: 'account', accountId: 77, progress: {} });
    await proc.onFailed(job(5, 5), new Error('bad api key'));
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE accounts SET deleted_at'), [77]);
  });

  it('does not delete the account when there was partial progress', async () => {
    const { proc, dataSource } = make({
      id: 'j1',
      status: 'running',
      scope: 'account',
      accountId: 77,
      progress: { contacts: { done: 10 } },
    });
    await proc.onFailed(job(5, 5), new Error('failed after partial'));
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
