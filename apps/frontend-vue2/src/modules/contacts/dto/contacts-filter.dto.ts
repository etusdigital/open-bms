export class ContactsFiltersDto {
  title?: string;
  sortOrder?: string;
  orderBy?: string;
  isActive?: string;
  isUnsubscribed?: boolean;
  type?: string;
  tags?: Array<number>;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  contacts?: Array<number>;
  activities?: Array<string>;
  channels?: Array<string>;

  constructor(contactsFiltersDto: ContactsFiltersDto = {} as ContactsFiltersDto) {
    this.title = contactsFiltersDto.title;
    this.sortOrder = contactsFiltersDto.sortOrder;
    this.orderBy = contactsFiltersDto.orderBy;
    this.isActive = contactsFiltersDto.isActive;
    this.type = contactsFiltersDto.type;
    this.tags = contactsFiltersDto.tags;
    this.startDate = contactsFiltersDto.startDate;
    this.endDate = contactsFiltersDto.endDate;
    this.contacts = contactsFiltersDto.contacts;
    this.isUnsubscribed = contactsFiltersDto.isUnsubscribed;
    this.activities = contactsFiltersDto.activities;
    this.channels = contactsFiltersDto.channels;
  }
}
