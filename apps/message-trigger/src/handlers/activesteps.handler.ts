import { Injectable } from '@nestjs/common';
import { LeadStateMessage, Next } from '../interfaces';

@Injectable()
export class ActiveStepsHandler {
  createNextLeadStateMessage(leadStateMessage: LeadStateMessage, step: any): Next {
    let nextStep = step.child && step.child.length ? step.child : false;

    if (!nextStep) {
      nextStep = [
        {
          id: 0,
          type: 'end',
          child: [],
          settings: {},
        },
      ];
    }

    const nextData: LeadStateMessage = {
      ...leadStateMessage,
      automation: {
        ...leadStateMessage.automation,
        steps: nextStep,
      },
      activeStepId: String(nextStep[0].id),
    };

    return {
      pubName: process.env.TOPIC_NAME_MESSAGE_TRIGGER,
      data: nextData,
    };
  }
}
