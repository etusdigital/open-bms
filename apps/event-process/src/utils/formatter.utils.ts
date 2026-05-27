import { Injectable } from '@nestjs/common';
import { CacheService } from '../msgops/cache.service';

@Injectable()
export class FormatterUtils {
  constructor(private readonly cacheService: CacheService) {}

  parseEventType(categories: string[], eventType: string): string | undefined {
    if (!categories || categories.length === 0) {
      return undefined;
    }

    for (const category of categories) {
      if (category.startsWith(`${eventType}_`)) {
        const content = category.substring(eventType.length + 1);
        return content === 'undefined' ? undefined : content;
      }
    }

    return undefined;
  }

  normalizeEvents(eventType: string) {
    if (eventType === 'out_of_band') {
      return 'bounce';
    }

    if (eventType === 'delivery') {
      return 'delivered';
    }

    if (eventType === 'initial_open') {
      return 'open';
    }

    if (['list_unsubscribe', 'group_unsubscribe'].includes(eventType)) {
      return 'unsubscribe';
    }

    if (eventType === 'spam_complaint') {
      return 'spamreport';
    }

    return eventType;
  }

  removeQueryStringFromUrl(url: string): string {
    if (!url) {
      return url;
    }

    if (url.includes('bmsclick')) {
      const urlParsed = new URL(url);
      const searchParms = new URLSearchParams(urlParsed.search);
      const decodedUrl = Buffer.from(searchParms.get('url'), 'base64').toString('ascii');

      if (decodedUrl.includes('","http')) {
        console.log('Url with array', decodedUrl);
        return null;
      }

      return decodedUrl.split('?').shift();
    }

    return url.split('?').shift();
  }

