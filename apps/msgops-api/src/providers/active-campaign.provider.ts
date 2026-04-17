import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class ActiveCampaignProvider {
  constructor(private readonly httpService: HttpService) {}

  async getLists(stepSettings) {
    const headers = {
      'content-type': 'application/json',
      'Api-Token': `${stepSettings.apiKey}`,
    };

    try {
      const response = await this.httpService.get(`https://${stepSettings.accountName}.api-us1.com/api/3/lists`, { headers }).toPromise();

      return response.data;
    } catch (error) {
      console.log('Log - error', error.response.data);
      if (error.response && error.response.data) {
        return error.response.data;
      }

      throw new HttpException(`Error to get lists, check api key.`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
