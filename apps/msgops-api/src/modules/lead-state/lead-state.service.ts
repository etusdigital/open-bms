// TODO: REMOVE IT!

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LeadStateProvider } from './lead-state.providers';

@Injectable()
export class LeadStateService {
  constructor(private readonly leadStateProvider: LeadStateProvider) {}

  async getList(automationTitle: string, automationId: string, stepId: string) {
    if (automationId && automationId && stepId) {
      return await this.leadStateProvider.findByStepId(`${automationTitle}-${automationId}-${stepId}`);
    } else {
      throw new HttpException(JSON.stringify({ automationTitle, automationId, stepId }), HttpStatus.BAD_REQUEST);
    }
  }
}
