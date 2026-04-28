import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from './providers/redis/redis.service';
import { Contact, ContactDevice, DeviceType, LeadMessage, EmailVerify, CustomFieldsType } from './interfaces';
import { ContactEntity } from './msgops/entities/contact.entity';
import { TagPublisherService } from './publishers/tag-publisher.service';
import { EventPublisherService } from './publishers/event-publisher.service';
import { TriggerPublisherService } from './publishers/trigger-publisher.service';
import { MsgopsService } from './msgops/msgops.service';
import { FormatterUtils } from './utils/formatter.utils';
import { AccountEntity } from './msgops/entities/account.entity';
import { EmailValidationProvider } from './providers/emailValidation.provider';
import { phone } from 'phone';
import { createHash } from 'crypto';
import { LeadsEntity } from './msgops/entities/leads.entity';
import { InsertResult } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { GeolocationService } from './geolocation/geolocation.service';
@Injectable()
export class AppService {
  constructor(
    private readonly tagPublisher: TagPublisherService,
    private readonly eventPublisher: EventPublisherService,
    private readonly triggerPublisher: TriggerPublisherService,
    private readonly msgopsService: MsgopsService,
    private readonly redisService: RedisService,
    private readonly formatterUtils: FormatterUtils,
    private readonly emailValidationProvider: EmailValidationProvider,
    private readonly geolocationService: GeolocationService,
  ) {}

