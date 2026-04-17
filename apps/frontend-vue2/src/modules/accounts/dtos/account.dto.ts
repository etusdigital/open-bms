export class AccountDto {
  id?: number;
  name: string;
  description?: string;
  defaultDomain: string;
  domains?: JSON;
  defaultSenderName?: string;
  defaultSenderEmail?: string;
  defaultAddress?: string;
  settings?: JSON;
  sendgridKey?: string;
  linkUnsubscriber?: string;
  accountConfigs: any;
  accountHash: string;
  createdAt: Date;
  updatedAt?: Date;
  isInternal?: boolean;

  constructor(accountDto: AccountDto = {} as AccountDto) {
    this.id = accountDto.id;
    this.name = accountDto.name;
    this.description = accountDto.description;
    this.defaultDomain = accountDto.defaultDomain;
    this.domains = accountDto.domains;
    this.defaultSenderName = accountDto.defaultSenderName;
    this.defaultSenderEmail = accountDto.defaultSenderEmail;
    this.defaultAddress = accountDto.defaultAddress;
    this.settings = accountDto.settings;
    this.sendgridKey = accountDto.sendgridKey;
    this.linkUnsubscriber = accountDto.linkUnsubscriber;
    this.accountConfigs = accountDto.accountConfigs;
    this.accountHash = accountDto.accountHash;
    this.createdAt = accountDto.createdAt;
    this.updatedAt = accountDto.updatedAt;
    this.isInternal = accountDto.isInternal;
  }
}
