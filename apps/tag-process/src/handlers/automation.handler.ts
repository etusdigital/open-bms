import { Injectable } from '@nestjs/common';

import { QueuePublisher } from '../providers/queue/queue.publisher';
import { EventsTrigger, LeadMessage, TriggerType } from '../interfaces';
import { TrackerService } from '../tracker/tracker.service';
import { MsgopsEvent } from '../tracker/tracker.interface';
import { Status } from '../interfaces';
import { MsgopsService } from '../msgops/msgops.service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { AutomationEntity } from 'src/msgops/entities/automation.entity';
import { ContactAutomationEntity } from 'src/msgops/entities/contact-automation.entity';
import { ContactEntity } from 'src/msgops/entities/contact.entity';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AutomationHandler {
  constructor(
    private readonly msgOpsService: MsgopsService,
    private readonly queuePublisher: QueuePublisher,
    private readonly trackerService: TrackerService,
  ) {}

  async addTagAndStartAutomation(leadMessage: LeadMessage): Promise<any> {
    leadMessage.startedAt = Date.now();

    const contact = await this.msgOpsService.findContactById(leadMessage.contact.id, leadMessage.account.id);
    if (!contact) {
      this.trackerService.logInfo(`[automation] Contact not found: ${JSON.stringify(leadMessage.contact)}`);
      return;
    }

    let automations: AutomationEntity[] = [];

    if (leadMessage.tagName) {
      const tag = await this.msgOpsService.getTagByName(leadMessage.tagName, leadMessage.account.id);
      if (!tag) {
        this.trackerService.logInfo(`[add tag] Tag not found ${leadMessage.tagName} - ${contact.id}`);
        return { status: 200 };
      }

      try {
        await this.msgOpsService.createContactTag(contact.id, tag.id, tag.accountId);

        const attributesClickHouse = this.getAttributesClickHouse(leadMessage);
        await this.queuePublisher.publishAnalyticsEvent({
          timestamp: Date.now(),
          event: 'tag-in',
          accountId: tag.accountId,
          contactId: contact.id,
          uuid: contact.uuid,
          email: contact.email,
          properties: { ...attributesClickHouse, tagId: tag.id, tagName: tag.name },
        });
      } catch (error) {
        console.error(error);
        throw `[add tag] Error to save contacts_tags(${contact.id}, ${tag.id}}): ${error.message}`;
      }

      if (leadMessage.hasOwnProperty('startAutomation') && leadMessage.startAutomation === false) {
        return { status: 200 };
      }

      automations = await this.msgOpsService.getAutomationsByTag(tag.id, contact.accountId);
    }

    if (automations.length === 0 && (leadMessage.webPush || leadMessage.mobilePush)) {
      automations = await this.msgOpsService.getAutomationsByPush(
        contact.accountId,
        leadMessage.webPush ? 'web-push' : 'mobile-push',
      );
    }

    if (!automations.length) {
      this.trackerService.logInfo(`[add tag] Tag and push ${leadMessage.tagName} - ${contact.id}`);
      this.trackerService.send(
        MsgopsEvent.MSGOPS_AUDIENCE_NOT_FOUND,
        {
          workflow_name: leadMessage.tagName,
          email: contact.email,
          workflow_type: 'email',
        },
        leadMessage.startedAt,
      );

      return { status: 200 };
    }

    return this.startAutomation(automations, leadMessage, contact, dayjs);
  }

  async eventsTrigger(event: EventsTrigger): Promise<any> {
    this.trackerService.logInfo(`[EVENTS TRIGGER] - ${JSON.stringify(event)}`);
    const leadMessage = { startedAt: Date.now() } as LeadMessage;

    let contact: ContactEntity;
    if (event.uuid) {
      const contactByUuid = await this.msgOpsService.findContactByUuid(event.uuid, event.accountId);
      if (!contactByUuid) {
        this.trackerService.logInfo(`[automation-event-uuid] Contact not found: ${JSON.stringify(leadMessage)}`);
        return { status: 200 };
      }
      event.contactId = contactByUuid.id;
    }

    if (event.contactId && event.contactId !== 'undefined') {
      contact = await this.msgOpsService.findContactById(event.contactId as number, event.accountId);
    }

    if (!contact) {
      console.error(`[EVENTS TRIGGER] Contact not found: ${JSON.stringify(event)}`);
      return { status: 200 };
    }

    const filterId = event.messageId || event.messageId == 0 ? event.messageId : event.eventId;
    const automations = event.isTriggerCampaign
      ? await this.msgOpsService.getCampaignsByEvent(contact.accountId, event.event, filterId)
      : await this.msgOpsService.getAutomationsByEvent(contact.accountId, event.event, filterId);

    if (!automations.length) {
      this.trackerService.logInfo(`[events trigger] Automation not found for ${event.event} - ${event.messageId}`);
      return { status: 200 };
    }

    return this.startAutomation(automations, { ...leadMessage, contact: contact }, contact, dayjs);
  }

  async startAutomation(
    automations: AutomationEntity[],
    leadMessage: LeadMessage,
    contact: ContactEntity,
    dayjs,
  ): Promise<any> {
    await Promise.all(
      automations.map(async (automation) => {
        const isValidConditional = await this.definedConditional(
          automation.triggers.settings.conditional,
          leadMessage,
          automation,
          dayjs,
        );
        if (!isValidConditional) {
          return false;
        }
        const account = JSON.parse(JSON.stringify(automation.account));
        delete automation.account;
        const leadMessageCopy = {
          ...leadMessage,
          automation: automation,
          account: account,
          contact: contact,
        };

        const contactAutomations = {
          contactId: contact.id,
          accountId: contact.accountId,
          automationType: automation.type,
          automationId: automation.id,
          automationTitle: automation.title,
        };

        if (automation.triggers.settings.applyFrequency === TriggerType.UNIQUE) {
          const contactAutomation = await this.msgOpsService.getFirstContactAutomations(
            contact.id,
            automation.id,
            contact.accountId,
          );

          if (contactAutomation) {
            await this.updateLead(
              leadMessage.leadId,
              {
                automationId: automation.id,
                automationTitle: automation.title,
                automationStatus: Status.duplicate,
              },
              leadMessage.isLeadFromAnotherAutomation,
            );

            await this.queuePublisher.publishAnalyticsEvent({
              timestamp: Date.now(),
              event: `automation-${Status.duplicate}`,
              automationId: automation.id,
              accountId: contact.accountId,
              contactId: contact.id,
              uuid: contact.uuid,
              email: contact.email,
              properties: {
                reason: 'automation set to unique',
                automationId: automation.id,
                automationName: automation.name,
              },
            });
            return { status: 401 };
          }
        }

        const automationRunning = await this.msgOpsService.getContactAutomations(
          contact.id,
          automation.id,
          contact.accountId,
          ['running', 'completed'],
        );

        if (automationRunning) {
          if (automation.triggers.settings.applyFrequency === TriggerType.MULTIPLY_PERIOD) {
            const parseCreatedAt = Date.parse(`${automationRunning.createdAt}`);

            if ((leadMessageCopy.startedAt - parseCreatedAt) / 60000 < automation.triggers.settings.timePeriod) {
              this.trackerService.logInfo(
                `[automation] automation is duplicated: ${automation.id} - ${automationRunning.id}`,
              );
              await this.updateLead(
                leadMessage.leadId,
                {
                  automationId: automation.id,
                  automationTitle: automation.title,
                  automationStatus: Status.duplicate,
                },
                leadMessage.isLeadFromAnotherAutomation,
              );

              await this.queuePublisher.publishAnalyticsEvent({
                timestamp: Date.now(),
                event: `automation-${Status.duplicate}`,
                automationId: automation.id,
                accountId: contact.accountId,
                contactId: contact.id,
                uuid: contact.uuid,
                email: contact.email,
                properties: {
                  reason: 'automation running under time period',
                  automationId: automation.id,
                  automationName: automation.name,
                },
              });
              return this.msgOpsService.createContactAutomations({ ...contactAutomations, status: Status.duplicate });
            }
          }

          if (automationRunning.status === 'running') {
            await this.queuePublisher.publishAnalyticsEvent({
              timestamp: Date.now(),
              event: `automation-${Status.canceled}`,
              automationId: automation.id,
              accountId: contact.accountId,
              contactId: contact.id,
              uuid: contact.uuid,
              email: contact.email,
              properties: {
                reason: 'starting another automation',
                automationId: automation.id,
                automationName: automation.name,
              },
            });

            this.updateCancelAutomationRunning(automationRunning, automation.id, automation.title, leadMessageCopy);
          }
        }

        const newAutomationRunning = await this.msgOpsService.createContactAutomations({
          ...contactAutomations,
          status: Status.running,
        });
        await this.updateLead(
          leadMessage.leadId,
          {
            automationId: automation.id,
            automationTitle: automation.title,
            automationStatus: Status.started,
          },
          leadMessage.isLeadFromAnotherAutomation,
        );
        if (newAutomationRunning.generatedMaps && newAutomationRunning.generatedMaps.length) {
          leadMessageCopy.id = newAutomationRunning.generatedMaps[0].id;
          leadMessageCopy.startedAt = Date.parse(`${newAutomationRunning.generatedMaps[0].createdAt}`);
        }

        await this.queuePublisher.publishAnalyticsEvent({
          timestamp: Date.now(),
          event: `automation-${Status.started}`,
          automationId: automation.id,
          accountId: contact.accountId,
          contactId: contact.id,
          uuid: contact.uuid,
          email: contact.email,
          properties: { reason: 'automation-started', automationId: automation.id, automationName: automation.name },
        });

        this.trackerService.send(
          MsgopsEvent.MSGOPS_LEAD_ENTRY,
          {
            workflow_name: automation.title,
            email: contact.email,
            workflow_type: 'email',
          },
          leadMessageCopy.startedAt,
        );

        try {
          const accountTimeZone = account?.accountConfigs?.time_zone || 'UTC';
          await this.msgOpsService.updateContact(contact, {
            lastAutomation: new Date(),
            lastAutomationDate: dayjs().tz(accountTimeZone).toDate(),
            ...(automation.verticalType ? { lastVerticalType: automation.verticalType } : {}),
          });
        } catch (error) {
          console.error(error);
          throw `[automation] Error parseLeadStateMessage: ${error.message}`;
        }
      }),
    );
  }

  async updateLead(
    leadId: number,
    fields: { automationId: number; automationTitle: string; automationStatus: string },
    isLeadFromAnotherAutomation: boolean,
  ) {
    if (leadId && !isLeadFromAnotherAutomation) {
      await this.msgOpsService.updateLead(leadId, fields);
    }
  }

  async cancelRunningAutomation(leadMessage: LeadMessage, removeTag: boolean) {
    const { contact } = leadMessage;
    const tag = await this.msgOpsService.getTagByName(leadMessage.tagName, leadMessage.account.id);
    if (!tag) {
      this.trackerService.logInfo(`[remove tag] Tag not found ${leadMessage.tagName} - ${leadMessage.contact}`);
      return { status: 200 };
    }

    if (removeTag) {
      await this.msgOpsService.deleteContactTag(contact.id, tag.id, tag.accountId);
      await this.queuePublisher.publishAnalyticsEvent({
        timestamp: Date.now(),
        event: 'tag-out',
        accountId: tag.accountId,
        contactId: contact.id,
        uuid: contact.uuid,
        email: contact.email,
        properties: { location: 'automation', tagId: tag.id, tagName: tag.name },
      });
    }

    const automations = await this.msgOpsService.getAutomationsByTag(tag.id, tag.accountId);
    const automation = automations.find((automation) => automation.id);
    if (!automation) {
      this.trackerService.logInfo(`[remove tag] Automation not found for tag: ${leadMessage.tagName}`);
      return automations;
    }

    const automationRunning = await this.msgOpsService.getContactAutomations(contact.id, automation.id, tag.accountId, [
      'running',
    ]);

    if (automationRunning) {
      await this.queuePublisher.publishAnalyticsEvent({
        timestamp: Date.now(),
        event: `automation-${Status.canceled}`,
        automationId: automation.id,
        accountId: tag.accountId,
        contactId: contact.id,
        uuid: contact.uuid,
        email: contact.email,
        properties: { reason: 'tag-out', automationId: automation.id, automationName: automation.name },
      });

      return await this.updateCancelAutomationRunning(automationRunning, automation.id, automation.title, leadMessage);
    }
  }

  async updateCancelAutomationRunning(
    automationRunning: ContactAutomationEntity,
    automationId: number,
    automationTitle: string,
    leadMessage: LeadMessage,
  ) {
    return this.msgOpsService.updateContactAutomations(
      automationRunning,
      {
        automationId,
        automationTitle,
        status: Status.canceled,
      },
      leadMessage,
    );
  }

  getAttributesClickHouse(leadMessage: LeadMessage) {
    if (leadMessage.isImport) {
      return { location: 'import' };
    }

    if (leadMessage.accountChange) {
      return { location: 'automation', accountChange: leadMessage.accountChange };
    }

    return { location: 'automation' };
  }

  private async definedConditional(conditionals, leadStateMessage: LeadMessage, automation, dayjs) {
    try {
      if (!conditionals || !conditionals.length) {
        return true;
      }
      const timeZone = automation.account?.accountConfigs.time_zone;
      const loadContacts = new Set();
      let loadLead = false;
      let logic = '';
      if (conditionals && conditionals.length) {
        for (const [index, step] of conditionals.entries()) {
          if (index > 0 && step.conditional) {
            logic += step.conditional == 'and' ? ' && ' : ' || ';
          }
          switch (step.type) {
            case 'interation':
              let timeFilter = `${step.conditional_interation == 'yes' ? ' != null ' : ' == null '}`;
              if (step.time != 'all') {
                timeFilter =
                  step.conditional_interation == 'yes'
                    ? ` > (dayjs().tz('${timeZone || 'UTC'}').subtract(parseInt('${
                        step.time
                      }'), 'day').format('YYYY-MM-DD'))`
                    : ` < ((dayjs().tz('${timeZone || 'UTC'}').subtract(parseInt('${
                        step.time
                      }'), 'day').format('YYYY-MM-DD')) || !contact.${step.event})`;
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
                  logic += ` contact.created_at_date >= (dayjs().tz('${timeZone || 'UTC'}').subtract(${
                    step.user_field_value
                  }, 'day').format('YYYY-MM-DD')) `;
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
                    ${step.conditional_user_field} (dayjs().tz('${timeZone || 'UTC'}').subtract(${
                      step.user_field_value
                    }, 'day'))).length`;
              break;
            case 'custom_event':
              const today = dayjs().format('YYYY-MM-DD');
              let startDate = today;
              if (step.time_type == 'range' || step.time_type == 'date') {
                startDate = step.custom_event_date;
              } else {
                startDate = dayjs()
                  .subtract(Number(step.time) ? step.time : 30, 'day')
                  .format('YYYY-MM-DD');
              }
              let eventQuery = `SELECT *
                FROM events_logs_v2
                WHERE account_id = ${leadStateMessage.contact.accountId}
                AND time_date >= '${startDate}'
                AND event = '${step?.event?.name || 0}'
                AND contact_id IS NOT NULL AND contact_id = ${leadStateMessage.contact.id}`;
              if (step.time_type == 'range') {
                eventQuery += ` AND time_date BETWEEN '${step.custom_event_date}' AND '${step.custom_event_date_end}'`;
              } else if (step.time_type == 'date') {
                eventQuery += ` AND time_date ${step.conditional_event_filter} '${step.custom_event_date}'`;
              } else {
                if (['current_week', 'last_week'].includes(step.time)) {
                  const dates = this.processAutomationBetweenDate([step.time, step.conditional_week_day_filter]);
                  eventQuery += ` AND time_date BETWEEN '${dates.startDate}' AND '${dates.finalDate}' `;
                } else {
                  eventQuery += ` AND time_date ${step.conditional_event_filter} '${dayjs().subtract(step.time, 'day').format('YYYY-MM-DD')}'`;
                }
              }
              eventQuery += ' LIMIT 1';
              const resultEvent = await this.msgOpsService.queryEventsLogs(eventQuery);
              const conditionalEvent =
                (step.conditional_event_type == 'in' && resultEvent.length > 0) ||
                (step.conditional_event_type == 'not in' && resultEvent.length == 0);
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

      const accountId = leadStateMessage.contact.accountId ?? leadStateMessage.account?.id;
      const contact = await this.msgOpsService.findContactByIdConditional(
        leadStateMessage.contact.id,
        accountId,
        loadContacts,
      );
      if (!contact) {
        console.error(`[${leadStateMessage.id}] Contact not found for conditional evaluation.`);
        return false;
      }

      if (loadLead) {
        const lead = await this.msgOpsService.findLeadById(leadStateMessage.leadId);
        if (lead) {
          contact['lead'] = lead;
        }
      }

      let resultLogic: boolean;
      try {
        // NOTE: eval is used here intentionally to evaluate dynamic conditional
        // logic strings built from automation trigger configurations.
        resultLogic = eval(logic);
      } catch (evalError) {
        console.error(
          `Error evaluating conditional logic: ${logic} - STEP: ${JSON.stringify(leadStateMessage)} - ${evalError}`,
        );
        return false;
      }

      await this.queuePublisher.publishAnalyticsEvent({
        timestamp: Date.now(),
        event: resultLogic ? `automation-trigger-qualified` : 'automation-trigger-filtered-out',
        automationId: automation.id,
        accountId: contact.accountId,
        contactId: contact.id,
        uuid: contact.uuid,
        email: contact.email,
        properties: { logic, contactInfo: contact },
      });

      return resultLogic;
    } catch (error) {
      console.error(`Error conditional trigger: STEP: ${JSON.stringify(leadStateMessage)} - ${error}`);
      throw error;
    }
  }

  processAutomationBetweenDate(filter) {
    const dayFilter = parseInt(filter[1]);
    let startDate = null;
    let finalDate = null;
    if (filter[0] === 'current_week') {
      startDate = dayjs().day(dayFilter);
      if (dayjs().day() < dayFilter) {
        startDate = startDate.subtract(1, 'week');
      }
      const dayFinalDate = dayFilter === 0 ? 6 : dayFilter - 1;
      finalDate = dayjs().day(dayFinalDate);
      if (dayjs().day() >= dayFilter) {
        finalDate = finalDate.add(1, 'week');
      }
    } else {
      const dayFinalDate = dayFilter === 0 ? 6 : dayFilter - 1;
      startDate = dayjs().day(dayFilter);
      finalDate = dayjs().day(dayFinalDate);
      if (dayjs().day() < dayFilter) {
        startDate = startDate.subtract(2, 'week');
        finalDate = finalDate.subtract(1, 'week');
      } else {
        startDate = startDate.subtract(1, 'week');
      }
    }

    return { startDate: startDate.format('YYYY-MM-DD'), finalDate: finalDate.format('YYYY-MM-DD') };
  }

  processConditionalBetweenDate(typeFilter, dayFilter) {
    let startDate = null;
    let finalDate = null;
    if (typeFilter === 'current_week') {
      startDate = dayjs().day(dayFilter);
      if (dayjs().day() < dayFilter) {
        startDate = startDate.subtract(1, 'week');
      }
      const dayFinalDate = dayFilter === 0 ? 6 : dayFilter - 1;
      finalDate = dayjs().day(dayFinalDate);
      if (dayjs().day() >= dayFilter) {
        finalDate = finalDate.add(1, 'week');
      }
    } else {
      const dayFinalDate = dayFilter === 0 ? 6 : dayFilter - 1;
      startDate = dayjs().day(dayFilter);
      finalDate = dayjs().day(dayFinalDate);
      if (dayjs().day() < dayFilter) {
        startDate = startDate.subtract(2, 'week');
        finalDate = finalDate.subtract(1, 'week');
      } else {
        startDate = startDate.subtract(1, 'week');
      }
    }

    return { startDate: startDate.format('YYYY-MM-DD'), finalDate: finalDate.format('YYYY-MM-DD') };
  }
}