  async createOrUpdate(leadAutomation: LeadMessage, isUpdateContact = false) {
    this.logInfo(`Payload: ${JSON.stringify(leadAutomation)}`);
    leadAutomation = this.formatterUtils.cleanUpObjects(leadAutomation);

    if (!leadAutomation.contact) {
      console.log('Contact empty:', JSON.stringify(leadAutomation));
      return { status: HttpStatus.OK, message: 'Missing contact' };
    }

    if (!leadAutomation.apiKey) {
      console.log('Apikey empty:', JSON.stringify(leadAutomation));
      return { status: HttpStatus.UNAUTHORIZED, message: 'Missing apikey' };
    }

    if (leadAutomation.contact && leadAutomation.contact.email) {
      leadAutomation.contact.email = this.formatterUtils.formatterEmail(leadAutomation.contact.email);
    }

    if (leadAutomation.contact && leadAutomation.contact.email && !leadAutomation.contact.email.includes('@')) {
      console.log(`Invalid Payload Email: ${JSON.stringify(leadAutomation)}`);
      return {
        status: HttpStatus.OK,
        message: `Invalid Payload Email: ${leadAutomation.contact.email} - KEY: ${leadAutomation.apiKey}`,
      };
    }

    try {
      const account = await this.msgopsService.findAccountByApiKey(leadAutomation.apiKey);
      if (!account) {
        console.log(`Account not found: ${JSON.stringify(leadAutomation)}`);
        return {
          status: leadAutomation.isImport ? HttpStatus.OK : HttpStatus.NOT_FOUND,
          message: `Account not found: ${JSON.stringify(leadAutomation)}`,
        };
      }

      leadAutomation.account = account;

      if (leadAutomation.contact.email) {
        leadAutomation.contact.email = this.formatterUtils.removeQuotes(leadAutomation.contact.email);
      }

      if (leadAutomation.contact.email && this.formatterUtils.isValidEmail(leadAutomation.contact.email) === false) {
        this.logInfo(`Invalid email format: ${JSON.stringify(leadAutomation)}`);
        leadAutomation.contact.isValid = false;
      }

      if (!isUpdateContact && this.shouldValidateEmail(leadAutomation, account)) {
        const emailChecker = await this.emailValidationProvider.emailChecker(leadAutomation.contact.email, leadAutomation.apiKey);

        if (emailChecker.result === EmailVerify.DEFERRED) {
          this.logInfo(`Deferred email validation: ${JSON.stringify(leadAutomation)}`);
          throw new HttpException(`Deferred email validation: ${JSON.stringify(leadAutomation)}`, 408);
        }

        if (emailChecker.hasOwnProperty('result')) {
          leadAutomation.contact.isValid = emailChecker.result === EmailVerify.DELIVERABLE;
          if (emailChecker.result === EmailVerify.UNKNOWN && account.id == 262) {
            leadAutomation.contact.isValid = true;
          }
          leadAutomation.invalidReason = emailChecker.reason;
        } else {
          leadAutomation.contact.isValid = true;
          leadAutomation.invalidReason = null;
          console.error(`Email ${leadAutomation.contact.email} was not validated by the api`);
        }
      }

      let devices = [];
      if (leadAutomation.contact.devices && leadAutomation.contact.devices.length > 0) {
        devices = leadAutomation.contact.devices.filter((device: ContactDevice) => {
          if (device.token !== undefined && device.token !== '') {
            return true;
          }
          if (device.id !== undefined && this.isNumber(device.id) !== false) {
            return true;
          }
          return false;
        });
      }

      let customFields = await this.mapCustomFields(leadAutomation.contact.customFields, account);

      if (devices.length && leadAutomation.contact.email) {
        const tokens = devices.map((device) => device.token);
        const contactByDevice = await this.msgopsService.findContactByDevice(tokens, account.id);

        if (contactByDevice && !contactByDevice.email) {
          const contactCompleted = await this.msgopsService.findContactById(contactByDevice.id, account.id);
          devices = this.mergeContactDevices(contactCompleted, devices);

          this.logInfo(`Merge contact ${leadAutomation.contact.email}: ${JSON.stringify(contactByDevice)}`);
          await this.msgopsService.deleteContact(contactByDevice.id, account.id);
          leadAutomation.contact.devices = JSON.parse(JSON.stringify(devices));
        }
      }

      if (leadAutomation.ip || leadAutomation.contact.ip) {
        const ip = leadAutomation.ip || leadAutomation.contact.ip;
        const location = await this.geolocationService.getLocation(ip);
        leadAutomation.contact.country = location.country;
        leadAutomation.contact.region = location.region;
        leadAutomation.contact.city = location.city;
        leadAutomation.contact.postal = location.postalCode;
        leadAutomation.contact.timezone = location.timezone;
        leadAutomation.contact.latitude = location.latitude;
        leadAutomation.contact.longitude = location.longitude;
      }

      const contactResult = await this.findOrCreateContact(leadAutomation, account);

      if (!contactResult) {
        this.logInfo(`Contact not found: ${JSON.stringify(leadAutomation)}`);
        return;
      }

      const { contact, changedFields, isNew } = contactResult;

      if (account.isInternal) {
        if (leadAutomation.utm_source && !Object.keys(customFields).includes('last_source')) {
          customFields['last_source'] = leadAutomation.utm_source;
        }
      }

      if (customFields) {
        await this.parseCustomFields(customFields, account.id, contact);
      }

      if (devices.length) {
        const savedDevices = await this.processDevices(devices, contact, account);

        if (!leadAutomation.tagName) {
          if (savedDevices.generatedMaps.find((device) => device.type === 'mobile-push')) {
            leadAutomation.mobilePush = this.validateNewPushDevice(savedDevices);
          }

          if (savedDevices.generatedMaps.find((device) => device.type === 'web-push')) {
            leadAutomation.webPush = this.validateNewPushDevice(savedDevices);
          }

          delete contact.contactDevices;
        }
      }

      if (isUpdateContact === false && this.isValidLead(leadAutomation)) {
        const lead = await this.saveLead(leadAutomation, customFields, contact, account);
        leadAutomation.leadId = lead.id;
        await this.processLeadSubmitted(leadAutomation, account, contact, customFields, changedFields, isNew);

        //TODO: EMAIL-1 Clusters
        // if (lead.tagName === 'plusdin-fluxo-unico-cc') {
        //   const randomNumber = Math.random();
        //   if (randomNumber <= 0.5) {
        //     const message = await this.processEmail1Random(lead);
        //     leadAutomation.messageIdEmail1 = message ? message.message_id : null;
        //   }
        // }
      }

      if (contact.isBlocked) {
        this.logInfo(`Blocked contact: ${JSON.stringify(leadAutomation)}`);
        return;
      }

      if (leadAutomation.tagName === 'lead-akross' && isNew) {
        if (!customFields) {
          customFields = [];
        }
        customFields['isNew'] = true;
      }

      if (!leadAutomation.tagName && !leadAutomation.webPush && !leadAutomation.mobilePush && !leadAutomation.removeTag) {
        this.logInfo(`Payload without tag or webPush: ${JSON.stringify(leadAutomation)}`);
        return {
          status: HttpStatus.OK,
          message: `Message successfully processed! - ${leadAutomation.contact.email}`,
        };
      }

      const source = this.definedSource(leadAutomation);

      leadAutomation = {
        contact: contact,
        account: leadAutomation.account,
        tagName: leadAutomation.tagName,
        apiKey: leadAutomation.apiKey,
        startedAt: leadAutomation.startedAt,
        startAutomation: leadAutomation.startAutomation,
        leadId: leadAutomation.leadId,
        messageIdEmail1: leadAutomation.messageIdEmail1,
        webPush: leadAutomation.webPush,
        mobilePush: leadAutomation.mobilePush,
      };

      // EMC RULES
      if (['quizmaker-new', 'quizmaker'].includes(source)) {
        const emcRedisKey = `emc:campaigns_trigger:${account.id}:quiz_submitted`;
        const redisClient = this.redisService.getOrThrow();
        if (await redisClient.exists(emcRedisKey)) {
          const emcPayload = {
            event: 'quiz_submitted',
            accountId: account.id,
            contactId: contact.id,
            timestamp: leadAutomation.startedAt || Date.now(),
            properties: {
              leadId: leadAutomation.leadId,
            },
          };

          await this.triggerPublisher.publish(emcPayload);
        }
      }

      if (leadAutomation.tagName) {
        const tags: string[] = Array.isArray(leadAutomation.tagName) ? leadAutomation.tagName : [leadAutomation.tagName];
        const newLeadAutomation = JSON.parse(JSON.stringify(leadAutomation)) as LeadMessage;
        for (const tag of tags) {
          newLeadAutomation.tagName = tag;
          await this.sendTagProcess(newLeadAutomation, 'add');
        }
      }

      if (leadAutomation.webPush || leadAutomation.mobilePush) {
        await this.sendTagProcess(leadAutomation, 'add');
      }

      if (leadAutomation.removeTag) {
        const removeTag: string[] = Array.isArray(leadAutomation.removeTag) ? leadAutomation.removeTag : [leadAutomation.removeTag];
        const newLeadAutomation = JSON.parse(JSON.stringify(leadAutomation)) as LeadMessage;
        for (const tag of removeTag) {
          newLeadAutomation.removeTag = tag;
          await this.sendTagProcess(newLeadAutomation, 'remove');
        }
      }

      return {
        status: HttpStatus.OK,
        message: `Message processed! - ${leadAutomation.contact.email || leadAutomation.webPush || leadAutomation.mobilePush ? 'push-subscription' : ''}`,
      };
    } catch (error) {
      this.processMessageCatchError(error, leadAutomation);
    }
  }

