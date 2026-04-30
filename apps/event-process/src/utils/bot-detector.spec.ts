import { BotDetector } from './bot-detector';
import type { Traits } from '@bms/geo';

const traitsOf = (overrides: Partial<Traits>): Traits => ({
  asn: 0,
  asnOrg: '',
  isp: '',
  organization: '',
  userType: '',
  connectionType: '',
  isAnycast: false,
  ...overrides,
});

describe('BotDetector.classify', () => {
  describe('mail-scanner ASNs on hosting IPs (narrow isBot)', () => {
    it('flags Gmail pre-fetcher traffic (AS15169, hosting) as gmail_prefetch', () => {
      const signals = BotDetector.classify(traitsOf({ asn: 15169, asnOrg: 'Google LLC', userType: 'hosting' }));
      expect(signals).toEqual({
        isBot: true,
        isDatacenter: true,
        classification: 'gmail_prefetch',
        asn: 15169,
        asnOrg: 'Google LLC',
        userType: 'hosting',
      });
    });

    it('flags Outlook/Exchange scanner (AS8075, hosting) as outlook_prefetch', () => {
      const signals = BotDetector.classify(
        traitsOf({ asn: 8075, asnOrg: 'Microsoft Corporation', userType: 'hosting' }),
      );
      expect(signals.isBot).toBe(true);
      expect(signals.isDatacenter).toBe(true);
      expect(signals.classification).toBe('outlook_prefetch');
    });

    it('flags Yahoo scanner (AS7233, hosting) as yahoo_prefetch', () => {
      const signals = BotDetector.classify(traitsOf({ asn: 7233, asnOrg: 'Yahoo', userType: 'hosting' }));
      expect(signals.classification).toBe('yahoo_prefetch');
      expect(signals.isBot).toBe(true);
    });

    it.each([36646, 36647, 10310])('flags Oath/Yahoo ASN %i as yahoo_prefetch', (asn) => {
      const signals = BotDetector.classify(traitsOf({ asn, asnOrg: 'Oath Holdings Inc.', userType: 'hosting' }));
      expect(signals.classification).toBe('yahoo_prefetch');
      expect(signals.isBot).toBe(true);
    });
  });

  describe('non-scanner hosting (wide isDatacenter only)', () => {
    it('flags GCP Shop app cluster (AS396982, hosting) as datacenter, not bot', () => {
      const signals = BotDetector.classify(traitsOf({ asn: 396982, asnOrg: 'Google LLC', userType: 'hosting' }));
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(true);
      expect(signals.classification).toBe('datacenter');
    });

    it('flags AWS hosting IPs as datacenter, not bot', () => {
      const signals = BotDetector.classify(traitsOf({ asn: 16509, asnOrg: 'Amazon.com, Inc.', userType: 'hosting' }));
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(true);
      expect(signals.classification).toBe('datacenter');
    });

    it('flags Cloudflare (AS13335) hosting IPs as datacenter, not bot', () => {
      // Covers iCloud Private Relay egress IPs. v1 deliberately has no allowlist,
      // so these land in isDatacenter until we carve them out based on evidence.
      const signals = BotDetector.classify(traitsOf({ asn: 13335, asnOrg: 'Cloudflare, Inc.', userType: 'hosting' }));
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(true);
      expect(signals.classification).toBe('datacenter');
    });
  });

  describe('real-user userTypes (neither bot nor datacenter)', () => {
    it('passes residential broadband through clean', () => {
      const signals = BotDetector.classify(
        traitsOf({ asn: 28573, asnOrg: 'Claro NXT Telecomunicacoes Ltda', userType: 'residential' }),
      );
      expect(signals).toEqual({
        isBot: false,
        isDatacenter: false,
        classification: null,
        asn: 28573,
        asnOrg: 'Claro NXT Telecomunicacoes Ltda',
        userType: 'residential',
      });
    });

    it('passes cellular through clean', () => {
      const signals = BotDetector.classify(traitsOf({ asn: 26599, userType: 'cellular' }));
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(false);
    });

    it('passes business ISPs through clean', () => {
      const signals = BotDetector.classify(
        traitsOf({ asn: 7459, asnOrg: 'Grande Communications Networks, LLC', userType: 'business' }),
      );
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(false);
    });

    it('excludes CDN userType from isDatacenter (v1 decision)', () => {
      const signals = BotDetector.classify(traitsOf({ asn: 54113, userType: 'cdn' }));
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(false);
      expect(signals.classification).toBeNull();
    });
  });

  describe('scanner ASN on non-hosting userType (guard)', () => {
    it('does NOT flag AS15169 traffic if userType is not hosting', () => {
      // Defensive: Gmail ASN appearing in a userType the DB doesn't classify as
      // hosting (should not happen in practice but must not trigger isBot).
      const signals = BotDetector.classify(traitsOf({ asn: 15169, userType: 'business' }));
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(false);
    });
  });

  describe('absent or empty traits', () => {
    it('returns clean defaults for undefined traits', () => {
      const signals = BotDetector.classify(undefined);
      expect(signals).toEqual({
        isBot: false,
        isDatacenter: false,
        classification: null,
        asn: 0,
        asnOrg: '',
        userType: '',
      });
    });

    it('returns clean defaults for null traits', () => {
      const signals = BotDetector.classify(null);
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(false);
      expect(signals.classification).toBeNull();
    });

    it('returns clean defaults for fully-zero traits (unresolved IP)', () => {
      const signals = BotDetector.classify(traitsOf({}));
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(false);
    });
  });

  describe('UA denylist promotes datacenter hits to isBot (Option Y)', () => {
    const gcpHosting = traitsOf({ asn: 396982, asnOrg: 'Google LLC', userType: 'hosting' });
    const awsHosting = traitsOf({ asn: 16509, asnOrg: 'Amazon.com, Inc.', userType: 'hosting' });
    const residential = traitsOf({ asn: 28573, asnOrg: 'Claro', userType: 'residential' });

    it('promotes GCP hosting + Shop Service UA to isBot with script_ua classification', () => {
      const signals = BotDetector.classify(gcpHosting, 'Shop Service');
      expect(signals).toMatchObject({
        isBot: true,
        isDatacenter: true,
        classification: 'script_ua',
        asn: 396982,
      });
    });

    it('promotes AWS hosting + curl UA to isBot', () => {
      const signals = BotDetector.classify(awsHosting, 'curl/8.4.0');
      expect(signals.isBot).toBe(true);
      expect(signals.classification).toBe('script_ua');
    });

    it('promotes hosting + HeadlessChrome UA to isBot', () => {
      const signals = BotDetector.classify(
        awsHosting,
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.6099.129 Safari/537.36',
      );
      expect(signals.isBot).toBe(true);
      expect(signals.classification).toBe('script_ua');
    });

    it('promotes hosting + Googlebot UA to isBot', () => {
      const signals = BotDetector.classify(
        awsHosting,
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      );
      expect(signals.isBot).toBe(true);
      expect(signals.classification).toBe('script_ua');
    });

    it('promotes hosting + unknown-but-word-boundary "bot" UA to isBot', () => {
      // Case-insensitive \bbot\b — catches new crawler names without an explicit denylist entry.
      const signals = BotDetector.classify(awsHosting, 'SomeNewBot/1.0 (+https://example.com)');
      expect(signals.isBot).toBe(true);
      expect(signals.classification).toBe('script_ua');
    });

    it('does NOT promote residential + script UA (Option Y gating preserves bot ⊆ datacenter)', () => {
      const signals = BotDetector.classify(residential, 'curl/8.4.0');
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(false);
      expect(signals.classification).toBeNull();
    });

    it('does NOT promote hosting + real Chrome UA (no denylist match)', () => {
      const signals = BotDetector.classify(
        gcpHosting,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
      expect(signals.isBot).toBe(false);
      expect(signals.isDatacenter).toBe(true);
      expect(signals.classification).toBe('datacenter');
    });

    it('mail-scanner ASN takes precedence over UA denylist in classification', () => {
      // Defensive: if both signals fire, the ASN-based classification wins (more specific).
      const gmailHosting = traitsOf({ asn: 15169, asnOrg: 'Google LLC', userType: 'hosting' });
      const signals = BotDetector.classify(gmailHosting, 'curl/8.4.0');
      expect(signals.isBot).toBe(true);
      expect(signals.classification).toBe('gmail_prefetch');
    });

    it('does NOT false-positive on "Cubot" phone model (word-boundary regex)', () => {
      const signals = BotDetector.classify(
        traitsOf({ asn: 28573, userType: 'cellular' }),
        'Mozilla/5.0 (Linux; Android 11; Cubot_Note_7) AppleWebKit/537.36',
      );
      expect(signals.isBot).toBe(false);
    });

    it('does NOT flag real in-app mobile browsers (Facebook, Instagram, Gmail app, TikTok)', () => {
      const fbUa =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0]';
      const igUa =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0.0.20.118';
      const gsaUa =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) GSA/297.0.571832069 Mobile/15E148 Safari/604.1';
      const ttUa = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Bytedance/26.5.3';
      for (const ua of [fbUa, igUa, gsaUa, ttUa]) {
        const signals = BotDetector.classify(traitsOf({ asn: 28573, userType: 'cellular' }), ua);
        expect(signals.isBot).toBe(false);
        expect(signals.classification).toBeNull();
      }
    });

    it('handles empty / undefined / null UA gracefully', () => {
      expect(BotDetector.classify(gcpHosting, '').classification).toBe('datacenter');
      expect(BotDetector.classify(gcpHosting, undefined).classification).toBe('datacenter');
      expect(BotDetector.classify(gcpHosting, null).classification).toBe('datacenter');
    });
  });
});
