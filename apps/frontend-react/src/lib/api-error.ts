import { isAxiosError } from 'axios';

/**
 * Extract a user-facing error message from an API error response.
 * Returns null if the error is not an Axios error or has no message.
 */
export function extractApiErrorMessage(error: unknown): string | null {
  if (!isAxiosError(error)) return null;

  const data = error.response?.data;

  // Prefer .message (descriptive) over .error (generic like "Forbidden")
  if (typeof data?.message === 'string') {
    return data.message;
  }
  if (typeof data?.error === 'string') {
    return data.error;
  }

  return null;
}
