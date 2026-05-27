import { Injectable, OnModuleInit } from '@nestjs/common';
import { compile, HtmlToTextOptions } from 'html-to-text';

@Injectable()
export class HtmlToTextService implements OnModuleInit {
  private compiledConvert: (html: string) => string;

  onModuleInit() {
    const options: HtmlToTextOptions = {
      wordwrap: 80,

      selectors: [
        // Skip hidden preheader text (used for email preview)
        { selector: '.preheader', format: 'skip' },
        { selector: 'span[style*="display: none"]', format: 'skip' },
        { selector: 'div[style*="display: none"]', format: 'skip' },
        { selector: '[style*="display:none"]', format: 'skip' },
        { selector: '[style*="visibility: hidden"]', format: 'skip' },
        { selector: '[style*="visibility:hidden"]', format: 'skip' },

        // Links: show text with URL in brackets
        // e.g., "Click here [{{LINK1}}]" - preserves SendGrid placeholders
        { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },

        // Images: skip (alt text usually not meaningful in marketing emails)
        { selector: 'img', format: 'skip' },

        // Skip tracking pixel placeholder
        { selector: 'div', format: 'block' },
      ],

      // Decode HTML entities
      decodeEntities: true,

      // Don't preserve newlines from HTML source
      preserveNewlines: false,
    };

    // Compile once for performance - reused for all conversions
    this.compiledConvert = compile(options);
  }

  /**
   * Converts HTML email content to plain text.
   * Preserves SendGrid substitution placeholders like {{VARIABLE}}.
   */
  convert(html: string): string {
    if (!html) {
      return ' ';
    }

    let text = this.compiledConvert(html);

    // Remove SendGrid open tracking placeholder
    text = text.replace(/sendgrid_open_tracking\s*/gi, '');

    // Remove orphaned links (links with no text content)
    // This happens when an image inside a link is skipped, leaving just the URL or placeholder
    // Matches: standalone URLs on their own line
    text = text.replace(/^\s*https?:\/\/[^\s]+\s*$/gm, '');
    // Also remove URLs in brackets on their own line
    text = text.replace(/^\s*\[https?:\/\/[^\]]+\]\s*$/gm, '');
    // Also remove SendGrid link placeholders on their own line (used in batch emails)
    // Matches: {{LINK1}}, {{LINK2}}, etc. with optional brackets from link formatting
    text = text.replace(/^\s*\[?\{\{LINK\d+\}\}\]?\s*$/gm, '');

    // Add line break after links when followed by more content (separate adjacent links)
    // Matches: ] followed by space and any non-whitespace (including emojis)
    text = text.replace(/\](\s+)(?=\S)/g, ']\n\n');

    // Clean up any extra blank lines that may result from removed content
    text = text.replace(/\n{3,}/g, '\n\n');

    const trimmed = text.trim();

    // SendGrid requires content value to be at least one character
    return trimmed || ' ';
  }
}
