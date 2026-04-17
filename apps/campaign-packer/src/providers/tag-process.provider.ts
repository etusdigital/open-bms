import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { env } from 'process';

@Injectable()
export class TagProcessProvider {
  constructor(private readonly httpService: HttpService) {}

  async processSegment(segmentId: number) {
    const result = await this.httpService.post(`${env.TAG_PROCESS_API}${segmentId}?is_campaign=true`).toPromise();

    return await result.data;
  }
}
