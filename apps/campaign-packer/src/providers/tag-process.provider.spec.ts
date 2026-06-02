import { TagProcessProvider } from './tag-process.provider';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('TagProcessProvider', () => {
  let provider: TagProcessProvider;
  let httpService: HttpService;

  beforeEach(() => {
    delete process.env.TAG_PROCESS_ENDPOINT;
    delete process.env.TAG_PROCESS_API;
    process.env.TAG_PROCESS_API = 'http://api/';
    httpService = {
      post: jest.fn().mockReturnValue(of({ data: { count: 100 } })),
    } as any;
    provider = new TagProcessProvider(httpService);
  });

  afterEach(() => {
    delete process.env.TAG_PROCESS_ENDPOINT;
    delete process.env.TAG_PROCESS_API;
  });

  describe('processSegment', () => {
    it('should call correct URL (legacy TAG_PROCESS_API with trailing slash)', async () => {
      await provider.processSegment(42);
      expect(httpService.post).toHaveBeenCalledWith('http://api/42?is_campaign=true');
    });

    it('prefers TAG_PROCESS_ENDPOINT and adds the slash when missing (the real stack case)', async () => {
      delete process.env.TAG_PROCESS_API;
      process.env.TAG_PROCESS_ENDPOINT = 'http://tag-process:3000/process-segment';
      await provider.processSegment(42);
      expect(httpService.post).toHaveBeenCalledWith('http://tag-process:3000/process-segment/42?is_campaign=true');
    });

    it('does not double the slash when the value already ends with one', async () => {
      delete process.env.TAG_PROCESS_API;
      process.env.TAG_PROCESS_ENDPOINT = 'http://tag-process:3000/process-segment/';
      await provider.processSegment(42);
      expect(httpService.post).toHaveBeenCalledWith('http://tag-process:3000/process-segment/42?is_campaign=true');
    });

    it('throws a clear error when neither env var is set (no silent Invalid URL)', async () => {
      delete process.env.TAG_PROCESS_API;
      delete process.env.TAG_PROCESS_ENDPOINT;
      await expect(provider.processSegment(42)).rejects.toThrow(/TAG_PROCESS_ENDPOINT/);
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should return response data', async () => {
      const result = await provider.processSegment(42);
      expect(result).toEqual({ count: 100 });
    });
  });
});
