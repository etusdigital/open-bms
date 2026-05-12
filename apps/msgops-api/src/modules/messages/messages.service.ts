import { ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { S3StorageProvider } from '../../providers/s3-storage.provider';
import { Repository, Not, QueryRunner } from 'typeorm';
import { PaginationDto } from '../../dtos/pagination.dto';
import { MessageEntity } from '../../entities/message.entity';
import { AutomationEntity } from '../../entities/automation.entity';
import { TestsService } from '../tests/tests.service';
import { EmailsLabelsDto, MessageDto } from './messages.dto';
import { MessagesPageDto } from './dto/messages-page.dto';
import { RedisService } from '../../providers/redis.provider';
import { hasEmojiCharacters, replaceSpecialChars } from '../../utils/utils.service';
import { MessageStatus, WhatsappMessageType } from './messages.interface';
import { AccountsService } from '../accounts/accounts.service';
import { TwilioHandler } from 'src/handlers/twilio/twilio.handler';
import { EvolutionHandler } from 'src/handlers/evolution/evolution.handler';
import dayjs from 'dayjs';
import { SchedulerService } from 'src/providers/queue/scheduler.service';
import { ClsService } from 'nestjs-cls';
import { CampaignsService } from '../campaigns/campaigns.service';
import { env } from 'process';
import { Email } from '../services/services.dto';
import { EmailsLabelsEntity } from '../../entities/emails-labels.entity';
import { OpenAIProvider } from 'src/providers/openai.provider';
import { LabelsService } from '../labels/labels.service';
import { LabelsContentsEntity } from '../../entities/labels-contents.entity';
import { BucketsService } from '../buckets/buckets.service';
import * as crypto from 'crypto';
import { hasUnlayerUrls, extractUnlayerUrlsFromHtml, replaceUrlsInHtml, replaceUrlsInJson } from './utils/unlayer-migration.utils';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private messagesProcess = {};
  constructor(
    private readonly storage: S3StorageProvider,
    @InjectRepository(MessageEntity)
    private readonly automationMessageRepository: Repository<MessageEntity>,
    @InjectRepository(AutomationEntity)
    private readonly automationRepository: Repository<AutomationEntity>,
    @InjectRepository(EmailsLabelsEntity)
    private readonly emailsLabelsRepository: Repository<EmailsLabelsEntity>,
    @InjectRepository(LabelsContentsEntity)
    private readonly testsService: TestsService,
    private readonly redisService: RedisService,
    private readonly twilioHandler: TwilioHandler,
    private readonly evolutionHandler: EvolutionHandler,
    private readonly scheduler: SchedulerService,
    private readonly accountService: AccountsService,
    private readonly campaignsService: CampaignsService,
    private readonly openAIProvider: OpenAIProvider,
    private readonly labelsService: LabelsService,
    private readonly cls: ClsService,
    private readonly httpService: HttpService,
    private readonly bucketsService: BucketsService,
  ) {}

  async listAll(withTest = true): Promise<Array<MessageDto>> {
    try {
      let results: Array<MessageEntity> = [];

      results = await this.automationMessageRepository
        .createQueryBuilder('messages')
        .leftJoinAndSelect('messages.labelContent', 'labelContent', 'labelContent.entity_name = :entityName', { entityName: 'messages' })
        .leftJoinAndSelect('labelContent.label', 'label')
        .where({
          accountId: this.cls.get('accountId'),
        })
        .getMany();

      if (withTest) {
        return await this.messageWithTestStats(results as any);
      }

      return results;
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findOneById(id: number): Promise<MessageEntity> {
    try {
      const message = await this.automationMessageRepository
        .createQueryBuilder('messages')
        .leftJoinAndSelect('messages.campaignMessage', 'campaignMessage')
        .leftJoinAndSelect('campaignMessage.campaign', 'campaign')
        .leftJoinAndSelect('messages.labelContent', 'labelContent', 'labelContent.entity_name = :entityName', { entityName: 'messages' })
        .leftJoinAndSelect('labelContent.label', 'label')
        .where('messages.id = :id AND messages.account_id = :accountId', { id, accountId: this.cls.get('accountId') })
        .getOne();

      const campaignEntity = message.campaignMessage.map((item: any) => item.campaign);

      if (message.campaignMessage.length && campaignEntity.every((entity) => entity !== null)) {
        const campaign = message.campaignMessage[0].campaign;
        if (campaign && campaign.status > 1) {
          message['campaignInUse'] = { id: campaign.id, title: campaign.title };
        }
      }
      delete message.campaignMessage;

      return message;
    } catch (e) {
      console.error(e);
      throw new HttpException(e.response || 'Internal Server Error', e.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getMessageClickStatistics(messageId: number, filterId: number, filterType: 'campaign' | 'automation') {
    const message = await this.findOneById(messageId);
    if (!message) {
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    }

    const clickStats = await this.automationMessageRepository.query(
      `
      select key, sum(value) total
      from (
        select key::text, value::integer
        from events_statistics,
        lateral jsonb_each(click_position) t(key, value)
        where message_id = $1 and account_id = $2 and ${filterType === 'campaign' ? 'campaign_id' : 'automation_id'} = $3
      ) st
      group BY key
      order BY key
    `,
      [message.id, message.accountId, filterId],
    );

    message['clickStats'] = clickStats;
    return message;
  }

  async updateOneById(id: number, messageDto: MessageDto, _currentUser?: string, _ipAddress?: string, _userAgent?: string): Promise<MessageDto> {
    if (messageDto.fromName && hasEmojiCharacters(messageDto.fromName)) {
      throw new ForbiddenException('Emoji in Sender Name field');
    }

    // Migrate Unlayer images to our storage
    messageDto = await this.migrateUnlayerImages(messageDto);

    const message = await this.findOneById(id);

    if (Object.prototype.hasOwnProperty.call(message, 'campaignInUse')) {
      throw new HttpException('Mensagem usada em campanha com status enviada/enviando!', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    // const messageBackup = JSON.parse(JSON.stringify(message));

    if (['2FA-whatsapp', 'whatsapp'].includes(message.type) && message.status !== MessageStatus.DRAFT) {
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    if (['2FA-whatsapp', 'whatsapp'].includes(message.type) && messageDto.status == MessageStatus.SENDAPPROVAL) {
      const messageName = replaceSpecialChars(messageDto.title);
      if (env.WHATSAPP_PROVIDER === 'twilio') {
        messageDto.providerMessageId = await this.approveTwillio(messageDto, messageName);
        await this.createWhatsappTask(messageDto.providerMessageId, message.accountId);
      } else {
        messageDto.providerMessageId = await this.approveEvolution(messageDto, messageName);
      }
      messageDto.status = MessageStatus.SENTAPPROVAL;
    }

    let updateAutomationChanges: any = {};
    if (message.title !== messageDto.title || message.subject !== messageDto.subject) {
      const messageName = replaceSpecialChars(messageDto.title);

      updateAutomationChanges = {
        id: message.id,
        oldName: message.name,
        oldTitle: message.title,
        oldSubject: message.subject,
        newName: messageName,
        newTitle: messageDto.title,
        newSubject: messageDto.subject,
        type: message.type,
      };
    }

    this.automationMessageRepository.merge(message, messageDto);
    delete message.automationMessageAccount;

    if (message.type === 'email') {
      try {
        const { fileURLPath, bucketName, fullFilePath } = await this.storage.writeContentIntoBucketFile(message.id, message.content);

        if (!fileURLPath || !bucketName || !fullFilePath) {
          throw new Error("Didn't save the message on storage");
        }

        if (fileURLPath) message.templateUrl = fileURLPath;
        if (bucketName) message.bucketName = bucketName;
        if (fullFilePath) message.fileName = fullFilePath;
      } catch (err) {
        if (err instanceof HttpException) throw err;
        this.logger.error('Falha ao salvar template no S3', err as Error);
        throw new HttpException('Erro ao salvar template da mensagem.', HttpStatus.UNPROCESSABLE_ENTITY);
      }
    }

    delete message.labelContent;
    await this.automationMessageRepository.update(id, message);
    // await this.saveAudits(id, 'edit', message, messageBackup, currentUser, ipAddress, userAgent, this.cls.get('accountId') || message.accountId);
    if (Object.prototype.hasOwnProperty.call(updateAutomationChanges, 'id')) {
      await this.updateAutomationStep(updateAutomationChanges);
    }

    if (messageDto.labels !== undefined) {
      await this.labelsService.saveEntityLabelsSafe('messages', message.id, messageDto.labels || []);
    }

    const redisClient = await this.redisService.getClient();
    await redisClient.del([`step_message:${message.id}`]);
    return message;
  }

  async updatePart(
    id: number,
    messageDto: {
      content?: string;
      subject?: string;
      previewText?: string;
      fromMail?: string;
    },
  ): Promise<MessageDto> {
    try {
      const message = await this.findOneById(id);

      if (message) {
        const _messageDto = Object.fromEntries(Object.entries(messageDto).filter(([_, value]) => value != null));
        Object.assign(message, _messageDto);

        const redisClient = await this.redisService.getClient();
        await redisClient.del([`step_message:${message.id}`]);
        await this.automationMessageRepository.update(id, message);

        return message;
      }
      throw new HttpException('Message not found', HttpStatus.NOT_FOUND);
    } catch (err) {
      console.error(err);
      throw new HttpException(err.response || 'Internal Server Error', err.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async approveTwillio(messageDto: MessageDto, name: string) {
    const account = await this.accountService.findOne(messageDto.accountId || messageDto.account.id);
    const twilioSid = account.configByName('twilio_sid_account');
    const twilioAuth = account.configByName('twilio_auth_account');
    const baseUrl = account.configByName('shortlink_base_url');
    name = name.replace(/-/g, '_');

    const message = {
      friendly_name: name,
      language: 'pt_BR',
      types: {
        [`twilio/${messageDto.whatsappType}`]: {
          body: messageDto.content,
        },
      },
    };

    if (messageDto.whatsappType === WhatsappMessageType.CALLTOACTION) {
      message.types[`twilio/${messageDto.whatsappType}`]['actions'] = [
        {
          type: 'URL',
          title: messageDto.callToActionText,
          url: `${baseUrl.value}{{shortCode}}`,
        },
      ];
    }

    const responseCreate = await this.twilioHandler.createMessage(message, twilioSid.value, twilioAuth.value);
    const messageId = responseCreate.sid;
    await this.twilioHandler.sendToApprovalMessage(messageId, name, twilioSid.value, twilioAuth.value);

    return messageId;
  }

  async approveEvolution(messageDto: MessageDto, name: string) {
    const account = await this.accountService.findOne(messageDto.accountId || messageDto.account.id);
    const language = account.configByName('default_language')?.value || 'pt_BR';
    const instanceName = account.configByName('whatsapp_number_id')?.value;
    const token = account.configByName('whatsapp_access_token')?.value;
    const webhookUrl = process.env.TEMPLATE_WEBHOOK_URL;
    const baseUrl = account.configByName('shortlink_base_url');
    name = name.replace(/-/g, '_');

    if (!instanceName || !token) {
      throw new HttpException('Instance name or token not found', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const message = {
      name: name,
      category: messageDto.type === '2FA-whatsapp' ? 'AUTHENTICATION' : 'MARKETING',
      allowCategoryChange: false,
      language: language,
      webhookUrl: webhookUrl,
      components: [],
    };

    const content = JSON.parse(messageDto.content);

    if (content.headerType === 'text') {
      message.components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: content.headerContent,
      });
    }

    if (content.headerType === 'image') {
      message.components.push({
        type: 'HEADER',
        format: 'IMAGE',
        url: content.headerContent,
      });
    }

    if (content.headerType === 'video') {
      message.components.push({
        type: 'HEADER',
        format: 'VIDEO',
        url: content.headerContent,
      });
    }

    message.components.push({
      type: 'BODY',
      text: content.body,
    });

    if (content.footer) {
      message.components.push({
        type: 'FOOTER',
        text: content.footer,
      });
    }

    if (messageDto.whatsappType === WhatsappMessageType.CALLTOACTION) {
      message.components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: messageDto.callToActionText,
            url: `${baseUrl.value}{{1}}`,
            example: {
              url: baseUrl.value,
            },
          },
        ],
      });
    }

    if (messageDto.type === '2FA-whatsapp') {
      message.components = [
        {
          type: 'BODY',
          add_security_recommendation: true,
        },
        {
          type: 'FOOTER',
          code_expiration_minutes: 10,
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'OTP',
              otp_type: 'COPY_CODE',
            },
          ],
        },
      ];
    }
    const responseCreate = await this.evolutionHandler.createMessage(message, instanceName, token);

    return responseCreate.name;
  }

  async updateStatusMessage(data: any) {
    const status = data.event.toLowerCase();
    const messageId = data.message_template_name;

    if ([MessageStatus.APPROVED, MessageStatus.REJECTED].includes(status)) {
      return await this.automationMessageRepository
        .createQueryBuilder('messages')
        .update()
        .set({ status })
        .where('provider_message_id = :providerMessageId', { providerMessageId: messageId })
        .execute();
    }

    return null;
  }

  async createWhatsappTask(messageId, accountId) {
    const date = dayjs().tz('America/Sao_Paulo').add(30, 'second').format('YYYY-MM-DD HH:mm:ss');
    await this.scheduler.create(
      `${messageId}/${accountId}`,
      new Date(date),
      `${process.env.BRIUS_HOSTURL}/messages/monitor-whatsapp-message`,
      process.env.GOOGLE_TASK_WHATSAPP_MESSAGE,
    );
  }

  async monitorWhatsappMessage(messageId: string, accountId: number) {
    const account = await this.accountService.findOne(accountId);
    const twilioSid = account.configByName('twilio_sid_account');
    const twilioAuth = account.configByName('twilio_auth_account');
    const response = await this.twilioHandler.getMessageStatus(messageId, twilioSid.value, twilioAuth.value);
    if (!response.whatsapp || ['received', 'pending'].includes(response.whatsapp.status)) {
      await this.createWhatsappTask(messageId, accountId);
      return;
    }
    return await this.automationMessageRepository
      .createQueryBuilder('messages')
      .update()
      .set({ status: response.whatsapp.status })
      .where('provider_message_id = :providerMessageId', { providerMessageId: messageId })
      .execute();
  }

  async deleteOneById(id: number, _currentUser?: string, _ipAddress?: string, _userAgent?: string) {
    const automationMessage = await this.automationMessageRepository.findOneOrFail({
      where: { id, accountId: this.cls.get('accountId') },
    });

    const campaigns = await this.campaignsService.messageInUse(id);
    if (campaigns.length) {
      throw new HttpException(`Can't delete message: ${automationMessage.name}. It is being used on campaigns(s): ${campaigns.join(',')}.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const automations = await this.automationRepository
      .createQueryBuilder('automations')
      .where(`REPLACE(steps::text, ' ','') LIKE '%settings":{"id":${automationMessage.id},"name":"${automationMessage.name}"%' AND account_id = :accountId`, {
        accountId: this.cls.get('accountId'),
      })
      .select('automations')
      .getMany();

    const automationName = automations.map((automation: any) => automation.name);

    if (automations.length !== 0) {
      throw new HttpException(`Can't delete message: ${automationMessage.name}. It is being used on automation(s): ${automationName}.`, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    try {
      // await this.saveAudits(id, 'delete', null, null, currentUser, ipAddress, userAgent, this.cls.get('accountId') || automationMessage.accountId);
      automationMessage.title = `${automationMessage.title}-deleted-${automationMessage.id}`;
      automationMessage.deletedAt = new Date();
      return await this.automationMessageRepository.save(automationMessage);
    } catch (e) {
      console.error(e);
      throw new HttpException(e.response || 'Internal Server Error', e.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createMessage(messageDto: MessageDto, currentUser?: string, ipAddress?: string, userAgent?: string, queryRunner?: QueryRunner): Promise<MessageDto> {
    if (this.cls.get('accountId')) {
      messageDto.account = { id: this.cls.get('accountId') };
    }

    if (messageDto.fromName && hasEmojiCharacters(messageDto.fromName)) {
      throw new ForbiddenException('Emoji in Sender Name field');
    }

    // Migrate Unlayer images to our storage
    messageDto = await this.migrateUnlayerImages(messageDto);

    if (['2FA-whatsapp', 'whatsapp'].includes(messageDto.type) && messageDto.status == MessageStatus.SENDAPPROVAL) {
      const messageName = replaceSpecialChars(messageDto.title);
      if (env.WHATSAPP_PROVIDER === 'twilio') {
        messageDto.providerMessageId = await this.approveTwillio(messageDto, messageName);
        await this.createWhatsappTask(messageDto.providerMessageId, messageDto.account.id);
      } else {
        messageDto.providerMessageId = await this.approveEvolution(messageDto, messageName);
      }
      messageDto.status = MessageStatus.SENTAPPROVAL;
    }

    let savedMessage: MessageEntity;
    const connect = !!queryRunner;
    queryRunner = queryRunner || this.automationMessageRepository.manager.connection.createQueryRunner();

    if (!connect) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
      messageDto.text = messageDto.text || '';
      messageDto.fromMail = messageDto.fromMail || '';
      messageDto.fromName = messageDto.fromName || '';

      const message = this.automationMessageRepository.create(messageDto);

      savedMessage = await queryRunner.manager.save(message);

      if (savedMessage && savedMessage.type === 'email') {
        const { fileURLPath, bucketName, fullFilePath } = await this.storage.writeContentIntoBucketFile(savedMessage.id, savedMessage.content);

        if (!fileURLPath || !bucketName || !fullFilePath) {
          throw new Error("Didn't save the message on storage");
        }

        await queryRunner.manager
          .createQueryBuilder()
          .update(MessageEntity)
          .set({
            templateUrl: fileURLPath,
            bucketName: bucketName,
            fileName: fullFilePath,
          })
          .where('id = :id AND account_id = :account_id', {
            id: savedMessage.id,
            account_id: this.cls.get('accountId'),
          })
          .execute();
        // await this.saveAudits(newMessage.id, 'create', newMessage, null, currentUser, ipAddress, userAgent, this.cls.get('accountId'));
      }
      if (!connect) {
        await queryRunner.commitTransaction();
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof HttpException) throw err;
      this.logger.error('Falha ao salvar mensagem', err as Error);
      throw new HttpException('Erro ao salvar mensagem.', HttpStatus.UNPROCESSABLE_ENTITY);
    } finally {
      if (!connect) {
        await queryRunner.release();
      }
    }

    if (messageDto.labels && messageDto.labels.length > 0) {
      await this.labelsService.saveEntityLabelsSafe('messages', savedMessage.id, messageDto.labels);
    }

    return savedMessage;
  }

  async validUniqueTitle(title: string, id: number, type: string) {
    const query = this.automationMessageRepository.createQueryBuilder('messages');
    query.where({
      id: Not(id),
      title: title,
      type: type,
    });

    if (this.cls.get('accountId')) {
      query.andWhere('account_id = :accountId', { accountId: this.cls.get('accountId') });
    }

    return query.getRawOne();
  }

  async listPaginated(params: MessagesPageDto): Promise<PaginationDto<MessageDto>> {
    try {
      const sortBy = params.sortBy ? params.sortBy : 'createdAt';
      const order = params.order ? params.order : 'DESC';

      const mensagesList = this.automationMessageRepository
        .createQueryBuilder('messages')
        .leftJoinAndSelect('messages.automationMessageAccount', 'automationMessageAccount')
        .where(
          `(messages.title ilike :title OR messages.subject ilike :title OR messages.fromName ilike :title OR messages.fromMail ilike :title OR messages.content ilike :title) 
          ${this.cls.get('accountId') ? ' AND messages.account_id = :accountId' : ''}`,
          { title: `%${params.title ?? ''}%`, accountId: this.cls.get('accountId') },
        );

      let typeArray = [];
      let typeString = '';

      if (Array.isArray(params.type)) {
        typeArray = params.type;
      }

      if (typeof params.type === 'string') {
        typeString = params.type;
      }

      if (typeString === 'email' && params.ipPool) {
        mensagesList.andWhere('messages.ippool = :ippool', { ippool: params.ipPool });
      }

      if (params.selectedAutomation) {
        const idsMessage = await this.getAutomationsMenssage(params.selectedAutomation);
        if (idsMessage.length) {
          mensagesList.andWhere('messages.id IN (:...idsMessage)', {
            idsMessage: idsMessage,
          });
        }
      }

      if (params.status) {
        mensagesList.andWhere('messages.status = :status', { status: params.status });
      }

      if (params.messagesIds) {
        mensagesList.andWhere('messages.id IN (:...ids)', { ids: params.messagesIds });
      }

      if (typeString) {
        mensagesList.andWhere('messages.type like :type', { type: typeString });
      }

      if (typeArray && typeArray.length) {
        mensagesList.andWhere('messages.type IN (:...type)', { type: typeArray });
      }

      if (params.labels && params.labels.length > 0) {
        const messageIdsWithLabels = await this.labelsService.filterEntitiesByLabels('messages', params.labels);
        if (messageIdsWithLabels.length === 0) {
          return new PaginationDto<MessageDto>({
            results: [],
            total: 0,
            page: params.page,
            itemsPerPage: params.itemsPerPage,
          });
        }
        mensagesList.andWhere('messages.id IN (:...messageIds)', { messageIds: messageIdsWithLabels });
      }

      const [results, total] = await mensagesList
        .skip((params.page - 1) * params.itemsPerPage)
        .take(params.itemsPerPage)
        .orderBy(`messages.${sortBy}`, `${order}`)
        .getManyAndCount();

      // const messageAutomations = await this.getAutomations(results);
      // messages = messageAutomations;

      // if (params.withTests) {
      //   messages = await this.messageWithTestStats(messageAutomations);
      // }

      return new PaginationDto<MessageDto>({
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

  async findOneByname(name: string): Promise<MessageEntity> {
    try {
      return this.automationMessageRepository
        .createQueryBuilder('messages')
        .where('messages.name = :name AND messages.account_id = :accountId', { name, accountId: this.cls.get('accountId') })
        .getOne();
    } catch (e) {
      console.error(e);
      throw new HttpException(e.response || 'Internal Server Error', e.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getAutomationsMenssage(idAutomation?) {
    const Messages = await this.automationMessageRepository.query(`
      select id, title, steps from automations
      where deleted_at IS NULL AND ${idAutomation ? `automations.id = ${idAutomation}` : `steps::text LIKE '%"type": "email"%'`}
      ${this.cls.get('accountId') ? `AND automations.account_id = ${this.cls.get('accountId')}` : ''}`);

    const dataMessages = [];
    if (idAutomation) {
      Messages.map(async (line) => {
        if (line.steps && line.steps.length > 0) {
          const messages = this.getAutomationEmailSteps(line.steps[0]);
          dataMessages.push(messages);
        }
      });

      return Array.from(new Set(dataMessages.flatMap((item) => item.map((message) => message.id))));
    } else {
      Messages.map((line) => {
        dataMessages.push({ id: line.id, title: line.title });
      });

      return Array.from(new Set(dataMessages.map((a) => a.id))).map((id) => {
        return dataMessages.find((a) => a.id === id);
      });
    }
  }

  async messageWithTestStats(messages: MessageEntity[]) {
    return await Promise.all(
      messages.map(async (message) => {
        if (message.isTested && message.automationMessageAccount) {
          const senders = message.automationMessageAccount.map((account) => {
            return {
              providerAccountId: account.providerAccountId,
              testId: account.testId,
              version: 0,
              provider: account.provider,
            };
          });
          let testStats = null;
          const glockApps = senders.filter((sender) => sender.provider == 'glockApps');
          if (glockApps.length) {
            testStats = await this.testsService.getGmailTestStats(glockApps);
          }

          return {
            ...message,
            testStats,
          };
        } else {
          return message;
        }
      }),
    );
  }

  async editTestStatus(id: number, isTested: boolean) {
    try {
      await this.automationMessageRepository.update(id, { isTested: isTested });
    } catch (e) {
      console.error(e);
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async createCopy(messageId: number) {
    const message = await this.findOneById(messageId);

    const lastCopy = message.version + 1 || 1;
    await this.updateVersion(message.id, lastCopy);

    return await this.createMessage({
      subject: message.subject,
      previewText: message.previewText,
      fromMail: message.fromMail,
      fromName: message.fromName,
      replyTo: message.replyTo,
      content: message.content,
      content_json: message.content_json,
      ippool: message.ippool,
      priority: message.priority,
      text: message.text,
      isTested: false,
      messageId: message.id,
      title: message.title + ` (Cópia ${lastCopy})`,
      type: message.type,
      description: message.description,
      url: message.url,
      image: message.image,
      expiryPushInSeconds: message.expiryPushInSeconds,
      expiryPushFilter: message.expiryPushFilter,
      notificationSound: message.notificationSound,
      status: message.status,
      whatsappType: message.whatsappType,
      callToActionText: message.callToActionText,
      providerMessageId: message.providerMessageId,
    });
  }

  async getAutomations(messages: MessageEntity[]) {
    // TODO: Refactor to use steps json
    return await Promise.all(
      messages.map(async (message) => {
        const automations = await this.automationRepository
          .createQueryBuilder('automations')
          .where(`steps::text LIKE '%settings": {"id": ${message.id}, "name": "${message.name}"%'`)
          .select('automations')
          .getMany();

        return {
          ...message,
          automations,
        };
      }),
    );
  }

  // async saveAudits(entityId, type, newValues, oldValues, user, ipAddress, userAgent, accountId) {
  //   if (!accountId) {
  //     return;
  //   }

  //   this.auditService.createAudit({
  //     entity: 'messages',
  //     entityId,
  //     type,
  //     newValues,
  //     oldValues,
  //     user,
  //     ipAddress,
  //     userAgent,
  //     account: { id: accountId },
  //   });
  // }

  async updateVersion(id: number, version: number) {
    return await this.automationMessageRepository.update(id, { version });
  }

  async listAllMessageName() {
    return await this.automationMessageRepository
      .createQueryBuilder('messages')
      .leftJoinAndSelect('messages.account', 'account')
      .select(['messages.id id', 'messages.title title', 'messages.account_id ', 'account.name account_name', 'account.id account_id', 'messages.type type'])
      .execute();
  }

  async listAllKeyName(date) {
    const returnData = {
      automations: [],
      campaigns: [],
    };
    const entityManager = this.automationMessageRepository.manager;
    const campaignsQuery = `SELECT cp.id, cp.name, cp.type campaign_type, cp.message_type campaign_message_type, me.name message_name, ac.name account_name, ac.id account_id,
      CONCAT(cp.name,'_e1_',me.id) utm_campaign, me.type message_type, me.url, me.from_name sender_name, me.from_mail sender_email,
      me.ippool ippool, me.subject, me.preview_text, me.content html  FROM campaigns cp
      INNER JOIN accounts ac on ac.id = cp.account_id
      INNER JOIN campaigns_messages cpm on cpm.campaign_id = cp.id
      INNER JOIN messages me on me.id = cpm.message_id
      WHERE cp.schedule_to BETWEEN '${date} 00:00:00' AND '${date} 23:59:59'`;

    returnData.campaigns = await entityManager.query(campaignsQuery);

    const automationsQuery = `SELECT at.id, at.name, at.steps, at.account_id, ac.name account_name  FROM automations at
      INNER JOIN accounts ac on ac.id = at.account_id WHERE steps IS NOT NULL AND active = true 
      AND at.updated_at >= '${date}'`;
    const automationData = await entityManager.query(automationsQuery);
    await Promise.all(
      automationData.map(async (automation) => {
        const automationFormatted = await this.parseUtmAutomations(automation.id, automation.name, automation.account_id, automation.account_name, automation.steps[0], 1);
        returnData.automations = returnData.automations.concat(automationFormatted);
      }),
    );

    return returnData;
  }

  async parseUtmAutomations(id, name, account_id, account_name, steps, emailNumber) {
    let formattedUtm = [];
    if (!steps) {
      return formattedUtm;
    }
    if (steps.type && steps.type === 'email') {
      if (!Object.prototype.hasOwnProperty.call(this.messagesProcess, steps.settings.id)) {
        this.messagesProcess[steps.settings.id] = await this.automationMessageRepository.findOne({
          where: { id: steps.settings.id },
        });
      }
      formattedUtm.push({
        id,
        name,
        account_id,
        account_name,
        utm_campaign: `${name}_e${emailNumber}_${steps.settings.id || 0}`,
        message_name: this.messagesProcess[steps.settings.id]?.name || '',
        sender_name: this.messagesProcess[steps.settings.id]?.fromName || '',
        sender_email: this.messagesProcess[steps.settings.id]?.fromMail || '',
        ippool: this.messagesProcess[steps.settings.id]?.ippool || '',
        subject: this.messagesProcess[steps.settings.id]?.subject || '',
        previewText: this.messagesProcess[steps.settings.id]?.previewText || '',
        html: this.messagesProcess[steps.settings.id]?.content || '',
        type: this.messagesProcess[steps.settings.id]?.type || '',
        url: this.messagesProcess[steps.settings.id]?.url || '',
      });
      emailNumber++;
    }
    await Promise.all(
      steps.child?.map(async (step) => {
        const recursiveFormatted = await this.parseUtmAutomations(id, name, account_id, account_name, step, emailNumber);
        if (recursiveFormatted.length) {
          formattedUtm = formattedUtm.concat(recursiveFormatted);
        }
      }),
    );
    return formattedUtm;
  }

  getAutomationEmailSteps(steps) {
    let messages = [];
    if (!steps) {
      return messages;
    }

    if (steps.type && steps.type === 'email') {
      messages.push({
        ...steps.settings,
      });
    }

    steps.child?.map((step) => {
      const recursiveFormatted = this.getAutomationEmailSteps(step);
      if (recursiveFormatted.length) {
        messages = messages.concat(recursiveFormatted);
      }
    });

    return messages;
  }

  async listAllMessages() {
    const query = `
      SELECT cp.id, me.name message_name, ac.name account_name, 'campaign' type FROM campaigns cp
        INNER JOIN accounts ac on ac.id = cp.account_id
        INNER JOIN campaigns_messages cpm on cpm.campaign_id = cp.id
        INNER JOIN messages me on me.id = cpm.message_id
      UNION
      SELECT me.id, me.name, ac.name, 'automation' as type FROM messages me
        INNER JOIN accounts ac on ac.id = me.account_id
    `;
    const entityManager = this.automationMessageRepository.manager;
    return await entityManager.query(query);
  }

  async updateAutomationStep(params: { id: number; oldName: string; oldTitle: string; oldSubject: string; newName: string; newTitle: string; newSubject: string; type: string }) {
    if (params.type !== 'sms' && params.type !== 'whatsapp' && params.type !== '2FA-whatsapp') {
      params.newSubject = params.newSubject.includes(`'`) ? params.newSubject.replace(/'/g, `''`) : params.newSubject;
      params.oldSubject = params.oldSubject.includes(`'`) ? params.oldSubject.replace(/'/g, `''`) : params.oldSubject;
    }

    params.oldTitle = params.oldTitle.includes(`'`) ? params.oldTitle.replace(/'/g, `''`) : params.oldTitle;
    params.newTitle = params.newTitle.includes(`'`) ? params.newTitle.replace(/'/g, `''`) : params.newTitle;

    const query = `
    UPDATE automations set
    steps = replace(steps::text, '"id": ${params.id}, "name": "${params.oldName}", "title": "${params.oldTitle}", "subject": "${params.oldSubject}"',
      '"id": ${params.id}, "name": "${params.newName}", "title": "${params.newTitle}", "subject": "${params.newSubject}"')::jsonb
    WHERE steps::text LIKE '%"id": ${params.id}, "name": "${params.oldName}", "title": "${params.oldTitle}", "subject": "${params.oldSubject}"%'
    `;

    const entityManager = this.automationMessageRepository.manager;
    return await entityManager.query(query);
  }

  async validateNames(params: MessagesPageDto) {
    params.titleCreate = params.titleCreate.trim();
    const name = replaceSpecialChars(params.titleCreate);
    return this.automationMessageRepository
      .createQueryBuilder('messages')
      .where({
        accountId: this.cls.get('accountId'),
        name: name,
        type: params.type,
        ...(params.id && { id: Not(params.id) }),
      })
      .getMany();
  }

  async getPools(accountId: number) {
    const pools = await this.automationMessageRepository.createQueryBuilder('messages').where({ accountId }).select('ippool').distinct(true).getRawMany();

    return pools.map((pool) => {
      return pool.ippool;
    });
  }

  async getMessageById(messageId: number): Promise<any> {
    const redisClient = await this.redisService.getClient();
    const redisKey = `step_message:${messageId}`;
    const messageCache: Email = await redisClient.get(redisKey).then((message) => JSON.parse(message));
    if (messageCache) return messageCache;

    const message = await this.automationMessageRepository.findOne({
      where: {
        id: messageId,
      },
    });
    await redisClient.set(redisKey, JSON.stringify(message));

    return message;
  }

  async getEmailsLabels(params: EmailsLabelsDto): Promise<PaginationDto<EmailsLabelsDto>> {
    const { language } = params;
    const sortBy = params.sortBy || 'processed_at';
    const order = params.order || 'DESC';

    const query = this.emailsLabelsRepository
      .createQueryBuilder('emailsLabels')
      .skip((params.page - 1) * params.itemsPerPage)
      .take(params.itemsPerPage)
      .where({ language })
      .andWhere('html IS NOT NULL')
      .andWhere('is_internal = :isInternal', { isInternal: false })
      .orderBy(sortBy, order);

    const [emailsLabels, total] = await query.getManyAndCount();

    return new PaginationDto<EmailsLabelsDto>({
      results: emailsLabels,
      total,
      page: params.page,
      itemsPerPage: params.itemsPerPage,
    });
  }

  async getLanguages() {
    return await this.emailsLabelsRepository.createQueryBuilder('emailsLabels').select('DISTINCT language').getRawMany();
  }

  async getCountries(params: { language: string }) {
    return await this.emailsLabelsRepository.createQueryBuilder('emailsLabels').where({ language: params.language }).select('DISTINCT country').getRawMany();
  }

  private async migrateUnlayerImages(messageDto: MessageDto): Promise<MessageDto> {
    try {
      // Feature flag check
      if (process.env.UNLAYER_MIGRATION_ENABLED !== 'true') {
        return messageDto;
      }

      // Early exit (performance optimization)
      if (!(messageDto.content && hasUnlayerUrls(messageDto.content))) {
        return messageDto;
      }

      // Extract all Unlayer URLs
      const urls = extractUnlayerUrlsFromHtml(messageDto.content);
      if (urls.length === 0) return messageDto;

      // Download and upload in parallel
      const urlMap = await this.downloadAndUploadImages(urls);

      // Replace URLs in all fields
      return this.replaceUnlayerUrlsInDto(messageDto, urlMap);
    } catch (error) {
      console.error('[Unlayer Migration] Failed:', error);
      throw new HttpException(`Failed to migrate Unlayer images: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  private async downloadAndUploadImages(urls: string[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();

    // Download and upload all images in parallel (typical case: 1-10 images)
    const results = await Promise.all(
      urls.map(async (url) => {
        const migratedUrl = await this.downloadAndUploadImage(url);
        return { original: url, migrated: migratedUrl };
      }),
    );

    results.forEach(({ original, migrated }) => {
      urlMap.set(original, migrated);
    });

    return urlMap;
  }

  private async downloadAndUploadImage(unlayerUrl: string): Promise<string> {
    try {
      // 1. Download from Unlayer
      const response = await this.httpService
        .get(unlayerUrl, {
          responseType: 'arraybuffer',
          timeout: 10000, // 10s timeout
          maxContentLength: 10 * 1024 * 1024, // 10MB max
        })
        .toPromise();

      const buffer = Buffer.from(response.data, 'binary');
      const contentType = response.headers['content-type'] || 'image/jpeg';

      // 2. Generate filename
      const urlHash = crypto.createHash('md5').update(unlayerUrl).digest('hex');
      const ext = this.getImageExtension(contentType);
      const filename = `unlayer-${urlHash}${ext}`;

      // 3. Convert to base64 (BucketsService format)
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;

      // 4. Upload to storage
      const fileUpload = {
        name: filename,
        data: base64,
        messageId: null,
        isAutomatedMessage: true,
        pathExternal: 'templates/messages/unlayer-migrated',
      };

      const [result] = await this.bucketsService.uploadFiles([fileUpload]);

      if (!result?.link) {
        throw new Error('Storage upload failed - no URL returned');
      }

      return result.link;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Download timeout', { cause: error });
      } else if (error.response?.status === 404) {
        throw new Error('Image not found (404)', { cause: error });
      } else {
        throw error;
      }
    }
  }

  private getImageExtension(contentType: string): string {
    const map = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    return map[contentType.toLowerCase()] || '.jpg';
  }

  private replaceUnlayerUrlsInDto(messageDto: MessageDto, urlMap: Map<string, string>): MessageDto {
    return {
      ...messageDto,
      content: messageDto.content ? replaceUrlsInHtml(messageDto.content, urlMap) : messageDto.content,
      text: messageDto.text ? replaceUrlsInHtml(messageDto.text, urlMap) : messageDto.text,
      content_json: messageDto.content_json ? replaceUrlsInJson(messageDto.content_json, urlMap) : messageDto.content_json,
    };
  }
}
