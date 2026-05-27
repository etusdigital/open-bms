const mockJson = jest.fn();
const mockQuery = jest.fn();

jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn().mockReturnValue({
    query: mockQuery,
  }),
}));

import { ClickhouseProvider } from './clickhouse.provider';

describe('ClickhouseProvider', () => {
  let provider: ClickhouseProvider;

  beforeEach(() => {
    process.env.CLICKHOUSE_HOST = 'http://localhost:8123';
    process.env.CLICKHOUSE_USERNAME = 'default';
    process.env.CLICKHOUSE_PASSWORD = '';
    process.env.CLICKHOUSE_DATABASE = 'test_db';
    mockQuery.mockReset();
    mockJson.mockReset();
    provider = new ClickhouseProvider();
  });

  describe('runQuery', () => {
    it('should return data from clickhouse query', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      mockQuery.mockResolvedValue({ json: jest.fn().mockResolvedValue({ data: mockData }) });

      const result = await provider.runQuery('SELECT * FROM events');

      expect(result).toEqual(mockData);
    });

    it('should return empty array when no data', async () => {
      mockQuery.mockResolvedValue({ json: jest.fn().mockResolvedValue({}) });

      const result = await provider.runQuery('SELECT * FROM events WHERE 1=0');

      expect(result).toEqual([]);
    });

    it('should pass correct format to query', async () => {
      mockQuery.mockResolvedValue({ json: jest.fn().mockResolvedValue({ data: [] }) });

      await provider.runQuery('SELECT 1');

      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ format: 'JSON' }));
    });

    it('should throw when query fails', async () => {
      mockQuery.mockRejectedValue(new Error('query failed'));

      await expect(provider.runQuery('BAD SQL')).rejects.toThrow('query failed');
    });
  });
});
