export class CampaignsFiltersDto {
  title?: string;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  sortOrder?: string;
  orderBy?: string;
  status?: Array<number>;
  types?: Array<string>;
  messages?: Array<string>;
  tags?: Array<number>;
  segments?: Array<number>;
  campaignsIds?: Array<number>;

  constructor(campaignsFiltersDto: CampaignsFiltersDto = {} as CampaignsFiltersDto) {
    this.title = campaignsFiltersDto.title;
    this.startDate = campaignsFiltersDto.startDate;
    this.endDate = campaignsFiltersDto.endDate;
    this.sortOrder = campaignsFiltersDto.sortOrder;
    this.orderBy = campaignsFiltersDto.orderBy;
    this.status = campaignsFiltersDto.status;
    this.types = campaignsFiltersDto.types;
    this.messages = campaignsFiltersDto.messages;
    this.tags = campaignsFiltersDto.tags;
    this.segments = campaignsFiltersDto.segments;
    this.campaignsIds = campaignsFiltersDto.campaignsIds;
  }
}
