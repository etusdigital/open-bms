import { PaginationResultInterface } from '../interfaces/pagination-result.interface';

export class PaginationDto<T> {
  public results: T[];
  public itemsPerPage: number;
  public totalItems: number;
  public page: number;

  constructor(paginationResults: PaginationResultInterface<T>) {
    this.results = paginationResults.results;
    this.itemsPerPage = paginationResults.itemsPerPage;
    this.totalItems = paginationResults.total;
    this.page = paginationResults.page;
  }
}
