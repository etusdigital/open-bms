import { ForbiddenException } from '@nestjs/common';
import { SettingsController } from '../settings.controller';
import { SettingsService } from '../settings.service';

function buildController() {
  const service = {
    getSendgrid: jest.fn(),
    saveSendgrid: jest.fn(),
    testSendgrid: jest.fn(),
  } as unknown as SettingsService;
  const controller = new SettingsController(service);
  return { controller, service: service as any };
}

const REQ_NON_SUPER = { authzContext: { isSuperAdmin: false, userId: 1 } };
const REQ_SUPER = { authzContext: { isSuperAdmin: true, userId: 1 } };
const REQ_NO_CONTEXT = {} as any;

describe('SettingsController — super_admin gate', () => {
  it('GET /settings/sendgrid throws 403 when not super_admin', async () => {
    const { controller } = buildController();
    await expect(controller.getSendgrid(REQ_NON_SUPER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getSendgrid(REQ_NO_CONTEXT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GET /settings/sendgrid returns service result when super_admin', async () => {
    const { controller, service } = buildController();
    service.getSendgrid.mockResolvedValue({ apiKey: 'SG.x' });
    expect(await controller.getSendgrid(REQ_SUPER)).toEqual({ apiKey: 'SG.x' });
  });

  it('PUT /settings/sendgrid throws 403 when not super_admin', async () => {
    const { controller } = buildController();
    await expect(controller.saveSendgrid({ apiKey: 'SG.x' } as any, REQ_NON_SUPER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('PUT /settings/sendgrid calls service when super_admin', async () => {
    const { controller, service } = buildController();
    service.saveSendgrid.mockResolvedValue(undefined);
    await controller.saveSendgrid({ apiKey: 'SG.x' } as any, REQ_SUPER);
    expect(service.saveSendgrid).toHaveBeenCalledWith({ apiKey: 'SG.x' });
  });

  it('POST /settings/sendgrid/test throws 403 when not super_admin', () => {
    const { controller } = buildController();
    expect(() => controller.testSendgrid({ apiKey: 'SG.x' } as any, REQ_NON_SUPER, '1.1.1.1')).toThrow(ForbiddenException);
  });

  it('POST /settings/sendgrid/test calls service when super_admin', async () => {
    const { controller, service } = buildController();
    service.testSendgrid.mockResolvedValue({ accountName: 'X' });
    await controller.testSendgrid({ apiKey: 'SG.x' } as any, REQ_SUPER, '1.1.1.1');
    expect(service.testSendgrid).toHaveBeenCalledWith('SG.x', '1.1.1.1');
  });
});
