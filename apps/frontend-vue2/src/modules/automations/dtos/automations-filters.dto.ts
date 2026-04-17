export class AutomationsFiltersDto {
  title?: string;
  sortOrder?: string;
  orderBy?: string;
  isActive?: string | null | (string | null)[];
  type?: string;
  automationsIds?: Array<number>;

  constructor(automationsFiltersDto: AutomationsFiltersDto = {} as AutomationsFiltersDto) {
    this.title = automationsFiltersDto.title;
    this.isActive = automationsFiltersDto.isActive;
    this.type = automationsFiltersDto.type;
    this.orderBy = automationsFiltersDto.orderBy;
    this.sortOrder = automationsFiltersDto.sortOrder;
    this.automationsIds = automationsFiltersDto.automationsIds;
  }
}
