export class CampaignConfigDto {
  id?: number;
  name: string;
  description: string;
  accountId?: number;
  configs: any;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(configDto: CampaignConfigDto = {} as CampaignConfigDto) {
    this.id = configDto.id;
    this.name = configDto.name;
    this.description = configDto.description;
    this.accountId = configDto.accountId;
    this.createdAt = configDto.createdAt;
    this.updatedAt = configDto.updatedAt;
    this.configs = configDto.configs;
  }
}
