import { SendgridHandler } from './sendgrid.handler';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('SendgridHandler', () => {
  let handler: SendgridHandler;
  let httpService: HttpService;

  beforeEach(() => {
    process.env.SEDNGRID_API_URL = 'https://api.sendgrid.com/v3';
    httpService = {
      get: jest.fn(),
    } as any;
    handler = new SendgridHandler(httpService);
  });

  describe('getStatisticsMessage', () => {
    it('should return zeroed object on HTTP error', async () => {
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => new Error('HTTP Error')));
      const result = await handler.getStatisticsMessage('key', 'name', '2024-01-01', '2024-01-02');
      expect(result).toEqual({ open: 0, click: 0, unsubscribes: 0, unique_open: 0, unique_click: 0, total: 0 });
    });

    it('should return zeroed object on empty array', async () => {
      (httpService.get as jest.Mock).mockReturnValue(of({ data: [] }));
      const result = await handler.getStatisticsMessage('key', 'name', '2024-01-01', '2024-01-02');
      expect(result).toEqual({ open: 0, click: 0, unsubscribes: 0, unique_open: 0, unique_click: 0, total: 0 });
    });
  });

  describe('processReturnStatisticsEmail', () => {
    it('should sum metrics from multiple days', async () => {
      const stats = [
        { stats: [{ metrics: { opens: 5, clicks: 3, unsubscribes: 1, unique_opens: 4, unique_clicks: 2, delivered: 10 } }] },
        { stats: [{ metrics: { opens: 3, clicks: 2, unsubscribes: 0, unique_opens: 3, unique_clicks: 1, delivered: 5 } }] },
      ];
      const result = await handler.processReturnStatisticsEmail(stats);
      expect(result).toEqual({ open: 8, click: 5, unsubscribes: 1, unique_open: 7, unique_click: 3, total: 15 });
    });

    it('should handle missing metrics gracefully', async () => {
      const stats = [{ stats: [{}] }];
      const result = await handler.processReturnStatisticsEmail(stats);
      expect(result).toEqual({ open: 0, click: 0, unsubscribes: 0, unique_open: 0, unique_click: 0, total: 0 });
    });
  });
});