  definedSource(leadAutomation: LeadMessage) {
    if (leadAutomation.isImport) {
      return 'import';
    }

    if (leadAutomation.accountChange) {
      return 'account_migration';
    }

    if (leadAutomation.hasOwnProperty('type')) {
      return leadAutomation.type;
    }

    if (leadAutomation.hasOwnProperty('app')) {
      return 'quizmaker';
    }

    return 'api';
  }

  shouldValidateEmail(leadAutomation: LeadMessage, account: AccountEntity) {
    if (!leadAutomation.contact.email) {
      return false;
    }

    if (!account.isInternal && leadAutomation.contact && leadAutomation.contact.hasOwnProperty('isValid')) {
      return false;
    }

    if (account.id === 93) {
      console.log(`DINDS PAYLOAD: ${JSON.stringify(leadAutomation)}`);
    }

    // when importing contacts through the api,
    // if user has set the contactValidate to false, we don't need to validate the email
    if (leadAutomation.hasOwnProperty('contactValidate')) {
      return leadAutomation.contactValidate;
    }

    const { value: emailSettings } = this.formatterUtils.configByName(account, 'email_settings');
    return JSON.parse(emailSettings).validateEmails === true;
  }

  engagedProcess(contact: ContactEntity) {
    if (!contact.isValid || contact.hasBounced) {
      return '-99';
    }

    const createdAt = contact.createdAt.getTime();
    const currentTime = new Date().getTime();
    if (contact.lastSent && !contact.lastOpen) {
      const ninetyDaysAgo = currentTime - 90 * 86400000;
      if (createdAt >= ninetyDaysAgo) {
        return '-999';
      }

      if (createdAt < ninetyDaysAgo) {
        return '-90';
      }

      const sixtyDaysAgo = currentTime - 60 * 86400000;
      if (createdAt < sixtyDaysAgo) {
        return '-60';
      }

      const fortyDaysAgo = currentTime - 40 * 86400000;
      if (createdAt < fortyDaysAgo) {
        return '-40';
      }

      const thirtyDaysAgo = currentTime - 30 * 86400000;
      if (createdAt < thirtyDaysAgo) {
        return '-30';
      }

      const fifteenDaysAgo = currentTime - 15 * 86400000;
      if (createdAt < fifteenDaysAgo) {
        return '-15';
      }

      const threeDaysAgo = currentTime - 86400000;
      if (createdAt < threeDaysAgo) {
        return '-3';
      }

      return '-1';
    }

    if (!contact.lastSent) {
      return '0';
    }

    const engaged = currentTime - contact.lastOpen.getTime();
    if (engaged < 3 * 86400000) {
      return '3';
    }
    if (engaged < 7 * 86400000) {
      return '7';
    }
    if (engaged < 15 * 86400000) {
      return '15';
    }
    if (engaged < 30 * 86400000) {
      return '30';
    }
    if (engaged < 40 * 86400000) {
      return '40';
    }
    if (engaged < 60 * 86400000) {
      return '60';
    }
    if (engaged < 90 * 86400000) {
      return '90';
    }
    if (engaged < 120 * 86400000) {
      return '120';
    }
    if (engaged < 180 * 86400000) {
      return '180';
    }
    if (engaged >= 180 * 86400000) {
      return '999';
    }
    return null;
  }

