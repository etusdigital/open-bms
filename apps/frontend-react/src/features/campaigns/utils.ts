export function replaceSpecialChars(term: string): string {
  if (!term) return '';

  return term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([^\w]+|\s+)/g, '-')
    .replace(/--+/g, '-')
    .replace(/(^-+|-+$)/, '')
    .toLowerCase();
}

export function extractLinks(html: string): string[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = new Set<string>();
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href && !href.includes('[unsubscribe_link]')) {
        links.add(href);
      }
    });
    return Array.from(links);
  } catch {
    return [];
  }
}

export function formatCampaignDate(isoString: string | undefined): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatCampaignTime(isoString: string | undefined): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Converts an API ISO string (e.g. "2026-06-01T15:00:00.000Z") into the
// "YYYY-MM-DDTHH:mm" shape required by <input type="datetime-local">.
// The input renders empty when fed a value with a `Z` suffix or seconds, so
// scheduled-campaign edit forms must truncate it during hydration (EVO-1413).
// Returns the first 16 chars verbatim — no Date reconstruction — so the value
// round-trips back to the API unchanged (no timezone shift). Unparseable or
// missing values yield '' so the field stays empty without erroring.
export function isoToDatetimeLocal(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return iso.slice(0, 16);
}

// Short date + short time (no seconds), e.g. "19/05/2026 14:30".
// Locale-aware (runtime locale) to match the campaigns table convention,
// where the empty placeholder is an em dash like the sibling stat columns.
export function formatCampaignDateTime(isoString: string | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
