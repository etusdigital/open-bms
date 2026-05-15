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
import { applyComparison, assertAllowedClickhouseOperator, assertIsoDate, ConditionAtom, evaluateAtoms, hasSafeOwnProp, safeGetPath, safeOwnProp } from './utils/safe-evaluator';

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
      const evaluators: Array<{ op?: 'and' | 'or'; fn: (contact: any) => boolean | Promise<boolean> }> = [];

      if (stepTrue && stepTrue.settings.length) {
        for (const [index, atomStep] of stepTrue.settings.entries()) {
          const op: 'and' | 'or' | undefined = index > 0 && atomStep.conditional ? (atomStep.conditional == 'and' ? 'and' : 'or') : undefined;

          switch (atomStep.type) {
            case 'interation': {
              const event = String(atomStep.event);
              const conditionalInteration = atomStep.conditional_interation;
              const time = atomStep.time;
              const threshold =
                time != 'all'
                  ? dayjs()
                      .tz(timeZone || 'UTC')
                      .subtract(parseInt(String(time)), 'day')
                      .format('YYYY-MM-DD')
                  : null;
              evaluators.push({
                op,
                fn: (contact: any) => {
                  const value = contact[event];
                  if (time == 'all') {
                    return conditionalInteration == 'yes' ? value != null : value == null;
                  }
                  if (conditionalInteration == 'yes') {
                    return value > threshold;
                  }
                  return value < threshold || !value;
                },
              });
              break;
            }
            case 'tag': {
              loadContacts.add('tags');
              const tagIds: any[] = Array.isArray(atomStep.tag_id) ? atomStep.tag_id : [atomStep.tag_id];
              const wantIn = atomStep.conditional_tag == 'in';
              evaluators.push({
                op,
                fn: (contact: any) => {
                  const tags: any[] = contact.tags || [];
                  const matches = tagIds.filter((x) => tags.includes(x)).length;
                  return wantIn ? matches > 0 : matches == 0;
                },
              });
              break;
            }
            case 'custom_field': {
              loadContacts.add('customFields');
              const op2 = atomStep.conditional_custom_field;
              const fieldId = atomStep.custom_field_id;
              const isCompareFields = atomStep.filter_custom_field == 'compare_fields';
              const rawValue = atomStep.custom_field_value;
              evaluators.push({
                op,
                fn: (contact: any) => {
                  const customFields = contact.customFields || {};
                  if (!hasSafeOwnProp(customFields, String(fieldId))) return false;
                  const lhs = safeOwnProp(customFields, String(fieldId));
                  const rhs = isCompareFields ? (hasSafeOwnProp(customFields, String(rawValue)) ? safeOwnProp(customFields, String(rawValue)) : '') : rawValue;
                  return applyComparison(lhs, op2, rhs);
                },
              });
              break;
            }
            case 'user_field': {
              const userOp = atomStep.conditional_user_field;
              const userKey = atomStep.user_field_key;
              const userValue = atomStep.user_field_value;
              if (userKey === 'created_at_date') {
                if (userOp === '-') {
                  const threshold = dayjs()
                    .tz(timeZone || 'UTC')
                    .subtract(userValue, 'day')
                    .format('YYYY-MM-DD');
                  evaluators.push({ op, fn: (contact: any) => contact.created_at_date >= threshold });
                } else {
                  const isoDate = new Date(userValue).toISOString();
                  evaluators.push({ op, fn: (contact: any) => applyComparison(contact.created_at_date, userOp, isoDate) });
                }
                break;
              }
              if (userKey === 'email_provider') {
                evaluators.push({ op, fn: (contact: any) => applyComparison(contact.email_provider, userOp, userValue) });
                break;
              }
              if (userKey === 'communication_channels') {
                // Original semantics: ` contact.${value} == ${conditionalUserField}` (no quotes),
                // i.e. compare contact[channelKey] to a boolean-like literal expressed as the operator field.
                const expected = userOp === 'true' ? true : userOp === 'false' ? false : userOp;
                evaluators.push({
                  op,
                  fn: (contact: any) => {
                    const channelValue = safeOwnProp(contact, String(userValue));

                    return channelValue == expected;
                  },
                });
                break;
              }
              // Unknown user_field key: surface rather than silent-true
              throw new Error(`Unknown user_field key: ${userKey}`);
            }
            case 'automation': {
              loadContacts.add('contactAutomations');
              const automationIds: any[] = (atomStep.user_field_automation || []).map((a: any) => a.id);
              const compareOp = atomStep.conditional_user_field;
              const days = atomStep.user_field_value;
              const tz = timeZone || 'UTC';
              evaluators.push({
                op,
                fn: (contact: any) => {
                  const list: any[] = contact.contactAutomations || [];
                  const threshold = dayjs().tz(tz).subtract(days, 'day');
                  const matched = list
                    .filter((a) => automationIds.includes(a.automationId))
                    .filter((a) => applyComparison(dayjs(a.createdAt).tz(tz).valueOf(), compareOp, threshold.valueOf()));
                  return matched.length > 0;
                },
              });
              break;
            }
            case 'custom_event': {
              // Calculate time_date for mandatory ClickHouse filter (partitioning)
              let startDate: string;
              if (atomStep.time_type == 'range' || atomStep.time_type == 'date') {
                startDate = assertIsoDate(atomStep.custom_event_date, 'custom_event_date');
              } else {
                startDate = dayjs()
                  .subtract(atomStep.time || 30, 'day')
                  .format('YYYY-MM-DD');
              }

              const eventName = atomStep?.event?.name ? String(atomStep.event.name) : '0';
              const queryParams: Record<string, unknown> = {
                accountId: leadStateMessage.contact.accountId,
                contactId: leadStateMessage.contact.id,
                startDate,
                eventName,
              };

              let eventQuery = `SELECT *\n                FROM events_logs_v2\n                WHERE account_id = {accountId:UInt64}\n                AND time_date >= {startDate:String}\n                AND event = {eventName:String}\n                AND contact_id IS NOT NULL AND contact_id = {contactId:UInt64}`;

              if (atomStep.time_type == 'range') {
                const rangeStart = assertIsoDate(atomStep.custom_event_date, 'custom_event_date');
                const rangeEnd = assertIsoDate(atomStep.custom_event_date_end, 'custom_event_date_end');
                queryParams.rangeStart = rangeStart;
                queryParams.rangeEnd = rangeEnd;
                eventQuery += ` AND time BETWEEN {rangeStart:String} AND {rangeEnd:String}`;
              } else if (atomStep.time_type == 'date') {
                const operator = assertAllowedClickhouseOperator(atomStep.conditional_event_filter);
                const filterDate = assertIsoDate(atomStep.custom_event_date, 'custom_event_date');
                queryParams.filterDate = filterDate;
                eventQuery += ` AND time ${operator} {filterDate:String}`;
              } else {
                const operator = assertAllowedClickhouseOperator(atomStep.conditional_event_filter);
                const filterDate = dayjs().subtract(atomStep.time, 'day').format('YYYY-MM-DD');
                queryParams.filterDate = filterDate;
                eventQuery += ` AND time ${operator} {filterDate:String}`;
              }
              eventQuery += ' LIMIT 1';
              const resultEvent = await this.msgopsService.queryEventsLogs(eventQuery, queryParams);
              const conditionalEvent =
                (atomStep.conditional_event_type == 'in' && resultEvent.length > 0) || (atomStep.conditional_event_type == 'not in' && resultEvent.length == 0);
              evaluators.push({ op, fn: () => conditionalEvent });
              break;
            }
            case 'lead': {
              loadLead = true;
              const leadKey = String(atomStep.lead_field_key);
              const leadOp = atomStep.conditional_lead_field;
              const leadValue = atomStep.lead_field_value;
              evaluators.push({
                op,
                fn: (contact: any) => {
                  const lead = contact.lead;
                  if (!lead) return false;
                  const lhs = safeGetPath(lead, leadKey);
                  return applyComparison(lhs, leadOp, leadValue);
                },
              });
              break;
            }
            default:
              throw new Error(`Unknown conditional atom type: ${atomStep.type}`);
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

      const atoms: ConditionAtom[] = [];
      for (const e of evaluators) {
        atoms.push({ op: e.op, value: Boolean(await e.fn(contact)) });
      }
      const definedConditional = evaluateAtoms(atoms);

      await this.processStepToInternalEvent(leadStateMessage, {
        stepId: step.id,
        stepType: step.type,
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
      // EVO-1193 / H3: do not silently route to false. Emit a tracker event so the
      // operator UI can show "N contacts skipped due to evaluation failure" instead
      // of mis-routing without signal. Current routing (fall through to the false
      // branch) is preserved for backwards compatibility — flipping to throw/DLQ
      // would page on every transient ClickHouse blip until alerting is in place.
      console.log(`Error setting step: STEP: ${step.id} | error: ${error} | AUTOMATION: ${JSON.stringify(leadStateMessage)}`);
      try {
        this.trackerService.send(
          MsgopsEvent.MSGOPS_CONDITIONAL_EVAL_FAILED,
          {
            automation_name: leadStateMessage.automation?.title,
            automation_type: leadStateMessage.automation?.type,
            automation_version: leadStateMessage.automation?.version || '-',
            email: leadStateMessage.contact?.email,
            active_step: step?.id || 0,
            active_step_type: step?.type || 'NOT FOUND',
          },
          leadStateMessage.startedAt,
        );
      } catch (trackerError) {
        console.log(`Failed to emit MSGOPS_CONDITIONAL_EVAL_FAILED: ${trackerError}`);
      }

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
        headers[header.key] = header.value.type === 'custom' ? header.value.id : safeGetPath(leadMessage, String(header.value.id)) || '';
      }

      const payload = {};
      for (const item of step.settings.body) {
        if (step.settings.url.includes('isendme.com') && item.value.id.includes('phone')) {
          const phoneValue = item.value.type === 'custom' ? item.value.id : safeGetPath(leadMessage, String(item.value.id));
          payload[item.key] = (typeof phoneValue === 'string' ? phoneValue.replace('+', '') : phoneValue) || '';
          continue;
        }

        payload[item.key] = item.value.type === 'custom' ? item.value.id : safeGetPath(leadMessage, String(item.value.id)) || '';
        if (item.value.id === 'contact' && payload[item.key] && typeof payload[item.key] === 'object') {
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
