const formatters = new Map<string, Intl.NumberFormat>();

/** Format a number with locale-appropriate thousand separators */
export function formatNumber(value: number, locale: string): string {
  let fmt = formatters.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale);
    formatters.set(locale, fmt);
  }
  return fmt.format(value ?? 0);
}
