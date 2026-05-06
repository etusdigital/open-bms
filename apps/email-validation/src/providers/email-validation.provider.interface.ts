export const EMAIL_VALIDATION_PROVIDER_TOKEN = Symbol('EMAIL_VALIDATION_PROVIDER');

export interface EmailValidationResult {
  email: string;
  reason: string;
  status: string;
  response: any;
  apiStatus: number;
}

export interface IEmailValidationProvider {
  check(email: string): Promise<EmailValidationResult>;
}
