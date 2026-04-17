/**
 * Calculates the SendGrid url_offset.index offset caused by the text/plain MIME part.
 *
 * When sending emails, msgops-send-email includes both text/plain and text/html parts.
 * SendGrid counts url_offset.index continuously across both MIME parts without resetting,
 * so links that survive in text/plain shift all HTML link positions.
 *
 * This function simulates the html-to-text conversion from
 * msgops-send-email/src/html-to-text/html-to-text.service.ts using browser DOM APIs
 * to count how many trackable links would appear in the text/plain version.
 *
 * The conversion rules (mirroring HtmlToTextService):
 * - Images inside links are skipped, leaving the link as just a URL
 * - URLs left alone on a line (orphaned) are removed by cleanup regexes
 * - Links with visible text survive as "text [URL]"
 * - But if wordwrap (80 chars) pushes the [URL] to its own line, it gets removed too
 * - Unsubscribe links and SendGrid ASM links are not tracked by SendGrid
 *
 * The net result: only links whose visible text + " [URL]" fits within ~80 chars
 * (or whose URL is short enough) survive in text/plain.
 *
 * IMPORTANT: If msgops-send-email HtmlToTextService changes, this must be updated to match.
 */
export function calculateTextPlainLinkOffset(emailHtml: string): number {
  const doc = new DOMParser().parseFromString(emailHtml, 'text/html');
  const anchors = doc.querySelectorAll('a');
  let survivingLinks = 0;

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';

    // SendGrid doesn't track unsubscribe/ASM links
    if (href.includes('unsubscribe_link') || href.includes('asm_preferences_raw_url')) {
      return;
    }

    // Get visible text (same as what html-to-text would extract)
    // html-to-text skips <img> tags, so we need text content excluding images
    const cloned = anchor.cloneNode(true) as HTMLElement;
    cloned.querySelectorAll('img').forEach((img) => img.remove());
    const visibleText = cloned.textContent?.trim() || '';

    // If link has no visible text (image-only link), html-to-text produces
    // just "[URL]" on its own line, which gets removed by the orphan cleanup regex.
    // So image-only links do NOT survive in text/plain.
    if (!visibleText) {
      return;
    }

    // Link has visible text -> html-to-text produces "visible text [URL]"
    // But wordwrap at 80 chars may push [URL] to its own line if the combined
    // length exceeds 80 chars, and then the cleanup regex removes it.
    // Simulate: if "visibleText [URL]" fits in 80 chars, the link survives.
    // The URL in text/plain includes the full href wrapped in brackets.
    const textWithUrl = `${visibleText} [${href}]`;

    // html-to-text wordwraps at 80 chars. If the text+URL is on a line that
    // already has content before it (e.g., inline text), it may wrap differently.
    // But for most email templates, each link is in its own block/cell,
    // so the line starts fresh. We use 80 as the threshold.
    if (textWithUrl.length <= 80) {
      survivingLinks++;
      return;
    }

    // If it exceeds 80 chars, wordwrap will likely push [URL] to its own line.
    // The cleanup regex removes bracketed URLs on their own line: /^\s*\[https?:\/\/...
    // UNLESS there's other content on that wrapped line after the URL (e.g., punctuation).
    // Check if the href is followed by content in the original anchor's parent context.
    // For simplicity and accuracy: if the parent text after the </a> has immediate
    // non-whitespace content (like ")." in "...privacy policy [URL])."), the URL
    // line won't match the orphan regex because of the trailing content.
    const nextSibling = anchor.nextSibling;
    const textAfter = nextSibling?.textContent?.trimStart() || '';
    const hasTrailingContent = textAfter.length > 0 && !textAfter.startsWith('\n');

    if (hasTrailingContent) {
      // The [URL] line will have trailing content like ")." so the orphan regex won't match
      survivingLinks++;
    }
    // Otherwise the [URL] ends up alone on a line and gets removed -> doesn't count
  });

  return survivingLinks;
}
