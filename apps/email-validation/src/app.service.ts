import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { MsgopsService } from './msgops/msgops.service';
import { CheckerProvider } from './providers/checker.provider';

@Injectable()
export class AppService {
  constructor(
    private readonly msgOpsService: MsgopsService,
    private readonly checkerProvider: CheckerProvider,
  ) {}

  async validate(email: string, apiKey: string, shouldChargeUse = true) {
    if (shouldChargeUse) {
      const account = await this.msgOpsService.findAccountByApiKey(apiKey);
      if (!account) {
        throw new HttpException('Account not found', HttpStatus.FORBIDDEN);
      }
      await this.msgOpsService.createOrUpdateAccountUsage(account.id);
    }

    const validateEmail = email
      .toLowerCase()
      .match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);

    if (!validateEmail) {
      return { result: 'undeliverable' };
    }

    const hasEmailCache = await this.msgOpsService.findByEmail(email);
    if (hasEmailCache) {
      const last7Days = new Date();
      last7Days.setDate(new Date().getDate() - 7);

      const byPassChecker = {
        accept_all: false,
        email: email,
        reason: 'accepted_email',
        state: 'deliverable',
        result: 'deliverable',
      };

      if (hasEmailCache.lastOpen && new Date(hasEmailCache.lastOpen) > last7Days) {
        return byPassChecker;
      }

      if (hasEmailCache.lastClick && new Date(hasEmailCache.lastClick) > last7Days) {
        return byPassChecker;
      }

      if (hasEmailCache.unsubscribedAt && new Date(hasEmailCache.unsubscribedAt) > last7Days) {
        return byPassChecker;
      }

      if (hasEmailCache.response) {
        return { ...JSON.parse(hasEmailCache.response), result: hasEmailCache.status };
      }
    }

    const response = await this.checkerProvider.check(email);

    if (response.apiStatus !== 249) {
      await this.msgOpsService.createOrUpdateEmail(response);
    }
    return { ...response.response, result: response.status };
  }
}
