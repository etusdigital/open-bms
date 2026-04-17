import { Injectable } from '@nestjs/common';
import { TrackerService } from '../../tracker/tracker.service';

export type AutomationIdPart = string;
export type Percent = string;
export type EmailTitlePart = string;
export type Pool = string;
export type Sender = string;
export type SplitTerm = [Percent, AutomationIdPart, EmailTitlePart, Pool, Sender];

export type Config = {
  percent: number;
  automationIdPart: string;
  emailTitlePart: string;
  pool: string;
  sender: string;
};

@Injectable()
export class SplitFeature {
  constructor(private readonly trackerService: TrackerService) {}

  getConfig(): Config {
    const term = (process.env.FEATURE_SPLIT_TERM || '').split(':') as SplitTerm;

    if (term.length !== 5) return null;

    const config = {
      percent: parseInt(term[0]),
      automationIdPart: term[1],
      emailTitlePart: term[2],
      pool: term[3],
      sender: term[4],
    };

    if (!config.percent || !config.pool || !config.sender || !config.automationIdPart || !config.emailTitlePart) return null;

    return config;
  }

  shouldChange(automationId: string, emailTitle: string, config: Config): boolean {
    if (!automationId || !emailTitle || !config) {
      this.trackerService.logDebug(`[SplitFeature] Missing settings.`, `automationId: ${automationId} | emailTitle: ${emailTitle} | config: ${JSON.stringify(config)}`);
      return false;
    }

    const { automationIdPart, emailTitlePart } = config;
    if (!this.compareStrings(automationId, automationIdPart)) return false;
    if (!this.compareStrings(emailTitle, emailTitlePart)) return false;

    return this.calculatePercent(config.percent);
  }

  calculatePercent(percent: number) {
    return percent >= Math.floor(Math.random() * (100 - 0 + 1) + 0);
  }

  compareStrings(term1: string, term2: string) {
    return term1.toLowerCase().includes(term2.toLowerCase());
  }
}
