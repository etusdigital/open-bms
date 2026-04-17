export class AutomationTagDto {
  id?: number;
  name?: string;
  accountId?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(automationTagDto: AutomationTagDto = {} as AutomationTagDto) {
    this.id = automationTagDto.id;
    this.name = automationTagDto.name;
    this.accountId = automationTagDto.accountId;
    this.createdAt = automationTagDto.createdAt;
    this.updatedAt = automationTagDto.updatedAt;
  }
}
