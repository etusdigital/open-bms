export class SuppressedsFiltersDto {
  title?: string;
  sortOrder?: string;
  orderBy?: string;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  emails?: Array<string>;

  constructor(contactsFiltersDto: SuppressedsFiltersDto = {} as SuppressedsFiltersDto) {
    this.title = contactsFiltersDto.title;
    this.sortOrder = contactsFiltersDto.sortOrder;
    this.orderBy = contactsFiltersDto.orderBy;
    this.startDate = contactsFiltersDto.startDate;
    this.endDate = contactsFiltersDto.endDate;
  }
}
