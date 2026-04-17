import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { VerifyDto, VerifyValidateDto } from './dto/verify.dto';
import { VerifyMethod, VerifyStatus } from './verify.interface';
import { RedisService } from '../../providers/redis.provider';
import { parsePhoneNumberWithError, CountryCode } from 'libphonenumber-js/max';
import { ClsService } from 'nestjs-cls';
import { parseMessageToSendEmail } from 'src/utils/utils.service';
import { AccountsService } from '../accounts/accounts.service';
import { MessagesService } from '../messages/messages.service';
import { PubSubProvider } from 'src/providers/pubsub.providers';
import { VerifyStatisticsService, VerifyStatisticType } from './verify-statistics.service';

@Injectable()
export class VerifyService {
  constructor(
    private readonly redisService: RedisService,
    private readonly cls: ClsService,
    private readonly accountsService: AccountsService,
    private readonly messagesService: MessagesService,
    private readonly pubSubProvider: PubSubProvider,
    private readonly verifyStatisticsService: VerifyStatisticsService,
  ) {}

  private selectRandomMessage(messages: any[]): any {
    const randomNumber = Math.floor(Math.random() * 101);
    let percentage = 0;

    for (let i = 0; i < messages.length; i++) {
      percentage += messages[i].percentage;
      if (randomNumber <= percentage) {
        return messages[i];
      }
    }

    return null;
  }

