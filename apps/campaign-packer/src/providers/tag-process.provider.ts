import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { env } from 'process';

@Injectable()
export class TagProcessProvider {
  constructor(private readonly httpService: HttpService) {}

  async processSegment(segmentId: number) {
    // The stack defines this as TAG_PROCESS_ENDPOINT (the *_ENDPOINT convention
    // used by every other service URL here). The old code read TAG_PROCESS_API,
    // which the stack never set → `undefined${segmentId}?is_campaign=true` → an
    // Invalid URL → HTTP 500 → every campaign dispatch failed silently. Prefer
    // TAG_PROCESS_ENDPOINT, keep TAG_PROCESS_API as a fallback, and normalize the
    // trailing slash so the value works with or without one.
    const base = (env.TAG_PROCESS_ENDPOINT || env.TAG_PROCESS_API || '').replace(/\/+$/, '');
    if (!base) {
      throw new Error('TAG_PROCESS_ENDPOINT (or TAG_PROCESS_API) is not configured');
    }
    const result = await this.httpService.post(`${base}/${segmentId}?is_campaign=true`).toPromise();

    return await result.data;
  }
}
