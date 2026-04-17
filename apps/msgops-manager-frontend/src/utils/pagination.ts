export class Pagination {
  page: number;
  totalItems?: number | undefined;
  itemsPerPage?: number;
  totalPages?: number | undefined;
  order?: string | undefined;
  sortBy?: string | undefined;

  constructor(pagination: Pagination = {} as Pagination) {
    this.page = pagination.page || 1;
    this.totalItems = pagination.totalItems;
    this.itemsPerPage = pagination.itemsPerPage || 10;
    this.totalPages = pagination.totalPages;
    this.order = pagination.order;
    this.sortBy = pagination.sortBy;
  }
}
