import { CheckerProvider } from './checker.provider';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders } from 'axios';

describe('CheckerProvider', () => {
  let provider: CheckerProvider;
  let httpService: HttpService;

  const makeAxiosResponse = (data: any, status = 200): AxiosResponse => ({
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Other',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

  beforeEach(() => {
    process.env.EMAILABLE_URL = 'https://api.emailable.com/v1/verify';
    process.env.EMAILABLE_API_KEY = 'test-key';

    provider = new CheckerProvider();
    httpService = (provider as any).httpService;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('check()', () => {
    it('should return deliverable status for valid email', async () => {
      const responseData = { state: 'deliverable', reason: 'accepted_email' };
      jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

      const result = await provider.check('user@gmail.com');

      expect(result.email).toBe('user@gmail.com');
      expect(result.status).toBe('deliverable');
      expect(result.reason).toBe('accepted_email');
      expect(result.apiStatus).toBe(200);
    });

    it('should return risky status for non-Yahoo risky email', async () => {
      const responseData = { state: 'risky', reason: 'low_deliverability' };
      jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

      const result = await provider.check('user@gmail.com');

      expect(result.status).toBe('risky');
      expect(result.reason).toBe('low_deliverability');
    });

    it('should return invalid status', async () => {
      const responseData = { state: 'undeliverable', reason: 'rejected_email' };
      jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

      const result = await provider.check('invalid@nonexistent.com');

      expect(result.status).toBe('undeliverable');
    });

    // Yahoo override tests
    describe('Yahoo override logic', () => {
      const yahooEmails = ['user@yahoo.com', 'user@yahoo.com.br', 'user@yahoo.co.uk', 'user@yahoo.co.jp', 'user@yahoo.fr', 'user@yahoo.es', 'user@yahoo.de', 'user@yahoo.it'];

      it.each(yahooEmails)('should override risky+low_deliverability to deliverable for %s', async (email) => {
        const responseData = { state: 'risky', reason: 'low_deliverability' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

        const result = await provider.check(email);

        expect(result.status).toBe('deliverable');
      });

      // NOTE: ymail.com is NOT covered by the current override because email.includes('yahoo') is false for ymail.com
      it('should NOT override risky for ymail.com (not matched by current logic)', async () => {
        const responseData = { state: 'risky', reason: 'low_deliverability' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

        const result = await provider.check('user@ymail.com');

        expect(result.status).toBe('risky');
      });

      it('should NOT override risky for non-Yahoo domains', async () => {
        const responseData = { state: 'risky', reason: 'low_deliverability' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

        const result = await provider.check('user@gmail.com');

        expect(result.status).toBe('risky');
      });

      it('should NOT override when Yahoo email state is not risky', async () => {
        const responseData = { state: 'undeliverable', reason: 'rejected_email' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

        const result = await provider.check('user@yahoo.com');

        expect(result.status).toBe('undeliverable');
      });

      it('should NOT override when Yahoo email reason is not low_deliverability', async () => {
        const responseData = { state: 'risky', reason: 'some_other_reason' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

        const result = await provider.check('user@yahoo.com');

        expect(result.status).toBe('risky');
      });

      it('should return deliverable unchanged for Yahoo domain when already deliverable', async () => {
        const responseData = { state: 'deliverable', reason: 'accepted_email' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

        const result = await provider.check('user@yahoo.com');

        expect(result.status).toBe('deliverable');
      });
    });

    // HTTP 249 handling
    describe('HTTP 249 handling', () => {
      it('should return deferred status for HTTP 249', async () => {
        const responseData = { message: 'Verification in progress' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData, 249)));

        const result = await provider.check('user@example.com');

        expect(result.status).toBe('deferred');
        expect(result.apiStatus).toBe(249);
      });

      it('should include the original response data for HTTP 249', async () => {
        const responseData = { message: 'Verification in progress' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData, 249)));

        const result = await provider.check('user@example.com');

        expect(result.response).toEqual(responseData);
      });

      it('should return deferred for Yahoo email with HTTP 249 (249 takes precedence)', async () => {
        const responseData = { message: 'Verification in progress' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData, 249)));

        const result = await provider.check('user@yahoo.com');

        expect(result.status).toBe('deferred');
        expect(result.apiStatus).toBe(249);
      });
    });

    // Error handling
    describe('error handling', () => {
      it('should throw for non-200/non-249 status codes', async () => {
        const responseData = { message: 'Server Error' };
        jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData, 500)));

        await expect(provider.check('user@example.com')).rejects.toThrow('Emailable api error');
      });

      it('should throw when Emailable API returns an error', async () => {
        const axiosError = {
          response: { data: { message: 'Unauthorized' } },
          isAxiosError: true,
        };
        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => axiosError));

        await expect(provider.check('user@example.com')).rejects.toThrow();
      });
    });

    // URL construction
    describe('URL construction', () => {
      it('should encode email in the URL', async () => {
        const responseData = { state: 'deliverable', reason: 'accepted_email' };
        const getSpy = jest.spyOn(httpService, 'get').mockReturnValue(of(makeAxiosResponse(responseData)));

        await provider.check('user+tag@example.com');

        expect(getSpy).toHaveBeenCalledWith(expect.stringContaining('user%2Btag%40example.com'));
      });
    });
  });
});
