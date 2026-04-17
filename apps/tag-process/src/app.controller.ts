import { Body, Param, Query } from '@nestjs/common';
import { Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { EventsTarget, EventsTrigger, LeadMessage, PubSubMessage, SegmentToClickHouse, TagBatch } from './interfaces';
import { FormatterUtils } from './utils/formatter.utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly formatterUtils: FormatterUtils,
  ) {}

  @Post('/add')
  async addTag(@Body() data: LeadMessage | PubSubMessage): Promise<any> {
    try {
      const leadMessage =
        'subscription' in (data as PubSubMessage)
          ? this.formatterUtils.parseLead(data as PubSubMessage)
          : (data as LeadMessage);

      return await this.appService.addTag(leadMessage);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/remove')
  async removeTag(@Body() data: LeadMessage | PubSubMessage): Promise<any> {
    try {
      const leadMessage =
        'subscription' in (data as PubSubMessage)
          ? this.formatterUtils.parseLead(data as PubSubMessage)
          : (data as LeadMessage);

      return await this.appService.removeTag(leadMessage);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/cancel')
  async cancel(@Body() data: LeadMessage | PubSubMessage): Promise<any> {
    try {
      const leadMessage =
        'subscription' in (data as PubSubMessage)
          ? this.formatterUtils.parseLead(data as PubSubMessage)
          : (data as LeadMessage);

      return await this.appService.automationCancel(leadMessage);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/contacts-batch')
  async processContactsBatch(@Body() data: TagBatch | PubSubMessage): Promise<any> {
    try {
      const contactBatch =
        'subscription' in (data as PubSubMessage)
          ? this.formatterUtils.parseBatch(data as PubSubMessage)
          : (data as TagBatch);

      return await this.appService.processContactsBatch(contactBatch);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/batch')
  async processTagBatch(@Body() data: TagBatch | PubSubMessage): Promise<any> {
    try {
      const tagBatch =
        'subscription' in (data as PubSubMessage)
          ? this.formatterUtils.parseBatch(data as PubSubMessage)
          : (data as TagBatch);

      return await this.appService.processTagBatch(tagBatch);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/completed')
  async processCompleted(@Body() data: LeadMessage | PubSubMessage): Promise<any> {
    try {
      const leadMessage =
        'subscription' in (data as PubSubMessage)
          ? this.formatterUtils.parseLead(data as PubSubMessage)
          : (data as LeadMessage);

      return await this.appService.processCompleted(leadMessage);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/process-segment/:id')
  async processSegment(@Param('id') id: number, @Query() params?: { is_campaign: boolean }) {
    return this.appService.processSegment(id, params.is_campaign);
  }

  @Post('/process-segment-clickhouse')
  async processSegmentClickHouse(@Body() data: SegmentToClickHouse): Promise<any> {
    try {
      const segmentData =
        'subscription' in (data as SegmentToClickHouse)
          ? this.formatterUtils.parseLead(data as SegmentToClickHouse)
          : (data as SegmentToClickHouse);

      return await this.appService.processSegmentToClickHouse(segmentData);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/events-trigger')
  async eventsTrigger(@Body() data: EventsTrigger): Promise<any> {
    try {
      const event =
        'subscription' in (data as EventsTrigger)
          ? this.formatterUtils.parseLead(data as EventsTrigger)
          : (data as EventsTrigger);

      return await this.appService.processEventTrigger(event);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  @Post('/target-achieved')
  async targetAchieved(@Body() data: EventsTarget): Promise<any> {
    try {
      const event =
        'subscription' in (data as EventsTarget)
          ? this.formatterUtils.parseLead(data as EventsTarget)
          : (data as EventsTarget);

      return await this.appService.targetAchieved(event);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}
