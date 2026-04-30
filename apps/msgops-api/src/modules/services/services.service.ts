import { HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { EventPublisherService } from '../../providers/messaging/event-publisher.service';
import { EXCHANGES } from '@bms/messaging';
import { EmailPriority, SendEmailMessage, SendEmailMessageDto, TransactionalMessage } from './services.dto';
import { AccountsService } from '../accounts/accounts.service';
import { ContactsService } from '../contacts/contacts.service';
import { formatterEmail, isValidEmail, parseMessageToSendEmail, replaceSpecialChars } from '../../utils/utils.service';
import { ClsService } from 'nestjs-cls';
import { MessageDto } from '../messages/messages.dto';
import { AccountConfigEntity } from 'src/entities/account-config.entity';
import { PoolsService } from '../pools/pools.service';
import { MessagesService } from '../messages/messages.service';
import { AccountCacheService } from '../accounts/account-cache.service';
import { PoolsDto } from '../pools/pools.dto';
@Injectable()
export class ServicesService {
  constructor(
    private readonly eventPublisher: EventPublisherService,
    private readonly accountService: AccountsService,
    private readonly contactService: ContactsService,
    private readonly messagesService: MessagesService,
    private readonly poolService: PoolsService,
    private readonly cls: ClsService,
    private readonly accountCacheService: AccountCacheService,
  ) {}

  async sendEmail(sendEmailMessage: SendEmailMessageDto): Promise<any> {
    const account = await this.accountService.findWithCleanConfigs(this.cls.get('accountId'));

    if (!account) {
      throw new HttpException('[Unauthorized] - Account not exists', HttpStatus.UNAUTHORIZED);
    }

    if (sendEmailMessage.sendAt) {
      if (isNaN(Number(sendEmailMessage.sendAt))) {
        throw new HttpException('Invalid date format for sendAt', HttpStatus.BAD_REQUEST);
      }

      if (Number(sendEmailMessage.sendAt) > 1e11) {
        sendEmailMessage.sendAt = Math.floor(Number(sendEmailMessage.sendAt) / 1000);
      }

      const now = Math.floor(new Date().getTime() / 1000);
      const maxDate = Math.floor(now + 72 * 60 * 60); // 72 hours from now
      if (Number(sendEmailMessage.sendAt) < now || Number(sendEmailMessage.sendAt) > maxDate) {
        throw new HttpException('Send at must be in the future and within 72 hours from now', HttpStatus.BAD_REQUEST);
      }
    }

    let ippool = sendEmailMessage.message.ippool;
    let pool: PoolsDto;
    if (ippool) {
      pool = await this.poolService.findOneByPool(ippool, account.id);
      if (!pool) {
        throw new HttpException('Pool not found', HttpStatus.BAD_REQUEST);
      }
    }

    if (!sendEmailMessage.message.ippool) {
      pool = await this.poolService.findOneBySenderEmail(sendEmailMessage.message.from.email, account.id);
      if (!pool) {
        throw new HttpException('Sender not found for this email', HttpStatus.BAD_REQUEST);
      }
      ippool = pool.name;
    }

    const replyTo = pool?.senderReplyTo || sendEmailMessage.message.from.email;

    if (sendEmailMessage.loadContactFromDatabase) {
      if (sendEmailMessage.contact.email) {
        const contact = await this.contactService.findByProperty({ email: sendEmailMessage.contact.email, isCompleted: true });
        if (contact) {
          contact.email = `${sendEmailMessage.contact.email}`;
          sendEmailMessage.contact = contact;
        }
      } else if (sendEmailMessage.contact.uuid) {
        sendEmailMessage.contact = await this.contactService.findByProperty({ uuid: sendEmailMessage.contact.uuid, isCompleted: true });
      } else if (sendEmailMessage.contact.id) {
        sendEmailMessage.contact = await this.contactService.findByProperty({ id: sendEmailMessage.contact.id, isCompleted: true });
      }
    }

    const currentDate = new Date();

    const amqpMessage = {
      messageId: currentDate.getTime(),
      utmContent: sendEmailMessage.utmContent || 'teste',
      utmCampaign: sendEmailMessage.utmCampaign || 'msgops_front_teste',
      automationName: sendEmailMessage.automationName || 'msgops_front_teste',
      automationType: 'transactional',
      account: account,
      contact: sendEmailMessage.contact,
      message: {
        id: sendEmailMessage.message.id || 0,
        title: sendEmailMessage.message.title,
        name: replaceSpecialChars(sendEmailMessage.message.name || sendEmailMessage.message.title),
        previewText: sendEmailMessage.message.previewText,
        ippool: ippool,
        subject: sendEmailMessage.message.subject,
        priority: sendEmailMessage.message.priority || EmailPriority.TRANSACTIONAL,
        content: sendEmailMessage.message.content,
        replyTo,
        from: {
          firstName: sendEmailMessage.message.from.firstName,
          email: sendEmailMessage.message.from.email,
        },
        to: {
          firstName: sendEmailMessage.contact.firstName,
          email: sendEmailMessage.contact.email,
        },
      },
      sendAt: sendEmailMessage.sendAt,
    } as SendEmailMessage;

    try {
      await this.eventPublisher.publish(EXCHANGES.email, 'email.send', amqpMessage, {
        priority: EmailPriority.TRANSACTIONAL,
      });
      return { status: 'ok' };
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException(`error to create send email.`);
    }
  }

  async sendMobilePush(sendPushMessage: { email: string; message: MessageDto }): Promise<any> {
    try {
      const currentDate = new Date();
      const account: any = await this.accountService.findOne(this.cls.get('accountId'));
      const contact = await this.contactService.findByProperty({ email: sendPushMessage.email, isCompleted: true });
      contact['contactDevices'] = JSON.parse(JSON.stringify(contact['contactsDevices']));
      delete contact['contactsDevices'];

      if (!contact || !contact.hasMobilePush) {
        return { status: 401, message: 'Invalid contact.' };
      }

      account.accountConfigs = account.accountConfigs.reduce((acc: Record<string, string>, config: AccountConfigEntity) => {
        acc[config.name] = config.value || '';
        return acc;
      });
      account.customFields = account.customFields.map((customField) => customField.name);
      const amqpMessage = {
        messageId: currentDate.getTime(),
        utmContent: 'teste',
        utmCampaign: 'msgops_front_teste',
        automationName: 'msgops_front_teste',
        automationType: 'transactional',
        automationId: 0,
        account: account,
        contact,
        message: {
          name: replaceSpecialChars(sendPushMessage.message.title),
          ...sendPushMessage.message,
        },
        next: {},
      };
      await this.eventPublisher.publish(EXCHANGES.push, 'push.send', amqpMessage, { type: 'single' });
      return { status: 'ok' };
    } catch (e) {
      console.error(e);
      throw new InternalServerErrorException(`error to create send push.`);
    }
  }

  async unsubscribed(email: string) {
    return await this.contactService.unsubscribedByEmail(this.cls.get('accountId'), email);
  }

  async invalidateInternalAccountsCache(): Promise<{ invalidated: number }> {
    const accounts = await this.accountService.getInternalAccounts();

    for (const account of accounts) {
      await this.accountCacheService.invalidateAccountCache(account.id);
    }

    return { invalidated: accounts.length };
  }

  async processTransactional(transactionalMessage: TransactionalMessage) {
    if (!transactionalMessage.name) {
      throw new HttpException(`Can't process without message name`, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    if (!transactionalMessage.contact.email) {
      throw new HttpException(`Can't process without contact email`, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    if (transactionalMessage.contact && transactionalMessage.contact.email) {
      transactionalMessage.contact.email = formatterEmail(transactionalMessage.contact.email);
    }

    if (transactionalMessage.contact && transactionalMessage.contact.email && !isValidEmail(transactionalMessage.contact.email)) {
      console.log(`Invalid Payload Email: ${JSON.stringify(transactionalMessage)}`);
      return {
        status: HttpStatus.OK,
        message: `Invalid Payload Email: ${transactionalMessage.contact.email}`,
      };
    }

    const account = await this.accountService.findWithCleanConfigs(this.cls.get('accountId'));
    const message = await this.messagesService.findOneByname(transactionalMessage.name);

    if (!account || !message) {
      return {
        status: false,
        message: `[transactional] Could not find a transactional message with name: ${transactionalMessage.name}`,
      };
    }

    try {
      const payload = parseMessageToSendEmail(message, account, transactionalMessage.contact);
      await this.eventPublisher.publish(EXCHANGES.email, 'email.send', payload, {
        priority: 'transactional',
      });
      return { status: 'ok' };
    } catch (error) {
      throw `[transactional] Error parseLeadStateMessage: ${error.message}`;
    }
  }
}
