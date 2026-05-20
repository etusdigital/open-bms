import { ForbiddenException } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignDto } from './campaign.dto';

describe('CampaignsController — channel gating on POST /campaigns', () => {
  function buildController() {
    const campaignService = {
      assertChannelEnabled: jest.fn().mockResolvedValue(undefined),
      createOne: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const cls = { get: jest.fn((key: string) => (key === 'accountId' ? 10 : undefined)) };
    const controller = Object.create(CampaignsController.prototype) as CampaignsController;
    (controller as any).campaignService = campaignService;
    (controller as any).cls = cls;
    return { controller, campaignService };
  }

  const emailDto = () => ({ title: 'Promo', type: 'simple', messageType: 'email' }) as CampaignDto;

  it('creates the campaign when the channel is enabled', async () => {
    const { controller, campaignService } = buildController();
    await controller.createOne(emailDto());
    expect(campaignService.assertChannelEnabled).toHaveBeenCalledWith('email', 10);
    expect(campaignService.createOne).toHaveBeenCalledTimes(1);
  });

  it('rejects and never reaches createOne when the channel is disabled', async () => {
    const { controller, campaignService } = buildController();
    campaignService.assertChannelEnabled.mockRejectedValue(new ForbiddenException('channel disabled'));
    await expect(controller.createOne(emailDto())).rejects.toBeInstanceOf(ForbiddenException);
    expect(campaignService.createOne).not.toHaveBeenCalled();
  });
});
