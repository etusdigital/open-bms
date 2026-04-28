import { MailDataRequired } from '@sendgrid/mail';
import { FormatterUtils } from './utils/formatter.utils';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { RedisService } from './providers/redis/redis.service';
import { ResultDto } from './dtos/result.dto';
import { StorageService } from './storage/storage.service';
import { SparkPostHandler } from './handlers/sparkpost/sparkPost.handler';
import { Email, SendEmailMessage } from './interfaces';
import { TrackerService } from './tracker/tracker.service';
import { MsgopsEvent } from './tracker/tracker.interface';
import { MailUtils } from './mail/mail.utils';
import { MailService } from './mail/mail.service';
import { SplitFeature } from './features/split/split.feature';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { EXCHANGES } from '@bms/messaging';
import { EventPublisherService } from './event-publisher.service';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AppService {
  constructor(
    private readonly sparkPostHandler: SparkPostHandler,
    private readonly storageService: StorageService,
    private readonly mailService: MailService,
    private readonly formatterUtils: FormatterUtils,
    private readonly redisService: RedisService,
    private readonly trackerService: TrackerService,
    private readonly splitFeature: SplitFeature,
    private readonly mailUtils: MailUtils,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async getState(): Promise<ResultDto> {
    return { status: true, message: 'Ok!' };
  }

  async receiveMessage(sendEmailMessage: SendEmailMessage, redisKeyPayload: string): Promise<ResultDto> {
    const copyMessage = { ...sendEmailMessage };
    delete copyMessage.next;
    this.trackerService.logInfo('Log - sendEmailMessage', JSON.stringify(copyMessage));

    if (sendEmailMessage.message.name && sendEmailMessage.message.name == 'confirmacao-de-email-sorteio-membros-12') {
      const messageErrorProcess = `Stop sending to membros automation: ${sendEmailMessage.contact.email}`;
      console.log(messageErrorProcess);
      return { status: false, message: messageErrorProcess };
    }

    if (!this.formatterUtils.isValidEmail(sendEmailMessage.contact.email)) {
      const messageErrorProcess = `[${sendEmailMessage.messageId}] Invalid email format - ${sendEmailMessage.contact.email}`;
      console.error(messageErrorProcess);
      return { status: false, message: messageErrorProcess };
    }

    if (
      !sendEmailMessage.contact.email ||
      sendEmailMessage.contact.hasEmail === false ||
      sendEmailMessage.contact.isValid === false ||
      sendEmailMessage.contact.hasBounced === true ||
      sendEmailMessage.contact.isUnsubscribed === true ||
      sendEmailMessage.contact.isBlocked === true
    ) {
      const messageErrorProcess = `[${sendEmailMessage.messageId}] Contact is not valid - ${sendEmailMessage.contact.email}`;
      console.error(messageErrorProcess);

      if ([136, 137, 138, 25, 81, 104, 119, 120, 141, 244, 263, 261, 233, 107, 169, 69].includes(sendEmailMessage.account.id)) {
        console.log(`Remove user : ${sendEmailMessage.contact.email} - ACCOUNT ${sendEmailMessage.account.id}`);
        return { status: false, message: messageErrorProcess };
      }

      if (sendEmailMessage.next && sendEmailMessage.next.pubName) {
        return this.sendToNextStep(sendEmailMessage.next.data, redisKeyPayload);
      }

      return { status: false, message: messageErrorProcess };
    }

    if (!sendEmailMessage.message) {
      const messageErrorProcess = `[${sendEmailMessage.messageId}][Does not have email object] Error to process this message: ${JSON.stringify(sendEmailMessage)}`;
      console.error(messageErrorProcess);
      return { status: false, message: messageErrorProcess };
    }

    if (
      sendEmailMessage.automationType !== 'transactional' &&
      sendEmailMessage.account.id === 1 &&
      sendEmailMessage.message.ippool !== 'm02_brmailsrv_com' &&
      sendEmailMessage.message.ippool !== 'microsoft_news_plusdin_com_br' &&
      this.mailUtils.isMicrosoft(sendEmailMessage.contact.email)
    ) {
      const messageErrorProcess = `Stop sending to microsoft: ${sendEmailMessage.contact.email}`;
      console.error(messageErrorProcess);
      return { status: false, message: messageErrorProcess };
    }

    // Start redis client
    const redisClient = this.redisService.getOrThrow();
    const emailTitle = sendEmailMessage?.message?.name || sendEmailMessage?.message?.title;
    const emailName = this.formatterUtils.slugify(emailTitle);
    const AccountId = sendEmailMessage.account?.id || sendEmailMessage.contact.accountId;
    const leadRedisKey = `${AccountId}:${sendEmailMessage.contact.email}:${emailName}`;
    const sendLimitPerUser = this.mailUtils.getAccountConfig(sendEmailMessage.account.accountConfigs, 'send_limit_per_user');
    const timeZone = this.mailUtils.getAccountConfig(sendEmailMessage.account.accountConfigs, 'time_zone') || 'America/Sao_Paulo';
    const currentDate = dayjs().tz(timeZone).format('YYYY-MM-DD');

    // Remove disengaged contacts
    const recipientEmail = sendEmailMessage.contact.email;
    const checkKeys = await redisClient.mget([
      `${AccountId}:disengaged:${recipientEmail}`,
      `${AccountId}:unsubscribed:${recipientEmail}`,
      `${AccountId}:blocked:${recipientEmail}`,
    ]);
    if (checkKeys.find((key) => key !== null)) {
      const messageErrorProcess = `Disengaged, Unsubscribed or Blocked:  - ${sendEmailMessage.contact.email}`;
      console.error(messageErrorProcess);

      if ([136, 137, 138, 25, 81, 104, 119, 120, 141, 244, 263, 261, 233, 107, 169, 69].includes(sendEmailMessage.account.id)) {
        console.log(`Remove user : ${sendEmailMessage.contact.email} - ACCOUNT ${sendEmailMessage.account.id}`);
        return { status: false, message: messageErrorProcess };
      }

      if (sendEmailMessage.next && sendEmailMessage.next.pubName) {
        return this.sendToNextStep(sendEmailMessage.next.data, redisKeyPayload);
      }
      return { status: false, message: messageErrorProcess };
    }

    // Check to see if the key already exists in redis, if so end the proccess
    // Bypass for transactional emails
    if (sendEmailMessage.automationType !== 'transactional') {
      const redisKey = await redisClient.get(leadRedisKey);
      if (redisKey) {
        const messageErrorProcess = `Duplicated message:  - ${sendEmailMessage.contact.email} - ${emailName}`;
        this.trackerService.logError(messageErrorProcess);

        if ([136, 137, 138, 25, 81, 104, 119, 120, 141, 244, 263, 261, 233, 107, 169, 69].includes(sendEmailMessage.account.id)) {
          console.log(`Remove user : ${sendEmailMessage.contact.email} - ACCOUNT ${sendEmailMessage.account.id}`);
          return { status: false, message: messageErrorProcess };
        }

        if (sendEmailMessage.next && sendEmailMessage.next.pubName) {
          return this.sendToNextStep(sendEmailMessage.next.data, redisKeyPayload);
        }
        return { status: false, message: messageErrorProcess };
      }
    }

    // Remove , if so end the proccess
    if (sendEmailMessage.automationType === 'email') {
      const redisKeyBadUser = `badusers:${sendEmailMessage.contact.email}:${AccountId}`;
      const redisKey = await redisClient.get(redisKeyBadUser);
      if (redisKey) {
        const messageErrorProcess = `Remove bad users:  - ${sendEmailMessage.contact.email} - ${emailName}`;
        this.trackerService.logError(messageErrorProcess);
        return { status: false, message: messageErrorProcess };
      }

      if (sendLimitPerUser && sendEmailMessage.isRateLimit) {
        const contactCount = await redisClient.get(`contact_send:${sendEmailMessage.contact.id}:${currentDate}`);
        if (contactCount && parseInt(contactCount) >= parseInt(sendLimitPerUser)) {
          const messageErrorProcess = `Contact limit reached:  - ${sendEmailMessage.contact.email}`;
          this.trackerService.logError(messageErrorProcess);
          if (sendEmailMessage.next && sendEmailMessage.next.pubName) {
            await this.sendToNextStep(sendEmailMessage.next.data, redisKeyPayload);
          }
          return { status: false, message: messageErrorProcess };
        }
      }
    }

    // Feature Test SPLIT POOL
    const config = this.splitFeature.getConfig();
    const shouldChange = this.splitFeature.shouldChange(sendEmailMessage.automationName, sendEmailMessage.message.name, config);
    if (shouldChange) {
      sendEmailMessage.message.from.email = config.sender;
      sendEmailMessage.message.ippool = config.pool;
    }
    // END Feature Test

    if (sendEmailMessage.sendAt) {
      if (isNaN(Number(sendEmailMessage.sendAt))) {
        const messageErrorProcess = `Invalid sendAt time: ${sendEmailMessage.sendAt}. Must be a unix timestamp`;
        this.trackerService.logError(messageErrorProcess);
        return { status: false, message: messageErrorProcess };
      }

      const now = Math.floor(Date.now() / 1000);
      const maxScheduleTime = now + 72 * 60 * 60; // 72 hours from now

      if (Number(sendEmailMessage.sendAt) > maxScheduleTime) {
        const messageErrorProcess = `Invalid sendAt time: ${sendEmailMessage.sendAt}. Must be a unix timestamp within 72 hours`;
        this.trackerService.logError(messageErrorProcess);
        return { status: false, message: messageErrorProcess };
      }
    }

    const provider = sendEmailMessage.message.ippool.indexOf('sparkpost') != -1 ? 'sparkpost' : 'sendgrid';
    const mail = await this.createEmail(sendEmailMessage, provider);

    this.trackerService.sendInfo(
      MsgopsEvent.MSGOPS_SEND_EMAIL,
      {
        automation_name: sendEmailMessage.automationName,
        automation_type: sendEmailMessage.automationType,
        email: sendEmailMessage.contact.email,
        utm_campaign: sendEmailMessage.utmCampaign,
        message_id: sendEmailMessage.messageId,
      },
      sendEmailMessage.startedAt,
    );

    let sparkPostResponse: any = [];
    let sendGridResponse: any = [];

    if (provider === 'sparkpost') {
      sparkPostResponse = await this.sparkPostHandler.sendEmail(mail, sendEmailMessage.account);
    } else {
      if (sendEmailMessage.account && sendEmailMessage.account.id == 165) {
        const { location, content, id } = sendEmailMessage.message;
        const htmlContent: string = content || (await this.getContent(id, location));
        const mails = this.mailService.parseAutomationBatchToMailDataRequired(
          {
            contacts: [sendEmailMessage.contact],
            ...sendEmailMessage,
          },
          htmlContent,
        );
        console.log(`BATCH AUTOMATION SEND: ${sendEmailMessage.contact.email} - ${sendEmailMessage.account.id} - ${sendEmailMessage.account.name}`);
        sendGridResponse = await this.mailService.sendMail(mails, sendEmailMessage.account);
      } else {
        sendGridResponse = await this.mailService.sendMail(mail as MailDataRequired, sendEmailMessage.account);
      }
    }

    this.trackerService.sendInfo(
      provider === 'sendgrid' ? MsgopsEvent.MSGOPS_SENDGRID_RESPONSE : MsgopsEvent.MSGOPS_SPARKPOST_RESPONSE,
      {
        automation_name: sendEmailMessage.automationName,
        automation_type: sendEmailMessage.automationType,
        email: sendEmailMessage.contact.email,
        utm_campaign: sendEmailMessage.utmCampaign,
        message_id: sendEmailMessage.messageId,
        sengrid_response: sendGridResponse.length ? sendGridResponse[0].statusCode?.toString() || '-' : '-',
        sparkpost_response: sparkPostResponse.results ? sparkPostResponse.results.id.toString() : '-',
      },
      sendEmailMessage.startedAt,
    );

    // if the key doesn't exist in redis
    try {
      const redisExpiration = 60 * 60 * 2;
      await redisClient.set(leadRedisKey, 'true', 'EX', redisExpiration);
      if (sendLimitPerUser && sendEmailMessage.automationType !== 'transactional') {
        const keySend = `contact_send:${sendEmailMessage.contact.id}:${currentDate}`;
        if (!(await redisClient.exists(keySend))) {
          const now = dayjs().tz(timeZone);
          const nextDay = now.add(1, 'day').startOf('day');
          const secondsToNextDay = nextDay.diff(now, 'second');
          await redisClient.set(keySend, 0, 'EX', secondsToNextDay);
        }
        await redisClient.incr(keySend);
      }
    } catch {
      this.trackerService.logError(`[${sendEmailMessage.messageId}] Unable to save in Redis.`);
      return;
    }

    /**
     * FEAT: Rate limit by pool
     * Register emails sent by pool on Redis
     * Keys auto expires in 2h and 24h
     */
    const ipPool = sendEmailMessage.message.ippool;
    const currentHour = dayjs().tz('America/Sao_Paulo').hour();

    const hourlySentKey = `pool_${ipPool}:sent-by-hour-${currentHour}`;
    await redisClient.incr(hourlySentKey, (error, currentTotal) => {
      if (error) {
        this.trackerService.logError(`[${sendEmailMessage.messageId}] Unable to increment in Redis. ${error}`);
      }

      if (currentTotal === 1) {
        redisClient.expire(hourlySentKey, 7200);
      }
    });

    const dailySentKey = `pool_${ipPool}:sent-by-day-${currentDate}`;
    await redisClient.incr(dailySentKey, (error, currentTotal) => {
      if (error) {
        this.trackerService.logError(`[${sendEmailMessage.messageId}] Unable to increment in Redis. ${error}`);
      }

      if (currentTotal === 1) {
        redisClient.expire(dailySentKey, 86400);
      }
    });

    if (!sendEmailMessage.next || !sendEmailMessage.next?.pubName) {
      const messageNextError = `[${sendEmailMessage.messageId}] This message does not have the next filled in.`;
      return { status: true, message: messageNextError };
    }

    return this.sendToNextStep(sendEmailMessage.next.data, redisKeyPayload);
  }

  async sendToNextStep(message: any, _redisKeyPayload: string): Promise<ResultDto> {
    try {
      // const compressPayload = {
      //   automationKey: `automation-${message?.id || 0}-${message?.contact?.id || 0}-${Date.now()}`
      // } as CompressedAutomationPayload;
      // const redisClient = this.redisService.getOrThrow();
      // await redisClient.set(compressPayload.automationKey, JSON.stringify(message), 'EX', 43200);
      // if (redisKeyPayload) {
      //   await redisClient.del(redisKeyPayload);
      // }
      await this.eventPublisher.publish(EXCHANGES.triggers, 'trigger.process', message);

      return {
        status: true,
        message: `Message published to bms.triggers/trigger.process.`,
      };
    } catch (error) {
      throw new Error(`Error to send message to message-trigger error: ${error}`);
    }
  }

  private async createEmail(sendEmailMessage: SendEmailMessage, provider: string) {
    const { location, content, id } = sendEmailMessage.message;
    sendEmailMessage.ramdonNumber = Math.random();

    const contentFile: string = content || (await this.getContent(id, location));

    const newSendEmailMessage = this.replaceVariables(sendEmailMessage);
    const processedEmail = await this.processEmail(contentFile, newSendEmailMessage, provider);

    if (provider === 'sparkpost') {
      return this.sparkPostHandler.createMail(newSendEmailMessage, processedEmail);
    }

    return this.mailService.createMail(newSendEmailMessage, processedEmail);
  }

  private async getContent(messageId, location) {
    const redisClient = this.redisService.getOrThrow();
    const redisKey = `step_message:${messageId}`;
    const automationMessageCache: Email = await redisClient.get(redisKey).then((automationMessage) => JSON.parse(automationMessage));
    if (automationMessageCache && automationMessageCache.content) return automationMessageCache.content;
    if (!location || !location.bucketName || !location.fileName) {
      console.log(`Could not find current email location. ${messageId}`);
      throw new InternalServerErrorException(`Could not find current email location. ${messageId}`);
    }
    return await this.storageService.getHtml(location.bucketName, location.fileName);
  }

  private async processEmail(emailContent: string, sendEmailMessage: SendEmailMessage, provider: string): Promise<string> {
    const content = await this.mailUtils.parseContent(emailContent, sendEmailMessage.contact, sendEmailMessage.account, sendEmailMessage.message, provider);

    const formatedEmailContent = this.mailUtils.createEmailPixel({
      emailContent: content,
      provider,
      utmCampaign: sendEmailMessage.utmCampaign,
      messageId: sendEmailMessage.message.id,
      contact: sendEmailMessage.contact,
      account: sendEmailMessage.account,
      dynamicLink: sendEmailMessage.link,
      isSendgridVariables: false,
      ramdomNumber: sendEmailMessage.ramdonNumber,
    });

    if (sendEmailMessage.message && sendEmailMessage.message.previewText) {
      return this.mailUtils.createPreviewText(formatedEmailContent.template, sendEmailMessage.message.previewText);
    }

    return formatedEmailContent.template;
  }

  private replaceVariables(sendEmailMessage: SendEmailMessage): SendEmailMessage {
    sendEmailMessage.message.subject = this.mailUtils.parseVariables(
      sendEmailMessage.message.subject,
      sendEmailMessage.contact,
      sendEmailMessage.account,
      sendEmailMessage.message,
    );

    if (sendEmailMessage.message.previewText) {
      sendEmailMessage.message.previewText = this.mailUtils.parseVariables(
        sendEmailMessage.message.previewText,
        sendEmailMessage.contact,
        sendEmailMessage.account,
        sendEmailMessage.message,
      );
    }

    if (sendEmailMessage.message.from.firstName) {
      sendEmailMessage.message.from.firstName = this.mailUtils.parseVariables(
        sendEmailMessage.message.from.firstName,
        sendEmailMessage.contact,
        sendEmailMessage.account,
        sendEmailMessage.message,
      );
    }

    return sendEmailMessage;
  }

  async getRedis(redisKey) {
    const redisClient = this.redisService.getOrThrow();
    const originalPayload: SendEmailMessage = await redisClient.get(redisKey).then((payload) => {
      if (payload) {
        return JSON.parse(payload);
      }
    });

    return originalPayload;
  }
}
