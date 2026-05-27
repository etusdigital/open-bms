// Mask format used everywhere we surface a stored SendGrid key to the UI:
// `SG.****...<last 4>`. Never returns the plaintext key over HTTP.
const KEY_MASK_PREFIX = 'SG.****...';

export function maskApiKey(apiKey: string): string {
  const last4 = apiKey.slice(-4);
  return `${KEY_MASK_PREFIX}${last4}`;
}
