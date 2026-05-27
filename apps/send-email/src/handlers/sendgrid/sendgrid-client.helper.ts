import * as sendgrid from '@sendgrid/mail';

// `@sendgrid/mail` exposes the underlying low-level client at runtime via the
// `client` property, but its TypeScript declarations don't surface it.
// Centralize the cast here so callers don't have to reach for
// `as unknown as { client?: ... }` every time they need to mutate
// `defaultRequest.baseUrl`.
export interface SendGridLowLevelClient {
  setDefaultRequest: (key: string, value: string) => void;
  defaultRequest: {
    baseUrl: string;
    [k: string]: unknown;
  };
}

export function getSendGridClient(): SendGridLowLevelClient | undefined {
  return (sendgrid as unknown as { client?: SendGridLowLevelClient }).client;
}
