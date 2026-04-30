import { Injectable, InternalServerErrorException, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { SchedulerService } from '../../providers/queue/scheduler.service';
import { CampaignDto } from './campaign.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, QueryRunner, Repository } from 'typeorm';
import { CampaignEntity } from '../../entities/campaign.entity';
import { PaginationDto } from '../../dtos/pagination.dto';
import { RedisService } from '../../providers/redis.provider';
import { CampaignMessageEntity } from '../../entities/campaign-message.entity';
import { CampaignRecurrenceFrequency, CampaignsMessageType, CampaignsStatus, CampaignsType } from './campaigns.interface';
import { env } from 'process';
import { CampaignFilterDto } from './campaign-filter.dto';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ClsService } from 'nestjs-cls';
import { replaceSpecialChars } from 'src/utils/utils.service';
import { ContactEntity } from 'src/entities/contact.entity';
import dayjs from 'dayjs';
import { ContactDeviceEntity } from 'src/entities/contact-device.entity';
import { CampaignContactEntity } from 'src/entities/campaign-contact.entity';
import { TagEntity } from 'src/entities/tag.entity';
import { AccountEntity } from 'src/entities/account.entity';
import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import schema from 'src/modules/automations/schema/automation-schema.json';
import { SlackProvider } from 'src/providers/slack.provider';
import { LabelsContentsEntity } from 'src/entities/labels-contents.entity';
import { LabelsEntity } from 'src/entities/labels.entity';
import { LabelsService } from '../labels/labels.service';

@Injectable()
export class CampaignsService {
  public ajv: Ajv;
  constructor(
    private readonly scheduler: SchedulerService,
    private readonly redisService: RedisService,
    private readonly slackProvider: SlackProvider,
    @InjectRepository(ContactEntity)
    private readonly contactRepository: Repository<ContactEntity>,
    @InjectRepository(ContactDeviceEntity)
    private readonly contactDevicesRepository: Repository<ContactDeviceEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignRepository: Repository<CampaignEntity>,
    @InjectRepository(CampaignMessageEntity)
    private readonly campaignMessageRepository: Repository<CampaignMessageEntity>,
    @InjectRepository(CampaignContactEntity)
    private readonly campaignContactRepository: Repository<CampaignContactEntity>,
    @InjectRepository(TagEntity)
    private readonly tagRepository: Repository<TagEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(LabelsContentsEntity)
    private readonly labelsContentsRepository: Repository<LabelsContentsEntity>,
    @InjectRepository(LabelsEntity)
    private readonly labelsRepository: Repository<LabelsEntity>,
    private readonly cls: ClsService,
    private readonly labelsService: LabelsService,
  ) {
    this.ajv = new Ajv({ allErrors: true });
    ajvErrors(this.ajv);
  }