  private async getSmsBodyFromSettings(account: any, group: string, defaultMessage: string): Promise<any> {
    const accountConfig = account.configByName('2fa_settings');
    const accountTimezone = account.configByName('time_zone').value || 'UTC';
    if (!accountConfig) {
      return defaultMessage;
    }

    const settings = JSON.parse(accountConfig.value);

    if (!Object.prototype.hasOwnProperty.call(settings, 'sms')) {
      return defaultMessage;
    }

    const messages = settings.sms[group];
    if (!messages) {
      await this.verifyStatisticsService.incrementStatistic(VerifyMethod.SMS, group, VerifyStatisticType.ERROR, accountTimezone);
      throw new HttpException('No messages found for group: ' + group, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const messageToSend = this.selectRandomMessage(messages);
    const message = await this.messagesService.getMessageById(messageToSend.message.id);

    if (!messageToSend) {
      await this.verifyStatisticsService.incrementStatistic(VerifyMethod.SMS, group, VerifyStatisticType.ERROR, accountTimezone);
      throw new HttpException('No message to send', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    return message;
  }

  async generate(requestData: VerifyDto, request: any) {
    const account = await this.accountsService.findOne(this.cls.get('accountId'));
    const accountTimezone = account.configByName('time_zone').value || 'UTC';
    //Increment request counter
    await this.verifyStatisticsService.incrementStatistic(requestData.method as VerifyMethod, requestData.group, VerifyStatisticType.TOTAL, accountTimezone);

    const code = Math.floor(100000 + Math.random() * 900000);
    let messageSent;

    try {
      const accountConfig = account.configByName('2fa_settings');
      switch (requestData.method) {
        case VerifyMethod.SMS: {
          const customerPhone = parsePhoneNumberWithError(requestData.to, { defaultCountry: account.configByName('default_country').value as CountryCode, extract: false });
          if (!customerPhone.isValid()) {
            console.log('Invalid phone number', customerPhone);
            //Increment error request counter
            await this.verifyStatisticsService.incrementStatistic(VerifyMethod.SMS, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
            throw new HttpException('Invalid phone number', HttpStatus.UNPROCESSABLE_ENTITY);
          }

          const defaultMessage = `Seu código de verificação é {{CODE}}. Não compartilhe.`;

          let body = '';
          if (requestData.customText) {
            body = requestData.customText;
          } else {
            const messageToSend = await this.getSmsBodyFromSettings(account, requestData.group, defaultMessage);
            if (typeof messageToSend === 'string') {
              body = messageToSend;
            } else {
              body = messageToSend.content;
            }
          }

          body = body.replace(/{{CODE}}/gi, code.toString());

          const smsMessage = { to: customerPhone.number, body, account };
          await this.pubSubProvider.sendAsyncMessage(process.env.TOPIC_NAME_SEND_SINGLE_SMS, smsMessage);
          messageSent = true;
          break;
        }

        case VerifyMethod.EMAIL: {
          if (!accountConfig) {
            console.log(`VERIFY CONFIG ERROR: ${requestData.to}`, JSON.stringify(request.headers));
            //Increment error request counter
            await this.verifyStatisticsService.incrementStatistic(VerifyMethod.EMAIL, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
            throw new HttpException('2FA service not configured', HttpStatus.UNPROCESSABLE_ENTITY);
          }
          const settings = JSON.parse(accountConfig.value);
          if (!Object.prototype.hasOwnProperty.call(settings, 'email')) {
            //Increment error request counter
            await this.verifyStatisticsService.incrementStatistic(VerifyMethod.EMAIL, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
            throw new HttpException('Email setup not completed', HttpStatus.UNPROCESSABLE_ENTITY);
          }

          // Validate email before sending verification code
          try {
            const emailToValidate = encodeURIComponent(requestData.to);
            const validationUrl = `${process.env.EMAIL_VALIDATION_URL}validations?email=${emailToValidate}`;
            const apiKey = account.configByName('api_key').value;

            const response = await fetch(validationUrl, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                'api-key': apiKey,
              },
            });

            if (!response.ok) {
              //Increment error request counter
              await this.verifyStatisticsService.incrementStatistic(VerifyMethod.EMAIL, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
              throw new HttpException('Email validation service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
            }

            const validationResult = await response.json();

            if (!['deliverable', 'risky'].includes(validationResult.result)) {
              //Increment error request counter
              await this.verifyStatisticsService.incrementStatistic(VerifyMethod.EMAIL, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
              throw new HttpException('Invalid email address', HttpStatus.UNPROCESSABLE_ENTITY);
            }
          } catch (error) {
            if (error instanceof HttpException) {
              //TODO: Need a specific error counter for non-email validation errors
              throw error;
            }
            console.error('Email validation error:', error);
            throw new HttpException('Error validating email address', HttpStatus.INTERNAL_SERVER_ERROR);
          }

          const messages = settings.email[requestData.group || 'default'];
          if (!messages) {
            await this.verifyStatisticsService.incrementStatistic(VerifyMethod.EMAIL, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
            throw new HttpException('No messages found for group: ' + requestData.group, HttpStatus.UNPROCESSABLE_ENTITY);
          }

          let message = null;
          if (Array.isArray(messages)) {
            // Multiple email messages with percentages
            const selectedMessage = this.selectRandomMessage(messages);
            if (!selectedMessage) {
              //Increment error request counter
              await this.verifyStatisticsService.incrementStatistic(VerifyMethod.EMAIL, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
              throw new HttpException('No email message to send', HttpStatus.UNPROCESSABLE_ENTITY);
            }
            message = await this.messagesService.getMessageById(selectedMessage.message.id);
          } else {
            // Single email message (legacy support)
            message = await this.messagesService.getMessageById(messages.id);
          }

          const formattedEmail = parseMessageToSendEmail(message, account, { email: requestData.to, customFields: { CODE: code } });
          await this.pubSubProvider.sendAsyncMessage(process.env.TOPIC_NAME_SEND_EMAIL, formattedEmail, {
            priority: 'transactional',
          });
          messageSent = true;
          break;
        }

        case VerifyMethod.WHATSAPP: {
          if (!accountConfig) {
            console.log(`VERIFY CONFIG ERROR: ${requestData.to}`, JSON.stringify(request.headers));
            //Increment error request counter
            await this.verifyStatisticsService.incrementStatistic(VerifyMethod.WHATSAPP, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
            throw new HttpException('2FA service not configured', HttpStatus.UNPROCESSABLE_ENTITY);
          }
          const settingsAccount = JSON.parse(accountConfig.value);
          if (!Object.prototype.hasOwnProperty.call(settingsAccount, 'whatsapp')) {
            //Increment error request counter
            await this.verifyStatisticsService.incrementStatistic(VerifyMethod.WHATSAPP, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
            throw new HttpException('Whatsapp setup not completed', HttpStatus.UNPROCESSABLE_ENTITY);
          }

          const messagesWhatsapp = settingsAccount.whatsapp[requestData.group || 'default'];
          if (!messagesWhatsapp) {
            await this.verifyStatisticsService.incrementStatistic(VerifyMethod.WHATSAPP, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
            throw new HttpException('No messages found for group: ' + requestData.group, HttpStatus.UNPROCESSABLE_ENTITY);
          }

          const selectedMessage = this.selectRandomMessage(messagesWhatsapp);
          if (!selectedMessage) {
            //Increment error request counter
            await this.verifyStatisticsService.incrementStatistic(VerifyMethod.WHATSAPP, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
            throw new HttpException('No whatsapp message to send', HttpStatus.UNPROCESSABLE_ENTITY);
          }
          const whatsappMessage = await this.messagesService.getMessageById(selectedMessage.message.id);

          const formattedWhatsapp = parseMessageToSendEmail(whatsappMessage, account, { whatsapp: requestData.to, code: code, hasWhatsapp: true });
          await this.pubSubProvider.sendAsyncMessage(process.env.TOPIC_NAME_SEND_WHATSAPP, formattedWhatsapp);
          messageSent = true;
          break;
        }

        default:
          await this.verifyStatisticsService.incrementStatistic(requestData.method as VerifyMethod, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
          throw new HttpException('Invalid or not available method', HttpStatus.UNPROCESSABLE_ENTITY);
      }

      //If reached here, means message was sent successfully
      if (messageSent) {
        await this.verifyStatisticsService.incrementStatistic(requestData.method as VerifyMethod, requestData.group, VerifyStatisticType.SUCCESS, accountTimezone);
      }
      const createdAt = new Date();
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (Number(requestData.expiration) || 90));

      const verification = JSON.stringify({
        to: requestData.to,
        code,
        method: requestData.method,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      const redisClient = this.redisService.getClient();
      await redisClient.set(`verifyContact:${this.cls.get('accountId')}:${requestData.group}:${requestData.to}`, verification, 'EX', Number(requestData.expiration) || 90);

      return {
        to: requestData.to,
        channel: requestData.method,
        valid: true,
        created_at: createdAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        ...(requestData.returnCode ? { code } : {}),
      };
    } catch (error) {
      await this.verifyStatisticsService.incrementStatistic(requestData.method as VerifyMethod, requestData.group, VerifyStatisticType.ERROR, accountTimezone);
      console.error('2FA Error', error);
      throw error;
    }
  }

  async validate(requestData: VerifyValidateDto) {
    if (!requestData.code) {
      throw new HttpException('Missing code', HttpStatus.UNPROCESSABLE_ENTITY);
    }

    const account = await this.accountsService.findOne(this.cls.get('accountId'));
    const accountTimezone = account.configByName('time_zone').value || 'UTC';

    //TODO: Does validate code need to increment request counter?

    const redisClient = await this.redisService.getClient();
    const verification = await redisClient
      .get(`verifyContact:${this.cls.get('accountId')}:${requestData.group}:${requestData.to}`)
      .then((redisContent) => JSON.parse(redisContent));
    if (!verification) {
      //Increment rejected request counter
      //using SMS as default method
      const method = (requestData.method as VerifyMethod) || VerifyMethod.SMS;
      await this.verifyStatisticsService.incrementStatistic(method, requestData.group, VerifyStatisticType.REJECTED, accountTimezone);
      return {
        to: requestData.to,
        channel: method,
        status: VerifyStatus.INVALID,
      };
    }

    const isCodeValid = Number(requestData.code) === verification.code;

    if (isCodeValid) {
      //Increment validated request counter
      await this.verifyStatisticsService.incrementStatistic(verification.method || VerifyMethod.SMS, requestData.group, VerifyStatisticType.VALIDATED, accountTimezone);
    } else {
      //Increment rejected request counter
      await this.verifyStatisticsService.incrementStatistic(verification.method || VerifyMethod.SMS, requestData.group, VerifyStatisticType.REJECTED, accountTimezone);
    }

    return {
      to: requestData.to,
      channel: verification?.method || VerifyMethod.SMS,
      status: isCodeValid ? VerifyStatus.APPROVED : VerifyStatus.INVALID,
      valid: isCodeValid,
      created_at: verification.createdAt,
      expires_at: verification.expiresAt,
    };
  }
}
