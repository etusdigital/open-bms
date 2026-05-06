import { Injectable } from '@nestjs/common';
import { EmailValidationResult, IEmailValidationProvider } from './email-validation.provider.interface';

@Injectable()
export class NoopProvider implements IEmailValidationProvider {
  async check(email: string): Promise<EmailValidationResult> {
    return {
      email,
      reason: 'noop',
      status: 'deliverable',
      response: { state: 'deliverable', reason: 'noop' },
      apiStatus: 200,
    };
  }
}
