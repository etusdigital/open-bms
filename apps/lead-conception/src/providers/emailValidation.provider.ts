import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { EmailChecker } from 'src/interfaces';

@Injectable()
export class EmailValidationProvider {
  private httpService: HttpService;

  constructor() {
    this.httpService = new HttpService();
  }

  async emailChecker(email: string, apiKey: string): Promise<EmailChecker> {
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
      console.log(`Error to validate email: ${JSON.stringify(error)}`);
      return {} as EmailChecker;
      // throw new InternalServerErrorException(`Error to validate email: ${JSON.stringify(error)}`);
    }
  }
}
