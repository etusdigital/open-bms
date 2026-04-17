export class Pagination {
  page: any;
  totalItems?: any;
  itemsPerPage?: any;
  totalPages?: any;
  order?: any;
  sortBy?: string;

  constructor(pagination: Pagination = {} as Pagination) {
    this.page = pagination.page || 1;
    this.totalItems = pagination.totalItems;
    this.itemsPerPage = pagination.itemsPerPage || 10;
    this.totalPages = pagination.totalPages;
    this.order = pagination.order;
    this.sortBy = pagination.sortBy;
  }
}
