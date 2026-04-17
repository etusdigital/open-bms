import { AccountDto } from './account.dto';

export class UserAccountDto {
  account: AccountDto;
  accountId: number;
  isMasterUser: boolean;
  userId: number;
  roleOverride?: string | null;
  inheritsGlobal?: boolean;

  constructor(userAccountDto: UserAccountDto = {} as UserAccountDto) {
    this.userId = userAccountDto.userId;
    this.isMasterUser = userAccountDto.isMasterUser;
    this.accountId = userAccountDto.accountId;
    this.account = userAccountDto.account;
    this.roleOverride = userAccountDto.roleOverride || null;
    this.inheritsGlobal = userAccountDto.inheritsGlobal || false;
  }
}
