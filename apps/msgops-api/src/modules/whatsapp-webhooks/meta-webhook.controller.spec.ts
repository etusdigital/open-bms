import { Test, TestingModule } from '@nestjs/testing';
import { MetaWebhookController } from './meta-webhook.controller';
import { WhatsappWebhooksService } from './whatsapp-webhooks.service';

// Verifies the F1 fix AT THE CONTROLLER LEVEL: the body-dedup key (set by
// isDuplicate) must be RELEASED when processing throws, so Meta's byte-identical
// retry can reprocess instead of hitting a stale dedup key and being skipped.
jest.mock('@bms/whatsapp-cloud', () => ({ verifyMetaSignature: () => true }));

describe('MetaWebhookController — F1 dedup release on failure', () => {
  let controller: MetaWebhookController;

  const mockWebhooks = {
    buildMetaDeliveryKey: jest.fn(() => 'BODYHASH'),
    isDuplicate: jest.fn(),
    processMetaEvent: jest.fn(),
    releaseDedupKey: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.WHATSAPP_APP_SECRET = 'secret';
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetaWebhookController],
      providers: [{ provide: WhatsappWebhooksService, useValue: mockWebhooks }],
    }).compile();
    controller = module.get(MetaWebhookController);
  });

  const req: any = { rawBody: Buffer.from('{}', 'utf8') };

  it('on PG failure: releases the body-dedup key, then rethrows (→ 5xx → Meta retry)', async () => {
    mockWebhooks.isDuplicate.mockResolvedValueOnce(false);
    mockWebhooks.processMetaEvent.mockRejectedValueOnce(new Error('pg_write_failed'));

    await expect(controller.receive(req, 'sig', {})).rejects.toThrow('pg_write_failed');
    // Critical: the dedup key is released so the retry is NOT a no-op.
    expect(mockWebhooks.releaseDedupKey).toHaveBeenCalledWith('meta', 'BODYHASH');
  });

  it('on success: does NOT release the key (retry-storm protection preserved)', async () => {
    mockWebhooks.isDuplicate.mockResolvedValueOnce(false);
    mockWebhooks.processMetaEvent.mockResolvedValueOnce(undefined);

    await expect(controller.receive(req, 'sig', {})).resolves.toEqual({ ok: true });
    expect(mockWebhooks.releaseDedupKey).not.toHaveBeenCalled();
  });

  it('duplicate body: skips without processing or releasing', async () => {
    mockWebhooks.isDuplicate.mockResolvedValueOnce(true);

    await expect(controller.receive(req, 'sig', {})).resolves.toEqual({ ok: true, skipped: 'duplicate' });
    expect(mockWebhooks.processMetaEvent).not.toHaveBeenCalled();
    expect(mockWebhooks.releaseDedupKey).not.toHaveBeenCalled();
  });
});
