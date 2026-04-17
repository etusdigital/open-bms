import { Body, Controller, Post, Query } from '@nestjs/common';
import { BatchService } from './batch.service';
import { Batch, SubscriptionMessage } from '../mail/mail.interface';
import { FormatterUtils } from '../utils/formatter.utils';
import { AutomationContactsBatch, CompressedCampaignPayload } from '../interfaces';
import { env } from 'process';

@Controller('batch')
export class BatchController {
  constructor(
    private readonly batchService: BatchService,
    private readonly formatterUtils: FormatterUtils,
  ) {}

  @Post('/campaigns')
  async campaigns(@Body() body: Batch | SubscriptionMessage | CompressedCampaignPayload, @Query() { debug }: { debug: string }) {
    const originalBody = body;

    if ('subscription' in (body as SubscriptionMessage)) {
      body = this.formatterUtils.parseBase64<Batch>((body as SubscriptionMessage).message.data);
    }

    const redisKeyPayload = `${(body as CompressedCampaignPayload).campaignKey || ''}`;
    if (redisKeyPayload) {
      body = (await this.batchService.getRedis(redisKeyPayload)) as Batch;
    }

    try {
      const batch = body as Batch;

      if (env.STOP_CAMPAIGNS?.split(',').find((id) => Number(id) === batch.campaign_id)) {
        console.log(`Stop processing campaign: ${batch.campaign_id}`);
        return {};
      }

      return await this.batchService.campaignBatch(batch, debug);
    } catch (error) {
      if (redisKeyPayload) {
        await this.batchService.setRedis(redisKeyPayload, body);
      }

      console.error(`[campaigns] redis body: ${JSON.stringify(body)}`);
      console.error(`[campaigns] request body: ${JSON.stringify(originalBody)}`);
      console.error(`[campaigns] error: ${error}`);
      return await this.batchService.setPubsubErros(originalBody);
    }
  }

  @Post('/automations')
  async automations(@Body() body: AutomationContactsBatch | SubscriptionMessage, @Query() { debug }: { debug: string }) {
    const batch =
      'email' in (body as AutomationContactsBatch)
        ? (body as AutomationContactsBatch)
        : this.formatterUtils.parseBase64<AutomationContactsBatch>((body as SubscriptionMessage).message.data);

    return await this.batchService.automationBatch(batch, debug);
  }
}
