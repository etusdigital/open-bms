import { addTrailingSlash } from './add-trailing-slash';

describe('addTrailingSlash', () => {
  const cases: Array<[string, string, string]> = [
    ['adds slash before query', 'https://example.com/lp?utm=x', 'https://example.com/lp/?utm=x'],
    ['idempotent when slash present', 'https://example.com/lp/?utm=x', 'https://example.com/lp/?utm=x'],
    ['adds slash before hash', 'https://example.com/lp#s', 'https://example.com/lp/#s'],
    ['adds slash before query with hash', 'https://example.com/lp?a=1#s', 'https://example.com/lp/?a=1#s'],
    ['adds slash when first token is ? (multi-?)', 'https://example.com/lp?a=?b', 'https://example.com/lp/?a=?b'],
    ['skips file extension', 'https://example.com/file.pdf?utm=x', 'https://example.com/file.pdf?utm=x'],
    ['skips xml extension', 'https://example.com/sitemap.xml', 'https://example.com/sitemap.xml'],
    ['allows dotted segment that is not the last segment', 'https://example.com/v1.2/users?a=1', 'https://example.com/v1.2/users/?a=1'],
    ['adds slash to bare host', 'https://example.com', 'https://example.com/'],
    ['idempotent on bare host with slash', 'https://example.com/', 'https://example.com/'],
    ['allows template in query', 'https://example.com/p?id={{contact.id}}', 'https://example.com/p/?id={{contact.id}}'],
    ['skips template in path', 'https://example.com/u/{{id}}?utm=x', 'https://example.com/u/{{id}}?utm=x'],
    ['skips mailto', 'mailto:a@b.co', 'mailto:a@b.co'],
    ['skips tel', 'tel:+15551234', 'tel:+15551234'],
    ['skips MAILTO (case-insensitive)', 'MAILTO:a@b.co', 'MAILTO:a@b.co'],
    ['adds slash to multi-TLD bare host', 'https://example.com.br', 'https://example.com.br/'],
    ['adds slash to short-TLD bare host', 'https://example.dev', 'https://example.dev/'],
    ['adds slash to subdomain + multi-TLD bare host', 'https://subdomainx.domainexample.com.br', 'https://subdomainx.domainexample.com.br/'],
    ['adds slash to multi-TLD bare host with query', 'https://example.com.br?utm=x', 'https://example.com.br/?utm=x'],
    ['adds slash on multi-TLD host with path', 'https://example.com.br/page?utm=x', 'https://example.com.br/page/?utm=x'],
    ['adds slash on subdomain with path', 'https://api.example.com/v1/users', 'https://api.example.com/v1/users/'],
    ['skips file extension on multi-TLD host', 'https://example.com.br/file.html', 'https://example.com.br/file.html'],
  ];

  for (const [name, input, expected] of cases) {
    it(name, () => {
      expect(addTrailingSlash(input)).toBe(expected);
    });
  }

  it('is idempotent for every case', () => {
    for (const [, input] of cases) {
      const once = addTrailingSlash(input);
      expect(addTrailingSlash(once)).toBe(once);
    }
  });
});
