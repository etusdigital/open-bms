import { CampaignConfigDto } from "./campaign-config.dto";

export class CampaignRuleDto {
  id?: number;
  name: string;
  description: string;
  accountId?: number;
  configs: Array<CampaignConfigDto>;
  weekDays: number[] = [];
  createdAt?: Date;
  updatedAt?: Date;

  constructor(configDto: CampaignRuleDto = {} as CampaignRuleDto) {
    this.id = configDto.id;
    this.name = configDto.name;
    this.description = configDto.description;
    this.accountId = configDto.accountId;
    this.weekDays = configDto.weekDays;
    this.configs = configDto.configs;
    this.createdAt = configDto.createdAt;
    this.updatedAt = configDto.updatedAt;
  }
}
