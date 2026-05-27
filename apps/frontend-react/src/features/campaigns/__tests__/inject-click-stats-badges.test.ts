// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { injectClickStatsBadges } from '../utils/inject-click-stats-badges';
import type { ClickStatEntry } from '../types';

const formatBadge = (count: number, percent: string) => `${count} cliques (${percent}%)`;

describe('injectClickStatsBadges', () => {
  it('returns original HTML when clickStats is empty', () => {
    const html = '<p>Hello <a href="https://a.com">link</a></p>';
    expect(injectClickStatsBadges(html, [], formatBadge)).toBe(html);
  });

  it('returns original HTML when HTML has no anchors', () => {
    const html = '<p>No links here</p>';
    const stats: ClickStatEntry[] = [{ key: '0', total: '10' }];
    expect(injectClickStatsBadges(html, stats, formatBadge)).toBe(html);
  });

  it('injects a badge for each non-unsubscribe anchor matching stats by 0-based index', () => {
    const html = '<p><a href="https://a.com">A</a><a href="https://b.com">B</a><a href="[unsubscribe_link]">U</a></p>';
    const stats: ClickStatEntry[] = [
      { key: '0', total: '70' },
      { key: '1', total: '30' },
    ];
    const result = injectClickStatsBadges(html, stats, formatBadge);

    // Both real anchors wrapped + badges inserted
    expect(result).toContain('70 cliques (70.0%)');
    expect(result).toContain('30 cliques (30.0%)');
    // Anchors preserved
    expect(result).toContain('href="https://a.com"');
    expect(result).toContain('href="https://b.com"');
    // Unsubscribe link untouched (no badge for it)
    expect(result).toContain('href="[unsubscribe_link]"');
  });

  it('skips anchors when their matching stat key is not found', () => {
    const html = '<p><a href="https://a.com">A</a><a href="https://b.com">B</a></p>';
    const stats: ClickStatEntry[] = [{ key: '1', total: '50' }]; // only key "1"
    const result = injectClickStatsBadges(html, stats, formatBadge);

    // Only one badge should be injected
    const badgeCount = (result.match(/cliques/g) ?? []).length;
    expect(badgeCount).toBe(1);
    expect(result).toContain('50 cliques (100.0%)');
  });

  it('inlines badge styles (position absolute, inline CSS) for iframe srcDoc compatibility', () => {
    const html = '<p><a href="https://a.com">A</a></p>';
    const stats: ClickStatEntry[] = [{ key: '0', total: '10' }];
    const result = injectClickStatsBadges(html, stats, formatBadge);

    // Badge must have inline styles since it lives inside a sandboxed iframe
    expect(result).toContain('position:absolute');
    expect(result).toContain('position:relative');
  });

  it('calculates percentages relative to total across all stats', () => {
    const html = '<p><a href="https://a.com">A</a><a href="https://b.com">B</a><a href="https://c.com">C</a></p>';
    const stats: ClickStatEntry[] = [
      { key: '0', total: '50' },
      { key: '1', total: '30' },
      { key: '2', total: '20' },
    ];
    const result = injectClickStatsBadges(html, stats, formatBadge);

    expect(result).toContain('50 cliques (50.0%)');
    expect(result).toContain('30 cliques (30.0%)');
    expect(result).toContain('20 cliques (20.0%)');
  });

  it('handles the startsFromZero edge case from Vue (first anchor skipped if no key "0")', () => {
    const html = '<p><a href="https://a.com">A</a><a href="https://b.com">B</a></p>';
    const stats: ClickStatEntry[] = [{ key: '1', total: '100' }]; // no "0"
    const result = injectClickStatsBadges(html, stats, formatBadge);

    // First anchor should NOT have a badge (no stat with key "0", startsFromZero=false means index 0 is skipped)
    // Second anchor (index 1) matches stat key "1"
    expect(result).toContain('100 cliques (100.0%)');
    const badgeCount = (result.match(/cliques/g) ?? []).length;
    expect(badgeCount).toBe(1);
  });
});
