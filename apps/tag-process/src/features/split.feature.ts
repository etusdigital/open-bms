import { Injectable } from '@nestjs/common';
import { Email, Step } from '../interfaces';

export type AutomationIdPart = string;
export type Percent = string;
export type EmailTitlePart = string;
export type Pool = string;
export type Sender = string;
export type SplitTerm = [Percent, EmailTitlePart, Pool, Sender];

export type Config = {
  percent: number;
  automationId: string;
  pool: string;
  sender: string;
};

@Injectable()
export class SplitFeature {
  getConfig(): Config {
    const term = (process.env.FEATURE_SPLIT_TERM || '').split(':') as SplitTerm;

    if (term.length !== 4) return null;

    const config = {
      percent: parseInt(term[0]),
      automationId: term[1],
      pool: term[2],
      sender: term[3],
    };

    if (!config.percent || !config.pool || !config.sender || !config.automationId) return null;

    return config;
  }

  shouldChange(automationId: string, config: Config): boolean {
    if (!config) return false;
    if (!this.compareStrings(config.automationId, automationId)) return false;

    return this.calculatePercent(config.percent);
  }

  calculatePercent(percent: number) {
    return percent >= Math.floor(Math.random() * (100 - 0 + 1) + 0);
  }

  compareStrings(term1: string, term2: string) {
    return term1.toLowerCase() === term2.toLowerCase();
  }

  // parsePoolsAndSenders(leadStateMessage: LeadStateMessage, featureConfig: Config) {
  //   const newActiveStep =
  //     leadStateMessage.automation.activeStep.type === StepType.EMAIL
  //       ? this.updateStepEmail(leadStateMessage.automation.activeStep, featureConfig)
  //       : leadStateMessage.automation.activeStep;

  //   const newSteps = leadStateMessage.automation.steps.map((step) => {
  //     return step.type === StepType.EMAIL ? this.updateStepEmail(step, featureConfig) : step;
  //   });

  //   const newLeadStateMessage: LeadStateMessage = {
  //     ...leadStateMessage,
  //     automation: {
  //       ...leadStateMessage.automation,
  //       steps: newSteps,
  //       activeStep: newActiveStep,
  //     },
  //   };

  //   return newLeadStateMessage;
  // }

  updateStepEmail(step: Step, featureConfig: Config): Step {
    const newConfig: Email = {
      ...step.config,
      ippool: featureConfig.pool,
      from: {
        ...step.config.from,
        email: featureConfig.sender,
      },
    };

    return {
      ...step,
      config: newConfig,
    };
  }
}