  /**
   * Gets the minimum allowable timestamp (12 hours ago)
   * @returns number - Timestamp in milliseconds representing 12 hours ago
   */
  private getMinAllowableTimestamp(): number {
    const twelveHoursInMs = 12 * 60 * 60 * 1000;
    return Date.now() - twelveHoursInMs;
  }
  /**
   * Converts a timestamp to a formatted date or hour string in the specified timezone.
   *
   * Handles timestamp validation by:
   * - If timestamp is older than 12 hours ago, replaces with current time
   * - If timestamp is in the future, replaces with current time
   * - Accepts timestamps between now and 12 hours ago as valid
   *
   * This behavior protects against devices with incorrectly set clocks
   * while allowing reasonable processing delays.
   *
   * @param timestamp - The timestamp in milliseconds or seconds to convert
   * @param timezone - The timezone to format the date in (e.g., 'UTC', 'America/New_York')
   * @param returnHour - Whether to return only the hour (true) or full date string (false)
   * @returns A formatted string with date ('YYYY-MM-DD') or hour ('HH') based on returnHour parameter
   */
  convertTimestampToTimezone(timestamp: number, timezone: string, returnHour: boolean = false): string {
    const normalizedTimestamp = this.normalizeTimestamp(timestamp);
    const now = Date.now();
    const minAllowableTime = this.getMinAllowableTimestamp();

    // Determine which timestamp to use
    // If the timestamp is too old (> 12 hours) or in the future, use current time
    const isTimestampValid = normalizedTimestamp >= minAllowableTime && normalizedTimestamp <= now;
    const effectiveTimestamp = isTimestampValid ? normalizedTimestamp : now;

    const date = new Date(effectiveTimestamp);

    // Get or create formatter from cache
    let formatter = this.cacheService.get<Intl.DateTimeFormat>('timezone', timezone);
    if (!formatter) {
      try {
        formatter = new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: timezone,
          hourCycle: 'h23',
        });
        this.cacheService.set('timezone', timezone, formatter);
      } catch (error) {
        if (error.message.includes('Invalid time zone specified')) {
          if (returnHour) {
            return new Date(effectiveTimestamp).toISOString().split('T')[1].split(':')[0];
          }

          return new Date(effectiveTimestamp).toISOString().split('T')[0];
        }
        throw error;
      }
    }

    const formatted = formatter.format(date);

    if (returnHour) {
      const [hour] = formatted.split(',')[1].split(':');
      return hour.trim();
    }

    const [month, day, year] = formatted.split(',')[0].split('/');
    return `${year}-${month}-${day}`;
  }

  getMailBoxProvider(email: string): string {
    const domain = email.toLowerCase().split('@')[1];

    const gmail = ['gmail.com', 'googlemail.com', 'google.com'];
    if (gmail.includes(domain)) {
      return 'Gmail';
    }

    if (domain.includes('yahoo')) {
      return 'Yahoo';
    }

    const microsoft = ['hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'passport.com'];
    if (microsoft.some((x) => domain.includes(x))) {
      return 'Microsoft';
    }

    const icloud = ['icloud.com', 'me.com', 'mac.com'];
    if (icloud.includes(domain)) {
      return 'iCloud';
    }

    return 'Other';
  }

  logInfo(message: string) {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.log(message);
    }
  }

  private readonly knownBotAgents: Set<string> = new Set([
    'HubSpot Connect',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246 Mozilla/5.0',
    'AHC/2.1',
    'Amazon CloudFront',
    'Barracuda Sentinel (EE)',
    'python-requests/2.26.0',
    'Python/3.9 aiohttp/3.8.1',
    'lua-resty-http/0.07 (Lua) ngx_lua/10012',
    'lua-resty-http/0.10 (Lua) ngx_lua/10019',
    'okhttp/4.10.0',
    'python-requests/2.27.1',
    'python-requests/2.28.0',
    'lua-resty-http/0.07 (Lua) ngx_lua/10024',
    'cortex/1.0',
    'Aloha/1 CFNetwork/1404.0.5 Darwin/22.3.0',
    'Dalvik/2.1.0 (Linux; U; Android 8.0.0; SM-G930V Build/R16NW)',
    'Java/17.0.2',
    'macOS/13.4 (22F66) dataaccessd/1.0',
    'Snap URL Preview Service; bot; snapchat; https://developers.snap.com/robots',
    'iOS/16.5.1 (20F75) dataaccessd/1.0',
    'Dalvik/2.1.0 (Linux; U; Android 8.1.0; SM-J327V Build/M1AJQ)',
    'W3C-checklink/4.5 [4.160] libwww-perl/5.823',
    'yarn/1.22.4 npm/? node/v16.20.0 linux x64',
    'Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.14931; Pro)',
    'Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.16327; Pro)',
    'Social News Desk RSS Scraper',
    'iOS/16.3.1 (20D67) dataaccessd/1.0',
    'facebookexternalua',
    'Jetty/9.4.42.v20210604',
    'Microsoft Exchange/15.20 (Windows NT 10.0; Win64; x64)',
    'Dalvik/2.1.0 (Linux; U; Android 8.1.0; LM-Q710(FGN) Build/OPM1.171019.019)',
    'iOS/15.7 (19H12) dataaccessd/1.0',
    'Wget/1.9.1',
    'Office 365 Connectors',
    'Java/1.8.0_265',
    'iOS/15.7.6 (19H349) dataaccessd/1.0',
    'iOS/16.5 (20F66) dataaccessd/1.0',
    'Dalvik/2.1.0 (Linux; U; Android 12; SM-G970U Build/SP1A.210812.016)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.16227; Pro)',
    'python-requests/2.28.2',
    'SCMGUARD',
    'Apache-HttpClient/4.5.1 (Java/1.8.0_172)',
    'FeedBurner/1.0 (http://www.FeedBurner.com)',
  ]);

  private readonly validEmailProxies: string[] = ['GoogleImageProxy', 'YahooMailProxy', 'OutlookImageProxy'];

  private readonly browserIdentifiers: string[] = ['Chrome/', 'Firefox/', 'Safari/', 'Edge/', 'Opera/'];

  /**
   * Determines if a user agent string represents a valid email open
   * @param userAgent - The user agent string to analyze
   * @returns boolean indicating if the user agent represents a valid email open
   */
  public isValidEmailOpen(userAgent: string): boolean {
    if (!userAgent?.trim()) {
      return false;
    }

    // Check against exact known bot User Agents
    if (this.knownBotAgents.has(userAgent)) {
      return false;
    }

    // Allow bare Mozilla/5.0
    if (userAgent.trim().toLowerCase() === 'mozilla/5.0') {
      return true;
    }

    // Allow known email image proxies
    if (this.validEmailProxies.some((proxy) => userAgent.toLowerCase().includes(proxy.toLowerCase()))) {
      return true;
    }

    // Check for unusual browser combinations
    if (this.hasUnusualBrowserCombination(userAgent)) {
      return false;
    }

    // Basic browser checks for webmail opens
    if (this.isLikelyBrowser(userAgent)) {
      return true;
    }

    return true; // If we haven't rejected it by now, allow it
  }

  /**
   * Checks if the user agent has unusual combinations of browser identifiers
   * @param userAgent - The user agent string to analyze
   * @returns boolean indicating if unusual browser combinations are present
   */
  private hasUnusualBrowserCombination(userAgent: string): boolean {
    const lowerUserAgent = userAgent.toLowerCase();
    const browserCount = this.browserIdentifiers.filter((identifier) =>
      lowerUserAgent.includes(identifier.toLowerCase()),
    ).length;

    if (browserCount > 1) {
      // Common legitimate combination: Chrome + Safari (WebKit)
      const isWebKitCombination = lowerUserAgent.includes('chrome/') && lowerUserAgent.includes('safari/');
      return !isWebKitCombination;
    }

    return false;
  }

  /**
   * Determines if the user agent likely represents a real browser
   * @param userAgent - The user agent string to analyze
   * @returns boolean indicating if the user agent likely represents a real browser
   */
  private isLikelyBrowser(userAgent: string): boolean {
    const lowerUserAgent = userAgent.toLowerCase();

    // Check for mobile devices
    if (['iphone', 'android', 'ipad', 'mobile'].some((term) => lowerUserAgent.includes(term))) {
      return true;
    }

    // Check for desktop browsers
    const hasMozilla = lowerUserAgent.includes('mozilla/5.0') || lowerUserAgent.includes('mozilla/4.0');

    const hasBrowser = ['chrome/', 'firefox/', 'safari/', 'edge/', 'msie', 'trident/'].some((browser) =>
      lowerUserAgent.includes(browser),
    );

    return hasMozilla && hasBrowser;
  }

  /**
   * Checks if a number is a timestamp in milliseconds or seconds and converts to milliseconds if needed
   * @param timestamp - The timestamp to validate and potentially convert
   * @returns number - The timestamp in milliseconds
   */
  public normalizeTimestamp(timestamp: number): number {
    const timestampString = Math.abs(timestamp).toString();

    if (timestampString.length <= 10) {
      return timestamp * 1000;
    }

    return timestamp;
  }

  /**
   * Checks if an object is a simple object (not an array or nested object)
   * @param obj - The object to check
   * @returns boolean indicating if the object is a simple object
   */
  public isSimpleObject(obj: any): boolean {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return false;
    }

    return Object.values(obj).every(
      (value) => value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
    );
  }

  /**
   *  Clean up object removing keys with empty values and nested objects/arrays
   * @param obj - The object to clean
   * @returns A new object containing only primitive values at the root level, removing null, undefined, empty strings, nested objects and arrays
   */
  public cleanObject<T extends Record<string, any>>(obj: T): Partial<T> {
    if (!obj || typeof obj !== 'object') {
      return obj as any;
    }

    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, value]) => {
          if (value === null || value === undefined) return false;
          if (typeof value === 'string') return value.trim() !== '';
          return true;
        })
        .map(([key, value]) => {
          // Keep only primitives and Date objects at the root level
          if (value instanceof Date) {
            return [key, value];
          }
          if (typeof value === 'object') {
            return [key, null]; // Filter out objects and arrays
          }
          return [key, value];
        })
        .filter(([, value]) => value !== null), // Remove any nullified entries
    ) as Partial<T>;
  }

  public async sendSlackWebhook(options: {
    text: string;
    account: string;
    showSupportButton?: boolean;
  }): Promise<Response> {
    const payload = {
      text: options.text,
      blocks: [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: options.text,
            },
          ],
        },
        ...(options.showSupportButton
          ? [
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    style: 'danger',
                    text: {
                      type: 'plain_text',
                      text: 'Confira ticket na sendgrid',
                      emoji: true,
                    },
                    value: 'sendgrid-support',
                    url: 'https://support.sendgrid.com/hc/en-us',
                    action_id: 'actionId-0',
                  },
                ],
              },
            ]
          : []),
      ],
    };

    return await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
