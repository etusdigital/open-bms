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

// Short date + short time (no seconds), e.g. "19/05/2026 14:30".
// Locale-aware (runtime locale) to match the campaigns table convention,
// where the empty placeholder is an em dash like the sibling stat columns.
export function formatCampaignDateTime(isoString: string | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return isoString;
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
