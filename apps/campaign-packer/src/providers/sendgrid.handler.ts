import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { env } from 'process';

@Injectable()
export class SendgridHandler {
  constructor(private readonly httpService: HttpService) {}

  async getStatisticsMessage(sendgriApiKey: string, name: string, startDate: string, endDate: string) {
    try {
      const result = await this.httpService
        .get(`${env.SEDNGRID_API_URL}/categories/stats?start_date=${startDate}&end_date=${endDate}&categories=id_${name}`, {
          headers: {
            Authorization: `Bearer ${sendgriApiKey}`,
          },
        })
        .toPromise();

      return await this.processReturnStatisticsEmail(result.data);
    } catch {
      return await this.processReturnStatisticsEmail([]);
    }
  }

  async processReturnStatisticsEmail(statistics) {
    const statisticsReturn = { open: 0, click: 0, unsubscribes: 0, unique_open: 0, unique_click: 0, total: 0 };

    for (const statistic of statistics) {
      statisticsReturn.open += statistic?.stats[0]?.metrics?.opens || 0;
      statisticsReturn.click += statistic?.stats[0]?.metrics?.clicks || 0;
      statisticsReturn.unsubscribes += statistic?.stats[0]?.metrics?.unsubscribes || 0;
      statisticsReturn.unique_open += statistic?.stats[0]?.metrics?.unique_opens || 0;
      statisticsReturn.unique_click += statistic?.stats[0]?.metrics?.unique_clicks || 0;
      statisticsReturn.total += statistic?.stats[0]?.metrics?.delivered || 0;
    }
    return statisticsReturn;
  }
}
