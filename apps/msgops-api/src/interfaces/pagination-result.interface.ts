export interface PaginationResultInterface<PaginationEntity> {
  results: PaginationEntity[];
  total: number;
  next?: string;
  previous?: string;
  page?: number;
  itemsPerPage?: number;
}
