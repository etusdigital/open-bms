export class AccountConfigDto {
  account_id: number;
  name: string;
  value: any;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(accountDto: AccountConfigDto = {} as AccountConfigDto) {
    this.account_id = accountDto.account_id;
    this.name = accountDto.name;
    this.value = accountDto.value;
    this.description = accountDto.description;
    this.createdAt = accountDto.createdAt;
    this.updatedAt = accountDto.updatedAt;
  }
}
