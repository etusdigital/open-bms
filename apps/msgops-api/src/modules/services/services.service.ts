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
import { SendersService } from '../senders/senders.service';
import { MessagesService } from '../messages/messages.service';
import { AccountCacheService } from '../accounts/account-cache.service';
@Injectable()
export class ServicesService {
  constructor(
    private readonly eventPublisher: EventPublisherService,
    private readonly accountService: AccountsService,
    private readonly contactService: ContactsService,
    private readonly messagesService: MessagesService,
    private readonly poolService: PoolsService,
    private readonly sendersService: SendersService,
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

    const ippool = sendEmailMessage.message.ippool;
    let sender: { senderReplyTo?: string };
    if (ippool) {
      // IP pool routing stays on the pool entity (decision #2). It is resolved
      // independently of sender identity; a missing pool is fatal as before.
      const pool = await this.poolService.findOneByPool(ippool, account.id);
      if (!pool) {
        throw new HttpException('Pool not found', HttpStatus.BAD_REQUEST);
      }
      sender = await this.sendersService.findOneBySenderEmail(sendEmailMessage.message.from.email, account.id);
    } else {
      // No explicit ippool: resolve the sender by from.email to honor a
      // configured senderReplyTo. Identity no longer lives on `pools`
      // (EVO-1281 split); a missing sender is non-fatal — we fall back to
      // from.email. We must NOT derive ippool from identity (EVO-1280).
      sender = await this.sendersService.findOneBySenderEmail(sendEmailMessage.message.from.email, account.id);
    }

    const replyTo = sender?.senderReplyTo || sendEmailMessage.message.from.email;

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

  async sendTestWhatsapp(payload: { email: string; messageId: number }): Promise<{ status: string }> {
    const message = await this.messagesService.findOneById(Number(payload.messageId));
    if (!message || !['whatsapp', '2FA-whatsapp'].includes(message.type)) {
      throw new HttpException('WhatsApp message not found.', HttpStatus.NOT_FOUND);
    }
    if (message.status !== 'approved' || !message.providerMessageId) {
      throw new HttpException('Template must be approved by Meta before a test send.', HttpStatus.BAD_REQUEST);
    }

    const contact = await this.contactService.findByProperty({ email: payload.email, isCompleted: true });
    if (!contact || !contact.hasWhatsapp || !contact.whatsapp) {
      throw new HttpException('Contact not found or has no WhatsApp number.', HttpStatus.BAD_REQUEST);
    }

    const account: any = await this.accountService.findOne(this.cls.get('accountId'));
    account.accountConfigs = (account.accountConfigs ?? []).reduce((acc: Record<string, string>, config: AccountConfigEntity) => {
      acc[config.name] = config.value || '';
      return acc;
    }, {});
    account.customFields = (account.customFields ?? []).map((customField) => customField.name);

    const amqpMessage = {
      messageId: Date.now(),
      utmContent: 'teste',
      utmCampaign: 'msgops_front_teste',
      automationName: 'msgops_front_teste',
      automationType: 'transactional',
      automationId: 0,
      account,
      contact,
      message,
      next: {},
    };
    await this.eventPublisher.publish(EXCHANGES.whatsapp, 'whatsapp.send', amqpMessage, { type: 'single' });
    return { status: 'ok' };
  }

  async sendMobilePush(sendPushMessage: { email: string; message: MessageDto }): Promise<any> {
    try {
      const currentDate = new Date();
      const account: any = await this.accountService.findOne(this.cls.get('accountId'));
      const contact = await this.contactService.findByProperty({ email: sendPushMessage.email, isCompleted: true });

      // Accept contacts that have EITHER a mobile-push (native app) OR a web-push
      // (browser) device. This endpoint historically gated on hasMobilePush only,
      // which rejected web-push-only contacts even though the send-push worker
      // delivers web-push fine (platform-minted FCM tokens). The worker selects the
      // right device by `message.type`, so a web-push caller must send type 'web-push'.
      if (!contact || (!contact.hasMobilePush && !contact.hasWebPush)) {
        return { status: 401, message: 'Invalid contact.' };
      }

      contact['contactDevices'] = JSON.parse(JSON.stringify(contact['contactsDevices']));
      delete contact['contactsDevices'];

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
