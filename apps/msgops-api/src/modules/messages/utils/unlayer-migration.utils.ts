// Consolidated regex pattern for Unlayer URLs (used across all functions)
const UNLAYER_URL_PATTERN = /https:\/\/(cdn\.tools\.unlayer\.com|assets\.unlayer\.com)\/[^\s"'>)]+/gi;
const UNLAYER_DOMAIN_PATTERN = /https:\/\/(cdn\.tools\.unlayer\.com|assets\.unlayer\.com)\//i;

export function hasUnlayerUrls(content: string): boolean {
  if (!content) return false;
  return UNLAYER_DOMAIN_PATTERN.test(content);
}

export function extractUnlayerUrlsFromHtml(html: string): string[] {
  if (!html) return [];

  const urls = new Set<string>();
  // Reset regex lastIndex to avoid stale state
  const regex = new RegExp(UNLAYER_URL_PATTERN.source, UNLAYER_URL_PATTERN.flags);

  let match;
  while ((match = regex.exec(html)) !== null) {
    urls.add(match[0]);
  }

  return Array.from(urls);
}

export function extractUnlayerUrlsFromJson(contentJson: string): string[] {
  if (!contentJson) return [];

  const urls = new Set<string>();

  try {
    const json = JSON.parse(contentJson);

    const traverse = (obj: any) => {
      if (typeof obj === 'string') {
        // Use consolidated domain pattern for consistency
        if (UNLAYER_DOMAIN_PATTERN.test(obj)) {
          urls.add(obj);
        }
      } else if (Array.isArray(obj)) {
        obj.forEach(traverse);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(traverse);
      }
    };

    traverse(json);
  } catch (error) {
    console.warn('[Unlayer Migration] JSON parse failed:', error.message);
    return [];
  }

  return Array.from(urls);
}

export function replaceUrlsInHtml(html: string, urlMap: Map<string, string>): string {
  if (!html || urlMap.size === 0) return html;

  let result = html;

  urlMap.forEach((newUrl, oldUrl) => {
    // Escape special regex characters in the URL
    const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundary to avoid partial matches
    const regex = new RegExp(escaped, 'g');
    result = result.replace(regex, newUrl);
  });

  return result;
}

export function replaceUrlsInJson(json: string, urlMap: Map<string, string>): string {
  if (!json || urlMap.size === 0) return json;

  let result = json;

  urlMap.forEach((newUrl, oldUrl) => {
    // Escape special regex characters in the URL
    const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    result = result.replace(regex, newUrl);
  });

  return result;
}
