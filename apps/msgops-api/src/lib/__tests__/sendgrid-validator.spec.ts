import { HttpException, HttpStatus } from '@nestjs/common';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

import { validateSendgridApiKey } from '../sendgrid-validator';

const axiosGet = require('axios').default.get as jest.Mock;

describe('validateSendgridApiKey', () => {
  afterEach(() => axiosGet.mockReset());

  it('returns first_name as accountName on 2xx', async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { first_name: 'Maria', company: 'Acme' } });
    const out = await validateSendgridApiKey('SG.abcdefghij');
    expect(out).toEqual({ accountName: 'Maria' });
    expect(axiosGet).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/user/account',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer SG.abcdefghij' }) }),
    );
  });

  it('falls back to company when first_name absent', async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { company: 'Acme' } });
    expect(await validateSendgridApiKey('SG.abcdefghij')).toEqual({ accountName: 'Acme' });
  });

  it('returns null accountName when neither first_name nor company present', async () => {
    axiosGet.mockResolvedValue({ status: 200, data: { type: 'free' } });
    expect(await validateSendgridApiKey('SG.abcdefghij')).toEqual({ accountName: null });
  });

  it('maps 401 to UNAUTHORIZED with PT-BR Full Access message', async () => {
    axiosGet.mockResolvedValue({ status: 401, data: {} });
    try {
      await validateSendgridApiKey('SG.abcdefghij');
      throw new Error('expected to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(err.message).toMatch(/Full Access/);
    }
  });

  it('maps 403 to UNAUTHORIZED', async () => {
    axiosGet.mockResolvedValue({ status: 403, data: {} });
    try {
      await validateSendgridApiKey('SG.abcdefghij');
      throw new Error('expected to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('maps 429 to TOO_MANY_REQUESTS', async () => {
    axiosGet.mockResolvedValue({ status: 429, data: {} });
    try {
      await validateSendgridApiKey('SG.abcdefghij');
      throw new Error('expected to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('maps unexpected status to BAD_GATEWAY without leaking upstream body', async () => {
    axiosGet.mockResolvedValue({ status: 502, data: { detail: 'upstream-detail' } });
    try {
      await validateSendgridApiKey('SG.abcdefghij');
      throw new Error('expected to throw');
    } catch (err: any) {
      expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(err.message).not.toMatch(/upstream-detail/);
    }
  });

  it('maps network error to BAD_GATEWAY without leaking message', async () => {
    axiosGet.mockRejectedValue(new Error('connect ETIMEDOUT api.sendgrid.com'));
    try {
      await validateSendgridApiKey('SG.abcdefghij');
      throw new Error('expected to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
      expect(err.message).not.toMatch(/ETIMEDOUT|api\.sendgrid\.com/);
    }
  });
});