  leadStatus(contact: ContactEntity) {
    if (contact.hasOwnProperty('isNew')) {
      return 'new';
    }

    if (contact.hasBounced) {
      return 'bounced';
    }

    if (!contact.isValid) {
      return 'invalid';
    }

    return 'old';
  }

  async sendTagProcess(leadAutomation: LeadMessage, type) {
    await this.tagPublisher.publish(leadAutomation as any, { type });

    this.logInfo(`Sent to tag-process: ${leadAutomation.webPush ? 'webPUsh' : leadAutomation.tagName} - ${leadAutomation.contact.email} - ${type}`);
  }

  async findOrCreateContact(leadAutomation: LeadMessage, account: AccountEntity): Promise<{ contact: ContactEntity; changedFields: Record<string, any>; isNew: boolean } | null> {
    let contact = null;

    if (leadAutomation.contact.email) {
      const emailFormatter = this.formatterUtils.slugify(leadAutomation.contact.email);
      leadAutomation.contact.email = emailFormatter.toLowerCase();

      contact = await this.msgopsService.findContactByEmail(leadAutomation.contact.email, account.id);
      const suppression = account.groupId ? await this.msgopsService.findSuppressionByEmail(leadAutomation.contact.email, account.groupId) : null;

      if (suppression && suppression.isBlocked) {
        leadAutomation.contact.isBlocked = true;
        leadAutomation.contact.blockedAt = suppression.blockedAt;
      }

      if (contact && contact.isUnsubscribed && this.hasSevenDaysPassed(contact.unsubscribedAt)) {
        if (!suppression || (suppression && suppression.isBlocked === false)) {
          leadAutomation.contact.isUnsubscribed = false;
          leadAutomation.contact.unsubscribedAt = null;
          await this.msgopsService.deleteContactTag(contact.id, account.id);
          await this.processResubscribed(leadAutomation, account, contact);

          const redisClient = this.redisService.getOrThrow();
          await redisClient.del(`${account.id}:unsubscribed:${leadAutomation.contact.email}`);

          if (suppression) {
            await this.msgopsService.removeSuppression(leadAutomation.contact.email, account.groupId);
          }
        }
      }

      if (!contact && suppression && suppression.isBlocked == false && !this.hasSevenDaysPassed(suppression.unsubscribedAt)) {
        leadAutomation.contact.isUnsubscribed = true;
        leadAutomation.contact.unsubscribedAt = suppression.unsubscribedAt;
      }
    }

    if (!contact && leadAutomation.contact.uuid) {
      contact = await this.msgopsService.findContactByUuid(leadAutomation.contact.uuid, account.id);
    }

    const devices =
      leadAutomation.contact.devices?.filter(
        (device: ContactDevice) => (device.token !== undefined && device.token !== '') || (device.id !== undefined && this.isNumber(device.id) !== false),
      ) ?? [];
    if (devices.length) {
      if (!contact) {
        const tokens = leadAutomation.contact.devices.map((device) => device.token).filter((token) => token !== undefined && token !== '');
        contact = await this.msgopsService.findContactByDevice(tokens, account.id);
      }

      for (const device of devices) {
        switch (device.type) {
          case DeviceType.MOBILEPUSH:
            leadAutomation.contact.hasMobilePush = true;
            break;
          case DeviceType.WEBPUSH:
            leadAutomation.contact.hasWebPush = true;
            break;
          case DeviceType.EMAIL:
            leadAutomation.contact.hasEmail = true;
            break;
          case DeviceType.PHONE:
            leadAutomation.contact.hasPhone = true;
            break;
        }
      }
    }

    if (contact && leadAutomation.contactUpdate === false) {
      return { contact, changedFields: {}, isNew: false };
    }

    if (!contact && !leadAutomation.contact.email && !leadAutomation.contact.phone && !leadAutomation.contact.whatsapp && !leadAutomation.contact.uuid && devices.length === 0) {
      console.log('No contact information to create or update', JSON.stringify(leadAutomation));
      return null;
    }

    if (leadAutomation.contact.phone) {
      const defaultCountry = leadAutomation.contact.phone.charAt(0) === '+' ? null : this.formatterUtils.configByName(account, 'default_country').value;
      const contactPhone = phone(leadAutomation.contact.phone, { country: defaultCountry });
      if (contactPhone.isValid) {
        leadAutomation.contact.phone = contactPhone.phoneNumber;
      } else {
        console.log('Invalid phone', JSON.stringify(leadAutomation));
      }
    }

    if (leadAutomation.contact.whatsapp) {
      const whatsappNumber = leadAutomation.contact.whatsapp.replace(/whatsapp:/gi, '');
      const defaultCountry = whatsappNumber.charAt(0) === '+' ? null : this.formatterUtils.configByName(account, 'default_country').value;
      const contactPhone = phone(whatsappNumber, { country: defaultCountry });
      if (contactPhone.isValid) {
        leadAutomation.contact.whatsapp = `whatsapp:${contactPhone.phoneNumber}`;
      } else {
        console.log('Invalid whatsapp number', JSON.stringify(leadAutomation));
      }
    }

    delete leadAutomation.contact.customFields;
    delete leadAutomation.contact.devices;

    return this.createOrUpdateContact(contact, leadAutomation.contact, account);
  }

