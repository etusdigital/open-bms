import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class EmailValidationProvider {
  private httpService: HttpService;

  constructor() {
    this.httpService = new HttpService();
  }

  async emailChecker(email: string, apiKey: string) {
    try {
      const response = await lastValueFrom(
        this.httpService.get(`${process.env.EMAIL_VERIFY_URL}/validate/?email=${encodeURIComponent(email)}`, {
          headers: {
            'api-key': apiKey,
          },
        }),
      );

      return response.data || {};
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(`Error to validate email: ${JSON.stringify(error)}`);
    }
  }
}
