import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { RedisService } from './providers/redis/redis.service';
import { ResultDto } from './dtos/result.dto';

import { ActiveStepsHandler } from './handlers/activesteps.handler';
import { ConditionStep } from './steps/condition.step';
import { QueuePublisher } from './providers/queue/queue.publisher';
import { TrackerService } from './tracker/tracker.service';
import { MsgopsEvent } from './tracker/tracker.interface';
import { EmailPriority, LeadStateMessage, Next, SendEmailMessage, Step, StepType, StatusTestAb, CompressedPayload, CustomFieldKeyType } from './interfaces';

import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { MsgopsService } from './msgops/msgops.service';
import { HttpRequestProvider } from './providers/httpRequest.provider';
import { Redis } from 'ioredis';

dayjs.extend(utc);
dayjs.extend(timezone);
@Injectable()
export class AppService {
  private redisClient: Redis;
  constructor(
    private readonly activeStepsHandler: ActiveStepsHandler,
    private readonly conditionStep: ConditionStep,
    private readonly queuePublisher: QueuePublisher,
    private readonly redisService: RedisService,
    private readonly trackerService: TrackerService,
    private readonly msgopsService: MsgopsService,
    private readonly httpRequestProvider: HttpRequestProvider,
  ) {
    this.redisClient = this.redisService.getOrThrow();
  }

  async getState(): Promise<ResultDto> {
    return { message: 'OK!', status: true };
  }

  async receiveMessage(leadStateMessage: LeadStateMessage, messageId: string, redisKeyDelete: string): Promise<ResultDto> {
    this.trackerService.log('leadStateMessage', leadStateMessage);

    const step = await this.definedStep(leadStateMessage);

    this.trackerService.send(
      MsgopsEvent.MSGOPS_RECEIVED_LEAD,
      {
        automation_name: leadStateMessage.automation.title,
        automation_type: leadStateMessage.automation.type,
        automation_version: leadStateMessage.automation.version || '-',
        email: leadStateMessage.contact.email,
        active_step: step?.id || 0,
        active_step_type: step?.type || 'NOT FOUND',
        message_id: messageId,
      },
      leadStateMessage.startedAt,
    );

    const leadRedisKey = `automation_to_stop:${leadStateMessage.contact.email}:${leadStateMessage.automation.name}:${leadStateMessage.startedAt}`;
    const removeAutomationKey = `automation:${leadStateMessage.automation.id}:remove_contact:${leadStateMessage.contact.id}`;
    const automationTargetKey = `automation_target_contact:${leadStateMessage.contact.id}:${leadStateMessage.id}`;
    // DEL returns the count of keys actually removed; only the first concurrent
    // delivery sees a non-zero value, so the stop branch runs exactly once.
    const deleted = await this.redisClient.del([leadRedisKey, removeAutomationKey, automationTargetKey]);
    if (deleted) {
      const messageErrorProcess = `Automation stopped:  - ${leadStateMessage.automation.title} - ${leadStateMessage.contact.email}`;

      this.trackerService.send(
        MsgopsEvent.MSGOPS_AUTOMATION_STOPPED,
        {
          automation_name: leadStateMessage.automation.title,
          automation_type: leadStateMessage.automation.type,
          automation_version: leadStateMessage.automation.version || '-',
          email: leadStateMessage.contact.email,
          active_step: step?.id || 0,
          active_step_type: step?.type || 'NOT FOUND',
          message_id: messageId,
        },
        leadStateMessage.startedAt,
      );
      return { status: true, message: messageErrorProcess };
    }

    try {
      const result = await this.processMessage(messageId, leadStateMessage, step);
      if (redisKeyDelete) {
        await this.redisClient.del(redisKeyDelete);
      }
      return result;
    } catch (error) {
      console.error(
        `[${messageId}][${leadStateMessage.automation.title}][${step.id}][${leadStateMessage.contact.email}] [${messageId}]
          Message process error ${error.message || JSON.stringify(error)}`,
      );

      throw new BadRequestException(`Message process error ${error.message || JSON.stringify(error)}`, error);
    }
  }

