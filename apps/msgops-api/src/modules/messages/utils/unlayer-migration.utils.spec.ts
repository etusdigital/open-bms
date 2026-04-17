import { extractUnlayerUrlsFromHtml, extractUnlayerUrlsFromJson, replaceUrlsInHtml, replaceUrlsInJson, hasUnlayerUrls } from './unlayer-migration.utils';

describe('Unlayer Migration Utils', () => {
  describe('hasUnlayerUrls', () => {
    it('should return true for cdn.tools.unlayer.com URLs', () => {
      const content = '<img src="https://cdn.tools.unlayer.com/image.png" />';
      expect(hasUnlayerUrls(content)).toBe(true);
    });

    it('should return true for assets.unlayer.com URLs', () => {
      const content = '<img src="https://assets.unlayer.com/image.png" />';
      expect(hasUnlayerUrls(content)).toBe(true);
    });

    it('should return false for non-Unlayer URLs', () => {
      const content = '<img src="https://example.com/image.png" />';
      expect(hasUnlayerUrls(content)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasUnlayerUrls('')).toBe(false);
    });

    it('should be case-insensitive', () => {
      const content = '<img src="HTTPS://CDN.TOOLS.UNLAYER.COM/image.png" />';
      expect(hasUnlayerUrls(content)).toBe(true);
    });
  });

  describe('extractUnlayerUrlsFromHtml', () => {
    it('should extract single Unlayer URL from img src', () => {
      const html = '<img src="https://cdn.tools.unlayer.com/image.png" />';
      const urls = extractUnlayerUrlsFromHtml(html);
      expect(urls).toEqual(['https://cdn.tools.unlayer.com/image.png']);
    });

    it('should extract multiple Unlayer URLs', () => {
      const html = `
        <img src="https://cdn.tools.unlayer.com/image1.png" />
        <img src="https://assets.unlayer.com/image2.jpg" />
      `;
      const urls = extractUnlayerUrlsFromHtml(html);
      expect(urls).toHaveLength(2);
      expect(urls).toContain('https://cdn.tools.unlayer.com/image1.png');
      expect(urls).toContain('https://assets.unlayer.com/image2.jpg');
    });

    it('should extract URLs with query parameters', () => {
      const html = '<img src="https://cdn.tools.unlayer.com/image.png?w=800&h=600" />';
      const urls = extractUnlayerUrlsFromHtml(html);
      expect(urls).toEqual(['https://cdn.tools.unlayer.com/image.png?w=800&h=600']);
    });

    it('should deduplicate identical URLs', () => {
      const html = `
        <img src="https://cdn.tools.unlayer.com/image.png" />
        <img src="https://cdn.tools.unlayer.com/image.png" />
      `;
      const urls = extractUnlayerUrlsFromHtml(html);
      expect(urls).toHaveLength(1);
    });

    it('should ignore non-Unlayer URLs', () => {
      const html = `
        <img src="https://cdn.tools.unlayer.com/image1.png" />
        <img src="https://example.com/image2.png" />
      `;
      const urls = extractUnlayerUrlsFromHtml(html);
      expect(urls).toHaveLength(1);
      expect(urls).toContain('https://cdn.tools.unlayer.com/image1.png');
    });

    it('should return empty array when no Unlayer URLs found', () => {
      const html = '<img src="https://example.com/image.png" />';
      const urls = extractUnlayerUrlsFromHtml(html);
      expect(urls).toEqual([]);
    });

    it('should handle different HTML attributes (background, style)', () => {
      const html = `
        <div style="background: url('https://cdn.tools.unlayer.com/bg.png')"></div>
        <td background="https://assets.unlayer.com/bg2.png"></td>
      `;
      const urls = extractUnlayerUrlsFromHtml(html);
      expect(urls.length).toBeGreaterThan(0);
    });
  });

  describe('extractUnlayerUrlsFromJson', () => {
    it('should extract URLs from Unlayer JSON structure', () => {
      const json = JSON.stringify({
        body: {
          rows: [
            {
              cells: [
                {
                  contents: [
                    {
                      type: 'image',
                      values: {
                        src: 'https://cdn.tools.unlayer.com/image.png',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
      const urls = extractUnlayerUrlsFromJson(json);
      expect(urls).toContain('https://cdn.tools.unlayer.com/image.png');
    });

    it('should extract URLs from nested objects', () => {
      const json = JSON.stringify({
        level1: {
          level2: {
            level3: {
              image: 'https://assets.unlayer.com/deep.png',
            },
          },
        },
      });
      const urls = extractUnlayerUrlsFromJson(json);
      expect(urls).toContain('https://assets.unlayer.com/deep.png');
    });

    it('should extract URLs from arrays', () => {
      const json = JSON.stringify({
        images: ['https://cdn.tools.unlayer.com/img1.png', 'https://cdn.tools.unlayer.com/img2.png'],
      });
      const urls = extractUnlayerUrlsFromJson(json);
      expect(urls).toHaveLength(2);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = 'not valid json {';
      const urls = extractUnlayerUrlsFromJson(invalidJson);
      expect(urls).toEqual([]);
    });

    it('should handle null/undefined', () => {
      expect(extractUnlayerUrlsFromJson(null as any)).toEqual([]);
      expect(extractUnlayerUrlsFromJson(undefined as any)).toEqual([]);
    });
  });

  describe('replaceUrlsInHtml', () => {
    it('should replace single URL', () => {
      const html = '<img src="https://cdn.tools.unlayer.com/old.png" />';
      const urlMap = new Map([['https://cdn.tools.unlayer.com/old.png', 'https://storage.googleapis.com/new.png']]);
      const result = replaceUrlsInHtml(html, urlMap);
      expect(result).toBe('<img src="https://storage.googleapis.com/new.png" />');
    });

    it('should replace multiple URLs', () => {
      const html = `
        <img src="https://cdn.tools.unlayer.com/img1.png" />
        <img src="https://assets.unlayer.com/img2.png" />
      `;
      const urlMap = new Map([
        ['https://cdn.tools.unlayer.com/img1.png', 'https://storage.googleapis.com/new1.png'],
        ['https://assets.unlayer.com/img2.png', 'https://storage.googleapis.com/new2.png'],
      ]);
      const result = replaceUrlsInHtml(html, urlMap);
      expect(result).toContain('https://storage.googleapis.com/new1.png');
      expect(result).toContain('https://storage.googleapis.com/new2.png');
    });

    it('should replace all occurrences of same URL', () => {
      const html = `
        <img src="https://cdn.tools.unlayer.com/img.png" />
        <img src="https://cdn.tools.unlayer.com/img.png" />
      `;
      const urlMap = new Map([['https://cdn.tools.unlayer.com/img.png', 'https://storage.googleapis.com/new.png']]);
      const result = replaceUrlsInHtml(html, urlMap);
      const matches = result.match(/https:\/\/storage\.googleapis\.com\/new\.png/g);
      expect(matches).toHaveLength(2);
    });

    it('should handle special regex characters in URLs', () => {
      const html = '<img src="https://cdn.tools.unlayer.com/img.png?w=100&h=100" />';
      const urlMap = new Map([['https://cdn.tools.unlayer.com/img.png?w=100&h=100', 'https://storage.googleapis.com/new.png']]);
      const result = replaceUrlsInHtml(html, urlMap);
      expect(result).toContain('https://storage.googleapis.com/new.png');
    });

    it('should handle URLs with different paths correctly', () => {
      const html = '<img src="https://cdn.tools.unlayer.com/image1.png" /><img src="https://cdn.tools.unlayer.com/image2.png" />';
      const urlMap = new Map([['https://cdn.tools.unlayer.com/image1.png', 'https://storage.googleapis.com/new1.png']]);
      const result = replaceUrlsInHtml(html, urlMap);
      expect(result).toContain('https://storage.googleapis.com/new1.png');
      expect(result).toContain('https://cdn.tools.unlayer.com/image2.png');
    });

    it('should handle empty map', () => {
      const html = '<img src="https://cdn.tools.unlayer.com/img.png" />';
      const urlMap = new Map();
      const result = replaceUrlsInHtml(html, urlMap);
      expect(result).toBe(html);
    });
  });

  describe('replaceUrlsInJson', () => {
    it('should replace URLs in JSON string', () => {
      const json = JSON.stringify({
        image: 'https://cdn.tools.unlayer.com/old.png',
      });
      const urlMap = new Map([['https://cdn.tools.unlayer.com/old.png', 'https://storage.googleapis.com/new.png']]);
      const result = replaceUrlsInJson(json, urlMap);
      expect(result).toContain('https://storage.googleapis.com/new.png');
      expect(result).not.toContain('https://cdn.tools.unlayer.com/old.png');
    });

    it('should replace multiple URLs in JSON', () => {
      const json = JSON.stringify({
        images: ['https://cdn.tools.unlayer.com/img1.png', 'https://assets.unlayer.com/img2.png'],
      });
      const urlMap = new Map([
        ['https://cdn.tools.unlayer.com/img1.png', 'https://storage.googleapis.com/new1.png'],
        ['https://assets.unlayer.com/img2.png', 'https://storage.googleapis.com/new2.png'],
      ]);
      const result = replaceUrlsInJson(json, urlMap);
      expect(result).toContain('https://storage.googleapis.com/new1.png');
      expect(result).toContain('https://storage.googleapis.com/new2.png');
    });

    it('should preserve JSON structure', () => {
      const json = JSON.stringify({
        nested: {
          image: 'https://cdn.tools.unlayer.com/img.png',
        },
      });
      const urlMap = new Map([['https://cdn.tools.unlayer.com/img.png', 'https://storage.googleapis.com/new.png']]);
      const result = replaceUrlsInJson(json, urlMap);
      const parsed = JSON.parse(result);
      expect(parsed.nested.image).toBe('https://storage.googleapis.com/new.png');
    });
  });
});
