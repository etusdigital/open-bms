export function maskEmail(email: string | null | undefined): string | null {
  // Handle null and undefined
  if (email === null || email === undefined) {
    return null;
  }

  // Handle empty string
  if (email === '') {
    return '';
  }

  // Find the position of the @ symbol
  const atIndex = email.indexOf('@');

  // If no @ symbol, return the original string (graceful degradation)
  if (atIndex === -1) {
    return email;
  }

  // Extract username (before @) and domain (@ and after)
  const username = email.substring(0, atIndex);
  const domain = email.substring(atIndex);

  // Determine how many characters to show (max 5, or length of username if shorter)
  const charsToShow = Math.min(5, username.length);

  // Show the first N chars, then always exactly 3 asterisks
  const visiblePart = username.substring(0, charsToShow);
  const maskedPart = '***'; // Always exactly 3 asterisks

  return visiblePart + maskedPart + domain;
}
