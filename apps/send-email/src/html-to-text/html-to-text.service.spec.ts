import { HtmlToTextService } from './html-to-text.service';

describe('HtmlToTextService', () => {
  let service: HtmlToTextService;

  beforeEach(() => {
    service = new HtmlToTextService();
    service.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should compile the converter on init', () => {
      expect((service as any).compiledConvert).toBeDefined();
      expect(typeof (service as any).compiledConvert).toBe('function');
    });
  });

  describe('convert', () => {
    it('should return single space for null input', () => {
      expect(service.convert(null)).toBe(' ');
    });

    it('should return single space for empty string input', () => {
      expect(service.convert('')).toBe(' ');
    });

    it('should return single space for undefined input', () => {
      expect(service.convert(undefined)).toBe(' ');
    });

    it('should return single space for HTML with no visible text content', () => {
      const emptyStructuralHtml = `<html><body><div style="box-sizing: border-box;"></div></body></html>`;
      expect(service.convert(emptyStructuralHtml)).toBe(' ');
    });

    it('should convert simple HTML to text', () => {
      const html = '<p>Hello World</p>';
      const result = service.convert(html);
      expect(result).toContain('Hello World');
    });

    it('should remove sendgrid open tracking placeholder', () => {
      const html = '<p>Content</p><div>sendgrid_open_tracking</div>';
      const result = service.convert(html);
      expect(result).not.toContain('sendgrid_open_tracking');
    });

    it('should remove sendgrid_open_tracking case-insensitively', () => {
      const html = '<p>Content</p><div>SENDGRID_OPEN_TRACKING</div>';
      const result = service.convert(html);
      expect(result).not.toContain('SENDGRID_OPEN_TRACKING');
    });

    it('should remove orphaned standalone URLs on their own line', () => {
      const html = '<p>Text before</p><a href="https://example.com/track"><img src="pixel.png"/></a><p>Text after</p>';
      const result = service.convert(html);
      expect(result).not.toMatch(/^\s*https?:\/\/[^\s]+\s*$/m);
    });

    it('should remove URLs in brackets on their own line', () => {
      const html = '<a href="https://example.com"><img src="img.png"/></a>';
      const result = service.convert(html);
      expect(result).not.toMatch(/^\s*\[https?:\/\/[^\]]+\]\s*$/m);
    });

    it('should remove SendGrid link placeholders on their own line', () => {
      const html = '<p>{{LINK1}}</p>';
      const result = service.convert(html);
      expect(result).not.toMatch(/^\s*\{?\{LINK\d+\}\}?\s*$/m);
    });

    it('should clean up excess blank lines (3+ newlines become 2)', () => {
      const html = '<p>Line 1</p><br/><br/><br/><br/><p>Line 2</p>';
      const result = service.convert(html);
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('should trim trailing whitespace from result', () => {
      const html = '<p>Content</p>  ';
      const result = service.convert(html);
      expect(result).toBe(result.trim());
    });

    it('should skip hidden preheader elements', () => {
      const html = '<span class="preheader">Hidden text</span><p>Visible</p>';
      const result = service.convert(html);
      expect(result).not.toContain('Hidden text');
      expect(result).toContain('Visible');
    });

    it('should skip elements with display:none style', () => {
      const html = '<div style="display:none">Hidden</div><p>Shown</p>';
      const result = service.convert(html);
      expect(result).not.toContain('Hidden');
      expect(result).toContain('Shown');
    });

    it('should skip images', () => {
      const html = '<p>Text</p><img src="image.png" alt="An image"/><p>More</p>';
      const result = service.convert(html);
      expect(result).not.toContain('An image');
    });

    it('should preserve link text', () => {
      const html = '<a href="https://example.com">Click here</a>';
      const result = service.convert(html);
      expect(result).toContain('Click here');
    });
  });
});
