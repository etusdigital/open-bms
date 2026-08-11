// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api-client';
import { reconcileGateway } from '../reconcile-gateway';

const mocked = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('reconcile-gateway', () => {
  beforeEach(() => {
    mocked.get.mockReset();
    mocked.post.mockReset();
    mocked.delete.mockReset();
  });

  it('getSession() returns null when the job has no session yet', async () => {
    // The card polls this before a CSV is ever uploaded — a 404 is the normal
    // "nothing here" answer, not an error to surface.
    mocked.get.mockRejectedValueOnce({ response: { status: 404 } });

    await expect(reconcileGateway.getSession('job-1')).resolves.toBeNull();
  });

  it('getSession() rethrows anything that is not a 404', async () => {
    mocked.get.mockRejectedValueOnce({ response: { status: 500 } });

    await expect(reconcileGateway.getSession('job-1')).rejects.toBeTruthy();
  });

  it('createSession() uploads the CSV once, without a client timeout', async () => {
    // Parsing and matching 350k contacts takes minutes; the client must let the
    // server/nginx budget govern instead of aborting mid-run.
    mocked.post.mockResolvedValueOnce({ data: { jobId: 'job-1' } });

    await reconcileGateway.createSession('job-1', 'name,email', ['status']);

    expect(mocked.post).toHaveBeenCalledWith('/imports/job-1/reconcile/session', { csv: 'name,email', ignoreColumns: ['status'] }, { timeout: 0 });
  });

  it('ambiguousPage() omits the search param when there is no term', async () => {
    mocked.get.mockResolvedValue({ data: { totalPending: 0, offset: 0, items: [] } });

    await reconcileGateway.ambiguousPage('job-1', 0, 50);
    expect(mocked.get).toHaveBeenCalledWith('/imports/job-1/reconcile/session/ambiguous', { params: { offset: 0, limit: 50 } });

    await reconcileGateway.ambiguousPage('job-1', 50, 50, 'lucas');
    expect(mocked.get).toHaveBeenLastCalledWith('/imports/job-1/reconcile/session/ambiguous', { params: { offset: 50, limit: 50, q: 'lucas' } });
  });

  it('itemsPage() forwards the conflict status filter', async () => {
    mocked.get.mockResolvedValueOnce({ data: { total: 0, offset: 0, items: [] } });

    await reconcileGateway.itemsPage('job-1', { offset: 0, limit: 20, status: 'conflict' });

    expect(mocked.get).toHaveBeenCalledWith('/imports/job-1/reconcile/session/items', { params: { offset: 0, limit: 20, status: 'conflict' } });
  });

  it('applyAuto() posts the chunk size and reports conflicts apart from failures', async () => {
    mocked.post.mockResolvedValueOnce({ data: { applied: 4, failed: 0, conflicts: 1, remaining: 0 } });

    const result = await reconcileGateway.applyAuto('job-1', 5000);

    expect(mocked.post).toHaveBeenCalledWith('/imports/job-1/reconcile/session/apply-auto', { limit: 5000 }, { timeout: 0 });
    expect(result).toMatchObject({ applied: 4, conflicts: 1, remaining: 0 });
  });

  it('reopenConflicts() posts to the session and returns the refreshed progress', async () => {
    mocked.post.mockResolvedValueOnce({ data: { reopened: 3, progress: { jobId: 'job-1' } } });

    const result = await reconcileGateway.reopenConflicts('job-1');

    expect(mocked.post).toHaveBeenCalledWith('/imports/job-1/reconcile/session/reopen-conflicts', {}, { timeout: 0 });
    expect(result.reopened).toBe(3);
  });

  it('deleteSession() drops the working set', async () => {
    mocked.delete.mockResolvedValueOnce({});

    await reconcileGateway.deleteSession('job-1');

    expect(mocked.delete).toHaveBeenCalledWith('/imports/job-1/reconcile/session');
  });
});
