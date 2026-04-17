export class CustomEventDto {
  id?: number;
  name: string;
  description: string;
  properties: any;
  accountId: number;
  statistics: {
    total: number;
    unique: number;
    last_occurrence: Date;
    days: {
      date: Date;
      events_count: number;
      events_unique: number;
    }[];
  };
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;

  constructor(customEventDto: CustomEventDto = {} as CustomEventDto) {
    this.id = customEventDto.id;
    this.name = customEventDto.name;
    this.description = customEventDto.description;
    this.properties = customEventDto.properties;
    this.accountId = customEventDto.accountId;
    this.statistics = customEventDto.statistics;
    this.createdAt = customEventDto.createdAt;
    this.updatedAt = customEventDto.updatedAt;
    this.deletedAt = customEventDto.deletedAt;
  }
}
