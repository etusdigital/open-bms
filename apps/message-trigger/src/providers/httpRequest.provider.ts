import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { TrackerService } from 'src/tracker/tracker.service';

@Injectable()
export class HttpRequestProvider {
  private httpService: HttpService;

  constructor(private readonly trackerService: TrackerService) {
    this.httpService = new HttpService();
  }

  async process(type, route, headers, payload) {
    this.trackerService.log('[HTTP-REQUEST] - LOG', { type, route, headers, payload: JSON.stringify(payload) });

    try {
      if (['get', 'delete'].includes(type)) {
        const response = await lastValueFrom(
          this.httpService[type](route, {
            headers,
          }),
        );
        this.trackerService.log('[HTTP-REQUEST] - response: ', JSON.stringify(response));
        return response;
      }

      const response = await lastValueFrom(
        this.httpService[type](route, payload, {
          headers,
        }),
      );

      return response;
    } catch (error) {
      console.log(`[HTTP-REQUEST] - Error to send: ${JSON.stringify(error)}`);
      throw new InternalServerErrorException(`[HTTP-REQUEST] - Error to send: ${JSON.stringify(error)}`);
    }
  }
}
