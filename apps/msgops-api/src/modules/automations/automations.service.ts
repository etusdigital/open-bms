import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../../providers/redis.provider';
import { Repository, Not } from 'typeorm';
import { AutomationEntity } from './../../entities/automation.entity';
import { AutomationDto } from './automation.dto';
import { AutomationsFiltersDto } from './automations-filters.dto';
import { PaginationDto } from '../../dtos/pagination.dto';
import { AuditService } from './../../utils/audits/audit.service';
import { UtilsService } from '../../utils/utils.service';
import { replaceSpecialChars } from 'src/utils/utils.service';
import { StatisticsDto, StatisticsTargetDto } from './dto/statistics.dto';
import { AccountConfigsProvider } from '../../providers/account-configs.provider';
import { PostgresErrorCode } from 'src/shared.interfaces';
import { ClsService } from 'nestjs-cls';
import { GoogleTasksProvider } from 'src/providers/google-tasks.provider';
import dayjs from 'dayjs';
import { ActiveCampaignProvider } from 'src/providers/active-campaign.provider';
import schema from './schema/automation-schema.json';
import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import { AutomationTargetEntity } from 'src/entities/automation-target.entity';
import { LabelsService } from '../labels/labels.service';
import { LabelsContentsEntity } from '../../entities/labels-contents.entity';

@Injectable()
export class AutomationsService {
  public ajv: Ajv;
  constructor(
    @InjectRepository(AutomationEntity)
    private readonly automationRepository: Repository<AutomationEntity>,
    @InjectRepository(AutomationTargetEntity)
    private readonly automationTargetRepository: Repository<AutomationTargetEntity>,
    @InjectRepository(LabelsContentsEntity)
    private readonly labelsContentsRepository: Repository<LabelsContentsEntity>,
    private readonly accountConfigsProvider: AccountConfigsProvider,

    private readonly auditService: AuditService,
    private readonly utilsService: UtilsService,
    private readonly redisService: RedisService,
    private readonly httpService: HttpService,
    private readonly cls: ClsService,
    private readonly googleTasksProvider: GoogleTasksProvider,
    private readonly activeCampaignProvider: ActiveCampaignProvider,
    private readonly labelsService: LabelsService,
  ) {
    this.ajv = new Ajv({ allErrors: true });
    ajvErrors(this.ajv);
  }

