export class TagDto {
  id?: number;
  name: string;
  type: string;
  description: string;
  accountId: number;
  createdAt: Date;
  updatedAt: Date;
  countContacts?: number | string;
  recurrence?: string;
  scheduleCloudTaskId?: string;
  query?: string;
  steps?: any;
  segmentInfo?: string;
  contactsLimit?: string;
  addBounced?: string;
  addUnsubscribed?: string;
  addInvalid?: string;

  constructor(tagDto: TagDto = {} as TagDto) {
    this.id = tagDto.id;
    this.name = tagDto.name;
    this.type = tagDto.type;
    this.description = tagDto.description;
    this.accountId = tagDto.accountId;
    this.createdAt = tagDto.createdAt;
    this.updatedAt = tagDto.updatedAt;
    this.countContacts = tagDto.countContacts || 0;
    this.recurrence = tagDto.recurrence;
    this.scheduleCloudTaskId = tagDto.scheduleCloudTaskId;
    this.query = tagDto.query;
    this.steps = tagDto.steps;
    this.segmentInfo = tagDto.segmentInfo;
    this.contactsLimit = tagDto.contactsLimit;
    this.addBounced = tagDto.addBounced;
    this.addUnsubscribed = tagDto.addUnsubscribed;
    this.addInvalid = tagDto.addInvalid;
  }
}
