import type { Traits } from './geolocation/geolocation.interface';

export type BotClassification =
  | 'gmail_prefetch'
  | 'outlook_prefetch'
  | 'yahoo_prefetch'
  | 'script_ua'
  | 'datacenter'
  | null;

export interface BotSignals {
  is_bot: boolean;
  is_datacenter: boolean;
  classification: BotClassification;
  asn: number;
  asn_org: string;
  user_type: string;
}

// ASNs that operate email/webmail proxies and link pre-fetchers in
// datacenter space. High-confidence bot signal when combined with
// user_type=hosting. AS396982 (GCP) is deliberately absent — too broad
// to treat as a scanner, though still datacenter.
const MAIL_SCANNER_ASNS: Record<number, BotClassification> = {
  15169: 'gmail_prefetch', // Google (Gmail Image Proxy, link pre-fetcher)
  8075: 'outlook_prefetch', // Microsoft Exchange Online / Safe Links
  7233: 'yahoo_prefetch', // Yahoo / Oath
  36646: 'yahoo_prefetch',
  36647: 'yahoo_prefetch',
  10310: 'yahoo_prefetch', // Oath Holdings
};

// Case-sensitive substring patterns that identify scripted / automated
// HTTP clients. A match upgrades an is_datacenter=true click to is_bot.
// Hand-curated; grow via PR when new patterns appear in production
// (watch events_logs_v2 for is_datacenter=true AND is_bot=false rows).
// See apps/event-process/docs/plans/2026-04-20-ua-denylist-for-bot-detection.md.
const SCRIPT_UA_SUBSTRINGS: readonly string[] = [
  // Mail-app scanners / preview fetchers
  'Shop Service',
  'shop.app',
  'Microsoft Office',
  'Mailchimp',
  'Mandrill',
  'YahooMailProxy',

  // Scripting / HTTP clients
  'curl/',
  'Wget/',
  'python-requests/',
  'python-urllib',
  'aiohttp/',
  'httpx/',
  'Go-http-client/',
  'Java/',
  'okhttp/',
  'node-fetch',
  'axios/',
  'got (https://github.com/sindresorhus/got)',
  'libwww-perl/',
  'PostmanRuntime/',

  // Headless / automation
  'HeadlessChrome',
  'PhantomJS',
  'Selenium',
  'Playwright',
  'Puppeteer',

  // Search engine crawlers
  'Googlebot',
  'AdsBot-Google',
  'Bingbot',
  'Slurp',
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot',
  'Applebot',

  // Social crawlers
  'facebookexternalhit',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
];

// Matches any word ending in "bot" (case-insensitive): Googlebot/, Bingbot/,
// SomeNewBot/1.0, etc. The trailing \b requires a non-word char after "bot"
// (typically `/` or space in UAs), which keeps "Cubot_Note_7" clean
// because `_` is a word character and therefore no boundary appears.
const BOT_WORD = /bot\b/i;

export function isScriptUserAgent(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false;
  for (const needle of SCRIPT_UA_SUBSTRINGS) {
    if (userAgent.includes(needle)) return true;
  }
  return BOT_WORD.test(userAgent);
}

export class BotDetector {
  static classify(traits: Traits | undefined | null, userAgent?: string | null): BotSignals {
    const asn = traits?.asn ?? 0;
    const asn_org = traits?.asn_org ?? '';
    const user_type = traits?.user_type ?? '';

    const is_datacenter = user_type === 'hosting';
    const scannerMatch = MAIL_SCANNER_ASNS[asn];
    const uaScriptMatch = is_datacenter && isScriptUserAgent(userAgent);
    const is_bot = is_datacenter && (scannerMatch !== undefined || uaScriptMatch);

    const classification: BotClassification =
      scannerMatch !== undefined ? scannerMatch : uaScriptMatch ? 'script_ua' : is_datacenter ? 'datacenter' : null;

    return { is_bot, is_datacenter, classification, asn, asn_org, user_type };
  }
}
