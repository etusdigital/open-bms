import { Injectable } from '@nestjs/common';
import { createClient } from '@clickhouse/client';

@Injectable()
export class ClickhouseProvider {
  private client;

  constructor() {
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST,
      username: process.env.CLICKHOUSE_USERNAME,
      password: process.env.CLICKHOUSE_PASSWORD,
      database: process.env.CLICKHOUSE_DATABASE,
      request_timeout: 60 * 60 * 1000,
    });
  }

  async runQuery(sql: string) {
    const resultSet = await this.client.query({
      query: sql,
      format: 'JSON',
    });

    const response = await resultSet.json();
    return response.data || [];
  }
}
