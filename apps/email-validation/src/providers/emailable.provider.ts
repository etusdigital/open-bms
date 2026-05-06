import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { env } from 'process';
import { AxiosError } from 'axios';
import { catchError, lastValueFrom } from 'rxjs';
import { EmailValidationResult, IEmailValidationProvider } from './email-validation.provider.interface';

@Injectable()
export class EmailableProvider implements IEmailValidationProvider {
  private httpService: HttpService;

  constructor() {
    this.httpService = new HttpService();
  }

  async check(email: string): Promise<EmailValidationResult> {
    const url = `${env.EMAILABLE_URL}?email=${encodeURIComponent(email)}&timeout=30&api_key=${env.EMAILABLE_API_KEY}`;
    const response = await lastValueFrom(
      this.httpService.get(url).pipe(
        catchError((error: AxiosError) => {
          console.log(`Emailable api error for email: ${email}`, error.response.data);
          throw new Error(`Emailable api error ${response.data.message}`);
        }),
      ),
    );

    if (response.status !== 200) {
      console.log(`Emailable api error ${response.status} - ${email}: `, response.data);
      if (response.status === 249) {
        return {
          email,
          reason: 'Your email is still being verified. Please wait and send your request again',
          status: 'deferred',
          response: response.data,
          apiStatus: response.status,
        };
      }
      throw new Error(`Emailable api error ${response.data.message}`);
    }

    if (email.includes('yahoo')) {
      if (response.data.state === 'risky' && response.data.reason === 'low_deliverability') {
        /*
          # Email addresses provided by Yahoo have been downgraded to Risky as of September 7th, 2023
          Addresses provided by Yahoo do not meet our stringent requirements to be classified as Deliverable. 
          Yahoo addresses previously classified as Deliverable will instead be classified as Risky, as we cannot guarantee the deliverability of these addresses. 
          Undeliverable addresses can still be identified and are unaffected by this change.
         */

        response.data.state = 'deliverable';
      }
    }

    return {
      email,
      reason: response.data.reason,
      status: response.data.state,
      response: response.data,
      apiStatus: response.status,
    };
  }
}