  async findAll(params: CampaignFilterDto): Promise<PaginationDto<CampaignDto>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'scheduleTo';
      const order = params.order ? params.order : 'DESC';
      const campaignsQuery = await this.campaignRepository
        .createQueryBuilder('campaigns')
        .leftJoinAndSelect('campaigns.campaignMessage', 'campaignMessage')
        .leftJoinAndSelect('campaigns.labelContent', 'labelContent', 'labelContent.entity_name = :entityName', { entityName: 'campaigns' })
        .leftJoinAndSelect('labelContent.label', 'label')
        .where({ accountId: this.cls.get('accountId') })
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`campaigns.${sortBy}`, `${order}`);

      if (params.title) {
        campaignsQuery.andWhere(`(campaigns.name iLike :search OR campaigns.title iLike :search OR campaigns.description iLike :search)`, {
          search: `%${params.title}%`,
        });
      }

      if (params.time) {
        campaignsQuery.andWhere(`campaigns.scheduleTo >= :time`, { time: params.time });
      }

      if (params.type) {
        campaignsQuery.andWhere('campaigns.messageType = :type', { type: params.type });
      }

      if (params.startDate && params.endDate) {
        campaignsQuery.andWhere(
          `(campaigns.scheduleTo AT TIME ZONE 'America/Sao_Paulo')::date >= :startDate AND (campaigns.scheduleTo AT TIME ZONE 'America/Sao_Paulo')::date <= :endDate`,
          { startDate: params.startDate, endDate: params.endDate },
        );
      }

      if (params.status) {
        campaignsQuery.andWhere('campaigns.status IN (:...status)', { status: params.status });
      }

      if (params.isTrigger !== undefined) {
        if (params.isTrigger) {
          campaignsQuery.andWhere('campaigns.type = :type', { type: 'trigger' });
        } else {
          campaignsQuery.andWhere('campaigns.type != :type', { type: 'trigger' });
        }
      }

      if (params.types) {
        campaignsQuery.andWhere('campaigns.type IN (:...types)', { types: params.types });
      }

      if (params.messages) {
        campaignsQuery.andWhere('campaigns.messageType IN (:...messages)', { messages: params.messages });
      }

      if (params.tags) {
        const campaignsIds = await this.filterByTags(params.tags);
        if (!campaignsIds.length) return new PaginationDto({ results: [], total: 0, page: params.page, itemsPerPage: params.itemsPerPage });
        campaignsQuery.andWhere('campaigns.id IN (:...campaignsIds)', { campaignsIds });
      }

      if (params.labels) {
        const campaignsIds = await this.labelsService.filterEntitiesByLabels('campaigns', params.labels);
        if (!campaignsIds.length) return new PaginationDto({ results: [], total: 0, page: params.page, itemsPerPage: params.itemsPerPage });
        campaignsQuery.andWhere('campaigns.id IN (:...campaignsIds)', { campaignsIds });
      }

      if (params.segments) {
        const campaignsIds = await this.filterByTags(params.segments);
        if (!campaignsIds.length) return new PaginationDto({ results: [], total: 0, page: params.page, itemsPerPage: params.itemsPerPage });
        campaignsQuery.andWhere('campaigns.id IN (:...campaignsIds)', { campaignsIds });
      }

      if (params.campaignsIds) {
        campaignsQuery.andWhere('campaigns.id IN (:...ids)', { ids: params.campaignsIds });
      }

      const [results, total] = await campaignsQuery.getManyAndCount();

      return new PaginationDto<CampaignDto>({
        results: results,
        total,
        page: params.page,
        itemsPerPage: params.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async filterByTags(tags: number[]): Promise<number[]> {
    const campaignsIds = [];
    for (const tagId of tags) {
      (await this.getCampaignsByTag(tagId)).forEach((campaign) => {
        campaignsIds.push(campaign.id);
      });
    }
    return campaignsIds;
  }

  async findOne(id: number): Promise<CampaignDto> {
    const campaign = await this.campaignRepository.findOneOrFail({ where: { id, accountId: this.cls.get('accountId') } });
    campaign.labelContent = await this.labelsService.findLabelsContentByType(campaign.id, 'campaigns');
    if (campaign.type === CampaignsType.TRIGGER) {
      campaign.steps = this.mergeStepsAndTriggers(campaign);
    }

    return campaign;
  }

  async validateNames(params: CampaignFilterDto) {
    const value = params.titleCreate.trim();
    const title = value;
    const name = this.cls.get('isInternalAccount') ? value : replaceSpecialChars(value);

    return this.campaignRepository
      .createQueryBuilder('campaigns')
      .where({
        accountId: this.cls.get('accountId'),
        ...(params.type === 'name' ? { name: name } : { title: title }),
        ...(params.id && { id: Not(params.id) }),
      })
      .getMany();
  }

  async deleteAllTasks(campaigns: CampaignEntity[]) {
    await Promise.all(campaigns.map((campaign) => this.deleteTasks(campaign)));
  }

  findStepJsonValidateError(steps, path: string) {
    const pathSplit = path.split('/');
    let stepReturn = JSON.parse(JSON.stringify(steps));
    pathSplit.forEach((key) => {
      if (key && key !== 'settings' && stepReturn) {
        stepReturn = stepReturn[key];
      }
    });

    return stepReturn;
  }

  splitStepsAndTriggers(campaignDto: CampaignDto) {
    campaignDto.triggers = campaignDto.steps;
    campaignDto.steps = JSON.parse(JSON.stringify(campaignDto.steps.child));
    delete campaignDto.triggers.child;
    return campaignDto;
  }

  isValidSteps(campaignDto: CampaignDto) {
    const validate = this.ajv.compile(schema);
    const isValid = validate(campaignDto.steps);
    if (!isValid) {
      const stepError = this.findStepJsonValidateError(campaignDto.steps, validate.errors[0].instancePath);
      return { isValid: false, stepError: stepError?.id || 0, messageError: validate.errors[0].message };
    }
    return { isValid: true };
  }

  validateAndFormatTriggerCampaign(campaignDto: CampaignDto): { isValid: boolean; result: any } {
    const { isValid, stepError, messageError } = this.isValidSteps(campaignDto);
    if (!isValid) {
      return { isValid: false, result: { stepError: stepError?.id || 0, messageError } };
    }
    campaignDto = this.splitStepsAndTriggers(campaignDto);
    return { isValid: true, result: campaignDto };
  }

  async createOne(campaignDto: CampaignDto, accountId?: number, queryRunner?: QueryRunner): Promise<any> {
    const isTriggerCampaign = campaignDto.type === CampaignsType.TRIGGER;
    if (isTriggerCampaign) {
      const validationResult = this.validateAndFormatTriggerCampaign(campaignDto);
      if (!validationResult.isValid) {
        throw new InternalServerErrorException(validationResult.result, `Error to validate setp payload`);
      }
      campaignDto = validationResult.result;
    }

    campaignDto = this.formattedCampaignDate(campaignDto);
    await this.checkDuplicateAudience(campaignDto);
    campaignDto.name = this.cls.get('isInternalAccount') && !isTriggerCampaign ? replaceSpecialChars(campaignDto.name.trim()) : replaceSpecialChars(campaignDto.title.trim());

    this.validatedScheduleToDate(campaignDto);
    if (campaignDto.type !== CampaignsType.TESTAB) {
      campaignDto = this.removeTestAbData(campaignDto);
    }

    // Google Ad Manager (UTM) integration is SaaS-only — no consumer in OSS.
    // Skip the network call AND the payload construction. See createUtmCampaign().
    const connection = queryRunner ? queryRunner.manager : this.campaignRepository.manager;

    try {
      const messages = campaignDto.campaignMessage;
      delete campaignDto.campaignMessage;
      campaignDto.createdAt = new Date();
      campaignDto.publisher = campaignDto.publisher || 'plusdin';
      campaignDto.accountId = accountId ? accountId : this.cls.get('accountId');
      campaignDto.query = isTriggerCampaign ? null : await this.generateCampaignQuery(campaignDto);
      campaignDto.testabAudiencePercent = campaignDto.type == CampaignsType.SPLIT ? 100 : campaignDto.testabAudiencePercent;
      const tags = isTriggerCampaign ? [] : await this.filterTags(campaignDto.steps);
      campaignDto.tags = [...tags];

      if (campaignDto.messageType === CampaignsMessageType.WEB_PUSH && (!campaignDto.spreadSending || campaignDto.spreadSending < 30)) {
        campaignDto.spreadSending = 30;
      }

      const campaign = this.campaignRepository.create(campaignDto);
      let campaignCreate = await connection.save(campaign);

      const campaignsMessages = messages.map((message) => {
        return {
          campaignId: campaignCreate.id,
          messageId: message.id,
        };
      });

      const hasMessageIds = campaignsMessages.every(({ messageId }) => messageId !== undefined);
      if (!hasMessageIds) {
        campaignDto.status = 0;
        campaignCreate.status = 0;
      }

      if (campaignDto.status != 0 && !isTriggerCampaign) {
        campaignCreate = await this.createTask(campaignDto, campaignCreate);
      }

      if (hasMessageIds) {
        await connection.insert(CampaignMessageEntity, campaignsMessages);
      }

      await connection.update(CampaignEntity, { id: campaignCreate.id }, campaignCreate);

      const redisClient = await this.redisService.getClient();
      if (isTriggerCampaign && campaign.triggers.settings.type === 'events' && campaign.triggers.settings.eventType) {
        await redisClient.set(`events_trigger:campaign:${this.cls.get('accountId')}:${campaign.triggers.settings.eventType}:${campaign.triggers.settings.id}`, 'true');
      }

      if (isTriggerCampaign && campaign.triggers.settings.type === 'custom_events' && campaign.triggers.settings.id) {
        await redisClient.set(`events_trigger:campaign:${this.cls.get('accountId')}:custom_events:${campaign.triggers.settings.id}`, 'true');
      }

      if (campaignDto.labels && campaignDto.labels.length > 0) {
        await this.labelsService.saveEntityLabelsSafe('campaigns', campaignCreate.id, campaignDto.labels);
      }

      return campaignCreate;
    } catch (error) {
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Campaign with that name already exists');
      }
      console.error(error);
      throw new InternalServerErrorException(
        error,
        `The campaign was successfully created but some or all email templates were not, they were flagged with 'creationError'. ${JSON.stringify(campaignDto)}`,
      );
    }
  }

  mergeStepsAndTriggers(campaign: CampaignEntity) {
    return {
      ...campaign.triggers,
      child: campaign.steps,
    };
  }

  async update(campaignDto: CampaignDto): Promise<CampaignDto> {
    const isTriggerCampaign = campaignDto.type === CampaignsType.TRIGGER;
    if (isTriggerCampaign) {
      const validationResult = this.validateAndFormatTriggerCampaign(campaignDto);
      if (!validationResult.isValid) {
        throw new InternalServerErrorException(validationResult.result, `Error to validate setp payload`);
      }
      campaignDto = validationResult.result;
    }

    campaignDto = this.formattedCampaignDate(campaignDto);
    await this.checkDuplicateAudience(campaignDto);
    campaignDto.name = this.cls.get('isInternalAccount') && !isTriggerCampaign ? replaceSpecialChars(campaignDto.name.trim()) : replaceSpecialChars(campaignDto.title.trim());

    let campaign = await this.campaignRepository.findOneOrFail({
      where: {
        id: campaignDto.id,
        accountId: this.cls.get('accountId'),
      },
    });
    let oldEventType = '';
    let oldTriggerId = 0;
    if (isTriggerCampaign) {
      oldEventType = campaign.triggers?.settings?.eventType;
      oldTriggerId = campaign.triggers?.settings?.id;
    }

    // Google Ad Manager (UTM) integration is SaaS-only — see createUtmCampaign().

    if (campaignDto.messageType === CampaignsMessageType.WEB_PUSH && (!campaignDto.spreadSending || campaignDto.spreadSending < 30)) {
      campaignDto.spreadSending = 30;
    }

    this.validatedScheduleToDate(campaignDto, campaign);
    if (campaignDto.type !== CampaignsType.TESTAB) {
      campaignDto = this.removeTestAbData(campaignDto);
    }

    if (campaign.type === CampaignsType.RECURRING && campaign.recurrenceCount >= 1) {
      const originalRecurrenceSettings = campaign.recurrenceSettings;
      const updatedRecurrenceSettings = campaignDto.recurrenceSettings;

      const hasRecurringSettingsChanged = JSON.stringify(originalRecurrenceSettings) !== JSON.stringify(updatedRecurrenceSettings);

      if (hasRecurringSettingsChanged) {
        let newEventDate = updatedRecurrenceSettings.date.getTime() === campaign.recurrenceSettings.date.getTime() ? campaign.scheduleTo : new Date(updatedRecurrenceSettings.date);
        const sendUntilDate = updatedRecurrenceSettings.untilDate || null;
        const currentDate = new Date();

        if (updatedRecurrenceSettings.untilSend !== null && campaign.recurrenceCount === updatedRecurrenceSettings.untilSend) {
          return campaign;
        }

        if (updatedRecurrenceSettings.date < currentDate) {
          if (updatedRecurrenceSettings.frequency === CampaignRecurrenceFrequency.daily) {
            newEventDate.setDate(newEventDate.getDate() + updatedRecurrenceSettings.interval);
          }

          if (updatedRecurrenceSettings.frequency === CampaignRecurrenceFrequency.weekly) {
            newEventDate = this.nextOccurrence(campaign.recurrenceSettings.lastSentDate, updatedRecurrenceSettings.weekDays, updatedRecurrenceSettings.interval);
          }

          if (updatedRecurrenceSettings.frequency === CampaignRecurrenceFrequency.monthly) {
            newEventDate.setMonth(newEventDate.getMonth() + updatedRecurrenceSettings.interval);
          }

          if (sendUntilDate === null || this.isNextDateValid(newEventDate, sendUntilDate)) {
            campaignDto.scheduleTo = newEventDate;
            campaign.status = CampaignsStatus.Scheduled;
          } else {
            campaign.status = CampaignsStatus.Completed;
          }
        }
      }
    }

    let hasTaskBeenCreated = false;
    try {
      const messages = campaignDto.campaignMessage;
      campaignDto.query = isTriggerCampaign ? null : await this.generateCampaignQuery(campaignDto);
      const tags = isTriggerCampaign ? [] : await this.filterTags(campaignDto.steps);
      campaignDto.tags = [...tags];
      campaignDto.testabAudiencePercent = campaignDto.type == CampaignsType.SPLIT ? 100 : campaignDto.testabAudiencePercent;
      delete campaignDto.campaignMessage;
      delete campaign.campaignMessage;

      await this.campaignMessageRepository.delete({ campaignId: campaign.id });
      const campaignsMessages = messages.map((message) => {
        return {
          campaignId: campaign.id,
          messageId: message.id,
        };
      });
      await this.campaignMessageRepository.insert(campaignsMessages);

      if (!isTriggerCampaign && campaign.status === CampaignsStatus.Completed) {
        await this.deleteTasks(campaign);
      }

      if (!isTriggerCampaign && campaign.status !== CampaignsStatus.Completed && this.shouldUpdateTask(campaignDto, campaign)) {
        await this.deleteTasks(campaign);
        this.campaignRepository.merge(campaign, campaignDto);
        campaign = await this.createTask(campaignDto, campaign);
        hasTaskBeenCreated = true;
      } else {
        this.campaignRepository.merge(campaign, campaignDto);
      }

      const isInvalidTasks = this.invalidCampaigTask(campaign);
      if (!isTriggerCampaign && isInvalidTasks) {
        console.log(`Error when creating campaign tasks ${JSON.stringify(campaign)}`);
        throw new HttpException('Error when creating campaign tasks', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      await this.campaignRepository.update(campaign.id, campaign);

      if (isTriggerCampaign && campaign.triggers?.settings?.type === 'events' && campaign.triggers?.settings?.eventType) {
        const redisClient = await this.redisService.getClient();

        await redisClient.del([
          `events_trigger:campaign:${this.cls.get('accountId')}:${oldEventType}:${oldTriggerId}`,
          `events_trigger:${this.cls.get('accountId')}:${oldEventType}:${oldTriggerId}:campaigns`,
          `events_trigger:${this.cls.get('accountId')}:${campaign.triggers?.settings?.eventType}:${campaign.triggers?.settings?.id}:campaigns`,
        ]);

        await redisClient.set(`events_trigger:campaign:${this.cls.get('accountId')}:${campaign.triggers?.settings?.eventType}:${campaign.triggers?.settings?.id}`, 'true');
      }

      if (isTriggerCampaign && campaign.triggers.settings.type === 'custom_events' && campaign.triggers.settings.id) {
        const redisClient = await this.redisService.getClient();
        await redisClient.del([
          `events_trigger:campaign:${this.cls.get('accountId')}:custom_events:${oldTriggerId}`,
          `events_trigger:${this.cls.get('accountId')}:custom_events:${oldTriggerId}:campaigns`,
          `events_trigger:${this.cls.get('accountId')}:custom_events:${campaign.triggers.settings.id}:campaigns`,
        ]);
        await redisClient.set(`events_trigger:campaign:${this.cls.get('accountId')}:custom_events:${campaign.triggers.settings.id}`, 'true');
      }

      if (campaignDto.labels && campaignDto.labels.length > 0) {
        await this.labelsService.saveEntityLabelsSafe('campaigns', campaign.id, campaignDto.labels);
      }

      return campaign;
    } catch (error) {
      console.log('Error to update campaign', error);
      if (hasTaskBeenCreated) {
        await this.deleteTasks(campaign);
      }

      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Campaign with that name already exists');
      }

      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  invalidCampaigTask(campaign: CampaignEntity) {
    return (
      campaign.status !== CampaignsStatus.Draft &&
      ((campaign.type !== CampaignsType.TESTAB && campaign.scheduleToCloudTaskId == null) ||
        (campaign.type === CampaignsType.TESTAB && (campaign.testabScheduleToCloudTaskId == null || campaign.testabScheduleEndCloudTaskId == null)))
    );
  }

  nextOccurrence(currentScheduleTo: Date, weekDays: number[], interval: number): Date {
    weekDays.sort();

    let findDate = dayjs(currentScheduleTo)
      .set('hour', currentScheduleTo.getHours())
      .set('minutes', currentScheduleTo.getMinutes())
      .set('seconds', 0)
      .set('milliseconds', 0)
      .add(1, 'day');

    const latestSentDate = dayjs(currentScheduleTo).startOf('week').set('hour', currentScheduleTo.getHours()).set('minutes', currentScheduleTo.getMinutes());

    while (true) {
      if (weekDays.includes(findDate.day()) && findDate.toDate() >= dayjs().toDate()) {
        const isValidWeek = findDate.startOf('week').set('hour', currentScheduleTo.getHours()).set('minutes', currentScheduleTo.getMinutes()).diff(latestSentDate, 'week');

        if (isValidWeek % interval === 0) {
          return findDate.toDate();
        } else {
          // Not the correct week based on interval. Skip to the next week's same day.
          findDate = findDate.add(7, 'day').startOf('week').set('hour', currentScheduleTo.getHours()).set('minutes', currentScheduleTo.getMinutes());
          continue;
        }
      }

      // Move to the next day in the list of weekDays.
      const currentDayIndex = weekDays.findIndex((d) => d > findDate.day());
      if (currentDayIndex !== -1) {
        findDate = findDate.add(weekDays[currentDayIndex] - findDate.day(), 'day');
      } else {
        findDate = findDate.add(7 - findDate.day() + weekDays[0], 'day');
      }
    }
  }

  isNextDateValid(scheduleTo: Date, sendUntilDate: Date): boolean {
    return scheduleTo.getFullYear() <= sendUntilDate.getFullYear() && scheduleTo.getMonth() <= sendUntilDate.getMonth() && scheduleTo.getDate() <= sendUntilDate.getDate();
  }

  shouldUpdateTask(campaignDto: CampaignDto, campaign: CampaignEntity) {
    return (
      campaignDto.status != CampaignsStatus.Draft &&
      (campaign.scheduleTo.toString() != campaignDto.scheduleTo.toString() ||
        campaign.type != campaignDto.type ||
        (campaign.type === CampaignsType.TESTAB && campaign.testabScheduleTo.toString() != campaignDto.testabScheduleTo.toString()) ||
        (campaign.type === CampaignsType.TESTAB && campaign.testabScheduleEnd.toString() != campaignDto.testabScheduleEnd.toString()))
    );
  }

  async deleteTasks(campaign: CampaignEntity) {
    // SchedulerService.delete returns false (no-op) when the BullMQ job is
    // already gone, and rethrows on Redis/other errors. No need for the
    // legacy `error.code === 5` guard that handled CloudTasks NOT_FOUND.
    switch (campaign.type) {
      case CampaignsType.SIMPLE:
      case CampaignsType.SPLIT:
      case CampaignsType.RECURRING:
        if (campaign.scheduleToCloudTaskId) {
          await this.scheduler.delete(campaign.scheduleToCloudTaskId, env.GOOGLE_TASK_QUEUE);
        }
        break;
      case CampaignsType.TESTAB:
        if (campaign.testabScheduleToCloudTaskId) {
          await this.scheduler.delete(campaign.testabScheduleToCloudTaskId, env.GOOGLE_TASK_QUEUE_TEST_AB);
        }
        if (campaign.testabScheduleEndCloudTaskId) {
          await this.scheduler.delete(campaign.testabScheduleEndCloudTaskId, env.GOOGLE_TASK_QUEUE_TEST_AB);
        }
        break;
    }
  }

  async createTask(campaignDto: CampaignDto, campaign: CampaignEntity) {
    switch (campaignDto.type) {
      case CampaignsType.SIMPLE:
      case CampaignsType.SPLIT:
      case CampaignsType.RECURRING: {
        const endpointTask = campaignDto.type === CampaignsType.SPLIT ? env.CAMPAIGN_TEST_AB_ENDPOINT : env.CAMPAIGN_TRIGGER_ENDPOINT;
        const taskName = campaignDto.type === CampaignsType.SPLIT ? env.GOOGLE_TASK_QUEUE_TEST_AB : env.GOOGLE_TASK_QUEUE;
        const response = await this.scheduler.create(campaign.id, campaignDto.scheduleTo, endpointTask, taskName);
        campaign.scheduleToCloudTaskId = response[0].name;
        break;
      }
      case CampaignsType.TESTAB: {
        const finalEndpoint = env.CAMPAIGN_TEST_AB_ENDPOINT;
        const finalResultEndpoint = env.CAMPAIGN_RESULT_TEST_AB_ENDPOINT;
        const testab = await this.scheduler.create(campaign.id, campaignDto.testabScheduleTo, finalEndpoint, env.GOOGLE_TASK_QUEUE_TEST_AB);
        campaign.testabScheduleToCloudTaskId = testab[0].name;
        const result = await this.scheduler.create(campaign.id, campaignDto.scheduleTo, finalResultEndpoint, env.GOOGLE_TASK_QUEUE_TEST_AB);
        campaign.testabScheduleEndCloudTaskId = result[0].name;
        break;
      }
    }

    return campaign;
  }

  async deleteOne(id: number): Promise<void> {
    try {
      const campaign = await this.campaignRepository.findOneOrFail({
        where: { id, accountId: this.cls.get('accountId') },
      });

      if (campaign.type === CampaignsType.TRIGGER) {
        const eventType = campaign.triggers?.settings?.eventType || '';
        const triggerId = campaign.triggers?.settings?.id || 0;
        const remainsCampaign = await this.campaignRepository
          .createQueryBuilder('campaigns')
          .where('campaigns.account_id = :accountId', { accountId: this.cls.get('accountId') })
          .where('campaigns.id != :campaignId', { campaignId: campaign.id })
          .andWhere(`campaigns.triggers->'settings'->>'eventType' = :eventType`, { eventType })
          .andWhere(`campaigns.triggers->'settings'->>'id' = :messageId`, { messageId: triggerId })
          .getOne();

        const redisClient = await this.redisService.getClient();
        if (!remainsCampaign) {
          await redisClient.del([`events_trigger:campaign:${this.cls.get('accountId')}:${eventType}:${triggerId}`]);
        }
        await redisClient.del([`events_trigger:${this.cls.get('accountId')}:${eventType}:${triggerId}:campaigns`]);
      } else {
        if (campaign.testabScheduleToCloudTaskId && campaign.testabScheduleEndCloudTaskId) {
          await this.scheduler.delete(campaign.testabScheduleToCloudTaskId, env.GOOGLE_TASK_QUEUE_TEST_AB);
          await this.scheduler.delete(campaign.testabScheduleEndCloudTaskId, env.GOOGLE_TASK_QUEUE_TEST_AB);
        }

        if (campaign.scheduleToCloudTaskId) {
          await this.scheduler.delete(campaign.scheduleToCloudTaskId, env.GOOGLE_TASK_QUEUE);
        }
      }
      delete campaign.campaignMessage;

      campaign.title = `${campaign.title}-deleted-${campaign.id}`;
      campaign.deletedAt = new Date();
      await this.campaignRepository.save(campaign);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async duplicateCampaign(id: number) {
    try {
      const campaign = await this.campaignRepository.findOneOrFail({
        where: { id, accountId: this.cls.get('accountId') },
      });
      delete campaign.id;
      delete campaign.createdAt;
      delete campaign.updatedAt;
      campaign.scheduleToCloudTaskId = null;
      campaign.testabScheduleEndCloudTaskId = null;
      campaign.testabScheduleToCloudTaskId = null;
      campaign.status = CampaignsStatus.Draft;
      campaign.sentContacts = null;
      campaign.sentPercentage = null;

      campaign.scheduleTo = this.createCurrentDateWithOriginalTime(campaign.scheduleTo);
      if (campaign.type === CampaignsType.TESTAB) {
        campaign.testabScheduleTo = this.createCurrentDateWithOriginalTime(campaign.testabScheduleTo);
      }

      if (campaign.tags) {
        const tagsIds = campaign.tags.map((tag: any) => tag.id);
        const tags = await this.findTagsByIds(tagsIds);
        if (tags.length < campaign.tags.length) {
          campaign.tags = [];
          campaign.steps = [];
        }
      }

      campaign.title = `${campaign.title} (Cópia ${Date.now()})`;
      campaign.name = replaceSpecialChars(campaign.title);
      const messages = campaign.campaignMessage;
      delete campaign.campaignMessage;

      const newCampaign = await this.campaignRepository.save(campaign);

      const campaignsMessages = messages.map((message) => {
        return {
          campaignId: newCampaign.id,
          messageId: message.messageId,
        };
      });
      await this.campaignMessageRepository.insert(campaignsMessages);

      return newCampaign;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findTagsByIds(ids: number[]): Promise<TagEntity[]> {
    return await this.tagRepository.find({ where: { id: In(ids), accountId: this.cls.get('accountId') } });
  }

  async getStatistics(campaigns) {
    const redisClient = await this.redisService.getClient();
    return await Promise.all(
      campaigns.campaignsIds.map(async (campaignId) => {
        return {
          id: campaignId,
          sentContacts: await redisClient.get(`sentContacts:campaign:${campaignId}`),
          sentPercentage: await redisClient.get(`sentPercentage:campaign:${campaignId}`),
        };
      }),
    );
  }

  async getAllStatistics(params) {
    const query = await this.campaignRepository
      .createQueryBuilder('campaigns')
      .where({ accountId: this.cls.get('accountId') })
      .select('status, COUNT(status) AS count_status')
      .groupBy('status');

    if (params.title) {
      query.andWhere(`(campaigns.name iLike :search OR campaigns.description iLike :search)`, {
        search: `%${params.title}%`,
      });
    }

    if (params.status) {
      query.andWhere('campaigns.status IN (:...status)', { status: params.status });
    }

    if (params.types) {
      query.andWhere('campaigns.type IN (:...types)', { types: params.types });
    }

    if (params.messages) {
      query.andWhere('campaigns.messageType IN (:...messages)', { messages: params.messages });
    }

    if (params.time) {
      query.andWhere('schedule_to >= :time', { time: params.time });
    }

    if (params.tags) {
      const campaignsIds = await this.filterByTags(params.tags);
      if (!campaignsIds.length) return [];
      query.andWhere('campaigns.id IN (:...campaignsIds)', { campaignsIds });
    }

    if (params.segments) {
      const campaignsIds = await this.filterByTags(params.segments);
      if (!campaignsIds.length) return [];
      query.andWhere('campaigns.id IN (:...campaignsIds)', { campaignsIds });
    }

    if (params.startDate && params.endDate) {
      query.andWhere(`(campaigns.scheduleTo AT TIME ZONE 'America/Sao_Paulo')::date >= :startDate AND (campaigns.scheduleTo AT TIME ZONE 'America/Sao_Paulo')::date <= :endDate`, {
        startDate: params.startDate,
        endDate: params.endDate,
      });
    }

    return query.getRawMany();
  }

  async generateCampaignQuery(campaign: CampaignDto): Promise<string> {
    if (campaign.sendToAll && ['mobile-push', 'web-push'].includes(campaign.messageType)) {
      return `SELECT contacts_devices.contact_id FROM contacts_devices
        LEFT JOIN contacts ON contacts_devices.contact_id = contacts.id 
          AND contacts_devices.account_id = contacts.account_id 
        WHERE contacts.account_id = ${this.cls.get('accountId')} 
        AND contacts_devices.type = '${campaign.messageType}'`;
    } else if (campaign.sendToAll && campaign.messageType === 'sms') {
      return `SELECT id FROM contacts
        WHERE contacts.account_id = ${this.cls.get('accountId')} AND has_phone = true`;
    } else if (campaign.sendToAll && campaign.messageType === 'whatsapp') {
      return `SELECT id FROM contacts
        WHERE contacts.account_id = ${this.cls.get('accountId')} AND has_whatsapp = true`;
    }
    let query = `(`;
    for (const steps of campaign.steps) {
      let isConditionalCard = false;
      for (const [index, step] of steps.entries()) {
        if (!isConditionalCard) {
          if (step.type === 'conditionalCard') {
            const conditionalCampaign = step.value === 'INTERSECT' ? 'EXCEPT' : step.value;
            query += ` ${conditionalCampaign}`;
          }
          query += `(`;
          isConditionalCard = true;
        }
        if (step.type === 'tag') {
          query += step?.conditional && index > 0 ? ` ${step.conditional}` : ``;
          query += ` (SELECT  contact_id from contacts_tags
            WHERE account_id = ${this.cls.get('accountId')} AND is_active AND tag_id ${step.conditional_tag} (${step.tag_id})
          )`;
        }
      }
      query += `)`;
    }
    query += ` )`;
    return query;
  }

  async validateTagUsage(id: number) {
    const validate = await this.campaignRepository.query(
      `select count(*) from campaigns, jsonb_array_elements(campaigns.tags) as items where account_id = $1 
        AND (items->>'id')::int = $2 and status IN ($3, $4, $5, $6)`,
      [this.cls.get('accountId'), id, CampaignsStatus.Draft, CampaignsStatus.Scheduled, CampaignsStatus.Sending, CampaignsStatus.SendingTestAb],
    );
    return parseInt(validate[0]?.count || 0);
  }

  async filterTags(steps): Promise<{ id: number; name: string }[]> {
    const stepsFilter = [];
    for (const currentSteps of steps) {
      for (const card of currentSteps) {
        if (card.type === 'tag' && 'tag_info' in card) {
          for (const tagInfo of card.tag_info) {
            stepsFilter.push({
              id: tagInfo.id,
              name: tagInfo.name,
            });
          }
        }
      }
    }

    return [...new Map(stepsFilter.map((item) => [item['id'], item])).values()];
  }

  async checkDuplicateAudience(campaignDto: CampaignDto): Promise<void> {
    if (campaignDto.confirmSaveDuplicate || campaignDto.type === CampaignsType.TRIGGER) {
      return;
    }

    const tags = await this.filterTags(campaignDto.steps);
    const ids = tags.map((item) => item.id);
    const scheduleTo = new Date(campaignDto.scheduleTo);
    const startDate = new Date(scheduleTo);
    startDate.setHours(scheduleTo.getHours() - 1);
    const endDate = new Date(scheduleTo);
    endDate.setHours(scheduleTo.getHours() + 1);

    const results = await this.campaignRepository.query(
      "select id, title, schedule_to, tags from campaigns, jsonb_array_elements(campaigns.tags) as items where account_id = $1 AND deleted_at IS NULL AND id <> $2 AND (items->>'id')::int = ANY($3) AND schedule_to BETWEEN $4 AND $5 AND status != 0 AND message_type = $6 group by campaigns.id",
      [this.cls.get('accountId'), campaignDto.id || 0, ids, startDate, endDate, campaignDto.messageType],
    );

    if (results.length) {
      throw new HttpException(
        {
          message: `You have another ${campaignDto.messageType} campaign scheduled for the same audience at the same time`,
          conflict: results,
          statusCode: 409,
        },
        HttpStatus.CONFLICT,
      );
    }
  }

  validatedScheduleToDate(campaignDto: CampaignDto, campaign?: CampaignEntity): boolean {
    if (campaignDto.type == CampaignsType.TRIGGER || campaignDto.status == CampaignsStatus.Draft) {
      return true;
    }

    const currentDate = new Date();
    const scheduleTo = new Date(campaignDto.scheduleTo);

    if (campaignDto.type === CampaignsType.RECURRING) {
      const recurringDate = new Date(campaignDto.recurrenceSettings.date);

      if (campaign) {
        if (campaign.recurrenceCount > 0 && scheduleTo.getTime() === campaign.scheduleTo.getTime()) {
          return true;
        }

        if (recurringDate.getTime() !== campaign.recurrenceSettings.date.getTime() && recurringDate < currentDate) {
          throw new HttpException('Recurring initial Date cannot be in the past', HttpStatus.UNPROCESSABLE_ENTITY);
        }
      }

      if (recurringDate < currentDate) {
        throw new HttpException('Recurring initial Date cannot be in the past', HttpStatus.UNPROCESSABLE_ENTITY);
      }
    }

    if (campaignDto.type !== CampaignsType.TESTAB && scheduleTo < currentDate) {
      throw new HttpException('Schedule Date cannot be in the past', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    if (campaignDto.type === CampaignsType.TESTAB) {
      const testabScheduleTo = new Date(campaignDto.testabScheduleTo);
      const testabScheduleEnd = new Date(campaignDto.scheduleTo);

      if (testabScheduleTo < currentDate) {
        throw new HttpException('Test A/B Schedule date cannot be in the past', HttpStatus.UNPROCESSABLE_ENTITY);
      }

      if (testabScheduleEnd < currentDate || testabScheduleEnd < testabScheduleTo) {
        throw new HttpException('Test A/B Schedule dates cannot be in the past or early than the start date', HttpStatus.UNPROCESSABLE_ENTITY);
      }

      if (campaignDto.testabSentAfterTest && scheduleTo < testabScheduleTo) {
        throw new HttpException('Campaign Schedule Date cannot be early than the Test A/B schedule', HttpStatus.UNPROCESSABLE_ENTITY);
      }

      const minutes = (testabScheduleEnd.getTime() - testabScheduleTo.getTime()) / (1000 * 60);
      if (minutes < 30) {
        throw new HttpException('The interval between sending the test A/B and sending the winner message cannot be less than 30 minutes', HttpStatus.UNPROCESSABLE_ENTITY);
      }
    }

    return true;
  }

  async stopCampaign(id: number) {
    try {
      const redisClient = await this.redisService.getClient();
      const campaign = await this.campaignRepository.findOneOrFail({
        where: { id, accountId: this.cls.get('accountId') },
      });
      if (![CampaignsStatus.Sending, CampaignsStatus.SendingTestAb].includes(campaign.status)) {
        throw new HttpException('The campaign cannot be stopped', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      const sentContacts = await redisClient.get(`sentContacts:campaign:${campaign.id}`);
      const sentPercentage = await redisClient.get(`sentPercentage:campaign:${campaign.id}`);
      delete campaign.campaignMessage;
      campaign.sentContacts = sentContacts ? parseInt(sentContacts) : 0;
      campaign.sentPercentage = sentPercentage ? parseInt(sentPercentage) : 0;
      campaign.status = 4;

      const redisExpiration = 60 * (campaign.spreadSending + 60);
      await redisClient.set(`stop_campaign_${id}`, 'true', 'EX', redisExpiration);
      await this.campaignContactRepository.delete({ campaignId: campaign.id });

      return await this.campaignRepository.save(campaign);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async countValidContacts(params: CampaignDto): Promise<any> {
    const campaignQuery = await this.generateCampaignQuery(params);

    if (CampaignsMessageType.WEB_PUSH === params.messageType || CampaignsMessageType.MOBILE_PUSH === params.messageType) {
      const countPush = this.contactDevicesRepository
        .createQueryBuilder('contacts_devices')
        .select('COUNT(*)', 'count')
        .where(`contact_id IN (${campaignQuery})`)
        .andWhere('is_unsubscribed = false');
      return countPush.getCount();
    }

    const countContacts = this.contactRepository
      .createQueryBuilder('contacts')
      .select('COUNT(*)', 'count')
      .where(`contacts.id IN (${campaignQuery})`)
      .andWhere('contacts.account_id = :accountId', { accountId: this.cls.get('accountId') });

    switch (params.messageType) {
      case CampaignsMessageType.EMAIL:
        countContacts.andWhere(`is_unsubscribed = false AND has_bounced = false AND is_active = true`);
        break;
      case CampaignsMessageType.SMS:
        countContacts.andWhere(`is_active = true AND has_phone = true`);
        break;
      case CampaignsMessageType.WHATSAPP:
        countContacts.andWhere(`is_active = true AND has_whatsapp = true`);
        break;
    }
    return countContacts.getCount();
  }

  formattedCampaignDate(campaignDto: CampaignDto): CampaignDto {
    if (campaignDto.sendAfterCreate) {
      const key = campaignDto.type === CampaignsType.TESTAB ? 'testabScheduleTo' : 'scheduleTo';
      campaignDto[key] = new Date(dayjs().add(30, 'second').toString());
      campaignDto.status = campaignDto.type === CampaignsType.TESTAB ? CampaignsStatus.SendingTestAb : CampaignsStatus.Sending;
    }
    if (campaignDto.type === CampaignsType.TESTAB && !campaignDto.testabSentAfterTest) {
      const minutesInterval = campaignDto.spreadSending < 30 ? 35 : campaignDto.spreadSending + 5;
      campaignDto.scheduleTo = new Date(dayjs().add(minutesInterval, 'minute').toString());
    }

    return campaignDto;
  }

  removeTestAbData(campaignDto: CampaignDto) {
    campaignDto.testabScheduleTo = null;
    campaignDto.testabScheduleEnd = null;
    campaignDto.testabAudiencePercent = null;
    campaignDto.testabCriteria = null;
    campaignDto.testabSentAfterTest = false;
    campaignDto.testabScheduleEndCloudTaskId = null;
    return campaignDto;
  }

  createCurrentDateWithOriginalTime(dateInput: Date | string): Date {
    const originalDate = new Date(dateInput);
    const currentDate = new Date();

    if (isNaN(originalDate.getTime())) {
      throw new Error('Invalid date input');
    }

    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

    newDate.setUTCHours(originalDate.getUTCHours(), originalDate.getUTCMinutes(), originalDate.getUTCSeconds(), originalDate.getUTCMilliseconds());

    return newDate;
  }

  async statisticsTestab(params) {
    const redisClient = await this.redisService.getClient();
    const statistics = {};
    for (const message of params.messagesIds) {
      statistics[message] = await redisClient.hgetall(`testab:campaign:${params.campaignId}:message:${message}`);
    }
    return statistics;
  }

  async messageInUse(messageId) {
    const campaigns = await this.campaignMessageRepository
      .createQueryBuilder('campaignMessage')
      .leftJoinAndSelect('campaignMessage.campaign', 'campaign')
      .where('message_id = :messageId', { messageId })
      .getMany();

    return campaigns.map((campaignMessage) => campaignMessage.campaign?.title);
  }

  async getCampaignsByTag(tagId: number, time: number = null) {
    const params: any[] = [String(Number(tagId))];
    const timeFilter = time ? `AND schedule_to > CURRENT_DATE - $2` : '';
    if (time) params.push(Number(time));
    const query = `
      SELECT id
      FROM campaigns c, json_array_elements(tags::json) tag
      WHERE tag->>'id' = $1 ${timeFilter}
    `;

    return await this.campaignRepository.query(query, params);
  }

  async createUtmCampaign(_networkCode: unknown, _keys: unknown) {
    // SaaS-only Google Ad Manager (UTM keys) integration. No consumer exists
    // in the open-source distribution. Kept as an explicit no-op so future
    // SaaS forks can override without touching call sites.
    return { skipped: true, reason: 'GAM integration is SaaS-only' };
  }

  async lateCampaigns() {
    const campaigns = await this.campaignRepository
      .createQueryBuilder('campaigns')
      .leftJoinAndSelect('campaigns.account', 'account')
      .andWhere('campaigns.status = :status', { status: CampaignsStatus.Scheduled })
      .andWhere("campaigns.schedule_to between current_timestamp - interval '25 minute' and current_timestamp - interval '10 minute'")
      .getMany();

    if (campaigns.length > 0) {
      const slackMessage = this.formatLateCampaignsSlackMessage(campaigns);
      await this.slackProvider.sendSlackWebhook(slackMessage, process.env.SLACK_WEBHOOK_URL_MSGOPS);
    }

    return true;
  }

  private formatLateCampaignsSlackMessage(campaigns: CampaignEntity[]) {
    const campaignsInfo = campaigns
      .map((campaign) => {
        return `*ID*: ${campaign.id} *Account*: ${campaign.account.name} *Name*: ${campaign.name} *Schedule to*: ${dayjs(campaign.scheduleTo).format('DD/MM/YYYY HH:mm')}`;
      })
      .join('\n');

    return `:warning: *Late campaigns detected!* \n\n` + `*Total campaigns*: ${campaigns.length} \n\n` + `*Affected campaigns*: \n${campaignsInfo}`;
  }

  async accountsWithoutCampaigns() {
    const accountsIds = process.env.ACCOUNTS_TO_VERIFY_CAMPAIGNS ? process.env.ACCOUNTS_TO_VERIFY_CAMPAIGNS.split(',').map(Number) : [1];
    const campaignLimit = Number(process.env.CAMPAIGN_LIMIT_TO_VERIFY_ACCOUNT || 4);

    const dateStart = dayjs().add(1, 'day').toDate();
    const dateEnd = dayjs().add(3, 'day').toDate();
    const period = dayjs(dateStart).format('DD-MM-YYYY') + ' to ' + dayjs(dateEnd).format('DD-MM-YYYY');

    const results = await this.accountRepository.query(
      `
      WITH days AS (
        SELECT generate_series($1::date, $2::date, '1 day') AS campaign_date
      )
      SELECT 
        a.id,
        a.name,
        d.campaign_date,
        COUNT(c.id) AS campaign_count
      FROM accounts a
      JOIN days d ON TRUE
      LEFT JOIN accounts_configs ac ON ac.account_id = a.id AND ac.name = 'time_zone'
      LEFT JOIN campaigns c ON c.account_id = a.id 
        AND c.message_type = $3
        AND DATE(c.schedule_to AT TIME ZONE ac.value) = d.campaign_date
      WHERE a.id = ANY($4)
      GROUP BY a.id, a.name, d.campaign_date
      HAVING COUNT(c.id) < $5
      ORDER BY a.id, d.campaign_date
  `,
      [dateStart, dateEnd, CampaignsMessageType.EMAIL, accountsIds, campaignLimit],
    );

    if (results.length > 0) {
      const slackMessage = this.formatAccountsSlackMessage(results, period);
      await this.slackProvider.sendSlackWebhook(slackMessage, process.env.SLACK_WEBHOOK_URL_RETENTION);
    }
  }

  private formatAccountsSlackMessage(accounts, period: string): string {
    const grouped = accounts.reduce((acc, item) => {
      if (!acc[item.id]) acc[item.id] = [];
      acc[item.id].push(item);
      return acc;
    }, {});

    const accountsInfo = Object.values(grouped)
      .map((accounts: any) => {
        let accountInfo = `*ID*: ${accounts[0].id}  *Name*: ${accounts[0].name}`;
        for (const account of accounts) {
          accountInfo += `\n *Date*: ${dayjs.utc(account.campaign_date).format('DD-MM-YYYY')}   *Total*: ${account.campaign_count}`;
        }

        return accountInfo;
      })
      .join('\n\n');

    return (
      `:warning: *Accounts with few campaigns detected!* \n\n` +
      `*Period*: ${period} \n` +
      `*Total accounts*: ${Object.keys(grouped).length} \n\n` +
      `*Affected accounts*: \n${accountsInfo}`
    );
  }

  // async testCampaignEmails(campaignDto: CampaignDto): Promise<CampaignDto> {
  //   const glockTests = await this.glockProvider.createTests(campaignDto.emailTemplates);
  //   const emails = this.glockProvider.createSendgridEmailsFromCreateResults(glockTests);
  //   sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
  //   sendgrid.send(emails);

  //   campaignDto.emailTemplates = glockTests.map((test) => {
  //     return { ...test.emailTemplate };
  //   });
  //   return await this.update(campaignDto);
  // }

  // async campaignEmailsTestResults(id: string): Promise<any[]> {
  //   const campaign = await this.findOne(id);
  //   const testIds = campaign.emailTemplates.map((template) => {
  //     if (!template.isTested)
  //       throw new InternalServerErrorException("A test was not previously created for this campaign. Create one first through '/news/campaigns/glock-test-create'");
  //     return template.testId;
  //   });
  //   return await this.glockProvider.getBatchTestResults(testIds);
  // }
}
