import { Body, Controller, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { BatchService } from './batch.service';
import { Batch } from '../mail/mail.interface';
import { AutomationContactsBatch, CompressedCampaignPayload } from '../interfaces';
import { env } from 'process';

@Controller('internal')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  private assertAuth(token: string): void {
    if (token !== process.env.INTERNAL_AUTH_TOKEN) {
      throw new UnauthorizedException();
    }
  }

  private isEmailBatch(batch: Batch): boolean {
    const type = (batch?.message as { type?: string } | undefined)?.type;
    return !type || type === 'email';
  }

  @Post('/campaigns/send')
  async campaigns(@Headers('x-internal-token') token: string, @Body() body: Batch | CompressedCampaignPayload, @Query() { debug }: { debug: string }) {
    this.assertAuth(token);
    const originalBody = body;

    const redisKeyPayload = `${(body as CompressedCampaignPayload).campaignKey || ''}`;
    if (redisKeyPayload) {
      body = (await this.batchService.getRedis(redisKeyPayload)) as Batch;
    }

    try {
      const batch = body as Batch;

      if (!this.isEmailBatch(batch)) {
        return { skipped: 'not an email campaign' };
      }

      if (env.STOP_CAMPAIGNS?.split(',').find((id) => Number(id) === batch.campaign_id)) {
        console.log(`Stop processing campaign: ${batch.campaign_id}`);
        return {};
      }

      const result = await this.batchService.campaignBatch(batch, debug);
      if (redisKeyPayload) {
        await this.batchService.deleteRedis(redisKeyPayload);
      }
      return result;
    } catch (error) {
      if (redisKeyPayload) {
        await this.batchService.setRedis(redisKeyPayload, body);
      }

      console.error(`[campaigns] redis body: ${JSON.stringify(body)}`);
      console.error(`[campaigns] request body: ${JSON.stringify(originalBody)}`);
      console.error(`[campaigns] error: ${error}`);
      return await this.batchService.publishCampaignError(originalBody);
    }
  }

  @Post('/automations/process')
  async automations(@Headers('x-internal-token') token: string, @Body() body: AutomationContactsBatch, @Query() { debug }: { debug: string }) {
    this.assertAuth(token);
    return await this.batchService.automationBatch(body, debug);
  }
}
