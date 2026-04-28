import type { TriggerCampaignFormValues } from './trigger-campaign-schema';

type ParsedDefaults = Omit<TriggerCampaignFormValues, 'title' | 'description' | 'messageType'>;

/**
 * Parse the merged trigger steps tree (from GET /campaigns/:id) into flat form values.
 * The backend returns `mergeStepsAndTriggers()`: `{ type:'trigger', settings:{...}, child:[...] }`
 */
export function parseTriggerSteps(steps: any): ParsedDefaults {
  const defaults: ParsedDefaults = {
    messages: [],
    triggerType: 'events',
    eventType: 'open',
    frequency: 'unique',
    timePeriodValue: 1,
    timePeriodUnit: 'days',
    sendTiming: 'immediate',
    waitValue: 0,
    waitUnit: 'hours',
  };

  if (!steps || steps.type !== 'trigger') return defaults;

  // Parse trigger settings (Who step)
  const settings = steps.settings ?? {};
  defaults.triggerType = settings.type === 'custom_events' ? 'custom_events' : 'events';
  defaults.eventType = settings.eventType ?? 'open';
  defaults.frequency = settings.applyFrequency ?? 'unique';
  defaults.triggerMessageId = settings.id ?? undefined;
  defaults.triggerMessageTitle = settings.title ?? settings.name ?? undefined;

  if (defaults.triggerType === 'custom_events') {
    defaults.customEvent = { id: settings.id, name: settings.name ?? '' };
    defaults.triggerMessageId = undefined;
    defaults.triggerMessageTitle = undefined;
  }

  // Parse time period for multiply-period
  if (defaults.frequency === 'multiply-period' && settings.timePeriod > 0) {
    const unit = settings.typeMultiply || 'days';
    defaults.timePeriodUnit = unit as 'days' | 'hours' | 'minutes';
    if (unit === 'days') {
      defaults.timePeriodValue = Math.round(settings.timePeriod / (24 * 60));
    } else if (unit === 'hours') {
      defaults.timePeriodValue = Math.round(settings.timePeriod / 60);
    } else {
      defaults.timePeriodValue = settings.timePeriod;
    }
  }

  // Parse child steps (What + When)
  let childSteps = steps.child ?? [];

  // Check for wait step wrapper
  if (childSteps.length > 0 && childSteps[0]?.type === 'wait') {
    defaults.sendTiming = 'wait';
    const waitSettings = childSteps[0].settings ?? {};
    defaults.waitValue = waitSettings.timer ?? 0;
    defaults.waitUnit = (waitSettings.timerType as 'hours' | 'minutes') ?? 'hours';
    // Unwrap: messages are inside the wait step's child
    childSteps = childSteps[0].child ?? [];
  }

  // Parse messages from email or randomMessage step
  if (childSteps.length > 0) {
    const msgStep = childSteps[0];
    if (msgStep.type === 'randomMessage' && msgStep.settings?.messages) {
      defaults.messages = msgStep.settings.messages.map((m: any) => ({
        id: m.id,
        title: m.title ?? '',
        subject: m.subject ?? '',
        name: m.name ?? '',
        links: m.links ?? [],
      }));
    } else if (msgStep.type === 'email' && msgStep.settings) {
      defaults.messages = [
        {
          id: msgStep.settings.id,
          title: msgStep.settings.title ?? '',
          subject: msgStep.settings.subject ?? '',
          name: msgStep.settings.name ?? '',
          links: msgStep.settings.links ?? [],
        },
      ];
    }
  }

  return defaults;
}