  private async processMessage(messageId: string, leadStateMessage: LeadStateMessage, step: Step) {
    let nextStepMessage: Next;
    if (step.type !== StepType.END) {
      nextStepMessage = this.activeStepsHandler.createNextLeadStateMessage(leadStateMessage, step);
    }
    const compressPayload = {
      automationKey: `automation-${leadStateMessage.automation.id}-${leadStateMessage.contact.id}-${Date.now()}`,
      contactId: leadStateMessage.contact.id,
      automationId: leadStateMessage.automation.id,
      stepId: step?.id || 0,
    };
    switch (step.type) {
      case StepType.EMAIL:
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, messageId: step.settings.id, stepId: step.id, stepType: step.type });
        return await this.executeStepTypeEmail({
          messageId,
          leadStateMessage: leadStateMessage,
          currentStep: step,
          next: nextStepMessage,
          compressPayload,
        });

      case StepType.WEB_PUSH:
      case StepType.MOBILE_PUSH:
        const pubsubMessage = {
          topic: process.env.TOPIC_NAME_SEND_PUSH,
          message: {},
          attrs: { type: 'single' },
        };
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, messageId: step.settings.id, stepId: step.id, stepType: step.type });
        return await this.executeNotificationStep({
          messageId,
          leadStateMessage: leadStateMessage,
          currentStep: step,
          next: nextStepMessage,
          pubsubMessage,
          compressPayload,
        });

      case StepType.SMS:
      case StepType.WHATSAPP:
        const message = {
          topic: step.type == StepType.WHATSAPP ? process.env.TOPIC_NAME_SEND_WHATSAPP : process.env.TOPIC_NAME_SEND_TWILIO,
          message: {},
        };
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, messageId: step.settings.id, stepId: step.id, stepType: step.type });
        return await this.executeNotificationStep({
          messageId,
          leadStateMessage: leadStateMessage,
          currentStep: step,
          next: nextStepMessage,
          pubsubMessage: message,
          compressPayload,
        });

      case StepType.WAIT:
        const taskMessage = { ...nextStepMessage.data };
        const rawTimer = Number(step.settings.timer);
        if (!Number.isFinite(rawTimer) || rawTimer < 0) {
          throw new BadRequestException(`[${messageId}] Invalid wait-step timer: ${step.settings.timer}`);
        }
        const minutes = step.settings.timerType == 'hours' ? rawTimer * 60 : rawTimer;
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, minutes, stepId: step.id, stepType: step.type });
        return await this.scheduleDelayedStep(leadStateMessage, step, taskMessage, minutes, messageId);

      case StepType.ADD_TAG:
      case StepType.REMOVE_TAG:
        const type = step.type === StepType.ADD_TAG ? 'add' : 'remove';
        if (Array.isArray(step.settings)) {
          await this.processStepToInternalEvent(leadStateMessage, { tags: JSON.stringify(step.settings), stepId: step.id, stepType: step.type });
          await Promise.all(
            step.settings.map(async (tag) => {
              await this.processTag(type, tag.name, leadStateMessage);
            }),
          );
        } else {
          await this.processStepToInternalEvent(leadStateMessage, { tags: JSON.stringify([step.settings]), stepId: step.id, stepType: step.type });
          await this.processTag(type, step.settings.name, leadStateMessage);
        }
        return await this.queuePublisher.sendAsyncMessage(nextStepMessage.pubName, nextStepMessage.data, compressPayload);

      case StepType.CONDITIONAL_TIME:
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, stepId: step.id, stepType: step.type });
        return await this.conditionStep.processConditionalTime(messageId, leadStateMessage, nextStepMessage, step, compressPayload);

      case StepType.CONDITIONAL:
        return await this.queuePublisher.sendAsyncMessage(nextStepMessage.pubName, nextStepMessage.data, compressPayload);

      case StepType.SPLIT:
        return await this.queuePublisher.sendAsyncMessage(nextStepMessage.pubName, nextStepMessage.data, compressPayload);

      case StepType.TESTAB:
        return await this.queuePublisher.sendAsyncMessage(nextStepMessage.pubName, nextStepMessage.data, compressPayload);

      case StepType.RANDOM_MESSAGE:
        step = await this.selectRandomMessage(step, leadStateMessage);
        return await this.executeStepTypeEmail({
          messageId,
          leadStateMessage: leadStateMessage,
          currentStep: step,
          next: nextStepMessage,
          compressPayload,
        });

      case StepType.RANDOM_MOBILE_PUSH:
      case StepType.RANDOM_WEB_PUSH: {
        step = await this.selectRandomMessage(step, leadStateMessage);
        const pubsubMessage = {
          topic: process.env.TOPIC_NAME_SEND_PUSH,
          message: {},
          attrs: { type: 'single' },
        };
        return await this.executeNotificationStep({
          messageId,
          leadStateMessage: leadStateMessage,
          currentStep: step,
          next: nextStepMessage,
          pubsubMessage,
          compressPayload,
        });
      }

      case StepType.REMOVE_AUTOMATION:
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, stepId: step.id, stepType: step.type });
        await this.removeAutomation(leadStateMessage, step);
        return await this.queuePublisher.sendAsyncMessage(nextStepMessage.pubName, nextStepMessage.data, compressPayload);

      case StepType.CONTACT_TRANSFER:
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, stepId: step.id, stepType: step.type });
        await this.contactTransfer(leadStateMessage, step);
        return await this.queuePublisher.sendAsyncMessage(nextStepMessage.pubName, nextStepMessage.data, compressPayload);

      case StepType.UPDATE_CUSTOM_FIELD:
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, stepId: step.id, stepType: step.type });
        await this.updateCustomField(leadStateMessage, step);
        return await this.queuePublisher.sendAsyncMessage(nextStepMessage.pubName, nextStepMessage.data, compressPayload);

      case StepType.HTTP_REQUEST:
        await this.queuePublisher.sendAsyncMessage(nextStepMessage.pubName, nextStepMessage.data, compressPayload);
        leadStateMessage.automation.steps = [step];
        await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, stepId: step.id, stepType: step.type });
        return await this.queuePublisher.sendAsyncMessage(process.env.TOPIC_NAME_HTTP_REQUEST, leadStateMessage, null);

      case StepType.END:
        await this.processStepToInternalEvent(leadStateMessage, { stepId: step.id || 0, stepType: step.type });
        await this.processTag('completed', leadStateMessage.tagName, leadStateMessage);
        return {
          status: true,
          message: 'Executed stype type end with success.',
        };
    }
  }

  private async selectRandomMessage(step: Step, leadStateMessage: LeadStateMessage): Promise<Step> {
    try {
      const randomIndex = Math.floor(Math.random() * step.settings.messages.length);
      await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, stepId: step.id, stepType: step.type, randomIndex });
      step.settings = step.settings.messages[randomIndex];
      return step;
    } catch {
      throw new BadRequestException(`[${leadStateMessage.id}] : Error setting redis key for remove automation.`);
    }
  }

  async removeAutomation(leadStateMessage: LeadStateMessage, step: Step): Promise<any> {
    try {
      for (const automation of step.settings?.automations) {
        await this.redisClient.set(`automation:${automation.id}:remove_contact:${leadStateMessage.contact?.id}`, 'true', 'EX', 43200);
      }
    } catch {
      throw new BadRequestException(`[${leadStateMessage.id}] : Error setting redis key for remove automation.`);
    }
  }

  private async contactTransfer(leadStateMessage: LeadStateMessage, step: Step) {
    const contact = await this.msgopsService.findContactById(leadStateMessage.contact.id, leadStateMessage.contact.accountId, ['customFields'], CustomFieldKeyType.NAME);
    if (!contact) {
      throw new BadRequestException(`[${leadStateMessage.id}] Contact not found.`);
    }
    const headers = { 'Content-Type': 'application/json' };
    delete contact.id;
    delete contact.accountId;
    delete contact.uuid;
    delete contact.has_web_push;
    delete contact.has_mobile_push;
    const payload = {
      contact,
      tagName: step.settings.tagName,
      apiKey: step.settings.apiKey,
      accountChange: {
        accountFrom: leadStateMessage.account.id,
        accountTo: step.settings.accountId,
      },
    };

    return await this.httpRequestProvider.process('post', process.env.CONTACT_TRANSFER_URL, headers, payload);
  }

  private async processTag(typeTag: string, tagName: string, leadStateMessage: LeadStateMessage): Promise<any> {
    try {
      const messageBody = {
        type: typeTag,
        tagName,
        id: leadStateMessage.id,
        contact: { id: leadStateMessage.contact.id, uuid: leadStateMessage.contact.uuid, email: leadStateMessage.contact.email },
        automation: { id: leadStateMessage.automation.id, name: leadStateMessage.automation.name },
        account: { id: leadStateMessage.account.id, accountConfigs: leadStateMessage.account.accountConfigs },
        startedAt: Date.now(),
        leadId: leadStateMessage.leadId,
        isLeadFromAnotherAutomation: true,
      };

      return await this.queuePublisher.sendAsyncMessage(process.env.TOPIC_NAME_TAG_PROCESS, messageBody);
    } catch (error) {
      this.processMessageCatchError(error);
    }
  }

  private async scheduleDelayedStep(leadStateMessage: LeadStateMessage, step: Step, taskMessage: LeadStateMessage, waitFor: number, messageId: string) {
    try {
      const job = await this.queuePublisher.scheduleDelayedStep(taskMessage, waitFor, step.type);

      this.trackerService.send(
        MsgopsEvent.MSGOPS_CREATED_CLOUD_TASK,
        {
          automation_name: leadStateMessage.automation.title,
          automation_type: leadStateMessage.automation.type,
          automation_version: leadStateMessage.automation.version || '-',
          email: leadStateMessage.contact.email,
          active_step: leadStateMessage.activeStepId,
          active_step_type: step.type,
          message_id: messageId,
          cloud_task_id: String(job.id),
        },
        leadStateMessage.startedAt,
      );

      return String(job.id);
    } catch (error) {
      console.log(`PAYLOAD ERROR: ${JSON.stringify(leadStateMessage)}`);
      throw new BadRequestException(`[${messageId}] Error scheduling delayed step. ${error}`, error);
    }
  }

  private async executeStepTypeEmail({
    messageId,
    leadStateMessage,
    currentStep,
    next,
    compressPayload,
  }: {
    messageId: string;
    leadStateMessage: LeadStateMessage;
    currentStep: Step;
    next: Next;
    compressPayload: CompressedPayload;
  }): Promise<any> {
    const sendEmailMessage = await this.parseleadStateMessageToSendEmailMessage(leadStateMessage, currentStep, next);
    let message = {
      topic: process.env.TOPIC_NAME_SEND_EMAIL,
      message: sendEmailMessage,
      attrs: { priority: EmailPriority.NORMAL },
    };

    try {
      return this.queuePublisher.sendAsyncMessage(message.topic, message.message, compressPayload, message.attrs);
    } catch (error) {
      throw new BadRequestException(`[${messageId}] Error to send message to ${message.topic}`, error);
    }
  }

  private async executeNotificationStep({
    messageId,
    leadStateMessage,
    currentStep,
    next,
    pubsubMessage,
    compressPayload,
  }: {
    messageId: string;
    leadStateMessage: LeadStateMessage;
    currentStep: Step;
    next: Next;
    pubsubMessage: any;
    compressPayload: CompressedPayload;
  }): Promise<any> {
    pubsubMessage.message = await this.parseleadStateMessageToSendNotification(leadStateMessage, currentStep, next);
    try {
      return this.queuePublisher.sendAsyncMessage(pubsubMessage.topic, pubsubMessage.message, compressPayload, pubsubMessage.attrs || {});
    } catch (error) {
      throw new BadRequestException(`[${messageId}] Error to send message to ${pubsubMessage.topic}`, error);
    }
  }

  private async definedStep(leadStateMessage: LeadStateMessage) {
    const {
      automation: { steps },
    } = leadStateMessage;

    const step = steps.length ? steps[0] : null;
    if (step) {
      switch (step.type) {
        case StepType.SPLIT:
          const randomNumber = Math.floor(Math.random() * 101);
          await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, stepId: step.id, stepType: step.type, randomPercentage: randomNumber });
          let percentage = 0;
          for (let i = 0; i < step.child.length; i++) {
            percentage += step.child[i].settings.value;
            if (randomNumber <= percentage) {
              step.child = step.child[i].child;
              break;
            }
          }
          break;

        case StepType.CONDITIONAL:
          step.child = await this.definedConditional(step, leadStateMessage);
          break;

        case StepType.TESTAB:
          step.child = await this.definedTestAB(step, leadStateMessage);
          break;
      }
    }
    return step;
  }

  private async definedConditional(step: Step, leadStateMessage: LeadStateMessage) {
    try {
      const timeZone = leadStateMessage.account?.accountConfigs?.time_zone;
      const stepTrue = step.child.find((item) => item.type === 'conditionalTrue');

      const loadContacts = new Set();
      let loadLead = false;
      let logic = '';
      if (stepTrue && stepTrue.settings.length) {
        for (const [index, step] of stepTrue.settings.entries()) {
          if (index > 0 && step.conditional) {
            logic += step.conditional == 'and' ? ' && ' : ' || ';
          }
          switch (step.type) {
            case 'interation':
              let timeFilter = `${step.conditional_interation == 'yes' ? ' != null ' : ' == null '}`;
              if (step.time != 'all') {
                timeFilter =
                  step.conditional_interation == 'yes'
                    ? ` > (dayjs().tz('${timeZone || 'UTC'}').subtract(parseInt('${step.time}'), 'day').format('YYYY-MM-DD'))`
                    : ` < ((dayjs().tz('${timeZone || 'UTC'}').subtract(parseInt('${step.time}'), 'day').format('YYYY-MM-DD')) || !contact.${step.event})`;
              }
              logic += ` contact.${step.event}${timeFilter} `;
              break;
            case 'tag':
              loadContacts.add('tags');
              const conditionalTag = step.conditional_tag == 'in' ? ' > 0' : ' == 0 ';
              logic += ` ([${step.tag_id}].filter(x => contact.tags.includes(x))).length ${conditionalTag} `;
              break;
            case 'custom_field':
              loadContacts.add('customFields');
              const conditionalField = step.conditional_custom_field === '=' ? '==' : step.conditional_custom_field;
              if (step.filter_custom_field && step.filter_custom_field == 'compare_fields') {
                step.custom_field_value = `(contact.customFields.hasOwnProperty(${step.custom_field_value}) ? contact.customFields[${step.custom_field_value}] : '')`;
              } else {
                step.custom_field_value = `'${step.custom_field_value}'`;
              }
              if (step.conditional_custom_field == 'iLike') {
                logic += ` (contact.customFields.hasOwnProperty(${step.custom_field_id})
                && contact.customFields[${step.custom_field_id}].includes(${step.custom_field_value})) `;
                break;
              }
              logic += ` (contact.customFields.hasOwnProperty(${step.custom_field_id})
                && contact.customFields[${step.custom_field_id}] ${conditionalField} ${step.custom_field_value}) `;
              break;
            case 'user_field':
              const conditionalUser = step.conditional_user_field === '=' ? '==' : step.conditional_user_field;
              if (step.user_field_key === 'created_at_date') {
                if (step.conditional_user_field === '-') {
                  logic += ` contact.created_at_date >= (dayjs().tz('${timeZone || 'UTC'}').subtract(${step.user_field_value}, 'day').format('YYYY-MM-DD')) `;
                  break;
                }
                const date = new Date(step.user_field_value).toISOString();
                logic += ` contact.created_at_date ${conditionalUser} '${date}' `;
                break;
              }
              if (step.user_field_key === 'email_provider') {
                logic += ` contact.email_provider ${conditionalUser} '${step.user_field_value}' `;
                break;
              }
              if (step.user_field_key === 'communication_channels') {
                logic += ` contact.${step.user_field_value} == ${step.conditional_user_field}`;
                break;
              }
              break;
            case 'automation':
              loadContacts.add('contactAutomations');
              const automationsIds = step.user_field_automation.map((automation) => {
                return automation.id;
              });
              logic += ` contact.contactAutomations.filter((automation) => [${automationsIds}].includes(automation.automationId))
                    .filter((automationFilter) => dayjs(automationFilter.createdAt).tz('${timeZone || 'UTC'}') 
                    ${step.conditional_user_field} (dayjs().tz('${timeZone || 'UTC'}').subtract(${step.user_field_value}, 'day'))).length`;
              break;
            case 'custom_event':
              // Calculate time_date for mandatory ClickHouse filter (partitioning)
              const today = dayjs().format('YYYY-MM-DD');
              let startDate = today;

              if (step.time_type == 'range' || step.time_type == 'date') {
                startDate = step.custom_event_date;
              } else {
                startDate = dayjs()
                  .subtract(step.time || 30, 'day')
                  .format('YYYY-MM-DD');
              }

              let eventQuery = `SELECT *
                FROM events_logs_v2
                WHERE account_id = ${leadStateMessage.contact.accountId}
                AND time_date >= '${startDate}'
                AND event = '${step?.event?.name || 0}'
                AND contact_id IS NOT NULL AND contact_id = ${leadStateMessage.contact.id}`;
              if (step.time_type == 'range') {
                eventQuery += ` AND time BETWEEN '${step.custom_event_date}' AND '${step.custom_event_date_end}'`;
              } else if (step.time_type == 'date') {
                eventQuery += ` AND time ${step.conditional_event_filter} '${step.custom_event_date}'`;
              } else {
                eventQuery += ` AND time ${step.conditional_event_filter} '${dayjs().subtract(step.time, 'day').format('YYYY-MM-DD')}'`;
              }
              eventQuery += ' LIMIT 1';
              const resultEvent = await this.msgopsService.queryEventsLogs(eventQuery);
              const conditionalEvent = (step.conditional_event_type == 'in' && resultEvent.length > 0) || (step.conditional_event_type == 'not in' && resultEvent.length == 0);
              logic += ` ${conditionalEvent}`;
              break;
            case 'lead':
              loadLead = true;
              const conditionalLead = step.conditional_lead_field === '=' ? '==' : step.conditional_lead_field;
              logic += ` contact['lead'].${step.lead_field_key} ${conditionalLead} '${step.lead_field_value}'`;
              break;
          }
        }
      }

      const contact = await this.msgopsService.findContactById(leadStateMessage.contact.id, leadStateMessage.contact.accountId, loadContacts);
      if (!contact) {
        throw new BadRequestException(`[${leadStateMessage.id}] Contact not found.`);
      }

      if (loadLead) {
        const lead = await this.msgopsService.findLeadById(leadStateMessage.leadId);
        if (lead) {
          contact['lead'] = lead;
        }
      }

      const definedConditional = eval(logic);
      await this.processStepToInternalEvent(leadStateMessage, {
        stepId: step.id,
        stepType: step.type,
        logic: logic,
        resultLogic: definedConditional,
        contactInfo: contact,
        stepConfig: step.settings,
      });
      if (definedConditional) {
        return stepTrue?.child || null;
      } else {
        const stepFalse = step.child.find((item) => item.type === 'conditionalFalse');
        return stepFalse?.child || null;
      }
    } catch (error) {
      console.log(`Error setting step: STEP: ${step.id} | error: ${error} | AUTOMATION: ${JSON.stringify(leadStateMessage)}`);

      const stepFalse = step.child.find((item) => item.type === 'conditionalFalse');
      return stepFalse?.child || null;
    }
  }

  private async parseleadStateMessageToSendEmailMessage(leadStateMessage: LeadStateMessage, currentStep: Step, next: Next): Promise<SendEmailMessage> {
    const {
      automation: { id, title, type, name, isRateLimit },
      contact,
      startedAt,
    } = leadStateMessage;

    const emailId = leadStateMessage?.activeEmailId || 1;
    if (emailId === 1 && leadStateMessage.messageIdEmail1 && leadStateMessage.account.id == 1 && [214153, 214134, 210856].includes(currentStep.settings.id)) {
      currentStep.settings.id = leadStateMessage.messageIdEmail1;
      console.log(`REPLACE MESSAGE 1 TO: ${leadStateMessage.messageIdEmail1} - LEAD: ${leadStateMessage.leadId} - EMAIL: ${leadStateMessage.contact.email}`);
    }
    next.data.activeEmailId = emailId + 1;
    const message = await this.msgopsService.getMessageById(currentStep.settings.id);
    delete message.content;
    const utmCampaign = `${name}_e${emailId}_${message.id}`;

    return {
      startedAt: startedAt,
      automationId: id,
      automationName: title,
      automationType: type,
      isRateLimit,
      utmCampaign,
      utmContent: leadStateMessage.automation.title,
      emailId: currentStep.settings.id,
      contact: {
        ...contact,
      },
      message: {
        ...message,
        ...(currentStep.isTestabMode ? { isTestabMode: true } : {}),
      },
      account: leadStateMessage.account,
      next,
    };
  }

  private async parseleadStateMessageToSendNotification(leadStateMessage: LeadStateMessage, currentStep: Step, next: Next): Promise<SendEmailMessage> {
    const {
      automation: { id, title, type, name },
      contact,
      startedAt,
    } = leadStateMessage;

    const message = await this.msgopsService.getMessageById(currentStep.settings.id);
    const utmCampaign = `${name}_${message.id}`;

    return {
      startedAt: startedAt,
      automationId: id,
      automationName: title,
      automationType: type,
      utmCampaign,
      utmContent: leadStateMessage.automation.title,
      emailId: currentStep.settings.id,
      contact: {
        ...contact,
      },
      message: {
        ...message,
      },
      account: leadStateMessage.account,
      next,
    };
  }

  private async definedTestAB(step: Step, leadStateMessage: LeadStateMessage) {
    let randomItem = Math.floor(Math.random() * step.settings.messages.length);
    await this.processStepToInternalEvent(leadStateMessage, { ...step.settings, stepId: step.id, stepType: step.type, randomIndex: randomItem });
    let isTestabMode = false;
    if (step.settings.status === StatusTestAb.FINISHED) {
      randomItem = step.settings.messages.findIndex((message) => {
        return message.winnerMessage === true;
      });
    } else {
      const winnerMessageId = await this.redisClient.get(`automation_testab_step_finished_${leadStateMessage.automation.id}_${step.id}`);
      if (winnerMessageId) {
        randomItem = step.settings.messages.findIndex((message) => {
          return message.id == winnerMessageId;
        });
      } else {
        isTestabMode = true;
        const stepRedisKey = `automation_testab_step:${leadStateMessage.automation.id}:${step.id}`;
        if (!(await this.redisClient.exists(stepRedisKey))) {
          await this.redisClient.set(stepRedisKey, new Date().toString());
          await this.queuePublisher.sendAsyncMessage(process.env.TOPIC_NAME_API_STEP_PROCESS, { ...step, automationId: leadStateMessage.automation.id, child: [] }, null);
        }
      }
    }
    const randomMessage = step.settings.messages[randomItem];
    if (!randomMessage) {
      return step.child;
    }
    const newChild = [
      {
        id: step.id,
        type: 'email',
        child: step.child,
        isTestabMode,
        settings: {
          id: randomMessage.id,
          name: randomMessage.name,
          title: randomMessage.title,
          subject: randomMessage.subject,
        },
      },
    ];
    return newChild;
  }

  private async updateCustomField(leadStateMessage: LeadStateMessage, step: Step) {
    return await this.msgopsService.createOrUpdateCustomFields([
      {
        accountId: leadStateMessage.contact.accountId,
        contactId: leadStateMessage.contact.id,
        customFieldId: step.settings.customFieldSelected.id,
        value: step.settings.customFieldValue,
      },
    ]);
  }

  async processHttpRequest(leadStateMessage: LeadStateMessage) {
    const step = leadStateMessage.automation.steps[0];
    try {
      const contact = await this.msgopsService.findContactById(leadStateMessage.contact.id, leadStateMessage.contact.accountId, ['customFields']);
      if (!contact) {
        throw new BadRequestException(`[${leadStateMessage.id}] Contact not found.`);
      }
      const leadMessage = JSON.parse(JSON.stringify(leadStateMessage));
      leadMessage.contact = contact;
      leadMessage.step = step;

      const headers = {};
      for (const header of step.settings.headers) {
        headers[header.key] = header.value.type === 'custom' ? header.value.id : eval(`leadMessage.${header.value.id}`) || '';
      }

      const payload = {};
      for (const item of step.settings.body) {
        if (step.settings.url.includes('isendme.com') && item.value.id.includes('phone')) {
          payload[item.key] = item.value.type === 'custom' ? item.value.id : eval(`leadMessage.${item.value.id}`).replace('+', '') || '';
          continue;
        }

        payload[item.key] = item.value.type === 'custom' ? item.value.id : eval(`leadMessage.${item.value.id}`) || '';
        if (item.value.id === 'contact') {
          delete payload[item.key]['id'];
          delete payload[item.key]['uuid'];
          delete payload[item.key]['accountId'];
        }
      }

      await this.httpRequestProvider.process(step.settings.operation, step.settings.url, headers, payload);
    } catch (error) {
      if (step.settings.retry) {
        throw new InternalServerErrorException(`[RETRY] - Error http request step: ${JSON.stringify(error)}`);
      }
      return true;
    }
  }

  private processMessageCatchError(error: any) {
    throw new BadRequestException('Message process error', error);
  }

  async getRedis(redisKey) {
    const originalPayload: LeadStateMessage = await this.redisClient.get(redisKey).then((payload) => {
      if (payload) {
        return JSON.parse(payload);
      }
    });

    return originalPayload;
  }

  async processStepToInternalEvent(leadStateMessage: LeadStateMessage, properties) {
    try {
      await this.queuePublisher.sendInternalEvent({
        timestamp: Date.now(),
        event: 'step',
        contactId: leadStateMessage.contact.id,
        email: leadStateMessage.contact.email,
        uuid: leadStateMessage.contact.uuid,
        accountId: leadStateMessage.account.id,
        automationId: leadStateMessage.automation.id,
        properties,
        ...(properties && properties.messageId ? { messageId: properties.messageId } : {}),
      });
    } catch (e) {
      console.log('ERRO TO PROCESS INTERNAL EVENT: ', e);
      return true;
    }
  }
}
