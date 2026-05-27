import { ClickhouseProvider } from './clickhouse.provider';
import { createClient } from '@clickhouse/client';

// Mock @clickhouse/client module
const mockQuery = jest.fn();
jest.mock('@clickhouse/client', () => ({
  createClient: jest.fn(() => ({
    query: mockQuery,
  })),
}));

describe('ClickhouseProvider', () => {
  let provider: ClickhouseProvider;

  beforeEach(() => {
    // Set up environment variables for test
    process.env.CLICKHOUSE_HOST = 'http://localhost:8123';
    process.env.CLICKHOUSE_USERNAME = 'test_user';
    process.env.CLICKHOUSE_PASSWORD = 'test_pass';
    process.env.CLICKHOUSE_DATABASE = 'test_db';

    jest.clearAllMocks();
    provider = new ClickhouseProvider();
  });

  describe('instantiation', () => {
    it('should create the provider successfully', () => {
      expect(provider).toBeDefined();
    });

    it('should have runQuery method defined', () => {
      expect(provider.runQuery).toBeDefined();
      expect(typeof provider.runQuery).toBe('function');
    });

    it('should call createClient with correct config', () => {
      expect(createClient).toHaveBeenCalledWith({
        host: 'http://localhost:8123',
        username: 'test_user',
        password: 'test_pass',
        database: 'test_db',
        request_timeout: 60 * 60 * 1000,
      });
    });
  });

  describe('runQuery', () => {
    it('should execute query and return data array', async () => {
      const mockData = [
        { contact_id: 123, event: 'resubscribed', account_id: 1 },
        { contact_id: 456, event: 'clicked', account_id: 1 },
      ];

      mockQuery.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ data: mockData }),
      });

      const sql = 'SELECT * FROM events_logs_v2 WHERE account_id = 1';
      const result = await provider.runQuery(sql);

      expect(mockQuery).toHaveBeenCalledWith({
        query: sql,
        format: 'JSON',
      });
      expect(result).toEqual(mockData);
    });

    it('should return empty array when response.data is undefined', async () => {
      mockQuery.mockResolvedValue({
        json: jest.fn().mockResolvedValue({}),
      });

      const result = await provider.runQuery('SELECT * FROM events_logs_v2');

      expect(result).toEqual([]);
    });

    it('should return empty array when no results found', async () => {
      mockQuery.mockResolvedValue({
        json: jest.fn().mockResolvedValue({ data: [] }),
      });

      const result = await provider.runQuery('SELECT * FROM events_logs_v2 WHERE 1=0');

      expect(result).toEqual([]);
    });
  });
});
