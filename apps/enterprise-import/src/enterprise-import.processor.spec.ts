import { EnterpriseImportProcessor } from './enterprise-import.processor';

// F15/F18: lógica de estado terminal do onFailed e cleanup de conta órfã.
describe('EnterpriseImportProcessor onFailed (F15) + orphan cleanup (F18)', () => {
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

  it('NÃO marca failed enquanto ainda há tentativas (F15 — sem off-by-one)', async () => {
    const { proc, jobRepo } = make({ id: 'j1', status: 'running', scope: 'account', accountId: 5, progress: {} });
    await proc.onFailed(job(2, 5), new Error('5xx transient'));
    expect(jobRepo.save).not.toHaveBeenCalled();
  });

  it('marca failed quando esgota as tentativas', async () => {
    const { proc, jobRepo } = make({ id: 'j1', status: 'running', scope: 'instance', accountId: null, progress: {} });
    await proc.onFailed(job(5, 5), new Error('5xx exhausted'));
    expect(jobRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('NÃO clobbera estado terminal já existente (completed/failed)', async () => {
    const { proc, jobRepo } = make({ id: 'j1', status: 'completed', scope: 'account', accountId: 5, progress: {} });
    await proc.onFailed(job(5, 5), new Error('late failure'));
    expect(jobRepo.save).not.toHaveBeenCalled();
  });

  it('F18: soft-delete da conta órfã quando account-scope falha sem progresso', async () => {
    const { proc, dataSource } = make({ id: 'j1', status: 'running', scope: 'account', accountId: 77, progress: {} });
    await proc.onFailed(job(5, 5), new Error('bad api key'));
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE accounts SET deleted_at'), [77]);
  });

  it('F18: NÃO apaga a conta se já houve progresso (import parcial)', async () => {
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
