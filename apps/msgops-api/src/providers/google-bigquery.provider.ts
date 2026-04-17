import { Injectable } from '@nestjs/common';
import { BigQuery } from '@google-cloud/bigquery';

@Injectable()
export class GoogleBigqueryProvider {
  private client: BigQuery;

  constructor() {
    const options = {
      credentials: JSON.parse(process.env.SERVICE_ACCOUNT || '{}'),
    };

    this.client = new BigQuery(options);
  }

  async runQuery(query: string) {
    const options = {
      query: query,
      location: 'us-east1',
    };
    const [job] = await this.client.createQueryJob(options);
    const [rows] = await job.getQueryResults();

    return rows;
  }
}
