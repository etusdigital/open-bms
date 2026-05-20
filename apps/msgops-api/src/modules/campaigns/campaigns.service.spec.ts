import { ForbiddenException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignDto } from './campaign.dto';

describe('CampaignsService — channel permission enforcement', () => {
  function buildService(configRow: { value: string } | null, accountId = 10) {
    const accountConfigsProvider = {
      getByAccountId: jest.fn().mockResolvedValue(configRow),
    };
    const cls = { get: jest.fn((key: string) => (key === 'accountId' ? accountId : undefined)) };
    const service = Object.create(CampaignsService.prototype) as CampaignsService;
    (service as any).accountConfigsProvider = accountConfigsProvider;
    (service as any).cls = cls;
    return { service, accountConfigsProvider, cls };
  }

  const activeRow = () => ({ value: JSON.stringify({ isActive: true }) });
  const inactiveRow = () => ({ value: JSON.stringify({ isActive: false }) });

  describe('assertChannelEnabled', () => {
    it('resolves when the channel config is active', async () => {
      const { service } = buildService(activeRow());
      await expect(service.assertChannelEnabled('email', 10)).resolves.toBeUndefined();
    });

    it('rejects when the channel config row is missing', async () => {
      const { service } = buildService(null);
      await expect(service.assertChannelEnabled('email', 10)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when the channel config has isActive false', async () => {
      const { service } = buildService(inactiveRow());
      await expect(service.assertChannelEnabled('email', 10)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('maps each channel to its account config name', async () => {
      const { service, accountConfigsProvider } = buildService(activeRow());
      await service.assertChannelEnabled('sms', 10);
      await service.assertChannelEnabled('web-push', 10);
      await service.assertChannelEnabled('mobile-push', 10);
      await service.assertChannelEnabled('whatsapp', 10);
      expect(accountConfigsProvider.getByAccountId.mock.calls.map((c: unknown[]) => c[1])).toEqual([
        'sms_settings',
        'webpush_settings',
        'mobilepush_settings',
        'whatsapp_settings',
      ]);
    });

    it('skips validation when messageType is undefined', async () => {
      const { service, accountConfigsProvider } = buildService(null);
      await expect(service.assertChannelEnabled(undefined, 10)).resolves.toBeUndefined();
      expect(accountConfigsProvider.getByAccountId).not.toHaveBeenCalled();
    });

    it('skips validation for an unrecognized messageType', async () => {
      const { service, accountConfigsProvider } = buildService(null);
      await expect(service.assertChannelEnabled('carrier-pigeon', 10)).resolves.toBeUndefined();
      expect(accountConfigsProvider.getByAccountId).not.toHaveBeenCalled();
    });

    it('treats a malformed config value as an inactive channel', async () => {
      const { service } = buildService({ value: 'not-json' });
      await expect(service.assertChannelEnabled('email', 10)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update — channel gating', () => {
    // update() runs formattedCampaignDate + checkDuplicateAudience + findOneOrFail
    // before the channel gate; stub those so the test can reach the gate.
    function buildUpdateService(opts: { channelActive: boolean; persistedMessageType: string }) {
      const { service, accountConfigsProvider, cls } = buildService({
        value: JSON.stringify({ isActive: opts.channelActive }),
      });
      (service as any).formattedCampaignDate = (dto: CampaignDto) => dto;
      (service as any).checkDuplicateAudience = jest.fn().mockResolvedValue(undefined);
      (service as any).campaignRepository = {
        findOneOrFail: jest.fn().mockResolvedValue({ id: 1, messageType: opts.persistedMessageType, accountId: 10 }),
      };
      return { service, accountConfigsProvider, cls };
    }

    it('rejects when the campaign is moved to a different, disabled channel', async () => {
      const { service } = buildUpdateService({ channelActive: false, persistedMessageType: 'sms' });
      const dto = { id: 1, title: 'Promo', type: 'simple', messageType: 'email' } as CampaignDto;
      await expect(service.update(dto)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not gate the channel when messageType is unchanged — a legacy campaign on a since-disabled channel stays editable', async () => {
      const { service } = buildUpdateService({ channelActive: false, persistedMessageType: 'email' });
      const assertSpy = jest.spyOn(service, 'assertChannelEnabled');
      const dto = { id: 1, title: 'Promo', type: 'simple', messageType: 'email' } as CampaignDto;
      // update() continues past the gate and fails later on unmocked deps — the
      // gate decision is what this test asserts.
      await service.update(dto).catch(() => undefined);
      expect(assertSpy).not.toHaveBeenCalled();
    });

    it('does not gate the channel when the update omits messageType', async () => {
      const { service } = buildUpdateService({ channelActive: false, persistedMessageType: 'email' });
      const assertSpy = jest.spyOn(service, 'assertChannelEnabled');
      const dto = { id: 1, title: 'Promo', type: 'simple' } as CampaignDto;
      await service.update(dto).catch(() => undefined);
      expect(assertSpy).not.toHaveBeenCalled();
    });
  });
});