  mergeContactDevices(contactCompleted, contactDevices) {
    const tokens = [];
    const devicesReturn = contactCompleted.contactDevices.map((device) => {
      tokens.push(device.token);
      return { ...device, id: null, contactId: null };
    });
    contactDevices.forEach((device) => {
      if (!tokens.includes(device.token)) {
        devicesReturn.push({ ...device });
      }
    });

    return devicesReturn;
  }

  async createOrUpdateContact(
    contact: ContactEntity,
    newContact: Contact,
    account: AccountEntity,
  ): Promise<{ contact: ContactEntity; changedFields: Record<string, any>; isNew: boolean }> {
    newContact = this.setContactDetails(newContact);
    if (contact) {
      newContact.properties = { ...contact.properties };
      newContact = this.msgopsService.initializeOrUpdateLeadsCount(newContact) as Contact;
      const result = await this.msgopsService.updateContactWithChanges(contact, newContact);
      return { contact: result.contact, changedFields: result.changedFields, isNew: false };
    }

    const { value: timeZone } = this.formatterUtils.configByName(account, 'time_zone');
    newContact.accountId = account.id;
    newContact.createdAtDate = new Date().toLocaleDateString('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });

    if (!newContact.uuid) {
      newContact.uuid = uuidv7();
    }

    newContact = this.msgopsService.initializeOrUpdateLeadsCount(newContact) as Contact;
    const contactReturn: any = await this.msgopsService.createContact(newContact);
    contactReturn.isNew = true;
    // For new contacts, all fields are "changed" (new)
    return { contact: contactReturn, changedFields: newContact as Record<string, any>, isNew: true };
  }

  async parseCustomFields(userCustomFields, accountId: number, contact: any) {
    const contactsCustomFields = await this.msgopsService.getContactsCustomFields(contact.id, accountId);
    const keys = Object.keys(userCustomFields).map((key) => key.toUpperCase());
    const customFields = await this.msgopsService.getCustomFields(keys, accountId);

    const insertCustomContact = `INSERT INTO contacts_custom_fields (account_id, contact_id, custom_field_id, value, time, number) VALUES`;
    const insertValues = [];
    let updateCustomContact = '';

    for (const customField of customFields) {
      const value = this.getValueByCaseInsensitive(userCustomFields, customField.name);
      if (value === null || value === undefined || value === '' || value === 'null' || value === 'undefined') {
        continue;
      }
      const customFieldAttribution = customField.attributionType;
      const hasCustomField = contactsCustomFields.find((item: any) => item.customFieldId === customField.id);
      switch (customFieldAttribution) {
        case 'first':
          if (!hasCustomField) {
            const returnedValue = this.getCustomFieldQuery('insert', customField.type, accountId, contact.id, customField.id, value);
            if (returnedValue) {
              insertValues.push(returnedValue);
            }
          }
          break;

        case 'last':
          if (hasCustomField) {
            updateCustomContact += this.getCustomFieldQuery('update', customField.type, accountId, contact.id, customField.id, value);
          } else {
            const returnedValue = this.getCustomFieldQuery('insert', customField.type, accountId, contact.id, customField.id, value);
            if (returnedValue) {
              insertValues.push(returnedValue);
            }
          }
          break;

        case 'multiple':
          const returnedValue = this.getCustomFieldQuery('insert', customField.type, accountId, contact.id, customField.id, value);
          if (returnedValue) {
            insertValues.push(returnedValue);
          }
          break;
      }
    }

    if (!insertValues.length && !updateCustomContact) {
      return;
    }

    const query = `${insertValues.length ? `${insertCustomContact} ${insertValues.join(',')};` : ''} ${updateCustomContact ? `${updateCustomContact}` : ''}`;
    await this.msgopsService.createOrUpdateCustomFields(query);
  }

  hasSevenDaysPassed(dateString: string | Date): boolean {
    if (!dateString) {
      return true;
    }

    const inputDate = new Date(dateString);
    const today = new Date();

    const differenceInTime = today.getTime() - inputDate.getTime();
    const differenceInDays = differenceInTime / (1000 * 3600 * 24);

    return differenceInDays >= 7;
  }

  getCustomFieldQuery(type: string, customFieldType: string, accountId: number, contactId: number, customFieldId: number, value: string) {
    if (Array.isArray(value) || typeof value === 'object') {
      value = JSON.stringify(value);
    }

    if (customFieldType === CustomFieldsType.DATE && !this.isValidDate(value)) {
      return '';
    }

    if (customFieldType === CustomFieldsType.NUMBER && !this.isNumber(value)) {
      return '';
    }

    if (typeof value === 'string') {
      value = value.replace(/'/g, `''`);
    }

    if (type === 'insert') {
      return `(
              ${accountId}, 
              ${contactId},
              ${customFieldId},
              '${value}',
              ${customFieldType === CustomFieldsType.DATE ? `'${this.formatterUtils.toPostgresTimestampWithTimezone(value)}'` : null},
              ${customFieldType === CustomFieldsType.NUMBER ? value : null}
            )`;
    }

    let querySet = `value = '${value}'`;
    if (customFieldType === CustomFieldsType.NUMBER) {
      querySet += `, number = ${Number(value)}`;
    }

    if (customFieldType === CustomFieldsType.DATE) {
      querySet += `, time = '${this.formatterUtils.toPostgresTimestampWithTimezone(value)}'`;
    }

    return `UPDATE contacts_custom_fields SET ${querySet}, updated_at = CURRENT_TIMESTAMP
      WHERE account_id = ${accountId} and contact_id = ${contactId} and custom_field_id = ${customFieldId};`;
  }

  isNumber(value: string | number): boolean {
    return !isNaN(Number(value));
  }

  isValidDate(dateString: string): boolean {
    if (!dateString.trim()) {
      return false;
    }

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return false;
    }

    return true;
  }

  async processDevices(devices: ContactDevice[], contact: ContactEntity, account: AccountEntity) {
    const contactDevices = devices.map((device) => {
      return {
        ...device,
        accountId: account.id,
        contactId: contact.id,
      };
    });

    return this.msgopsService.createDevice(contactDevices);
  }

  validateNewPushDevice(devices: InsertResult) {
    const oneMinuteAgo = new Date().getTime() - 60000;
    const recentlyCreated = devices.generatedMaps.find((item) => item.type.includes('push') && item.createdAt.getTime() >= oneMinuteAgo);
    if (recentlyCreated) {
      return true;
    }
    return false;
  }

  getValueByCaseInsensitive(object: Record<string, string>[], key: string): string {
    return object[Object.keys(object).find((k) => k.toUpperCase() === key.toUpperCase())];
  }

  private processMessageCatchError(error: any, leadAutomation: any) {
    this.logInfo(`Message process error: ${error.message || JSON.stringify(error)} Payload: ${JSON.stringify(leadAutomation)}`);
    throw new HttpException(`Message process error: ${error.message || JSON.stringify(error)}`, 400);
  }

  setContactDetails(contact: Contact): Contact {
    if (contact.email) {
      contact.email = contact.email.toLowerCase();
      contact.emailProvider = this.formatterUtils.getMailBoxProvider(contact.email);
      contact.hashedEmail = createHash('sha256').update(contact.email).digest('hex');
      contact.hasEmail = true;
    }

    if (contact.name) {
      const name = contact.name?.split(' ') || [''];
      contact.firstName = name.length ? name[0] : null;
      contact.lastName = name.slice(1).join(' ');
    }

    if (contact.whatsapp && !contact.phone) {
      contact.phone = contact.whatsapp.replace(/whatsapp:/gi, '');
      contact.hasPhone = true;
    }

    if (contact.whatsapp) {
      contact.hasWhatsapp = true;
    }

    if (contact.phone) {
      contact.hasPhone = true;
    }

    if (!contact.isActive) {
      contact.isActive = true;
    }

    return contact;
  }

  isValidLead(leadMessage: LeadMessage): boolean {
    if (leadMessage.type && leadMessage.type.includes('push-subscription')) {
      return false;
    }

    if (leadMessage.tagName === 'retargeting-generic') {
      this.logInfo('Not a valid lead - retageting');
      return false;
    }

    return true;
  }

  private async saveLead(leadAutomation: LeadMessage, customFields: any, contact: ContactEntity, account: AccountEntity): Promise<LeadsEntity> {
    const queryString = Object.fromEntries(new URLSearchParams(leadAutomation.query_string || ''));
    const { value: timeZone } = this.formatterUtils.configByName(account, 'time_zone');
    const currentDate = new Date().toLocaleDateString('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    const leadAutomationClone = { ...customFields, ...leadAutomation };
    const lead: LeadsEntity = await this.msgopsService.createLead({
      ...leadAutomationClone,
      ...leadAutomation.contact,
      ...queryString,

      contactId: contact.id,
      accountId: contact.accountId,
      uuid: contact.uuid,
      email: contact.email,
      emailProvider: contact.emailProvider,
      hashedEmail: contact.hashedEmail,
      phone: leadAutomationClone.contact.phone || leadAutomationClone.contact.whatsapp,
      firstName: leadAutomationClone.contact.firstName,
      lastName: leadAutomationClone.contact.lastName,
      isValid: contact.isValid,
      invalidReason: leadAutomationClone.invalidReason,

      transactionId: leadAutomationClone.transactionId,
      status: this.leadStatus(contact),
      engaged: this.engagedProcess(contact),
      leadSource: this.definedSource(leadAutomationClone),

      city: leadAutomationClone.contact.city,
      region: leadAutomationClone.contact.region,
      country: leadAutomationClone.contact.country,
      ip: leadAutomationClone.contact.ip,
      latitude: leadAutomationClone.contact.latitude,
      longitude: leadAutomationClone.contact.longitude,
      timezone: leadAutomationClone.contact.timezone,

      clid:
        queryString.utm_source === 'google'
          ? queryString.gclid
          : queryString.utm_source === 'facebook'
            ? queryString.fbclid
            : ['tiktok', 'pangle'].includes(queryString.utm_source)
              ? queryString.ttclid
              : '',

      questions: leadAutomationClone.questions,
      forms: leadAutomationClone.accountChange ? leadAutomationClone.accountChange : leadAutomationClone.form_fields,
      queryString: queryString,
      customFields: customFields || null,

      sourceUrl: this.formatterUtils.removeQueryString(leadAutomationClone.source_url || leadAutomationClone.origem_cadastro || ''),
      directToUrl: this.formatterUtils.removeQueryString(leadAutomationClone.direct_to),
      userAgent: leadAutomationClone.user_agent,
      tagName: Array.isArray(leadAutomationClone.tagName) ? leadAutomationClone.tagName.join(',') : leadAutomationClone.tagName,

      createdAtDate: currentDate,
    });

    return lead;
  }

  private async processEmail1Random(lead: LeadsEntity) {
    const device = (lead.userAgent || '').includes('Mobile') ? 'mobile' : 'desktop';
    const whereOptions = {
      location: lead.region,
      source: lead.utm_source,
      device,
      vertical: 'cartao-de-credito',
      salary: null,
      job: null,
      negativado: null,
    };
    for (const question of lead.questions as Array<any>) {
      switch (question.question) {
        case 'Em qual grupo você se encaixa?':
          whereOptions.job = question.answer;
          break;
        case 'Você está negativado?':
          whereOptions.negativado = question.answer.toLowerCase();
          break;
        case 'Qual é a sua renda mensal?':
          if (question.answer == 'Até R$2.000,00') {
            whereOptions.salary = '2000';
          } else if (question.answer == 'Entre R$2.000,00 e R$5.000,00') {
            whereOptions.salary = '5000';
          }
          break;
      }
    }

    return await this.msgopsService.findClusterMessage(whereOptions);
  }

  async mapCustomFields(customFields: Record<string, any>, account: AccountEntity) {
    if (!account.customFieldsKeys) {
      return customFields;
    }

    if (!customFields) {
      return {};
    }

    if (typeof customFields === 'string') {
      customFields = JSON.parse(customFields);
    }

    if (typeof customFields === 'object' && Object.keys(customFields).length === 0) {
      return {};
    }

    return account.customFieldsKeys.reduce((acc, field) => {
      if (customFields[field.toUpperCase()] || customFields[field.toLowerCase()]) {
        const value = customFields[field.toUpperCase()] || customFields[field.toLowerCase()];
        if (value) {
          acc[field.toLowerCase()] = typeof value === 'string' ? value.trim() : value;
        }
      }

      return acc;
    }, {});
  }

  logInfo(dsc: string, args?: string) {
    const logLevel = process.env.LOG_LEVEL || 'INFO';
    if (logLevel === 'INFO' || logLevel === 'DEBUG') console.log(dsc, args || '');
    else return;
  }

  async processResubscribed(leadAutomation: LeadMessage, account: AccountEntity, contact: ContactEntity) {
    // LeadActivationRequest payload for event-process
    const eventPayload = {
      platform: 'internal',
      payload: [
        {
          accountId: String(account.id),
          contactId: contact.id,
          uuid: contact.uuid,
          email: leadAutomation.contact.email,
          event: 'resubscribed',
          timestamp: Date.now(),
          properties: {
            reason: leadAutomation.hasOwnProperty('questions') ? 'answered quiz' : 'api request',
          },
          ip: leadAutomation.contact.ip || null,
          url: this.formatterUtils.removeQueryString(leadAutomation.source_url || leadAutomation.origem_cadastro || ''),
        },
      ],
    };

    this.logInfo(`Sending resubscribed event to event-process: ${JSON.stringify(eventPayload)}`);
    await this.eventPublisher.publish(eventPayload, { platform: 'internal' });
  }

  async processLeadSubmitted(
    leadAutomation: LeadMessage,
    account: AccountEntity,
    contact: ContactEntity,
    customFields: Record<string, any>,
    changedFields: Record<string, any>,
    isNewContact: boolean,
  ) {
    // Build properties array with custom field IDs and types
    const properties = await this.buildPropertiesArray(account.id, contact, customFields || {}, changedFields, isNewContact);

    const eventPayload = {
      platform: 'internal',
      payload: [
        {
          accountId: String(account.id),
          contactId: contact.id,
          uuid: contact.uuid,
          email: leadAutomation.contact.email,
          event: 'lead_submitted',
          timestamp: Date.now(),
          properties: {
            lead_id: leadAutomation.leadId,
            ...properties,
          },
          ip: leadAutomation.contact.ip || null,
          url: this.formatterUtils.removeQueryString(leadAutomation.source_url || leadAutomation.origem_cadastro || ''),
        },
      ],
    };

    this.logInfo(`Sending lead_submitted event to event-process: ${JSON.stringify(eventPayload)}`);
    await this.eventPublisher.publish(eventPayload, { platform: 'internal' });
  }

  /**
   * Builds the properties array in the format required for ClickHouse ingestion.
   * Format: [{ id: "123", type: "string", value: "some_value" }, ...]
   */
  async buildPropertiesArray(
    accountId: number,
    contact: ContactEntity,
    userCustomFields: Record<string, any>,
    changedFields: Record<string, any>,
    isNewContact: boolean,
  ): Promise<Array<{ id: string; type: string; value: any }>> {
    const allCustomFields = await this.msgopsService.getAllCustomFieldsCached(accountId);

    // Create a map for quick lookup by field name
    const customFieldsByName = new Map(allCustomFields.map((cf) => [cf.name.toUpperCase(), cf]));

    const properties: Array<{ id: string; type: string; value: any }> = [];

    // Map contact entity property names to system field names (uppercase)
    const contactToSystemFieldMapping: Record<string, string> = {
      email: 'EMAIL',
      emailProvider: 'EMAIL_PROVIDER',
      firstName: 'FIRST_NAME',
      lastName: 'LAST_NAME',
      hashedEmail: 'HASHED_EMAIL',
      phone: 'PHONE',
      city: 'CITY',
      region: 'REGION',
      country: 'COUNTRY',
      postal: 'POSTAL',
      ip: 'IP',
      latitude: 'LATITUDE',
      longitude: 'LONGITUDE',
      timezone: 'TIMEZONE',
      isUnsubscribed: 'ISUNSUBSCRIBED',
      isBlocked: 'ISBLOCKED',
      isValid: 'ISVALID',
      hasBounced: 'HASBOUNCED',
      hasEmail: 'HASEMAIL',
      hasPhone: 'HASPHONE',
      hasWebPush: 'HASWEBPUSH',
      hasMobilePush: 'HASMOBILEPUSH',
      score: 'SCORE',
      createdAt: 'CREATED_AT',
    };

    // Process system fields
    for (const [contactProp, systemFieldName] of Object.entries(contactToSystemFieldMapping)) {
      // For new contacts, include all fields; for updates, only include changed fields
      if (!isNewContact && !changedFields.hasOwnProperty(contactProp)) {
        continue;
      }

      const customField = customFieldsByName.get(systemFieldName);
      if (!customField) {
        continue; // Skip if system field not found in custom_fields table
      }

      const value = contact[contactProp as keyof ContactEntity];
      if (value === null || value === undefined) {
        continue; // Skip null/undefined values
      }

      properties.push({
        id: String(customField.id),
        type: this.mapFieldTypeToPropertyType(customField.fieldType),
        value: this.formatPropertyValue(value, customField.fieldType),
      });
    }

    // Process user custom fields
    for (const [fieldName, value] of Object.entries(userCustomFields)) {
      if (value === null || value === undefined) {
        continue;
      }

      const customField = customFieldsByName.get(fieldName.toUpperCase());
      if (!customField) {
        continue; // Skip if custom field not found
      }

      properties.push({
        id: String(customField.id),
        type: this.mapFieldTypeToPropertyType(customField.fieldType),
        value: this.formatPropertyValue(value, customField.fieldType),
      });
    }

    return properties;
  }

  /**
   * Maps the custom field's fieldType to the simplified type for ClickHouse
   */
  mapFieldTypeToPropertyType(fieldType: string): string {
    switch (fieldType) {
      case 'integer':
      case 'decimal':
        return 'number';
      case 'boolean':
        return 'bool';
      case 'date':
      case 'datetime':
        return 'date';
      case 'text':
      case 'email':
      case 'phone':
      default:
        return 'string';
    }
  }

  /**
   * Formats the value based on the field type for proper ClickHouse storage
   */
  formatPropertyValue(value: any, fieldType: string): any {
    switch (fieldType) {
      case 'boolean':
        return Boolean(value);
      case 'integer':
        return parseInt(value, 10) || 0;
      case 'decimal':
        return parseFloat(value) || 0;
      case 'date':
      case 'datetime':
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      default:
        return String(value);
    }
  }

  parseStringToSql(value: string) {
    if (!value) {
      return null;
    }
    return value.replace("'", '');
  }
}
