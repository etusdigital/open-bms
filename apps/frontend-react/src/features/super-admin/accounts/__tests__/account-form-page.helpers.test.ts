import { describe, it, expect } from 'vitest';
import { extractChannelDefaults, buildChannelConfigUpdates } from '../account-channels';
import type { AccountConfig } from '@/types';

const cfg = (name: string, value: string): AccountConfig => ({
  accountId: 10,
  name,
  value,
  isLoadConfig: true,
});

const ALL_OFF = { email: false, sms: false, webPush: false, mobilePush: false, whatsapp: false };

describe('extractChannelDefaults', () => {
  it('returns all false when configs are undefined', () => {
    expect(extractChannelDefaults(undefined)).toEqual(ALL_OFF);
  });

  it('maps the 5 *_settings configs to channel booleans by parsing isActive', () => {
    const configs: AccountConfig[] = [
      cfg('email_settings', '{"isActive": true}'),
      cfg('sms_settings', '{"isActive": false}'),
      cfg('webpush_settings', '{"isActive": true, "subdomain": "x"}'),
      cfg('mobilepush_settings', '{"isActive": true}'),
      cfg('whatsapp_settings', '{"isActive": false}'),
    ];
    expect(extractChannelDefaults(configs)).toEqual({
      email: true,
      sms: false,
      webPush: true,
      mobilePush: true,
      whatsapp: false,
    });
  });

  it('returns false when value is missing, malformed, or isActive is not true', () => {
    const configs: AccountConfig[] = [
      cfg('email_settings', 'not-json'),
      cfg('sms_settings', '{"isActive": "yes"}'),
      cfg('whatsapp_settings', '{}'),
    ];
    expect(extractChannelDefaults(configs)).toEqual(ALL_OFF);
  });
});

describe('buildChannelConfigUpdates', () => {
  it('returns empty array when no channel changed from defaults', () => {
    const existing: AccountConfig[] = [
      cfg('email_settings', '{"isActive": true}'),
      cfg('sms_settings', '{"isActive": false}'),
    ];
    const result = buildChannelConfigUpdates(
      { email: true, sms: false, webPush: false, mobilePush: false, whatsapp: false },
      existing,
      1,
    );
    expect(result).toEqual([]);
  });

  it('emits an update only for channels whose isActive flipped', () => {
    const existing: AccountConfig[] = [
      cfg('email_settings', '{"isActive": false}'),
      cfg('sms_settings', '{"isActive": false}'),
    ];
    const result = buildChannelConfigUpdates(
      { email: true, sms: false, webPush: false, mobilePush: false, whatsapp: false },
      existing,
      42,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      account_id: 42,
      name: 'email_settings',
      value: JSON.stringify({ isActive: true }),
    });
  });

  it('emits the channel when there is no existing config and the new value is true', () => {
    const result = buildChannelConfigUpdates(
      { email: true, sms: false, webPush: false, mobilePush: false, whatsapp: false },
      undefined,
      7,
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('email_settings');
    expect(JSON.parse(result[0].value)).toEqual({ isActive: true });
  });

  it('skips webpush when only isActive matches existing — avoids backend side-effects', () => {
    // Backend re-runs uploadWebPushFile + sendPushRulesToCloudflareWorkers on
    // every webpush_settings write. If the toggle did not change, do not send
    // it.
    const existing: AccountConfig[] = [
      cfg('webpush_settings', '{"isActive": true, "subdomain": "acme"}'),
    ];
    const result = buildChannelConfigUpdates(
      { email: false, sms: false, webPush: true, mobilePush: false, whatsapp: false },
      existing,
      3,
    );
    expect(result).toEqual([]);
  });

  it('preserves existing non-isActive fields when emitting an update', () => {
    const existing: AccountConfig[] = [
      cfg('webpush_settings', '{"isActive": false, "subdomain": "acme", "vapid": "k"}'),
      cfg('whatsapp_settings', '{"isActive": false, "instanceId": "abc-123"}'),
    ];
    const result = buildChannelConfigUpdates(
      { email: false, sms: false, webPush: true, mobilePush: false, whatsapp: true },
      existing,
      7,
    );
    const wp = JSON.parse(result.find((r) => r.name === 'webpush_settings')!.value);
    const wa = JSON.parse(result.find((r) => r.name === 'whatsapp_settings')!.value);
    expect(wp).toEqual({ isActive: true, subdomain: 'acme', vapid: 'k' });
    expect(wa).toEqual({ isActive: true, instanceId: 'abc-123' });
  });

  it('starts fresh when existing value is malformed JSON', () => {
    const existing: AccountConfig[] = [cfg('email_settings', 'garbage')];
    const result = buildChannelConfigUpdates(
      { email: true, sms: false, webPush: false, mobilePush: false, whatsapp: false },
      existing,
      3,
    );
    const email = JSON.parse(result.find((r) => r.name === 'email_settings')!.value);
    expect(email).toEqual({ isActive: true });
  });
});
