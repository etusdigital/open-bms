import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CampaignEntity } from 'src/entities/campaign.entity';
import { MessagesService } from '../messages/messages.service';
import { CampaignDto } from '../campaigns/campaign.dto';
import { ClsService } from 'nestjs-cls';
import { CampaignsService } from '../campaigns/campaigns.service';
import { InjectRepository } from '@nestjs/typeorm';
import { MessageDto } from '../messages/messages.dto';

@Injectable()
export class BatchService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    private readonly messagesService: MessagesService,
    private readonly campaignsService: CampaignsService,
    private readonly cls: ClsService,
  ) {}

  async createCampaignsAndMessages(campaignDtos: CampaignDto[], accountId?: number): Promise<any> {
    const campaigns = [];
    const queryRunner = this.campaignRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      //Create messages
      const _campaignDtos = [];
      for (const campaignDto of campaignDtos) {
        const _messages = [];
        for (const message of campaignDto.campaignMessage) {
          _messages.push(await this.messagesService.createMessage(message as MessageDto, undefined, undefined, undefined, queryRunner));
        }
        _campaignDtos.push({
          ...campaignDto,
          campaignMessage: _messages.map((message) => ({
            message,
          })),
        });
      }

      campaignDtos = _campaignDtos;

      //Create campaigns
      for (const campaignDto of campaignDtos) {
        const campaign = await this.campaignsService.createOne(
          {
            ...campaignDto,
            accountId: accountId || this.cls.get('accountId'),
          },
          undefined,
          queryRunner,
        );
        campaigns.push(campaign);
      }

      await queryRunner.commitTransaction();
      return campaigns;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await this.campaignsService.deleteAllTasks(campaigns as CampaignEntity[]);
      console.error(error);
      throw new InternalServerErrorException(error);
    } finally {
      await queryRunner.release();
    }
  }
}
