import type { ClickStatEntry } from '../types';

/**
 * Injects click-statistics badges into email HTML content.
 *
 * Parses the HTML, finds all anchor tags (excluding unsubscribe links), and wraps each one
 * with a `<span style="position:relative">` containing the anchor plus a positioned badge
 * span showing "N cliques (X%)". Styles are inlined so the output works inside a sandboxed
 * iframe `srcDoc` where parent CSS is inaccessible.
 *
 * Ported from Vue2 MessagePreview.vue `addClickStatsToLinks()` — preserves the `startsFromZero`
 * edge case: if no stat has key "0", the first anchor is skipped (Vue inherited this quirk from
 * an earlier 1-based numbering scheme).
 *
 * @param html       Email HTML content (will be parsed via DOMParser)
 * @param clickStats Per-link click counts, keyed by 0-based anchor index as string
 * @param formatBadge Formatter for the badge text (e.g., i18n `t('campaigns.clickStatBadge', ...)`)
 * @returns Modified HTML string with badges, or original HTML if no stats/anchors
 */
export function injectClickStatsBadges(
  html: string,
  clickStats: ClickStatEntry[],
  formatBadge: (count: number, percent: string) => string,
): string {
  if (!clickStats.length) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const anchors = doc.querySelectorAll('a');
  if (!anchors.length) return html;

  const startsFromZero = clickStats.some((stat) => stat.key === '0');
  const totalClicks = clickStats.reduce((sum, s) => sum + Number(s.total), 0);
  if (totalClicks === 0) return html;

  let injected = false;

  anchors.forEach((anchor, index) => {
    const href = anchor.getAttribute('href');
    if (!href || href.includes('[unsubscribe_link]')) return;

    // Vue quirk: if no stat has key "0", the first anchor (index 0) is skipped entirely
    if (index === 0 && !startsFromZero) return;

    const statsKey = index.toString();
    const stat = clickStats.find((s) => s.key === statsKey);
    if (!stat) return;

    const count = Number(stat.total);
    const percent = ((count / totalClicks) * 100).toFixed(1);
    const badgeText = formatBadge(count, percent);

    // Wrap anchor with a relative-positioned span, and append badge inside the wrapper
    const wrapper = doc.createElement('span');
    wrapper.setAttribute('style', 'position:relative;display:inline-block;');

    // Badge sits below the link like a tooltip with an upward-pointing arrow
    const badge = doc.createElement('span');
    badge.setAttribute(
      'style',
      [
        'position:absolute',
        'left:50%',
        'transform:translateX(-50%)',
        'top:calc(100% + 8px)',
        'z-index:10',
        'white-space:nowrap',
        'background:#2563eb',
        'color:#ffffff',
        'border-radius:6px',
        'padding:4px 10px',
        'font-size:11px',
        'font-weight:600',
        'font-family:Arial,sans-serif',
        'line-height:1.2',
        'text-align:center',
        'pointer-events:none',
        'box-shadow:0 2px 6px rgba(0,0,0,0.15)',
      ].join(';'),
    );
    badge.textContent = badgeText;

    // Arrow (upward-pointing triangle) at the top of the badge — classic CSS border trick.
    // The transparent left/right borders + coloured bottom border form a triangle pointing up.
    const arrow = doc.createElement('span');
    arrow.setAttribute(
      'style',
      [
        'position:absolute',
        'left:50%',
        'transform:translateX(-50%)',
        'bottom:100%',
        'width:0',
        'height:0',
        'border-left:5px solid transparent',
        'border-right:5px solid transparent',
        'border-bottom:5px solid #2563eb',
      ].join(';'),
    );
    badge.appendChild(arrow);

    anchor.parentNode?.insertBefore(wrapper, anchor);
    wrapper.appendChild(anchor);
    wrapper.appendChild(badge);
    injected = true;
  });

  if (!injected) return html;

  return doc.body.innerHTML;
}
