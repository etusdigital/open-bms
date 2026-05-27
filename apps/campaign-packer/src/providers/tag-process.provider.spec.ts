import { TagProcessProvider } from './tag-process.provider';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('TagProcessProvider', () => {
  let provider: TagProcessProvider;
  let httpService: HttpService;

  beforeEach(() => {
    process.env.TAG_PROCESS_API = 'http://api/';
    httpService = {
      post: jest.fn().mockReturnValue(of({ data: { count: 100 } })),
    } as any;
    provider = new TagProcessProvider(httpService);
  });

  describe('processSegment', () => {
    it('should call correct URL', async () => {
      await provider.processSegment(42);
      expect(httpService.post).toHaveBeenCalledWith('http://api/42?is_campaign=true');
    });

    it('should return response data', async () => {
      const result = await provider.processSegment(42);
      expect(result).toEqual({ count: 100 });
    });
  });
});
