import { ForbiddenException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignDto } from './campaign.dto';

describe('CampaignsService — channel permission enforcement', () => {
  function buildService(configRow: { value: string } | null, accountId = 10) {
    const accountConfigsProvider = {
      getByAccountId: jest.fn().mockResolvedValue(configRow),
    };
    const cls = { get: jest.fn().mockReturnValue(accountId) };
    const service = Object.create(CampaignsService.prototype) as CampaignsService;
    (service as any).accountConfigsProvider = accountConfigsProvider;
    (service as any).cls = cls;
    return { service, accountConfigsProvider, cls };
  }

  const emailCampaign = (): CampaignDto => ({ title: 'Promo', type: 'simple', messageType: 'email' }) as CampaignDto;
  const activeRow = () => ({ value: JSON.stringify({ isActive: true }) });
  const inactiveRow = () => ({ value: JSON.stringify({ isActive: false }) });

  describe('createOne', () => {
    it('rejects an email campaign when the email channel config is missing', async () => {
      const { service } = buildService(null);
      await expect(service.createOne(emailCampaign())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an email campaign when email_settings.isActive is false', async () => {
      const { service } = buildService(inactiveRow());
      await expect(service.createOne(emailCampaign())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('looks up the channel config for the explicit accountId when one is passed', async () => {
      const { service, accountConfigsProvider } = buildService(null);
      await expect(service.createOne(emailCampaign(), 77)).rejects.toBeInstanceOf(ForbiddenException);
      expect(accountConfigsProvider.getByAccountId).toHaveBeenCalledWith(77, 'email_settings');
    });
  });

  describe('update', () => {
    it('rejects updating an email campaign when the email channel is disabled', async () => {
      const { service } = buildService(inactiveRow());
      await expect(service.update({ ...emailCampaign(), id: 1 } as CampaignDto)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('assertChannelEnabled', () => {
    it('resolves when the channel config is active', async () => {
      const { service } = buildService(activeRow());
      await expect((service as any).assertChannelEnabled('email', 10)).resolves.toBeUndefined();
    });

    it('maps each channel to its account config name', async () => {
      const { service, accountConfigsProvider } = buildService(activeRow());
      await (service as any).assertChannelEnabled('sms', 10);
      await (service as any).assertChannelEnabled('web-push', 10);
      await (service as any).assertChannelEnabled('mobile-push', 10);
      await (service as any).assertChannelEnabled('whatsapp', 10);
      expect(accountConfigsProvider.getByAccountId.mock.calls.map((c: unknown[]) => c[1])).toEqual([
        'sms_settings',
        'webpush_settings',
        'mobilepush_settings',
        'whatsapp_settings',
      ]);
    });

    it('skips validation when messageType is undefined', async () => {
      const { service, accountConfigsProvider } = buildService(null);
      await expect((service as any).assertChannelEnabled(undefined, 10)).resolves.toBeUndefined();
      expect(accountConfigsProvider.getByAccountId).not.toHaveBeenCalled();
    });

    it('skips validation for an unrecognized messageType', async () => {
      const { service, accountConfigsProvider } = buildService(null);
      await expect((service as any).assertChannelEnabled('carrier-pigeon', 10)).resolves.toBeUndefined();
      expect(accountConfigsProvider.getByAccountId).not.toHaveBeenCalled();
    });

    it('treats a malformed config value as an inactive channel', async () => {
      const { service } = buildService({ value: 'not-json' });
      await expect((service as any).assertChannelEnabled('email', 10)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
