// Returns url unchanged when any skip rule matches; otherwise inserts '/'
// immediately before the first '?' or '#', or appends if neither exists.
//
// Callers must pass a normalised (trimmed) URL string.
export function addTrailingSlash(url: string): string {
  // Skip non-web schemes (mailto/tel/sms links commonly appear in email HTML).
  const lower = url.toLowerCase();
  if (
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('sms:')
  ) {
    return url;
  }

  // Find the first '?' or '#' — that's where the path ends.
  const queryIdx = url.indexOf('?');
  const hashIdx = url.indexOf('#');
  const boundary =
    queryIdx === -1
      ? hashIdx === -1
        ? url.length
        : hashIdx
      : hashIdx === -1
        ? queryIdx
        : Math.min(queryIdx, hashIdx);

  const pathPart = url.slice(0, boundary);
  const suffix = url.slice(boundary);

  // Skip path-segment templates (query templates are fine).
  if (pathPart.includes('{{')) return url;

  // Already has a trailing slash on path.
  if (pathPart.endsWith('/')) return url;

  // Bare host (no path after scheme) — append slash unconditionally.
  // Find the start of the path portion after '://' (if scheme present).
  const schemeIdx = pathPart.indexOf('://');
  const pathStart = schemeIdx === -1 ? 0 : schemeIdx + 3;
  const hasPathSegment = pathPart.indexOf('/', pathStart) !== -1;

  if (hasPathSegment) {
    // Last segment looks like a file extension (.ext at the very end,
    // 1-8 alphanumeric chars). Correctly lets '/v1.2/users' through.
    if (/\.[A-Za-z0-9]{1,8}$/.test(pathPart)) return url;
  }

  return `${pathPart}/${suffix}`;
}
