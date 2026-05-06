import { Test, TestingModule } from '@nestjs/testing';
import { NoopProvider } from './noop.provider';

describe('NoopProvider', () => {
  let provider: NoopProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NoopProvider],
    }).compile();

    provider = module.get<NoopProvider>(NoopProvider);
  });

  describe('check()', () => {
    it('should return deliverable with apiStatus 200 for any email', async () => {
      const result = await provider.check('user@example.com');

      expect(result.email).toBe('user@example.com');
      expect(result.status).toBe('deliverable');
      expect(result.apiStatus).toBe(200);
    });

    it('should always return reason "noop"', async () => {
      const result = await provider.check('any@thing.com');

      expect(result.reason).toBe('noop');
      expect(result.response).toEqual({ state: 'deliverable', reason: 'noop' });
    });

    it('should preserve the email in the result', async () => {
      const result = await provider.check('preserved+tag@domain.io');

      expect(result.email).toBe('preserved+tag@domain.io');
    });
  });
});