  async listAll(filters?: AutomationsFiltersDto): Promise<Array<AutomationDto>> {
    try {
      const redisClient = await this.redisService.getClient();
      const key = `automations:${filters.type}:${filters.name}`;
      const automationsCache: AutomationDto[] = await redisClient.get(key).then((automation) => JSON.parse(automation));
      if (automationsCache && automationsCache.length) return automationsCache;

      const order = this.orderClause(filters);

      const queryBuilder = this.automationRepository
        .createQueryBuilder('automation')
        .leftJoinAndSelect('automation.account', 'accounts')
        .leftJoinAndSelect('accounts.customFields', 'customFields')
        .leftJoinAndSelect('accounts.accountConfigs', 'accountConfigs')
        .leftJoinAndSelect('automation.labelContent', 'labelContent', 'labelContent.entity_name = :entityName', { entityName: 'automations' })
        .leftJoinAndSelect('labelContent.label', 'label')
        .where(
          `(automation.account_id = :accountId AND automation.isActive = :isActive
          ${filters.title ? ' AND automation.title = :title' : ''}
          ${filters.type ? ' AND automation.type = :type' : ''}
          ${filters.name ? ' AND automation.name = :name' : ''}
        )`,
          {
            accountId: this.cls.get('accountId'),
            title: `%${filters.title ?? ''}%`,
            isActive: filters.isActive ?? 1,
            type: filters.type,
            name: filters.name,
          },
        );

      if (filters.labels && filters.labels.length > 0) {
        const automationIdsWithLabels = await this.labelsService.filterEntitiesByLabels('automations', filters.labels);
        if (automationIdsWithLabels.length === 0) {
          return [];
        }
        queryBuilder.andWhere('automation.id IN (:...automationIds)', { automationIds: automationIdsWithLabels });
      }

      const automations = await queryBuilder.orderBy(order).getMany();

      if (filters.name) {
        await redisClient.set(key, JSON.stringify(automations));
      }

      return automations;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async listPaginated(filters?: AutomationsFiltersDto): Promise<PaginationDto<AutomationDto>> {
    try {
      const order = this.orderClause(filters);

      const hasIsActive = filters.isActive != null && filters.isActive !== '';
      const queryBuilder = this.automationRepository
        .createQueryBuilder('automation')
        .leftJoinAndSelect('automation.labelContent', 'labelContent', 'labelContent.entity_name = :entityName', { entityName: 'automations' })
        .leftJoinAndSelect('labelContent.label', 'label')
        .where(
          `(automation.title like :title
            ${hasIsActive ? ' AND automation.isActive = :isActive' : ''}
            ${filters.type ? ' AND automation.type = :type' : ''}
            ${this.cls.get('accountId') ? ' AND automation.account_id = :accountId' : ''}
          )`,
          {
            title: `%${filters.title ?? ''}%`,
            ...(hasIsActive && { isActive: filters.isActive }),
            type: filters.type,
            accountId: this.cls.get('accountId'),
          },
        );

      if (filters.labels && filters.labels.length > 0) {
        const automationIdsWithLabels = await this.labelsService.filterEntitiesByLabels('automations', filters.labels);
        if (automationIdsWithLabels.length === 0) {
          return new PaginationDto<AutomationDto>({
            results: [],
            total: 0,
            page: filters.page,
            itemsPerPage: filters.itemsPerPage,
          });
        }
        queryBuilder.andWhere('automation.id IN (:...automationIds)', { automationIds: automationIdsWithLabels });
      }

      const [results, total] = await queryBuilder
        .skip((filters.page - 1) * filters.itemsPerPage)
        .take(filters.itemsPerPage)
        .orderBy(order)
        .getManyAndCount();

      return new PaginationDto<AutomationDto>({
        results: results,
        total,
        page: filters.page,
        itemsPerPage: filters.itemsPerPage,
      });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getByTag(name: string): Promise<AutomationEntity[]> {
    return await this.automationRepository
      .createQueryBuilder('automation')
      .where(`account_id = :accountId AND triggers::text LIKE :triggers`, {
        triggers: `%"settings": {"id": %, "name": "${name}"}%`,
        accountId: this.cls.get('accountId'),
      })
      .getMany();
  }

  async findOneById(id: number) {
    try {
      const automation: any = await this.automationRepository.findOneOrFail({
        where: { id, accountId: this.cls.get('accountId') },
      });
      automation.steps = this.mergeStepsAndTriggers(automation);
      automation.labelContent = await this.labelsService.findLabelsContentByType(automation.id, 'automations');

      return automation;
    } catch (e) {
      console.error(e);
      throw new HttpException(e.response || 'Internal Server Error', e.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  orderClause(filters?: AutomationsFiltersDto) {
    const orderClause = {};

    if (filters.orderBy && filters.sortOrder) {
      orderClause[`automation.` + filters.orderBy] = filters.sortOrder;
    }

    if (filters.order && filters.sortBy) {
      orderClause[`automation.` + filters.sortBy] = filters.order;
    }

    return orderClause;
  }

  async createComplete(
    automationDto: AutomationDto,
    currentUser?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AutomationDto | { stepError: number; messageError: string }> {
    try {
      automationDto.account = { id: this.cls.get('accountId') };
      automationDto.countSteps = this.countSteps(automationDto.steps);
      if (automationDto.type === 'email') {
        const validate = this.ajv.compile(schema);
        const isValid = validate(automationDto.steps);
        if (!isValid) {
          const stepError = this.findStepJsonValidateError(automationDto.steps, validate.errors[0].instancePath);
          return { stepError: stepError?.id || 0, messageError: validate.errors[0].message };
        }
        automationDto = this.splitStepsAndTriggers(automationDto);
      }
      const automation = this.automationRepository.create(automationDto);
      const newAutomation = await this.automationRepository.save(automation);
      newAutomation.steps = newAutomation.type === 'email' ? this.mergeStepsAndTriggers(newAutomation) : newAutomation.steps;
      const redisClient = await this.redisService.getClient();
      await redisClient.del([
        `automations_tag:${automation.accountId}:${automationDto?.triggers?.settings?.id || 0}`,
        `automations-messages-formatted`,
        `automations_push:${newAutomation.accountId}`,
        `events_trigger:${this.cls.get('accountId')}:custom_events:${automation.triggers.settings.id}`,
        `events_trigger:${this.cls.get('accountId')}:custom_events:${automation.triggers.settings.id}:automations`,
        `events_trigger:${this.cls.get('accountId')}:${automation.triggers.settings.eventType}:${automation.triggers.settings.id}`,
        `events_trigger:${this.cls.get('accountId')}:${automation.triggers.settings.eventType}:${automation.triggers.settings.id}:automations`,
      ]);

      if (automation.triggers.settings.type === 'events' && automation.triggers.settings.eventType) {
        await redisClient.set(`events_trigger:${this.cls.get('accountId')}:${automation.triggers.settings.eventType}:${automation.triggers.settings.id}`, 'true');
      }

      if (automation.triggers.settings.type === 'custom_events' && automation.triggers.settings.id) {
        await redisClient.set(`events_trigger:${this.cls.get('accountId')}:custom_events:${automation.triggers.settings.id}`, 'true');
      }

      if (automation.target) {
        await redisClient.set(`automation_target:${this.cls.get('accountId')}:${newAutomation.id}:${newAutomation.target}`, 'true');
      }

      this.auditService.createAudit({
        accountId: this.cls.get('accountId'),
        entity: 'automations',
        entityId: automation.id,
        type: 'create',
        newValues: await JSON.parse(JSON.stringify(newAutomation)),
        user: currentUser,
        ipAddress,
        userAgent,
      });

      if (automationDto.labels && automationDto.labels.length > 0) {
        await this.labelsService.saveEntityLabelsSafe('automations', newAutomation.id, automationDto.labels);
      }

      return newAutomation;
    } catch (error) {
      console.error(error);
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Tag with that name already exists');
      }

      throw new HttpException(error?.message || `Internal Server Error: ${error}`, error?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updateComplete(
    automationDto: AutomationDto,
    currentUser?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AutomationDto | { stepError: number; messageError: string }> {
    try {
      automationDto.countSteps = this.countSteps(automationDto.steps);
      automationDto = this.addVersionProp(automationDto);
      const automation = await this.findOneById(automationDto.id);
      if (automation.type === 'email') {
        const validate = this.ajv.compile(schema);
        const isValid = validate(automationDto.steps);
        if (!isValid) {
          const stepError = this.findStepJsonValidateError(automationDto.steps, validate.errors[0].instancePath);
          return { stepError: stepError?.id || 0, messageError: validate.errors[0].message };
        }
        automationDto = this.splitStepsAndTriggers(automationDto);
      }
      const oldTagId = automation?.triggers?.settings?.id || 0;
      const oldTarget = automation.target || '';
      const newTagId = automationDto?.triggers?.settings?.id || 0;
      const oldEventType = automation?.triggers?.settings?.eventType || '';
      let newAutomation = this.automationRepository.create(automationDto);
      newAutomation = this.automationRepository.merge(automation, newAutomation);
      const automationReturn = await this.automationRepository.save(newAutomation);
      automationReturn.steps = automationReturn.type === 'email' ? this.mergeStepsAndTriggers(automationReturn) : automationReturn.steps;

      const redisClient = this.redisService.getClient();
      await redisClient.del([
        `automations_tag:${automation.accountId}:${oldTagId}`,
        `automations_tag:${automation.accountId}:${newTagId}`,
        `automations-messages-formatted`,
        `automations_push:${automation.accountId}`,
        `events_trigger:${this.cls.get('accountId')}:custom_events:${oldTagId}`,
        `events_trigger:${this.cls.get('accountId')}:custom_events:${newTagId}`,
        `events_trigger:${this.cls.get('accountId')}:custom_events:${newTagId}:automations`,
        `events_trigger:${this.cls.get('accountId')}:${oldEventType}:${oldTagId}`,
        `events_trigger:${this.cls.get('accountId')}:${oldEventType}:${newTagId}`,
        `events_trigger:${this.cls.get('accountId')}:${oldEventType}:${newTagId}:automations`,
      ]);

      if (automation.triggers.settings.type === 'events' && automation.triggers.settings.eventType) {
        await redisClient.set(`events_trigger:${this.cls.get('accountId')}:${automation.triggers.settings.eventType}:${newTagId}`, 'true');
      }

      if (automation.triggers.settings.type === 'custom_events' && automation.triggers.settings.id) {
        await redisClient.set(`events_trigger:${this.cls.get('accountId')}:custom_events:${newTagId}`, 'true');
      }

      if (automation.target && automationDto.target != oldTarget) {
        await redisClient.del(`automation_target:${this.cls.get('accountId')}:${automation.id}:${oldTarget}`);
        await redisClient.set(`automation_target:${this.cls.get('accountId')}:${newAutomation.id}:${newAutomation.target}`, 'true');
      }

      this.auditService.createAudit({
        accountId: automation?.account?.id || automation.accountId,
        entity: 'automations',
        entityId: automation.id,
        type: 'edit',
        newValues: await JSON.parse(JSON.stringify(automationReturn)),
        user: currentUser,
        ipAddress,
        userAgent,
      });
      await this.setAutomationDtoOnRedis(automationReturn);

      if (automationDto.labels !== undefined) {
        await this.labelsService.saveEntityLabelsSafe('automations', automationReturn.id, automationDto.labels || []);
      }

      return automationReturn;
    } catch (error) {
      console.error(error);
      if (error?.code === PostgresErrorCode.UniqueViolation) {
        throw new ForbiddenException('Tag with that name already exists');
      }

      throw new HttpException(error?.message || `Internal Server Error: ${error}`, error?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  splitStepsAndTriggers(automationDto: AutomationDto) {
    automationDto.triggers = automationDto.steps;
    automationDto.steps = JSON.parse(JSON.stringify(automationDto.steps.child));
    delete automationDto.triggers.child;
    return automationDto;
  }

  mergeStepsAndTriggers(automation: AutomationEntity) {
    return {
      ...automation.triggers,
      child: automation.steps,
    };
  }

  countSteps(steps: any) {
    let countSteps = steps.type || steps.length ? 1 : 0;
    steps.child?.forEach((step) => {
      countSteps += this.countSteps(step);
    });
    return countSteps;
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

  async deleteOneById(id: number, _currentUser: string, _ipAddress: string, _userAgent: string) {
    const automation = await this.automationRepository.findOneOrFail({
      where: { id, accountId: this.cls.get('accountId') },
    });

    try {
      // this.auditService.createAudit({
      //   entity: 'automations',
      //   entityId: id,
      //   type: 'delete',
      //   user: currentUser,
      //   ipAddress,
      //   userAgent,
      //   account: { id: accountId },
      // });

      const redisClient = await this.redisService.getClient();
      await redisClient.del([
        `automations_tag:${automation.accountId}:${automation.triggers.settings?.id || 0}`,
        `automations-messages-formatted`,
        `automations_push:${automation.accountId}`,
        `automations:${automation.type}:${automation.name}`,
        `events_trigger:${this.cls.get('accountId')}:custom_events:${automation.triggers.settings.id}`,
        `events_trigger:${this.cls.get('accountId')}:custom_events:${automation.triggers.settings.id}:automations`,
        `events_trigger:${this.cls.get('accountId')}:${automation.triggers.settings.eventType}:${automation.triggers.settings.id}`,
        `events_trigger:${this.cls.get('accountId')}:${automation.triggers.settings.eventType}:${automation.triggers.settings.id}:automations`,
      ]);

      automation.name = `${automation.name}-deleted`;
      automation.deletedAt = new Date();
      return await this.automationRepository.save(automation);
    } catch (e) {
      console.error(e);
      throw new HttpException(e.response || 'Internal Server Error', e.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async updatePart(id: number, automationDto: AutomationDto) {
    const automation = await this.automationRepository.findOneOrFail({
      where: { id, accountId: this.cls.get('accountId') },
    });
    const tagId = automation.triggers?.settings?.id || 0;
    try {
      delete automationDto.message;
      automationDto.version = this.getVersionProp();
      const redisClient = await this.redisService.getClient();
      await redisClient.del([`automations-messages-formatted`, `automations_push:${automation.accountId}`, `automations_tag:${automation.accountId}:${tagId}`]);
      return await this.automationRepository.update(id, automationDto);
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createCopy(automationId: number) {
    try {
      const automationDto: AutomationDto = await this.automationRepository.findOneOrFail({
        where: {
          id: automationId,
          accountId: this.cls.get('accountId'),
        },
      });
      delete automationDto.id;
      delete automationDto.createdAt;
      delete automationDto.updatedAt;
      automationDto.title = `${automationDto.title} (Cópia ${Date.now()})`;
      automationDto.version = automationDto.version + 1;

      const automation = this.automationRepository.create(automationDto);
      return await this.automationRepository.save(automation);
    } catch (e) {
      console.error(e);
      throw new HttpException(`Internal Server Error: ${e}`, e.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private getVersionProp() {
    return Date.now().toString();
  }

  private addVersionProp(automationDto: AutomationDto): AutomationDto {
    return { ...automationDto, version: this.getVersionProp() };
  }

  private getRedisAutomationDtoKey(automationDto: AutomationDto) {
    return `automation:${automationDto.id}`;
  }

  private async setAutomationDtoOnRedis(automationDto: AutomationDto) {
    const redisClient = await this.redisService.getClient();
    await redisClient.set(this.getRedisAutomationDtoKey(automationDto), JSON.stringify(automationDto));
  }

  async validUniqueTitle(title: string, id: number) {
    const query = this.automationRepository.createQueryBuilder('automation');
    query.where({
      id: Not(id),
      title: title,
      accountId: this.cls.get('accountId'),
    });
    if (this.cls.get('accountId')) {
      query.andWhere('account_id = :accountId', { accountId: this.cls.get('accountId') });
    }

    return query.getRawOne();
  }

  async getStatisticsMessage(statisticsDto: StatisticsDto) {
    try {
      const category = this.utilsService.normalizeString(statisticsDto.category);

      const { value: sendgriApiKey } = await this.accountConfigsProvider.getAccountConfigs('sendgrid_key');
      const result = await this.httpService
        .get(`https://api.sendgrid.com/v3/categories/stats?start_date=${statisticsDto.startDate}&end_date=${statisticsDto.endDate}&categories=${category}`, {
          headers: {
            Authorization: `Bearer ${sendgriApiKey}`,
          },
        })
        .toPromise();

      const statistics = result.data;
      return await this.processReturnStatisticsEmail(statistics);
    } catch {
      return await this.processReturnStatisticsEmail([]);
    }
  }

  async processReturnStatisticsEmail(statistics) {
    const statisticsReturn = { opens: 0, clicks: 0, unsubscribes: 0, unique_opens: 0, unique_clicks: 0, total: 0 };

    statistics.map((statistic) => {
      statisticsReturn.opens += statistic?.stats[0]?.metrics?.opens || 0;
      statisticsReturn.clicks += statistic?.stats[0]?.metrics?.clicks || 0;
      statisticsReturn.unsubscribes += statistic?.stats[0]?.metrics?.unsubscribes || 0;
      statisticsReturn.unique_opens += statistic?.stats[0]?.metrics?.unique_opens || 0;
      statisticsReturn.unique_clicks += statistic?.stats[0]?.metrics?.unique_clicks || 0;
      statisticsReturn.total += statistic?.stats[0]?.metrics?.delivered || 0;
    });
    const divider = statisticsReturn.total > 0 ? statisticsReturn.total : 1; //Can't division by zero
    statisticsReturn['percent_opens'] = ((statisticsReturn.opens / divider) * 100).toFixed(1);
    statisticsReturn['percent_clicks'] = ((statisticsReturn.clicks / divider) * 100).toFixed(1);
    statisticsReturn['percent_unsubscribes'] = ((statisticsReturn.unsubscribes / divider) * 100).toFixed(1);
    statisticsReturn['percent_unique_opens'] = ((statisticsReturn.unique_opens / divider) * 100).toFixed(1);
    statisticsReturn['percent_unique_clicks'] = ((statisticsReturn.unique_clicks / divider) * 100).toFixed(1);

    return statisticsReturn;
  }

  removeAtributesMessage(loadMessage) {
    loadMessage.content = '';
    loadMessage.content_json = '';
    loadMessage.text = '';

    return loadMessage;
  }

  async validateTagUsage(tagId: number, name: string) {
    return await this.automationRepository
      .createQueryBuilder()
      .where('triggers::text LIKE :triggers OR steps::text LIKE :steps', {
        triggers: `%"settings": {"id": ${tagId}, "name": "${name}"}%`,
        steps: `%"settings": {"id": ${tagId}, "name": "${name}"}%`,
      })
      .andWhere('deleted_at is null')
      .getCount();
  }

  async validateNames(params: AutomationsFiltersDto) {
    params.titleCreate = params.titleCreate.trim();
    const name = replaceSpecialChars(params.titleCreate);
    return this.automationRepository
      .createQueryBuilder('automations')
      .where({
        accountId: this.cls.get('accountId'),
        name: name,
        ...(params.id && { id: Not(params.id) }),
      })
      .getMany();
  }

  async startedTestabStep(step) {
    const automation = await this.automationRepository.findOne({ where: { id: step.automationId } });
    const startDate = dayjs().tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm:ss');
    const endDate = dayjs().tz('America/Sao_Paulo').add(step.settings.duration, 'hour').format('YYYY-MM-DD HH:mm:ss');
    const updateStep = { status: 'running', startDate, endDate };
    step.settings = { ...step.settings, ...updateStep };
    const task = await this.googleTasksProvider.create(
      ``,
      new Date(endDate),
      `${process.env.BRIUS_HOSTURL}/automations/finish-testab`,
      process.env.GOOGLE_TASK_BMS_USAGE,
      JSON.stringify(step),
    );
    updateStep['taskId'] = task[0].name;
    const newSteps = this.updateStepSettings(step.id, updateStep, automation.steps[0]);
    await this.automationRepository
      .createQueryBuilder('automation')
      .update()
      .set({ steps: [newSteps] })
      .where('id = :automationId', { automationId: automation.id })
      .execute();
  }

  async finishTestabStep(step) {
    const automation = await this.automationRepository.findOne({ where: { id: step.automationId } });
    const statisticsMessages = {};
    for (const message of step?.settings?.messages ?? []) {
      const statistics = await this.testabStatisticsMessage(message.id, step.settings.startDate, step.settings.endDate, automation.accountId);
      statisticsMessages[message.id] = { ...(statistics[0] || {}), messageId: message.id };
    }
    const winnerMessage: any = Object.values(statisticsMessages).reduce((prev, current) =>
      parseInt(prev[step.settings.winnerCriteria]) / parseInt(prev['delivered']) > parseInt(current[step.settings.winnerCriteria]) / parseInt(current['delivered'])
        ? prev
        : current,
    );

    const newSteps = this.updateStepSettings(step.id, { status: 'finished' }, automation.steps[0], statisticsMessages, winnerMessage);

    const redisClient = await this.redisService.getClient();
    await redisClient.set(`automation_testab_step_finished_${automation.id}_${step.id}`, winnerMessage.messageId);

    await this.automationRepository
      .createQueryBuilder('automation')
      .update()
      .set({ steps: [newSteps] })
      .where('id = :automationId', { automationId: automation.id })
      .execute();
  }

  async stopTestAb(step) {
    try {
      return await this.googleTasksProvider.callRunTask(step.settings.taskId, process.env.GOOGLE_TASK_BMS_USAGE);
    } catch {
      return await this.finishTestabStep(step);
    }
  }

  async testabStatisticsMessage(messageId: number, startDate, endDate, accountId) {
    const query = `SELECT SUM(es.delivered) delivered, SUM(es.open) open, 
        SUM(es.click) click, SUM(es.unsubscribe) unsubscribe, SUM(es.bounce) bounce
        FROM events_statistics es
        WHERE es.account_id = $1
        AND es.date BETWEEN DATE($2) AND DATE($3)
        AND es.message_id = $4
        AND es.event_type = 'email'
        GROUP BY es.message_id`;
    return await this.automationRepository.query(query, [accountId, startDate, endDate, messageId]);
  }

  updateStepSettings(id, stepUpdate, step, statisticsMessages: any = false, winnerMessage: any = false) {
    if (step.id === id) {
      step.settings = {
        ...step.settings,
        ...stepUpdate,
      };
      if (statisticsMessages) {
        step.settings.messages.forEach((message) => {
          message.winnerMessage = message.id === winnerMessage.messageId;
          message.statistics = statisticsMessages[message.id];
        });
      }
    } else {
      step?.child.forEach((item) => {
        return this.updateStepSettings(id, stepUpdate, item, statisticsMessages, winnerMessage);
      });
    }
    return step;
  }

  async sentTestHttpStep(step) {
    const headers = {};
    for (const header of step.headers) {
      headers[header.key] = header.value.type === 'custom' ? header.value.id : 'headerabcd';
    }

    const payload = {};
    for (const item of step.body) {
      payload[item.key] = item.value.type === 'custom' ? item.value.id : 'bodyabcd';
    }

    try {
      if (['get', 'delete'].includes(step.operation)) {
        const response = await this.httpService[step.operation](step.url, {
          headers,
        }).toPromise();
        return { status: response.status, data: response.data };
      }
      const response = await this.httpService[step.operation](step.url, payload, {
        headers,
      }).toPromise();
      return { status: response.status, data: response.data, input: payload };
    } catch (error) {
      return { status: error.response.status, data: error.response.data, input: payload };
    }
  }

  async getListsActiveCampaign(stepSettings) {
    return await this.activeCampaignProvider.getLists(stepSettings);
  }

  async getAutomationsByTag(tagId: number) {
    return await this.automationRepository.createQueryBuilder('automations').select('id').where(`(automations.triggers->'settings'->>'id')::int = :tagId`, { tagId }).getRawMany();
  }

  async updateEventsCache(eventType: string, oldMessageId: number, newMessageId: number): Promise<void> {
    const redisClient = this.redisService.getClient();

    await redisClient.del([`events_trigger:${this.cls.get('accountId')}:${eventType}:${oldMessageId}`]);

    const automations = await this.automationRepository
      .createQueryBuilder('automations')
      .innerJoinAndSelect('automations.account', 'account')
      .leftJoinAndSelect('account.accountConfigs', 'accountConfigs')
      .leftJoinAndSelect('account.customFields', 'customFields')
      .where('automations.account_id = :accountId', { accountId: this.cls.get('accountId') })
      .andWhere('automations.active = :active', { active: true })
      .andWhere(
        `automations.triggers->'settings'->>'type' = 'events' and automations.triggers->'settings'->>'eventType' = :eventType and (automations.triggers->'settings'->>'id')::int = :messageId`,
        { eventType, messageId: newMessageId },
      )
      .andWhere('accountConfigs.is_load_config = true')
      .getMany();

    await redisClient.set(`events_trigger:${this.cls.get('accountId')}:${eventType}:${newMessageId}`, JSON.stringify(automations));
  }

  async getStatisticsTarget(params: StatisticsTargetDto) {
    const query = `
      with stats as (
        SELECT
          at.date,
          at.count
        FROM automations_targets at
        WHERE automation_id = ${params.automationId}
        AND account_id = ${this.cls.get('accountId')}
        AND date BETWEEN DATE('${params.startDate}') AND DATE('${params.endDate}')
      )
      SELECT TO_CHAR(gs.date, 'YYYY-MM-DD') as date,
      coalesce(stats.count, 0) as count 
      from generate_series(DATE('${params.startDate}'), DATE('${params.endDate}'), interval '1 day') as gs(date)
      LEFT JOIN stats ON stats.date = gs.date
      ORDER BY gs.date DESC
    `;
    return await this.automationTargetRepository.query(query);
  }
}
